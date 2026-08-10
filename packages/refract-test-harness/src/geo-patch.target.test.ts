import { installGeolocationPatch } from "@privacy-brand/refract-core";
import type { RuntimeSnapshot } from "@privacy-brand/refract-core";
import {
  createGeoErrorFactory,
  installGeoErrorPrototype,
} from "@privacy-brand/refract-core/geolocation/geolocation-error-factory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const buildSnapshot = (): RuntimeSnapshot => ({
  geo: {
    latitude: 52.2297,
    longitude: 21.0122,
    accuracy: 25,
    noiseRadius: 50,
  },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl",
  },
  date: {
    baseEpochMs: Date.parse("2026-01-15T12:00:00.000Z"),
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [60, 500],
});

describe("installGeolocationPatch", () => {
  const buildTargetGlobal = (
    geolocation: Geolocation,
    visibilityState: DocumentVisibilityState = "visible",
  ): typeof globalThis =>
    ({
      navigator: { geolocation },
      setTimeout,
      clearTimeout,
      document: { visibilityState },
    }) as unknown as typeof globalThis;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.1234);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("emits integer geolocation timestamps in epoch milliseconds", () => {
    const geolocation = {} as Geolocation;
    const successCallback = vi.fn();

    installGeolocationPatch(
      buildSnapshot(),
      {
        navigator: { geolocation },
        setTimeout,
        clearTimeout,
      } as unknown as typeof globalThis,
      vi.fn(),
    );

    geolocation.getCurrentPosition(successCallback);
    vi.runAllTimers();

    const position = successCallback.mock.calls[0]?.[0] as
      GeolocationPosition | undefined;
    expect(position).toBeDefined();
    expect(Number.isInteger(position?.timestamp)).toBe(true);
  });

  it("leaves an ancestor-owned Geolocation prototype unchanged in a child realm", () => {
    class SharedGeolocation {}
    const nativeGetCurrentPosition = vi.fn();
    Object.defineProperty(SharedGeolocation.prototype, "getCurrentPosition", {
      configurable: true,
      writable: true,
      value: nativeGetCurrentPosition,
    });
    const parentGlobal = {
      Geolocation: SharedGeolocation,
      navigator: { geolocation: {} as Geolocation },
    } as unknown as typeof globalThis;
    const childGlobal = {
      Geolocation: SharedGeolocation,
      navigator: { geolocation: {} as Geolocation },
      parent: parentGlobal,
      setTimeout,
      clearTimeout,
    } as unknown as typeof globalThis;

    installGeolocationPatch(buildSnapshot(), childGlobal, vi.fn());

    expect(
      Object.getOwnPropertyDescriptor(SharedGeolocation.prototype, "getCurrentPosition")
        ?.value,
    ).toBe(nativeGetCurrentPosition);
  });

  it("serializes spoofed positions without invoking native internal-slot checks", () => {
    class MockGeolocationPosition {
      toJSON(): never {
        throw new TypeError("Illegal invocation");
      }
    }
    class MockGeoCoords {
      toJSON(): never {
        throw new TypeError("Illegal invocation");
      }
    }
    const geolocation = {} as Geolocation;
    const successCallback = vi.fn();
    const targetGlobal = {
      navigator: { geolocation },
      GeolocationPosition: MockGeolocationPosition,
      GeolocationCoordinates: MockGeoCoords,
      setTimeout,
      clearTimeout,
    } as unknown as typeof globalThis;

    installGeolocationPatch(buildSnapshot(), targetGlobal, vi.fn());
    geolocation.getCurrentPosition(successCallback);
    vi.runOnlyPendingTimers();

    const position = successCallback.mock.calls[0]?.[0] as GeolocationPosition;
    expect(position).toBeInstanceOf(MockGeolocationPosition);
    expect(position.coords).toBeInstanceOf(MockGeoCoords);
    expect(position.coords.toJSON()).toEqual({
      accuracy: position.coords.accuracy,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    });
    expect(position.toJSON()).toEqual({
      timestamp: position.timestamp,
      coords: position.coords.toJSON(),
    });
    expect(JSON.parse(JSON.stringify(position))).toEqual(position.toJSON());
    expect(position.toJSON.toString()).toContain("[native code]");
  });

  it("reports TIMEOUT asynchronously instead of delivering a late current position", () => {
    const geolocation = {} as Geolocation;
    const successCallback = vi.fn();
    const errorCallback = vi.fn();

    installGeolocationPatch(buildSnapshot(), buildTargetGlobal(geolocation), vi.fn());
    geolocation.getCurrentPosition(successCallback, errorCallback, { timeout: 0 });

    expect(errorCallback).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();

    expect(successCallback).not.toHaveBeenCalled();
    expect(errorCallback).toHaveBeenCalledTimes(1);
    expect((errorCallback.mock.calls[0]?.[0] as GeolocationPositionError).code).toBe(3);
  });

  it("returns a fresh cached position before applying timeout", () => {
    const geolocation = {} as Geolocation;
    const firstSuccess = vi.fn();
    const cachedSuccess = vi.fn();
    const errorCallback = vi.fn();

    installGeolocationPatch(buildSnapshot(), buildTargetGlobal(geolocation), vi.fn());
    geolocation.getCurrentPosition(firstSuccess, errorCallback, {
      maximumAge: 60_000,
      timeout: 10_000,
    });
    vi.runOnlyPendingTimers();

    geolocation.getCurrentPosition(cachedSuccess, errorCallback, {
      maximumAge: 60_000,
      timeout: 0,
    });
    vi.runOnlyPendingTimers();

    expect(cachedSuccess).toHaveBeenCalledWith(firstSuccess.mock.calls[0]?.[0]);
    expect(errorCallback).not.toHaveBeenCalled();
  });

  it("converts every PositionOptions member in WebIDL order before a cache hit", () => {
    const geolocation = {} as Geolocation;
    const firstSuccess = vi.fn();
    const cachedSuccess = vi.fn();
    const reads: string[] = [];
    const options = Object.defineProperties(
      {},
      {
        enableHighAccuracy: { get: () => (reads.push("enableHighAccuracy"), false) },
        maximumAge: { get: () => (reads.push("maximumAge"), 60_000) },
        timeout: { get: () => (reads.push("timeout"), 0) },
      },
    ) as PositionOptions;

    installGeolocationPatch(buildSnapshot(), buildTargetGlobal(geolocation), vi.fn());
    geolocation.getCurrentPosition(firstSuccess, undefined, { timeout: 10_000 });
    vi.runOnlyPendingTimers();
    geolocation.getCurrentPosition(cachedSuccess, undefined, options);

    expect(reads).toEqual(["enableHighAccuracy", "maximumAge", "timeout"]);
    vi.runOnlyPendingTimers();
    expect(cachedSuccess).toHaveBeenCalledWith(firstSuccess.mock.calls[0]?.[0]);
  });

  it("returns a fresh cached position to watchPosition before applying timeout", () => {
    const geolocation = {} as Geolocation;
    const firstSuccess = vi.fn();
    const watchSuccess = vi.fn();
    const errorCallback = vi.fn();

    installGeolocationPatch(buildSnapshot(), buildTargetGlobal(geolocation), vi.fn());
    geolocation.getCurrentPosition(firstSuccess, errorCallback, { timeout: 10_000 });
    vi.runOnlyPendingTimers();
    const watchId = geolocation.watchPosition(watchSuccess, errorCallback, {
      maximumAge: 60_000,
      timeout: 0,
    });
    vi.runOnlyPendingTimers();

    expect(watchSuccess).toHaveBeenCalledWith(firstSuccess.mock.calls[0]?.[0]);
    expect(errorCallback).not.toHaveBeenCalled();
    geolocation.clearWatch(watchId);
  });

  it("shares branded TIMEOUT values with a separately patched same-origin realm", () => {
    const slots = new WeakMap<object, { code: number; message: string }>();
    const readCode = function (this: object): number {
      const slot = slots.get(this);
      if (!slot) throw new TypeError("Illegal invocation");
      return slot.code;
    };
    const readMessage = function (this: object): string {
      const slot = slots.get(this);
      if (!slot) throw new TypeError("Illegal invocation");
      return slot.message;
    };
    const ParentGeoError = class GeolocationPositionError {};
    const ChildGeoError = class GeolocationPositionError {};
    for (const prototype of [ParentGeoError.prototype, ChildGeoError.prototype]) {
      Object.defineProperty(prototype, "code", {
        configurable: true,
        enumerable: true,
        get: readCode,
      });
      Object.defineProperty(prototype, "message", {
        configurable: true,
        enumerable: true,
        get: readMessage,
      });
    }

    const parentGlobal = {
      GeolocationPositionError: ParentGeoError,
    } as unknown as typeof globalThis;
    const childGlobal = {
      GeolocationPositionError: ChildGeoError,
    } as unknown as typeof globalThis;
    const originalCodeDescriptor = Object.getOwnPropertyDescriptor(
      ParentGeoError.prototype,
      "code",
    );
    const nativeMessageDesc = Object.getOwnPropertyDescriptor(
      ParentGeoError.prototype,
      "message",
    );
    const createError = createGeoErrorFactory(parentGlobal);
    installGeoErrorPrototype(childGlobal);
    const error = createError(3, "Timeout expired");
    const childGetter = Object.getOwnPropertyDescriptor(
      ChildGeoError.prototype,
      "code",
    )?.get;

    expect(error).toBeInstanceOf(ParentGeoError);
    expect(error.code).toBe(3);
    expect(childGetter?.call(error)).toBe(3);
    expect(childGetter?.toString()).toContain("[native code]");
    expect(Object.hasOwn(error, "code")).toBe(false);
    expect(Object.hasOwn(error, "message")).toBe(false);
    expect(Reflect.ownKeys(error)).toEqual([]);
    expect(Object.getOwnPropertyDescriptor(error, "code")).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(error, "message")).toBeUndefined();
    expect(
      Object.getOwnPropertyDescriptor(ParentGeoError.prototype, "code"),
    ).toMatchObject({
      configurable: originalCodeDescriptor?.configurable,
      enumerable: originalCodeDescriptor?.enumerable,
    });
    expect(
      Object.getOwnPropertyDescriptor(ParentGeoError.prototype, "message"),
    ).toMatchObject({
      configurable: nativeMessageDesc?.configurable,
      enumerable: nativeMessageDesc?.enumerable,
    });
  });

  it("does not expose synthetic errors through borrowed DOMException getters", () => {
    class NativePositionError {}
    Object.defineProperties(NativePositionError.prototype, {
      code: {
        configurable: true,
        enumerable: true,
        get() {
          throw new TypeError("Illegal invocation");
        },
      },
      message: {
        configurable: true,
        enumerable: true,
        get() {
          throw new TypeError("Illegal invocation");
        },
      },
    });
    const targetGlobal = {
      GeolocationPositionError: NativePositionError,
    } as unknown as typeof globalThis;
    const error = createGeoErrorFactory(targetGlobal)(3, "Timeout expired");
    const domExceptionNameGetter = Object.getOwnPropertyDescriptor(
      DOMException.prototype,
      "name",
    )?.get;
    const domExceptionMessage = Object.getOwnPropertyDescriptor(
      DOMException.prototype,
      "message",
    )?.get;

    expect(error.code).toBe(3);
    expect(error.message).toBe("Timeout expired");
    expect(() => domExceptionNameGetter?.call(error)).toThrow(TypeError);
    expect(() => domExceptionMessage?.call(error)).toThrow(TypeError);
  });

  it("shares branded TIMEOUT values across isolated same-origin bundles", async () => {
    const createNativeErrorClass = () => {
      const slots = new WeakMap<object, { code: number; message: string }>();
      class NativePositionError {}
      Object.defineProperties(NativePositionError.prototype, {
        code: {
          configurable: true,
          enumerable: true,
          get(this: object) {
            const slot = slots.get(this);
            if (!slot) throw new TypeError("Illegal invocation");
            return slot.code;
          },
        },
        message: {
          configurable: true,
          enumerable: true,
          get(this: object) {
            const slot = slots.get(this);
            if (!slot) throw new TypeError("Illegal invocation");
            return slot.message;
          },
        },
      });
      return NativePositionError;
    };

    vi.resetModules();
    const parentModule =
      await import("@privacy-brand/refract-core/geolocation/geolocation-error-factory");
    const ParentGeoError = createNativeErrorClass();
    const parentGlobal = {
      GeolocationPositionError: ParentGeoError,
    } as unknown as typeof globalThis;
    const error = parentModule.createGeoErrorFactory(parentGlobal)(
      3,
      "Timeout expired",
    );
    const originalParentGetter = Object.getOwnPropertyDescriptor(
      ParentGeoError.prototype,
      "code",
    )?.get;
    const nativeParentMessage = Object.getOwnPropertyDescriptor(
      ParentGeoError.prototype,
      "message",
    )?.get;
    const ChildGeoError = createNativeErrorClass();
    const childGlobal = {
      GeolocationPositionError: ChildGeoError,
      parent: parentGlobal,
      top: parentGlobal,
    } as unknown as typeof globalThis;
    parentModule.installGeoErrorPrototype(childGlobal, parentGlobal);

    vi.resetModules();
    const childModule =
      await import("@privacy-brand/refract-core/geolocation/geolocation-error-factory");
    childModule.installGeoErrorPrototype(childGlobal, parentGlobal);
    const childGetter = Object.getOwnPropertyDescriptor(
      ChildGeoError.prototype,
      "code",
    )?.get;
    const childMessageGetter = Object.getOwnPropertyDescriptor(
      ChildGeoError.prototype,
      "message",
    )?.get;
    const childError = childModule.createGeoErrorFactory(childGlobal)(
      2,
      "Position unavailable",
    );
    const parentGetter = Object.getOwnPropertyDescriptor(
      ParentGeoError.prototype,
      "code",
    )?.get;
    const parentMessageGetter = Object.getOwnPropertyDescriptor(
      ParentGeoError.prototype,
      "message",
    )?.get;

    expect(childGetter?.call(error)).toBe(3);
    expect(childMessageGetter?.call(error)).toBe("Timeout expired");
    expect(parentGetter).toBe(originalParentGetter);
    expect(parentMessageGetter).toBe(nativeParentMessage);
    expect(childError.code).toBe(2);
    expect(childError.message).toBe("Position unavailable");
    expect(Reflect.ownKeys(error)).toEqual([]);
    expect(Reflect.ownKeys(childError)).toEqual([]);
    expect(() =>
      childGetter?.call(new DOMException("Timeout expired", "TimeoutError")),
    ).toThrow(TypeError);
  });

  it("does not invoke proxy traps after a native getter rejects a forged receiver", () => {
    const slots = new WeakMap<object, { code: number; message: string }>();
    class NativePositionError {}
    Object.defineProperty(NativePositionError.prototype, "code", {
      configurable: true,
      enumerable: true,
      get(this: object) {
        const slot = slots.get(this);
        if (!slot) throw new TypeError("Illegal invocation");
        return slot.code;
      },
    });
    Object.defineProperty(NativePositionError.prototype, "message", {
      configurable: true,
      enumerable: true,
      get(this: object) {
        const slot = slots.get(this);
        if (!slot) throw new TypeError("Illegal invocation");
        return slot.message;
      },
    });
    const targetGlobal = {
      GeolocationPositionError: NativePositionError,
    } as unknown as typeof globalThis;
    installGeoErrorPrototype(targetGlobal);
    const getter = Object.getOwnPropertyDescriptor(
      NativePositionError.prototype,
      "code",
    )?.get;
    let getCalls = 0;
    let prototypeCalls = 0;
    const receiver = new Proxy(
      {},
      {
        getPrototypeOf(target) {
          prototypeCalls += 1;
          return Reflect.getPrototypeOf(target);
        },
        get(target, property, proxyReceiver) {
          getCalls += 1;
          return Reflect.get(target, property, proxyReceiver);
        },
      },
    );

    expect(() => getter?.call(receiver)).toThrow(TypeError);
    expect(getCalls).toBe(0);
    expect(prototypeCalls).toBe(0);
  });
  it("rejects BigInt PositionOptions members like WebIDL ToNumber", () => {
    const geolocation = {} as Geolocation;
    installGeolocationPatch(buildSnapshot(), buildTargetGlobal(geolocation), vi.fn());

    expect(() =>
      geolocation.getCurrentPosition(vi.fn(), undefined, {
        maximumAge: 1n,
      } as unknown as PositionOptions),
    ).toThrow(TypeError);
    expect(() =>
      geolocation.watchPosition(vi.fn(), undefined, {
        timeout: 1n,
      } as unknown as PositionOptions),
    ).toThrow(TypeError);
  });

  it("delivers a current position once when acquisition wins the timeout race", () => {
    const geolocation = {} as Geolocation;
    const successCallback = vi.fn();
    const errorCallback = vi.fn();

    installGeolocationPatch(buildSnapshot(), buildTargetGlobal(geolocation), vi.fn());
    geolocation.getCurrentPosition(successCallback, errorCallback, { timeout: 10_000 });
    vi.runOnlyPendingTimers();
    vi.advanceTimersByTime(10_000);

    expect(successCallback).toHaveBeenCalledTimes(1);
    expect(errorCallback).not.toHaveBeenCalled();
  });

  it("silently times out when getCurrentPosition has no error callback", () => {
    const geolocation = {} as Geolocation;
    const successCallback = vi.fn();

    installGeolocationPatch(buildSnapshot(), buildTargetGlobal(geolocation), vi.fn());
    geolocation.getCurrentPosition(successCallback, undefined, { timeout: 0 });
    expect(() => vi.runOnlyPendingTimers()).not.toThrow();
    expect(successCallback).not.toHaveBeenCalled();
  });

  it("does not patch geolocation when spoofing is disabled in the runtime snapshot", () => {
    const geolocation = {} as Geolocation;

    const installed = installGeolocationPatch(
      {
        ...buildSnapshot(),
        geolocationEnabled: false,
      },
      buildTargetGlobal(geolocation),
      vi.fn(),
    );

    expect("getCurrentPosition" in geolocation).toBe(false);
    expect("watchPosition" in geolocation).toBe(false);
    expect("clearWatch" in geolocation).toBe(false);
    expect(installed).toBe(false);
  });

  it("reuses one realm controller and repairs deleted configurable methods", () => {
    const geolocation = {} as Geolocation;
    const targetGlobal = buildTargetGlobal(geolocation);
    const options = { markerKey: "test:geolocation" };

    installGeolocationPatch(buildSnapshot(), targetGlobal, vi.fn(), options);
    const installedMethods = {
      clearWatch: geolocation.clearWatch,
      getCurrentPosition: geolocation.getCurrentPosition,
      watchPosition: geolocation.watchPosition,
    };

    installGeolocationPatch(buildSnapshot(), targetGlobal, vi.fn(), options);
    expect(geolocation.clearWatch).toBe(installedMethods.clearWatch);
    expect(geolocation.getCurrentPosition).toBe(installedMethods.getCurrentPosition);
    expect(geolocation.watchPosition).toBe(installedMethods.watchPosition);

    expect(Reflect.deleteProperty(geolocation, "getCurrentPosition")).toBe(true);
    installGeolocationPatch(buildSnapshot(), targetGlobal, vi.fn(), options);
    expect(geolocation.getCurrentPosition).toBe(installedMethods.getCurrentPosition);
  });

  it("keeps watch controllers isolated between target realms", () => {
    const parentGeolocation = {} as Geolocation;
    const childGeolocation = {} as Geolocation;
    installGeolocationPatch(
      buildSnapshot(),
      buildTargetGlobal(parentGeolocation),
      vi.fn(),
    );
    installGeolocationPatch(
      buildSnapshot(),
      buildTargetGlobal(childGeolocation),
      vi.fn(),
    );

    let parentWatchId = 0;
    const parentSuccess = vi.fn(() => parentGeolocation.clearWatch(parentWatchId));
    const childSuccess = vi.fn();
    parentWatchId = parentGeolocation.watchPosition(parentSuccess);
    const childWatchId = childGeolocation.watchPosition(childSuccess);

    expect(childWatchId).toBe(parentWatchId);
    childGeolocation.clearWatch(parentWatchId);
    vi.runOnlyPendingTimers();

    expect(parentSuccess).toHaveBeenCalledTimes(1);
    expect(childSuccess).not.toHaveBeenCalled();
  });

  it("rejects an unrecoverable non-configurable replacement", () => {
    const geolocation = {} as Geolocation;
    const targetGlobal = buildTargetGlobal(geolocation);

    installGeolocationPatch(buildSnapshot(), targetGlobal, vi.fn());
    Object.defineProperty(geolocation, "watchPosition", {
      configurable: false,
      value: vi.fn(),
    });

    expect(() =>
      installGeolocationPatch(buildSnapshot(), targetGlobal, vi.fn()),
    ).toThrow(TypeError);
  });

  it("preserves native illegal-invocation behavior for detached methods", () => {
    const geolocation = {} as Geolocation;
    const logger = vi.fn();

    installGeolocationPatch(buildSnapshot(), buildTargetGlobal(geolocation), logger);

    const detachedGetPosition = geolocation.getCurrentPosition;
    const detachedWatchPosition = geolocation.watchPosition;
    const detachedClearWatch = geolocation.clearWatch;

    expect(() => detachedGetPosition(vi.fn())).toThrowError(
      new TypeError("Illegal invocation"),
    );
    expect(() => detachedWatchPosition(vi.fn())).toThrowError(
      new TypeError("Illegal invocation"),
    );
    expect(() => detachedClearWatch(1)).toThrowError(
      new TypeError("Illegal invocation"),
    );
    expect(logger).toHaveBeenNthCalledWith(
      1,
      "getCurrentPosition [illegal-invocation]",
      [undefined],
      { receiverType: "undefined" },
    );
    expect(logger).toHaveBeenNthCalledWith(
      2,
      "watchPosition [illegal-invocation]",
      [undefined],
      { receiverType: "undefined" },
    );
    expect(logger).toHaveBeenNthCalledWith(3, "clearWatch [illegal-invocation]", [1], {
      receiverType: "undefined",
    });
  });

  it("does not emit watch updates while the document stays hidden", () => {
    const geolocation = {} as Geolocation;
    const targetDocument = { visibilityState: "visible" as DocumentVisibilityState };
    const successCallback = vi.fn();

    installGeolocationPatch(
      buildSnapshot(),
      {
        navigator: { geolocation },
        setTimeout,
        clearTimeout,
        document: targetDocument,
      } as unknown as typeof globalThis,
      vi.fn(),
    );

    const watchId = geolocation.watchPosition(successCallback);
    vi.advanceTimersByTime(1_000);
    expect(successCallback).toHaveBeenCalledTimes(1);

    targetDocument.visibilityState = "hidden";
    vi.advanceTimersByTime(5_000);
    expect(successCallback).toHaveBeenCalledTimes(1);

    geolocation.clearWatch(watchId);
  });

  it("does not emit the initial watch callback after immediate clearWatch", () => {
    const geolocation = {} as Geolocation;
    const successCallback = vi.fn();

    installGeolocationPatch(buildSnapshot(), buildTargetGlobal(geolocation), vi.fn());

    const watchId = geolocation.watchPosition(successCallback);
    geolocation.clearWatch(watchId);

    vi.advanceTimersByTime(1_000);

    expect(successCallback).not.toHaveBeenCalled();
  });

  it("does not reschedule when clearWatch runs inside the initial callback", () => {
    const geolocation = {} as Geolocation;
    let watchId = 0;
    const successCallback = vi.fn(() => geolocation.clearWatch(watchId));

    installGeolocationPatch(buildSnapshot(), buildTargetGlobal(geolocation), vi.fn());
    watchId = geolocation.watchPosition(successCallback);
    vi.advanceTimersByTime(10_000);

    expect(successCallback).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not reschedule when clearWatch runs inside a follow-up callback", () => {
    const geolocation = {} as Geolocation;
    let watchId = 0;
    const successCallback = vi.fn(() => {
      if (successCallback.mock.calls.length === 2) {
        geolocation.clearWatch(watchId);
      }
    });

    installGeolocationPatch(
      { ...buildSnapshot(), watchPositionDelay: [1, 1] },
      buildTargetGlobal(geolocation),
      vi.fn(),
    );
    watchId = geolocation.watchPosition(successCallback);
    vi.advanceTimersByTime(10_000);

    expect(successCallback).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("applies timeout to watch acquisitions and honors clearWatch from the error callback", () => {
    const geolocation = {} as Geolocation;
    const successCallback = vi.fn();
    let watchId = 0;
    const errorCallback = vi.fn((_error: GeolocationPositionError) =>
      geolocation.clearWatch(watchId),
    );

    installGeolocationPatch(buildSnapshot(), buildTargetGlobal(geolocation), vi.fn());
    watchId = geolocation.watchPosition(successCallback, errorCallback, { timeout: 0 });
    vi.runOnlyPendingTimers();
    vi.advanceTimersByTime(10_000);

    expect(successCallback).not.toHaveBeenCalled();
    expect(errorCallback).toHaveBeenCalledTimes(1);
    expect((errorCallback.mock.calls[0]?.[0] as GeolocationPositionError).code).toBe(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for cached-position expiry before the second watch update", () => {
    const geolocation = {} as Geolocation;
    const successCallback = vi.fn();

    installGeolocationPatch(
      {
        ...buildSnapshot(),
        watchPositionDelay: [1, 1],
      },
      buildTargetGlobal(geolocation),
      vi.fn(),
    );

    const watchId = geolocation.watchPosition(successCallback);

    vi.advanceTimersByTime(1_000);
    expect(successCallback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(250);
    expect(successCallback).toHaveBeenCalledTimes(2);
    expect(
      (successCallback.mock.calls[1]?.[0] as GeolocationPosition).timestamp,
    ).toBeGreaterThan(
      (successCallback.mock.calls[0]?.[0] as GeolocationPosition).timestamp,
    );

    geolocation.clearWatch(watchId);
  });

  it("emits debug logger events for cache reuse, cache refresh, and clearWatch", () => {
    const geolocation = {} as Geolocation;
    const targetDocument = { visibilityState: "visible" as DocumentVisibilityState };
    const logger = vi.fn();
    const successCallback = vi.fn();

    installGeolocationPatch(
      {
        ...buildSnapshot(),
        watchPositionDelay: [1, 1],
      },
      {
        navigator: { geolocation },
        setTimeout,
        clearTimeout,
        document: targetDocument,
      } as unknown as typeof globalThis,
      logger,
    );

    geolocation.getCurrentPosition(successCallback, undefined, { maximumAge: 5_000 });
    vi.runOnlyPendingTimers();
    geolocation.getCurrentPosition(successCallback, undefined, { maximumAge: 5_000 });
    vi.runOnlyPendingTimers();

    const watchId = geolocation.watchPosition(successCallback, undefined, {
      timeout: 100,
    });
    vi.advanceTimersByTime(1_000);
    targetDocument.visibilityState = "hidden";
    vi.advanceTimersByTime(250);
    geolocation.clearWatch(watchId);

    expect(logger.mock.calls.some(([method]) => method === "cache [refresh]")).toBe(
      true,
    );
    expect(logger.mock.calls.some(([method]) => method === "cache [hit]")).toBe(true);
    expect(logger).toHaveBeenCalledWith("clearWatch", [watchId]);
  });
});
