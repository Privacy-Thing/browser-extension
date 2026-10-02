import { expect, it } from "vitest";

import { createSnapshotCache } from "./effective-snapshot-cache";
import { bindSnapshotCache } from "./pause-aware-cache";

import type { HostProtectionPause } from "@/shared/host-protection-pause";
import type { RuntimeSnapshot } from "@/shared/types";

const snapshot: RuntimeSnapshot = {
  geo: { latitude: 52, longitude: 21, accuracy: 25, noiseRadius: 50 },
  locale: {
    language: "pl",
    languages: ["pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500],
};
it("rejects stale navigation decisions after activation and applies only the cached top host to a subframe", () => {
  const pauses = new Map<string, HostProtectionPause>();
  const raw = createSnapshotCache();
  const cache = bindSnapshotCache(raw, (hostname) => pauses.get(hostname));
  const decision = { snapshot, trustedSiteMatched: false };
  cache.updateSnapshotCache({
    tabId: 1,
    frameId: 0,
    hostname: "h.example",
    value: decision,
  });
  cache.updateSnapshotCache({
    tabId: 2,
    frameId: 0,
    hostname: "k.example",
    value: decision,
  });
  pauses.set("h.example", { hostname: "h.example", id: "pause", expiresAt: null });
  expect(cache.readSnapshotCache(1, 0, "h.example")).toBeNull();
  // A request resolved before activation finishes afterwards and rewrites cache.
  cache.updateSnapshotCache({
    tabId: 1,
    frameId: 0,
    hostname: "h.example",
    value: decision,
  });
  cache.updateSnapshotCache({
    tabId: 1,
    frameId: 4,
    hostname: "k.example",
    value: decision,
  });
  expect(raw.readTopEntry(1)?.decision.hostPause?.id).toBe("pause");
  expect(cache.readSnapshotCache(1, 4, "k.example")).toBeNull();
  cache.updateSnapshotCache({
    tabId: 2,
    frameId: 4,
    hostname: "h.example",
    value: decision,
  });
  expect(cache.readSnapshotCache(2, 4, "h.example")).toEqual(snapshot);
});
it("rejects an in-flight pause decision after resume instead of caching a stale disabled activation", () => {
  const pauses = new Map<string, HostProtectionPause>();
  const raw = createSnapshotCache();
  const cache = bindSnapshotCache(raw, (hostname) => pauses.get(hostname));
  const pause = { hostname: "h.example", id: "pause", expiresAt: null };
  pauses.set(pause.hostname, pause);
  cache.updateSnapshotCache({
    tabId: 1,
    frameId: 0,
    hostname: pause.hostname,
    value: { snapshot: null, trustedSiteMatched: false, hostPause: pause },
  });
  pauses.clear();
  expect(cache.readTopEntry(1)).toBeUndefined();
  cache.updateSnapshotCache({
    tabId: 1,
    frameId: 0,
    hostname: pause.hostname,
    value: { snapshot: null, trustedSiteMatched: false, hostPause: pause },
  });
  expect(cache.readSnapshotCache(1, 0, pause.hostname)).toBeUndefined();
});
