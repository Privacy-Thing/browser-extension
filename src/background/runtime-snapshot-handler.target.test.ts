import { afterEach, expect, it, vi } from "vitest";

import { createSnapshotCache } from "./effective-snapshot-cache";
import { bindSnapshotCache } from "./pause-aware-cache";
import { createSnapshotHandler } from "./runtime-snapshot-handler";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";

const pause = { hostname: "h.example", id: "pause", expiresAt: null };
afterEach(() => vi.unstubAllGlobals());

it("restores a cold subframe decision from the tab's top host and retains pause metadata in both cache entries", async () => {
  vi.stubGlobal("chrome", {
    tabs: { get: vi.fn(async () => ({ url: "https://h.example/path" })) },
  });
  const decision = { snapshot: null, trustedSiteMatched: false, hostPause: pause };
  const resolve = vi.fn(async () => decision);
  const write = vi.fn();
  const handler = createSnapshotHandler({
    ensureStorageMigration: vi.fn(async () => undefined),
    runtimeState: { getLastKnownDebugMode: () => null },
    logResolverEvent: vi.fn(),
    resolveCachedSnapshot: vi.fn(async () => null),
    resolveRuntimeDecision: resolve,
    readDecisionCache: () => undefined,
    readTopDecision: () => undefined,
    updateSnapshotCache: write,
  });
  expect(
    await handler(
      { type: EXTENSION_COMMAND_TYPES.resolveRuntimeSnapshot, hostname: "k.example" },
      "firefox-container-1",
      12,
      4,
    ),
  ).toEqual({ ok: true, snapshot: null });
  expect(resolve).toHaveBeenCalledWith("h.example", "firefox-container-1");
  expect(write.mock.calls.map(([input]) => input)).toEqual([
    {
      tabId: 12,
      frameId: 0,
      hostname: "h.example",
      cookieStoreId: "firefox-container-1",
      value: decision,
    },
    {
      tabId: 12,
      frameId: 4,
      hostname: "k.example",
      cookieStoreId: "firefox-container-1",
      value: decision,
    },
  ]);
});

it("never interprets an unowned worker/request hostname as a top-document pause", async () => {
  const resolve = vi.fn(async () => null);
  const write = vi.fn();
  const handler = createSnapshotHandler({
    ensureStorageMigration: vi.fn(async () => undefined),
    runtimeState: { getLastKnownDebugMode: () => null },
    logResolverEvent: vi.fn(),
    resolveCachedSnapshot: resolve,
    resolveRuntimeDecision: vi.fn(),
    readDecisionCache: () => undefined,
    readTopDecision: () => undefined,
    updateSnapshotCache: write,
  });
  await handler({
    type: EXTENSION_COMMAND_TYPES.resolveRuntimeSnapshot,
    hostname: "h.example",
  });
  expect(resolve).toHaveBeenCalledWith("h.example", undefined, undefined, {
    respectHostPause: false,
  });
  expect(write).not.toHaveBeenCalled();
});

it("does not retain a resumed pause when a cold subframe resolution finishes late", async () => {
  vi.stubGlobal("chrome", {
    tabs: { get: vi.fn(async () => ({ url: "https://h.example/path" })) },
  });
  const raw = createSnapshotCache();
  const cache = bindSnapshotCache(raw, () => undefined);
  const handler = createSnapshotHandler({
    ensureStorageMigration: async () => undefined,
    runtimeState: { getLastKnownDebugMode: () => null },
    logResolverEvent: vi.fn(),
    resolveCachedSnapshot: async () => null,
    resolveRuntimeDecision: async () => ({
      snapshot: null,
      trustedSiteMatched: false,
      hostPause: pause,
    }),
    ...cache,
  });
  await handler(
    { type: EXTENSION_COMMAND_TYPES.resolveRuntimeSnapshot, hostname: "k.example" },
    undefined,
    12,
    4,
  );
  expect(raw.readTopEntry(12)).toBeUndefined();
  expect(cache.readDecisionCache(12, 4, "k.example")).toBeUndefined();
});
