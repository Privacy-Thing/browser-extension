import type { ResolvedRuleSources } from "./rule-resolution.js";
import type { DomainRule, GlobalFallbackRule, TrustedSite } from "./types.js";

export type RuleResolutionStepSource =
  "trusted-site" | "exact-rule" | "suffix-rule" | "container" | "fallback" | "none";

export type RuleResolutionStepStatus = "won" | "skipped" | "no-match" | "disabled";

export type RuleResolutionStep = {
  source: RuleResolutionStepSource;
  status: RuleResolutionStepStatus;
  pattern?: string;
  locationId?: string | null;
};

export type ResolutionExplanation = {
  steps: RuleResolutionStep[];
  winningSource: ResolvedRuleSources["winningSource"];
  effectiveLocationId: string | null;
};

export type ExplainResolutionParams = {
  hostname: string;
  resolved: ResolvedRuleSources;
  rules: readonly DomainRule[];
  globalFallbackRule?: GlobalFallbackRule | undefined;
  trustedSites?: readonly TrustedSite[] | undefined;
  fallbackLocationId?: string | null;
  fingerprintEnabled?: boolean;
};

const buildTrustedSiteStep = (resolved: ResolvedRuleSources): RuleResolutionStep =>
  resolved.trustedSite
    ? { source: "trusted-site", status: "won", pattern: resolved.trustedSite.pattern }
    : { source: "trusted-site", status: "no-match" };

const buildRuleSteps = (
  resolved: ResolvedRuleSources,
  hostname: string,
): RuleResolutionStep[] => {
  const steps: RuleResolutionStep[] = [];
  const normalizedHost = hostname.trim().toLowerCase();

  if (resolved.activeRule) {
    const isExact = resolved.activeRule.pattern === normalizedHost;
    steps.push({
      source: isExact ? "exact-rule" : "suffix-rule",
      status: "won",
      pattern: resolved.activeRule.pattern,
      locationId: resolved.activeRule.locationId ?? null,
    });
    const other = resolved.displayedRule;
    if (isExact && other && other.pattern !== resolved.activeRule.pattern) {
      steps.push({ source: "suffix-rule", status: "skipped", pattern: other.pattern });
    }
    return steps;
  }

  if (resolved.displayedRule) {
    const isExact = resolved.displayedRule.pattern === normalizedHost;
    steps.push({
      source: isExact ? "exact-rule" : "suffix-rule",
      status: "disabled",
      pattern: resolved.displayedRule.pattern,
      locationId: resolved.displayedRule.locationId ?? null,
    });
    steps.push({ source: isExact ? "suffix-rule" : "exact-rule", status: "no-match" });
    return steps;
  }

  steps.push({ source: "exact-rule", status: "no-match" });
  steps.push({ source: "suffix-rule", status: "no-match" });
  return steps;
};

const buildContainerStep = (
  resolved: ResolvedRuleSources,
  winning: ResolvedRuleSources["winningSource"],
): RuleResolutionStep => {
  if (!resolved.matchedContainer) {
    return { source: "container", status: "no-match" };
  }
  const assignment = resolved.usableContainer ?? resolved.matchedContainer;
  return {
    source: "container",
    status: winning === "container" ? "won" : "skipped",
    locationId: assignment.locationId ?? null,
  };
};

const hasFallbackProtections = (
  globalFallbackRule: GlobalFallbackRule | undefined,
  effectiveFallbackId: string | null,
  fingerprintEnabled: boolean,
): boolean =>
  Boolean(
    globalFallbackRule &&
    globalFallbackRule.enabled !== false &&
    (effectiveFallbackId !== null ||
      Boolean(globalFallbackRule.fingerprintSurfaceOverrides) ||
      fingerprintEnabled),
  );

type FallbackStepInput = {
  resolved: ResolvedRuleSources;
  globalFallbackRule: GlobalFallbackRule | undefined;
  fallbackLocationId: string | null | undefined;
  winning: ResolvedRuleSources["winningSource"];
  fingerprintEnabled: boolean;
};

const buildFallbackStep = ({
  resolved,
  globalFallbackRule,
  fallbackLocationId,
  winning,
  fingerprintEnabled,
}: FallbackStepInput): RuleResolutionStep => {
  const effectiveFallbackId =
    resolved.runtimeFallbackRule?.locationId ?? fallbackLocationId ?? null;
  if (
    !hasFallbackProtections(globalFallbackRule, effectiveFallbackId, fingerprintEnabled)
  ) {
    return { source: "fallback", status: "no-match" };
  }
  // Fallback wins when the resolver says "none" but fingerprint spoofing makes it active
  // (same logic as resolveWinningSource / hasFallbackProtections in popup-state.ts).
  const fallbackWon = winning === "fallback" || winning === "none";
  return {
    source: "fallback",
    status: fallbackWon ? "won" : "skipped",
    locationId: effectiveFallbackId,
  };
};

export const explainRuleResolution = ({
  hostname,
  resolved,
  globalFallbackRule,
  fallbackLocationId,
  fingerprintEnabled = false,
}: ExplainResolutionParams): ResolutionExplanation => {
  const resolverWinning = resolved.winningSource;

  // Mirror popup-state logic: a fallback with fingerprint spoofing is "fallback", not "none".
  const effectiveFallbackId =
    resolved.runtimeFallbackRule?.locationId ?? fallbackLocationId ?? null;
  const fallbackActive = hasFallbackProtections(
    globalFallbackRule,
    effectiveFallbackId,
    fingerprintEnabled,
  );
  const winning =
    resolverWinning === "none" && fallbackActive ? "fallback" : resolverWinning;

  const steps: RuleResolutionStep[] = [
    buildTrustedSiteStep(resolved),
    ...buildRuleSteps(resolved, hostname),
    buildContainerStep(resolved, winning),
    buildFallbackStep({
      resolved,
      globalFallbackRule,
      fallbackLocationId,
      winning,
      fingerprintEnabled,
    }),
  ];

  if (winning === "none") {
    steps.push({ source: "none", status: "won" });
  }

  return {
    steps,
    winningSource: winning,
    effectiveLocationId: resolved.effectiveLocationId ?? fallbackLocationId ?? null,
  };
};
