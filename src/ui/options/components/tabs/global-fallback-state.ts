import type { GlobalFallbackRule } from "@/shared/types";

export const isGlobalFallbackInactive = (
  globalFallbackRule: GlobalFallbackRule | undefined,
): boolean => Boolean(globalFallbackRule && globalFallbackRule.enabled === false);

export const isFallbackIncomplete = (
  globalFallbackRule: GlobalFallbackRule | undefined,
): boolean =>
  Boolean(
    globalFallbackRule &&
    globalFallbackRule.enabled !== false &&
    globalFallbackRule.fingerprintSurfaceOverrides?.geolocation !== false &&
    !globalFallbackRule.locationId &&
    Object.values(globalFallbackRule.fingerprintSurfaceOverrides ?? {}).every(
      (value) => value === undefined,
    ),
  );
