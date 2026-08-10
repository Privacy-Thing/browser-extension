import { describe, expect, it } from "vitest";

import {
  applyRuleConflictAction,
  buildRuleViewModels,
  deleteRulesByIndex,
  reassignRulesToLocation,
  resolveRulePreview,
  upsertRule,
} from "@/ui/options/rule-utils";

describe("buildRuleViewModels", () => {
  const profiles = [
    {
      id: "warsaw",
      label: "Warsaw",
      latitude: 52.2297,
      longitude: 21.0122,
      accuracy: 25,
      noiseRadius: 50,
      language: "pl-PL",
      languages: ["pl-PL", "pl"],
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

  it("flags broader rules shadowed by a more specific rule with a different profile", () => {
    const rules = [
      { pattern: "*.example.com", locationId: "warsaw", enabled: true },
      { pattern: "shop.example.com", locationId: "paris", enabled: true },
    ];

    const result = buildRuleViewModels(rules, profiles, "");
    const broaderRule = result.find((entry) => entry.rule.pattern === "*.example.com");

    expect(broaderRule?.conflicts[0]?.type).toBe("shadowed-by-specific");
    expect(broaderRule?.conflicts[0]?.action).toBe("match-related-profile");
  });

  it("flags later duplicate rules as removable duplicates", () => {
    const rules = [
      { pattern: "shop.example.com", locationId: "warsaw", enabled: true },
      { pattern: "shop.example.com", locationId: "warsaw", enabled: true },
    ];

    const result = buildRuleViewModels(rules, profiles, "");
    const duplicate = result.find((entry) => entry.index === 1);

    expect(duplicate?.conflicts[0]?.type).toBe("duplicate");
    expect(duplicate?.conflicts[0]?.actionLabel).toBe("Remove duplicate");
  });

  it("filters rules by profile label and pattern", () => {
    const rules = [
      { pattern: "*.example.com", locationId: "warsaw", enabled: true },
      { pattern: "shop.example.com", locationId: "paris", enabled: true },
    ];

    const result = buildRuleViewModels(rules, profiles, "shop.example.com");

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: expect.objectContaining({
            pattern: "shop.example.com",
          }),
        }),
      ]),
    );
  });

  it("filters rules by an exact linked location id", () => {
    const rules = [
      { pattern: "*.example.com", locationId: "warsaw", enabled: true },
      { pattern: "shop.example.com", locationId: "paris", enabled: true },
    ];

    const result = buildRuleViewModels(rules, profiles, "", "warsaw");

    expect(result).toHaveLength(1);
    expect(result[0]?.locationId).toBe("warsaw");
    expect(result[0]?.rule.pattern).toBe("*.example.com");
  });

  it("flags *example.com as shadowed by *.example.com when they target different profiles", () => {
    const rules = [
      { pattern: "*example.com", locationId: "warsaw", enabled: true },
      { pattern: "*.example.com", locationId: "paris", enabled: true },
    ];

    const result = buildRuleViewModels(rules, profiles, "");
    const broaderRule = result.find((entry) => entry.rule.pattern === "*example.com");

    expect(broaderRule?.conflicts[0]?.type).toBe("shadowed-by-specific");
    expect(broaderRule?.conflicts[0]?.relatedRuleIndex).toBe(1);
  });
});

describe("rule mutations", () => {
  it("reassigns multiple rules to another profile", () => {
    const result = reassignRulesToLocation(
      [
        { pattern: "*.example.com", locationId: "warsaw", enabled: true },
        { pattern: "shop.example.com", locationId: "warsaw", enabled: true },
        { pattern: "paris.example.com", locationId: "paris", enabled: true },
      ],
      [0, 1],
      "paris",
    );

    expect(result[0]?.locationId).toBe("paris");
    expect(result[1]?.locationId).toBe("paris");
    expect(result[2]?.locationId).toBe("paris");
  });

  it("preserves ruleSeedKey when reassigning rules to another location", () => {
    const result = reassignRulesToLocation(
      [
        {
          pattern: "*.example.com",
          locationId: "warsaw",
          enabled: true,
          ruleSeedKey: "seed01",
        },
        {
          pattern: "shop.example.com",
          locationId: "paris",
          enabled: true,
          ruleSeedKey: "seed02",
        },
        {
          pattern: "paris.example.com",
          locationId: "paris",
          enabled: true,
          ruleSeedKey: "seed03",
        },
      ],
      [0, 1, 2],
      "paris",
    );

    expect(result[0]?.ruleSeedKey).toBe("seed01");
    expect(result[1]?.ruleSeedKey).toBe("seed02");
    expect(result[2]?.ruleSeedKey).toBe("seed03");
  });

  it("deletes multiple rules by index", () => {
    const result = deleteRulesByIndex(
      [
        { pattern: "*.example.com", locationId: "warsaw", enabled: true },
        { pattern: "shop.example.com", locationId: "warsaw", enabled: true },
        { pattern: "paris.example.com", locationId: "paris", enabled: true },
      ],
      [0, 2],
    );

    expect(result).toEqual([
      { pattern: "shop.example.com", locationId: "warsaw", enabled: true },
    ]);
  });

  it("updates only the enabled state for an edited rule", () => {
    const result = upsertRule(
      [
        { pattern: "*.example.com", locationId: "warsaw", enabled: true },
        { pattern: "shop.example.com", locationId: "paris", enabled: true },
      ],
      { pattern: "*.example.com", locationId: "warsaw", enabled: false },
      "*.example.com",
    );

    expect(result).toEqual([
      { pattern: "*.example.com", locationId: "warsaw", enabled: false },
      { pattern: "shop.example.com", locationId: "paris", enabled: true },
    ]);
  });

  it("preserves ruleSeedKey when editing an existing rule from the options flow", () => {
    const result = upsertRule(
      [
        {
          pattern: "*.example.com",
          locationId: "warsaw",
          enabled: true,
          ruleSeedKey: "seed01",
        },
        {
          pattern: "shop.example.com",
          locationId: "paris",
          enabled: true,
          ruleSeedKey: "seed02",
        },
      ],
      {
        pattern: "login.example.com",
        locationId: "warsaw",
        enabled: false,
      },
      "*.example.com",
    );

    expect(result[0]).toEqual({
      pattern: "login.example.com",
      locationId: "warsaw",
      enabled: false,
      ruleSeedKey: "seed01",
    });
    expect(result[1]).toEqual({
      pattern: "shop.example.com",
      locationId: "paris",
      enabled: true,
      ruleSeedKey: "seed02",
    });
  });

  it("preserves ruleSeedKey when a save replaces an existing pattern with a different location", () => {
    const result = upsertRule(
      [
        {
          pattern: "*.example.com",
          locationId: "warsaw",
          enabled: true,
          ruleSeedKey: "seed01",
        },
      ],
      {
        pattern: "*.example.com",
        locationId: "paris",
        enabled: true,
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      pattern: "*.example.com",
      locationId: "paris",
      enabled: true,
    });
    expect(result[0]?.ruleSeedKey).toBe("seed01");
  });

  it("preserves ruleSeedKey when a save replaces an existing pattern with the same location", () => {
    const result = upsertRule(
      [
        {
          pattern: "*.example.com",
          locationId: "warsaw",
          enabled: true,
          ruleSeedKey: "seed01",
        },
      ],
      {
        pattern: "*.example.com",
        locationId: "warsaw",
        enabled: false,
      },
    );

    expect(result).toEqual([
      {
        pattern: "*.example.com",
        locationId: "warsaw",
        enabled: false,
        ruleSeedKey: "seed01",
      },
    ]);
  });

  it("creates new rules as enabled by default when requested by the caller", () => {
    const result = upsertRule(
      [{ pattern: "*.example.com", locationId: "warsaw", enabled: false }],
      { pattern: "shop.example.com", locationId: "paris", enabled: true },
    );

    expect(result[0]).toEqual({
      pattern: "shop.example.com",
      locationId: "paris",
      enabled: true,
    });
  });

  it("matches a broader rule to the profile of the related specific rule", () => {
    const rules = [
      { pattern: "*.example.com", locationId: "warsaw", enabled: true },
      { pattern: "shop.example.com", locationId: "paris", enabled: true },
    ];
    const conflict = buildRuleViewModels(
      rules,
      [
        {
          id: "warsaw",
          label: "Warsaw",
          latitude: 52.2297,
          longitude: 21.0122,
          accuracy: 25,
          noiseRadius: 50,
          language: "pl-PL",
          languages: ["pl-PL", "pl"],
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
      ],
      "",
    ).find((entry) => entry.rule.pattern === "*.example.com")?.conflicts[0];

    expect(conflict).toBeDefined();

    const result = applyRuleConflictAction(rules, 0, conflict!);
    expect(result.nextRules[0]?.locationId).toBe("paris");
  });

  it("returns the related rule index for select-related actions", () => {
    const result = applyRuleConflictAction(
      [
        { pattern: "shop.example.com", locationId: "warsaw", enabled: true },
        { pattern: "api.shop.example.com", locationId: "paris", enabled: true },
      ],
      0,
      {
        type: "shadowed-by-specific",
        message: "Specific rule wins",
        relatedRuleIndex: 1,
        action: "select-related-rule",
        actionLabel: "Select override",
      },
    );

    expect(result.selectedRuleIndex).toBe(1);
    expect(result.nextRules).toHaveLength(2);
  });
});

describe("resolveRulePreview", () => {
  const profiles = [
    {
      id: "warsaw",
      label: "Warsaw",
      latitude: 52.2297,
      longitude: 21.0122,
      accuracy: 25,
      noiseRadius: 50,
      language: "pl-PL",
      languages: ["pl-PL", "pl"],
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

  it("resolves the most specific matching rule for a hostname", () => {
    const rules = [
      { pattern: "*.example.com", locationId: "warsaw", enabled: true },
      { pattern: "shop.example.com", locationId: "paris", enabled: true },
    ];

    const result = resolveRulePreview({
      hostname: "shop.example.com",
      cookieStoreId: undefined,
      rules,
      locations: profiles,
    });

    expect(result.rule?.pattern).toBe("shop.example.com");
    expect(result.location?.label).toBe("Paris");
  });

  it("prefers *.example.com over *example.com on subdomains while keeping apex on *example.com", () => {
    const rules = [
      { pattern: "*example.com", locationId: "warsaw", enabled: true },
      { pattern: "*.example.com", locationId: "paris", enabled: true },
    ];

    const subdomainResult = resolveRulePreview({
      hostname: "shop.example.com",
      cookieStoreId: undefined,
      rules,
      locations: profiles,
    });
    const apexResult = resolveRulePreview({
      hostname: "example.com",
      cookieStoreId: undefined,
      rules,
      locations: profiles,
    });

    expect(subdomainResult.rule?.pattern).toBe("*.example.com");
    expect(subdomainResult.location?.label).toBe("Paris");
    expect(apexResult.rule?.pattern).toBe("*example.com");
    expect(apexResult.location?.label).toBe("Warsaw");
  });

  it("returns no match when no rule applies", () => {
    const result = resolveRulePreview({
      hostname: "unknown.test",
      cookieStoreId: undefined,
      rules: [],
      locations: profiles,
    });

    expect(result.winningSource).toBe("none");
    expect(result.rule).toBeNull();
    expect(result.location).toBeNull();
  });

  it("reports when a trusted site overrides a matching rule", () => {
    const result = resolveRulePreview({
      hostname: "shop.example.com",
      cookieStoreId: undefined,
      rules: [
        {
          pattern: "shop.example.com",
          locationId: "paris",
          enabled: true,
          fingerprintSurfaceOverrides: { geolocation: false },
        },
      ],
      locations: profiles,
      trustedSites: [{ pattern: "*.example.com", enabled: true }],
    });

    expect(result.winningSource).toBe("trusted-site");
    expect(result.trustedSite?.pattern).toBe("*.example.com");
    expect(result.rule?.pattern).toBe("shop.example.com");
    expect(result.location?.label).toBe("Paris");
    expect(result.locationProfileActive).toBe(false);
    expect(result.locationProfileActive).toBe(false);
  });

  it("treats the geolocation surface override as disabling the preview location state", () => {
    const result = resolveRulePreview({
      hostname: "shop.example.com",
      cookieStoreId: undefined,
      rules: [
        {
          pattern: "shop.example.com",
          locationId: "paris",
          enabled: true,
          fingerprintSurfaceOverrides: { geolocation: false },
        },
      ],
      locations: profiles,
    });

    expect(result.winningSource).toBe("rule");
    expect(result.rule?.pattern).toBe("shop.example.com");
    expect(result.location?.label).toBe("Paris");
    expect(result.locationProfileActive).toBe(false);
  });

  it("resolves the Default Rule when no domain rule or trusted site matches", () => {
    const result = resolveRulePreview({
      hostname: "unknown.test",
      cookieStoreId: undefined,
      rules: [],
      locations: profiles,
      trustedSites: [],
      globalFallbackRule: {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "seed123",
      },
    });

    expect(result.winningSource).toBe("fallback");
    expect(result.rule).toBeNull();
    expect(result.fallbackRule?.ruleSeedKey).toBe("seed123");
    expect(result.location?.label).toBe("Warsaw");
    expect(result.locationProfileActive).toBe(true);
  });

  it("keeps the Default Rule visible in preview when it only disables geolocation without a preset", () => {
    const result = resolveRulePreview({
      hostname: "unknown.test",
      cookieStoreId: undefined,
      rules: [],
      locations: profiles,
      trustedSites: [],
      globalFallbackRule: {
        enabled: true,
        fingerprintSurfaceOverrides: { geolocation: false },
        ruleSeedKey: "seed123",
      },
    });

    expect(result.winningSource).toBe("fallback");
    expect(result.fallbackRule?.ruleSeedKey).toBe("seed123");
    expect(result.location).toBeNull();
    expect(result.locationProfileActive).toBe(false);
  });
});
