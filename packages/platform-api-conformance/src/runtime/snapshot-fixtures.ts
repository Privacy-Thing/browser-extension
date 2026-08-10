import { BRAND_FILE_STEM } from "@privacy-brand/tooling-shared/brand";
import type { RuntimeSnapshot as EffectiveRuntimeSnapshot } from "@privacy-brand/tooling-shared/runtime-snapshot";

import { chromiumMarkerPath } from "../repo-paths.js";

export const buildTempPrefix = (label: string): string =>
  `${BRAND_FILE_STEM}-conformance-${label}-`;
export const CHROMIUM_MARKER_PATH = chromiumMarkerPath;

// ---------------------------------------------------------------------------
// Test runtime snapshot — activates ALL spoofing paths in the extension.
//
// The exact UA version string (Chrome/124) is intentional and does NOT need
// to track Playwright's bundled browser version. The conformance tool measures
// descriptor shape changes (getOwnPropertyDescriptors diff), not UA content.
// The UA just needs to be a valid-looking string that triggers the extension's
// fingerprint spoofing path. Updating it would only invalidate the snapshot
// cache without improving detection accuracy.
// ---------------------------------------------------------------------------

export const TEST_RUNTIME_SNAPSHOT: EffectiveRuntimeSnapshot = {
  geo: {
    latitude: 51.5074,
    longitude: -0.1278,
    accuracy: 10,
    noiseRadius: 50,
  },
  locale: {
    language: "en-GB",
    languages: ["en-GB", "en"],
    timeZone: "Europe/London",
    acceptLanguage: "en-GB,en;q=0.9",
  },
  date: {
    baseEpochMs: Date.now(),
    offsetMs: 0,
    timeZone: "Europe/London",
  },
  debugMode: false,
  watchPositionDelay: [100, 500],
  fingerprint: {
    hardwareConcurrency: 8,
    deviceMemory: 8,
    platform: "Win32",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    vendor: "Google Inc.",
    appVersion:
      "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    clientHints: {
      brands: [
        { brand: "Chromium", version: "124" },
        { brand: "Google Chrome", version: "124" },
        { brand: "Not-A.Brand", version: "99" },
      ],
      fullVersionList: [
        { brand: "Chromium", version: "124.0.6367.118" },
        { brand: "Google Chrome", version: "124.0.6367.118" },
        // eslint-disable-next-line sonarjs/no-hardcoded-ip
        { brand: "Not-A.Brand", version: "99.0.0.0" },
      ],
      platform: "Windows",
      platformVersion: "10.0.0",
      mobile: false,
      architecture: "x86",
      bitness: "64",
      model: "",
    },
    canvasNoiseSeed: 12345,
    audioNoiseSeed: 12345 ^ 0x5a3ce91d,
    webGL: {
      renderer: "ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.5)",
      vendor: "Google Inc. (Intel)",
      suppressDebugInfo: true,
      readPixelsNoiseSeed: 12345 ^ 0x6d2b79f5,
    },
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      colorDepth: 24,
      devicePixelRatio: 1,
    },
  },
  blockServiceWorkerRegistration: true,
};

export type SnapshotRuntimeActivator = {
  entries: Array<{
    pattern: string;
    blockServiceWorkerRegistration: boolean;
    snapshot: EffectiveRuntimeSnapshot;
  }>;
};

export type ActivatorCacheInput = {
  entries: Array<{
    pattern: string;
    blockServiceWorkerRegistration: boolean;
    snapshot: Omit<EffectiveRuntimeSnapshot, "date"> & {
      date: Omit<EffectiveRuntimeSnapshot["date"], "baseEpochMs">;
    };
  }>;
};

export type FxSeededInput = {
  runtimeTestHost: string;
  seededRule: {
    pattern: string;
    locationId: string;
    enabled: boolean;
    blockServiceWorkerRegistration: boolean;
  };
  seededLocation: {
    id: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    noiseRadius: number;
    language: string;
    languages: readonly string[];
    timeZone: string;
  };
  readiness: {
    language: string;
    languages: readonly string[];
  };
};

export const TEST_SERVER_HOST = "127.0.0.1";

export const TEST_RUNTIME_ACTIVATOR: SnapshotRuntimeActivator = {
  entries: [
    {
      pattern: "*",
      blockServiceWorkerRegistration: false,
      snapshot: TEST_RUNTIME_SNAPSHOT,
    },
  ],
};

export const FIREFOX_SEEDED_LOCATION = {
  id: "spf-london",
  latitude: 51.5074,
  longitude: -0.1278,
  accuracy: 25,
  noiseRadius: 50,
  language: "en-GB",
  languages: ["en-GB", "en"] as const,
  timeZone: "Europe/London",
};

export const FIREFOX_SEEDED_READINESS = {
  language: FIREFOX_SEEDED_LOCATION.language,
  languages: FIREFOX_SEEDED_LOCATION.languages,
  timeZone: FIREFOX_SEEDED_LOCATION.timeZone,
};

export const FX_SEEDED_INPUT: FxSeededInput = {
  runtimeTestHost: TEST_SERVER_HOST,
  seededRule: {
    pattern: TEST_SERVER_HOST,
    locationId: FIREFOX_SEEDED_LOCATION.id,
    enabled: true,
    blockServiceWorkerRegistration: false,
  },
  seededLocation: FIREFOX_SEEDED_LOCATION,
  readiness: FIREFOX_SEEDED_READINESS,
};

// ---------------------------------------------------------------------------
// Snapshot result types
// ---------------------------------------------------------------------------
