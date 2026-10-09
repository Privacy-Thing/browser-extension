import { resolveFeatureDecision } from "@/background/feature-provider-registry";
import { compileDomainPattern } from "@/shared/domain-match";
import { copyGroupSettings } from "@/shared/feature-groups";
import {
  bindingPatterns,
  featureDecisionSchema,
  type FeatureDecision,
  type StoredFeatureState,
} from "@/shared/provider-feature";
import type { DomainRule } from "@/shared/types";

export type RuleFeatureDecision = FeatureDecision & { rulePattern: string };

/** The provider supplies names; callers supply only the user's staged selection. */
export const applyFeatureDecision = async (
  rules: readonly DomainRule[],
  state: StoredFeatureState,
  input: RuleFeatureDecision,
): Promise<{ rules: DomainRule[]; state: StoredFeatureState }> => {
  const decision = featureDecisionSchema.parse(input);
  const source = rules.find((rule) => rule.pattern === input.rulePattern);
  if (!source) throw new Error("Save a valid domain rule before linking its service.");
  const feature = await resolveFeatureDecision(decision);
  const oldBinding = state.featureBindings.find(
    (binding) =>
      binding.providerId === decision.providerId &&
      bindingPatterns(binding).includes(source.pattern),
  );
  const featureBindings = state.featureBindings.filter(
    (binding) => binding !== oldBinding,
  );
  if (!feature) {
    const patterns = oldBinding ? bindingPatterns(oldBinding) : [source.pattern];
    const rejected = state.featureMatches.filter(
      (match) =>
        match.providerId === decision.providerId &&
        patterns.some((pattern) => compileDomainPattern(pattern).test(match.hostname)),
    );
    return {
      rules: [...rules],
      state: {
        ...state,
        featureBindings,
        dismissedMatches: [
          ...state.dismissedMatches.filter(
            (match) =>
              !rejected.some(
                (item) =>
                  item.providerId === match.providerId &&
                  item.hostname === match.hostname,
              ),
          ),
          ...rejected,
        ].slice(-256),
      },
    };
  }
  const existing = featureBindings.find(
    (binding) =>
      binding.providerId === feature.providerId &&
      binding.featureId === feature.featureId,
  );
  if (existing && !decision.joinExisting)
    throw new Error(
      `This service already has a configuration for ${existing.rulePattern}. Choose Add to use its settings.`,
    );
  const members = oldBinding ? bindingPatterns(oldBinding) : [source.pattern];
  if (existing) {
    const canonical = rules.find((rule) => rule.pattern === existing.rulePattern);
    if (!canonical) throw new Error("The linked service rule no longer exists.");
    const combined = [...new Set([...bindingPatterns(existing), ...members])];
    return {
      rules: rules.map((rule) =>
        combined.includes(rule.pattern) ? copyGroupSettings(canonical, rule) : rule,
      ),
      state: {
        ...state,
        featureBindings: featureBindings.map((binding) =>
          binding === existing ? { ...binding, rulePatterns: combined } : binding,
        ),
      },
    };
  }
  const evidence = state.featureMatches.find(
    (match) =>
      match.providerId === feature.providerId &&
      match.featureId === feature.featureId &&
      match.status === "matched" &&
      members.some((pattern) => compileDomainPattern(pattern).test(match.hostname)),
  );
  return {
    rules: rules.map((rule) =>
      members.includes(rule.pattern) ? copyGroupSettings(source, rule) : rule,
    ),
    state: {
      ...state,
      featureBindings: [
        ...featureBindings,
        {
          rulePattern: source.pattern,
          ...(members.length > 1 ? { rulePatterns: members } : {}),
          providerId: feature.providerId,
          featureId: feature.featureId,
          featureName: feature.name,
          featureType: feature.type,
          matchSource: evidence ? "domain-test" : "manual",
          ...(evidence
            ? { matchedHostname: evidence.hostname, matchCheckedAt: evidence.checkedAt }
            : {}),
          confirmedAt: new Date().toISOString(),
        },
      ],
    },
  };
};
