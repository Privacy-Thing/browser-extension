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
  rulePatternKey,
  ruleSettingsKey,
} from "@/shared/rule-groups";
import type { DomainRule } from "@/shared/types";

export type RuleFeatureDecision = FeatureDecision & { rulePattern: string };

type DecisionResult = { rules: DomainRule[]; state: StoredFeatureState };
type FeatureMatch = StoredFeatureState["featureMatches"][number];

const samePattern = (left: string, right: string): boolean =>
  rulePatternKey(left) === rulePatternKey(right);

const hasPattern = (patterns: readonly string[], pattern: string): boolean =>
  patterns.some((candidate) => samePattern(candidate, pattern));

/** A staged join may not overwrite a target edited or removed since the form loaded. */
export const assertJoinTargetStable = (
  previous: readonly DomainRule[],
  next: readonly DomainRule[],
  state: StoredFeatureState,
  decision: RuleFeatureDecision | undefined,
): void => {
  if (!decision?.joinExisting || !decision.featureId) return;
  const binding = state.featureBindings.find(
    (item) =>
      item.providerId === decision.providerId && item.featureId === decision.featureId,
  );
  const fail = () => {
    throw new Error(
      "The linked rule changed. Review its configuration before joining.",
    );
  };
  if (!binding) return fail();
  const members = getRuleGroupPatterns(previous, binding.rulePattern);
  if (members.length === 0) return fail();
  for (const pattern of members) {
    const before = previous.find((rule) => samePattern(rule.pattern, pattern));
    const after = next.find((rule) => samePattern(rule.pattern, pattern));
    if (
      !before ||
      !after ||
      ruleSettingsKey(before) !== ruleSettingsKey(after) ||
      before.authKey !== after.authKey ||
      before.ruleSeedKey !== after.ruleSeedKey ||
      before.groupId !== after.groupId
    )
      return fail();
  }
};

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
    rules.find((rule) => samePattern(rule.pattern, existing.rulePattern)) ??
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
  const memberKeys = new Set(combined.map((pattern) => rulePatternKey(pattern)));
  const copied = rules.map((rule) =>
    memberKeys.has(rulePatternKey(rule.pattern))
      ? copyGroupSettings(canonicalRule, rule)
      : rule,
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
  const memberKeys = new Set(members.map((pattern) => rulePatternKey(pattern)));
  const linked = rules.map((rule) =>
    memberKeys.has(rulePatternKey(rule.pattern))
      ? copyGroupSettings(source, rule)
      : rule,
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
  const source = rules.find((rule) => samePattern(rule.pattern, input.rulePattern));
  if (!source) throw new Error("Save a valid domain rule before linking its service.");
  const feature = await resolveFeatureDecision(decision);
  const oldBinding = state.featureBindings.find(
    (binding) =>
      binding.providerId === decision.providerId &&
      hasPattern(bindingPatterns(binding), source.pattern),
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
