import { afterEach, describe, expect, it, vi } from "vitest";

import { persistPreload } from "@/background/preload-persist";
import { createPreparedDecisions } from "@/background/prepared-runtime-decisions";
import {
  PRELOAD_STATE_KEY,
  type PreloadedRuntimeState,
} from "@/content/preloaded-runtime";
import type { Location } from "@/shared/types";

const warsaw: Location = {
  id: "warsaw",
  label: "Warsaw",
  latitude: 52.2297,
  longitude: 21.0122,
  accuracy: 25,
  noiseRadius: 50,
  language: "pl-PL",
  languages: ["pl-PL", "pl"],
  timeZone: "Europe/Warsaw",
};

const readPersistedState = (set: ReturnType<typeof vi.fn>): PreloadedRuntimeState => {
  const payload = set.mock.calls[0]?.[0] as
    Record<string, PreloadedRuntimeState> | undefined;
  const state = payload?.[PRELOAD_STATE_KEY];
  if (!state) {
    throw new Error("expected session preload state to be written");
  }
  return state;
};

describe("persistPreload", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("writes host-bound fenced rows without replacing the baseline star fingerprint", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", {
      storage: {
        session: { set },
      },
    });

    const prepared = createPreparedDecisions({
      rules: [],
      trustedSites: [],
      locations: [warsaw],
      controlState: { panicMode: false },
      debugMode: false,
      watchPositionDelay: [60, 500],
      fingerprintEnabled: true,
      featureFlags: { temporalApi: false, domainFencing: true },
      sharedWorkerHandlingMode: "native",
      sharedSpoofing: undefined,
      browserFingerprintSource: {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        platform: "MacIntel",
        vendor: "Google Inc.",
        hardwareConcurrency: 8,
        deviceMemory: 8,
        userAgentData: {
          brands: [{ brand: "Chromium", version: "125" }],
          fullVersionList: [{ brand: "Chromium", version: "125.0.6422.0" }],
          mobile: false,
          platform: "macOS",
        },
      },
      globalFallbackRule: {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "glb123",
        authKey: "fa11bac0",
      },
      containerAssignments: [],
    });
    const baseline = prepared
      .getPreloadedEntries()
      .find((entry) => entry.pattern === "*")?.snapshot.fingerprint?.canvasNoiseSeed;
    prepared.resolveDecision("shop.example.com");

    await persistPreload({
      getPreparedDecisions: () => prepared,
      getLastKnownTrustedSites: () => [],
    });

    expect(set).toHaveBeenCalledOnce();
    const state = readPersistedState(set);
    const star = state.entries.find((entry) => entry.pattern === "*");
    const fenced = state.entries.find((entry) => entry.pattern === "*example.com");
    expect(star?.snapshot.fingerprint?.canvasNoiseSeed).toBe(baseline);
    expect(fenced?.snapshot.fingerprint?.canvasNoiseSeed).toEqual(expect.any(Number));
    expect(fenced?.snapshot.fingerprint?.canvasNoiseSeed).not.toBe(baseline);
  });

  it("does not write when prepared decisions are missing", async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", {
      storage: {
        session: { set },
      },
    });

    await persistPreload({
      getPreparedDecisions: () => null,
      getLastKnownTrustedSites: () => [],
    });

    expect(set).not.toHaveBeenCalled();
  });
});
