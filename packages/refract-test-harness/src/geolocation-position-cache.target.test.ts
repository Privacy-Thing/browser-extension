import { createGeoCache } from "@privacy-brand/refract-core";
import { describe, expect, it, vi } from "vitest";

describe("createGeoCache", () => {
  it("refreshes positions and tracks the next cache expiry from the current clock", () => {
    let nowMs = 1_000;
    const firstPosition = { timestamp: 123 } as GeolocationPosition;

    const cache = createGeoCache({
      createPosition: vi.fn(() => firstPosition),
      getNextWatchDelay: () => 400,
      now: () => nowMs,
      shouldUseCachedPosition: vi.fn(() => false),
    });

    expect(cache.refreshPosition()).toBe(firstPosition);
    expect(cache.getWatchRefreshDelay()).toBe(400);

    nowMs = 1_250;
    expect(cache.getWatchRefreshDelay()).toBe(150);
    expect(cache.getWatchRefreshDelay(300)).toBe(300);
  });

  it("reuses cached positions while the cache policy allows it", () => {
    let nowMs = 5_000;
    const firstPosition = { timestamp: 250 } as GeolocationPosition;
    const secondPosition = { timestamp: 900 } as GeolocationPosition;
    const createPosition = vi
      .fn<() => GeolocationPosition>()
      .mockReturnValueOnce(firstPosition)
      .mockReturnValueOnce(secondPosition);
    const shouldUseCachedPosition = vi.fn(() => true);
    const cache = createGeoCache({
      createPosition,
      getNextWatchDelay: () => 600,
      now: () => nowMs,
      shouldUseCachedPosition,
    });

    expect(cache.getPosition()).toBe(firstPosition);

    nowMs = 5_100;
    expect(cache.getPosition({ maximumAge: 300 })).toBe(firstPosition);
    expect(createPosition).toHaveBeenCalledTimes(1);
    expect(shouldUseCachedPosition).toHaveBeenLastCalledWith(
      firstPosition.timestamp,
      5_600,
      { maximumAge: 300 },
    );
  });

  it("emits debug callbacks for cache hits and refreshes", () => {
    let nowMs = 3_000;
    const firstPosition = { timestamp: 111 } as GeolocationPosition;
    const secondPosition = { timestamp: 222 } as GeolocationPosition;
    const onCacheHit = vi.fn();
    const onCacheRefresh = vi.fn();
    const shouldUseCachedPosition = vi
      .fn<
        (timestamp: number, expiresAt: number, options?: PositionOptions) => boolean
      >()
      .mockReturnValueOnce(true);
    const cache = createGeoCache({
      createPosition: vi
        .fn<() => GeolocationPosition>()
        .mockReturnValueOnce(firstPosition)
        .mockReturnValueOnce(secondPosition),
      getNextWatchDelay: () => 500,
      now: () => nowMs,
      onCacheHit,
      onCacheRefresh,
      shouldUseCachedPosition,
    });

    expect(cache.getPosition({ maximumAge: 100 })).toBe(firstPosition);
    nowMs = 3_050;
    expect(cache.getPosition({ maximumAge: 100 })).toBe(firstPosition);
    nowMs = 3_200;
    expect(cache.refreshPosition({ maximumAge: 0 })).toBe(secondPosition);

    expect(onCacheRefresh).toHaveBeenNthCalledWith(1, {
      expiresAt: 3_500,
      nextTimestamp: 111,
      options: { maximumAge: 100 },
      previousExpiresAt: null,
      previousTimestamp: null,
    });
    expect(onCacheHit).toHaveBeenCalledWith({
      expiresAt: 3_500,
      options: { maximumAge: 100 },
      timestamp: 111,
    });
    expect(onCacheRefresh).toHaveBeenNthCalledWith(2, {
      expiresAt: 3_700,
      nextTimestamp: 222,
      options: { maximumAge: 0 },
      previousExpiresAt: 3_500,
      previousTimestamp: 111,
    });
  });

  it("drops cached state when cleared", () => {
    let nowMs = 10_000;
    const firstPosition = { timestamp: 111 } as GeolocationPosition;
    const secondPosition = { timestamp: 222 } as GeolocationPosition;
    const createPosition = vi
      .fn<() => GeolocationPosition>()
      .mockReturnValueOnce(firstPosition)
      .mockReturnValueOnce(secondPosition);

    const cache = createGeoCache({
      createPosition,
      getNextWatchDelay: () => 250,
      now: () => nowMs,
      shouldUseCachedPosition: vi.fn(() => true),
    });

    expect(cache.getPosition()).toBe(firstPosition);
    cache.clear();

    nowMs = 10_050;
    expect(cache.getWatchRefreshDelay()).toBe(250);
    expect(cache.getPosition()).toBe(secondPosition);
    expect(createPosition).toHaveBeenCalledTimes(2);
  });
});
