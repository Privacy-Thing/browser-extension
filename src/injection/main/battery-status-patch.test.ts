import { installBatteryPatch } from "@privacy-brand/refract-core/fingerprint/battery-status";
import { describe, expect, it, vi } from "vitest";

import type { RuntimeSnapshot } from "@/shared/types";

type TestListener = (event: TestEvent) => void;

const trustedEvents = new WeakSet<object>();
const stoppedEvents = new WeakSet<object>();

class TestEvent {
  constructor(
    readonly type: string,
    trusted = false,
  ) {
    if (trusted) trustedEvents.add(this);
    Object.defineProperty(this, "isTrusted", {
      configurable: false,
      enumerable: true,
      get: function getIsTrusted(this: TestEvent): boolean {
        return trustedEvents.has(this);
      },
    });
  }

  stopImmediatePropagation(): void {
    stoppedEvents.add(this);
  }

  isPropagationStopped(): boolean {
    return stoppedEvents.has(this);
  }
}

const listenersByTarget = new WeakMap<
  object,
  Map<string, { capture: boolean; listener: TestListener }[]>
>();
const handlersByTarget = new WeakMap<object, Map<string, TestListener | null>>();

class TestEventTarget {
  addEventListener(
    type: string,
    listener: TestListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const listeners = listenersByTarget.get(this) ?? new Map();
    listenersByTarget.set(this, listeners);
    const registered = listeners.get(type) ?? [];
    registered.push({
      capture: options === true || Boolean(options && options.capture),
      listener,
    });
    listeners.set(type, registered);
  }

  removeEventListener(type: string, listener: TestListener): void {
    const registered = listenersByTarget.get(this)?.get(type);
    if (!registered) return;
    const index = registered.findIndex((entry) => entry.listener === listener);
    if (index >= 0) registered.splice(index, 1);
  }

  dispatchEvent(event: TestEvent): boolean {
    const registered = listenersByTarget.get(this)?.get(event.type) ?? [];
    const ordered = [
      ...registered.filter((entry) => entry.capture),
      ...registered.filter((entry) => !entry.capture),
    ];
    for (const { listener } of ordered) {
      listener.call(this, event);
      if (event.isPropagationStopped()) return true;
    }
    handlersByTarget.get(this)?.get(`on${event.type}`)?.call(this, event);
    return true;
  }
}

const BATTERY_EVENTS = [
  "chargingchange",
  "chargingtimechange",
  "dischargingtimechange",
  "levelchange",
] as const;

const buildSnapshot = (battery = true): RuntimeSnapshot => ({
  geo: { latitude: 0, longitude: 0, accuracy: 1, noiseRadius: 0 },
  locale: {
    language: "en-US",
    languages: ["en-US"],
    timeZone: "UTC",
    acceptLanguage: "en-US",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
  debugMode: false,
  watchPositionDelay: [100, 100],
  fingerprint: { spoofingToggles: { battery } },
});

const createRealm = (nativePromiseFactory?: (manager: object) => Promise<object>) => {
  const managerBrands = new WeakSet<object>();

  class FakeBatteryManager extends TestEventTarget {
    constructor() {
      super();
      managerBrands.add(this);
    }

    get charging(): boolean {
      if (!managerBrands.has(this)) throw new TypeError("Illegal invocation");
      return false;
    }

    get chargingTime(): number {
      if (!managerBrands.has(this)) throw new TypeError("Illegal invocation");
      return 120;
    }

    get dischargingTime(): number {
      if (!managerBrands.has(this)) throw new TypeError("Illegal invocation");
      return 240;
    }

    get level(): number {
      if (!managerBrands.has(this)) throw new TypeError("Illegal invocation");
      return 0.42;
    }
  }

  Object.defineProperty(FakeBatteryManager.prototype, Symbol.toStringTag, {
    configurable: true,
    value: "BatteryManager",
  });
  for (const eventName of BATTERY_EVENTS) {
    Object.defineProperty(FakeBatteryManager.prototype, `on${eventName}`, {
      configurable: true,
      enumerable: true,
      get(this: object): TestListener | null {
        return handlersByTarget.get(this)?.get(`on${eventName}`) ?? null;
      },
      set(this: object, listener: TestListener | null) {
        const handlers = handlersByTarget.get(this) ?? new Map();
        handlersByTarget.set(this, handlers);
        handlers.set(`on${eventName}`, listener);
      },
    });
  }

  const manager = new FakeBatteryManager();
  const nativePromise = nativePromiseFactory?.(manager) ?? Promise.resolve(manager);
  const navigatorBrands = new WeakSet<object>();

  class FakeNavigator {
    constructor() {
      navigatorBrands.add(this);
    }

    getBattery(): Promise<object> {
      if (!navigatorBrands.has(this)) throw new TypeError("Illegal invocation");
      return nativePromise;
    }
  }

  const navigator = new FakeNavigator();
  return {
    FakeBatteryManager,
    FakeNavigator,
    manager,
    nativePromise,
    navigator,
    targetGlobal: {
      BatteryManager: FakeBatteryManager,
      Event: TestEvent,
      EventTarget: TestEventTarget,
      Navigator: FakeNavigator,
      navigator,
    } as unknown as typeof globalThis,
  };
};

describe("installBatteryPatch", () => {
  it("preserves the native Promise and manager identity while fixing values", async () => {
    const realm = createRealm();
    const installation = installBatteryPatch(buildSnapshot(), realm.targetGlobal);
    const firstPromise = realm.navigator.getBattery();
    const secondPromise = realm.navigator.getBattery();
    const battery = await firstPromise;

    expect(installation.status).toBe("installed");
    expect(firstPromise).toBe(realm.nativePromise);
    expect(secondPromise).toBe(firstPromise);
    expect(battery).toBe(realm.manager);
    expect(battery).toBeInstanceOf(realm.FakeBatteryManager);
    expect(Object.getPrototypeOf(battery)).toBe(realm.FakeBatteryManager.prototype);
    expect(Object.prototype.toString.call(battery)).toBe("[object BatteryManager]");
    expect((battery as typeof realm.manager).constructor).toBe(
      realm.FakeBatteryManager,
    );
    expect(Object.keys(battery)).toEqual([]);
    expect(Object.getOwnPropertyNames(battery)).toEqual([]);
    expect((battery as typeof realm.manager).charging).toBe(true);
    expect((battery as typeof realm.manager).chargingTime).toBe(0);
    expect((battery as typeof realm.manager).dischargingTime).toBe(Infinity);
    expect((battery as typeof realm.manager).level).toBe(1);
  });

  it("preserves getter brand checks, descriptors and function shape", () => {
    const realm = createRealm();
    const originalDescriptors = Object.getOwnPropertyDescriptors(
      realm.FakeBatteryManager.prototype,
    );
    installBatteryPatch(buildSnapshot(), realm.targetGlobal);

    for (const key of [
      "charging",
      "chargingTime",
      "dischargingTime",
      "level",
    ] as const) {
      const original = originalDescriptors[key]!;
      const installed = Object.getOwnPropertyDescriptor(
        realm.FakeBatteryManager.prototype,
        key,
      )!;
      expect(installed.configurable).toBe(original.configurable);
      expect(installed.enumerable).toBe(original.enumerable);
      expect(installed.set).toBe(original.set);
      expect(installed.get?.name).toBe(original.get?.name);
      expect(installed.get?.length).toBe(original.get?.length);
      expect(Object.getPrototypeOf(installed.get)).toBe(
        Object.getPrototypeOf(original.get),
      );
      expect("prototype" in installed.get!).toBe(false);
      expect(() => Reflect.construct(installed.get!, [])).toThrow(TypeError);
      expect(() => installed.get?.call({})).toThrow(TypeError);
      expect(Function.prototype.toString.call(installed.get)).toBe(
        `function get ${key}() { [native code] }`,
      );
    }
  });

  it("keeps getBattery non-constructible and preserves its native contract", () => {
    const realm = createRealm();
    const original = Object.getOwnPropertyDescriptor(
      realm.FakeNavigator.prototype,
      "getBattery",
    )!;
    installBatteryPatch(buildSnapshot(), realm.targetGlobal);
    const installed = Object.getOwnPropertyDescriptor(
      realm.FakeNavigator.prototype,
      "getBattery",
    )!;

    expect(installed.configurable).toBe(original.configurable);
    expect(installed.enumerable).toBe(original.enumerable);
    expect(installed.writable).toBe(original.writable);
    expect(installed.value.name).toBe(original.value.name);
    expect(installed.value.length).toBe(original.value.length);
    expect(Object.getPrototypeOf(installed.value)).toBe(
      Object.getPrototypeOf(original.value),
    );
    expect("prototype" in installed.value).toBe(false);
    expect(() => Reflect.construct(installed.value, [])).toThrow(TypeError);
    expect(() => Reflect.apply(installed.value, {}, [])).toThrow(TypeError);
    expect(Function.prototype.toString.call(installed.value)).toBe(
      "function getBattery() { [native code] }",
    );
  });

  it("stops events when isTrusted reports true and preserves manual events", async () => {
    const realm = createRealm();
    installBatteryPatch(buildSnapshot(), realm.targetGlobal);
    const battery = (await realm.navigator.getBattery()) as typeof realm.manager;
    const listener = vi.fn();
    const handler = vi.fn();
    battery.addEventListener("levelchange", listener);
    (
      battery as typeof realm.manager & {
        onlevelchange: TestListener | null;
      }
    ).onlevelchange = handler;

    battery.dispatchEvent(new TestEvent("levelchange", true));
    expect(listener).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();

    battery.dispatchEvent(new TestEvent("levelchange"));
    expect(listener).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledOnce();
  });

  it("preserves native rejection identity", async () => {
    const denied = new DOMException("Denied", "NotAllowedError");
    const nativePromise = Promise.reject(denied);
    const realm = createRealm(() => nativePromise);
    installBatteryPatch(buildSnapshot(), realm.targetGlobal);

    expect(realm.navigator.getBattery()).toBe(nativePromise);
    await expect(realm.navigator.getBattery()).rejects.toBe(denied);
  });

  it("does not consult page-controlled Promise hooks while learning the manager", async () => {
    const realm = createRealm();
    const speciesDescriptor = Object.getOwnPropertyDescriptor(Promise, Symbol.species);
    const thenDescriptor = Object.getOwnPropertyDescriptor(Promise.prototype, "then");
    let speciesReads = 0;
    let thenReads = 0;
    let ownThenReads = 0;
    Object.defineProperty(Promise, Symbol.species, {
      configurable: true,
      get() {
        speciesReads += 1;
        return Promise;
      },
    });
    Object.defineProperty(Promise.prototype, "then", {
      configurable: true,
      get() {
        thenReads += 1;
        return thenDescriptor?.value;
      },
    });
    Object.defineProperty(realm.nativePromise, "then", {
      configurable: true,
      get() {
        ownThenReads += 1;
        return thenDescriptor?.value;
      },
    });

    try {
      installBatteryPatch(buildSnapshot(), realm.targetGlobal);
      expect(realm.navigator.getBattery()).toBe(realm.nativePromise);
      expect(speciesReads).toBe(0);
      expect(thenReads).toBe(0);
      expect(ownThenReads).toBe(0);
    } finally {
      Reflect.deleteProperty(realm.nativePromise, "then");
      if (speciesDescriptor) {
        Object.defineProperty(Promise, Symbol.species, speciesDescriptor);
      }
      if (thenDescriptor) {
        Object.defineProperty(Promise.prototype, "then", thenDescriptor);
      }
    }
    await realm.nativePromise;
  });

  it("does not consult poisoned Promise hooks for a foreign realm", async () => {
    class ForeignPromise<T> extends Promise<T> {}
    const realm = createRealm((manager) => ForeignPromise.resolve(manager));
    Object.assign(realm.targetGlobal, { Promise: ForeignPromise });
    const managerReady = vi.fn();
    const installation = installBatteryPatch(buildSnapshot(), realm.targetGlobal);
    installation.onManagerReady(managerReady);

    const nativeThen = Object.getOwnPropertyDescriptor(
      Promise.prototype,
      "then",
    )?.value;
    let prototypeThenReads = 0;
    let ownThenReads = 0;
    let speciesReads = 0;
    Object.defineProperty(ForeignPromise.prototype, "then", {
      configurable: true,
      get() {
        prototypeThenReads += 1;
        return nativeThen;
      },
    });
    Object.defineProperty(ForeignPromise, Symbol.species, {
      configurable: true,
      get() {
        speciesReads += 1;
        return ForeignPromise;
      },
    });
    Object.defineProperty(realm.nativePromise, "then", {
      configurable: true,
      get() {
        ownThenReads += 1;
        return nativeThen;
      },
    });

    try {
      expect(realm.navigator.getBattery()).toBe(realm.nativePromise);
      expect(prototypeThenReads).toBe(0);
      expect(ownThenReads).toBe(0);
      expect(speciesReads).toBe(0);
      expect(managerReady).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(realm.nativePromise, "then");
      Reflect.deleteProperty(ForeignPromise.prototype, "then");
      Reflect.deleteProperty(ForeignPromise, Symbol.species);
    }
    await realm.nativePromise;
  });

  it("does not observe a Permissions Policy rejection", async () => {
    const denied = new DOMException("Denied", "NotAllowedError");
    const nativePromise = Promise.reject(denied);
    const realm = createRealm(() => nativePromise);
    const policy = Object.create({
      allowsFeature(feature: string): boolean {
        return feature !== "battery";
      },
    });
    Object.assign(realm.targetGlobal, {
      document: { permissionsPolicy: policy },
      isSecureContext: true,
    });
    const managerReady = vi.fn();
    const installation = installBatteryPatch(buildSnapshot(), realm.targetGlobal);
    installation.onManagerReady(managerReady);

    expect(realm.navigator.getBattery()).toBe(nativePromise);
    await expect(nativePromise).rejects.toBe(denied);
    expect(managerReady).not.toHaveBeenCalled();
  });

  it("observes the cached Promise and manager only once", async () => {
    const realm = createRealm();
    installBatteryPatch(buildSnapshot(), realm.targetGlobal);

    realm.navigator.getBattery();
    realm.navigator.getBattery();
    await realm.nativePromise;
    await Promise.resolve();

    for (const eventName of BATTERY_EVENTS) {
      expect(listenersByTarget.get(realm.manager)?.get(eventName)).toHaveLength(1);
    }
  });

  it("counts each getBattery call exactly once", () => {
    const realm = createRealm();
    const onAccess = vi.fn();
    installBatteryPatch(buildSnapshot(), realm.targetGlobal, { onAccess });

    realm.navigator.getBattery();
    expect(onAccess).toHaveBeenCalledOnce();
    realm.navigator.getBattery();
    expect(onAccess).toHaveBeenCalledTimes(2);
  });

  it("stays idempotent in one bundle and updates the access callback", async () => {
    const realm = createRealm();
    const earlyAccess = vi.fn();
    const mainAccess = vi.fn();
    installBatteryPatch(buildSnapshot(), realm.targetGlobal, {
      onAccess: earlyAccess,
    });
    const installedGetBattery = realm.FakeNavigator.prototype.getBattery;
    const second = installBatteryPatch(buildSnapshot(), realm.targetGlobal, {
      onAccess: mainAccess,
    });

    expect(second.status).toBe("installed");
    expect(realm.FakeNavigator.prototype.getBattery).toBe(installedGetBattery);
    await realm.navigator.getBattery();
    expect(earlyAccess).not.toHaveBeenCalled();
    expect(mainAccess).toHaveBeenCalledOnce();
  });

  it("leaves disabled and unavailable surfaces untouched", () => {
    const disabledRealm = createRealm();
    const native = disabledRealm.FakeNavigator.prototype.getBattery;
    expect(
      installBatteryPatch(buildSnapshot(false), disabledRealm.targetGlobal).status,
    ).toBe("disabled");
    expect(disabledRealm.FakeNavigator.prototype.getBattery).toBe(native);

    const unavailableGlobal = {
      Event: TestEvent,
      EventTarget: TestEventTarget,
      Navigator: class Navigator {},
      navigator: {},
    } as unknown as typeof globalThis;
    expect(installBatteryPatch(buildSnapshot(), unavailableGlobal).status).toBe(
      "unavailable",
    );
  });
});
