import { shouldSuspendGeoWatch } from "./geolocation-runtime-helpers";
import { getGeoAcquisitionTiming } from "./geolocation-timeout";

type GeolocationWatchGlobal = {
  clearTimeout: typeof globalThis.clearTimeout;
  document?: Pick<Document, "visibilityState">;
  setTimeout: typeof globalThis.setTimeout;
};

export type GeolocationWatchPhase = "initial" | "emit";
export type GeoWatchRequest = {
  watchId: number;
  successCallback: PositionCallback;
  positionOptions?: PositionOptions | undefined;
  initialRefreshDelayMs?: number | undefined;
  errorCallback?: PositionErrorCallback | null | undefined;
};

export type GeoWatchOptions = {
  getCallbackDelay: () => number;
  getCachedPosition?: (options?: PositionOptions) => GeolocationPosition | null;
  getNextWatchDelay: () => number;
  getPosition: (options?: PositionOptions) => GeolocationPosition;
  getWatchRefreshDelay: (minimumDelayMs?: number) => number;
  isWatchActive?: (watchId: number) => boolean;
  onPosition?: (
    phase: GeolocationWatchPhase,
    position: GeolocationPosition,
    options?: PositionOptions,
  ) => void;
  refreshPosition: (options?: PositionOptions) => GeolocationPosition;
  reportTimeout: (callback?: PositionErrorCallback | null) => void;
  targetGlobal: GeolocationWatchGlobal;
};

export type GeoWatchController = {
  clearWatch: (watchId: number) => void;
  scheduleWatch: (request: GeoWatchRequest) => void;
};

/**
 * Owns the shared geolocation watch lifecycle once a spoofed runtime is ready:
 * initial callback scheduling, cache-aligned follow-up scheduling, visibility
 * suspension, and tracked timeout cleanup. Transport/bootstrap concerns stay
 * with the caller.
 */
/**
 * Invokes a page-supplied watch callback, isolating a throw. The native
 * Geolocation API reports a throwing success callback but keeps the watch
 * running, so a throw must neither break the reschedule loop nor escape as a
 * global unhandled error.
 */
const invokeWatchCallback = <TValue>(
  callback: ((value: TValue) => void) | null | undefined,
  value: TValue,
): void => {
  if (!callback) {
    return;
  }

  try {
    callback(value);
  } catch {
    // Page callback threw — swallow and keep the watch alive (native parity).
  }
};

export const createGeoWatchController = (
  options: GeoWatchOptions,
): GeoWatchController => {
  type ActiveWatch = [ReturnType<typeof globalThis.setTimeout>?];

  const activeWatches = new Map<number, ActiveWatch>();
  const isExternallyWatchActive = (watchId: number): boolean =>
    options.isWatchActive?.(watchId) ?? true;

  return {
    clearWatch(watchId: number): void {
      const activeWatch = activeWatches.get(watchId);
      if (activeWatch === undefined) {
        return;
      }

      if (activeWatch[0] !== undefined) {
        options.targetGlobal.clearTimeout(activeWatch[0]);
      }
      activeWatches.delete(watchId);
    },
    scheduleWatch({
      watchId,
      successCallback,
      positionOptions,
      initialRefreshDelayMs,
      errorCallback,
    }: GeoWatchRequest): void {
      if (!isExternallyWatchActive(watchId)) {
        return;
      }

      const previousWatch = activeWatches.get(watchId);
      if (previousWatch?.[0] !== undefined) {
        options.targetGlobal.clearTimeout(previousWatch[0]);
      }
      const activeWatch: ActiveWatch = [];
      const isWatchActive = (): boolean =>
        activeWatches.get(watchId) === activeWatch && isExternallyWatchActive(watchId);
      const scheduleTimeout = (callback: () => void, delayMs: number): void => {
        activeWatch[0] = options.targetGlobal.setTimeout(callback, delayMs);
        activeWatches.set(watchId, activeWatch);
      };

      const handleTimeoutError = (error: GeolocationPositionError): void => {
        if (!isWatchActive()) {
          return;
        }
        invokeWatchCallback(errorCallback, error);
        if (isWatchActive()) {
          scheduleAcquisition("emit", options.getNextWatchDelay());
        }
      };

      const scheduleAcquisition = (
        phase: GeolocationWatchPhase,
        acquisitionDelayMs: number,
      ): void => {
        const cachedPosition =
          phase === "initial"
            ? (options.getCachedPosition?.(positionOptions) ?? null)
            : null;
        const timing = cachedPosition
          ? { delayMs: 0, timedOut: false }
          : getGeoAcquisitionTiming(acquisitionDelayMs, positionOptions);

        scheduleTimeout(() => {
          if (!isWatchActive()) {
            return;
          }

          if (shouldSuspendGeoWatch(options.targetGlobal)) {
            scheduleAcquisition(phase, options.getNextWatchDelay());
            return;
          }

          if (timing.timedOut) {
            options.reportTimeout(handleTimeoutError);
            return;
          }

          const position =
            cachedPosition ??
            (phase === "initial"
              ? options.getPosition(positionOptions)
              : options.refreshPosition(positionOptions));
          options.onPosition?.(phase, position, positionOptions);
          invokeWatchCallback(successCallback, position);
          if (!isWatchActive()) {
            return;
          }

          scheduleAcquisition(
            "emit",
            phase === "initial"
              ? (initialRefreshDelayMs ?? options.getWatchRefreshDelay(1000))
              : options.getNextWatchDelay(),
          );
        }, timing.delayMs);
      };

      scheduleAcquisition("initial", options.getCallbackDelay());
    },
  };
};
