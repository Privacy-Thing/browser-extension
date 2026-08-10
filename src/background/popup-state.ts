import {
  applyRegionalPreset,
  applyServiceWorkerBlock,
  applyServiceWorkerRule,
  applyWorkerMode,
} from "./popup-rule-overrides";

import { resolveSharedWorkerMode } from "@/shared/fingerprint-spoofing";
import type {
  SurfaceOverrides,
  SharedSpoofingConfig,
  SharedWorkerHandlingMode,
} from "@/shared/fingerprint-types";
import { resolveRuleSources } from "@/shared/rule-resolution";
import { createRuleSeedKey } from "@/shared/rule-seed";
import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
  PopupFallbackState,
  PopupSiteSuggestion,
  WorkerInjectionMode,
  SiteSuggestionKind,
  TrustedSite,
} from "@/shared/types";

export {
  applyRegionalPreset,
  applyServiceWorkerBlock,
  applyServiceWorkerRule,
  applyWorkerMode,
};

export type PopupRuleResolution = {
  activeRule: DomainRule | null;
  displayedRule: DomainRule | null;
  winningSource: "rule" | "container" | "fallback" | "trusted-site" | "none";
  effectiveLocationId: string | null;
  locationProfileActive: boolean;
  fallbackState: PopupFallbackState;
  containerAssignmentConfigured: boolean;
  matchedRulePattern: string | null;
  matchedTrustedSitePattern: string | null;
  matchedTrustedSiteEnabled: boolean | null;
  hasExactRule: boolean;
  hasMatch: boolean;
};

export type SuggestionMutationTarget = {
  sourceRule: DomainRule | null;
  rulePatternToReplace: string | null;
  nextPattern: string;
  nextEnabled: boolean;
  locationId: string | null;
  allowsMissingLocationId: boolean;
};

export type PopupRuleSaveTarget = {
  currentRule: DomainRule | null;
  nextPattern: string;
  nextRule: DomainRule;
};

export type PopupSurfaceState = {
  presentationSource: "rule" | "container" | "fallback" | "none";
  currentRule: DomainRule | null;
  currentRuleLocationId: string | null;
  currentRuleEnabled: boolean | null;
  displayedLocationId: string | null;
  locationProfileActive: boolean;
};

export type SiteSuggestionSelection = {
  items: PopupSiteSuggestion[];
  hasWarning: boolean;
};

const resolveNextRuleSeedKey = ({
  createExactOverride,
  locationId,
  sourceRule,
}: {
  createExactOverride: boolean;
  locationId: string | undefined;
  sourceRule: DomainRule | null;
}): string | undefined => {
  if (createExactOverride) return createRuleSeedKey();
  if (locationId && sourceRule?.locationId && sourceRule.locationId !== locationId) {
    return createRuleSeedKey();
  }
  return sourceRule?.ruleSeedKey;
};

const getPopupPatternMode = (pattern: string): "exact" | "suffix" =>
  pattern.startsWith("*") ? "suffix" : "exact";

const isLocationProfileActive = (
  locationId: string | null,
  overrides: SurfaceOverrides | undefined,
): boolean =>
  Boolean(locationId) &&
  (overrides?.geolocation !== false || overrides?.timeLocale !== false);

const hasProtectionOverrides = (overrides: SurfaceOverrides | undefined): boolean =>
  Object.values(overrides ?? {}).some((value) => value !== undefined);

export const filterRuleSuggestions = (
  suggestions: SiteSuggestionSelection,
  activeRule: DomainRule | null | undefined,
  workerMode?: SharedWorkerHandlingMode,
): SiteSuggestionSelection => {
  const suppressedKinds = new Set<SiteSuggestionKind>();
  if (activeRule?.relaxCspForWorkers) {
    suppressedKinds.add("worker-csp-relaxation");
  }

  if (
    activeRule?.fingerprintSurfaceOverrides?.sharedWorker === "native" ||
    activeRule?.fingerprintSurfaceOverrides?.sharedWorker === "spoof" ||
    workerMode === "native" ||
    workerMode === "spoof"
  ) {
    suppressedKinds.add("shared-worker-injection-relaxation");
  }

  if (suppressedKinds.size === 0) {
    return suggestions;
  }

  const items = suggestions.items.filter(
    (suggestion) => !suppressedKinds.has(suggestion.kind),
  );
  return {
    items,
    hasWarning: items.some(
      (suggestion) => suggestion.status === "dismissed" && suggestion.rediscovered,
    ),
  };
};

type PopupWorkerModeInput = {
  resolution: PopupRuleResolution;
  containerAssignment: ContainerAssignment | null;
  globalFallbackRule: GlobalFallbackRule | undefined;
  sharedSpoofing: SharedSpoofingConfig | undefined;
  preferenceMode: SharedWorkerHandlingMode;
};

export const resolvePopupWorkerMode = ({
  resolution,
  containerAssignment,
  globalFallbackRule,
  sharedSpoofing,
  preferenceMode,
}: PopupWorkerModeInput): SharedWorkerHandlingMode => {
  const source =
    resolution.activeRule ??
    (containerAssignment?.enabled !== false ? containerAssignment : undefined) ??
    (globalFallbackRule?.enabled !== false ? globalFallbackRule : undefined);
  return resolveSharedWorkerMode(
    sharedSpoofing,
    source?.fingerprintSurfaceOverrides,
    preferenceMode,
  );
};

/** Reads the effective per-rule SW block from a rule's surface overrides. */
export const isServiceWorkerBlocked = (
  overrides: SurfaceOverrides | undefined,
): boolean => overrides?.serviceWorker === true;

const hasFallbackProtections = (
  globalFallbackRule: GlobalFallbackRule | undefined,
  fallbackLocationId: string | null,
  fingerprintEnabled: boolean,
): boolean =>
  Boolean(
    globalFallbackRule &&
    globalFallbackRule.enabled !== false &&
    (fallbackLocationId || fingerprintEnabled),
  );

const resolveFallbackState = (
  fallbackLocationId: string | null,
  globalFallbackRule: GlobalFallbackRule | undefined,
  fingerprintEnabled: boolean,
): PopupFallbackState => {
  if (!globalFallbackRule || globalFallbackRule.enabled === false) {
    return "disabled";
  }

  if (
    isLocationProfileActive(
      fallbackLocationId,
      globalFallbackRule.fingerprintSurfaceOverrides,
    )
  ) {
    return "active";
  }

  if (
    fingerprintEnabled ||
    fallbackLocationId ||
    hasProtectionOverrides(globalFallbackRule.fingerprintSurfaceOverrides)
  ) {
    return "protections";
  }

  return "unconfigured";
};

const resolveWinningSource = (
  resolvedSources: ReturnType<typeof resolveRuleSources>,
  globalFallbackRule: GlobalFallbackRule | undefined,
  fallbackLocationId: string | null,
  fingerprintEnabled: boolean,
): PopupRuleResolution["winningSource"] => {
  if (resolvedSources.activeRule) {
    return "rule";
  }

  if (resolvedSources.usableContainer) {
    return "container";
  }

  return hasFallbackProtections(
    globalFallbackRule,
    fallbackLocationId,
    fingerprintEnabled,
  )
    ? "fallback"
    : "none";
};

const isLocationActive = (
  resolvedSources: ReturnType<typeof resolveRuleSources>,
  winningSource: PopupRuleResolution["winningSource"],
  fallbackState: PopupFallbackState,
  fallbackLocationId: string | null,
): boolean => {
  if (resolvedSources.activeRule) {
    return isLocationProfileActive(
      resolvedSources.effectiveLocationId ?? fallbackLocationId ?? null,
      resolvedSources.activeRule.fingerprintSurfaceOverrides,
    );
  }

  if (winningSource === "container") {
    return isLocationProfileActive(
      resolvedSources.effectiveLocationId,
      resolvedSources.usableContainer?.fingerprintSurfaceOverrides,
    );
  }

  return winningSource === "fallback" && fallbackState === "active";
};

const resolvePopupSavePattern = (
  hostname: string,
  patternMode: "exact" | "suffix",
  currentRule: DomainRule | null,
): string => {
  const hostnamePattern = patternMode === "suffix" ? `*${hostname}` : hostname;
  if (!currentRule) {
    return hostnamePattern;
  }

  if (getPopupPatternMode(currentRule.pattern) !== patternMode) {
    return hostnamePattern;
  }

  return currentRule.pattern;
};

export const getTransparentRule = (
  hostname: string,
  nextPattern: string,
  resolution: PopupRuleResolution,
): DomainRule | null => {
  if (resolution.winningSource !== "container" || resolution.activeRule) {
    return null;
  }

  const displayedRule = resolution.displayedRule;
  if (!displayedRule || displayedRule.enabled !== false) {
    return null;
  }

  if (displayedRule.pattern !== hostname || displayedRule.pattern !== nextPattern) {
    return null;
  }

  return displayedRule;
};

export const createSuggestionRule = (
  mutationTarget: SuggestionMutationTarget,
  options: {
    relaxCspForWorkers?: boolean;
    serviceWorkerOverride?: boolean;
    sharedWorkerHandlingMode?: WorkerInjectionMode;
  } = { relaxCspForWorkers: true },
): DomainRule => ({
  pattern: mutationTarget.nextPattern,
  ...(mutationTarget.locationId ? { locationId: mutationTarget.locationId } : {}),
  enabled: mutationTarget.nextEnabled,
  ...(mutationTarget.sourceRule?.pattern === mutationTarget.nextPattern &&
  mutationTarget.sourceRule.ruleSeedKey
    ? { ruleSeedKey: mutationTarget.sourceRule.ruleSeedKey }
    : {}),
  ...(options.relaxCspForWorkers || mutationTarget.sourceRule?.relaxCspForWorkers
    ? { relaxCspForWorkers: true }
    : {}),
  // SW blocking travels with the surface overrides carried from the source rule.
  ...(mutationTarget.sourceRule?.fingerprintSurfaceOverrides ||
  options.serviceWorkerOverride !== undefined ||
  options.sharedWorkerHandlingMode
    ? {
        fingerprintSurfaceOverrides: {
          ...(mutationTarget.sourceRule?.fingerprintSurfaceOverrides ?? {}),
          ...(options.serviceWorkerOverride !== undefined
            ? { serviceWorker: options.serviceWorkerOverride }
            : {}),
          ...(options.sharedWorkerHandlingMode
            ? { sharedWorker: options.sharedWorkerHandlingMode }
            : {}),
        },
      }
    : {}),
});

export type PopupRuleSaveInput = {
  hostname: string;
  locationId: string | undefined;
  patternMode: "exact" | "suffix";
  resolution: PopupRuleResolution;
  blockServiceWorkers: boolean;
  relaxCspForWorkers: boolean;
  createExactOverride?: boolean;
  serviceWorkerOverride?: boolean | null;
  regionalPresetEnabled?: boolean;
  workerHandlingOverride?: SharedWorkerHandlingMode | null;
};

export const buildPopupRuleSaveTarget = ({
  hostname,
  locationId,
  patternMode,
  resolution,
  blockServiceWorkers,
  relaxCspForWorkers,
  createExactOverride = false,
  serviceWorkerOverride,
  regionalPresetEnabled,
  workerHandlingOverride,
}: PopupRuleSaveInput): PopupRuleSaveTarget => {
  const resolvedCurrentRule = getPopupCurrentRule(resolution);
  const currentRule = createExactOverride ? null : resolvedCurrentRule;
  const nextPattern = resolvePopupSavePattern(hostname, patternMode, currentRule);
  const metadataSourceRule =
    currentRule ??
    resolvedCurrentRule ??
    getTransparentRule(hostname, nextPattern, resolution);
  const nextRuleSeedKey = resolveNextRuleSeedKey({
    createExactOverride,
    locationId,
    sourceRule: metadataSourceRule,
  });
  const nextServiceWorkerBlock = currentRule
    ? blockServiceWorkers
    : isServiceWorkerBlocked(metadataSourceRule?.fingerprintSurfaceOverrides) ||
      blockServiceWorkers;
  const nextRelaxCspForWorkers = currentRule
    ? relaxCspForWorkers
    : (metadataSourceRule?.relaxCspForWorkers ?? false) || relaxCspForWorkers;
  const nextServiceOverrides =
    serviceWorkerOverride === undefined
      ? applyServiceWorkerBlock(
          metadataSourceRule?.fingerprintSurfaceOverrides,
          nextServiceWorkerBlock,
        )
      : applyServiceWorkerRule(
          metadataSourceRule?.fingerprintSurfaceOverrides,
          serviceWorkerOverride ?? undefined,
        );
  const nextWorkerOverrides =
    workerHandlingOverride === undefined
      ? nextServiceOverrides
      : applyWorkerMode(nextServiceOverrides, workerHandlingOverride ?? undefined);
  const nextSurfaceOverrides = applyRegionalPreset(
    nextWorkerOverrides,
    regionalPresetEnabled,
  );

  return {
    currentRule,
    nextPattern,
    nextRule: {
      pattern: nextPattern,
      ...(locationId ? { locationId } : {}),
      enabled: currentRule?.enabled ?? true,
      ...(nextRuleSeedKey ? { ruleSeedKey: nextRuleSeedKey } : {}),
      relaxCspForWorkers: nextRelaxCspForWorkers,
      ...(nextSurfaceOverrides
        ? { fingerprintSurfaceOverrides: nextSurfaceOverrides }
        : {}),
    },
  };
};

export type PopupResolutionInput = {
  hostname: string;
  rules: readonly DomainRule[];
  containerAssignment: ContainerAssignment | null;
  globalFallbackRule: GlobalFallbackRule | undefined;
  fallbackLocationId: string | null;
  trustedSites?: readonly TrustedSite[];
  fingerprintEnabled: boolean;
};

export const resolvePopupResolution = ({
  hostname,
  rules,
  containerAssignment,
  globalFallbackRule,
  fallbackLocationId,
  trustedSites = [],
  fingerprintEnabled,
}: PopupResolutionInput): PopupRuleResolution => {
  const resolvedSources = resolveRuleSources({
    hostname,
    cookieStoreId: containerAssignment?.cookieStoreId,
    rules,
    containerAssignments: containerAssignment ? [containerAssignment] : [],
    globalFallbackRule,
    trustedSites,
  });
  const fallbackState = resolveFallbackState(
    fallbackLocationId,
    globalFallbackRule,
    fingerprintEnabled,
  );

  if (resolvedSources.trustedSite) {
    return {
      activeRule: null,
      displayedRule: null,
      winningSource: "trusted-site",
      effectiveLocationId: null,
      locationProfileActive: false,
      fallbackState,
      containerAssignmentConfigured: Boolean(resolvedSources.matchedContainer),
      matchedRulePattern: null,
      matchedTrustedSitePattern: resolvedSources.trustedSite.pattern,
      matchedTrustedSiteEnabled: true,
      hasExactRule: false,
      hasMatch: true,
    };
  }

  const winningSource = resolveWinningSource(
    resolvedSources,
    globalFallbackRule,
    fallbackLocationId,
    fingerprintEnabled,
  );

  return {
    activeRule: resolvedSources.activeRule,
    displayedRule: resolvedSources.displayedRule,
    winningSource,
    effectiveLocationId:
      resolvedSources.effectiveLocationId ?? fallbackLocationId ?? null,
    locationProfileActive: isLocationActive(
      resolvedSources,
      winningSource,
      fallbackState,
      fallbackLocationId,
    ),
    fallbackState,
    containerAssignmentConfigured: Boolean(resolvedSources.matchedContainer),
    matchedRulePattern: resolvedSources.activeRule?.pattern ?? null,
    matchedTrustedSitePattern: resolvedSources.matchingTrustedSite?.pattern ?? null,
    matchedTrustedSiteEnabled: resolvedSources.matchingTrustedSite?.enabled ?? null,
    hasExactRule: resolvedSources.activeRule?.pattern === hostname,
    hasMatch: Boolean(
      resolvedSources.activeRule ||
      resolvedSources.usableContainer ||
      fallbackState === "active" ||
      fallbackState === "protections",
    ),
  };
};

export const showInactiveRule = (resolution: PopupRuleResolution): boolean =>
  resolution.winningSource === "none" && resolution.displayedRule?.enabled === false;

export const getPopupCurrentRule = (
  resolution: PopupRuleResolution,
): DomainRule | null => {
  if (resolution.activeRule) {
    return resolution.activeRule;
  }

  if (resolution.winningSource !== "none") {
    return null;
  }

  return resolution.displayedRule;
};

/**
 * Collapses popup source resolution into one render-facing surface state so
 * the background owns which source is presented, which location label should
 * be shown, and which toggle target the popup should expose.
 */
export const resolvePopupSurfaceState = (
  resolution: PopupRuleResolution,
  containerAssignment: ContainerAssignment | null,
  globalFallbackRule: GlobalFallbackRule | undefined,
  hasActiveContainer: boolean,
): PopupSurfaceState => {
  const currentRule = getPopupCurrentRule(resolution);

  if (currentRule) {
    return {
      presentationSource: "rule",
      currentRule,
      currentRuleLocationId: currentRule.locationId ?? null,
      currentRuleEnabled: currentRule.enabled,
      displayedLocationId: resolution.locationProfileActive
        ? (resolution.effectiveLocationId ?? currentRule.locationId ?? null)
        : null,
      locationProfileActive: resolution.locationProfileActive,
    };
  }

  if (resolution.winningSource === "container" && containerAssignment) {
    const currentRuleLocationId = containerAssignment.locationId ?? null;
    const locationProfileActive = isLocationProfileActive(
      currentRuleLocationId,
      containerAssignment.fingerprintSurfaceOverrides,
    );

    return {
      presentationSource: "container",
      currentRule: null,
      currentRuleLocationId,
      currentRuleEnabled: containerAssignment.enabled !== false,
      displayedLocationId: locationProfileActive ? currentRuleLocationId : null,
      locationProfileActive,
    };
  }

  if (resolution.winningSource === "fallback" && globalFallbackRule) {
    const currentRuleLocationId = globalFallbackRule.locationId ?? null;
    const locationProfileActive = isLocationProfileActive(
      resolution.effectiveLocationId ?? currentRuleLocationId,
      globalFallbackRule.fingerprintSurfaceOverrides,
    );

    return {
      presentationSource: "fallback",
      currentRule: null,
      currentRuleLocationId,
      currentRuleEnabled: globalFallbackRule.enabled,
      displayedLocationId: locationProfileActive
        ? (resolution.effectiveLocationId ?? currentRuleLocationId)
        : null,
      locationProfileActive,
    };
  }

  if (resolution.winningSource === "trusted-site") {
    return {
      presentationSource: "none",
      currentRule: null,
      currentRuleLocationId: null,
      currentRuleEnabled: false,
      displayedLocationId: null,
      locationProfileActive: false,
    };
  }

  if (hasActiveContainer && containerAssignment) {
    const currentRuleLocationId = containerAssignment.locationId ?? null;

    return {
      presentationSource: "container",
      currentRule: null,
      currentRuleLocationId,
      currentRuleEnabled: containerAssignment.enabled !== false,
      displayedLocationId: currentRuleLocationId,
      locationProfileActive: false,
    };
  }

  if (globalFallbackRule) {
    return {
      presentationSource: "fallback",
      currentRule: null,
      currentRuleLocationId: globalFallbackRule.locationId ?? null,
      currentRuleEnabled: globalFallbackRule.enabled,
      displayedLocationId: null,
      locationProfileActive: false,
    };
  }

  return {
    presentationSource: "none",
    currentRule: null,
    currentRuleLocationId: null,
    currentRuleEnabled: null,
    displayedLocationId: null,
    locationProfileActive: false,
  };
};

export const getSuggestionTarget = (
  hostname: string,
  resolution: PopupRuleResolution,
  containerAssignment: ContainerAssignment | null,
): SuggestionMutationTarget => {
  if (resolution.activeRule) {
    return {
      sourceRule: resolution.activeRule,
      rulePatternToReplace:
        resolution.activeRule.pattern === hostname ? hostname : null,
      nextPattern: hostname,
      nextEnabled: resolution.activeRule.enabled,
      locationId: resolution.activeRule.locationId ?? null,
      allowsMissingLocationId: resolution.activeRule.locationId == null,
    };
  }

  if (resolution.winningSource === "fallback") {
    const exactDisplayedRule =
      resolution.displayedRule?.pattern === hostname ? resolution.displayedRule : null;

    return {
      sourceRule: exactDisplayedRule,
      rulePatternToReplace: exactDisplayedRule?.pattern ?? null,
      nextPattern: hostname,
      nextEnabled: true,
      locationId: exactDisplayedRule?.locationId ?? null,
      allowsMissingLocationId: exactDisplayedRule?.locationId == null,
    };
  }

  return {
    sourceRule: resolution.displayedRule,
    rulePatternToReplace:
      resolution.displayedRule?.pattern === hostname ? hostname : null,
    nextPattern: hostname,
    nextEnabled: true,
    locationId:
      containerAssignment?.locationId ?? resolution.displayedRule?.locationId ?? null,
    allowsMissingLocationId: false,
  };
};
