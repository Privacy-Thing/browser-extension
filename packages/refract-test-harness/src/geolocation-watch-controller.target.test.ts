import { createGeoWatchController } from "@privacy-brand/refract-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reportTimeout = (): undefined => undefined;

describe("createGeoWatchController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("delivers the initial position before scheduling cache-aligned follow-up emits", () => {
    const targetDocument = { visibilityState: "visible" as DocumentVisibilityState };
    const firstPosition = { timestamp: 100 } as GeolocationPosition;
    const secondPosition = { timestamp: 200 } as GeolocationPosition;
    const successCallback = vi.fn();
    const onPosition = vi.fn();

    const controller = createGeoWatchController({
      getCallbackDelay: () => 25,
      getNextWatchDelay: () => 100,
      getPosition: () => firstPosition,
      getWatchRefreshDelay: () => 80,
      onPosition,
      refreshPosition: () => secondPosition,
      reportTimeout,
      targetGlobal: {
        clearTimeout,
        document: targetDocument,
        setTimeout,
      },
    });

    controller.scheduleWatch({
      watchId: 7,
      successCallback: successCallback,
    });

    vi.advanceTimersByTime(24);
    expect(successCallback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(successCallback).toHaveBeenCalledTimes(1);
    expect(successCallback).toHaveBeenLastCalledWith(firstPosition);
    expect(onPosition).toHaveBeenLastCalledWith("initial", firstPosition, undefined);

    vi.advanceTimersByTime(79);
    expect(successCallback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(successCallback).toHaveBeenCalledTimes(2);
    expect(successCallback).toHaveBeenLastCalledWith(secondPosition);
    expect(onPosition).toHaveBeenLastCalledWith("emit", secondPosition, undefined);
  });

  it("keeps the watch alive when the page success callback throws", () => {
    const targetDocument = { visibilityState: "visible" as DocumentVisibilityState };
    const firstPosition = { timestamp: 100 } as GeolocationPosition;
    const secondPosition = { timestamp: 200 } as GeolocationPosition;
    const successCallback = vi.fn(() => {
      throw new Error("page callback boom");
    });

    const controller = createGeoWatchController({
      getCallbackDelay: () => 25,
      getNextWatchDelay: () => 100,
      getPosition: () => firstPosition,
      getWatchRefreshDelay: () => 80,
      refreshPosition: () => secondPosition,
      reportTimeout,
      targetGlobal: {
        clearTimeout,
        document: targetDocument,
        setTimeout,
      },
    });

    controller.scheduleWatch({
      watchId: 3,
      successCallback: successCallback,
    });

    // A throwing initial callback must neither escape nor stop the follow-up.
    expect(() => vi.advanceTimersByTime(25)).not.toThrow();
    expect(successCallback).toHaveBeenCalledTimes(1);

    expect(() => vi.advanceTimersByTime(80)).not.toThrow();
    expect(successCallback).toHaveBeenCalledTimes(2);
    expect(successCallback).toHaveBeenLastCalledWith(secondPosition);
  });

  it("pauses emits while hidden and resumes once the document is visible again", () => {
    const targetDocument = { visibilityState: "visible" as DocumentVisibilityState };
    const firstPosition = { timestamp: 100 } as GeolocationPosition;
    const secondPosition = { timestamp: 200 } as GeolocationPosition;
    const successCallback = vi.fn();

    const controller = createGeoWatchController({
      getCallbackDelay: () => 5,
      getNextWatchDelay: () => 60,
      getPosition: () => firstPosition,
      getWatchRefreshDelay: () => 40,
      refreshPosition: () => secondPosition,
      reportTimeout,
      targetGlobal: {
        clearTimeout,
        document: targetDocument,
        setTimeout,
      },
    });

    controller.scheduleWatch({
      watchId: 1,
      successCallback: successCallback,
    });

    vi.advanceTimersByTime(5);
    expect(successCallback).toHaveBeenCalledTimes(1);

    targetDocument.visibilityState = "hidden";
    vi.advanceTimersByTime(40);
    expect(successCallback).toHaveBeenCalledTimes(1);

    targetDocument.visibilityState = "visible";
    vi.advanceTimersByTime(59);
    expect(successCallback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(successCallback).toHaveBeenCalledTimes(2);
    expect(successCallback).toHaveBeenLastCalledWith(secondPosition);
  });

  it("stops tracked follow-up emits after clearWatch", () => {
    const successCallback = vi.fn();

    const controller = createGeoWatchController({
      getCallbackDelay: () => 5,
      getNextWatchDelay: () => 60,
      getPosition: () => ({ timestamp: 100 }) as GeolocationPosition,
      getWatchRefreshDelay: () => 40,
      refreshPosition: () => ({ timestamp: 200 }) as GeolocationPosition,
      reportTimeout,
      targetGlobal: {
        clearTimeout,
        setTimeout,
      },
    });

    controller.scheduleWatch({
      watchId: 3,
      successCallback: successCallback,
    });

    vi.advanceTimersByTime(5);
    expect(successCallback).toHaveBeenCalledTimes(1);

    controller.clearWatch(3);
    vi.advanceTimersByTime(500);
    expect(successCallback).toHaveBeenCalledTimes(1);
  });

  it("stops the initial callback when clearWatch runs before the first emit", () => {
    const successCallback = vi.fn();

    const controller = createGeoWatchController({
      getCallbackDelay: () => 25,
      getNextWatchDelay: () => 60,
      getPosition: () => ({ timestamp: 100 }) as GeolocationPosition,
      getWatchRefreshDelay: () => 40,
      refreshPosition: () => ({ timestamp: 200 }) as GeolocationPosition,
      reportTimeout,
      targetGlobal: {
        clearTimeout,
        setTimeout,
      },
    });

    controller.scheduleWatch({
      watchId: 11,
      successCallback: successCallback,
    });
    controller.clearWatch(11);

    vi.advanceTimersByTime(500);

    expect(successCallback).not.toHaveBeenCalled();
  });

  it("does not let a stale scheduled callback emit after the same watch ID is reused", () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const controller = createGeoWatchController({
      getCallbackDelay: () => 25,
      getNextWatchDelay: () => 60,
      getPosition: () => ({ timestamp: 100 }) as GeolocationPosition,
      getWatchRefreshDelay: () => 40,
      refreshPosition: () => ({ timestamp: 200 }) as GeolocationPosition,
      reportTimeout,
      targetGlobal: {
        // Model a timeout that became runnable immediately before rescheduling:
        // clearing it cannot prevent its callback, so the generation guard must.
        clearTimeout: vi.fn(),
        setTimeout,
      },
    });

    controller.scheduleWatch({
      watchId: 7,
      successCallback: firstCallback,
    });
    controller.scheduleWatch({
      watchId: 7,
      successCallback: secondCallback,
    });

    vi.advanceTimersByTime(25);

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);
  });

  it("can preserve an adapter-specific first refresh delay computed before the initial callback", () => {
    const successCallback = vi.fn();

    const controller = createGeoWatchController({
      getCallbackDelay: () => 25,
      getNextWatchDelay: () => 60,
      getPosition: () => ({ timestamp: 100 }) as GeolocationPosition,
      getWatchRefreshDelay: () => 80,
      refreshPosition: () => ({ timestamp: 200 }) as GeolocationPosition,
      reportTimeout,
      targetGlobal: {
        clearTimeout,
        setTimeout,
      },
    });

    controller.scheduleWatch({
      watchId: 9,
      successCallback: successCallback,
      initialRefreshDelayMs: 50,
    });

    vi.advanceTimersByTime(25);
    expect(successCallback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(49);
    expect(successCallback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(successCallback).toHaveBeenCalledTimes(2);
  });

  it("honors an adapter-side activity guard before the first callback fires", () => {
    const cancelledWatchIds = new Set<number>();
    const successCallback = vi.fn();

    const controller = createGeoWatchController({
      getCallbackDelay: () => 25,
      getNextWatchDelay: () => 60,
      getPosition: () => ({ timestamp: 100 }) as GeolocationPosition,
      getWatchRefreshDelay: () => 40,
      isWatchActive: (watchId: number): boolean => !cancelledWatchIds.has(watchId),
      refreshPosition: () => ({ timestamp: 200 }) as GeolocationPosition,
      reportTimeout,
      targetGlobal: {
        clearTimeout,
        setTimeout,
      },
    });

    controller.scheduleWatch({
      watchId: 5,
      successCallback: successCallback,
    });
    cancelledWatchIds.add(5);
    controller.clearWatch(5);

    vi.advanceTimersByTime(25);
    expect(successCallback).not.toHaveBeenCalled();
  });

  it("does not reschedule when clearWatch runs from the timeout callback", () => {
    const errorCallback = vi.fn();
    let controller: ReturnType<typeof createGeoWatchController>;
    errorCallback.mockImplementation(() => controller.clearWatch(12));
    controller = createGeoWatchController({
      getCallbackDelay: () => 25,
      getNextWatchDelay: () => 60,
      getPosition: () => ({ timestamp: 100 }) as GeolocationPosition,
      getWatchRefreshDelay: () => 40,
      refreshPosition: () => ({ timestamp: 200 }) as GeolocationPosition,
      reportTimeout: (callback) => {
        callback?.({ code: 3 } as GeolocationPositionError);
      },
      targetGlobal: { clearTimeout, setTimeout },
    });

    controller.scheduleWatch({
      watchId: 12,
      successCallback: vi.fn(),
      positionOptions: { timeout: 0 },
      errorCallback: errorCallback,
    });
    vi.runOnlyPendingTimers();
    vi.runOnlyPendingTimers();

    expect(errorCallback).toHaveBeenCalledTimes(1);
  });

  it("does not deliver an initial cached position while the document is hidden", () => {
    const targetDocument = { visibilityState: "hidden" as DocumentVisibilityState };
    const cachedPosition = { timestamp: 100 } as GeolocationPosition;
    const successCallback = vi.fn();
    const controller = createGeoWatchController({
      getCachedPosition: () => cachedPosition,
      getCallbackDelay: () => 25,
      getNextWatchDelay: () => 60,
      getPosition: () => cachedPosition,
      getWatchRefreshDelay: () => 40,
      refreshPosition: () => ({ timestamp: 200 }) as GeolocationPosition,
      reportTimeout,
      targetGlobal: { clearTimeout, document: targetDocument, setTimeout },
    });

    controller.scheduleWatch({
      watchId: 13,
      successCallback: successCallback,
      positionOptions: { maximumAge: 60_000, timeout: 0 },
    });
    vi.advanceTimersByTime(500);
    expect(successCallback).not.toHaveBeenCalled();

    targetDocument.visibilityState = "visible";
    vi.advanceTimersByTime(60);
    expect(successCallback).toHaveBeenCalledWith(cachedPosition);
  });
});
