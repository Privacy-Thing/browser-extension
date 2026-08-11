import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSnapshotHeaderRule,
  buildTrustedBypassRules,
  buildCspRemovalRules,
  buildDomainFallbackRules as buildDomainFallbackRulesBase,
  buildHeaderRules as buildHeaderRulesBase,
  patternToRegexFilter,
  syncContextHeaderRule,
} from "@/background/dnr";
import { buildRequestHeaders } from "@/background/dnr-request-headers";
import {
  clearSurfaceEvidence,
  getRealmEvidence,
} from "@/background/surface-evidence-tracker";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type {
  ContainerAssignment,
  DomainRule,
  DynamicHeaderRule,
  EffectiveTabContext,
  GlobalFallbackRule,
  Location,
  RuntimeSnapshot,
  SharedSpoofingConfig,
} from "@/shared/types";

const withRuleSeeds = (rules: readonly DomainRule[]): DomainRule[] =>
  rules.map((rule, index) => ({
    ...rule,
    ruleSeedKey: rule.ruleSeedKey ?? `seed${index.toString(36).padStart(2, "0")}`,
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

const keepLegacyFixture = (
  fingerprintEnabled: boolean,
  sharedSpoofing: SharedSpoofingConfig | undefined,
): SharedSpoofingConfig | undefined =>
  fingerprintEnabled ? sharedSpoofing : { ...sharedSpoofing, ...NATIVE_FP_SURFACES };

const expectedLocaleHeaders = (value: string) => [
  {
    header: "Accept-Language",
    operation: "set" as const,
    value,
  },
];

describe("buildRequestHeaders", () => {
  it("escapes structured Client Hint platform values", () => {
    const requestHeaders = buildRequestHeaders({
      fingerprint: {
        clientHints: {
          platform: 'Win\\"dows',
          mobile: false,
        },
      },
    } as RuntimeSnapshot);

    expect(requestHeaders).toContainEqual({
      header: "Sec-CH-UA-Platform",
      operation: "set",
      value: '"Win\\\\\\"dows"',
    });
  });
});

type HeaderInput = Parameters<typeof buildHeaderRulesBase>[0];
type DomainInput = Parameters<typeof buildDomainFallbackRulesBase>[0];

const buildHeaderRules = (
  contexts: HeaderInput["contexts"],
  profiles: HeaderInput["profiles"],
  rules: HeaderInput["rules"],
  fingerprintEnabled: boolean,
  sharedSpoofing?: HeaderInput["sharedSpoofing"],
  browserFingerprintSource?: HeaderInput["browserFingerprintSource"],
  globalFallbackRule?: HeaderInput["globalFallbackRule"],
  trustedSites?: HeaderInput["trustedSites"],
  containerAssignments?: HeaderInput["containerAssignments"],
) => {
  const normalizedSharedSpoofing = keepLegacyFixture(
    fingerprintEnabled,
    sharedSpoofing,
  );
  const seededFallback = withFallbackSeed(globalFallbackRule);
  return buildHeaderRulesBase({
    contexts,
    profiles,
    rules: withRuleSeeds(rules),
    fingerprintEnabled: true,
    ...(normalizedSharedSpoofing ? { sharedSpoofing: normalizedSharedSpoofing } : {}),
    ...(browserFingerprintSource ? { browserFingerprintSource } : {}),
    ...(seededFallback ? { globalFallbackRule: seededFallback } : {}),
    ...(trustedSites ? { trustedSites } : {}),
    ...(containerAssignments ? { containerAssignments } : {}),
  });
};

const buildDomainFallbackRules = (
  profiles: DomainInput["profiles"],
  rules: DomainInput["rules"],
  fingerprintEnabled: boolean,
  sharedSpoofing?: DomainInput["sharedSpoofing"],
  browserFingerprintSource?: DomainInput["browserFingerprintSource"],
  globalFallbackRule?: DomainInput["globalFallbackRule"],
  _trustedSites?: readonly unknown[],
) => {
  const normalizedSharedSpoofing = keepLegacyFixture(
    fingerprintEnabled,
    sharedSpoofing,
  );
  const seededFallback = withFallbackSeed(globalFallbackRule);
  return buildDomainFallbackRulesBase({
    profiles,
    rules: withRuleSeeds(rules),
    fingerprintEnabled: true,
    ...(normalizedSharedSpoofing ? { sharedSpoofing: normalizedSharedSpoofing } : {}),
    ...(browserFingerprintSource ? { browserFingerprintSource } : {}),
    ...(seededFallback ? { globalFallbackRule: seededFallback } : {}),
  });
};

const matchesRuleUrl = (rule: DynamicHeaderRule, url: string): boolean => {
  const filter = rule.condition.regexFilter;
  if (!filter) {
    return false;
  }

  return new RegExp(filter).test(url);
};

const requestMatchesAnyRule = (
  rules: readonly DynamicHeaderRule[],
  url: string,
): boolean => rules.some((rule) => matchesRuleUrl(rule, url));

const matchesProtectedFallback = (
  modifyHeaderRules: readonly DynamicHeaderRule[],
  trustedSiteBypassRules: readonly DynamicHeaderRule[],
  url: string,
): boolean =>
  !requestMatchesAnyRule(trustedSiteBypassRules, url) &&
  requestMatchesAnyRule(modifyHeaderRules, url);

const expectedResourceTypes = [
  "main_frame",
  "sub_frame",
  "xmlhttprequest",
  "script",
  "image",
  "font",
  "stylesheet",
  "media",
  "websocket",
  "ping",
  ...(BUILD_BROWSER_TARGET === "firefox" ? ["beacon"] : []),
];

describe("buildHeaderRules", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a per-tab Accept-Language dynamic rule from the effective profile", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [{ pattern: "*", locationId: "warsaw", enabled: true }];

    const result = buildHeaderRules(
      [{ tabId: 7, hostname: "example.com" }],
      profiles,
      rules,
      false,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.condition.tabIds).toEqual([7]);
    expect(result[0]?.action.requestHeaders).toEqual(expectedLocaleHeaders("pl"));
  });

  it("builds a per-tab rule directly from a prepared snapshot", () => {
    const result = buildSnapshotHeaderRule(
      { tabId: 7, hostname: "example.com" },
      {
        geo: {
          latitude: 52.2297,
          longitude: 21.0122,
          accuracy: 25,
          noiseRadius: 50,
        },
        locale: {
          language: "pl",
          languages: ["pl"],
          timeZone: "Europe/Warsaw",
          acceptLanguage: "pl",
        },
        date: {
          baseEpochMs: 0,
          offsetMs: 0,
          timeZone: "Europe/Warsaw",
        },
        debugMode: false,
        watchPositionDelay: [60, 500],
      },
    );

    expect(result?.condition.tabIds).toEqual([7]);
    expect(result?.action.requestHeaders).toEqual([
      {
        header: "Accept-Language",
        operation: "set",
        value: "pl",
      },
    ]);
  });

  it("does not build per-tab rules for hostless fallback-origin contexts", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const globalFallbackRule: GlobalFallbackRule = {
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "glb123",
    };

    expect(
      buildHeaderRules(
        [{ tabId: 7, hostname: "" }],
        profiles,
        [],
        false,
        undefined,
        undefined,
        globalFallbackRule,
      ),
    ).toEqual([]);
    expect(
      buildSnapshotHeaderRule(
        { tabId: 7, hostname: "" },
        {
          geo: {
            latitude: 52.2297,
            longitude: 21.0122,
            accuracy: 25,
            noiseRadius: 50,
          },
          locale: {
            language: "pl",
            languages: ["pl"],
            timeZone: "Europe/Warsaw",
            acceptLanguage: "pl",
          },
          date: {
            baseEpochMs: 0,
            offsetMs: 0,
            timeZone: "Europe/Warsaw",
          },
          debugMode: false,
          watchPositionDelay: [60, 500],
        },
      ),
    ).toBeNull();
  });

  it("uses container assignments when rebuilding per-tab header rules", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
      {
        id: "paris",
        label: "Paris",
        latitude: 48.8566,
        longitude: 2.3522,
        accuracy: 25,
        noiseRadius: 50,
        language: "fr-FR",
        languages: ["fr-FR", "fr"],
        timeZone: "Europe/Paris",
      },
    ];
    const rules: DomainRule[] = [];
    const globalFallbackRule: GlobalFallbackRule = {
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "glb123",
      authKey: "glb-auth",
    };
    const containerAssignments: ContainerAssignment[] = [
      {
        cookieStoreId: "firefox-container-1",
        enabled: true,
        locationId: "paris",
        ruleSeedKey: "ctr001",
        authKey: "ctr-auth",
      },
    ];

    const result = buildHeaderRules(
      [{ tabId: 7, hostname: "example.com", cookieStoreId: "firefox-container-1" }],
      profiles,
      rules,
      false,
      undefined,
      undefined,
      globalFallbackRule,
      [],
      containerAssignments,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.condition.tabIds).toEqual([7]);
    expect(result[0]?.action.requestHeaders).toEqual(
      expectedLocaleHeaders("fr-FR,fr;q=0.9"),
    );
  });

  it("builds independent rules for tabs with different effective locales", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
      {
        id: "paris",
        label: "Paris",
        latitude: 48.8566,
        longitude: 2.3522,
        accuracy: 25,
        noiseRadius: 50,
        language: "fr-FR",
        languages: ["fr-FR", "fr"],
        timeZone: "Europe/Paris",
      },
    ];
    const rules: DomainRule[] = [
      { pattern: "example.com", locationId: "warsaw", enabled: true },
      { pattern: "example.fr", locationId: "paris", enabled: true },
    ];

    const result = buildHeaderRules(
      [
        { tabId: 7, hostname: "example.com" },
        { tabId: 8, hostname: "example.fr" },
      ],
      profiles,
      rules,
      false,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.condition.tabIds).toEqual([7]);
    expect(result[0]?.action.requestHeaders).toEqual(expectedLocaleHeaders("pl"));
    expect(result[1]?.condition.tabIds).toEqual([8]);
    expect(result[1]?.action.requestHeaders).toEqual(
      expectedLocaleHeaders("fr-FR,fr;q=0.9"),
    );
  });

  it("adds Client Hints headers and expanded resource types when browser spoofing is enabled", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7204.62 Safari/537.36",
      platform: "Win32",
      vendor: "Google Inc.",
      hardwareConcurrency: 8,
      deviceMemory: 8,
      userAgentData: {
        brands: [
          { brand: "Not A(Brand", version: "99" },
          { brand: "Google Chrome", version: "139" },
        ],
        mobile: false,
        platform: "Windows",
      },
    });
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [{ pattern: "*", locationId: "warsaw", enabled: true }];

    const result = buildHeaderRules(
      [{ tabId: 7, hostname: "example.com" }],
      profiles,
      rules,
      true,
    );

    expect(result[0]?.condition.resourceTypes).toEqual(expectedResourceTypes);
    expect(result[0]?.action.requestHeaders).toEqual(
      expect.arrayContaining([
        {
          header: "Sec-CH-UA",
          operation: "set",
          value: '"Not A(Brand";v="99", "Google Chrome";v="139"',
        },
        {
          header: "Sec-CH-UA-Platform",
          operation: "set",
          value: '"Windows"',
        },
        {
          header: "Sec-CH-UA-Mobile",
          operation: "set",
          value: "?0",
        },
        expect.objectContaining({
          header: "Sec-CH-UA-Full-Version-List",
          operation: "set",
        }),
      ]),
    );
  });

  it("keeps high-entropy fullVersionList in headers when version rotation is disabled", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [{ pattern: "*", locationId: "warsaw", enabled: true }];

    const result = buildHeaderRules(
      [{ tabId: 7, hostname: "example.com" }],
      profiles,
      rules,
      true,
      {
        clientHints: true,
        clientHintsVersionRotation: false,
      },
      {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
        platform: "Win32",
        vendor: "Google Inc.",
        hardwareConcurrency: 8,
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

    expect(
      result[0]?.action.requestHeaders?.find(
        (header) => header.header === "Sec-CH-UA-Full-Version-List",
      )?.value,
    ).toBe('"Google Chrome";v="147.0.7727.101", "Chromium";v="147.0.7727.101"');
  });

  it("does not add Client Hints headers for non-Chromium navigator data", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:139.0) Gecko/20100101 Firefox/139.0",
      platform: "MacIntel",
      vendor: "",
      hardwareConcurrency: 8,
    });
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [{ pattern: "*", locationId: "warsaw", enabled: true }];

    const result = buildHeaderRules(
      [{ tabId: 7, hostname: "example.com" }],
      profiles,
      rules,
      true,
    );

    expect(result[0]?.action.requestHeaders?.map((header) => header.header)).toEqual([
      "Accept-Language",
      "User-Agent",
    ]);
  });

  it("emits a User-Agent rule for a Firefox fingerprint-only fallback runtime", () => {
    const result = buildHeaderRules(
      [{ tabId: 7, hostname: "example.com" }],
      [],
      [],
      true,
      undefined,
      {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:139.0) Gecko/20100101 Firefox/139.0",
        platform: "MacIntel",
        vendor: "",
        hardwareConcurrency: 8,
      },
      {
        enabled: true,
        ruleSeedKey: "abc123",
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.action.requestHeaders).toEqual([
      expect.objectContaining({
        header: "User-Agent",
        operation: "set",
      }),
    ]);
  });

  it("does not emit User-Agent when navigator spoofing is disabled", () => {
    const result = buildSnapshotHeaderRule(
      { tabId: 7, hostname: "example.com" },
      {
        geo: { latitude: 0, longitude: 0, accuracy: 10, noiseRadius: 50 },
        locale: {
          language: "en",
          languages: ["en"],
          timeZone: "UTC",
          acceptLanguage: "en",
        },
        date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
        timeLocaleEnabled: false,
        debugMode: false,
        watchPositionDelay: [60, 500],
        fingerprint: {
          userAgent: "Mozilla/5.0 Firefox/139.0",
          spoofingToggles: { navigator: false },
        },
      },
    );

    expect(result).toBeNull();
  });

  it("omits Client Hints headers when the shared client hints surface is disabled", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7204.62 Safari/537.36",
      platform: "Win32",
      vendor: "Google Inc.",
      hardwareConcurrency: 8,
      deviceMemory: 8,
      userAgentData: {
        brands: [{ brand: "Google Chrome", version: "139" }],
        mobile: false,
        platform: "Windows",
      },
    });
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [{ pattern: "*", locationId: "warsaw", enabled: true }];

    const result = buildHeaderRules(
      [{ tabId: 7, hostname: "example.com" }],
      profiles,
      rules,
      true,
      {
        canvas: true,
        webGL: true,
        audio: true,
        navigator: true,
        screen: true,
        clientHints: false,
        webRTC: true,
      },
    );

    expect(result[0]?.action.requestHeaders).toEqual([
      {
        header: "Accept-Language",
        operation: "set",
        value: "pl",
      },
      expect.objectContaining({
        header: "User-Agent",
        operation: "set",
      }),
    ]);
  });

  it("uses priority 2 for per-tab rules", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [{ pattern: "*", locationId: "warsaw", enabled: true }];

    const result = buildHeaderRules(
      [{ tabId: 7, hostname: "example.com" }],
      profiles,
      rules,
      false,
    );

    expect(result[0]?.priority).toBeGreaterThan(
      buildDomainFallbackRules(profiles, rules, false)[0]?.priority ?? 0,
    );
  });
});

describe("syncContextHeaderRule", () => {
  const updateSessionRules = vi.fn(() => Promise.resolve());
  const getSessionRules = vi.fn<() => Promise<chrome.declarativeNetRequest.Rule[]>>();
  const context: EffectiveTabContext = { tabId: 424_242, hostname: "example.test" };
  const snapshot: RuntimeSnapshot = {
    geo: { latitude: 1, longitude: 1, accuracy: 10, noiseRadius: 50 },
    locale: {
      language: "pl-PL",
      languages: ["pl-PL"],
      timeZone: "Europe/Warsaw",
      acceptLanguage: "pl-PL,pl;q=0.9",
    },
    date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
    debugMode: false,
    watchPositionDelay: [60, 500],
  };

  const dnrIntegrity = (tabId: number, category: "timeLocale"): string | undefined =>
    getRealmEvidence(tabId)[category]?.find((realm) => realm.realmId === "dnr")
      ?.integrity;

  beforeEach(() => {
    updateSessionRules.mockClear();
    getSessionRules.mockReset();
    clearSurfaceEvidence(context.tabId);
    vi.stubGlobal("chrome", {
      declarativeNetRequest: { updateSessionRules, getSessionRules },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSurfaceEvidence(context.tabId);
  });

  it("records the DNR realm as intact when the browser confirms the expected header rule", async () => {
    const expectedRule = buildSnapshotHeaderRule(context, snapshot);
    getSessionRules.mockResolvedValue([
      expectedRule as chrome.declarativeNetRequest.Rule,
    ]);

    await syncContextHeaderRule(context, snapshot);

    expect(dnrIntegrity(context.tabId, "timeLocale")).toBe("intact");
  });

  it("degrades the DNR realm when the browser silently drops the expected header rule", async () => {
    // e.g. session rule-count limit exceeded, or a conflicting rule shadowed it.
    getSessionRules.mockResolvedValue([]);

    await syncContextHeaderRule(context, snapshot);

    expect(dnrIntegrity(context.tabId, "timeLocale")).toBe("degraded");
  });

  it("does not fail the sync when the readback itself throws", async () => {
    getSessionRules.mockRejectedValue(new Error("readback unavailable"));

    await expect(syncContextHeaderRule(context, snapshot)).resolves.toBeUndefined();
    expect(getRealmEvidence(context.tabId)).toEqual({});
  });
});

describe("patternToRegexFilter", () => {
  it("matches only the apex host for exact domains", () => {
    const filter = patternToRegexFilter("example.com");

    expect(filter).toBeTruthy();
    expect(new RegExp(filter!).test("https://example.com/")).toBe(true);
    expect(new RegExp(filter!).test("https://shop.example.com/")).toBe(false);
  });

  it("keeps legacy *.example.com patterns subdomain-only", () => {
    const filter = patternToRegexFilter("*.example.com");

    expect(filter).toBeTruthy();
    expect(new RegExp(filter!).test("https://example.com/")).toBe(false);
    expect(new RegExp(filter!).test("https://shop.example.com/")).toBe(true);
    expect(new RegExp(filter!).test("https://fooexample.com/")).toBe(false);
  });

  it("keeps Privacy Thing suffix semantics for apex and subdomains", () => {
    const filter = patternToRegexFilter("*example.com");

    expect(filter).toBeTruthy();
    expect(new RegExp(filter!).test("https://example.com/")).toBe(true);
    expect(new RegExp(filter!).test("https://shop.example.com/")).toBe(true);
    expect(new RegExp(filter!).test("https://fooexample.com/")).toBe(false);
  });

  it("keeps multi-wildcard patterns on the broad matching path", () => {
    const filter = patternToRegexFilter("*a*b.example.com");

    expect(filter).toBeTruthy();
    expect(new RegExp(filter!).test("https://zaab.example.com/")).toBe(true);
  });

  it("returns null for bare wildcard", () => {
    expect(patternToRegexFilter("*")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(patternToRegexFilter("")).toBeNull();
  });

  it("returns null for overly long patterns", () => {
    expect(patternToRegexFilter("a".repeat(254))).toBeNull();
  });

  it("lowercases the domain", () => {
    const filter = patternToRegexFilter("Example.COM");

    expect(filter).toContain("example\\.com");
  });
});

describe("buildDomainFallbackRules", () => {
  it("builds domain-scoped rules without tabIds", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [
      { pattern: "example.com", locationId: "warsaw", enabled: true },
    ];

    const result = buildDomainFallbackRules(profiles, rules, false);

    expect(result).toHaveLength(1);
    expect(result[0]?.condition.tabIds).toBeUndefined();
    expect(result[0]?.condition.regexFilter).toBeTruthy();
    expect(matchesRuleUrl(result[0]!, "https://example.com/")).toBe(true);
    expect(matchesRuleUrl(result[0]!, "https://shop.example.com/")).toBe(false);
    expect(result[0]?.action.requestHeaders).toEqual(expectedLocaleHeaders("pl"));
  });

  it("keeps fallback priorities below per-tab priorities", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [
      { pattern: "example.com", locationId: "warsaw", enabled: true },
    ];

    const result = buildDomainFallbackRules(profiles, rules, false);

    expect(result[0]?.priority).toBeLessThan(
      buildHeaderRules(
        [{ tabId: 7, hostname: "example.com" }],
        profiles,
        rules,
        false,
      )[0]?.priority ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it("caps long exact-host fallback priorities below the tab priority ceiling", () => {
    const longHostname = "a".repeat(253);
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [
      { pattern: longHostname, locationId: "warsaw", enabled: true },
    ];

    const result = buildDomainFallbackRules(profiles, rules, false);

    expect(result[0]?.priority).toBeLessThan(
      buildHeaderRules(
        [{ tabId: 7, hostname: longHostname }],
        profiles,
        rules,
        false,
      )[0]?.priority ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it("skips bare wildcard rules", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [{ pattern: "*", locationId: "warsaw", enabled: true }];

    const result = buildDomainFallbackRules(profiles, rules, false);

    expect(result).toHaveLength(0);
  });

  it("skips disabled rules", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [
      { pattern: "example.com", locationId: "warsaw", enabled: false },
    ];

    const result = buildDomainFallbackRules(profiles, rules, false);

    expect(result).toHaveLength(0);
  });

  it("keeps separate exact and suffix fallback rules so apex requests use the right snapshot", () => {
    const profiles: Location[] = [
      {
        id: "exact",
        label: "Exact",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
      {
        id: "suffix",
        label: "Suffix",
        latitude: 48.8566,
        longitude: 2.3522,
        accuracy: 25,
        noiseRadius: 50,
        language: "fr-FR",
        languages: ["fr-FR", "fr"],
        timeZone: "Europe/Paris",
      },
    ];
    const rules: DomainRule[] = [
      { pattern: "*example.com", locationId: "suffix", enabled: true },
      { pattern: "example.com", locationId: "exact", enabled: true },
    ];

    const result = buildDomainFallbackRules(profiles, rules, false);
    const apexMatches = result
      .filter((rule) => matchesRuleUrl(rule, "https://example.com/"))
      .sort((left, right) => right.priority - left.priority);
    const subdomainMatches = result.filter((rule) =>
      matchesRuleUrl(rule, "https://shop.example.com/"),
    );

    expect(result).toHaveLength(2);
    expect(apexMatches).toHaveLength(2);
    expect(apexMatches[0]?.action.requestHeaders).toEqual(expectedLocaleHeaders("pl"));
    expect(apexMatches[0]?.priority).toBeGreaterThan(apexMatches[1]?.priority ?? -1);
    expect(subdomainMatches).toHaveLength(1);
    expect(subdomainMatches[0]?.action.requestHeaders).toEqual(
      expectedLocaleHeaders("fr-FR,fr;q=0.9"),
    );
  });

  it("prefers fewer wildcards when fallback rules tie on literal length", () => {
    const profiles: Location[] = [
      {
        id: "fewer-wildcards",
        label: "Fewer wildcards",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
      {
        id: "more-wildcards",
        label: "More wildcards",
        latitude: 48.8566,
        longitude: 2.3522,
        accuracy: 25,
        noiseRadius: 50,
        language: "fr-FR",
        languages: ["fr-FR", "fr"],
        timeZone: "Europe/Paris",
      },
    ];
    const rules: DomainRule[] = [
      { pattern: "*a**b.example.com", locationId: "more-wildcards", enabled: true },
      { pattern: "*a*b.example.com", locationId: "fewer-wildcards", enabled: true },
    ];

    const result = buildDomainFallbackRules(profiles, rules, false);
    const matches = result
      .filter((rule) => matchesRuleUrl(rule, "https://zaab.example.com/"))
      .sort((left, right) => right.priority - left.priority);

    expect(matches).toHaveLength(2);
    expect(matches[0]?.action.requestHeaders).toEqual(expectedLocaleHeaders("pl"));
    expect(matches[0]?.priority).toBeGreaterThan(matches[1]?.priority ?? -1);
  });

  it("prefers *.example.com over *example.com on subdomains", () => {
    const profiles: Location[] = [
      {
        id: "apex-and-subdomains",
        label: "Apex and subdomains",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
      {
        id: "subdomains-only",
        label: "Subdomains only",
        latitude: 48.8566,
        longitude: 2.3522,
        accuracy: 25,
        noiseRadius: 50,
        language: "fr-FR",
        languages: ["fr-FR", "fr"],
        timeZone: "Europe/Paris",
      },
    ];
    const rules: DomainRule[] = [
      { pattern: "*example.com", locationId: "apex-and-subdomains", enabled: true },
      { pattern: "*.example.com", locationId: "subdomains-only", enabled: true },
    ];

    const result = buildDomainFallbackRules(profiles, rules, false);
    const subdomainMatches = result
      .filter((rule) => matchesRuleUrl(rule, "https://shop.example.com/"))
      .sort((left, right) => right.priority - left.priority);
    const apexMatches = result.filter((rule) =>
      matchesRuleUrl(rule, "https://example.com/"),
    );

    expect(subdomainMatches).toHaveLength(2);
    expect(subdomainMatches[0]?.action.requestHeaders).toEqual(
      expectedLocaleHeaders("fr-FR,fr;q=0.9"),
    );
    expect(subdomainMatches[0]?.priority).toBeGreaterThan(
      subdomainMatches[1]?.priority ?? -1,
    );
    expect(apexMatches).toHaveLength(1);
    expect(apexMatches[0]?.action.requestHeaders).toEqual(expectedLocaleHeaders("pl"));
  });

  it("builds fallback rules for Privacy Thing suffix patterns", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [
      { pattern: "*example.com", locationId: "warsaw", enabled: true },
    ];

    const result = buildDomainFallbackRules(profiles, rules, false);

    expect(result).toHaveLength(1);
    expect(matchesRuleUrl(result[0]!, "https://example.com/")).toBe(true);
    expect(matchesRuleUrl(result[0]!, "https://shop.example.com/")).toBe(true);
    expect(result[0]?.action.requestHeaders).toEqual(expectedLocaleHeaders("pl"));
  });

  it("excludes trusted sites from broader domain fallback rules", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [
      { pattern: "*example.com", locationId: "warsaw", enabled: true },
    ];

    const result = buildDomainFallbackRules(
      profiles,
      rules,
      false,
      undefined,
      undefined,
      undefined,
      [{ pattern: "shop.example.com", enabled: true }],
    );
    const trustedSiteBypassRules = buildTrustedBypassRules([
      { pattern: "shop.example.com", enabled: true },
    ]);

    expect(result).toHaveLength(1);
    expect(
      matchesProtectedFallback(result, trustedSiteBypassRules, "https://example.com/"),
    ).toBe(true);
    expect(
      matchesProtectedFallback(
        result,
        trustedSiteBypassRules,
        "https://blog.example.com/",
      ),
    ).toBe(true);
    expect(
      matchesProtectedFallback(
        result,
        trustedSiteBypassRules,
        "https://shop.example.com/",
      ),
    ).toBe(false);
  });

  it("limits global fallback rules to HTTP and WebSocket URLs", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];

    const result = buildDomainFallbackRules(profiles, [], false, undefined, undefined, {
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "abc123",
    });

    expect(result).toHaveLength(1);
    expect(matchesRuleUrl(result[0]!, "https://example.com/")).toBe(true);
    expect(matchesRuleUrl(result[0]!, "http://example.com/")).toBe(true);
    expect(matchesRuleUrl(result[0]!, "wss://example.com/socket")).toBe(true);
    expect(matchesRuleUrl(result[0]!, "ws://example.com/socket")).toBe(true);
    expect(matchesRuleUrl(result[0]!, "ftp://example.com/")).toBe(false);
    expect(matchesRuleUrl(result[0]!, "chrome-extension://example.com/")).toBe(false);
  });

  it("excludes trusted sites from the global fallback rule", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];

    const result = buildDomainFallbackRules(
      profiles,
      [],
      false,
      undefined,
      undefined,
      {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "abc123",
      },
      [{ pattern: "trusted.example.com", enabled: true }],
    );
    const trustedSiteBypassRules = buildTrustedBypassRules([
      { pattern: "trusted.example.com", enabled: true },
    ]);

    expect(result).toHaveLength(1);
    expect(
      matchesProtectedFallback(result, trustedSiteBypassRules, "https://example.com/"),
    ).toBe(true);
    expect(
      matchesProtectedFallback(
        result,
        trustedSiteBypassRules,
        "https://trusted.example.com/",
      ),
    ).toBe(false);
  });

  it("bypasses global fallback headers when a domain rule keeps headers Native", () => {
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [
      {
        pattern: "example.com",
        locationId: "warsaw",
        enabled: true,
        fingerprintSurfaceOverrides: {
          clientHints: false,
          navigator: false,
          timeLocale: false,
        },
      },
    ];

    const result = buildDomainFallbackRules(
      profiles,
      rules,
      true,
      undefined,
      {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7204.62 Safari/537.36",
        platform: "Win32",
        vendor: "Google Inc.",
        hardwareConcurrency: 8,
        deviceMemory: 8,
        userAgentData: {
          brands: [{ brand: "Google Chrome", version: "139" }],
          mobile: false,
          platform: "Windows",
        },
      },
      {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "abc123",
      },
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.action).toEqual({ type: "allow" });
    expect(matchesRuleUrl(result[0]!, "https://example.com/")).toBe(true);
    expect(result[1]?.action.type).toBe("modifyHeaders");
  });

  it("builds trusted-site bypass rules without RE2-incompatible lookaheads", () => {
    const result = buildTrustedBypassRules([
      { pattern: "shop.example.com", enabled: true },
      { pattern: "*.example.com", enabled: false },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(4_000_000);
    expect(result[0]?.action.type).toBe("allow");
    expect(result[0]?.condition.resourceTypes).toEqual(expectedResourceTypes);
    expect(result[0]?.condition.regexFilter).toBeTruthy();
    expect(result[0]?.condition.regexFilter).not.toContain("(?!");
    expect(matchesRuleUrl(result[0]!, "https://shop.example.com/")).toBe(true);
    expect(matchesRuleUrl(result[0]!, "https://blog.example.com/")).toBe(false);
  });

  it("omits Client Hints headers in fallback rules when the shared client hints surface is disabled", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7204.62 Safari/537.36",
      platform: "Win32",
      vendor: "Google Inc.",
      hardwareConcurrency: 8,
      deviceMemory: 8,
      userAgentData: {
        brands: [{ brand: "Google Chrome", version: "139" }],
        mobile: false,
        platform: "Windows",
      },
    });
    const profiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const rules: DomainRule[] = [
      { pattern: "example.com", locationId: "warsaw", enabled: true },
    ];

    const result = buildDomainFallbackRules(profiles, rules, true, {
      canvas: true,
      webGL: true,
      audio: true,
      navigator: true,
      screen: true,
      clientHints: false,
      webRTC: true,
    });

    expect(result[0]?.action.requestHeaders).toEqual([
      {
        header: "Accept-Language",
        operation: "set",
        value: "pl",
      },
      expect.objectContaining({
        header: "User-Agent",
        operation: "set",
      }),
    ]);
  });
});

describe("buildCspRemovalRules", () => {
  it("builds response-header removal rules for opted-in domains", () => {
    const rules: DomainRule[] = [
      {
        pattern: "secure.example.com",
        locationId: "warsaw",
        enabled: true,
        relaxCspForWorkers: true,
      },
    ];

    const result = buildCspRemovalRules(rules);

    expect(result).toHaveLength(1);
    expect(result[0]?.condition.regexFilter).toBeTruthy();
    expect(matchesRuleUrl(result[0]!, "https://secure.example.com/")).toBe(true);
    expect(matchesRuleUrl(result[0]!, "https://app.secure.example.com/")).toBe(false);
    expect(result[0]?.condition.resourceTypes).toEqual(["main_frame", "sub_frame"]);
    expect(result[0]?.action.responseHeaders).toEqual([
      {
        header: "Content-Security-Policy",
        operation: "remove",
      },
      {
        header: "Content-Security-Policy-Report-Only",
        operation: "remove",
      },
    ]);
  });

  it("skips disabled rules and rules without explicit CSP opt-in", () => {
    const rules: DomainRule[] = [
      {
        pattern: "secure.example.com",
        locationId: "warsaw",
        enabled: false,
        relaxCspForWorkers: true,
      },
      {
        pattern: "example.com",
        locationId: "warsaw",
        enabled: true,
      },
    ];

    expect(buildCspRemovalRules(rules)).toHaveLength(0);
  });

  it("skips bare wildcard rules", () => {
    const rules: DomainRule[] = [
      {
        pattern: "*",
        locationId: "warsaw",
        enabled: true,
        relaxCspForWorkers: true,
      },
    ];

    expect(buildCspRemovalRules(rules)).toHaveLength(0);
  });

  it("keeps separate exact and suffix CSP rules so exact apex hosts stay more specific", () => {
    const rules: DomainRule[] = [
      {
        pattern: "*secure.example.com",
        locationId: "suffix",
        enabled: true,
        relaxCspForWorkers: true,
      },
      {
        pattern: "secure.example.com",
        locationId: "exact",
        enabled: true,
        relaxCspForWorkers: true,
      },
    ];

    const result = buildCspRemovalRules(rules);
    const apexMatches = result
      .filter((rule) => matchesRuleUrl(rule, "https://secure.example.com/"))
      .sort((left, right) => right.priority - left.priority);
    const subdomainMatches = result.filter((rule) =>
      matchesRuleUrl(rule, "https://app.secure.example.com/"),
    );

    expect(result).toHaveLength(2);
    expect(apexMatches).toHaveLength(2);
    expect(apexMatches[0]?.priority).toBeGreaterThan(apexMatches[1]?.priority ?? -1);
    expect(subdomainMatches).toHaveLength(1);
    expect(matchesRuleUrl(subdomainMatches[0]!, "https://secure.example.com/")).toBe(
      true,
    );
  });

  it("prefers fewer wildcards when CSP rules tie on literal length", () => {
    const rules: DomainRule[] = [
      {
        pattern: "*a**b.example.com",
        locationId: "more-wildcards",
        enabled: true,
        relaxCspForWorkers: true,
      },
      {
        pattern: "*a*b.example.com",
        locationId: "fewer-wildcards",
        enabled: true,
        relaxCspForWorkers: true,
      },
    ];

    const result = buildCspRemovalRules(rules);
    const matches = result
      .filter((rule) => matchesRuleUrl(rule, "https://zaab.example.com/"))
      .sort((left, right) => right.priority - left.priority);

    expect(matches).toHaveLength(2);
    expect(matches[0]?.priority).toBeGreaterThan(matches[1]?.priority ?? -1);
  });

  it("builds CSP removal rules for Privacy Thing suffix patterns", () => {
    const rules: DomainRule[] = [
      {
        pattern: "*secure.example.com",
        locationId: "warsaw",
        enabled: true,
        relaxCspForWorkers: true,
      },
    ];

    const result = buildCspRemovalRules(rules);

    expect(result).toHaveLength(1);
    expect(matchesRuleUrl(result[0]!, "https://secure.example.com/")).toBe(true);
    expect(matchesRuleUrl(result[0]!, "https://app.secure.example.com/")).toBe(true);
  });

  it("uses the dedicated 3,000,000+ id range", () => {
    const rules: DomainRule[] = [
      {
        pattern: "secure.example.com",
        locationId: "warsaw",
        enabled: true,
        relaxCspForWorkers: true,
      },
    ];

    const result = buildCspRemovalRules(rules);

    expect(result[0]?.id).toBeGreaterThanOrEqual(3_000_000);
  });
});
