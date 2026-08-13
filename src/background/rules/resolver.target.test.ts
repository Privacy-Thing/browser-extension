import { afterEach, describe, expect, it, vi } from "vitest";

import {
  matchTrustedSite,
  resolveActiveIdentity as resolveActiveIdentityBase,
  resolveProfileSnapshot as resolveProfileSnapshotBase,
  toRuleRuntimeSnapshot as toRuleRuntimeSnapshotBase,
  toRuntimeSnapshot as toRuntimeSnapshotBase,
} from "@/background/rules/resolver";
import type {
  ProfileSnapshotOptions,
  RuleSnapshotOptions,
  ToRuntimeSnapshotOptions,
} from "@/background/rules/resolver-options";
import { getTimeZoneOffsetMinutes } from "@/shared/time-zone-offset";
import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
  SharedSpoofingConfig,
  Location,
  TrustedSite,
} from "@/shared/types";

const SAFE_DATES = [
  {
    label: "winter midday",
    iso: "2026-01-15T12:00:00.000Z",
  },
  {
    label: "summer midday",
    iso: "2026-07-15T12:00:00.000Z",
  },
] as const;

// Desktop Chrome rounds navigator.deviceMemory to a power of two and caps it at 32 GB.
const CHROME_MEMORY_BUCKETS = [2, 4, 8, 16, 32];

/**
 * Asserts a spoofed device shape is statistically realistic: a positive integer
 * core count and a current desktop Chrome deviceMemory bucket.
 */
const expectDeviceShape = (
  fingerprint: { hardwareConcurrency?: number; deviceMemory?: number } | undefined,
): void => {
  expect(typeof fingerprint?.hardwareConcurrency).toBe("number");
  expect(fingerprint?.hardwareConcurrency).toBeGreaterThan(0);
  expect(Number.isInteger(fingerprint?.hardwareConcurrency)).toBe(true);
  if (fingerprint?.deviceMemory !== undefined) {
    expect(CHROME_MEMORY_BUCKETS).toContain(fingerprint.deviceMemory);
    expect(fingerprint.deviceMemory).toBeLessThanOrEqual(32);
  }
};

const buildProfile = (timeZone: string): Location => ({
  id: `profile-${timeZone}`,
  label: timeZone,
  latitude: 0,
  longitude: 0,
  accuracy: 25,
  noiseRadius: 50,
  language: "en-US",
  languages: ["en-US", "en"],
  timeZone,
});

const trustedSiteFor = (pattern: string, enabled = true): TrustedSite => ({
  pattern,
  enabled,
});

const withRuleSeeds = (rules: readonly DomainRule[]): DomainRule[] =>
  rules.map((rule, index) => ({
    ...rule,
    ruleSeedKey: rule.ruleSeedKey ?? `seed${index.toString(36).padStart(2, "0")}`,
  }));

const withContainerSeeds = (
  assignments: readonly ContainerAssignment[],
): ContainerAssignment[] =>
  assignments.map((assignment, index) => ({
    ...assignment,
    ruleSeedKey:
      assignment.ruleSeedKey ??
      `cseed${index.toString(36).padStart(1, "0")}`.slice(0, 6),
  }));

const withFallbackSeed = (
  globalFallbackRule?: GlobalFallbackRule,
): GlobalFallbackRule | undefined =>
  globalFallbackRule
    ? {
        ...globalFallbackRule,
        ruleSeedKey: globalFallbackRule.ruleSeedKey ?? "glb123",
      }
    : undefined;

const NATIVE_FP_SURFACES: SharedSpoofingConfig = {
  canvas: false,
  webGL: false,
  audio: false,
  navigator: false,
  screen: false,
  clientHints: false,
  webRTC: false,
};

const resolveActiveIdentity = (
  hostname: string,
  cookieStoreId: string | undefined,
  rules: readonly DomainRule[],
  containerAssignments: readonly ContainerAssignment[] = [],
) =>
  resolveActiveIdentityBase(
    hostname,
    cookieStoreId,
    withRuleSeeds(rules),
    withContainerSeeds(containerAssignments),
  );

/**
 * Positional adapters over the options-object SUTs, kept so the assertions in
 * this file stay byte-identical across that signature change — they are the
 * evidence that the refactor preserved behaviour, so they must not be co-edited
 * with it.
 *
 * Converting these call sites (and retiring the pin noted below) is tracked
 * separately; see the "Dług czytelności kodu" document in Notion.
 */
const toRuntimeSnapshot = (
  profile: ToRuntimeSnapshotOptions["profile"],
  _retiredProfiles: readonly unknown[],
  debugMode: boolean,
  watchPositionDelay: [number, number],
  fingerprintEnabled: boolean,
  sharedSpoofing?: SharedSpoofingConfig,
  ruleOverrides?: ToRuntimeSnapshotOptions["ruleOverrides"],
  ruleSeedKey?: string,
  browserFingerprintSource?: ToRuntimeSnapshotOptions["browserFingerprintSource"],
  authKey?: string,
  sharedWorkerHandlingMode: ToRuntimeSnapshotOptions["sharedWorkerHandlingMode"] = "native",
) =>
  toRuntimeSnapshotBase({
    authKey,
    browserFingerprintSource,
    fingerprintEnabled,
    debugMode,
    profile,
    ruleOverrides,
    ruleSeedKey,
    sharedSpoofing,
    sharedWorkerHandlingMode,
    watchPositionDelay,
  });

const toRuleRuntimeSnapshot = (
  rule: RuleSnapshotOptions["rule"],
  profile: RuleSnapshotOptions["profile"],
  _retiredProfiles: readonly unknown[],
  debugMode: boolean,
  watchPositionDelay: [number, number],
  fingerprintEnabled: boolean,
  sharedSpoofing?: SharedSpoofingConfig,
  browserFingerprintSource?: RuleSnapshotOptions["browserFingerprintSource"],
  sharedWorkerHandlingMode: RuleSnapshotOptions["sharedWorkerHandlingMode"] = "native",
) =>
  toRuleRuntimeSnapshotBase({
    browserFingerprintSource,
    fingerprintEnabled,
    debugMode,
    profile,
    rule,
    sharedSpoofing,
    sharedWorkerHandlingMode,
    watchPositionDelay,
  });

const resolveProfileSnapshot = (
  hostname: string,
  cookieStoreId: string | undefined,
  rules: readonly DomainRule[],
  profiles: readonly Location[],
  _retiredProfiles: readonly unknown[] = [],
  containerAssignments: readonly ContainerAssignment[] = [],
  debugMode = false,
  watchPositionDelay: [number, number] = [60, 500],
  // Preserve the historical location-only fixtures after the global switch
  // became the real master gate. Master-off behavior uses the options-object
  // SUT directly in its dedicated regression.
  fingerprintEnabled = false,
  sharedSpoofing?: SharedSpoofingConfig,
  browserFingerprintSource?: ProfileSnapshotOptions["browserFingerprintSource"],
  globalFallbackRule?: GlobalFallbackRule,
  trustedSites: readonly TrustedSite[] = [],
) =>
  resolveProfileSnapshotBase({
    browserFingerprintSource,
    fingerprintEnabled: true,
    containerAssignments: withContainerSeeds(containerAssignments),
    cookieStoreId,
    debugMode,
    globalFallbackRule: withFallbackSeed(globalFallbackRule),
    hostname,
    profiles,
    rules: withRuleSeeds(rules),
    // The base function no longer defaults this; `native` reproduces the
    // behaviour the assertions below were written against.
    sharedWorkerHandlingMode: "native",
    sharedSpoofing: fingerprintEnabled
      ? sharedSpoofing
      : { ...sharedSpoofing, ...NATIVE_FP_SURFACES },
    trustedSites,
    watchPositionDelay,
  });

const getUtcOffsetMinutes = (timeZone: string, epochMs: number): number => {
  return getTimeZoneOffsetMinutes(timeZone, epochMs);
};

const pickComparisonTimeZone = (epochMs: number): string => {
  const localOffsetMinutes = new Date(epochMs).getTimezoneOffset();
  const candidates = [
    "America/New_York",
    "Europe/Warsaw",
    "Asia/Tokyo",
    "Pacific/Auckland",
  ];

  const match = candidates.find(
    (timeZone) => getUtcOffsetMinutes(timeZone, epochMs) !== localOffsetMinutes,
  );

  if (!match) {
    throw new Error("Unable to find a comparison timezone with a different UTC offset");
  }

  return match;
};

describe("toRuntimeSnapshot date offset diagnostics", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(SAFE_DATES)(
    "tracks a delta against Date-based local offset, not a standalone target offset (%s)",
    ({ iso }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(iso));

      const epochMs = Date.now();
      const localOffsetMinutes = new Date(epochMs).getTimezoneOffset();
      const comparisonTimeZone = pickComparisonTimeZone(epochMs);
      const targetOffsetMinutes = getUtcOffsetMinutes(comparisonTimeZone, epochMs);
      const snapshot = toRuntimeSnapshot(
        buildProfile(comparisonTimeZone),
        [],
        false,
        [60, 500],
        false,
      );

      expect(snapshot.date.timeZone).toBe(comparisonTimeZone);
      expect(snapshot.date.baseEpochMs).toBe(epochMs);
      expect(snapshot.date.offsetMs).toBe(
        (localOffsetMinutes - targetOffsetMinutes) * 60_000,
      );
      expect(snapshot.date.offsetMs === -targetOffsetMinutes * 60_000).toBe(
        localOffsetMinutes === 0,
      );
    },
  );
});

describe("toRuntimeSnapshot SharedWorker compatibility mode", () => {
  it("defaults SharedWorkers to native compatibility and emits opt-out when disabled", () => {
    const defaultSnapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
    );
    const optOutSnapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "spoof",
    );

    expect(defaultSnapshot.sharedWorkerHandlingMode).toBe("native");
    expect(defaultSnapshot.sharedWorkerCompatibilityMode).toBeUndefined();
    expect(optOutSnapshot.sharedWorkerHandlingMode).toBe("spoof");
    expect(optOutSnapshot.sharedWorkerCompatibilityMode).toBe(false);
  });

  it("resolves SharedWorker handling with rule, shared spoofing, preference precedence", () => {
    const preferenceSnapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "strict",
    );
    const sharedSpoofingSnapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      { sharedWorker: "spoof" },
      undefined,
      undefined,
      undefined,
      undefined,
      "strict",
    );
    const ruleOverrideSnapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      { sharedWorker: "spoof" },
      { sharedWorker: "native" },
      undefined,
      undefined,
      undefined,
      "strict",
    );

    expect(preferenceSnapshot.sharedWorkerHandlingMode).toBe("strict");
    expect(sharedSpoofingSnapshot.sharedWorkerHandlingMode).toBe("strict");
    expect(ruleOverrideSnapshot.sharedWorkerHandlingMode).toBe("native");
  });
});

describe("toRuntimeSnapshot New York offset handling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes the shifted clock delta against the target getTimezoneOffset contract", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T06:55:53.000Z"));

    const epochMs = Date.now();
    const snapshot = toRuntimeSnapshot(
      buildProfile("America/New_York"),
      [],
      false,
      [60, 500],
      false,
    );
    const localOffsetMinutes = new Date(epochMs).getTimezoneOffset();
    const targetOffsetMinutes = getUtcOffsetMinutes("America/New_York", epochMs);

    expect(targetOffsetMinutes).toBe(240);
    expect(snapshot.date.offsetMs).toBe(
      (localOffsetMinutes - targetOffsetMinutes) * 60_000,
    );
  });
});

describe("toRuntimeSnapshot locale integration", () => {
  it("derives English-first runtime locale when the location prefers English content", () => {
    const snapshot = toRuntimeSnapshot(
      {
        ...buildProfile("Europe/Warsaw"),
        language: "pl",
        languages: ["pl", "en-US"],
        preferEnglishContent: true,
      },
      [],
      false,
      [60, 500],
      false,
    );

    expect(snapshot.locale).toMatchObject({
      language: "en",
      languages: ["en", "pl"],
      acceptLanguage: "en,pl;q=0.9",
      formattingLanguage: "pl",
      formattingLanguages: ["pl", "en-US"],
    });
  });
});

describe("resolveProfileSnapshot container priority", () => {
  const locationWarsaw: Location = {
    id: "warsaw",
    label: "Warsaw",
    latitude: 52.2297,
    longitude: 21.0122,
    accuracy: 25,
    noiseRadius: 50,
    language: "pl",
    languages: ["pl"],
    timeZone: "Europe/Warsaw",
  };

  const locationBerlin: Location = {
    id: "berlin",
    label: "Berlin",
    latitude: 52.52,
    longitude: 13.405,
    accuracy: 25,
    noiseRadius: 50,
    language: "de-DE",
    languages: ["de-DE", "de"],
    timeZone: "Europe/Berlin",
  };

  // Calls the base function directly: the positional adapter above pins
  // `sharedWorkerHandlingMode` to "native" and `fingerprintEnabled`
  // to false, so it cannot express this case. Neither member carries a
  // per-parameter default any more, and nothing else asserts that they survive
  // the trip through resolveProfileSnapshot into the snapshot.
  it("threads a strict SharedWorker mode and debugMode into the snapshot", () => {
    const snapshot = resolveProfileSnapshotBase({
      browserFingerprintSource: undefined,
      fingerprintEnabled: true,
      containerAssignments: [],
      cookieStoreId: undefined,
      debugMode: true,
      globalFallbackRule: undefined,
      hostname: "shop.example.com",
      profiles: [locationWarsaw],
      rules: withRuleSeeds([
        { pattern: "shop.example.com", locationId: "warsaw", enabled: true },
      ]),
      sharedSpoofing: undefined,
      sharedWorkerHandlingMode: "strict",
      trustedSites: [],
      watchPositionDelay: [30, 90],
    });

    expect(snapshot?.sharedWorkerHandlingMode).toBe("strict");
    expect(snapshot?.sharedWorkerCompatibilityMode).toBe(false);
    expect(snapshot?.debugMode).toBe(true);
    expect(snapshot?.watchPositionDelay).toEqual([30, 90]);
  });

  it("prefers a matching rule over a container assignment", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [{ pattern: "shop.example.com", locationId: "warsaw", enabled: true }],
      [locationWarsaw, locationBerlin],
      [],
      [{ cookieStoreId: "firefox-container-1", locationId: "berlin" }],
    );

    expect(snapshot?.geo.latitude).toBe(locationWarsaw.latitude);
    expect(snapshot?.locale.language).toBe(locationWarsaw.language);
  });

  it("falls back to a container assignment when no domain rule matches", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [],
      [locationWarsaw, locationBerlin],
      [],
      [{ cookieStoreId: "firefox-container-1", locationId: "berlin" }],
    );

    expect(snapshot?.geo.latitude).toBe(locationBerlin.latitude);
    expect(snapshot?.locale.language).toBe(locationBerlin.language);
  });

  it("skips disabled container assignments so the default rule can win", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [],
      [locationWarsaw, locationBerlin],
      [],
      [{ cookieStoreId: "firefox-container-1", enabled: false, locationId: "berlin" }],
      false,
      [60, 500],
      false,
      undefined,
      undefined,
      {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "glb123",
      },
    );

    expect(snapshot?.geo.latitude).toBe(locationWarsaw.latitude);
    expect(snapshot?.locale.language).toBe(locationWarsaw.language);
  });

  it("ignores container assignments without a location profile so they stay configured but inactive", () => {
    expect(
      resolveActiveIdentity(
        "shop.example.com",
        "firefox-container-1",
        [],
        [
          {
            cookieStoreId: "firefox-container-1",
            fingerprintSurfaceOverrides: { geolocation: false },
          },
        ],
      ),
    ).toBeNull();

    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [],
      [locationWarsaw, locationBerlin],
      [],
      [
        {
          cookieStoreId: "firefox-container-1",
          fingerprintSurfaceOverrides: { geolocation: false },
        },
      ],
      false,
      [60, 500],
      false,
      undefined,
      undefined,
      {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "glb123",
      },
    );

    expect(snapshot?.geo.latitude).toBe(locationWarsaw.latitude);
    expect(snapshot?.locale.language).toBe(locationWarsaw.language);
  });

  it("keeps a container's own fingerprint identity while inheriting the Default Rule location", () => {
    const resolveContainer = (ruleSeedKey: string, authKey?: string) =>
      resolveProfileSnapshot(
        "shop.example.com",
        "firefox-container-1",
        [],
        [locationWarsaw],
        [],
        [
          {
            cookieStoreId: "firefox-container-1",
            ruleSeedKey,
            ...(authKey ? { authKey } : {}),
          },
        ],
        false,
        [60, 500],
        true,
        undefined,
        undefined,
        { enabled: true, locationId: "warsaw", ruleSeedKey: "glb123" },
      );

    const containerA = resolveContainer("ctra01", "autha001");
    const containerB = resolveContainer("ctrb02");
    const fallbackOnly = resolveProfileSnapshot(
      "shop.example.com",
      undefined,
      [],
      [locationWarsaw],
      [],
      [],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      { enabled: true, locationId: "warsaw", ruleSeedKey: "glb123" },
    );

    // Location is inherited from the Default Rule.
    expect(containerA?.geo.latitude).toBe(locationWarsaw.latitude);
    expect(containerA?.locale.language).toBe(locationWarsaw.language);
    // The container surfaces its OWN authKey, read verbatim.
    expect(containerA?.authKey).toBe("autha001");
    // Identity (fingerprint seed) is the container's own, distinct from another
    // container and from the shared Default Rule.
    expect(containerA?.fingerprint?.canvasNoiseSeed).toBeDefined();
    expect(containerA?.fingerprint?.canvasNoiseSeed).not.toBe(
      containerB?.fingerprint?.canvasNoiseSeed,
    );
    expect(containerA?.fingerprint?.canvasNoiseSeed).not.toBe(
      fallbackOnly?.fingerprint?.canvasNoiseSeed,
    );
  });

  it("does not spoof an identity-only container when the Default Rule is off", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [],
      [locationWarsaw],
      [],
      [{ cookieStoreId: "firefox-container-1", ruleSeedKey: "ctra01" }],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      { enabled: false, locationId: "warsaw", ruleSeedKey: "glb123" },
    );

    expect(snapshot).toBeNull();
  });

  it("lets a matching rule without its own preset inherit location from the active container assignment", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [
        {
          pattern: "shop.example.com",
          locationId: "",
          enabled: true,
          ruleSeedKey: "rul001",
        },
      ],
      [locationBerlin],
      [],
      [
        {
          cookieStoreId: "firefox-container-1",
          locationId: "berlin",
          ruleSeedKey: "ctr001",
        },
      ],
    );

    expect(snapshot?.geo.latitude).toBe(locationBerlin.latitude);
    expect(snapshot?.locale.language).toBe(locationBerlin.language);
  });

  it("lets a matching rule without its own preset inherit location from the Default Rule", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [
        {
          pattern: "shop.example.com",
          locationId: "",
          enabled: true,
          ruleSeedKey: "rul001",
        },
      ],
      [locationWarsaw],
      [],
      [{ cookieStoreId: "firefox-container-1", enabled: true }],
      false,
      [60, 500],
      false,
      undefined,
      undefined,
      {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "glb123",
      },
    );

    expect(snapshot?.geo.latitude).toBe(locationWarsaw.latitude);
    expect(snapshot?.locale.language).toBe(locationWarsaw.language);
  });

  it("keeps the container active when its geolocation spoofing is disabled", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [],
      [locationBerlin],
      [],
      [
        {
          cookieStoreId: "firefox-container-1",
          fingerprintSurfaceOverrides: { geolocation: false },
          locationId: "berlin",
          ruleSeedKey: "ctr001",
        },
      ],
      false,
      [60, 500],
      true,
    );

    expect(snapshot).toMatchObject({
      geolocationEnabled: false,
      geo: {
        latitude: locationBerlin.latitude,
        longitude: locationBerlin.longitude,
      },
      locale: {
        language: locationBerlin.language,
        timeZone: locationBerlin.timeZone,
      },
    });
    expect(snapshot?.fingerprint).toBeDefined();
  });

  it("keeps a domain rule active when its geolocation spoofing is disabled", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      undefined,
      [
        {
          pattern: "shop.example.com",
          locationId: "warsaw",
          enabled: true,
          fingerprintSurfaceOverrides: { geolocation: false },
          ruleSeedKey: "rul001",
        },
      ],
      [locationWarsaw],
      [],
      [],
      false,
      [60, 500],
      true,
    );

    expect(snapshot).toMatchObject({
      geolocationEnabled: false,
      geo: {
        latitude: locationWarsaw.latitude,
        longitude: locationWarsaw.longitude,
      },
      locale: {
        language: locationWarsaw.language,
        timeZone: locationWarsaw.timeZone,
      },
    });
    expect(snapshot?.fingerprint).toBeDefined();
  });

  it("applies fingerprint surface overrides from the winning container assignment", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [],
      [locationBerlin],
      [],
      [
        {
          cookieStoreId: "firefox-container-1",
          fingerprintSurfaceOverrides: { canvas: false },
          locationId: "berlin",
          ruleSeedKey: "ctr001",
        },
      ],
      false,
      [0, 1000],
      true,
      {
        canvas: true,
        webGL: true,
        audio: true,
        navigator: true,
        screen: true,
        clientHints: true,
        webRTC: true,
      },
    );

    expect(snapshot?.fingerprint?.spoofingToggles?.canvas).toBe(false);
    expect(snapshot?.fingerprint?.spoofingToggles?.webGL).toBe(true);
  });

  it("returns null when neither a rule nor a container assignment matches", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [],
      [locationWarsaw],
      [],
      [],
    );

    expect(snapshot).toBeNull();
  });

  it("falls back to the global fallback rule when no domain rule or container assignment matches", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [],
      [locationWarsaw],
      [],
      [],
      false,
      [60, 500],
      false,
      undefined,
      undefined,
      {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "glb123",
      },
    );

    expect(snapshot?.geo.latitude).toBe(locationWarsaw.latitude);
    expect(snapshot?.locale.language).toBe(locationWarsaw.language);
  });

  it("resolves fingerprint-only runtime from the global fallback rule without a preset", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      undefined,
      [],
      [locationWarsaw],
      [],
      [],
      false,
      [60, 500],
      true,
      undefined,
      {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        platform: "Win32",
        vendor: "Google Inc.",
        hardwareConcurrency: 8,
        deviceMemory: 16,
      },
      {
        enabled: true,
        ruleSeedKey: "glb123",
        // Persisted at the storage boundary before reaching the resolver.
        authKey: "abcd1234",
      },
    );

    expect(snapshot?.fingerprint).toBeDefined();
    expect(snapshot?.geolocationEnabled).toBe(false);
    expect(snapshot?.timeLocaleEnabled).toBe(false);
    expect(snapshot?.authKey).toBe("abcd1234");
  });

  it("returns null when every effective surface is native", () => {
    const snapshot = resolveProfileSnapshotBase({
      browserFingerprintSource: {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        platform: "Win32",
        vendor: "Google Inc.",
        hardwareConcurrency: 8,
        deviceMemory: 16,
      },
      fingerprintEnabled: true,
      containerAssignments: [],
      cookieStoreId: undefined,
      debugMode: false,
      globalFallbackRule: {
        enabled: true,
        ruleSeedKey: "glb123",
        authKey: "abcd1234",
      },
      hostname: "www.linkedin.com",
      profiles: [],
      rules: [],
      sharedSpoofing: {
        canvas: false,
        webGL: false,
        audio: false,
        navigator: false,
        screen: false,
        clientHints: false,
        webRTC: false,
      },
      sharedWorkerHandlingMode: "native",
      trustedSites: [],
      watchPositionDelay: [60, 500],
    });

    expect(snapshot).toBeNull();
  });

  it("treats the global protection switch as a master runtime gate", () => {
    const snapshot = resolveProfileSnapshotBase({
      browserFingerprintSource: undefined,
      fingerprintEnabled: false,
      containerAssignments: [],
      cookieStoreId: undefined,
      debugMode: false,
      globalFallbackRule: {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "glb123",
        authKey: "abcd1234",
      },
      hostname: "www.linkedin.com",
      profiles: [locationWarsaw],
      rules: [],
      sharedSpoofing: {
        geolocation: true,
        timeLocale: true,
        serviceWorker: true,
      },
      sharedWorkerHandlingMode: "strict",
      trustedSites: [],
      watchPositionDelay: [60, 500],
    });

    expect(snapshot).toBeNull();
  });

  it("enables Temporal only behind the flag and effective Time & Locale", () => {
    const build = (timeLocale: boolean) =>
      resolveProfileSnapshotBase({
        browserFingerprintSource: undefined,
        fingerprintEnabled: true,
        temporalApiEnabled: true,
        containerAssignments: [],
        cookieStoreId: undefined,
        debugMode: false,
        globalFallbackRule: {
          enabled: true,
          locationId: "warsaw",
          ruleSeedKey: "glb123",
          authKey: "abcd1234",
        },
        hostname: "example.com",
        profiles: [locationWarsaw],
        rules: [],
        sharedSpoofing: { timeLocale },
        sharedWorkerHandlingMode: "native",
        trustedSites: [],
        watchPositionDelay: [60, 500],
      });

    expect(build(true)?.temporalApiEnabled).toBe(true);
    expect(build(false)?.temporalApiEnabled).toBeUndefined();
  });

  it("preserves the persisted fallback authKey verbatim and never mints one", () => {
    const resolve = (globalFallbackRule: GlobalFallbackRule | undefined) =>
      resolveProfileSnapshot(
        "shop.example.com",
        undefined,
        [],
        [locationWarsaw],
        [],
        [],
        false,
        [60, 500],
        true,
        undefined,
        {
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
          platform: "Win32",
          vendor: "Google Inc.",
          hardwareConcurrency: 8,
          deviceMemory: 16,
        },
        globalFallbackRule,
      );

    // A persisted authKey is carried through unchanged on every resolve.
    const withKey = { enabled: true, ruleSeedKey: "glb123", authKey: "abcd1234" };
    expect(resolve(withKey)?.authKey).toBe("abcd1234");
    expect(resolve(withKey)?.authKey).toBe(resolve(withKey)?.authKey);

    // Without a persisted authKey, resolution must NOT invent one (no per-call
    // randomness) — the keyed channel is simply unavailable.
    expect(resolve({ enabled: true, ruleSeedKey: "glb123" })?.authKey).toBeUndefined();
  });

  it("returns null for a matching trusted site before domain rules are considered", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      undefined,
      [{ pattern: "shop.example.com", locationId: "warsaw", enabled: true }],
      [locationWarsaw],
      [],
      [],
      false,
      [60, 500],
      false,
      undefined,
      undefined,
      undefined,
      [trustedSiteFor("shop.example.com")],
    );

    expect(snapshot).toBeNull();
  });

  it("returns null for a matching trusted site before the default rule is considered", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      undefined,
      [],
      [locationWarsaw],
      [],
      [],
      false,
      [60, 500],
      false,
      undefined,
      undefined,
      {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "glb123",
      },
      [trustedSiteFor("shop.example.com")],
    );

    expect(snapshot).toBeNull();
  });

  it("prefers the most specific enabled trusted-site pattern", () => {
    expect(
      matchTrustedSite("shop.example.com", [
        trustedSiteFor("*.example.com"),
        trustedSiteFor("shop.example.com"),
        trustedSiteFor("shop.example.com", false),
      ]),
    ).toEqual(trustedSiteFor("shop.example.com"));
  });

  it("keeps the default rule active when its geolocation spoofing is disabled", () => {
    const snapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [],
      [locationWarsaw],
      [],
      [],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      {
        enabled: true,
        fingerprintSurfaceOverrides: { geolocation: false },
        locationId: "warsaw",
        ruleSeedKey: "glb123",
      },
    );

    expect(snapshot).toMatchObject({
      geolocationEnabled: false,
      geo: {
        latitude: locationWarsaw.latitude,
        longitude: locationWarsaw.longitude,
      },
      locale: {
        language: locationWarsaw.language,
        timeZone: locationWarsaw.timeZone,
      },
      date: {
        timeZone: locationWarsaw.timeZone,
      },
    });
    expect(snapshot?.fingerprint).toBeDefined();
  });

  it("derives simple-engine fingerprint seeds from container assignment ruleSeedKey when no rule wins", () => {
    const containerSnapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [],
      [locationBerlin],
      [],
      [
        {
          cookieStoreId: "firefox-container-1",
          locationId: "berlin",
          ruleSeedKey: "ctr001",
        },
      ],
      false,
      [0, 1000],
      true,
    );

    const alternateSnapshot = resolveProfileSnapshot(
      "shop.example.com",
      "firefox-container-1",
      [],
      [locationBerlin],
      [],
      [
        {
          cookieStoreId: "firefox-container-1",
          locationId: "berlin",
          ruleSeedKey: "ctr002",
        },
      ],
      false,
      [0, 1000],
      true,
    );

    expect(containerSnapshot?.fingerprint?.canvasNoiseSeed).toBeDefined();
    expect(containerSnapshot?.fingerprint?.canvasNoiseSeed).not.toBe(
      alternateSnapshot?.fingerprint?.canvasNoiseSeed,
    );
  });
});

describe("resolveActiveIdentity", () => {
  it("reports a rule identity with the rule's seed when a rule matches", () => {
    const identity = resolveActiveIdentity(
      "shop.example.com",
      "firefox-container-1",
      [
        {
          pattern: "shop.example.com",
          locationId: "warsaw",
          enabled: true,
          ruleSeedKey: "rseed1",
        },
      ],
      [
        {
          cookieStoreId: "firefox-container-1",
          locationId: "berlin",
          ruleSeedKey: "cseed1",
        },
      ],
    );

    expect(identity).toMatchObject({
      kind: "rule",
      pattern: "shop.example.com",
      ruleSeedKey: "rseed1",
    });
  });

  it("falls back to the container assignment when no rule matches", () => {
    const identity = resolveActiveIdentity(
      "shop.example.com",
      "firefox-container-1",
      [],
      [
        {
          cookieStoreId: "firefox-container-1",
          locationId: "berlin",
          ruleSeedKey: "cseed1",
        },
      ],
    );

    expect(identity).toEqual(
      expect.objectContaining({
        kind: "container",
        cookieStoreId: "firefox-container-1",
        ruleSeedKey: "cseed1",
      }),
    );
  });

  it("ignores disabled container assignments", () => {
    const identity = resolveActiveIdentity(
      "shop.example.com",
      "firefox-container-1",
      [],
      [{ cookieStoreId: "firefox-container-1", enabled: false, locationId: "berlin" }],
    );

    expect(identity).toBeNull();
  });

  it("returns null without a rule or container match", () => {
    expect(resolveActiveIdentity("shop.example.com", undefined, [], [])).toBeNull();
  });
});

describe("toRuntimeSnapshot browser fingerprint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("omits fingerprint data by default", () => {
    const snapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      false,
    );

    expect(snapshot.fingerprint).toBeUndefined();
  });

  it("builds coherent fingerprint data when enabled", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7204.62 Safari/537.36",
      platform: "Linux x86_64",
      vendor: "Google Inc.",
      hardwareConcurrency: 12,
      deviceMemory: 8,
      userAgentData: {
        brands: [
          { brand: "Not A(Brand", version: "99" },
          { brand: "Google Chrome", version: "139" },
        ],
        mobile: false,
        platform: "Linux",
      },
    });

    const snapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      "seed01",
    );

    expectDeviceShape(snapshot.fingerprint);
    expect(snapshot.fingerprint?.platform).toBe("Linux x86_64");
    expect(snapshot.fingerprint?.vendor).toBe("Google Inc.");
    expect(snapshot.fingerprint?.userAgent).toContain("Chrome/139.0.");
    expect(snapshot.fingerprint?.appVersion).toBe(
      snapshot.fingerprint?.userAgent?.replace(/^Mozilla\//, ""),
    );
    expect(snapshot.fingerprint?.clientHints?.brands).toContainEqual({
      brand: "Google Chrome",
      version: "139",
    });
    expect(snapshot.fingerprint?.clientHints?.fullVersionList?.[1]?.version).toMatch(
      /^139\.0\.\d+\.\d+$/,
    );
  });

  it("uses ruleSeedKey to rotate Chromium full-version surfaces", () => {
    const browserFingerprintSource = {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      platform: "Win32",
      vendor: "Google Inc.",
      hardwareConcurrency: 12,
      deviceMemory: 8,
      userAgentData: {
        brands: [
          { brand: "Google Chrome", version: "147" },
          { brand: "Chromium", version: "147" },
        ],
        fullVersionList: [
          { brand: "Google Chrome", version: "147.0.7727.101" },
          { brand: "Chromium", version: "147.0.7727.101" },
        ],
        mobile: false,
        platform: "Windows",
      },
    };

    const first = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      {
        clientHints: true,
        clientHintsVersionRotation: true,
      },
      undefined,
      "seed01",
      browserFingerprintSource,
    );
    const second = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      {
        clientHints: true,
        clientHintsVersionRotation: true,
      },
      undefined,
      "seed02",
      browserFingerprintSource,
    );

    expect(first.fingerprint?.userAgent).toContain("Chrome/147.0.0.0");
    expect(second.fingerprint?.userAgent).toContain("Chrome/147.0.0.0");
    expect(first.fingerprint?.clientHints?.fullVersionList).not.toEqual(
      second.fingerprint?.clientHints?.fullVersionList,
    );
  });

  it("keeps native Chromium versions when client hints version rotation is disabled", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7204.62 Safari/537.36",
      platform: "Linux x86_64",
      vendor: "Google Inc.",
      hardwareConcurrency: 12,
      deviceMemory: 8,
      userAgentData: {
        brands: [{ brand: "Google Chrome", version: "139" }],
        mobile: false,
        platform: "Linux",
      },
    });

    const snapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      {
        clientHints: true,
        clientHintsVersionRotation: false,
      },
    );

    expect(snapshot.fingerprint?.userAgent).toContain("Chrome/139.0.7204.62");
    expect(snapshot.fingerprint?.appVersion).toContain("Chrome/139.0.7204.62");
    expect(snapshot.fingerprint?.clientHints).toEqual({
      brands: [{ brand: "Google Chrome", version: "139" }],
      fullVersionList: [{ brand: "Google Chrome", version: "139.0.7204.62" }],
      mobile: false,
      platform: "Linux",
    });
  });

  it("prefers high-entropy fullVersionList when reduced Chromium version rotation is disabled", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      platform: "Win32",
      vendor: "Google Inc.",
      hardwareConcurrency: 12,
      deviceMemory: 8,
      userAgentData: {
        brands: [
          { brand: "Google Chrome", version: "147" },
          { brand: "Chromium", version: "147" },
        ],
        mobile: false,
        platform: "Windows",
      },
    });

    const snapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      {
        clientHints: true,
        clientHintsVersionRotation: false,
      },
      undefined,
      "000000",
      {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
        platform: "Win32",
        vendor: "Google Inc.",
        hardwareConcurrency: 12,
        deviceMemory: 8,
        userAgentData: {
          brands: [
            { brand: "Google Chrome", version: "147" },
            { brand: "Chromium", version: "147" },
          ],
          fullVersionList: [
            { brand: "Google Chrome", version: "147.0.7727.101" },
            { brand: "Chromium", version: "147.0.7727.101" },
          ],
          mobile: false,
          platform: "Windows",
        },
      },
    );

    expect(snapshot.fingerprint?.clientHints?.fullVersionList).toEqual([
      { brand: "Google Chrome", version: "147.0.7727.101" },
      { brand: "Chromium", version: "147.0.7727.101" },
    ]);
  });

  it("rotates high-entropy fullVersionList when reduced Chromium version rotation is enabled", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      platform: "Win32",
      vendor: "Google Inc.",
      hardwareConcurrency: 12,
      deviceMemory: 8,
      userAgentData: {
        brands: [
          { brand: "Google Chrome", version: "147" },
          { brand: "Chromium", version: "147" },
        ],
        mobile: false,
        platform: "Windows",
      },
    });

    const snapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      {
        clientHints: true,
        clientHintsVersionRotation: true,
      },
      undefined,
      "000000",
      {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
        platform: "Win32",
        vendor: "Google Inc.",
        hardwareConcurrency: 12,
        deviceMemory: 8,
        userAgentData: {
          brands: [
            { brand: "Google Chrome", version: "147" },
            { brand: "Chromium", version: "147" },
          ],
          fullVersionList: [
            { brand: "Google Chrome", version: "147.0.7727.101" },
            { brand: "Chromium", version: "147.0.7727.101" },
          ],
          mobile: false,
          platform: "Windows",
        },
      },
    );

    expect(snapshot.fingerprint?.userAgent).toContain("Chrome/147.0.0.0");
    expect(snapshot.fingerprint?.clientHints?.fullVersionList).toEqual([
      { brand: "Google Chrome", version: expect.stringMatching(/^147\.0\.\d+\.\d+$/) },
      { brand: "Chromium", version: expect.stringMatching(/^147\.0\.\d+\.\d+$/) },
    ]);
    expect(snapshot.fingerprint?.clientHints?.fullVersionList).not.toEqual([
      { brand: "Google Chrome", version: "147.0.7727.101" },
      { brand: "Chromium", version: "147.0.7727.101" },
    ]);
  });
});

describe("resolveProfileSnapshot hierarchical spoofing toggles", () => {
  const stubNavigator = () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7204.62 Safari/537.36",
      platform: "Linux x86_64",
      vendor: "Google Inc.",
      hardwareConcurrency: 12,
      deviceMemory: 8,
      userAgentData: {
        brands: [
          { brand: "Not A(Brand", version: "99" },
          { brand: "Google Chrome", version: "139" },
        ],
        mobile: false,
        platform: "Linux",
      },
    });
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const location: Location = {
    ...buildProfile("Europe/Warsaw"),
    id: "warsaw-fp",
  };

  const ruleFor = (
    overrides?: DomainRule["fingerprintSurfaceOverrides"],
  ): DomainRule => ({
    pattern: "example.com",
    locationId: location.id,
    enabled: true,
    ruleSeedKey: "abc123",
    ...(overrides !== undefined ? { fingerprintSurfaceOverrides: overrides } : {}),
  });

  it("passes shared experimental config to snapshot fingerprint toggles", () => {
    stubNavigator();

    const experimentalConfig: SharedSpoofingConfig = {
      canvas: false,
      webGL: true,
      audio: true,
      screen: true,
      webRTC: true,
    };

    const snapshot = resolveProfileSnapshot(
      "example.com",
      undefined,
      [ruleFor()],
      [location],
      [],
      [],
      false,
      [60, 500],
      true,
      experimentalConfig,
    );

    expect(snapshot?.fingerprint?.spoofingToggles?.canvas).toBe(false);
    expect(snapshot?.fingerprint?.spoofingToggles?.webGL).toBe(true);
    expect(snapshot?.fingerprint?.spoofingToggles?.audio).toBe(true);
    expect(snapshot?.fingerprint?.spoofingToggles?.navigator).toBe(true);
    expect(snapshot?.fingerprint?.spoofingToggles?.screen).toBe(true);
    expect(snapshot?.fingerprint?.spoofingToggles?.clientHints).toBe(true);
    expect(snapshot?.fingerprint?.spoofingToggles?.battery).toBe(true);
    expect(snapshot?.fingerprint?.spoofingToggles?.webRTC).toBe(true);
  });

  it("global surface disable takes precedence over rule-level override", () => {
    stubNavigator();

    const experimentalConfig: SharedSpoofingConfig = {
      canvas: false,
      webGL: true,
      audio: true,
      screen: true,
      webRTC: true,
    };

    const snapshot = resolveProfileSnapshot(
      "example.com",
      undefined,
      [ruleFor({ canvas: true })],
      [location],
      [],
      [],
      false,
      [60, 500],
      true,
      experimentalConfig,
    );

    // Global surface disable is a hard safety stop — rule override cannot restore it
    expect(snapshot?.fingerprint?.spoofingToggles?.canvas).toBe(false);
  });

  it("rule-level overrides disable a surface independently", () => {
    stubNavigator();

    const experimentalConfig: SharedSpoofingConfig = {
      canvas: true,
      webGL: true,
      audio: true,
      screen: true,
      webRTC: true,
    };

    const snapshot = resolveProfileSnapshot(
      "example.com",
      undefined,
      [ruleFor({ audio: false })],
      [location],
      [],
      [],
      false,
      [60, 500],
      true,
      experimentalConfig,
    );

    expect(snapshot?.fingerprint?.spoofingToggles?.audio).toBe(false);
    expect(snapshot?.fingerprint?.spoofingToggles?.canvas).toBe(true);
    expect(snapshot?.fingerprint?.spoofingToggles?.webGL).toBe(true);
  });

  it("rule-level overrides can disable navigator and client hints", () => {
    stubNavigator();

    const experimentalConfig: SharedSpoofingConfig = {
      canvas: true,
      webGL: true,
      audio: true,
      navigator: true,
      screen: true,
      clientHints: true,
      battery: true,
      webRTC: true,
    };

    const snapshot = resolveProfileSnapshot(
      "example.com",
      undefined,
      [ruleFor({ navigator: false, clientHints: false })],
      [location],
      [],
      [],
      false,
      [60, 500],
      true,
      experimentalConfig,
    );

    expect(snapshot?.fingerprint?.spoofingToggles?.navigator).toBe(false);
    expect(snapshot?.fingerprint?.spoofingToggles?.clientHints).toBe(false);
  });

  it("resolves Battery independently at global and rule level", () => {
    stubNavigator();

    const globallyDisabled = resolveProfileSnapshot(
      "example.com",
      undefined,
      [ruleFor({ battery: true })],
      [location],
      [],
      [],
      false,
      [60, 500],
      true,
      { battery: false },
    );
    const ruleDisabled = resolveProfileSnapshot(
      "example.com",
      undefined,
      [ruleFor({ battery: false })],
      [location],
      [],
      [],
      false,
      [60, 500],
      true,
      { battery: true },
    );

    expect(globallyDisabled?.fingerprint?.spoofingToggles?.battery).toBe(false);
    expect(ruleDisabled?.fingerprint?.spoofingToggles?.battery).toBe(false);
  });

  it("without global protection enabled, no runtime snapshot appears", () => {
    const snapshot = resolveProfileSnapshotBase({
      browserFingerprintSource: undefined,
      fingerprintEnabled: false,
      containerAssignments: [],
      cookieStoreId: undefined,
      debugMode: false,
      globalFallbackRule: undefined,
      hostname: "example.com",
      profiles: [location],
      rules: withRuleSeeds([ruleFor()]),
      sharedSpoofing: { canvas: false },
      sharedWorkerHandlingMode: "native",
      trustedSites: [],
      watchPositionDelay: [60, 500],
    });

    expect(snapshot).toBeNull();
  });

  it("toRuntimeSnapshot applies ruleOverrides parameter directly", () => {
    stubNavigator();

    const experimentalConfig: SharedSpoofingConfig = {
      canvas: true,
      webGL: true,
      audio: true,
      navigator: true,
      screen: true,
      clientHints: true,
      battery: true,
      webRTC: true,
    };

    const snapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      experimentalConfig,
      { webGL: false },
      "abc123",
    );

    expect(snapshot.fingerprint?.spoofingToggles?.webGL).toBe(false);
    expect(snapshot.fingerprint?.spoofingToggles?.canvas).toBe(true);
    expect(snapshot.fingerprint?.spoofingToggles?.audio).toBe(true);
  });

  it("toRuntimeSnapshot applies ruleOverrides even without explicit global config", () => {
    stubNavigator();

    const snapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      undefined,
      { webGL: false, clientHints: false },
      "abc123",
    );

    expect(snapshot.fingerprint?.spoofingToggles?.webGL).toBe(false);
    expect(snapshot.fingerprint?.spoofingToggles?.clientHints).toBe(false);
    expect(snapshot.fingerprint?.spoofingToggles?.canvas).toBe(true);
  });

  it("defaults every surface to enabled when no shared spoofing config exists", () => {
    stubNavigator();

    const snapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      "abc123",
    );

    expect(snapshot.fingerprint?.spoofingToggles).toEqual({
      canvas: true,
      webGL: true,
      audio: true,
      navigator: true,
      screen: true,
      clientHints: true,
      battery: true,
      webRTC: true,
    });
  });

  it("derives simple-engine seeds from location plus ruleSeedKey", () => {
    stubNavigator();

    const profile = buildProfile("Europe/Warsaw");
    const first = toRuntimeSnapshot(
      profile,
      [],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      "abc123",
    );
    const second = toRuntimeSnapshot(
      profile,
      [],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      "abc123",
    );
    const rotated = toRuntimeSnapshot(
      profile,
      [],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      "def456",
    );

    expect(first.fingerprint?.canvasNoiseSeed).toBe(
      second.fingerprint?.canvasNoiseSeed,
    );
    expect(first.fingerprint?.audioNoiseSeed).toBe(second.fingerprint?.audioNoiseSeed);
    expect(first.fingerprint?.canvasNoiseSeed).not.toBe(
      rotated.fingerprint?.canvasNoiseSeed,
    );
  });

  it("applies per-rule seed keys when building snapshots for preloaded bootstrap", () => {
    stubNavigator();

    const profile: Location = {
      ...buildProfile("Europe/Warsaw"),
      id: "preloaded-seed-profile",
    };
    const first = toRuleRuntimeSnapshot(
      {
        ruleSeedKey: "abc123",
      },
      profile,
      [],
      false,
      [60, 500],
      true,
    );
    const second = toRuleRuntimeSnapshot(
      {
        ruleSeedKey: "abc123",
      },
      profile,
      [],
      false,
      [60, 500],
      true,
    );
    const rotated = toRuleRuntimeSnapshot(
      {
        ruleSeedKey: "def456",
      },
      profile,
      [],
      false,
      [60, 500],
      true,
    );

    expect(first.fingerprint?.canvasNoiseSeed).toBe(
      second.fingerprint?.canvasNoiseSeed,
    );
    expect(first.fingerprint?.audioNoiseSeed).toBe(second.fingerprint?.audioNoiseSeed);
    expect(first.fingerprint?.canvasNoiseSeed).not.toBe(
      rotated.fingerprint?.canvasNoiseSeed,
    );
  });

  it("shapes hardwareConcurrency and deviceMemory deterministically for simple engine", () => {
    stubNavigator();

    const first = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      "abc123",
    );
    const second = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      "abc123",
    );

    expect(first.fingerprint?.hardwareConcurrency).toBe(
      second.fingerprint?.hardwareConcurrency,
    );
    expect(first.fingerprint?.deviceMemory).toBe(second.fingerprint?.deviceMemory);
    expectDeviceShape(first.fingerprint);
  });

  it("does not spoof deviceMemory for Firefox without a verified value pool", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:139.0) Gecko/20100101 Firefox/139.0",
      platform: "MacIntel",
      vendor: "",
      hardwareConcurrency: 12,
      deviceMemory: 16,
    });

    const snapshot = toRuntimeSnapshot(
      buildProfile("Europe/Warsaw"),
      [],
      false,
      [60, 500],
      true,
      undefined,
      undefined,
      "abc123",
    );

    expect(typeof snapshot.fingerprint?.hardwareConcurrency).toBe("number");
    expect(snapshot.fingerprint?.hardwareConcurrency).toBeGreaterThan(0);
    expect(Number.isInteger(snapshot.fingerprint?.hardwareConcurrency)).toBe(true);
    expect(snapshot.fingerprint?.deviceMemory).toBeUndefined();
  });
});
