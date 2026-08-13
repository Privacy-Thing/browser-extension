import { afterEach, describe, expect, it, vi } from "vitest";

import { createPreparedDecisions } from "@/background/prepared-runtime-decisions";
import { resolveProfileSnapshot } from "@/background/rules/resolver";
import type {
  ContainerAssignment,
  ControlState,
  DomainRule,
  GlobalFallbackRule,
  Location,
  RuntimeSnapshot,
  TrustedSite,
} from "@/shared/types";

const buildProfile = (id: string, timeZone: string, latitude: number): Location => ({
  id,
  label: id,
  latitude,
  longitude: 20,
  accuracy: 25,
  noiseRadius: 50,
  language: "en-US",
  languages: ["en-US", "en"],
  timeZone,
});

const profiles = [
  buildProfile("warsaw", "Europe/Warsaw", 52),
  buildProfile("berlin", "Europe/Berlin", 53),
];

const controlState: ControlState = { panicMode: false };

const comparableSnapshot = (snapshot: RuntimeSnapshot | null) => {
  if (!snapshot) {
    return null;
  }

  const { logEventName: _logEventName, date, ...rest } = snapshot;
  return {
    ...rest,
    date: {
      ...date,
      baseEpochMs: 0,
    },
  };
};

const buildPrepared = ({
  rules = [],
  trustedSites = [],
  globalFallbackRule,
  containerAssignments = [],
  fingerprintEnabled = true,
}: {
  rules?: DomainRule[];
  trustedSites?: TrustedSite[];
  globalFallbackRule?: GlobalFallbackRule;
  containerAssignments?: ContainerAssignment[];
  fingerprintEnabled?: boolean;
}) =>
  createPreparedDecisions({
    rules,
    trustedSites,
    locations: profiles,
    controlState,
    debugMode: false,
    watchPositionDelay: [60, 500],
    fingerprintEnabled,
    featureFlags: { temporalApi: false },
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
    globalFallbackRule,
    containerAssignments,
  });

const resolveBaseline = (
  hostname: string,
  cookieStoreId: string | undefined,
  rules: DomainRule[],
  globalFallbackRule?: GlobalFallbackRule,
  containerAssignments: ContainerAssignment[] = [],
  trustedSites: TrustedSite[] = [],
) =>
  resolveProfileSnapshot({
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
    fingerprintEnabled: true,
    containerAssignments,
    cookieStoreId,
    debugMode: false,
    globalFallbackRule,
    hostname,
    profiles,
    rules,
    sharedSpoofing: undefined,
    // Must match the prepared-inputs fixture above; this suite asserts that the
    // baseline resolver and the prepared fast path agree.
    sharedWorkerHandlingMode: "native",
    trustedSites,
    watchPositionDelay: [60, 500],
  });

describe("createPreparedDecisions", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches the resolver for direct domain rules", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const rules = [
      {
        pattern: "shop.example.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "rule01",
      },
    ];
    const prepared = buildPrepared({ rules });

    const decision = prepared.resolveDecision("shop.example.com");
    const baseline = resolveBaseline("shop.example.com", undefined, rules);

    expect(comparableSnapshot(decision.snapshot)).toEqual(comparableSnapshot(baseline));
    expect(decision.trustedSiteMatched).toBe(false);
  });

  it("keeps trusted sites as cached null decisions", () => {
    const prepared = buildPrepared({
      rules: [
        {
          pattern: "github.com",
          locationId: "warsaw",
          enabled: true,
          ruleSeedKey: "rule01",
        },
      ],
      trustedSites: [{ pattern: "github.com", enabled: true }],
    });

    expect(prepared.resolveDecision("github.com")).toEqual({
      snapshot: null,
      trustedSiteMatched: true,
    });
  });

  it("carries Native domain rules as explicit preload bypass patterns", () => {
    const prepared = buildPrepared({
      globalFallbackRule: {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "fallback01",
        authKey: "fallback-auth",
      },
      rules: [
        {
          pattern: "*linkedin.com",
          enabled: true,
          ruleSeedKey: "rule01",
          fingerprintSurfaceOverrides: {
            audio: false,
            canvas: false,
            clientHints: false,
            geolocation: false,
            navigator: false,
            screen: false,
            serviceWorker: false,
            sharedWorker: "native",
            timeLocale: false,
            webGL: false,
            webRTC: false,
          },
        },
      ],
    });

    expect(prepared.getPreloadedEntries().map((entry) => entry.pattern)).toEqual(["*"]);
    expect(prepared.getNativeRulePatterns()).toEqual(["*linkedin.com"]);
    expect(prepared.resolveDecision("www.linkedin.com").snapshot).toBeNull();
  });

  it("matches rule inheritance from the Default Rule", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const rules = [
      {
        pattern: "shop.example.com",
        locationId: "",
        enabled: true,
        ruleSeedKey: "rule01",
      },
    ];
    const fallback = {
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "glb123",
      authKey: "fa11bac0",
    };
    const prepared = buildPrepared({ rules, globalFallbackRule: fallback });

    const decision = prepared.resolveDecision("shop.example.com");
    const baseline = resolveBaseline("shop.example.com", undefined, rules, fallback);

    expect(comparableSnapshot(decision.snapshot)).toEqual(comparableSnapshot(baseline));
    expect(decision.snapshot?.authKey).toBeUndefined();
    expect(decision.snapshot?.geo.latitude).toBe(52);
  });

  it("matches rule inheritance from a Firefox container assignment", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const rules = [
      {
        pattern: "shop.example.com",
        locationId: "",
        enabled: true,
        ruleSeedKey: "rule01",
      },
    ];
    const assignments = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: "berlin",
        enabled: true,
        ruleSeedKey: "cseed1",
        authKey: "c0ffee11",
      },
    ];
    const prepared = buildPrepared({ rules, containerAssignments: assignments });

    const decision = prepared.resolveDecision(
      "shop.example.com",
      "firefox-container-1",
    );
    const baseline = resolveBaseline(
      "shop.example.com",
      "firefox-container-1",
      rules,
      undefined,
      assignments,
    );

    expect(comparableSnapshot(decision.snapshot)).toEqual(comparableSnapshot(baseline));
    expect(decision.snapshot?.authKey).toBeUndefined();
    expect(decision.snapshot?.geo.latitude).toBe(53);
  });

  it("matches the resolver for a presetless container that keeps its own identity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const fallback = {
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "glb123",
      authKey: "fa11bac0",
    };
    const assignments = [
      {
        cookieStoreId: "firefox-container-1",
        enabled: true,
        ruleSeedKey: "cseed1",
        authKey: "c0ffee11",
      },
    ];
    const prepared = buildPrepared({
      globalFallbackRule: fallback,
      containerAssignments: assignments,
    });

    const decision = prepared.resolveDecision(
      "shop.example.com",
      "firefox-container-1",
    );
    const baseline = resolveBaseline(
      "shop.example.com",
      "firefox-container-1",
      [],
      fallback,
      assignments,
    );

    expect(comparableSnapshot(decision.snapshot)).toEqual(comparableSnapshot(baseline));
    // Inherits the Default Rule location, but keeps its own identity/authKey.
    expect(decision.snapshot?.geo.latitude).toBe(52);
    expect(decision.snapshot?.authKey).toBe("c0ffee11");

    const fallbackOnly = prepared.resolveDecision("shop.example.com");
    expect(decision.snapshot?.fingerprint?.canvasNoiseSeed).not.toBe(
      fallbackOnly.snapshot?.fingerprint?.canvasNoiseSeed,
    );
  });

  it("preserves container authKey in Firefox window seed state", () => {
    const assignments = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: "berlin",
        enabled: true,
        ruleSeedKey: "cseed1",
        authKey: "c0ffee11",
      },
    ];
    const prepared = buildPrepared({ containerAssignments: assignments });

    expect(
      prepared.getFxWindowSeed("firefox-container-1")?.containerState?.authKey,
    ).toBe("c0ffee11");
  });
});
