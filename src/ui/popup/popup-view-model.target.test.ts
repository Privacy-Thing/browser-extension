import { describe, expect, it } from "vitest";

import { buildEffectiveSummary } from "@/background/popup-effective-summary";
import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { DEFAULT_CONTAINER_ICON } from "@/shared/firefox-containers";
import type { ContainerPresentation, PopupState } from "@/shared/types";
import {
  POPUP_PRESENTATION_KINDS,
  derivePopupViewModel,
  getIdentityBlockReason,
  getPopupBrandThingPose,
  getInitialLocationId,
  getInitialRuleMode,
  getTargetPattern,
  resolvePresentationKind,
  type PopupPresentationKind,
} from "@/ui/popup/popup-view-model";
import { createPopupStoryState } from "@/ui/popup/stories/popup-story-fixtures";

const baseContainer: ContainerPresentation = {
  cookieStoreId: "firefox-container-1",
  name: "Work",
  icon: DEFAULT_CONTAINER_ICON,
  iconUrl: "/icons/briefcase.svg",
  color: "orange",
  colorCode: "#f59e0b",
};

const createEffectiveSummary = ({
  source = "none",
  pattern = null,
  enabled = null,
  supported = true,
  panicMode = false,
}: {
  source?: PopupState["effectiveSummary"]["resolutionContext"]["source"];
  pattern?: string | null;
  enabled?: boolean | null;
  supported?: boolean;
  panicMode?: boolean;
} = {}): PopupState["effectiveSummary"] =>
  buildEffectiveSummary({
    generation: 1,
    source,
    pattern,
    enabled,
    editable: source === "site-rule",
    toggleable: source !== "none" && source !== "trusted-site",
    panicMode,
    supported,
    snapshot: null,
    suggestions: [],
    attentionKinds: [],
  });

const createPopupState = (
  overrides: Partial<Omit<PopupState, "currentRule" | "currentTab">> & {
    currentRule?: Partial<PopupState["currentRule"]>;
    currentTab?: Partial<PopupState["currentTab"]>;
  } = {},
): PopupState => {
  const { currentRule, currentTab, ...rest } = overrides;

  return {
    panicMode: false,
    effectiveSummary: createEffectiveSummary(),
    availableLocations: [
      { id: "warsaw", label: "Warsaw", language: "pl", languages: ["pl", "en"] },
    ],
    currentRule: {
      pattern: null,
      enabled: null,
      type: null,
      canToggle: false,
      canEdit: false,
      isExplicit: false,
      blockServiceWorkerRegistration: false,
      regionalPresetEnabled: true,
      relaxCspForWorkers: false,
      ...currentRule,
    },
    currentTab: {
      supported: true,
      hostname: "example.com",
      url: "https://example.com",
      locationLabel: null,
      locationId: null,
      locationProfileActive: false,
      fallbackState: "disabled",
      matchedRulePattern: null,
      hasExactRule: false,
      canCleanDomain: true,
      pendingRulePattern: "example.com",
      hasMatch: false,
      activeContainer: null,
      winningSource: "none",
      firefoxFirstInlinePermissionRequired: false,
      firefoxFirstInlineEnabled: false,
      ...currentTab,
    },
    suggestions: [],
    hasSuggestionWarning: false,
    notifications: [],
    hasUnreadNotification: false,
    ...rest,
  };
};

const siteRuleState = (enabled: boolean): PopupState =>
  createPopupState({
    effectiveSummary: createEffectiveSummary({
      source: "site-rule",
      pattern: "example.com",
      enabled,
    }),
    currentRule: {
      pattern: "example.com",
      locationId: "warsaw",
      enabled,
      type: "exact",
      canToggle: true,
      canEdit: true,
      isExplicit: true,
    },
    currentTab: {
      locationLabel: enabled ? "Warsaw" : null,
      locationId: enabled ? "warsaw" : null,
      locationProfileActive: enabled,
      hasMatch: enabled,
      winningSource: enabled ? "rule" : "none",
    },
  });

const containerState = ({
  configured,
  locationProfileActive,
  fallbackState = "disabled",
  winningSource,
}: {
  configured?: boolean;
  locationProfileActive: boolean;
  fallbackState?: NonNullable<PopupState["currentTab"]["fallbackState"]>;
  winningSource: NonNullable<PopupState["currentTab"]["winningSource"]>;
}): PopupState => {
  const defaultRuleWins = winningSource === "fallback";
  const source =
    winningSource === "container"
      ? "container"
      : defaultRuleWins
        ? "default-rule"
        : "none";
  const hasPreset =
    locationProfileActive &&
    (winningSource === "container" || fallbackState === "active");
  return createPopupState({
    effectiveSummary: createEffectiveSummary({
      source,
      enabled: source === "none" ? null : true,
    }),
    currentRule: {
      enabled: configured === false ? false : source === "none" ? null : true,
      canToggle: configured === true || defaultRuleWins,
    },
    currentTab: {
      activeContainer: baseContainer,
      ...(configured !== undefined
        ? { containerAssignmentConfigured: configured }
        : {}),
      locationProfileActive,
      locationId: hasPreset ? "warsaw" : null,
      locationLabel: hasPreset ? "Warsaw" : null,
      fallbackState,
      hasMatch: source !== "none",
      winningSource,
    },
  });
};

const fallbackState = (
  state: NonNullable<PopupState["currentTab"]["fallbackState"]>,
): PopupState => {
  const active = state === "active" || state === "protections";
  return createPopupState({
    effectiveSummary: createEffectiveSummary({
      source: "default-rule",
      enabled: state !== "disabled",
    }),
    currentRule: { enabled: state !== "disabled", canToggle: true },
    currentTab: {
      fallbackState: state,
      winningSource: active ? "fallback" : "none",
      hasMatch: active,
      locationProfileActive: state === "active",
      locationId: state === "active" ? "warsaw" : null,
      locationLabel: state === "active" ? "Warsaw" : null,
    },
  });
};

type VariantExpectation = {
  kind: PopupPresentationKind;
  state: PopupState | null;
  powerLabel: string;
  powerTarget: string;
  powerAriaLabel: string;
  source: string;
  preset?: string;
  primaryCta?: string;
  footerCta?: string;
  secondaryCta?: string;
};

const VARIANTS: readonly VariantExpectation[] = [
  {
    kind: "loading",
    state: null,
    powerLabel: BRAND_DISPLAY_NAME,
    powerTarget: "Checking this site’s settings…",
    powerAriaLabel: "Checking this site’s settings",
    source: "",
  },
  {
    kind: "panic",
    state: createPopupState({
      panicMode: true,
      effectiveSummary: createEffectiveSummary({ panicMode: true }),
    }),
    powerLabel: BRAND_DISPLAY_NAME,
    powerTarget: "Privacy Thing is off on every site.",
    powerAriaLabel: "Privacy Thing is off on every site",
    source: "No active rule",
    primaryCta: "Turn Privacy Thing on",
  },
  {
    kind: "unsupported",
    state: createPopupState({
      effectiveSummary: createEffectiveSummary({ supported: false }),
      currentTab: { supported: false, hostname: null, url: "chrome://extensions" },
    }),
    powerLabel: "Restricted page",
    powerTarget: "Privacy Thing can’t access this page.",
    powerAriaLabel: "Privacy Thing can’t access this page",
    source: "No active rule",
  },
  {
    kind: "trusted-site",
    state: createPopupState({
      effectiveSummary: createEffectiveSummary({
        source: "trusted-site",
        pattern: "example.com",
        enabled: false,
      }),
      currentTab: {
        hasMatch: true,
        winningSource: "trusted-site",
        matchedTrustedSitePattern: "example.com",
      },
    }),
    powerLabel: "Trusted Site",
    powerTarget: "Privacy Thing is off because this site matches Trusted Sites.",
    powerAriaLabel: "Turn on Privacy Thing for this site",
    source: "Trusted Site",
    footerCta: "Edit Trusted Site",
  },
  {
    kind: "rule-active",
    state: siteRuleState(true),
    powerLabel: "Domain Rule",
    powerTarget: "Turns this Domain Rule on or off.",
    powerAriaLabel: "Turn off this Domain Rule",
    source: "Domain Rule",
    preset: "Warsaw",
    primaryCta: "Edit Domain Rule",
  },
  {
    kind: "rule-inactive",
    state: siteRuleState(false),
    powerLabel: "Domain Rule",
    powerTarget: "Turns this Domain Rule on or off.",
    powerAriaLabel: "Turn on this Domain Rule",
    source: "Domain Rule",
    preset: "No active preset",
    primaryCta: "Edit Domain Rule",
  },
  {
    kind: "container-active",
    state: containerState({
      configured: true,
      locationProfileActive: true,
      winningSource: "container",
    }),
    powerLabel: "Firefox Container",
    powerTarget: "Turns this Firefox Container assignment on or off.",
    powerAriaLabel: "Turn off this Firefox Container assignment",
    source: "Firefox Container",
    preset: "Warsaw",
    primaryCta: "Edit Container",
    footerCta: "Add Site Rule",
    secondaryCta: "Add to Trusted Sites",
  },
  {
    kind: "container-protections",
    state: containerState({
      configured: true,
      locationProfileActive: false,
      winningSource: "container",
    }),
    powerLabel: "Firefox Container",
    powerTarget: "Turns this Firefox Container assignment on or off.",
    powerAriaLabel: "Turn off this Firefox Container assignment",
    source: "Firefox Container",
    primaryCta: "Edit Container",
    footerCta: "Add Site Rule",
    secondaryCta: "Add to Trusted Sites",
  },
  {
    kind: "container-inactive",
    state: containerState({
      configured: true,
      locationProfileActive: false,
      winningSource: "none",
    }),
    powerLabel: "Firefox Container",
    powerTarget: "Turns this Firefox Container assignment on or off.",
    powerAriaLabel: "Turn on this Firefox Container assignment",
    source: "No active rule",
    preset: "No active preset",
    primaryCta: "Edit Container",
    footerCta: "Add Site Rule",
  },
  {
    kind: "container-unconfigured",
    state: containerState({ locationProfileActive: false, winningSource: "none" }),
    powerLabel: "Firefox Container",
    powerTarget: "Set up Privacy Thing for this Firefox Container.",
    powerAriaLabel: "Set up Privacy Thing for this Firefox Container",
    source: "No active rule",
    preset: "No preset assigned",
    primaryCta: "Set up Container",
    footerCta: "Add Site Rule",
  },
  {
    kind: "container-unconfigured-default",
    state: containerState({
      locationProfileActive: true,
      fallbackState: "active",
      winningSource: "fallback",
    }),
    powerLabel: "Default Rule",
    powerTarget: "This Firefox Container uses the Default Rule.",
    powerAriaLabel: "Turn off the Default Rule",
    source: "Default Rule",
    preset: "Warsaw",
    primaryCta: "Set up Container",
    footerCta: "Add Site Rule",
    secondaryCta: "Add to Trusted Sites",
  },
  {
    kind: "container-unconfigured-default-protections",
    state: containerState({
      locationProfileActive: false,
      fallbackState: "protections",
      winningSource: "fallback",
    }),
    powerLabel: "Default Rule",
    powerTarget: "This Firefox Container uses the Default Rule.",
    powerAriaLabel: "Turn off the Default Rule",
    source: "Default Rule",
    preset: "No preset assigned",
    primaryCta: "Set up Container",
    footerCta: "Add Site Rule",
    secondaryCta: "Add to Trusted Sites",
  },
  {
    kind: "container-unconfigured-default-unconfigured",
    state: containerState({
      locationProfileActive: false,
      fallbackState: "unconfigured",
      winningSource: "none",
    }),
    powerLabel: "Default Rule",
    powerTarget: "This Firefox Container uses the Default Rule.",
    powerAriaLabel: "Turn on the Default Rule",
    source: "No active rule",
    preset: "No preset assigned",
    primaryCta: "Set up Container",
    footerCta: "Add Site Rule",
  },
  {
    kind: "fallback-active",
    state: fallbackState("active"),
    powerLabel: "Default Rule",
    powerTarget: "Controls sites without a Domain Rule or Trusted Site.",
    powerAriaLabel: "Turn off the Default Rule",
    source: "Default Rule",
    preset: "Warsaw",
    primaryCta: "Edit Default Rule",
    footerCta: "Add Site Rule",
    secondaryCta: "Add to Trusted Sites",
  },
  {
    kind: "fallback-protections",
    state: fallbackState("protections"),
    powerLabel: "Default Rule",
    powerTarget: "Controls sites without a Domain Rule or Trusted Site.",
    powerAriaLabel: "Turn off the Default Rule",
    source: "Default Rule",
    primaryCta: "Edit Default Rule",
    footerCta: "Add Site Rule",
    secondaryCta: "Add to Trusted Sites",
  },
  {
    kind: "fallback-inactive",
    state: fallbackState("disabled"),
    powerLabel: "Default Rule",
    powerTarget: "Controls sites without a Domain Rule or Trusted Site.",
    powerAriaLabel: "Turn on the Default Rule",
    source: "Default Rule",
    primaryCta: "Edit Default Rule",
    footerCta: "Add Site Rule",
  },
  {
    kind: "fallback-unconfigured",
    state: fallbackState("unconfigured"),
    powerLabel: "Default Rule",
    powerTarget: "Controls sites without a Domain Rule or Trusted Site.",
    powerAriaLabel: "Turn on the Default Rule",
    source: "Default Rule",
    primaryCta: "Edit Default Rule",
    footerCta: "Add Site Rule",
  },
];

const ZZ_PRESENTATION_KINDS = new Set<PopupPresentationKind>([
  "panic",
  "unsupported",
  "trusted-site",
  "rule-inactive",
  "container-inactive",
  "container-unconfigured",
  "container-unconfigured-default-unconfigured",
  "fallback-inactive",
  "fallback-unconfigured",
]);

describe("derivePopupViewModel", () => {
  it("covers the complete 17-state presentation contract", () => {
    expect(VARIANTS.map((item) => item.kind)).toEqual(POPUP_PRESENTATION_KINDS);
  });

  it.each(VARIANTS)(
    "maps $kind to canonical power, source, preset, and CTA copy",
    (item) => {
      expect(resolvePresentationKind(item.state)).toBe(item.kind);
      const viewModel = derivePopupViewModel(item.state);
      expect(viewModel.powerLabel).toBe(item.powerLabel);
      expect(viewModel.powerTarget).toBe(item.powerTarget);
      expect(viewModel.powerAriaLabel).toBe(item.powerAriaLabel);
      expect(viewModel.powerTitle).toBe(item.powerAriaLabel);
      expect(viewModel.protectionSource).toBe(item.source);
      expect(viewModel.locationLabel).toBe(item.preset);
      expect(viewModel.ruleActionLabel).toBe(item.primaryCta);
      expect(viewModel.ruleFooterActionLabel).toBe(item.footerCta);
      expect(viewModel.secondaryActionLabel).toBe(item.secondaryCta);
      const expectedThingPose = ZZ_PRESENTATION_KINDS.has(item.kind) ? "zz" : "idle";
      expect(getPopupBrandThingPose(item.kind)).toBe(expectedThingPose);
      expect(viewModel.brandThingPose).toBe(expectedThingPose);
    },
  );

  it("uses a neutral tone for the additive Trusted Site exception action", () => {
    for (const item of VARIANTS.filter(
      (variant) => variant.secondaryCta === "Add to Trusted Sites",
    )) {
      expect(derivePopupViewModel(item.state).secondaryActionTone).toBe("secondary");
    }
  });

  it("derives friendly primary and priority language names from the active preset", () => {
    const state = siteRuleState(true);
    state.availableLocations = [
      {
        id: "warsaw",
        label: "Ottawa",
        language: "en-CA",
        languages: ["en-CA", "en", "fr-CA"],
      },
    ];
    const viewModel = derivePopupViewModel(state);

    expect(viewModel.primaryLanguageLabel).toBe("English (Canada)");
    expect(viewModel.languagePrioritiesTitle).toBe(
      "Language priority:\n1. English (Canada)\n2. English\n3. French (Canada)",
    );
  });

  it("keeps the Firefox first-load warning separate from Domain Rule actions", () => {
    const state = siteRuleState(true);
    state.currentTab.firefoxFirstInlinePermissionRequired = true;

    const viewModel = derivePopupViewModel(state);

    expect(viewModel.showFirefoxWarning).toBe(true);
    expect(viewModel.ruleActionIntent).toBe("open-rule-options");
    expect(viewModel.ruleActionLabel).toBe("Edit Domain Rule");
  });

  it("keeps Trusted Site authoritative over the Firefox permission notice", () => {
    const state = VARIANTS.find((item) => item.kind === "trusted-site")?.state;
    if (!state) throw new Error("Missing Trusted Site fixture.");
    state.currentTab.firefoxFirstInlinePermissionRequired = true;

    expect(derivePopupViewModel(state).showFirefoxWarning).toBe(false);
  });

  it("counts a generic worker compatibility issue as attention without internal worker wording", () => {
    const state = siteRuleState(true);
    state.effectiveSummary = buildEffectiveSummary({
      generation: 1,
      source: "site-rule",
      pattern: "example.com",
      enabled: true,
      editable: true,
      toggleable: true,
      panicMode: false,
      supported: true,
      snapshot: null,
      suggestions: [
        {
          kind: "worker-csp-relaxation",
          status: "pending",
          rediscovered: false,
          detectionCount: 1,
          lastDetectedAt: "2026-07-13T02:00:00.000Z",
        },
      ],
      attentionKinds: ["worker-csp-relaxation"],
    });

    const viewModel = derivePopupViewModel(state);
    // A null snapshot is `pending` ("confirming"), not `unknown` — installation
    // hasn't been confirmed yet (#111). serviceWorker is not modified by default.
    expect(viewModel.protectionCounts).toBe(
      BUILD_BROWSER_TARGET === "firefox"
        ? "10 confirming · 1 not modified · 2 not applicable"
        : "12 confirming · 1 not modified",
    );
  });

  it("keeps contextual compatibility warnings separate from protection", () => {
    const state = createPopupStoryState("rule-active", "all-policy-risks");
    if (!state) throw new Error("Missing popup fixture.");
    state.effectiveSummary.surfaceSummary.highestPriorityContext =
      state.effectiveSummary.surfaceSummary.highestPriorityAttention;
    state.effectiveSummary.surfaceSummary.highestPriorityAttention = null;

    const viewModel = derivePopupViewModel(state);

    expect(viewModel.protectionTitle).toBe("Protected");
    expect(viewModel.protectionException).toBe("This page may not work correctly");
    expect(viewModel.protectionCounts).toBe(
      BUILD_BROWSER_TARGET === "firefox"
        ? "11 protected · 2 not applicable"
        : "13 protected",
    );
  });

  it("publishes the protected count that the rendered label shows", () => {
    const state = createPopupStoryState("rule-active", "all-policy-risks");
    if (!state) throw new Error("Missing popup fixture.");

    const viewModel = derivePopupViewModel(state);

    // `protectedSurfaceCount` is what E2E asserts through `data-protected-count`,
    // and it is a rollup rather than `counts.protected`. Pin it to the number the
    // label renders so the attribute and the sentence cannot drift apart.
    expect(viewModel.protectionCounts).toMatch(
      new RegExp(`^${viewModel.protectedSurfaceCount} protected\\b`),
    );
    expect(viewModel.protectedSurfaceCount).toBeGreaterThan(
      state.effectiveSummary.surfaceSummary.counts.protected - 1,
    );
  });

  it("presents a saved rule as dormant while global protections are off", () => {
    const state = siteRuleState(true);
    state.effectiveSummary = buildEffectiveSummary({
      generation: 1,
      source: "site-rule",
      pattern: "example.com",
      enabled: false,
      editable: true,
      toggleable: true,
      panicMode: false,
      supported: true,
      snapshot: null,
      suggestions: [],
      runtimeExpected: false,
      attentionKinds: [],
    });
    state.currentTab.matchedTrustedSitePattern = "*.example.com";
    state.currentTab.matchedTrustedSiteEnabled = false;

    const viewModel = derivePopupViewModel(state);

    expect(viewModel.globalProtectionsOff).toBe(true);
    expect(viewModel.protectionStatus).toBe("off");
    expect(viewModel.ruleTone).toBe("disabled");
    expect(viewModel.powerTone).toBe("disabled");
    expect(viewModel.protectionTitle).toBe("Protections disabled");
    expect(viewModel.powerLabel).toBe("Global protections");
    expect(viewModel.powerTarget).toBe(
      "Enable them in Settings to use your saved rules and presets.",
    );
    expect(viewModel.powerTitle).toBe(
      "Global protections are disabled. Enable them in Settings.",
    );
    expect(viewModel.protectionSource).toBe("Global setting");
    expect(viewModel.protectionCounts).toBe(
      BUILD_BROWSER_TARGET === "firefox"
        ? "11 not modified · 2 not applicable"
        : "13 not modified",
    );
    expect(viewModel.locationLabel).toBeUndefined();
    expect(viewModel.primaryLanguageLabel).toBeUndefined();
    expect(viewModel.secondaryActionIntent).toBe("none");
    expect(viewModel.secondaryActionLabel).toBeUndefined();
  });

  it("uses a danger card and degraded title for a confirmed protection failure", () => {
    const state = createPopupStoryState("rule-active", "runtime-degraded");
    if (!state) throw new Error("Missing popup fixture.");

    const viewModel = derivePopupViewModel(state);

    expect(viewModel.protectionTitle).toBe("Degraded");
    expect(viewModel.ruleTone).toBe("danger");
  });

  it("offers to re-enable the most specific disabled Trusted Site match", () => {
    const state = siteRuleState(true);
    state.currentTab.matchedTrustedSitePattern = "*.example.com";
    state.currentTab.matchedTrustedSiteEnabled = false;

    const viewModel = derivePopupViewModel(state);
    expect(viewModel.secondaryActionLabel).toBe("Add to Trusted Sites");
    expect(viewModel.secondaryFooterAction.target).toBe("*.example.com");
  });
});

describe("New identity availability", () => {
  it.each([
    [null, "Available after the site finishes loading"],
    [
      VARIANTS.find((item) => item.kind === "unsupported")?.state ?? null,
      "Unavailable on this page",
    ],
    [
      VARIANTS.find((item) => item.kind === "trusted-site")?.state ?? null,
      "Unavailable while Privacy Thing is off for this site",
    ],
    [
      VARIANTS.find((item) => item.kind === "panic")?.state ?? null,
      "Unavailable while Privacy Thing is off for this site",
    ],
    [
      VARIANTS.find((item) => item.kind === "container-unconfigured")?.state ?? null,
      "Set up this Firefox Container first",
    ],
    [
      VARIANTS.find((item) => item.kind === "fallback-active")?.state ?? null,
      "Unavailable for the Default Rule",
    ],
  ] as const)("returns the contextual disabled reason", (state, expected) => {
    expect(getIdentityBlockReason(state)).toBe(expected);
  });

  it("remains available for direct Domain Rules and configured Firefox Containers", () => {
    expect(getIdentityBlockReason(siteRuleState(true))).toBeNull();
    expect(
      getIdentityBlockReason(
        containerState({
          configured: true,
          locationProfileActive: true,
          winningSource: "container",
        }),
      ),
    ).toBeNull();
  });
});

describe("Domain Rule sheet targeting", () => {
  it("defaults new rules to the current host and its subdomains", () => {
    expect(getInitialRuleMode(createPopupState())).toBe("suffix");
  });

  it("prefers the saved rule preset, match mode, and pattern", () => {
    const state = siteRuleState(true);
    state.currentRule.pattern = "*.example.com";
    state.currentRule.type = "suffix";

    expect(getInitialLocationId(state)).toBe("warsaw");
    expect(getInitialRuleMode(state)).toBe("suffix");
    expect(getTargetPattern(state)).toBe("*.example.com");
  });
});
