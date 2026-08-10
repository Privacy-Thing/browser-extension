import { maskAsNative, createNativeSource } from "../native/native-mask";
import { markPatchAnchor } from "../runtime/patch-marker";
import {
  createPrivateWeakMap,
  privateDefineProperties,
  privateOwnDescriptor,
  privateWeakMapGet,
  privateWeakMapSet,
} from "../runtime/primordials";
import { getNativeDate } from "../time/native-date";
import type { RuntimeSnapshot } from "../types/snapshot";

import { createGeoCache } from "./cache";
import { createGeoTimeoutReporter } from "./geolocation-error-factory";
import { createGeoPositionFactory } from "./geolocation-position-factory";
import { createGeoTimestamp, validateGeoReceiver } from "./geolocation-runtime-helpers";
import { getGeoAcquisitionTiming } from "./geolocation-timeout";
import { createGeoWatchController } from "./geolocation-watch-controller";
import { convertPositionOptions } from "./position-options";
import { createSimpleGeoRuntime } from "./simple-runtime";

export type GeolocationLogger = (
  event: string,
  details: unknown[],
  result?: unknown,
) => void;

export type GeolocationPatchOptions = {
  markerKey?: string;
};

type GeolocationPatchMethods = Pick<
  Geolocation,
  "clearWatch" | "getCurrentPosition" | "watchPosition"
>;

type GeolocationInstallation = {
  geolocationTarget: object;
  methods: GeolocationPatchMethods;
  nativeGeolocation: Geolocation;
};

type GeoMethodFactoryOptions = {
  snapshot: RuntimeSnapshot;
  targetGlobal: typeof globalThis;
  logger: GeolocationLogger;
  nativeGeolocation: Geolocation;
};

const installations = createPrivateWeakMap<object, GeolocationInstallation>();

const createMethodDescriptors = (
  methods: GeolocationPatchMethods,
): PropertyDescriptorMap => ({
  getCurrentPosition: { configurable: true, value: methods.getCurrentPosition },
  watchPosition: { configurable: true, value: methods.watchPosition },
  clearWatch: { configurable: true, value: methods.clearWatch },
});

const installationIsIntact = ({
  geolocationTarget,
  methods,
  nativeGeolocation,
}: GeolocationInstallation): boolean => {
  for (const property of [
    "getCurrentPosition",
    "watchPosition",
    "clearWatch",
  ] as const) {
    if (
      privateOwnDescriptor(geolocationTarget, property)?.value !== methods[property]
    ) {
      return false;
    }
    if (
      geolocationTarget !== nativeGeolocation &&
      privateOwnDescriptor(nativeGeolocation, property)?.value !== methods[property]
    ) {
      return false;
    }
  }
  return true;
};

const applyInstallation = (installation: GeolocationInstallation): void => {
  const descriptors = createMethodDescriptors(installation.methods);
  privateDefineProperties(installation.geolocationTarget, descriptors);
  if (installation.geolocationTarget !== installation.nativeGeolocation) {
    privateDefineProperties(installation.nativeGeolocation, descriptors);
  }
};

const restoreGeoInstall = (targetGlobal: object): boolean => {
  const existing = privateWeakMapGet(installations, targetGlobal);
  if (!existing) return false;
  if (!installationIsIntact(existing)) applyInstallation(existing);
  return true;
};

const usesParentGeoTarget = (
  targetGlobal: typeof globalThis,
  nativeGeolocation: Geolocation,
  geolocationTarget: object,
): boolean => {
  try {
    const parentGlobal = (
      targetGlobal as typeof globalThis & { parent?: typeof globalThis }
    ).parent;
    if (!parentGlobal || parentGlobal === targetGlobal) return false;
    const ParentGeoCtor = (
      parentGlobal as typeof globalThis & {
        Geolocation?: { prototype?: object };
      }
    ).Geolocation;
    const parentGeolocation = parentGlobal.navigator?.geolocation;
    const parentTarget = ParentGeoCtor?.prototype ?? parentGeolocation;
    return (
      parentGeolocation === nativeGeolocation || parentTarget === geolocationTarget
    );
  } catch {
    return false;
  }
};

class GeoMethodFactory {
  private readonly targetGlobal: typeof globalThis;
  private readonly logger: GeolocationLogger;
  private readonly nativeGeolocation: Geolocation;
  private readonly geoRuntime: ReturnType<typeof createSimpleGeoRuntime>;
  private readonly positionCache: ReturnType<typeof createGeoCache>;
  private readonly reportTimeout: ReturnType<typeof createGeoTimeoutReporter>;
  private readonly watchController: ReturnType<typeof createGeoWatchController>;
  private nextWatchId = 1;

  constructor({
    snapshot,
    targetGlobal,
    logger,
    nativeGeolocation,
  }: GeoMethodFactoryOptions) {
    this.targetGlobal = targetGlobal;
    this.logger = logger;
    this.nativeGeolocation = nativeGeolocation;
    const NativeDate = getNativeDate();
    const getRealNow = (): number => NativeDate.now();
    this.geoRuntime = createSimpleGeoRuntime(snapshot.geo, snapshot.watchPositionDelay);
    const createPositionValue = createGeoPositionFactory(targetGlobal);
    this.reportTimeout = createGeoTimeoutReporter(targetGlobal);
    this.positionCache = createGeoCache({
      createPosition: () => {
        const { latitude, longitude } = this.geoRuntime.randomizeCoords();
        return createPositionValue(
          {
            latitude,
            longitude,
            accuracy: this.geoRuntime.walkAccuracy(),
            ...this.geoRuntime.getNullableCoords(),
          },
          createGeoTimestamp(getRealNow(), this.geoRuntime.getMeasurementDelay()),
        );
      },
      getNextWatchDelay: () => this.geoRuntime.getNextWatchDelay(),
      now: () => Date.now(),
      onCacheHit: ({ expiresAt, options, timestamp }) => {
        logger("cache [hit]", [options], { expiresAt, timestamp });
      },
      onCacheRefresh: ({
        expiresAt,
        nextTimestamp,
        options,
        previousExpiresAt,
        previousTimestamp,
      }) => {
        logger("cache [refresh]", [options], {
          expiresAt,
          nextTimestamp,
          previousExpiresAt,
          previousTimestamp,
        });
      },
      shouldUseCachedPosition: (timestamp, expiresAt, options) =>
        this.geoRuntime.shouldUseCachedPosition(timestamp, expiresAt, options),
    });
    this.watchController = createGeoWatchController({
      getCallbackDelay: () => this.geoRuntime.getCallbackDelay(),
      getCachedPosition: (options) => this.positionCache.getCachedPosition(options),
      getNextWatchDelay: () => this.geoRuntime.getNextWatchDelay(),
      getPosition: (options) => this.positionCache.getPosition(options),
      getWatchRefreshDelay: (minimumDelayMs = 0) =>
        this.positionCache.getWatchRefreshDelay(minimumDelayMs),
      onPosition: (phase, position, options) => {
        logger(
          phase === "initial" ? "watchPosition (initial)" : "watchPosition (emit)",
          [options],
          position,
        );
      },
      refreshPosition: (options) => this.positionCache.refreshPosition(options),
      reportTimeout: this.reportTimeout,
      targetGlobal,
    });
  }

  private logIllegalInvocation = (
    method: string,
    receiver: unknown,
    args: unknown[],
  ): void => {
    if (receiver !== this.nativeGeolocation) {
      this.logger(`${method} [illegal-invocation]`, args, {
        receiverType: receiver === null ? "null" : typeof receiver,
      });
    }
  };

  private createCurrentPosition = (): Geolocation["getCurrentPosition"] => {
    const factory = this;
    return maskAsNative(
      {
        getCurrentPosition(
          this: unknown,
          successCallback: PositionCallback,
          errorCallback?: PositionErrorCallback | null,
          options?: PositionOptions,
        ): void {
          factory.logIllegalInvocation("getCurrentPosition", this, [options]);
          validateGeoReceiver(this, factory.nativeGeolocation);
          const positionOptions = convertPositionOptions(options);
          const cached = factory.positionCache.getCachedPosition(positionOptions);
          if (cached) {
            factory.targetGlobal.setTimeout(() => {
              factory.logger("getCurrentPosition", [options], cached);
              successCallback(cached);
            }, 0);
            return;
          }
          const timing = getGeoAcquisitionTiming(
            factory.geoRuntime.getCallbackDelay(),
            positionOptions,
          );
          factory.targetGlobal.setTimeout(() => {
            if (timing.timedOut) {
              factory.reportTimeout(errorCallback);
              return;
            }
            const position = factory.positionCache.getPosition(positionOptions);
            factory.logger("getCurrentPosition", [options], position);
            successCallback(position);
          }, timing.delayMs);
        },
      }.getCurrentPosition,
      createNativeSource("getCurrentPosition"),
      1,
    ) as Geolocation["getCurrentPosition"];
  };

  private createWatchPosition = (): Geolocation["watchPosition"] => {
    const factory = this;
    return maskAsNative(
      {
        watchPosition(
          this: unknown,
          successCallback: PositionCallback,
          errorCallback?: PositionErrorCallback | null,
          options?: PositionOptions,
        ): number {
          factory.logIllegalInvocation("watchPosition", this, [options]);
          validateGeoReceiver(this, factory.nativeGeolocation);
          const positionOptions = convertPositionOptions(options);
          const watchId = factory.nextWatchId++;
          factory.watchController.scheduleWatch({
            watchId,
            successCallback,
            positionOptions,
            errorCallback,
          });
          factory.logger("watchPosition (register)", [options], watchId);
          return watchId;
        },
      }.watchPosition,
      createNativeSource("watchPosition"),
      1,
    ) as Geolocation["watchPosition"];
  };

  private createClearWatch = (): Geolocation["clearWatch"] => {
    const factory = this;
    return maskAsNative(
      {
        clearWatch(this: unknown, watchId: number): void {
          factory.logIllegalInvocation("clearWatch", this, [watchId]);
          validateGeoReceiver(this, factory.nativeGeolocation);
          factory.watchController.clearWatch(watchId);
          factory.logger("clearWatch", [watchId]);
        },
      }.clearWatch,
      createNativeSource("clearWatch"),
    ) as Geolocation["clearWatch"];
  };

  createMethods = (): GeolocationPatchMethods => ({
    getCurrentPosition: this.createCurrentPosition(),
    watchPosition: this.createWatchPosition(),
    clearWatch: this.createClearWatch(),
  });
}

/**
 * Patches the geolocation API in the given global scope.
 */
export const installGeolocationPatch = (
  snapshot: RuntimeSnapshot,
  targetGlobal: typeof globalThis,
  logger: GeolocationLogger,
  options?: GeolocationPatchOptions,
): boolean => {
  if (snapshot.geolocationEnabled === false || !snapshot.geo) return false;
  const nav = targetGlobal.navigator;
  if (!nav || !("geolocation" in nav)) return false;

  const nativeGeolocation = nav.geolocation;
  const GeolocationConstructor = (targetGlobal as any).Geolocation;
  const geolocationTarget =
    typeof GeolocationConstructor !== "undefined"
      ? GeolocationConstructor.prototype
      : nativeGeolocation;
  if (restoreGeoInstall(targetGlobal)) return true;
  if (usesParentGeoTarget(targetGlobal, nativeGeolocation, geolocationTarget)) {
    return false;
  }

  const methods = new GeoMethodFactory({
    snapshot,
    targetGlobal,
    logger,
    nativeGeolocation,
  }).createMethods();
  if (options?.markerKey) {
    markPatchAnchor(
      methods.getCurrentPosition,
      options.markerKey,
      "getCurrentPosition",
    );
    markPatchAnchor(methods.watchPosition, options.markerKey, "watchPosition");
    markPatchAnchor(methods.clearWatch, options.markerKey, "clearWatch");
  }
  const installation: GeolocationInstallation = {
    geolocationTarget,
    methods,
    nativeGeolocation,
  };
  applyInstallation(installation);
  privateWeakMapSet(installations, targetGlobal, installation);
  return true;
};
