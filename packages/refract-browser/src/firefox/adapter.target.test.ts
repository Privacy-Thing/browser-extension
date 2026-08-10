import { describe, expect, it } from "vitest";

import {
  checkFxUserScriptsReady,
  resolveFirefoxSnapshot,
  type FirefoxAdapterDeps,
  type FxSnapshotResolution,
  type FxUserScriptsReady,
} from "./adapter";

// ---------------------------------------------------------------------------
// Minimal snapshot type used only by these tests.
// The adapter is generic so any object works.
// ---------------------------------------------------------------------------

type TestSnapshot = { id: string };

const snap = (id: string): TestSnapshot => ({ id });

const makeDeps = (
  overrides: Partial<FirefoxAdapterDeps<TestSnapshot>> = {},
): FirefoxAdapterDeps<TestSnapshot> => ({
  readPreloadedState: () => Promise.resolve(null),
  resolvePreloadedSnapshot: () => null,
  resolveBgSnapshot: () => Promise.resolve(null),
  queryUserScriptsReady: () =>
    Promise.resolve({
      hasPermission: false,
      registrationCount: 0,
      lastSyncSucceeded: false,
      ready: false,
    }),
  ...overrides,
});

// ---------------------------------------------------------------------------
// resolveFirefoxSnapshot — regular path priority
// ---------------------------------------------------------------------------

describe("resolveFirefoxSnapshot", () => {
  it("returns preloaded state snapshot with priority", async () => {
    const preloadedStateMock = { dummy: true };
    const result = await resolveFirefoxSnapshot(
      "example.com",
      makeDeps({
        readPreloadedState: () => Promise.resolve(preloadedStateMock),
        resolvePreloadedSnapshot: (hostname, state) => {
          expect(hostname).toBe("example.com");
          expect(state).toBe(preloadedStateMock);
          return snap("preload");
        },
        resolveBgSnapshot: () => Promise.resolve(snap("bg")),
      }),
    );

    expect(result).toEqual<FxSnapshotResolution<TestSnapshot>>({
      snapshot: snap("preload"),
      channel: "preloaded-state",
    });
  });

  it("falls back to background message when preloaded state is absent", async () => {
    const result = await resolveFirefoxSnapshot(
      "example.com",
      makeDeps({
        resolveBgSnapshot: (hostname) => {
          expect(hostname).toBe("example.com");
          return Promise.resolve(snap("bg"));
        },
      }),
    );

    expect(result).toEqual<FxSnapshotResolution<TestSnapshot>>({
      snapshot: snap("bg"),
      channel: "background-message",
    });
  });

  it("returns miss when both preloaded state and background snapshot are absent", async () => {
    const result = await resolveFirefoxSnapshot("example.com", makeDeps());

    expect(result).toEqual<FxSnapshotResolution<TestSnapshot>>({
      snapshot: null,
      channel: "background-fallback-miss",
    });
  });

  it("treats background rejection as miss — no unhandled rejection", async () => {
    const result = await resolveFirefoxSnapshot(
      "example.com",
      makeDeps({
        resolveBgSnapshot: () => Promise.reject(new Error("channel unavailable")),
      }),
    );

    expect(result).toEqual<FxSnapshotResolution<TestSnapshot>>({
      snapshot: null,
      channel: "background-fallback-miss",
    });
  });
});

// ---------------------------------------------------------------------------
// Timeout behaviour — deterministic, no real timers
// ---------------------------------------------------------------------------

describe("resolveFirefoxSnapshot — timeout", () => {
  it("resolves with miss when background never resolves and timeout fires", async () => {
    const result = await resolveFirefoxSnapshot(
      "example.com",
      makeDeps({
        runtimeMessageTimeoutMs: 0,
        resolveBgSnapshot: () =>
          new Promise(() => {
            /* never */
          }),
      }),
    );

    expect(result).toEqual<FxSnapshotResolution<TestSnapshot>>({
      snapshot: null,
      channel: "background-fallback-miss",
    });
  });
});

// ---------------------------------------------------------------------------
// checkFxUserScriptsReady
// ---------------------------------------------------------------------------

describe("checkFxUserScriptsReady", () => {
  it("returns exact status from deps.queryUserScriptsReady", async () => {
    const expectedReadiness: FxUserScriptsReady = {
      hasPermission: true,
      registrationCount: 5,
      lastSyncSucceeded: true,
      ready: true,
    };

    const result = await checkFxUserScriptsReady(
      makeDeps({
        queryUserScriptsReady: () => Promise.resolve(expectedReadiness),
      }),
    );

    expect(result).toBe(expectedReadiness);
  });
});
