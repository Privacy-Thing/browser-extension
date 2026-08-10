import { createNativeSource, maskAsNative } from "../native/native-mask";
import {
  createPrivateMap,
  createPrivateArray,
  createPrivateWeakMap,
  createPrivateWeakSet,
  privateArrayPush,
  privateMapGet,
  privateMapSet,
  privateDefineProperty,
  privateOwnDescriptor,
  privateGetPrototype,
  privateSetPrototype,
  privateReflectApply,
  privateReflectConstruct,
  privateWeakMapGet,
  privateWeakMapSet,
  privateWeakSetAdd,
  privateWeakSetHas,
} from "../runtime/primordials";
import type { RuntimeSnapshot } from "../types/snapshot";

import {
  canAwaitBatteryPromise,
  captureBatteryTools,
  type BatteryPromisePrimitives,
} from "./battery-promise-observer";
import { isFpSurfaceEnabled } from "./surface-guards";

type BatteryNavigator = Navigator & {
  getBattery?: () => Promise<object>;
};

type BatteryGlobal = typeof globalThis & {
  BatteryManager?: {
    prototype?: object;
  };
  Navigator?: {
    prototype?: object;
  };
};

type BatteryReadyCallback = (manager: object) => void;

export type BatteryDescriptorAnchor = {
  target: object;
  key: PropertyKey;
  descriptor: PropertyDescriptor;
};

export type BatteryPatchStatus = "installed" | "disabled" | "unavailable";

export type BatteryPatchInstallation = {
  status: BatteryPatchStatus;
  getBatteryAnchor: BatteryDescriptorAnchor | null;
  getManager: () => object | null;
  getManagerGetterAnchors: () => readonly BatteryDescriptorAnchor[];
  onManagerReady: (callback: BatteryReadyCallback) => void;
};

export type BatteryPatchOptions = {
  onAccess?: () => void;
};

const BATTERY_EVENTS = [
  "chargingchange",
  "chargingtimechange",
  "dischargingtimechange",
  "levelchange",
] as const;

const BATTERY_GETTER_KEYS = [
  "charging",
  "chargingTime",
  "dischargingTime",
  "level",
] as const;

const FIXED_BATTERY_VALUES = {
  charging: true,
  chargingTime: 0,
  dischargingTime: Infinity,
  level: 1,
} as const;

type BatteryGetterKey = keyof typeof FIXED_BATTERY_VALUES;

type TrustedEventPrimitives = {
  addEventListener: ((...args: never[]) => unknown) | null;
  isTrusted: ((...args: never[]) => boolean) | null;
  stopImmediatePropagation: ((...args: never[]) => unknown) | null;
};

type BatteryPermissionsPolicy = {
  allowsFeature?: (feature: string) => boolean;
};

type BatteryPolicyDocument = Document & {
  featurePolicy?: BatteryPermissionsPolicy;
  permissionsPolicy?: BatteryPermissionsPolicy;
};

type BatteryInstallationState = {
  status: "installed";
  getBatteryAnchor: BatteryDescriptorAnchor;
  getBatteryWrapper: Function;
  manager: object | null;
  managerGetterAnchors: readonly BatteryDescriptorAnchor[];
  managerReadyCallbacks: Map<number, BatteryReadyCallback>;
  nextReadyCallbackId: number;
  onAccess: (() => void) | undefined;
  observedManagers: WeakSet<object>;
  observedPromises: WeakSet<object>;
  patchedManagerPrototypes: WeakSet<object>;
  eventPrimitives: TrustedEventPrimitives;
  promisePrimitives: BatteryPromisePrimitives | null;
};

const installationsByGlobal = createPrivateWeakMap<object, BatteryInstallationState>();

const findGetBatteryOwner = (
  navigatorObject: BatteryNavigator,
  targetGlobal: BatteryGlobal,
): { target: object; descriptor: PropertyDescriptor } | null => {
  let target: object | null =
    targetGlobal.Navigator?.prototype ?? privateGetPrototype(navigatorObject as object);
  for (let depth = 0; target && depth < 32; depth += 1) {
    const descriptor = privateOwnDescriptor(target, "getBattery");
    if (typeof descriptor?.value === "function") {
      return { target, descriptor };
    }
    target = privateGetPrototype(target);
  }
  return null;
};

const createEmptyInstallation = (
  status: Extract<BatteryPatchStatus, "disabled" | "unavailable">,
): BatteryPatchInstallation => ({
  status,
  getBatteryAnchor: null,
  getManager: () => null,
  getManagerGetterAnchors: () => [],
  onManagerReady: () => undefined,
});

const notifyManagerReady = (state: BatteryInstallationState, manager: object): void => {
  for (let index = 0; index < state.nextReadyCallbackId; index += 1) {
    const callback = privateMapGet(state.managerReadyCallbacks, index);
    if (!callback) continue;
    try {
      callback(manager);
    } catch {
      // Integrity/diagnostic callbacks must not affect the native promise.
    }
  }
};

const createInstallationView = (
  state: BatteryInstallationState,
): BatteryPatchInstallation => ({
  status: "installed",
  getBatteryAnchor: state.getBatteryAnchor,
  getManager: () => state.manager,
  getManagerGetterAnchors: () => state.managerGetterAnchors,
  onManagerReady: (callback) => {
    const callbackId = state.nextReadyCallbackId;
    state.nextReadyCallbackId += 1;
    privateMapSet(state.managerReadyCallbacks, callbackId, callback);
    if (state.manager) {
      try {
        callback(state.manager);
      } catch {
        // Match the asynchronous notification path.
      }
    }
  },
});

const createFixedGetter = (
  key: BatteryGetterKey,
  nativeGetter: () => unknown,
): (() => unknown) => {
  const holder = {
    get [key](): unknown {
      privateReflectApply(nativeGetter, this, []);
      return FIXED_BATTERY_VALUES[key];
    },
  };
  const getter = privateOwnDescriptor(holder, key)?.get;
  if (!getter) {
    throw new TypeError(`Unable to create BatteryManager.${key} getter`);
  }
  privateSetPrototype(getter, privateGetPrototype(nativeGetter));
  return maskAsNative(
    getter,
    createNativeSource(key, "get"),
    nativeGetter.length,
  ) as () => unknown;
};

const findPropertyDescriptor = (
  initialTarget: object | null,
  key: PropertyKey,
): PropertyDescriptor | undefined => {
  let target = initialTarget;
  for (let depth = 0; target && depth < 32; depth += 1) {
    const descriptor = privateOwnDescriptor(target, key);
    if (descriptor) {
      return descriptor;
    }
    target = privateGetPrototype(target);
  }
  return undefined;
};

const patchManagerPrototype = (
  state: BatteryInstallationState,
  managerPrototype: object,
): void => {
  if (privateWeakSetHas(state.patchedManagerPrototypes, managerPrototype)) {
    return;
  }

  const descriptors = createPrivateArray<{
    descriptor: PropertyDescriptor;
    key: BatteryGetterKey;
    nativeGetter: () => unknown;
  }>(0);
  for (let index = 0; index < BATTERY_GETTER_KEYS.length; index += 1) {
    const key = BATTERY_GETTER_KEYS[index]!;
    const descriptor = privateOwnDescriptor(managerPrototype, key);
    if (typeof descriptor?.get !== "function") {
      throw new TypeError(`BatteryManager.prototype.${key} is unavailable`);
    }
    privateArrayPush(descriptors, {
      descriptor,
      key,
      nativeGetter: descriptor.get as () => unknown,
    });
  }

  const anchors = createPrivateArray<BatteryDescriptorAnchor>(0);
  for (let index = 0; index < descriptors.length; index += 1) {
    const { descriptor, key, nativeGetter } = descriptors[index]!;
    const installedDescriptor: PropertyDescriptor = {
      ...descriptor,
      get: createFixedGetter(key, nativeGetter),
    };
    privateDefineProperty(managerPrototype, key, installedDescriptor);
    privateArrayPush(anchors, {
      target: managerPrototype,
      key,
      descriptor: installedDescriptor,
    });
  }

  state.managerGetterAnchors = anchors;
  privateWeakSetAdd(state.patchedManagerPrototypes, managerPrototype);
};

const captureEventPrimitives = (
  targetGlobal: typeof globalThis,
): TrustedEventPrimitives => {
  const eventTargetPrototype = targetGlobal.EventTarget?.prototype;
  const eventPrototype = targetGlobal.Event?.prototype;
  const addEventListener = findPropertyDescriptor(
    eventTargetPrototype ?? null,
    "addEventListener",
  )?.value;
  let isTrusted: unknown;
  try {
    const EventConstructor = targetGlobal.Event;
    if (typeof EventConstructor === "function") {
      const event = privateReflectConstruct<Event>(EventConstructor, ["pt:battery"]);
      isTrusted = privateOwnDescriptor(event, "isTrusted")?.get;
    }
  } catch {
    // Fall back to prototype lookup for non-Chromium-compatible implementations.
  }
  isTrusted ??= findPropertyDescriptor(eventPrototype ?? null, "isTrusted")?.get;
  const stopImmediatePropagation = findPropertyDescriptor(
    eventPrototype ?? null,
    "stopImmediatePropagation",
  )?.value;

  return {
    addEventListener:
      typeof addEventListener === "function"
        ? (addEventListener as (...args: never[]) => unknown)
        : null,
    isTrusted:
      typeof isTrusted === "function"
        ? (isTrusted as (...args: never[]) => boolean)
        : null,
    stopImmediatePropagation:
      typeof stopImmediatePropagation === "function"
        ? (stopImmediatePropagation as (...args: never[]) => unknown)
        : null,
  };
};

const installEventBlockers = (
  state: BatteryInstallationState,
  manager: object,
): void => {
  if (privateWeakSetHas(state.observedManagers, manager)) {
    return;
  }
  privateWeakSetAdd(state.observedManagers, manager);

  const primitives = state.eventPrimitives;
  if (
    !primitives.addEventListener ||
    !primitives.isTrusted ||
    !primitives.stopImmediatePropagation
  ) {
    return;
  }
  const { addEventListener, isTrusted, stopImmediatePropagation } = primitives;

  const blockTrustedChange = (event: Event): void => {
    if (privateReflectApply<boolean>(isTrusted, event, [])) {
      privateReflectApply(stopImmediatePropagation, event, []);
    }
  };
  for (let index = 0; index < BATTERY_EVENTS.length; index += 1) {
    const eventName = BATTERY_EVENTS[index]!;
    privateReflectApply(addEventListener, manager, [
      eventName,
      blockTrustedChange,
      true,
    ]);
  }
};

const canObserveBatteryPromise = (targetGlobal: typeof globalThis): boolean => {
  if (targetGlobal.isSecureContext === false) {
    return false;
  }
  const targetDocument = targetGlobal.document as BatteryPolicyDocument | undefined;
  const policy = targetDocument?.permissionsPolicy ?? targetDocument?.featurePolicy;
  if (!policy) {
    return true;
  }
  const allowsFeature = findPropertyDescriptor(
    privateGetPrototype(policy as object),
    "allowsFeature",
  )?.value;
  if (typeof allowsFeature !== "function") {
    return false;
  }
  try {
    return privateReflectApply<boolean>(allowsFeature, policy, ["battery"]);
  } catch {
    return false;
  }
};

const handleResolvedManager = (
  state: BatteryInstallationState,
  manager: object,
): void => {
  try {
    const managerPrototype = privateGetPrototype(manager);
    if (managerPrototype) {
      patchManagerPrototype(state, managerPrototype);
    }
    state.manager = manager;
    installEventBlockers(state, manager);
    notifyManagerReady(state, manager);
  } catch {
    // Preserve the native promise and manager even if hardening fails.
  }
};

const awaitNativeManager = async (
  state: BatteryInstallationState,
  nativePromise: Promise<object>,
): Promise<void> => {
  try {
    handleResolvedManager(state, await nativePromise);
  } catch {
    // Permissions Policy and native failures keep their original promise result.
  }
};

const observeNativePromise = (
  state: BatteryInstallationState,
  nativePromise: Promise<object>,
  targetGlobal: typeof globalThis,
): void => {
  if (
    privateWeakSetHas(state.observedPromises, nativePromise) ||
    !canObserveBatteryPromise(targetGlobal) ||
    !canAwaitBatteryPromise(state.promisePrimitives, nativePromise)
  ) {
    return;
  }
  privateWeakSetAdd(state.observedPromises, nativePromise);
  void awaitNativeManager(state, nativePromise);
};

const installGetBatteryWrapper = (
  state: BatteryInstallationState,
  nativeGetBattery: (this: BatteryNavigator) => Promise<object>,
  targetGlobal: typeof globalThis,
): Function => {
  const holder = {
    getBattery(this: BatteryNavigator): Promise<object> {
      state.onAccess?.();
      const nativePromise = privateReflectApply<Promise<object>>(
        nativeGetBattery,
        this,
        [],
      );
      observeNativePromise(state, nativePromise, targetGlobal);
      return nativePromise;
    },
  };
  const wrapper = holder.getBattery;
  privateSetPrototype(wrapper, privateGetPrototype(nativeGetBattery));
  return maskAsNative(
    wrapper,
    createNativeSource("getBattery"),
    nativeGetBattery.length,
  );
};

export const installBatteryPatch = (
  snapshot: RuntimeSnapshot,
  targetGlobal: typeof globalThis = globalThis,
  options: BatteryPatchOptions = {},
): BatteryPatchInstallation => {
  if (!isFpSurfaceEnabled(snapshot.fingerprint, "battery")) {
    return createEmptyInstallation("disabled");
  }

  const existing = privateWeakMapGet(installationsByGlobal, targetGlobal as object);
  if (existing) {
    const currentDescriptor = privateOwnDescriptor(
      existing.getBatteryAnchor.target,
      existing.getBatteryAnchor.key,
    );
    if (currentDescriptor?.value !== existing.getBatteryWrapper) {
      throw new Error("Conflicting Battery Status installation");
    }
    existing.onAccess = options.onAccess;
    return createInstallationView(existing);
  }

  const navigatorObject = targetGlobal.navigator as BatteryNavigator | undefined;
  if (!navigatorObject) {
    return createEmptyInstallation("unavailable");
  }
  const owner = findGetBatteryOwner(navigatorObject, targetGlobal as BatteryGlobal);
  if (!owner) {
    return createEmptyInstallation("unavailable");
  }

  const nativeGetBattery = owner.descriptor.value as (
    this: BatteryNavigator,
  ) => Promise<object>;
  const state: BatteryInstallationState = {
    status: "installed",
    getBatteryAnchor: {
      target: owner.target,
      key: "getBattery",
      descriptor: owner.descriptor,
    },
    getBatteryWrapper: nativeGetBattery,
    manager: null,
    managerGetterAnchors: [],
    managerReadyCallbacks: createPrivateMap<number, BatteryReadyCallback>(),
    nextReadyCallbackId: 0,
    onAccess: options.onAccess,
    observedManagers: createPrivateWeakSet<object>(),
    observedPromises: createPrivateWeakSet<object>(),
    patchedManagerPrototypes: createPrivateWeakSet<object>(),
    eventPrimitives: captureEventPrimitives(targetGlobal),
    promisePrimitives: captureBatteryTools(targetGlobal),
  };

  const managerPrototype = (targetGlobal as BatteryGlobal).BatteryManager?.prototype;
  if (managerPrototype) {
    patchManagerPrototype(state, managerPrototype);
  }

  const wrapper = installGetBatteryWrapper(state, nativeGetBattery, targetGlobal);
  const installedDescriptor: PropertyDescriptor = {
    ...owner.descriptor,
    value: wrapper,
  };
  privateDefineProperty(owner.target, "getBattery", installedDescriptor);
  state.getBatteryWrapper = wrapper;
  state.getBatteryAnchor = {
    target: owner.target,
    key: "getBattery",
    descriptor: installedDescriptor,
  };
  privateWeakMapSet(installationsByGlobal, targetGlobal as object, state);
  return createInstallationView(state);
};
