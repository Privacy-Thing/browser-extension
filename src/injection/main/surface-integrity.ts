import type { BatteryPatchInstallation } from "@privacy-brand/refract-core/fingerprint/battery-status";
import { type RegisteredAnchor } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import {
  createPrivateArray,
  createPrivateWeakSet,
  privateArrayPush,
  privateDeleteProperty,
  privateOwnDescriptor,
  privateReflectGet,
  privateWeakSetAdd,
  privateWeakSetHas,
} from "@privacy-brand/refract-core/runtime/primordials";

import {
  findPropertyOwner,
  registerDescriptor,
  type RuntimeIntegrityContext,
} from "./surface-integrity-base";

import type { SpoofingSurfaceKey } from "@/shared/spoofing-surfaces";
import type { SpoofingSurfaceMethodId } from "@/shared/types";

export * from "./surface-integrity-base";
export * from "./surface-integrity-fp";

export const registerNavigatorRef = (
  integrity: RuntimeIntegrityContext | undefined,
  targetGlobal: typeof globalThis,
  key: "geolocation" | "permissions" | "serviceWorker" | "userAgentData",
  surfaceId: SpoofingSurfaceKey,
): void => {
  const navigatorObject = targetGlobal.navigator;
  if (!integrity || !navigatorObject) return;
  const resolved = findPropertyOwner(navigatorObject, key);
  if (!resolved) return;
  const currentValue = privateReflectGet(resolved.owner, key, navigatorObject);
  if (
    currentValue === null ||
    (typeof currentValue !== "object" && typeof currentValue !== "function")
  ) {
    return;
  }
  registerDescriptor({
    integrity,
    target: resolved.owner,
    key,
    installedDescriptor: resolved.descriptor,
    anchor: {
      surfaceId,
      resolveReceiver: () => navigatorObject,
      // Validate the effective owner, not the returned object. userAgentData
      // is not reference-stable across native getter calls in Chromium.
      validateEffectiveLookup: (receiver, owner, lookupKey) =>
        findPropertyOwner(receiver, lookupKey)?.owner === owner,
      repairEffectiveLookup: (receiver, owner, lookupKey) => {
        if (receiver === owner) return "repair-failed";
        const shadow = privateOwnDescriptor(receiver, lookupKey);
        if (!shadow) return "repair-failed";
        if (shadow.configurable === false) return "hostile-non-configurable";
        return privateDeleteProperty(receiver, lookupKey)
          ? "repaired"
          : "repair-failed";
      },
    },
  });
};

export const registerGeoIntegrity = (
  integrity: RuntimeIntegrityContext,
  targetGlobal: typeof globalThis,
): void => {
  const geolocation = targetGlobal.navigator?.geolocation;
  if (!geolocation) return;
  registerNavigatorRef(integrity, targetGlobal, "geolocation", "geolocation");
  const geolocationPrototype = (
    targetGlobal as typeof globalThis & {
      Geolocation?: { prototype?: object };
    }
  ).Geolocation?.prototype;
  const methods = [
    { key: "clearWatch", methodId: "geolocation.clearWatch" },
    { key: "getCurrentPosition", methodId: "geolocation.getCurrentPosition" },
    { key: "watchPosition", methodId: "geolocation.watchPosition" },
  ] as const satisfies ReadonlyArray<{
    key: PropertyKey;
    methodId: SpoofingSurfaceMethodId;
  }>;
  const targets =
    geolocationPrototype && geolocationPrototype !== geolocation
      ? [geolocationPrototype, geolocation]
      : [geolocation];
  for (const target of targets) {
    for (const { key, methodId } of methods) {
      registerDescriptor({
        integrity,
        target,
        key,
        anchor: {
          surfaceId: "geolocation",
          methodId,
          ...(target === geolocation ? { receiver: geolocation } : {}),
        },
      });
    }
  }
};

export const registerPermIntegrity = (
  integrity: RuntimeIntegrityContext,
  targetGlobal: typeof globalThis,
): void => {
  const permissions = targetGlobal.navigator?.permissions;
  if (!permissions) return;
  registerNavigatorRef(integrity, targetGlobal, "permissions", "geolocation");
  const target =
    (
      targetGlobal as typeof globalThis & {
        Permissions?: { prototype?: object };
      }
    ).Permissions?.prototype ?? permissions;
  registerDescriptor({
    integrity,
    target,
    key: "query",
    anchor: {
      surfaceId: "geolocation",
      methodId: "geolocation.permissionsQuery",
      receiver: permissions,
    },
  });
};

const registerBatteryManager = (
  integrity: RuntimeIntegrityContext,
  installation: BatteryPatchInstallation,
  registeredTargets: WeakSet<object>,
  managerTokens: RegisteredAnchor[],
): void => {
  const managerAnchors = installation.getManagerGetterAnchors();
  for (let index = 0; index < managerAnchors.length; index += 1) {
    const anchor = managerAnchors[index]!;
    if (privateWeakSetHas(registeredTargets, anchor.target)) continue;
    const token = registerDescriptor({
      integrity,
      target: anchor.target,
      key: anchor.key,
      anchor: {
        surfaceId: "battery",
        resolveReceiver: installation.getManager,
        unavailableReason: "target-not-ready",
      },
      installedDescriptor: anchor.descriptor,
    });
    if (token) privateArrayPush(managerTokens, token);
  }
  const firstAnchor = managerAnchors[0];
  if (firstAnchor) privateWeakSetAdd(registeredTargets, firstAnchor.target);
};

export const registerBatteryIntegrity = (
  integrity: RuntimeIntegrityContext,
  installation: BatteryPatchInstallation,
  receiver: object,
): void => {
  const getBatteryAnchor = installation.getBatteryAnchor;
  if (!getBatteryAnchor) return;
  registerDescriptor({
    integrity,
    target: getBatteryAnchor.target,
    key: getBatteryAnchor.key,
    anchor: {
      surfaceId: "battery",
      methodId: "battery.getBattery",
      receiver,
    },
    installedDescriptor: getBatteryAnchor.descriptor,
  });
  const registeredTargets = createPrivateWeakSet<object>();
  const managerTokens = createPrivateArray<RegisteredAnchor>(0);
  const registerManager = (): void =>
    registerBatteryManager(integrity, installation, registeredTargets, managerTokens);
  registerManager();
  installation.onManagerReady(() => {
    registerManager();
    for (let index = 0; index < managerTokens.length; index += 1) {
      integrity.registrar.ensure(managerTokens[index]!);
    }
  });
};

export const registerWorkerIntegrity = (
  integrity: RuntimeIntegrityContext,
  targetGlobal: typeof globalThis,
  ownership: { worker: boolean; sharedWorker: boolean },
): void => {
  const constructors = [
    { key: "Worker", surfaceId: "worker", methodId: "worker.constructor" },
    {
      key: "SharedWorker",
      surfaceId: "sharedWorker",
      methodId: "sharedWorker.constructor",
    },
  ] as const;
  for (const { key, methodId, surfaceId } of constructors) {
    if (
      (key === "Worker" && !ownership.worker) ||
      (key === "SharedWorker" && !ownership.sharedWorker) ||
      typeof (targetGlobal as unknown as Record<string, unknown>)[key] !== "function"
    ) {
      continue;
    }
    registerDescriptor({
      integrity,
      target: targetGlobal,
      key,
      anchor: { surfaceId, methodId },
    });
  }
};

export const registerServiceIntegrity = (
  integrity: RuntimeIntegrityContext,
  targetGlobal: typeof globalThis,
): void => {
  const serviceWorker = targetGlobal.navigator?.serviceWorker;
  const target = (
    targetGlobal as typeof globalThis & {
      ServiceWorkerContainer?: { prototype?: object };
    }
  ).ServiceWorkerContainer?.prototype;
  if (!serviceWorker || !target) return;
  registerNavigatorRef(integrity, targetGlobal, "serviceWorker", "serviceWorker");
  registerDescriptor({
    integrity,
    target,
    key: "register",
    anchor: {
      surfaceId: "serviceWorker",
      methodId: "serviceWorker.register",
      receiver: serviceWorker,
    },
  });
};
