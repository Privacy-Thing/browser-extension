type GeoVisibilityGlobal = {
  document?: Pick<Document, "visibilityState">;
};

/**
 * Enforces the native Web API receiver contract for `Geolocation` methods.
 *
 * All patched methods must throw `TypeError("Illegal invocation")` when they
 * are detached from the original `navigator.geolocation` object.
 */
export const validateGeoReceiver = (
  receiver: unknown,
  nativeGeolocation: Geolocation,
): void => {
  if (receiver !== nativeGeolocation) {
    throw new TypeError("Illegal invocation");
  }
};

/**
 * Builds an absolute Unix-epoch geolocation timestamp while preserving the
 * native integer rounding semantics expected by page code.
 */
export const createGeoTimestamp = (nowMs: number, measurementDelayMs: number): number =>
  Math.max(0, Math.round(nowMs - measurementDelayMs));

/**
 * Returns whether geolocation watch emissions should pause because the current
 * browsing document is hidden. Worker contexts expose no `document`, so they
 * continue to report `false`.
 */
export const shouldSuspendGeoWatch = (targetGlobal: GeoVisibilityGlobal): boolean =>
  targetGlobal.document?.visibilityState === "hidden";
