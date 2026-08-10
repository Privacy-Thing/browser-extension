import { describe, expect, it } from "vitest";

import {
  readEarlySnapshot,
  resolveChromiumSnapshot,
  type ChromiumAdapterDeps,
  type ChromiumEarlyReaders,
  type ChromiumResolution,
} from "./adapter";

// ---------------------------------------------------------------------------
// Minimal snapshot type used only by these tests.
// The adapter is generic so any object works.
// ---------------------------------------------------------------------------

type TestSnapshot = { id: string };

const snap = (id: string): TestSnapshot => ({ id });

const makeReaders = (
  overrides: Partial<ChromiumEarlyReaders<TestSnapshot>> = {},
): ChromiumEarlyReaders<TestSnapshot> => ({
  readHashSnapshot: () => null,
  readDomHandoffSnapshot: () => null,
  ...overrides,
});

const makeDeps = (
  overrides: Partial<ChromiumAdapterDeps<TestSnapshot>> = {},
): ChromiumAdapterDeps<TestSnapshot> => ({
  readHashSnapshot: () => null,
  readDomHandoffSnapshot: () => null,
  cleanupDomHandoff: () => undefined,
  resolveBgSnapshot: () => Promise.resolve(null),
  ...overrides,
});

// ---------------------------------------------------------------------------
// readEarlySnapshot
// ---------------------------------------------------------------------------

describe("readEarlySnapshot", () => {
  it("returns hash snapshot when present — has priority over DOM handoff", () => {
    const result = readEarlySnapshot(
      makeReaders({
        readHashSnapshot: () => snap("hash"),
        readDomHandoffSnapshot: () => snap("dom"),
      }),
    );

    expect(result).toEqual<ChromiumResolution<TestSnapshot>>({
      snapshot: snap("hash"),
      channel: "hash",
    });
  });

  it("falls back to DOM handoff when hash is absent", () => {
    const result = readEarlySnapshot(
      makeReaders({ readDomHandoffSnapshot: () => snap("dom") }),
    );

    expect(result).toEqual<ChromiumResolution<TestSnapshot>>({
      snapshot: snap("dom"),
      channel: "dom-handoff",
    });
  });

  it("returns miss when both sources are absent", () => {
    const result = readEarlySnapshot(makeReaders());

    expect(result).toEqual<ChromiumResolution<TestSnapshot>>({
      snapshot: null,
      channel: "miss",
    });
  });
});

// ---------------------------------------------------------------------------
// resolveChromiumSnapshot — regular path priority
// ---------------------------------------------------------------------------

describe("resolveChromiumSnapshot", () => {
  it("returns DOM handoff with priority on regular path", async () => {
    let cleanupCalled = false;

    const result = await resolveChromiumSnapshot(
      "example.com",
      makeDeps({
        readDomHandoffSnapshot: () => snap("dom"),
        cleanupDomHandoff: () => {
          cleanupCalled = true;
        },
        readHashSnapshot: () => snap("hash"),
      }),
    );

    expect(result).toEqual<ChromiumResolution<TestSnapshot>>({
      snapshot: snap("dom"),
      channel: "dom-handoff",
    });
    expect(cleanupCalled).toBe(true);
  });

  it("falls back to hash when DOM handoff is absent", async () => {
    const result = await resolveChromiumSnapshot(
      "example.com",
      makeDeps({ readHashSnapshot: () => snap("hash") }),
    );

    expect(result).toEqual<ChromiumResolution<TestSnapshot>>({
      snapshot: snap("hash"),
      channel: "hash",
    });
  });

  it("falls back to runtime message when DOM and hash are absent", async () => {
    const result = await resolveChromiumSnapshot(
      "example.com",
      makeDeps({
        resolveBgSnapshot: () => Promise.resolve(snap("bg")),
      }),
    );

    expect(result).toEqual<ChromiumResolution<TestSnapshot>>({
      snapshot: snap("bg"),
      channel: "runtime-message",
    });
  });

  it("returns miss when all sources are absent", async () => {
    const result = await resolveChromiumSnapshot("example.com", makeDeps());

    expect(result).toEqual<ChromiumResolution<TestSnapshot>>({
      snapshot: null,
      channel: "miss",
    });
  });

  it("treats background rejection as miss — no unhandled rejection", async () => {
    const result = await resolveChromiumSnapshot(
      "example.com",
      makeDeps({
        resolveBgSnapshot: () => Promise.reject(new Error("channel unavailable")),
      }),
    );

    expect(result).toEqual<ChromiumResolution<TestSnapshot>>({
      snapshot: null,
      channel: "miss",
    });
  });

  it("does NOT call cleanupDomHandoff when DOM handoff is absent", async () => {
    let cleanupCalled = false;

    await resolveChromiumSnapshot(
      "example.com",
      makeDeps({
        cleanupDomHandoff: () => {
          cleanupCalled = true;
        },
      }),
    );

    expect(cleanupCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Timeout behaviour — deterministic, no real timers
// ---------------------------------------------------------------------------

describe("resolveChromiumSnapshot — timeout", () => {
  it("resolves with miss when background never resolves and timeout fires", async () => {
    // runtimeMessageTimeoutMs=0: timeout side of the race resolves first
    // (macrotask) before the never-settling promise.
    const result = await resolveChromiumSnapshot(
      "example.com",
      makeDeps({
        runtimeMessageTimeoutMs: 0,
        resolveBgSnapshot: () =>
          new Promise(() => {
            /* never */
          }),
      }),
    );

    expect(result).toEqual<ChromiumResolution<TestSnapshot>>({
      snapshot: null,
      channel: "miss",
    });
  });
});
