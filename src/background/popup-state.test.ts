import { describe, expect, it } from "vitest";

import {
  applyRegionalPreset,
  applyServiceWorkerRule,
  applyWorkerMode,
  buildPopupRuleSaveTarget as buildPopupRuleSaveTargetImpl,
  createSuggestionRule,
  getPopupCurrentRule,
  resolvePopupSurfaceState,
  getTransparentRule,
  resolvePopupResolution as resolvePopupResolutionImpl,
  getSuggestionTarget,
  showInactiveRule,
} from "@/background/popup-state";

describe("applyRegionalPreset", () => {
  it("preserves partial advanced overrides when the popup selection was unchanged", () => {
    const overrides = { geolocation: false, timeLocale: true, canvas: false } as const;
    expect(applyRegionalPreset(overrides, undefined)).toBe(overrides);
  });

  it("disables both regional surfaces while preserving unrelated overrides", () => {
    expect(applyRegionalPreset({ canvas: false }, false)).toEqual({
      canvas: false,
      geolocation: false,
      timeLocale: false,
    });
  });

  it("restores inheritance for both regional surfaces", () => {
    expect(
      applyRegionalPreset(
        {
          canvas: false,
          geolocation: false,
          timeLocale: false,
        },
        true,
      ),
    ).toEqual({ canvas: false });
  });
});

describe("applyServiceWorkerRule", () => {
  it("preserves the Options tri-state semantics", () => {
    expect(applyServiceWorkerRule({ canvas: false }, true)).toEqual({
      canvas: false,
      serviceWorker: true,
    });
    expect(
      applyServiceWorkerRule({ canvas: false, serviceWorker: true }, false),
    ).toEqual({
      canvas: false,
      serviceWorker: false,
    });
    expect(
      applyServiceWorkerRule({ canvas: false, serviceWorker: false }, undefined),
    ).toEqual({
      canvas: false,
    });
    expect(applyServiceWorkerRule({ serviceWorker: true }, undefined)).toBeUndefined();
  });
});

describe("applyWorkerMode", () => {
  it("preserves, replaces, and clears the per-rule worker mode", () => {
    expect(applyWorkerMode({ canvas: false }, "strict")).toEqual({
      canvas: false,
      sharedWorker: "strict",
    });
    expect(
      applyWorkerMode({ canvas: false, sharedWorker: "strict" }, "native"),
    ).toEqual({
      canvas: false,
      sharedWorker: "native",
    });
    expect(
      applyWorkerMode({ canvas: false, sharedWorker: "spoof" }, undefined),
    ).toEqual({ canvas: false });
    expect(applyWorkerMode({ sharedWorker: "strict" }, undefined)).toBeUndefined();
  });
});

// Test wrapper: defaults the trailing trustedSites + fingerprintEnabled
// (now required in production) so existing cases keep their prior behavior.
type ResolutionInput = Parameters<typeof resolvePopupResolutionImpl>[0];
const resolvePopupResolution = (
  hostname: string,
  rules: ResolutionInput["rules"],
  containerAssignment: ResolutionInput["containerAssignment"],
  globalFallbackRule: ResolutionInput["globalFallbackRule"],
  fallbackLocationId: ResolutionInput["fallbackLocationId"],
  trustedSites: NonNullable<ResolutionInput["trustedSites"]> = [],
  fingerprintEnabled = false,
) =>
  resolvePopupResolutionImpl({
    hostname,
    rules,
    containerAssignment,
    globalFallbackRule,
    fallbackLocationId,
    trustedSites,
    fingerprintEnabled,
  });

type RuleSaveInput = Parameters<typeof buildPopupRuleSaveTargetImpl>[0];
const buildPopupRuleSaveTarget = (
  hostname: string,
  locationId: string | undefined,
  patternMode: RuleSaveInput["patternMode"],
  resolution: RuleSaveInput["resolution"],
  blockServiceWorkers: boolean,
  relaxCspForWorkers: boolean,
  createExactOverride = false,
  serviceWorkerOverride?: boolean | null,
  regionalPresetEnabled?: boolean,
  workerHandlingOverride?: RuleSaveInput["workerHandlingOverride"],
) =>
  buildPopupRuleSaveTargetImpl({
    hostname,
    locationId,
    patternMode,
    resolution,
    blockServiceWorkers,
    relaxCspForWorkers,
    createExactOverride,
    ...(serviceWorkerOverride !== undefined ? { serviceWorkerOverride } : {}),
    ...(regionalPresetEnabled !== undefined ? { regionalPresetEnabled } : {}),
    ...(workerHandlingOverride !== undefined ? { workerHandlingOverride } : {}),
  });

describe("resolvePopupResolution", () => {
  it("keeps disabled exact rules selectable without masking the active broader rule", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [
        { pattern: "shop.example.com", locationId: "exact", enabled: false },
        { pattern: "*.example.com", locationId: "broad", enabled: true },
      ],
      null,
      undefined,
      null,
    );

    expect(resolution.displayedRule?.pattern).toBe("shop.example.com");
    expect(resolution.displayedRule?.enabled).toBe(false);
    expect(resolution.activeRule?.pattern).toBe("*.example.com");
    expect(resolution.winningSource).toBe("rule");
    expect(resolution.effectiveLocationId).toBe("broad");
    expect(resolution.locationProfileActive).toBe(true);
    expect(resolution.containerAssignmentConfigured).toBe(false);
    expect(resolution.matchedRulePattern).toBe("*.example.com");
    expect(resolution.hasExactRule).toBe(false);
    expect(resolution.hasMatch).toBe(true);
  });

  it("returns the active winning rule for popup state when a broader rule wins", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [
        { pattern: "shop.example.com", locationId: "exact", enabled: false },
        { pattern: "*.example.com", locationId: "broad", enabled: true },
      ],
      null,
      undefined,
      null,
    );

    expect(getPopupCurrentRule(resolution)?.pattern).toBe("*.example.com");
    expect(showInactiveRule(resolution)).toBe(false);
  });

  it("preserves a winning domain rule while exposing disabled geolocation state", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [
        {
          pattern: "shop.example.com",
          locationId: "exact",
          enabled: true,
          fingerprintSurfaceOverrides: { geolocation: false, timeLocale: false },
        },
      ],
      null,
      undefined,
      null,
    );

    expect(resolution.winningSource).toBe("rule");
    expect(resolution.effectiveLocationId).toBe("exact");
    expect(resolution.locationProfileActive).toBe(false);
  });

  it("treats the geolocation surface override as disabling popup location activity", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [
        {
          pattern: "shop.example.com",
          locationId: "exact",
          enabled: true,
          fingerprintSurfaceOverrides: { geolocation: false, timeLocale: false },
        },
      ],
      null,
      undefined,
      null,
    );

    expect(resolution.winningSource).toBe("rule");
    expect(resolution.effectiveLocationId).toBe("exact");
    expect(resolution.locationProfileActive).toBe(false);
  });

  it("keeps the disabled displayed rule as the popup state when nothing else wins", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [{ pattern: "shop.example.com", locationId: "exact", enabled: false }],
      null,
      undefined,
      null,
    );

    expect(getPopupCurrentRule(resolution)?.pattern).toBe("shop.example.com");
    expect(showInactiveRule(resolution)).toBe(true);
  });

  it("creates an exact popup suggestion rule instead of mutating the winning wildcard", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [
        { pattern: "shop.example.com", locationId: "exact", enabled: false },
        {
          pattern: "*.example.com",
          locationId: "broad",
          enabled: true,
          ruleSeedKey: "seed-1",
        },
      ],
      null,
      undefined,
      null,
    );

    expect(getSuggestionTarget("shop.example.com", resolution, null)).toEqual({
      sourceRule: {
        pattern: "*.example.com",
        locationId: "broad",
        enabled: true,
        ruleSeedKey: "seed-1",
      },
      rulePatternToReplace: null,
      nextPattern: "shop.example.com",
      nextEnabled: true,
      locationId: "broad",
      allowsMissingLocationId: false,
    });
  });

  it("mints a new rule identity when popup suggestions narrow a wildcard", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [
        { pattern: "shop.example.com", locationId: "exact", enabled: false },
        {
          pattern: "*.example.com",
          locationId: "broad",
          enabled: true,
          ruleSeedKey: "seed-1",
        },
      ],
      null,
      undefined,
      null,
    );

    const mutationTarget = getSuggestionTarget("shop.example.com", resolution, null);

    expect(createSuggestionRule(mutationTarget)).toEqual({
      pattern: "shop.example.com",
      locationId: "broad",
      enabled: true,
      relaxCspForWorkers: true,
    });
  });

  it("creates a new exact rule for popup suggestions when only a disabled exact rule is displayed", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [{ pattern: "shop.example.com", locationId: "exact", enabled: false }],
      null,
      undefined,
      null,
    );

    expect(getSuggestionTarget("shop.example.com", resolution, null)).toEqual({
      sourceRule: {
        pattern: "shop.example.com",
        locationId: "exact",
        enabled: false,
      },
      rulePatternToReplace: "shop.example.com",
      nextPattern: "shop.example.com",
      nextEnabled: true,
      locationId: "exact",
      allowsMissingLocationId: false,
    });
  });

  it("creates an inheriting exact rule for popup suggestions when the Default Rule wins", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      null,
      { enabled: true, locationId: "fallback-location", ruleSeedKey: "fallback-seed" },
      "fallback-location",
    );

    expect(getSuggestionTarget("shop.example.com", resolution, null)).toEqual({
      sourceRule: null,
      rulePatternToReplace: null,
      nextPattern: "shop.example.com",
      nextEnabled: true,
      locationId: null,
      allowsMissingLocationId: true,
    });
  });

  it("does not leak a disabled container location into fallback suggestion targets", () => {
    const containerAssignment = {
      cookieStoreId: "firefox-container-1",
      locationId: "container-location",
      enabled: false,
    };
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      containerAssignment,
      { enabled: true, locationId: "fallback-location", ruleSeedKey: "fallback-seed" },
      "fallback-location",
    );

    expect(
      getSuggestionTarget("shop.example.com", resolution, containerAssignment),
    ).toEqual({
      sourceRule: null,
      rulePatternToReplace: null,
      nextPattern: "shop.example.com",
      nextEnabled: true,
      locationId: null,
      allowsMissingLocationId: true,
    });
  });

  it("preserves hidden disabled exact-rule metadata during transparent replacement", () => {
    const hiddenDisabledExactRule = {
      pattern: "shop.example.com",
      locationId: "hidden-exact",
      enabled: false,
      ruleSeedKey: "seed-hidden",
      relaxCspForWorkers: true,
      fingerprintSurfaceOverrides: { canvas: false, serviceWorker: true },
    };
    const containerAssignment = {
      cookieStoreId: "firefox-container-1",
      locationId: "container-location",
    };
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [hiddenDisabledExactRule],
      containerAssignment,
      undefined,
      null,
    );

    const result = buildPopupRuleSaveTarget(
      "shop.example.com",
      "saved-location",
      "exact",
      resolution,
      false,
      false,
    );

    expect(result.currentRule).toBeNull();
    expect(result.nextPattern).toBe("shop.example.com");
    expect(result.nextRule).toMatchObject({
      pattern: "shop.example.com",
      locationId: "saved-location",
      enabled: true,
      relaxCspForWorkers: true,
      fingerprintSurfaceOverrides: { canvas: false, serviceWorker: true },
    });
    expect(result.nextRule.ruleSeedKey).toMatch(/^[a-z0-9]{6}$/);
    expect(result.nextRule.ruleSeedKey).not.toBe("seed-hidden");

    expect(
      getTransparentRule("shop.example.com", "shop.example.com", resolution),
    ).toEqual(hiddenDisabledExactRule);
  });

  it("rotates ruleSeedKey when saving a rule with a different location", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [
        { pattern: "shop.example.com", locationId: "exact", enabled: false },
        {
          pattern: "*.example.com",
          locationId: "broad",
          enabled: true,
          ruleSeedKey: "seed-1",
        },
      ],
      null,
      undefined,
      null,
    );

    const result = buildPopupRuleSaveTarget(
      "shop.example.com",
      "updated-location",
      "suffix",
      resolution,
      true,
      false,
    );

    expect(result.currentRule).toEqual({
      pattern: "*.example.com",
      locationId: "broad",
      enabled: true,
      ruleSeedKey: "seed-1",
    });
    expect(result.nextPattern).toBe("*.example.com");
    expect(result.nextRule).toMatchObject({
      pattern: "*.example.com",
      locationId: "updated-location",
      enabled: true,
      relaxCspForWorkers: false,
      fingerprintSurfaceOverrides: { serviceWorker: true },
    });
    expect(result.nextRule.ruleSeedKey).toMatch(/^[a-z0-9]{6}$/);
    expect(result.nextRule.ruleSeedKey).not.toBe("seed-1");
  });

  it("creates an exact rule without location so it inherits the active source", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      null,
      { enabled: true, locationId: "fallback-location", ruleSeedKey: "fallback-seed" },
      "fallback-location",
    );

    expect(
      buildPopupRuleSaveTarget(
        "shop.example.com",
        undefined,
        "exact",
        resolution,
        false,
        false,
      ).nextRule,
    ).toEqual({
      pattern: "shop.example.com",
      enabled: true,
      relaxCspForWorkers: false,
    });
  });

  it("creates an exact rule that explicitly disables the inherited regional preset", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      null,
      { enabled: true, locationId: "fallback-location", ruleSeedKey: "fallback-seed" },
      "fallback-location",
    );

    expect(
      buildPopupRuleSaveTarget(
        "shop.example.com",
        undefined,
        "exact",
        resolution,
        false,
        false,
        false,
        undefined,
        false,
      ).nextRule,
    ).toEqual({
      pattern: "shop.example.com",
      enabled: true,
      relaxCspForWorkers: false,
      fingerprintSurfaceOverrides: {
        geolocation: false,
        timeLocale: false,
      },
    });
  });

  it("sets and clears the Dedicated and Shared Worker mode override", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [
        {
          pattern: "shop.example.com",
          enabled: true,
          fingerprintSurfaceOverrides: { sharedWorker: "native" },
        },
      ],
      null,
      undefined,
      null,
    );

    expect(
      buildPopupRuleSaveTarget(
        "shop.example.com",
        undefined,
        "exact",
        resolution,
        false,
        false,
        false,
        undefined,
        undefined,
        "strict",
      ).nextRule.fingerprintSurfaceOverrides,
    ).toEqual({ sharedWorker: "strict" });

    expect(
      buildPopupRuleSaveTarget(
        "shop.example.com",
        undefined,
        "exact",
        resolution,
        false,
        false,
        false,
        undefined,
        undefined,
        null,
      ).nextRule.fingerprintSurfaceOverrides,
    ).toBeUndefined();
  });

  it("creates a separate exact override without replacing its wildcard source", () => {
    const wildcardRule = {
      pattern: "*.example.com",
      locationId: "warsaw",
      enabled: true,
      ruleSeedKey: "wildcard-seed",
    };
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [wildcardRule],
      null,
      undefined,
      null,
    );

    const result = buildPopupRuleSaveTarget(
      "shop.example.com",
      "warsaw",
      "exact",
      resolution,
      false,
      false,
      true,
    );

    expect(result.currentRule).toBeNull();
    expect(result.nextPattern).toBe("shop.example.com");
    expect(result.nextRule.ruleSeedKey).not.toBe(wildcardRule.ruleSeedKey);
  });

  it("preserves ruleSeedKey when saving a rule without changing location", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [
        { pattern: "shop.example.com", locationId: "exact", enabled: false },
        {
          pattern: "*.example.com",
          locationId: "broad",
          enabled: true,
          ruleSeedKey: "seed-1",
        },
      ],
      null,
      undefined,
      null,
    );

    expect(
      buildPopupRuleSaveTarget(
        "shop.example.com",
        "broad",
        "suffix",
        resolution,
        true,
        false,
      ),
    ).toEqual({
      currentRule: {
        pattern: "*.example.com",
        locationId: "broad",
        enabled: true,
        ruleSeedKey: "seed-1",
      },
      nextPattern: "*.example.com",
      nextRule: {
        pattern: "*.example.com",
        locationId: "broad",
        enabled: true,
        ruleSeedKey: "seed-1",
        relaxCspForWorkers: false,
        fingerprintSurfaceOverrides: { serviceWorker: true },
      },
    });
  });

  it("keeps distinct conflicts surfaced during container-driven popup create mode", () => {
    const hiddenDisabledSuffixRule = {
      pattern: "*.example.com",
      locationId: "hidden-suffix",
      enabled: false,
    };
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [hiddenDisabledSuffixRule],
      {
        cookieStoreId: "firefox-container-1",
        locationId: "container-location",
      },
      undefined,
      null,
    );

    expect(
      getTransparentRule("shop.example.com", "shop.example.com", resolution),
    ).toBeNull();
  });

  it("uses the global fallback source when no rule or container assignment matches", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      null,
      { enabled: true, locationId: "fallback-location", ruleSeedKey: "fallback-seed" },
      "fallback-location",
    );

    expect(resolution.activeRule).toBeNull();
    expect(resolution.displayedRule).toBeNull();
    expect(resolution.winningSource).toBe("fallback");
    expect(resolution.effectiveLocationId).toBe("fallback-location");
    expect(resolution.fallbackState).toBe("active");
    expect(resolution.hasMatch).toBe(true);
    expect(getPopupCurrentRule(resolution)).toBeNull();
    expect(showInactiveRule(resolution)).toBe(false);
  });

  it("uses the trusted-site source before fallback or rules can win", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [{ pattern: "*.example.com", locationId: "broad", enabled: true }],
      null,
      { enabled: true, locationId: "fallback-location", ruleSeedKey: "fallback-seed" },
      "fallback-location",
      [{ pattern: "shop.example.com", enabled: true }],
    );

    expect(resolution.activeRule).toBeNull();
    expect(resolution.displayedRule).toBeNull();
    expect(resolution.winningSource).toBe("trusted-site");
    expect(resolution.matchedTrustedSitePattern).toBe("shop.example.com");
    expect(resolution.matchedTrustedSiteEnabled).toBe(true);
    expect(resolution.effectiveLocationId).toBeNull();
    expect(resolution.locationProfileActive).toBe(false);
    expect(resolution.hasMatch).toBe(true);
  });

  it("retains a disabled Trusted Site match while another source wins", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [{ pattern: "*.example.com", locationId: "broad", enabled: true }],
      null,
      undefined,
      null,
      [{ pattern: "shop.example.com", enabled: false }],
    );

    expect(resolution.winningSource).toBe("rule");
    expect(resolution.matchedTrustedSitePattern).toBe("shop.example.com");
    expect(resolution.matchedTrustedSiteEnabled).toBe(false);
  });

  it("treats disabled container assignments as configured but inactive", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      {
        cookieStoreId: "firefox-container-1",
        enabled: false,
        locationId: "container-location",
      },
      undefined,
      null,
    );

    expect(resolution.winningSource).toBe("none");
    expect(resolution.effectiveLocationId).toBeNull();
    expect(resolution.locationProfileActive).toBe(false);
    expect(resolution.containerAssignmentConfigured).toBe(true);
    expect(resolution.hasMatch).toBe(false);
  });

  it("keeps container protections active when its location profile is off", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      {
        cookieStoreId: "firefox-container-1",
        fingerprintSurfaceOverrides: { geolocation: false, timeLocale: false },
        locationId: "container-location",
      },
      undefined,
      null,
    );

    expect(resolution.winningSource).toBe("container");
    expect(resolution.effectiveLocationId).toBe("container-location");
    expect(resolution.locationProfileActive).toBe(false);
    expect(resolution.containerAssignmentConfigured).toBe(true);
    expect(resolution.hasMatch).toBe(true);
  });

  it("treats no-location container assignments as configured but inactive", () => {
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      {
        cookieStoreId: "firefox-container-1",
        fingerprintSurfaceOverrides: { geolocation: false },
      },
      undefined,
      null,
    );

    expect(resolution.winningSource).toBe("none");
    expect(resolution.effectiveLocationId).toBeNull();
    expect(resolution.locationProfileActive).toBe(false);
    expect(resolution.containerAssignmentConfigured).toBe(true);
    expect(resolution.hasMatch).toBe(false);
  });

  it("resolves inactive configured containers as container presentation state", () => {
    const containerAssignment = {
      cookieStoreId: "firefox-container-1",
      enabled: false,
      locationId: "container-location",
    };
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      containerAssignment,
      undefined,
      null,
    );

    expect(
      resolvePopupSurfaceState(resolution, containerAssignment, undefined, true),
    ).toEqual({
      presentationSource: "container",
      currentRule: null,
      currentRuleLocationId: "container-location",
      currentRuleEnabled: false,
      displayedLocationId: "container-location",
      locationProfileActive: false,
    });
  });

  it("keeps fallback as the display source inside a container when its assignment is disabled", () => {
    const containerAssignment = {
      cookieStoreId: "firefox-container-1",
      enabled: false,
      locationId: "container-location",
    };
    const globalFallbackRule = {
      enabled: true,
      locationId: "fallback-location",
      ruleSeedKey: "fallback-seed",
    };
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      containerAssignment,
      globalFallbackRule,
      "fallback-location",
    );

    expect(
      resolvePopupSurfaceState(
        resolution,
        containerAssignment,
        globalFallbackRule,
        true,
      ),
    ).toEqual({
      presentationSource: "fallback",
      currentRule: null,
      currentRuleLocationId: "fallback-location",
      currentRuleEnabled: true,
      displayedLocationId: "fallback-location",
      locationProfileActive: true,
    });
  });

  it("keeps preview-only fallback protections visible without a resolvable preset", () => {
    const globalFallbackRule = {
      enabled: true,
      fingerprintSurfaceOverrides: { timeLocale: false },
      ruleSeedKey: "fallback-seed",
    };
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      null,
      globalFallbackRule,
      null,
    );

    expect(resolution.winningSource).toBe("none");
    expect(resolution.effectiveLocationId).toBeNull();
    expect(resolution.locationProfileActive).toBe(false);
    expect(resolution.fallbackState).toBe("protections");
    expect(resolution.hasMatch).toBe(true);
  });

  it("treats fingerprint-only default-rule runtime as the winning fallback source", () => {
    const globalFallbackRule = {
      enabled: true,
      ruleSeedKey: "fallback-seed",
    };
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      null,
      globalFallbackRule,
      null,
      [],
      true,
    );

    expect(resolution.winningSource).toBe("fallback");
    expect(resolution.effectiveLocationId).toBeNull();
    expect(resolution.locationProfileActive).toBe(false);
    expect(resolution.fallbackState).toBe("protections");
    expect(resolution.hasMatch).toBe(true);
  });

  it("marks enabled fallback without preset or explicit protections as unconfigured", () => {
    const globalFallbackRule = {
      enabled: true,
      ruleSeedKey: "fallback-seed",
    };
    const resolution = resolvePopupResolution(
      "shop.example.com",
      [],
      null,
      globalFallbackRule,
      null,
    );

    expect(resolution.winningSource).toBe("none");
    expect(resolution.effectiveLocationId).toBeNull();
    expect(resolution.locationProfileActive).toBe(false);
    expect(resolution.fallbackState).toBe("unconfigured");
    expect(resolution.hasMatch).toBe(false);
  });
});
