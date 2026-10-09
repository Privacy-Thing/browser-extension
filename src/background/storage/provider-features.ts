import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import {
  bindingPatterns,
  featureStateSchema,
  type RuleFeatureBinding,
  type StoredFeatureState,
} from "@/shared/provider-feature";
import type { DomainRule } from "@/shared/types";

export const FEATURE_STORAGE_KEY = EXTENSION_STORAGE_KEYS.providerFeatures;
export const FEATURE_CACHE_KEY = EXTENSION_STORAGE_KEYS.providerFeatureMatches;

export const loadFeatureState = async (): Promise<StoredFeatureState> => {
  const [stored, cached] = await Promise.all([
    chrome.storage.local.get(FEATURE_STORAGE_KEY),
    chrome.storage.local.get(FEATURE_CACHE_KEY),
  ]);
  const config = featureStateSchema.safeParse(stored[FEATURE_STORAGE_KEY] ?? {});
  const cache = featureStateSchema.safeParse(cached[FEATURE_CACHE_KEY] ?? {});
  return {
    featureBindings: config.success ? config.data.featureBindings : [],
    featureMatches: cache.success ? cache.data.featureMatches : [],
    dismissedMatches: cache.success ? cache.data.dismissedMatches : [],
  };
};

export const saveFeatureState = async (state: StoredFeatureState): Promise<void> => {
  const parsed = featureStateSchema.parse(state);
  await chrome.storage.local.set({
    [FEATURE_STORAGE_KEY]: { featureBindings: parsed.featureBindings },
    [FEATURE_CACHE_KEY]: {
      featureMatches: parsed.featureMatches,
      dismissedMatches: parsed.dismissedMatches,
    },
  });
};

export const saveFeatureCache = async (
  state: Pick<StoredFeatureState, "featureMatches" | "dismissedMatches">,
): Promise<void> => {
  const parsed = featureStateSchema.parse(state);
  await chrome.storage.local.set({
    [FEATURE_CACHE_KEY]: {
      featureMatches: parsed.featureMatches,
      dismissedMatches: parsed.dismissedMatches,
    },
  });
};

export const loadFeatureBindings = async (): Promise<RuleFeatureBinding[]> =>
  (await loadFeatureState()).featureBindings;

export const reconcileFeatureRefs = (
  state: StoredFeatureState,
  previous: readonly DomainRule[],
  next: readonly DomainRule[],
): StoredFeatureState => {
  const patterns = new Set(next.map((rule) => rule.pattern));
  const renamed = new Map<string, string>();
  for (const oldRule of previous) {
    if (patterns.has(oldRule.pattern)) continue;
    const replacement = next.find(
      (rule) =>
        !previous.some((entry) => entry.pattern === rule.pattern) &&
        (oldRule.authKey
          ? rule.authKey === oldRule.authKey
          : Boolean(oldRule.ruleSeedKey && rule.ruleSeedKey === oldRule.ruleSeedKey)),
    );
    if (replacement) renamed.set(oldRule.pattern, replacement.pattern);
  }
  return {
    ...state,
    featureBindings: state.featureBindings.flatMap((binding) => {
      const members = bindingPatterns(binding)
        .map((pattern) => renamed.get(pattern) ?? pattern)
        .filter((pattern) => patterns.has(pattern));
      const source = renamed.get(binding.rulePattern) ?? binding.rulePattern;
      const rulePattern = members.includes(source) ? source : members[0];
      return rulePattern
        ? [
            {
              ...binding,
              rulePattern,
              ...(binding.rulePatterns ? { rulePatterns: members } : {}),
            },
          ]
        : [];
    }),
  };
};
