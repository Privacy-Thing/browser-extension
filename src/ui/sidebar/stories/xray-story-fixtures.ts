import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";

import { buildSurfaceAssessments } from "@/background/surface-assessments";
import type { RuntimeSnapshot } from "@/shared/types";

export const XRAY_STORY_SCENARIOS = [
  "active",
  "syncing",
  "partially-disabled",
  "evidence-states",
  "error",
  "trusted-site",
] as const;

export type XRayStoryScenario = (typeof XRAY_STORY_SCENARIOS)[number];

const activeSnapshot: RuntimeSnapshot = {
  geo: {
    latitude: 52.22968,
    longitude: 21.01223,
    accuracy: 42,
    noiseRadius: 250,
  },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl", "en-US"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl;q=0.9,en-US;q=0.7",
  },
  date: {
    baseEpochMs: 1_784_356_800_000,
    offsetMs: 7_200_000,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [60, 500],
  sharedWorkerHandlingMode: "spoof",
  geolocationEnabled: true,
  timeLocaleEnabled: true,
  blockServiceWorkerRegistration: true,
  fingerprint: {
    platform: "MacIntel",
    hardwareConcurrency: 10,
    deviceMemory: 8,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36",
    screen: { width: 1728, height: 1117 },
    webGL: {
      renderer: "Apple M2 Pro",
      vendor: "Apple Inc.",
      suppressDebugInfo: true,
      readPixelsNoiseSeed: 81,
    },
    canvasNoiseSeed: 32,
    audioNoiseSeed: 47,
    clientHints: {
      platform: "macOS",
      brands: [
        { brand: "Google Chrome", version: "138" },
        { brand: "Chromium", version: "138" },
      ],
    },
  },
};

const activeState = (): Extract<GetXRayStateResponse, { ok: true }> => ({
  ok: true,
  hostname: "allegro.pl",
  snapshot: activeSnapshot,
  displayedProfileLabel: "Warsaw, Poland",
  locationId: "location-warsaw",
  rulePattern: "allegro.pl",
  assessments: buildSurfaceAssessments({
    source: "site-rule",
    snapshot: activeSnapshot,
    runtimeExpected: true,
    accessedCategories: {
      geolocation: true,
      timeLocale: true,
      canvas: true,
      webGL: true,
      navigator: true,
      serviceWorker: true,
    },
    queryCounts: {
      geolocation: 3,
      canvas: 4,
      webGL: 5,
      navigator: 2,
      serviceWorker: 1,
    },
    methodCounts: {
      "canvas.toDataURL": 2,
      "canvas.getImageData": 2,
      "webGL.getParameter": 3,
      "webGL.readPixels": 2,
    },
  }),
  accessedCategories: {
    geolocation: true,
    timeLocale: true,
    canvas: true,
    webGL: true,
    navigator: true,
    serviceWorker: true,
  },
  failedCategories: {},
  sharedWorkerStatus: "blob-wrapper-dedup-disabled",
  queryCounts: {
    geolocation: 3,
    canvas: 4,
    webGL: 5,
    navigator: 2,
    serviceWorker: 1,
  },
  methodCounts: {
    "canvas.toDataURL": 2,
    "canvas.getImageData": 2,
    "webGL.getParameter": 3,
    "webGL.readPixels": 2,
  },
  explanation: {
    winningSource: "rule",
    effectiveLocationId: "location-warsaw",
    steps: [
      { source: "trusted-site", status: "no-match" },
      {
        source: "exact-rule",
        status: "won",
        pattern: "allegro.pl",
        locationId: "location-warsaw",
      },
      { source: "suffix-rule", status: "no-match" },
      { source: "container", status: "no-match" },
      { source: "fallback", status: "skipped", locationId: "location-default" },
    ],
  },
});

export const createXRayStoryState = (
  scenario: XRayStoryScenario,
): GetXRayStateResponse => {
  if (scenario === "error") {
    return {
      ok: false,
      error: "The X-Ray snapshot could not be resolved for this tab.",
    };
  }

  if (scenario === "trusted-site") {
    return {
      ok: true,
      hostname: "bank.example.test",
      snapshot: null,
      displayedProfileLabel: null,
      locationId: null,
      rulePattern: null,
      assessments: buildSurfaceAssessments({
        source: "trusted-site",
        snapshot: null,
        runtimeExpected: false,
      }),
      accessedCategories: {},
      failedCategories: {},
      explanation: {
        winningSource: "trusted-site",
        effectiveLocationId: null,
        steps: [
          { source: "trusted-site", status: "won", pattern: "bank.example.test" },
        ],
      },
    };
  }

  const state = activeState();
  if (scenario === "evidence-states") {
    // Exercises every new P0-05 presentation state (#111): a repaired canvas,
    // an unrecoverable webGL, an unconfirmed-so-pending audio, and a
    // still-installing worker — the rest stay protected.
    // Exercises all nine presentation states, including `browser-enforced`
    // (webRTC with a confirmed browser IP-handling policy).
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot: activeSnapshot,
      runtimeExpected: true,
      webRtcPolicyConfirmed: true,
      evidenceByRealm: {
        canvas: [{ realmId: "document", integrity: "repaired", observedAt: 1 }],
        webGL: [{ realmId: "iframe-1", integrity: "unrecoverable", observedAt: 2 }],
        audio: [{ realmId: "document", integrity: "unconfirmed", observedAt: 3 }],
        worker: [{ realmId: "worker-1", installation: "pending", observedAt: 4 }],
      },
    });
    return { ...state, assessments, accessedCategories: {} };
  }

  if (scenario === "syncing") {
    const syncingState = { ...state };
    delete syncingState.queryCounts;
    delete syncingState.methodCounts;
    return {
      ...syncingState,
      assessments: buildSurfaceAssessments({
        source: "site-rule",
        snapshot: activeSnapshot,
        runtimeExpected: true,
      }),
      accessedCategories: {},
    };
  }

  if (scenario === "partially-disabled") {
    const partialDisabledSnapshot: RuntimeSnapshot = {
      ...activeSnapshot,
      geolocationEnabled: false,
      timeLocaleEnabled: false,
      fingerprint: {
        ...activeSnapshot.fingerprint,
        spoofingToggles: {
          navigator: false,
          screen: false,
          canvas: false,
          clientHints: false,
        },
      },
    };
    return {
      ...state,
      snapshot: partialDisabledSnapshot,
      assessments: buildSurfaceAssessments({
        source: "site-rule",
        snapshot: partialDisabledSnapshot,
        runtimeExpected: true,
        accessedCategories: { webGL: true, audio: true },
        queryCounts: { webGL: 2, audio: 1 },
        methodCounts: { "webGL.getParameter": 2 },
      }),
      accessedCategories: { webGL: true, audio: true },
      queryCounts: { webGL: 2, audio: 1 },
      methodCounts: { "webGL.getParameter": 2 },
    };
  }

  return state;
};
