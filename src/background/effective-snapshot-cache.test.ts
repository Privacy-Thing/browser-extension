import { describe, expect, it } from "vitest";

import {
  createSnapshotCache,
  SNAPSHOT_CACHE_TTL_MS,
} from "@/background/effective-snapshot-cache";

const snapshot = {
  geo: {
    latitude: 1,
    longitude: 2,
    accuracy: 3,
    noiseRadius: 4,
  },
  locale: {
    language: "en-US",
    languages: ["en-US"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "en-US",
  },
  date: {
    baseEpochMs: 1,
    offsetMs: 2,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [60, 500] as [number, number],
};
const decision = {
  snapshot,
  trustedSiteMatched: false,
};
const nullDecision = {
  snapshot: null,
  trustedSiteMatched: true,
};

describe("createSnapshotCache", () => {
  it("returns a hit only when hostname and cookieStoreId match", () => {
    const cache = createSnapshotCache();

    cache.set({
      tabId: 1,
      frameId: 0,
      hostname: "example.com",
      decision,
      cookieStoreId: "store-a",
      now: 100,
    });

    expect(
      cache.read({
        tabId: 1,
        frameId: 0,
        hostname: "example.com",
        cookieStoreId: "store-a",
        now: 200,
      }),
    ).toEqual(snapshot);
    expect(
      cache.read({
        tabId: 1,
        frameId: 0,
        hostname: "other.example.com",
        cookieStoreId: "store-a",
        now: 200,
      }),
    ).toBeUndefined();
    expect(
      cache.read({
        tabId: 1,
        frameId: 0,
        hostname: "example.com",
        cookieStoreId: "store-b",
        now: 200,
      }),
    ).toBeUndefined();
  });

  it("treats cached null snapshots as valid hits", () => {
    const cache = createSnapshotCache();

    const input = {
      tabId: 1,
      frameId: 0,
      hostname: "trusted.example",
      now: 100,
    };
    cache.set({ ...input, decision: nullDecision });

    expect(cache.read({ ...input, now: 200 })).toBeNull();
    expect(cache.readDecision({ ...input, now: 200 })).toEqual(nullDecision);
  });

  it("expires entries after the configured TTL", () => {
    const cache = createSnapshotCache();

    cache.set({
      tabId: 1,
      frameId: 0,
      hostname: "example.com",
      decision,
      now: 100,
    });

    expect(
      cache.read({
        tabId: 1,
        frameId: 0,
        hostname: "example.com",
        now: 100 + SNAPSHOT_CACHE_TTL_MS + 1,
      }),
    ).toBeUndefined();
  });

  it("readEntry returns the raw entry without hostname validation", () => {
    const cache = createSnapshotCache();

    cache.set({
      tabId: 1,
      frameId: 0,
      hostname: "publer.com",
      decision,
      cookieStoreId: "store-a",
      now: 100,
    });

    // readEntry does not validate hostname — returns the top-frame entry regardless of hostname.
    const entry = cache.readEntry(1, 0);
    expect(entry).toBeDefined();
    expect(entry?.decision.snapshot).toEqual(snapshot);
    expect(entry?.hostname).toBe("publer.com");

    // Different frame → undefined
    expect(cache.readEntry(1, 1)).toBeUndefined();
    // Different tab → undefined
    expect(cache.readEntry(2, 0)).toBeUndefined();
  });

  it("removes every frame entry for a tab", () => {
    const cache = createSnapshotCache();

    cache.set({ tabId: 1, frameId: 0, hostname: "example.com", decision, now: 100 });
    cache.set({ tabId: 1, frameId: 2, hostname: "example.com", decision, now: 100 });
    cache.set({ tabId: 2, frameId: 0, hostname: "example.com", decision, now: 100 });

    cache.removeTab(1);

    expect(
      cache.read({ tabId: 1, frameId: 0, hostname: "example.com", now: 200 }),
    ).toBeUndefined();
    expect(
      cache.read({ tabId: 1, frameId: 2, hostname: "example.com", now: 200 }),
    ).toBeUndefined();
    expect(
      cache.read({ tabId: 2, frameId: 0, hostname: "example.com", now: 200 }),
    ).toEqual(snapshot);
  });
});
