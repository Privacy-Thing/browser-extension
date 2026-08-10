import { createGeoPositionFactory } from "@privacy-brand/refract-core/geolocation/geolocation-position-factory";
import { getGeoAcquisitionTiming } from "@privacy-brand/refract-core/geolocation/geolocation-timeout";
import { createGeoWatchController } from "@privacy-brand/refract-core/geolocation/geolocation-watch-controller";
import { convertPositionOptions } from "@privacy-brand/refract-core/geolocation/position-options";
import { createSimpleGeoRuntime } from "@privacy-brand/refract-core/geolocation/simple-runtime";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";

import type { WorkerRuntimeSupport } from "./worker-runtime-support";

import type { RuntimeSnapshot } from "@/shared/types";

class WorkerGeoPatch {
  #cachedPosition: any = null;
  #cachedPositionExpires = 0;
  readonly #createPosition = createGeoPositionFactory(globalThis);
  readonly #errorPrototype = (globalThis as any).GeolocationPositionError?.prototype;
  readonly #errorValues = new WeakMap<object, { code: number; message: string }>();
  readonly #geoRuntime: ReturnType<typeof createSimpleGeoRuntime>;
  readonly #nativeGeolocation: Geolocation;
  #nextWatchId = 1;
  readonly #support: WorkerRuntimeSupport;
  readonly #target: object;
  readonly #watchController: ReturnType<typeof createGeoWatchController>;

  constructor(snapshot: RuntimeSnapshot, support: WorkerRuntimeSupport) {
    this.#support = support;
    this.#nativeGeolocation = globalThis.navigator.geolocation;
    const GeolocationConstructor = (globalThis as any).Geolocation;
    this.#target =
      typeof GeolocationConstructor !== "undefined"
        ? GeolocationConstructor.prototype
        : this.#nativeGeolocation;
    this.#geoRuntime = createSimpleGeoRuntime(
      snapshot.geo,
      snapshot.watchPositionDelay,
    );
    this.#watchController = createGeoWatchController({
      getCallbackDelay: () => this.#geoRuntime.getCallbackDelay(),
      getCachedPosition: (options: any) => this.#getCached(options),
      getNextWatchDelay: () => this.#geoRuntime.getNextWatchDelay(),
      getPosition: (options: any) => this.#getPosition(options),
      getWatchRefreshDelay: (minimumDelay = 0) => this.#getWatchDelay(minimumDelay),
      onPosition: (phase: string, position: any, options: any) => {
        this.#support.loggers.geolocation(
          phase === "initial" ? "watchPosition (initial)" : "watchPosition (emit)",
          [options],
          position,
        );
      },
      refreshPosition: () => this.#refreshPosition(),
      reportTimeout: (callback) => this.#reportTimeout(callback),
      targetGlobal: globalThis as any,
    });
  }

  install(): void {
    this.#patchErrorGetters();
    const descriptors = this.#createDescriptors();
    Object.defineProperties(this.#target, descriptors);
    if (this.#target !== this.#nativeGeolocation) {
      Object.defineProperties(this.#nativeGeolocation, descriptors);
    }
  }

  #patchErrorGetters(): void {
    if (!this.#errorPrototype) return;
    for (const property of ["code", "message"] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(
        this.#errorPrototype,
        property,
      );
      const nativeGetter = descriptor?.get;
      if (typeof nativeGetter !== "function" || descriptor?.configurable === false)
        continue;
      const patch = this;
      const getter = Object.getOwnPropertyDescriptor(
        {
          get [property]() {
            const values = patch.#errorValues.get(this);
            return values ? values[property] : Reflect.apply(nativeGetter, this, []);
          },
        },
        property,
      )?.get as () => number | string;
      Object.defineProperty(this.#errorPrototype, property, {
        ...descriptor,
        get: maskAsNative(
          getter,
          createNativeSource(property, "get"),
          nativeGetter.length,
        ),
      });
    }
  }

  #reportTimeout(callback?: PositionErrorCallback | null): void {
    if (!callback) return;
    const error = Object.create(this.#errorPrototype ?? Object.prototype);
    const values = { code: 3, message: "Timeout expired" };
    this.#errorValues.set(error, values);
    if (!this.#errorPrototype) Object.assign(error, values);
    callback(error);
  }

  #refreshPosition(): any {
    const { latitude, longitude } = this.#geoRuntime.randomizeCoords();
    const position = this.#createPosition(
      {
        latitude,
        longitude,
        accuracy: this.#geoRuntime.walkAccuracy(),
        ...this.#geoRuntime.getNullableCoords(),
      },
      Math.max(0, Math.round(Date.now() - this.#geoRuntime.getMeasurementDelay())),
    );
    this.#cachedPosition = position;
    this.#cachedPositionExpires = Date.now() + this.#geoRuntime.getNextWatchDelay();
    return position;
  }

  #getCached(options: any): any {
    if (
      this.#cachedPosition &&
      this.#geoRuntime.shouldUseCachedPosition(
        this.#cachedPosition.timestamp,
        this.#cachedPositionExpires,
        options,
      )
    ) {
      return this.#cachedPosition;
    }
    return null;
  }

  #getPosition(options: any): any {
    return this.#getCached(options) ?? this.#refreshPosition();
  }

  #getWatchDelay(minimumDelay = 0): number {
    const baseDelay =
      this.#cachedPosition !== null
        ? this.#cachedPositionExpires - Date.now()
        : this.#geoRuntime.getNextWatchDelay();
    return Math.max(minimumDelay, baseDelay);
  }

  #validateReceiver(receiver: any): void {
    if (receiver !== this.#nativeGeolocation) {
      throw new TypeError("Illegal invocation");
    }
  }

  #createDescriptors(): PropertyDescriptorMap {
    const patch = this;
    return {
      getCurrentPosition: {
        configurable: true,
        value: maskAsNative(
          {
            getCurrentPosition(this: any, success: any, error: any, options: any) {
              patch.#validateReceiver(this);
              patch.#scheduleCurrentPosition(success, error, options);
            },
          }.getCurrentPosition,
          createNativeSource("getCurrentPosition"),
          1,
        ),
      },
      watchPosition: {
        configurable: true,
        value: maskAsNative(
          {
            watchPosition(this: any, success: any, error: any, options: any) {
              patch.#validateReceiver(this);
              const convertedOptions = convertPositionOptions(options);
              const watchId = patch.#nextWatchId++;
              patch.#watchController.scheduleWatch({
                watchId,
                successCallback: success,
                positionOptions: convertedOptions,
                errorCallback: error,
              });
              patch.#support.loggers.geolocation(
                "watchPosition (register)",
                [options],
                watchId,
              );
              return watchId;
            },
          }.watchPosition,
          createNativeSource("watchPosition"),
          1,
        ),
      },
      clearWatch: {
        configurable: true,
        value: maskAsNative(
          {
            clearWatch(this: any, watchId: any) {
              patch.#validateReceiver(this);
              patch.#watchController.clearWatch(watchId);
            },
          }.clearWatch,
          createNativeSource("clearWatch"),
        ),
      },
    };
  }

  #scheduleCurrentPosition(success: any, error: any, options: any): void {
    const convertedOptions = convertPositionOptions(options);
    const cachedPosition = this.#getCached(convertedOptions);
    if (cachedPosition) {
      globalThis.setTimeout(() => {
        this.#support.loggers.geolocation(
          "getCurrentPosition",
          [options],
          cachedPosition,
        );
        success(cachedPosition);
      }, 0);
      return;
    }
    const timing = getGeoAcquisitionTiming(
      this.#geoRuntime.getCallbackDelay(),
      convertedOptions,
    );
    globalThis.setTimeout(() => {
      if (timing.timedOut) {
        this.#reportTimeout(error);
        return;
      }
      const position = this.#getPosition(convertedOptions);
      this.#support.loggers.geolocation("getCurrentPosition", [options], position);
      success(position);
    }, timing.delayMs);
  }
}

const registerGeo = (support: WorkerRuntimeSupport): void => {
  const geolocation = globalThis.navigator.geolocation;
  const prototype = (globalThis as any).Geolocation?.prototype as object | undefined;
  const targets =
    prototype && prototype !== geolocation ? [prototype, geolocation] : [geolocation];
  const methodIds = {
    clearWatch: "geolocation.clearWatch",
    getCurrentPosition: "geolocation.getCurrentPosition",
    watchPosition: "geolocation.watchPosition",
  } as const;
  for (const target of targets) {
    for (const key of Object.keys(methodIds) as Array<keyof typeof methodIds>) {
      support.register({
        target,
        key,
        surfaceId: "geolocation",
        methodId: methodIds[key],
        receiver: geolocation,
      });
    }
  }
};

export const installWorkerGeo = (
  snapshot: RuntimeSnapshot,
  support: WorkerRuntimeSupport,
): void => {
  if (snapshot.geolocationEnabled === false) return;
  const nav = globalThis.navigator;
  if (!nav || !("geolocation" in nav)) return;
  new WorkerGeoPatch(snapshot, support).install();
  registerGeo(support);
};
