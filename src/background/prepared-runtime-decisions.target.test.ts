import { resolveFxSeedForHost } from "@privacy-brand/refract-browser/common/firefox-shim-state";
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
  domainFencing = false,
}: {
  rules?: DomainRule[];
  trustedSites?: TrustedSite[];
  globalFallbackRule?: GlobalFallbackRule;
  containerAssignments?: ContainerAssignment[];
  fingerprintEnabled?: boolean;
  domainFencing?: boolean;
}) =>
  createPreparedDecisions({
    rules,
    trustedSites,
    locations: profiles,
    controlState,
    debugMode: false,
    watchPositionDelay: [60, 500],
    fingerprintEnabled,
    featureFlags: { temporalApi: false, domainFencing },
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
  domainFencingEnabled = false,
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
    domainFencingEnabled,
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

  it("fences fallback identities per site when the experiment is on", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const fallback = {
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "glb123",
      authKey: "fa11bac0",
    };
    const prepared = buildPrepared({
      globalFallbackRule: fallback,
      domainFencing: true,
    });
    const first = prepared.resolveDecision("shop.example.com");
    const second = prepared.resolveDecision("news.other.org");
    const baseline = resolveBaseline(
      "shop.example.com",
      undefined,
      [],
      fallback,
      [],
      [],
      true,
    );

    expect(first.fencesIdentity).toBe(true);
    expect(first.snapshot?.locale.timeZone).toBe(baseline?.locale.timeZone);
    expect(first.snapshot?.authKey).toBe("fa11bac0");
    expect(comparableSnapshot(first.snapshot)).toEqual(comparableSnapshot(baseline));
    expect(first.snapshot?.fingerprint?.canvasNoiseSeed).not.toBe(
      second.snapshot?.fingerprint?.canvasNoiseSeed,
    );
    expect(first.snapshot?.fingerprint?.clientHints?.fullVersionList).not.toEqual(
      second.snapshot?.fingerprint?.clientHints?.fullVersionList,
    );
    const sameSite = prepared.resolveDecision("www.example.com");
    expect(sameSite.snapshot?.fingerprint?.canvasNoiseSeed).toBe(
      first.snapshot?.fingerprint?.canvasNoiseSeed,
    );
  });

  it("omits generated fingerprint on the shared star template", () => {
    const fallback = {
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "glb123",
      authKey: "fa11bac0",
    };
    const prepared = buildPrepared({
      globalFallbackRule: fallback,
      domainFencing: true,
    });
    const star = prepared.getPreloadedEntries().find((entry) => entry.pattern === "*");
    expect(star?.snapshot.fingerprint).toBeUndefined();
    expect(star?.snapshot.locale.timeZone).toBe("Europe/Warsaw");

    prepared.resolveDecision("shop.example.com");
    expect(prepared.getPreloadedEntries().map((entry) => entry.pattern)).toEqual([
      "*",
      "*example.com",
    ]);
    expect(
      prepared.getPreloadedEntries().find((entry) => entry.pattern === "*")?.snapshot
        .fingerprint,
    ).toBeUndefined();
  });

  it("does not let a fenced catalog row poison other sites", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const fallback = {
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "glb123",
      authKey: "fa11bac0",
    };
    const prepared = buildPrepared({
      globalFallbackRule: fallback,
      domainFencing: true,
    });
    const example = prepared.resolveDecision("shop.example.com");
    const catalog = prepared.getFxWindowSeed(undefined, "shop.example.com");
    expect(catalog).not.toBeNull();
    const star = catalog?.entries.find((entry) => entry.pattern === "*");
    const fenced = catalog?.entries.find((entry) => entry.pattern === "*example.com");
    expect(star?.state.fingerprint).toBeNull();
    expect(fenced?.state.fingerprint?.canvasNoiseSeed).toBe(
      example.snapshot?.fingerprint?.canvasNoiseSeed,
    );

    const otherFromCatalog = resolveFxSeedForHost("news.other.org", catalog!);
    expect(otherFromCatalog?.fingerprint?.canvasNoiseSeed).not.toBe(
      example.snapshot?.fingerprint?.canvasNoiseSeed,
    );
    expect(otherFromCatalog?.fingerprint).toBeNull();

    const other = prepared.resolveDecision("news.other.org");
    expect(other.snapshot?.fingerprint?.canvasNoiseSeed).not.toBe(
      example.snapshot?.fingerprint?.canvasNoiseSeed,
    );
  });

  it("keeps container fenced rows on the container identity", () => {
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
        locationId: "berlin",
        enabled: true,
        ruleSeedKey: "cseed1",
        authKey: "c0ffee11",
      },
    ];
    const prepared = buildPrepared({
      globalFallbackRule: fallback,
      containerAssignments: assignments,
      domainFencing: true,
    });
    const fallbackDecision = prepared.resolveDecision("shop.example.com");
    const containerDecision = prepared.resolveDecision(
      "shop.example.com",
      "firefox-container-1",
    );
    expect(containerDecision.snapshot?.authKey).toBe("c0ffee11");
    expect(containerDecision.snapshot?.fingerprint?.canvasNoiseSeed).not.toBe(
      fallbackDecision.snapshot?.fingerprint?.canvasNoiseSeed,
    );

    const containerSeed = prepared.getFxWindowSeed(
      "firefox-container-1",
      "shop.example.com",
    );
    const fenced = containerSeed?.entries.find(
      (entry) => entry.pattern === "*example.com",
    );
    expect(fenced?.state.authKey).toBe("c0ffee11");
    expect(fenced?.state.fingerprint?.canvasNoiseSeed).toBe(
      containerDecision.snapshot?.fingerprint?.canvasNoiseSeed,
    );
    expect(fenced?.state.fingerprint?.canvasNoiseSeed).not.toBe(
      fallbackDecision.snapshot?.fingerprint?.canvasNoiseSeed,
    );
  });

  it("does not fence explicit domain rules", () => {
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
    const prepared = buildPrepared({ rules, domainFencing: true });
    const decision = prepared.resolveDecision("shop.example.com");
    const baseline = resolveBaseline("shop.example.com", undefined, rules);

    expect(decision.fencesIdentity).toBeFalsy();
    expect(comparableSnapshot(decision.snapshot)).toEqual(comparableSnapshot(baseline));
  });
});
