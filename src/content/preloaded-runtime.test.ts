import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PRELOAD_STATE_KEY,
  readPreloadedState,
  resolvePreloadedSnapshot,
} from "@/content/preloaded-runtime";
import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import type { RuntimeSnapshot } from "@/shared/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const createSnapshot = (latitude = 1): RuntimeSnapshot => ({
  geo: {
    latitude,
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
  watchPositionDelay: [60, 500],
});

describe("readPreloadedState", () => {
  it("returns null when the stored snapshot shape is malformed", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        session: {
          get: vi.fn().mockResolvedValue({
            [PRELOAD_STATE_KEY]: {
              entries: [
                {
                  pattern: "example.com",
                  blockServiceWorkerRegistration: false,
                  snapshot: {
                    geo: {},
                    locale: {},
                    date: {},
                    debugMode: false,
                    watchPositionDelay: [60, 500],
                  },
                },
              ],
              trustedSites: [],
            },
          }),
        },
      },
    });

    await expect(readPreloadedState()).resolves.toBeNull();
  });

  it("normalizes legacy stored state without trustedSites", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        session: {
          get: vi.fn().mockResolvedValue({
            [PRELOAD_STATE_KEY]: {
              entries: [
                {
                  pattern: "example.com",
                  blockServiceWorkerRegistration: false,
                  snapshot: createSnapshot(),
                },
              ],
            },
          }),
        },
      },
    });

    const state = await readPreloadedState();

    expect(state).toMatchObject({
      entries: [{ pattern: "example.com" }],
    });
    expect(resolvePreloadedSnapshot("example.com", state)?.geo.latitude).toBe(1);
  });

  it("leaves the preload to documents outside an Inspector selection", async () => {
    const preload = {
      entries: [
        {
          pattern: "*",
          blockServiceWorkerRegistration: false,
          snapshot: createSnapshot(),
        },
      ],
    };
    const read = async (
      sessions: Record<string, unknown>,
      hostname: string,
      subframe = false,
    ) => {
      vi.stubGlobal("chrome", {
        storage: {
          session: {
            get: vi.fn().mockResolvedValue({
              [PRELOAD_STATE_KEY]: preload,
              [EXTENSION_STORAGE_KEYS.inspectorSessions]: sessions,
            }),
          },
        },
      });
      const frame: { top?: unknown; location: { hostname: string } } = {
        location: { hostname },
      };
      frame.top = subframe ? {} : frame;
      vi.stubGlobal("window", frame);
      return readPreloadedState();
    };
    const inspected = { "3": { hostname: "inspected.example" } };

    await expect(read(inspected, "inspected.example")).resolves.toBeNull();
    await expect(read(inspected, "other.example")).resolves.toMatchObject(preload);
    await expect(read(inspected, "other.example", true)).resolves.toBeNull();
    await expect(read({}, "inspected.example", true)).resolves.toMatchObject(preload);
  });
});

describe("resolvePreloadedSnapshot", () => {
  it("returns the matched snapshot and preserves blockServiceWorkerRegistration", () => {
    const snapshot = resolvePreloadedSnapshot("sub.example.com", {
      entries: [
        {
          pattern: "*example.com",
          blockServiceWorkerRegistration: true,
          snapshot: createSnapshot(),
        },
      ],
      trustedSites: [],
    });

    expect(snapshot).toMatchObject({
      blockServiceWorkerRegistration: true,
      geo: {
        latitude: 1,
      },
    });
  });

  it("allows a global fallback preload on ordinary hosts", () => {
    const snapshot = resolvePreloadedSnapshot("example.com", {
      entries: [
        {
          pattern: "*",
          blockServiceWorkerRegistration: false,
          snapshot: createSnapshot(9),
        },
      ],
      trustedSites: [],
    });

    expect(snapshot?.geo.latitude).toBe(9);
  });

  it("passes the shared star preload fingerprint through without re-finalizing", () => {
    const snapshot = resolvePreloadedSnapshot("shop.example.com", {
      entries: [
        {
          pattern: "*",
          blockServiceWorkerRegistration: false,
          snapshot: {
            ...createSnapshot(9),
            fingerprint: {
              canvasNoiseSeed: 42,
            },
          },
        },
      ],
      trustedSites: [],
    });

    expect(snapshot?.fingerprint?.canvasNoiseSeed).toBe(42);
    expect(snapshot?.geo.latitude).toBe(9);
  });

  it("ignores an unknown leftover fencing field on preload snapshots", () => {
    const snapshot = resolvePreloadedSnapshot("shop.example.com", {
      entries: [
        {
          pattern: "*",
          blockServiceWorkerRegistration: false,
          snapshot: {
            ...createSnapshot(9),
            fingerprint: {
              canvasNoiseSeed: 111,
              fencing: { key: "opaque-fence-key" },
            },
          } as RuntimeSnapshot,
        },
      ],
      trustedSites: [],
    });

    expect(snapshot?.fingerprint?.canvasNoiseSeed).toBe(111);
    expect(snapshot?.geo.latitude).toBe(9);
  });

  it("does not let a global fallback preload activate on trusted sites", () => {
    const snapshot = resolvePreloadedSnapshot("github.com", {
      entries: [
        {
          pattern: "*",
          blockServiceWorkerRegistration: false,
          snapshot: createSnapshot(9),
        },
      ],
      trustedSites: [{ pattern: "github.com", enabled: true }],
    });

    expect(snapshot).toBeNull();
  });

  it("does not let a global fallback preload override a Native domain rule", () => {
    const snapshot = resolvePreloadedSnapshot("www.linkedin.com", {
      entries: [
        {
          pattern: "*",
          blockServiceWorkerRegistration: false,
          snapshot: createSnapshot(9),
        },
      ],
      nativeRulePatterns: ["*linkedin.com"],
      trustedSites: [],
    });

    expect(snapshot).toBeNull();
  });

  it("keeps normal specificity between Native and protected domain rules", () => {
    const protectedSpecific = resolvePreloadedSnapshot("api.example.com", {
      entries: [
        {
          pattern: "api.example.com",
          blockServiceWorkerRegistration: false,
          snapshot: createSnapshot(7),
        },
      ],
      nativeRulePatterns: ["*example.com"],
    });
    const nativeSpecific = resolvePreloadedSnapshot("api.example.com", {
      entries: [
        {
          pattern: "*example.com",
          blockServiceWorkerRegistration: false,
          snapshot: createSnapshot(7),
        },
      ],
      nativeRulePatterns: ["api.example.com"],
    });

    expect(protectedSpecific?.geo.latitude).toBe(7);
    expect(nativeSpecific).toBeNull();
  });
});

it("rejects an exact top-host pause until its deadline without dropping the permanent preload", () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(999);
    const snapshot = createSnapshot();
    const state = {
      entries: [{ pattern: "*", blockServiceWorkerRegistration: false, snapshot }],
      hostPauses: [{ hostname: "h.example", id: "pause", expiresAt: 1000 }],
    };
    expect(resolvePreloadedSnapshot("h.example", state)).toBeNull();
    expect(resolvePreloadedSnapshot("sub.h.example", state)).not.toBeNull();
    vi.setSystemTime(1000);
    expect(resolvePreloadedSnapshot("h.example", state)).not.toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
