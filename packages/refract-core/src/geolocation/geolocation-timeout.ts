const DEFAULT_GEO_TIMEOUT_MS = 0xffff_ffff;

export type GeoAcquisitionTiming = {
  delayMs: number;
  timedOut: boolean;
};

export const getGeoAcquisitionTiming = (
  acquisitionDelayMs: number,
  options?: PositionOptions,
): GeoAcquisitionTiming => {
  const normalizedDelay = Math.max(0, acquisitionDelayMs);
  const timeoutMs =
    options?.timeout === undefined ? DEFAULT_GEO_TIMEOUT_MS : options.timeout;

  return {
    delayMs: Math.min(normalizedDelay, timeoutMs),
    timedOut: timeoutMs < normalizedDelay,
  };
};
