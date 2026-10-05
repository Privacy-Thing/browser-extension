import { resolveFxSeedForHost } from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPreparedDecisions } from "@/background/prepared-runtime-decisions";
import { resolveProfileSnapshot } from "@/background/rules/resolver";
import type { ProfileSnapshotOptions } from "@/background/rules/resolver-options";
import type { HostProtectionPause } from "@/shared/host-protection-pause";
import type {
  ContainerAssignment,
  ControlState,
  DomainRule,
  GlobalFallbackRule,
  Location,
  RuntimeSnapshot,
  TrustedSite,
} from "@/shared/types";
import type { WorkerPolicyExceptions } from "@/shared/worker-policy-exceptions";

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
  workerPolicyExceptions = {},
  hostPauses = [],
  locations = profiles,
  rules = [],
  trustedSites = [],
  globalFallbackRule,
  containerAssignments = [],
  fingerprintEnabled = true,
  domainFencing = false,
}: {
  workerPolicyExceptions?: WorkerPolicyExceptions;
  hostPauses?: HostProtectionPause[];
  locations?: Location[];
  rules?: DomainRule[];
  trustedSites?: TrustedSite[];
  globalFallbackRule?: GlobalFallbackRule;
  containerAssignments?: ContainerAssignment[];
  fingerprintEnabled?: boolean;
  domainFencing?: boolean;
}) =>
  createPreparedDecisions({
    workerPolicyExceptions,
    hostPauses,
    rules,
    trustedSites,
    locations,
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

const baselineOptions = ({
  hostname,
  cookieStoreId,
  rules,
  globalFallbackRule,
  containerAssignments,
  trustedSites,
  domainFencingEnabled,
}: {
  hostname: string;
  cookieStoreId: string | undefined;
  rules: DomainRule[];
  globalFallbackRule: GlobalFallbackRule | undefined;
  containerAssignments: ContainerAssignment[];
  trustedSites: TrustedSite[];
  domainFencingEnabled: boolean;
}): ProfileSnapshotOptions => ({
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
  sharedWorkerHandlingMode: "native",
  trustedSites,
  watchPositionDelay: [60, 500],
});

describe("createPreparedDecisions", () => {
  it.each(["warsaw", "invalid"])(
    "isolates invalid rules and containers with fallback %s",
    (fallbackId) => {
      const rules: DomainRule[] = [
        {
          pattern: "bad.test",
          locationId: "invalid",
          enabled: true,
          ruleSeedKey: "bad001",
        },
        {
          pattern: "good.test",
          locationId: "berlin",
          enabled: true,
          ruleSeedKey: "good01",
        },
        { pattern: "inherited.test", enabled: true, ruleSeedKey: "inhr01" },
      ];
      const prepared = buildPrepared({
        locations: [...profiles, buildProfile("invalid", "Mars/Olympus", 99)],
        rules,
        globalFallbackRule: {
          enabled: true,
          locationId: fallbackId,
          ruleSeedKey: "glob01",
        },
        containerAssignments: [
          {
            cookieStoreId: "bad-container",
            locationId: "invalid",
            ruleSeedKey: "badc01",
          },
          {
            cookieStoreId: "good-container",
            locationId: "berlin",
            ruleSeedKey: "goodc1",
          },
        ],
        domainFencing: true,
      });
      expect(prepared.resolveDecision("bad.test").snapshot).toBeNull();
      expect(prepared.resolveDecision("good.test").snapshot?.date.timeZone).toBe(
        "Europe/Berlin",
      );
      expect(
        prepared.resolveDecision("other.test", "bad-container").snapshot,
      ).toBeNull();
      expect(
        prepared.resolveDecision("inherited.test", "bad-container").snapshot,
      ).toBeNull();
      expect(
        prepared.resolveDecision("inherited.test", "good-container").snapshot?.date
          .timeZone,
      ).toBe("Europe/Berlin");
      expect(
        prepared.resolveDecision("other.test", "good-container").snapshot?.date
          .timeZone,
      ).toBe("Europe/Berlin");
      const fallbackZone = fallbackId === "warsaw" ? "Europe/Warsaw" : undefined;
      expect(prepared.resolveDecision("other.test").snapshot?.date.timeZone).toBe(
        fallbackZone,
      );
      expect(prepared.resolveDecision("inherited.test").snapshot?.date.timeZone).toBe(
        fallbackZone,
      );
      expect(
        prepared.getPreloadedEntries().find((entry) => entry.pattern === "bad.test"),
      ).toBeUndefined();
      expect(
        prepared.getPreloadedEntries().find((entry) => entry.pattern === "good.test")
          ?.snapshot.date.timeZone,
      ).toBe("Europe/Berlin");
      expect(prepared.getNativeRulePatterns()).toContain("bad.test");
      const seed = prepared.getFxWindowSeed("bad-container");
      expect(seed?.containerState).toBeNull();
      const inheritedState = seed?.containerEntries?.find(
        (entry) => entry.pattern === "inherited.test",
      )?.state;
      expect(inheritedState).toMatchObject({
        geo: null,
        timeLocale: null,
        fingerprint: null,
      });
      expect(seed?.nativeRulePatterns).toContain("bad.test");
      expect(seed?.entries.some((entry) => entry.pattern === "good.test")).toBe(true);
      const goodSeed = prepared.getFxWindowSeed("good-container");
      expect(
        resolveFxSeedForHost("inherited.test", goodSeed!)?.timeLocale?.timeZone,
      ).toBe("Europe/Berlin");
      expect(resolveFxSeedForHost("bad.test", goodSeed!)).toBeNull();
      expect(resolveFxSeedForHost("inherited.test", seed!)?.timeLocale).toBeNull();
    },
  );

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
    const baseline = resolveProfileSnapshot(
      baselineOptions({
        hostname: "shop.example.com",
        cookieStoreId: undefined,
        rules: rules,
        globalFallbackRule: undefined,
        containerAssignments: [],
        trustedSites: [],
        domainFencingEnabled: false,
      }),
    );

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
    const baseline = resolveProfileSnapshot(
      baselineOptions({
        hostname: "shop.example.com",
        cookieStoreId: undefined,
        rules: rules,
        globalFallbackRule: fallback,
        containerAssignments: [],
        trustedSites: [],
        domainFencingEnabled: false,
      }),
    );

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
    const baseline = resolveProfileSnapshot(
      baselineOptions({
        hostname: "shop.example.com",
        cookieStoreId: "firefox-container-1",
        rules: rules,
        globalFallbackRule: undefined,
        containerAssignments: assignments,
        trustedSites: [],
        domainFencingEnabled: false,
      }),
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
    const baseline = resolveProfileSnapshot(
      baselineOptions({
        hostname: "shop.example.com",
        cookieStoreId: "firefox-container-1",
        rules: [],
        globalFallbackRule: fallback,
        containerAssignments: assignments,
        trustedSites: [],
        domainFencingEnabled: false,
      }),
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
    const baseline = resolveProfileSnapshot(
      baselineOptions({
        hostname: "shop.example.com",
        cookieStoreId: undefined,
        rules: [],
        globalFallbackRule: fallback,
        containerAssignments: [],
        trustedSites: [],
        domainFencingEnabled: true,
      }),
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

  it("caches S3 tenants independently in both browser preload catalogs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const prepared = buildPrepared({
      domainFencing: true,
      globalFallbackRule: {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "glb123",
        authKey: "fa11bac0",
      },
    });
    const alice = prepared.resolveDecision("alice.s3.amazonaws.com");
    const sub = prepared.resolveDecision("assets.alice.s3.amazonaws.com");
    const bob = prepared.resolveDecision("bob.s3.amazonaws.com");
    expect(alice.snapshot?.fingerprint?.canvasNoiseSeed).toEqual(expect.any(Number));
    expect(comparableSnapshot(sub.snapshot)).toEqual(
      comparableSnapshot(alice.snapshot),
    );
    expect(bob.snapshot?.fingerprint?.canvasNoiseSeed).not.toBe(
      alice.snapshot?.fingerprint?.canvasNoiseSeed,
    );
    expect(prepared.getPreloadedEntries().map((row) => row.pattern)).toEqual(
      expect.arrayContaining(["*alice.s3.amazonaws.com", "*bob.s3.amazonaws.com"]),
    );
    expect(prepared.getPreloadedEntries().map((row) => row.pattern)).not.toContain(
      "*amazonaws.com",
    );
  });

  it("keeps the unfenced Default Rule fingerprint on the shared star template", () => {
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
    const star = prepared.getPreloadedEntries().find((entry) => entry.pattern === "*");
    expect(star?.snapshot.fingerprint?.canvasNoiseSeed).toEqual(expect.any(Number));
    expect(star?.snapshot.locale.timeZone).toBe("Europe/Warsaw");

    prepared.resolveDecision("shop.example.com");
    const entries = prepared.getPreloadedEntries();
    expect(entries.map((entry) => entry.pattern)).toEqual(["*", "*example.com"]);
    const starAfter = entries.find((entry) => entry.pattern === "*");
    const fenced = entries.find((entry) => entry.pattern === "*example.com");
    expect(starAfter?.snapshot.fingerprint?.canvasNoiseSeed).toBe(
      star?.snapshot.fingerprint?.canvasNoiseSeed,
    );
    expect(fenced?.snapshot.fingerprint?.canvasNoiseSeed).not.toBe(
      star?.snapshot.fingerprint?.canvasNoiseSeed,
    );
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
    expect(star?.state.fingerprint?.canvasNoiseSeed).toEqual(expect.any(Number));
    expect(star?.state.fingerprint?.canvasNoiseSeed).not.toBe(
      example.snapshot?.fingerprint?.canvasNoiseSeed,
    );
    expect(fenced?.state.fingerprint?.canvasNoiseSeed).toBe(
      example.snapshot?.fingerprint?.canvasNoiseSeed,
    );

    const otherFromCatalog = resolveFxSeedForHost("news.other.org", catalog!);
    expect(otherFromCatalog?.fingerprint?.canvasNoiseSeed).toBe(
      star?.state.fingerprint?.canvasNoiseSeed,
    );
    expect(otherFromCatalog?.fingerprint?.canvasNoiseSeed).not.toBe(
      example.snapshot?.fingerprint?.canvasNoiseSeed,
    );

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

  it("keeps container fenced rows when Default Rule is disabled", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
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
      containerAssignments: assignments,
      domainFencing: true,
    });
    const decision = prepared.resolveDecision(
      "shop.example.com",
      "firefox-container-1",
    );
    expect(decision.fencesIdentity).toBe(true);
    expect(decision.snapshot?.authKey).toBe("c0ffee11");
    expect(decision.snapshot?.fingerprint?.canvasNoiseSeed).toEqual(expect.any(Number));

    const containerSeed = prepared.getFxWindowSeed(
      "firefox-container-1",
      "shop.example.com",
    );
    expect(containerSeed).not.toBeNull();
    expect(
      containerSeed?.entries.find((entry) => entry.pattern === "*"),
    ).toBeUndefined();
    const fenced = containerSeed?.entries.find(
      (entry) => entry.pattern === "*example.com",
    );
    expect(fenced?.state.authKey).toBe("c0ffee11");
    expect(fenced?.state.fingerprint?.canvasNoiseSeed).toBe(
      decision.snapshot?.fingerprint?.canvasNoiseSeed,
    );
    expect(containerSeed?.containerState?.fingerprint?.canvasNoiseSeed).toEqual(
      expect.any(Number),
    );
    expect(containerSeed?.containerState?.fingerprint?.canvasNoiseSeed).not.toBe(
      decision.snapshot?.fingerprint?.canvasNoiseSeed,
    );

    const fromCatalog = resolveFxSeedForHost("shop.example.com", containerSeed!);
    expect(fromCatalog?.fingerprint?.canvasNoiseSeed).toBe(
      decision.snapshot?.fingerprint?.canvasNoiseSeed,
    );
    expect(fromCatalog?.authKey).toBe("c0ffee11");
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
    const baseline = resolveProfileSnapshot(
      baselineOptions({
        hostname: "shop.example.com",
        cookieStoreId: undefined,
        rules: rules,
        globalFallbackRule: undefined,
        containerAssignments: [],
        trustedSites: [],
        domainFencingEnabled: false,
      }),
    );

    expect(decision.fencesIdentity).toBeFalsy();
    expect(comparableSnapshot(decision.snapshot)).toEqual(comparableSnapshot(baseline));
  });
});

describe("host protection pause", () => {
  it("expires without rebuilding the prepared catalog and preserves independent hosts and containers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const pause = { hostname: "h.example", id: "pause-1", expiresAt: 1100 };
    const fallback = {
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "fallback",
      authKey: "nonce",
    };
    const prepared = buildPrepared({
      hostPauses: [pause],
      globalFallbackRule: fallback,
      containerAssignments: [
        {
          cookieStoreId: "firefox-container-1",
          locationId: "berlin",
          ruleSeedKey: "container",
          authKey: "container-nonce",
        },
      ],
    });
    expect(prepared.resolveDecision("h.example")).toEqual({
      snapshot: null,
      trustedSiteMatched: false,
      hostPause: pause,
    });
    expect(
      prepared.resolveDecision("h.example", "firefox-container-1").snapshot,
    ).toBeNull();
    expect(
      prepared.resolveDecision("k.example", "firefox-container-1").snapshot?.geo
        .latitude,
    ).toBe(53);
    expect(prepared.resolveDecision("sub.h.example").snapshot?.geo.latitude).toBe(52);
    expect(
      prepared.resolveDecision("h.example", undefined, false).snapshot?.geo.latitude,
    ).toBe(52);
    vi.setSystemTime(1100);
    expect(prepared.resolveDecision("h.example").snapshot?.geo.latitude).toBe(52);
    expect(
      prepared.resolveDecision("h.example", "firefox-container-1").snapshot?.geo
        .latitude,
    ).toBe(53);
    expect(prepared.getPreloadedEntries().length).toBeGreaterThan(0);
    expect(fallback.enabled).toBe(true);
  });

  it("keeps Trusted Sites and global off above the pause", () => {
    const hostPauses = [{ hostname: "h.example", id: "session", expiresAt: null }];
    const trusted = buildPrepared({
      hostPauses,
      trustedSites: [{ pattern: "h.example", enabled: true }],
    });
    expect(trusted.resolveDecision("h.example")).toEqual({
      snapshot: null,
      trustedSiteMatched: true,
    });
    const prepared = createPreparedDecisions({
      hostPauses,
      rules: [],
      trustedSites: [],
      locations: profiles,
      controlState: { panicMode: true },
      debugMode: false,
      watchPositionDelay: [60, 500],
      fingerprintEnabled: true,
      featureFlags: { temporalApi: false, domainFencing: false },
      sharedWorkerHandlingMode: "native",
      sharedSpoofing: undefined,
      browserFingerprintSource: undefined,
      globalFallbackRule: undefined,
      containerAssignments: [],
    });
    expect(prepared.resolveDecision("h.example")).toEqual({
      snapshot: null,
      trustedSiteMatched: false,
    });
  });
});

it("saved worker exceptions preserve each fenced container identity and Firefox early state", () => {
  const hostname = "h.example.test";
  const containerAssignments: ContainerAssignment[] = [
    {
      cookieStoreId: "firefox-container-1",
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "seed01",
      authKey: "auth0001",
    },
    {
      cookieStoreId: "firefox-container-2",
      enabled: true,
      locationId: "berlin",
      ruleSeedKey: "seed02",
      authKey: "auth0002",
    },
  ];
  const options = { containerAssignments, domainFencing: true };
  const baseline = buildPrepared(options);
  const adjusted = buildPrepared({
    ...options,
    workerPolicyExceptions: { [hostname]: { serviceWorker: false } },
  });
  for (const assignment of containerAssignments) {
    const original = baseline.resolveDecision(
      hostname,
      assignment.cookieStoreId,
    ).snapshot!;
    const next = adjusted.resolveDecision(hostname, assignment.cookieStoreId).snapshot!;
    expect(comparableSnapshot(next)).toEqual(
      comparableSnapshot({ ...original, blockServiceWorkerRegistration: false }),
    );
    const seed = adjusted.getFxWindowSeed(assignment.cookieStoreId, hostname)!;
    const fx = resolveFxSeedForHost(hostname, seed)!;
    expect(fx.blockServiceWorkerRegistration).toBe(false);
    expect(fx.timeLocale?.timeZone).toBe(original.locale.timeZone);
    expect(
      comparableSnapshot(
        adjusted.resolveDecision("k.example.test", assignment.cookieStoreId).snapshot,
      ),
    ).toEqual(
      comparableSnapshot(
        baseline.resolveDecision("k.example.test", assignment.cookieStoreId).snapshot,
      ),
    );
  }
  expect(
    adjusted.resolveDecision(hostname, containerAssignments[0]!.cookieStoreId).snapshot
      ?.authKey,
  ).not.toBe(
    adjusted.resolveDecision(hostname, containerAssignments[1]!.cookieStoreId).snapshot
      ?.authKey,
  );
});
