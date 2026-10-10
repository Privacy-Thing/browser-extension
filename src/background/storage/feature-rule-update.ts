import { resolveFeatureDecision } from "@/background/feature-provider-registry";
import { compileDomainPattern } from "@/shared/domain-match";
import {
  bindingPatterns,
  featureDecisionSchema,
  type FeatureDecision,
  type ProviderFeature,
  type RuleFeatureBinding,
  type StoredFeatureState,
} from "@/shared/provider-feature";
import {
  copyGroupSettings,
  getRuleGroupPatterns,
  getRuleGroupSource,
  orderGroupAroundSource,
  projectFeatureBindings,
} from "@/shared/rule-groups";
import type { DomainRule } from "@/shared/types";

export type RuleFeatureDecision = FeatureDecision & { rulePattern: string };

type DecisionResult = { rules: DomainRule[]; state: StoredFeatureState };
type FeatureMatch = StoredFeatureState["featureMatches"][number];

const withoutBinding = (
  bindings: readonly RuleFeatureBinding[],
  oldBinding: RuleFeatureBinding | undefined,
): RuleFeatureBinding[] => bindings.filter((binding) => binding !== oldBinding);

const dismissMatches = (
  state: StoredFeatureState,
  providerId: string,
  patterns: readonly string[],
): FeatureMatch[] => {
  const rejected = state.featureMatches.filter(
    (match) =>
      match.providerId === providerId &&
      patterns.some((pattern) => compileDomainPattern(pattern).test(match.hostname)),
  );
  return [
    ...state.dismissedMatches.filter(
      (match) =>
        !rejected.some(
          (item) =>
            item.providerId === match.providerId && item.hostname === match.hostname,
        ),
    ),
    ...rejected,
  ].slice(-256);
};

type UnlinkInput = {
  rules: readonly DomainRule[];
  state: StoredFeatureState;
  decision: FeatureDecision;
  source: DomainRule;
  oldBinding: RuleFeatureBinding | undefined;
  featureBindings: RuleFeatureBinding[];
};

const unlinkFeature = ({
  rules,
  state,
  decision,
  source,
  oldBinding,
  featureBindings,
}: UnlinkInput): DecisionResult => {
  const patterns = [
    ...new Set([
      ...getRuleGroupPatterns(rules, source.pattern),
      ...(oldBinding ? bindingPatterns(oldBinding) : []),
    ]),
  ];
  return {
    rules: [...rules],
    state: {
      ...state,
      featureBindings,
      dismissedMatches: dismissMatches(state, decision.providerId, patterns),
    },
  };
};

const joinedGroupId = (
  canonical: DomainRule,
  source: DomainRule,
  combined: readonly string[],
): string | undefined => {
  if (combined.length < 2) return canonical.groupId;
  if (canonical.groupId) return canonical.groupId;
  if (source.groupId) return source.groupId;
  return crypto.randomUUID();
};

const joinExistingFeature = ({
  rules,
  state,
  source,
  existing,
  featureBindings,
}: {
  rules: readonly DomainRule[];
  state: StoredFeatureState;
  source: DomainRule;
  existing: RuleFeatureBinding;
  featureBindings: RuleFeatureBinding[];
}): DecisionResult => {
  const canonical =
    rules.find((rule) => rule.pattern === existing.rulePattern) ??
    getRuleGroupSource(rules, existing.rulePattern);
  if (!canonical) throw new Error("The linked service rule no longer exists.");
  const combined = [
    ...new Set([
      ...getRuleGroupPatterns(rules, canonical.pattern),
      ...getRuleGroupPatterns(rules, source.pattern),
    ]),
  ];
  const groupId = joinedGroupId(canonical, source, combined);
  const canonicalRule = groupId ? { ...canonical, groupId } : canonical;
  const copied = rules.map((rule) =>
    combined.includes(rule.pattern) ? copyGroupSettings(canonicalRule, rule) : rule,
  );
  const joined = orderGroupAroundSource(copied, canonical.pattern, combined);
  return {
    rules: joined,
    state: {
      ...state,
      featureBindings: projectFeatureBindings(
        featureBindings.map((binding) =>
          binding === existing
            ? { ...binding, rulePattern: canonical.pattern }
            : binding,
        ),
        joined,
        rules,
      ),
    },
  };
};

const linkNewFeature = ({
  rules,
  state,
  feature,
  source,
  featureBindings,
}: {
  rules: readonly DomainRule[];
  state: StoredFeatureState;
  feature: ProviderFeature;
  source: DomainRule;
  featureBindings: RuleFeatureBinding[];
}): DecisionResult => {
  const members = getRuleGroupPatterns(rules, source.pattern);
  const evidence = state.featureMatches.find(
    (match) =>
      match.providerId === feature.providerId &&
      match.featureId === feature.featureId &&
      match.status === "matched" &&
      members.some((pattern) => compileDomainPattern(pattern).test(match.hostname)),
  );
  const linked = rules.map((rule) =>
    members.includes(rule.pattern) ? copyGroupSettings(source, rule) : rule,
  );
  return {
    rules: linked,
    state: {
      ...state,
      featureBindings: projectFeatureBindings(
        [
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
              ? {
                  matchedHostname: evidence.hostname,
                  matchCheckedAt: evidence.checkedAt,
                }
              : {}),
            confirmedAt: new Date().toISOString(),
          },
        ],
        linked,
        rules,
      ),
    },
  };
};

/** The provider supplies names; callers supply only the user's staged selection. */
export const applyFeatureDecision = async (
  rules: readonly DomainRule[],
  state: StoredFeatureState,
  input: RuleFeatureDecision,
): Promise<DecisionResult> => {
  const decision = featureDecisionSchema.parse(input);
  const source = rules.find((rule) => rule.pattern === input.rulePattern);
  if (!source) throw new Error("Save a valid domain rule before linking its service.");
  const feature = await resolveFeatureDecision(decision);
  const oldBinding = state.featureBindings.find(
    (binding) =>
      binding.providerId === decision.providerId &&
      bindingPatterns(binding).includes(source.pattern),
  );
  const featureBindings = withoutBinding(state.featureBindings, oldBinding);
  if (!feature) {
    return unlinkFeature({
      rules,
      state,
      decision,
      source,
      oldBinding,
      featureBindings,
    });
  }
  const existing = featureBindings.find(
    (binding) =>
      binding.providerId === feature.providerId &&
      binding.featureId === feature.featureId,
  );
  if (existing && !decision.joinExisting) {
    throw new Error(
      `This service already has a configuration for ${existing.rulePattern}. Choose Add to use its settings.`,
    );
  }
  return existing
    ? joinExistingFeature({ rules, state, source, existing, featureBindings })
    : linkNewFeature({ rules, state, feature, source, featureBindings });
};
