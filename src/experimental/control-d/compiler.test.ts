import { describe, expect, it } from "vitest";

import {
  compileControlDPattern,
  compileControlDServices,
  compileControlDState,
} from "./compiler";
import {
  controlDConfigSchema,
  type ControlDConfig,
  type ControlDDiff,
  type ControlDProxyLocation,
} from "./contracts";

import type { RuleFeatureBinding } from "@/shared/provider-feature";
import type { DomainRule, Location } from "@/shared/types";

const warsaw: Location = {
  id: "warsaw",
  label: "Warsaw",
  latitude: 52.23,
  longitude: 21.01,
  countryCode: "PL",
  accuracy: 25,
  noiseRadius: 50,
  language: "pl",
  languages: ["pl"],
  timeZone: "Europe/Warsaw",
};

const paris: Location = {
  ...warsaw,
  id: "paris",
  label: "Paris",
  latitude: 48.86,
  longitude: 2.35,
  countryCode: "FR",
  language: "fr",
  languages: ["fr"],
  timeZone: "Europe/Paris",
};

const ottawa: Location = {
  ...warsaw,
  id: "ottawa",
  label: "Ottawa",
  latitude: 45.42,
  longitude: -75.7,
  countryCode: "CA",
  language: "en",
  languages: ["en"],
  timeZone: "America/Toronto",
};

const proxies: ControlDProxyLocation[] = [
  {
    pk: "WAW",
    city: "Warsaw",
    countryCode: "PL",
    countryName: "Poland",
    latitude: 52.2,
    longitude: 21,
  },
  {
    pk: "PAR",
    city: "Paris",
    countryCode: "FR",
    countryName: "France",
    latitude: 48.86,
    longitude: 2.35,
  },
  {
    pk: "YOW",
    city: "Ottawa",
    countryCode: "CA",
    countryName: "Canada",
    latitude: 45.42,
    longitude: -75.7,
  },
  {
    pk: "BER",
    city: "Berlin",
    countryCode: "DE",
    countryName: "Germany",
    latitude: 52.52,
    longitude: 13.4,
  },
];

const rule = (pattern: string): DomainRule => ({
  pattern,
  enabled: true,
  locationId: warsaw.id,
});

describe("compileControlDPattern", () => {
  it("preserves subdomain-only patterns", () => {
    expect(compileControlDPattern("*.example.com")).toEqual({
      hostname: "*.example.com",
    });
  });

  it("preserves Privacy Thing suffix patterns", () => {
    expect(compileControlDPattern("*example.com")).toEqual({
      hostname: "*example.com",
    });
  });

  it("preserves exact hosts and wildcards supported by Control D", () => {
    expect(compileControlDPattern("example.com")).toEqual({
      hostname: "example.com",
    });
    expect(compileControlDPattern("server-*.example.com")).toEqual({
      hostname: "server-*.example.com",
    });
  });

  it("rejects values that are not hostname patterns", () => {
    expect(compileControlDPattern("https://example.com/path")).toMatchObject({
      warning: { code: "unsupported-pattern" },
    });
  });

  it("keeps exact hosts in the compiled regional rules", () => {
    const result = compileControlDState({
      rules: [rule("www.linkedin.com"), rule("github.com")],
      locations: [warsaw],
      proxies,
      storedMappings: {},
    });

    expect(result.rules.map((entry) => entry.hostname)).toEqual([
      "github.com",
      "www.linkedin.com",
    ]);
    expect(result.mappings.warsaw).toMatchObject({
      locationLabel: "Warsaw",
      ruleCount: 2,
    });
    expect(result.warnings).toEqual([]);
  });
});

describe("compileControlDState", () => {
  it("compiles the exported Warsaw, Paris, and Ottawa rule set", () => {
    const result = compileControlDState({
      rules: [
        rule("www.linkedin.com"),
        rule("github.com"),
        rule("*www.instagram.com"),
        rule("*example.com"),
        { pattern: "*jakdojade.pl", enabled: true },
        { ...rule("iteracja.elpassion.com"), locationId: ottawa.id },
        { ...rule("test.pl"), locationId: paris.id },
      ],
      locations: [warsaw, paris, ottawa],
      proxies,
      storedMappings: {},
    });

    expect(result.rules).toHaveLength(6);
    expect(result.rules.map((entry) => entry.hostname)).toEqual([
      "*example.com",
      "*www.instagram.com",
      "github.com",
      "iteracja.elpassion.com",
      "test.pl",
      "www.linkedin.com",
    ]);
    expect(result.mappings).toMatchObject({
      warsaw: { proxyPk: "WAW", ruleCount: 4 },
      paris: { proxyPk: "PAR", ruleCount: 1 },
      ottawa: { proxyPk: "YOW", ruleCount: 1 },
    });
  });

  it("selects the nearest exit in the confirmed country", () => {
    const result = compileControlDState({
      rules: [rule("*example.com")],
      locations: [warsaw],
      proxies,
      storedMappings: {},
    });

    expect(result.rules).toEqual([
      {
        sourcePattern: "*example.com",
        hostname: "*example.com",
        locationId: "warsaw",
        proxyPk: "WAW",
      },
    ]);
    expect(result.mappings.warsaw).toMatchObject({
      status: "exact",
      confirmed: true,
      proxyPk: "WAW",
    });
  });

  it("uses a visible approximate mapping when the country is unavailable", () => {
    const result = compileControlDState({
      rules: [rule("*.example.com")],
      locations: [{ ...warsaw, countryCode: "CZ" }],
      proxies,
      storedMappings: {},
    });

    expect(result.mappings.warsaw).toMatchObject({
      status: "approximate",
      confirmed: false,
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "approximate-location" }),
    );
  });

  it("honors an explicit skip and ignores disabled or location-less rules", () => {
    const result = compileControlDState({
      rules: [rule("*example.com"), { ...rule("*off.test"), enabled: false }],
      locations: [warsaw],
      proxies,
      storedMappings: {
        warsaw: {
          locationId: "warsaw",
          proxyPk: null,
          status: "skipped",
          confirmed: true,
        },
      },
    });

    expect(result.rules).toEqual([]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "skipped-location" }),
    );
  });
});

const binding = (
  rulePattern: string,
  featureId: string,
  featureName = featureId,
): RuleFeatureBinding => ({
  rulePattern,
  providerId: "control-d",
  featureId,
  featureName,
  featureType: "service",
});

const compileServices = (
  rules: readonly DomainRule[],
  bindings: readonly RuleFeatureBinding[],
  locations: readonly Location[] = [warsaw],
  storedMappings: Parameters<typeof compileControlDState>[0]["storedMappings"] = {},
) => {
  const compiled = compileControlDState({ rules, locations, proxies, storedMappings });
  return {
    compiled,
    services: compileControlDServices({
      rules,
      bindings,
      mappings: compiled.mappings,
    }),
  };
};

describe("compileControlDServices", () => {
  it("routes one confirmed service through the source location proxy", () => {
    const { compiled, services } = compileServices(
      [
        rule("*example.com"),
        { ...rule("www.example.com"), pattern: "www.example.com" },
      ],
      [binding("*example.com", "manual-hulu", "Hulu")],
    );

    expect(compiled.rules.map((entry) => entry.hostname)).toEqual([
      "*example.com",
      "www.example.com",
    ]);
    expect(services.conflicts).toEqual([]);
    expect(services.services).toEqual([
      {
        servicePk: "manual-hulu",
        featureName: "Hulu",
        rulePattern: "*example.com",
        locationId: "warsaw",
        proxyPk: "WAW",
        action: { do: 3, status: 1, via: "WAW", viaV6: null },
      },
    ]);
  });

  it("ignores disabled, missing, overlapping, and non-control-d bindings", () => {
    const { services } = compileServices(
      [{ ...rule("*example.com"), enabled: false }, rule("*other.test")],
      [
        binding("*example.com", "netflix", "Netflix"),
        binding("example.com", "hulu", "Hulu"),
        {
          ...binding("*other.test", "zoom", "Zoom"),
          providerId: "other",
        },
      ],
    );

    expect(services.services).toEqual([]);
    expect(services.conflicts).toEqual([]);
  });

  it("skips a source whose location has no usable proxy", () => {
    const { services } = compileServices(
      [rule("*example.com")],
      [binding("*example.com", "netflix", "Netflix")],
      [warsaw],
      {
        warsaw: {
          locationId: "warsaw",
          proxyPk: null,
          status: "skipped",
          confirmed: true,
        },
      },
    );

    expect(services.services).toEqual([]);
  });

  it("collapses duplicate confirmations and reports conflicting ones", () => {
    const duplicate = compileServices(
      [rule("*example.com")],
      [
        binding("*example.com", "netflix", "Netflix"),
        binding("*example.com", "netflix", "Netflix"),
      ],
    );
    expect(duplicate.services.services).toHaveLength(1);

    const sameSource = compileServices(
      [rule("*example.com")],
      [
        binding("*example.com", "netflix", "Netflix"),
        binding("*example.com", "hulu", "Hulu"),
      ],
    );
    expect(sameSource.services.services).toEqual([]);
    expect(sameSource.services.conflicts).toEqual([
      expect.objectContaining({
        code: "duplicate-source",
        rulePattern: "*example.com",
      }),
    ]);

    const sameFeature = compileServices(
      [rule("*example.com"), { ...rule("other.test"), pattern: "other.test" }],
      [
        binding("*example.com", "netflix", "Netflix"),
        binding("other.test", "netflix", "Netflix"),
      ],
    );
    expect(sameFeature.services.services).toEqual([]);
    expect(sameFeature.services.conflicts).toEqual([
      expect.objectContaining({ code: "duplicate-feature", servicePk: "netflix" }),
    ]);
  });
});

describe("controlDConfigSchema service ownership", () => {
  const stored = {
    version: 2,
    enabled: false,
    connected: false,
    autoSyncEnabled: false,
    status: "disconnected",
    resourceIdentity: null,
    profileId: null,
    endpointId: null,
    resolverDoh: null,
    dnsVerification: null,
    managedFolders: {},
    locationMappings: {},
    lastSyncedHash: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
  } satisfies ControlDConfig;

  it("keeps configs that predate managed services", () => {
    const parsed = controlDConfigSchema.parse(stored);
    expect(parsed.managedServices).toBeUndefined();
    const legacyDiff: ControlDDiff = {
      createProfile: false,
      createEndpoint: false,
      createFolders: 0,
      addRules: 0,
      updateRules: 0,
      deleteRules: 0,
      unchangedRules: 0,
      warnings: [],
      mappings: [],
      requiresApproximationConfirmation: false,
    };
    expect(legacyDiff.addServices).toBeUndefined();
  });

  it("stores the applied native action identity", () => {
    const parsed = controlDConfigSchema.parse({
      ...stored,
      managedServices: {
        netflix: {
          rulePattern: "*example.com",
          proxyPk: "WAW",
          action: { do: 3, status: 1, via: "WAW", viaV6: null },
        },
      },
    });
    expect(parsed.managedServices?.netflix).toEqual({
      rulePattern: "*example.com",
      proxyPk: "WAW",
      action: { do: 3, status: 1, via: "WAW", viaV6: null },
    });
    expect(
      controlDConfigSchema.safeParse({
        ...stored,
        managedServices: {
          netflix: {
            rulePattern: "*example.com",
            proxyPk: "WAW",
            action: { do: 2, status: 1, via: "WAW", viaV6: null },
          },
        },
      }).success,
    ).toBe(false);
  });
});
