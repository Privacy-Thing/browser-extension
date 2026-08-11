import type { FirefoxGeoState } from "@privacy-brand/refract-browser/common/firefox-shim-state";

import { createNativeSource, maskAsNative } from "../native/native-mask";
import { inspectPatchAnchors, markPatchAnchor } from "../runtime/patch-marker";
import { privateCryptoRandomUnit } from "../runtime/primordials";
import { getNativeDate } from "../time/native-date";

import { createGeoCache } from "./cache";
import { createGeoErrorFactory } from "./geolocation-error-factory";
import {
  createGeoPermissionState,
  type GeoPermissionState,
  type GeoPermissionPatchState,
  installGeoPermPatch,
} from "./geolocation-permissions";
import { createGeoPositionFactory } from "./geolocation-position-factory";
import { createGeoTimestamp, validateGeoReceiver } from "./geolocation-runtime-helpers";
import { getGeoAcquisitionTiming } from "./geolocation-timeout";
import { createGeoWatchController } from "./geolocation-watch-controller";
import { convertPositionOptions } from "./position-options";
import { createSimpleGeoRuntime } from "./simple-runtime";

type BufferedGeoCall = {
  type: "getCurrentPosition" | "watchPosition";
  successCallback: PositionCallback;
  errorCallback?: PositionErrorCallback | null | undefined;
  options?: PositionOptions | undefined;
  watchId?: number | undefined;
};

type BufferedPermissionsCall = {
  resolve: (state: GeoPermissionState) => void;
};

type FxGeoBridgeOptions = {
  syncBootstrapState: () => void;
  targetGlobal?: typeof globalThis;
  permissionsPatchState?: GeoPermissionPatchState;
  markerKey?: string;
  logGeolocation: (method: string, args: unknown[], result?: unknown) => void;
  logPermissions: (method: string, args: unknown[], result?: unknown) => void;
};

type FirefoxGeolocationBridge = {
  install: () => void;
  isResolved: () => boolean;
  resolveGeoState: (detail: FirefoxGeoState | null) => void;
};

type ScheduleWatchInput = {
  watchId: number;
  successCallback: PositionCallback;
  options?: PositionOptions | undefined;
  errorCallback?: PositionErrorCallback | null | undefined;
};

const GEOLOCATION_METHOD_NAMES = [
  "getCurrentPosition",
  "watchPosition",
  "clearWatch",
] as const;

class FxGeoBridge implements FirefoxGeolocationBridge {
  private readonly targetGlobal: typeof globalThis;
  private readonly permissionsPatchState: GeoPermissionPatchState;
  private readonly markerKey: string | undefined;
  private readonly syncBootstrapState: () => void;
  private readonly logPermissions: FxGeoBridgeOptions["logPermissions"];
  private readonly nav: Navigator;
  private readonly NativeDate = getNativeDate();
  private readonly geoQueue: BufferedGeoCall[] = [];
  private readonly permissionsQueue: BufferedPermissionsCall[] = [];
  private readonly cancelledWatchIds = new Set<number>();
  private readonly createPositionValue: ReturnType<typeof createGeoPositionFactory>;
  private readonly createPositionError: ReturnType<typeof createGeoErrorFactory>;
  private readonly positionCache: ReturnType<typeof createGeoCache>;
  private readonly watchController: ReturnType<typeof createGeoWatchController>;
  private geoData: FirefoxGeoState | null = null;
  private dataReceived = false;
  private persistentRuntime: ReturnType<typeof createSimpleGeoRuntime> | null = null;
  private nextWatchId = 1;

  constructor(options: FxGeoBridgeOptions) {
    this.targetGlobal = options.targetGlobal ?? globalThis;
    this.permissionsPatchState =
      options.permissionsPatchState ?? createGeoPermissionState();
    this.markerKey = options.markerKey;
    this.syncBootstrapState = options.syncBootstrapState;
    this.logPermissions = options.logPermissions;
    this.nav = this.targetGlobal.navigator;
    this.createPositionValue = createGeoPositionFactory(this.targetGlobal);
    this.createPositionError = createGeoErrorFactory(this.targetGlobal);
    this.positionCache = createGeoCache({
      createPosition: this.createPosition,
      getNextWatchDelay: this.getNextWatchDelay,
      now: () => this.NativeDate.now(),
      onCacheHit: (details): void => {
        options.logGeolocation("cache [hit]", [details.options], details);
      },
      onCacheRefresh: (details): void => {
        options.logGeolocation("cache [refresh]", [details.options], details);
      },
      shouldUseCachedPosition: (timestamp, expiresAt, positionOptions): boolean =>
        this.getGeoRuntime()?.shouldUseCachedPosition(
          timestamp,
          expiresAt,
          positionOptions,
        ) ?? false,
    });
    this.watchController = createGeoWatchController({
      getCallbackDelay: this.getCallbackDelay,
      getCachedPosition: (positionOptions) =>
        this.positionCache.getCachedPosition(positionOptions),
      getNextWatchDelay: this.getNextWatchDelay,
      getPosition: this.getReadyPosition,
      getWatchRefreshDelay: (minimumDelayMs = 0) =>
        this.positionCache.getWatchRefreshDelay(minimumDelayMs),
      isWatchActive: (watchId) =>
        this.geoData !== null && !this.cancelledWatchIds.has(watchId),
      refreshPosition: (positionOptions) =>
        this.positionCache.refreshPosition(positionOptions),
      reportTimeout: this.reportTimeout,
      targetGlobal: this.targetGlobal,
    });
  }

  private reportTimeout = (callback?: PositionErrorCallback | null): void => {
    callback?.(this.createPositionError(3, "Timeout expired"));
  };

  private createUnavailableError = (): GeolocationPositionError =>
    this.createPositionError(2, "Position unavailable");

  private getGeoRuntime = () => {
    if (!this.geoData) return null;
    if (this.persistentRuntime) return this.persistentRuntime;

    this.persistentRuntime = createSimpleGeoRuntime(
      {
        latitude: this.geoData.latitude,
        longitude: this.geoData.longitude,
        accuracy: this.geoData.accuracy,
        noiseRadius: this.geoData.noiseRadius ?? 50,
      },
      this.geoData.watchPositionDelay ?? [60, 500],
    );
    return this.persistentRuntime;
  };

  private getNextWatchDelay = (): number =>
    this.getGeoRuntime()?.getNextWatchDelay() ?? 60_000;

  private getCallbackDelay = (): number =>
    this.getGeoRuntime()?.getCallbackDelay() ?? 10 + privateCryptoRandomUnit() * 40;

  private createPosition = (): GeolocationPosition => {
    if (!this.geoData) {
      throw new Error("Geolocation cache requested before geoData was ready");
    }
    const runtime = this.getGeoRuntime();
    if (!runtime) {
      return this.createPositionValue(
        {
          latitude: this.geoData.latitude,
          longitude: this.geoData.longitude,
          accuracy: this.geoData.accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        this.NativeDate.now(),
      );
    }

    const { latitude, longitude } = runtime.randomizeCoords();
    return this.createPositionValue(
      {
        latitude,
        longitude,
        accuracy: runtime.walkAccuracy(),
        ...runtime.getNullableCoords(),
      },
      createGeoTimestamp(this.NativeDate.now(), runtime.getMeasurementDelay()),
    );
  };

  private getPosition = (
    positionOptions?: PositionOptions,
  ): GeolocationPosition | null =>
    this.geoData ? this.positionCache.getPosition(positionOptions) : null;

  private getReadyPosition = (
    positionOptions?: PositionOptions,
  ): GeolocationPosition => {
    const position = this.getPosition(positionOptions);
    if (!position) {
      throw new Error("Geolocation watch requested before a position was ready");
    }
    return position;
  };

  private scheduleWatch = ({
    watchId,
    successCallback,
    options,
    errorCallback,
  }: ScheduleWatchInput): void => {
    if (!this.geoData || this.cancelledWatchIds.has(watchId)) return;
    this.watchController.scheduleWatch({
      watchId,
      successCallback,
      positionOptions: options,
      initialRefreshDelayMs: this.positionCache.getWatchRefreshDelay(1000),
      errorCallback,
    });
  };

  private scheduleCurrentPosition = (
    successCallback: PositionCallback,
    errorCallback?: PositionErrorCallback | null,
    positionOptions?: PositionOptions,
  ): void => {
    const cachedPosition = this.positionCache.getCachedPosition(positionOptions);
    if (cachedPosition) {
      this.targetGlobal.setTimeout(() => successCallback(cachedPosition), 0);
      return;
    }

    const timing = getGeoAcquisitionTiming(this.getCallbackDelay(), positionOptions);
    this.targetGlobal.setTimeout(() => {
      if (timing.timedOut) {
        this.reportTimeout(errorCallback);
        return;
      }
      const position = this.getPosition(positionOptions);
      if (!position) {
        errorCallback?.(this.createUnavailableError());
        return;
      }
      successCallback(position);
    }, timing.delayMs);
  };

  private flushGeoQueue = (): void => {
    for (const entry of this.geoQueue.splice(0)) {
      if (
        entry.type === "watchPosition" &&
        entry.watchId !== undefined &&
        this.cancelledWatchIds.has(entry.watchId)
      ) {
        continue;
      }
      if (!this.geoData) {
        entry.errorCallback?.(this.createUnavailableError());
        continue;
      }
      if (entry.type === "getCurrentPosition") {
        this.scheduleCurrentPosition(
          entry.successCallback,
          entry.errorCallback,
          entry.options,
        );
      } else if (entry.watchId !== undefined) {
        this.scheduleWatch({
          watchId: entry.watchId,
          successCallback: entry.successCallback,
          errorCallback: entry.errorCallback,
          options: entry.options,
        });
      }
    }
  };

  private flushPermissionsQueue = (): void => {
    const state = this.geoData ? "granted" : "denied";
    for (const entry of this.permissionsQueue) entry.resolve(state);
    this.permissionsQueue.length = 0;
  };

  resolveGeoState = (detail: FirefoxGeoState | null): void => {
    if (this.dataReceived) return;
    this.dataReceived = true;
    this.geoData = detail;
    this.persistentRuntime = null;
    this.positionCache.clear();
    this.flushGeoQueue();
    this.flushPermissionsQueue();
  };

  isResolved = (): boolean => this.dataReceived;

  private createPatchedMethods = (
    nativeGeolocation: Geolocation,
  ): Pick<Geolocation, "clearWatch" | "getCurrentPosition" | "watchPosition"> => {
    const bridge = this;
    return {
      getCurrentPosition: maskAsNative(
        {
          getCurrentPosition(
            this: unknown,
            successCallback: PositionCallback,
            errorCallback?: PositionErrorCallback | null,
            options?: PositionOptions,
          ): void {
            validateGeoReceiver(this, nativeGeolocation);
            const positionOptions = convertPositionOptions(options);
            bridge.syncBootstrapState();
            if (bridge.dataReceived && bridge.geoData) {
              bridge.scheduleCurrentPosition(
                successCallback,
                errorCallback,
                positionOptions,
              );
            } else if (bridge.dataReceived) {
              errorCallback?.(bridge.createUnavailableError());
            } else {
              bridge.geoQueue.push({
                type: "getCurrentPosition",
                successCallback,
                errorCallback,
                options: positionOptions,
              });
            }
          },
        }.getCurrentPosition,
        createNativeSource("getCurrentPosition"),
        1,
      ),
      watchPosition: maskAsNative(
        {
          watchPosition(
            this: unknown,
            successCallback: PositionCallback,
            errorCallback?: PositionErrorCallback | null,
            options?: PositionOptions,
          ): number {
            validateGeoReceiver(this, nativeGeolocation);
            const positionOptions = convertPositionOptions(options);
            bridge.syncBootstrapState();
            const watchId = bridge.nextWatchId++;
            if (bridge.dataReceived && bridge.geoData) {
              bridge.scheduleWatch({
                watchId,
                successCallback,
                errorCallback,
                options: positionOptions,
              });
            } else if (bridge.dataReceived) {
              errorCallback?.(bridge.createUnavailableError());
            } else {
              bridge.geoQueue.push({
                type: "watchPosition",
                successCallback,
                errorCallback,
                options: positionOptions,
                watchId,
              });
            }
            return watchId;
          },
        }.watchPosition,
        createNativeSource("watchPosition"),
        1,
      ),
      clearWatch: maskAsNative(
        {
          clearWatch(this: unknown, watchId: number): void {
            validateGeoReceiver(this, nativeGeolocation);
            bridge.cancelledWatchIds.add(watchId);
            bridge.watchController.clearWatch(watchId);
          },
        }.clearWatch,
        createNativeSource("clearWatch"),
        1,
      ),
    };
  };

  private installGeolocation = (): void => {
    if (!("geolocation" in this.nav)) return;
    const nativeGeolocation = this.nav.geolocation;
    const geolocationTarget =
      typeof this.targetGlobal.Geolocation !== "undefined"
        ? this.targetGlobal.Geolocation.prototype
        : nativeGeolocation;
    let alreadyInstalled = false;
    if (this.markerKey) {
      const anchorState = inspectPatchAnchors(
        this.markerKey,
        GEOLOCATION_METHOD_NAMES.map((name) => ({
          fn: geolocationTarget[name],
          name,
        })),
      );
      alreadyInstalled = anchorState === "installed";
      if (anchorState === "conflict") throw new Error();
    }
    if (alreadyInstalled) return;

    const patchedMethods = this.createPatchedMethods(nativeGeolocation);
    const descriptors: PropertyDescriptorMap = {};
    for (const name of GEOLOCATION_METHOD_NAMES) {
      if (this.markerKey) {
        markPatchAnchor(patchedMethods[name], this.markerKey, name);
      }
      descriptors[name] = { configurable: true, value: patchedMethods[name] };
    }
    Object.defineProperties(geolocationTarget, descriptors);
    if (geolocationTarget !== nativeGeolocation) {
      Object.defineProperties(nativeGeolocation, descriptors);
    }
  };

  private installPermissions = (): void => {
    if (!("permissions" in this.nav)) return;
    const queryTarget =
      typeof this.targetGlobal.Permissions !== "undefined"
        ? this.targetGlobal.Permissions.prototype
        : this.nav.permissions;
    installGeoPermPatch({
      logger: this.logPermissions,
      patchState: this.permissionsPatchState,
      permissionPrototype:
        typeof PermissionStatus === "undefined" ? null : PermissionStatus.prototype,
      queryTarget,
      resolveGeolocationState: () => {
        this.syncBootstrapState();
        if (this.dataReceived) return this.geoData ? "granted" : "denied";
        return new Promise<GeoPermissionState>((resolve) => {
          this.permissionsQueue.push({ resolve });
        });
      },
    });
  };

  install = (): void => {
    this.installGeolocation();
    this.installPermissions();
  };
}

export const createFxGeoBridge = (
  options: FxGeoBridgeOptions,
): FirefoxGeolocationBridge => new FxGeoBridge(options);
