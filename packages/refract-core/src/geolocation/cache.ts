export type GeoCacheOptions = {
  createPosition: () => GeolocationPosition;
  getNextWatchDelay: () => number;
  now: () => number;
  onCacheHit?: (details: {
    expiresAt: number;
    options?: PositionOptions;
    timestamp: number;
  }) => void;
  onCacheRefresh?: (details: {
    expiresAt: number;
    nextTimestamp: number;
    options?: PositionOptions;
    previousExpiresAt: number | null;
    previousTimestamp: number | null;
  }) => void;
  shouldUseCachedPosition: (
    timestamp: number,
    expiresAt: number,
    options?: PositionOptions,
  ) => boolean;
};

export type GeolocationPositionCache = {
  clear: () => void;
  getCachedPosition: (options?: PositionOptions) => GeolocationPosition | null;
  getPosition: (options?: PositionOptions) => GeolocationPosition;
  getWatchRefreshDelay: (minimumDelayMs?: number) => number;
  refreshPosition: (options?: PositionOptions) => GeolocationPosition;
};

/**
 * Owns the shared geolocation cache/expiry semantics while leaving transport,
 * lifecycle, and adapter-specific watch orchestration to the caller.
 */
export const createGeoCache = (options: GeoCacheOptions): GeolocationPositionCache => {
  let cachedPosition: GeolocationPosition | null = null;
  let cachedPositionExpires = 0;

  const refreshPosition = (positionOptions?: PositionOptions): GeolocationPosition => {
    const previousTimestamp = cachedPosition?.timestamp ?? null;
    const previousExpiresAt = cachedPosition ? cachedPositionExpires : null;
    const position = options.createPosition();
    cachedPosition = position;
    cachedPositionExpires = options.now() + options.getNextWatchDelay();
    options.onCacheRefresh?.({
      expiresAt: cachedPositionExpires,
      nextTimestamp: position.timestamp,
      previousExpiresAt,
      previousTimestamp,
      ...(positionOptions === undefined ? {} : { options: positionOptions }),
    });
    return position;
  };

  const getCachedPosition = (
    positionOptions?: PositionOptions,
  ): GeolocationPosition | null => {
    if (
      !cachedPosition ||
      !options.shouldUseCachedPosition(
        cachedPosition.timestamp,
        cachedPositionExpires,
        positionOptions,
      )
    ) {
      return null;
    }

    options.onCacheHit?.({
      expiresAt: cachedPositionExpires,
      timestamp: cachedPosition.timestamp,
      ...(positionOptions === undefined ? {} : { options: positionOptions }),
    });
    return cachedPosition;
  };

  return {
    clear(): void {
      cachedPosition = null;
      cachedPositionExpires = 0;
    },
    getCachedPosition,
    getPosition(positionOptions?: PositionOptions): GeolocationPosition {
      const position = getCachedPosition(positionOptions);
      if (position) {
        return position;
      }

      return refreshPosition(positionOptions);
    },
    getWatchRefreshDelay(minimumDelayMs = 0): number {
      const baseDelay = cachedPosition
        ? cachedPositionExpires - options.now()
        : options.getNextWatchDelay();
      return Math.max(minimumDelayMs, baseDelay);
    },
    refreshPosition,
  };
};
