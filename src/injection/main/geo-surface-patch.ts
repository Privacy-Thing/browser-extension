import { createLogger } from "@privacy-brand/refract-browser/common/debug-logger";
import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import { installGeolocationPatch as installGeoPatch } from "@privacy-brand/refract-core/geolocation/geo-patch";
import { installGeoErrorPrototype } from "@privacy-brand/refract-core/geolocation/geolocation-error-factory";
import {
  getOrCreateGeoPermState,
  installGeoPermPatch,
} from "@privacy-brand/refract-core/geolocation/geolocation-permissions";

import {
  registerGeoIntegrity,
  registerPermIntegrity,
  type RuntimeIntegrityContext,
} from "@/injection/main/surface-integrity";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

export const getGeoMethodId = (method: string): SpoofingSurfaceMethodId | undefined => {
  if (method.startsWith("getCurrentPosition")) {
    return "geolocation.getCurrentPosition";
  }
  if (method.startsWith("watchPosition")) return "geolocation.watchPosition";
  if (method.startsWith("clearWatch")) return "geolocation.clearWatch";
  return undefined;
};

export const installPermissionsPatch = (
  snapshot: RuntimeSnapshot,
  targetGlobal: typeof globalThis = globalThis,
  integrity?: RuntimeIntegrityContext,
): boolean => {
  if (snapshot.geolocationEnabled === false) return false;
  const targetNavigator = targetGlobal.navigator;
  if (!targetNavigator || !("permissions" in targetNavigator)) return false;
  const queryTarget =
    typeof targetGlobal.Permissions !== "undefined"
      ? targetGlobal.Permissions.prototype
      : targetNavigator.permissions;
  const baseLogger = createLogger(snapshot, "Permissions");

  installGeoPermPatch({
    ...(integrity
      ? {
          integrity: {
            registrar: integrity.registrar,
            surfaceId: "geolocation" as const,
            realmId: integrity.realmId,
          },
        }
      : {}),
    logger: (method, args, result) => {
      if (method === "query [geolocation]") {
        markSurfaceUsed("geolocation", "geolocation.permissionsQuery");
      }
      baseLogger(method, args, result);
    },
    patchState: getOrCreateGeoPermState(targetGlobal),
    permissionPrototype:
      typeof targetGlobal.PermissionStatus === "undefined"
        ? null
        : targetGlobal.PermissionStatus.prototype,
    queryTarget,
    resolveGeolocationState: () => "granted",
  });
  return true;
};

export const installChildGeoPatch = (
  snapshot: RuntimeSnapshot,
  targetGlobal: typeof globalThis,
  integrity?: RuntimeIntegrityContext,
): void => {
  if (snapshot.geolocationEnabled === false) return;
  installGeoErrorPrototype(globalThis);
  installGeoErrorPrototype(targetGlobal, globalThis);
  const baseLogger = createLogger(snapshot, "Geolocation");
  const installedGeo = installGeoPatch(
    snapshot,
    targetGlobal,
    (method, args, result) => {
      markSurfaceUsed("geolocation", getGeoMethodId(method));
      baseLogger(method, args, result);
    },
    { markerKey: `${__PT_SHIM_GUARD_KEY__}:geolocation` },
  );
  if (installedGeo && integrity) registerGeoIntegrity(integrity, targetGlobal);
  const installedPermissions = installPermissionsPatch(
    snapshot,
    targetGlobal,
    integrity,
  );
  if (installedPermissions && integrity) {
    registerPermIntegrity(integrity, targetGlobal);
  }
};
