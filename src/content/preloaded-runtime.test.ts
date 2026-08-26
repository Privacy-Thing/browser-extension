import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PRELOAD_STATE_KEY,
  readPreloadedState,
  resolvePreloadedSnapshot,
} from "@/content/preloaded-runtime";
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

  it("preserves a fencing marker on the fallback preload for page-world finalization", () => {
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
          },
        },
      ],
      trustedSites: [],
    });

    expect(snapshot?.fingerprint?.fencing).toEqual({ key: "opaque-fence-key" });
    expect(snapshot?.fingerprint?.canvasNoiseSeed).toBe(111);
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
