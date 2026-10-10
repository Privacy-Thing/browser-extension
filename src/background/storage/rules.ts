import {
  applyFeatureDecision,
  type RuleFeatureDecision,
} from "@/background/storage/feature-rule-update";
import {
  FEATURE_STORAGE_KEY,
  FEATURE_CACHE_KEY,
  loadFeatureState,
  reconcileFeatureRefs,
} from "@/background/storage/provider-features";
import { CONFORMANCE_LOCATION_ID, FX_RUNTIME_TEST_HOST } from "@/shared/build-flags";
import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { validateFeatureBindings } from "@/shared/provider-feature";
import {
  flattenCompatibleGroups,
  migrateLegacyRuleGroups,
  projectFeatureBindings,
  readGroupId,
  synchronizeRuleGroups,
  validateRuleGroups,
} from "@/shared/rule-groups";
import { normalizeRuleSeedKey, withAuthKey, withRuleSeedKey } from "@/shared/rule-seed";
import type { DomainRule, SurfaceOverrides } from "@/shared/types";

export const RULES_STORAGE_KEY = EXTENSION_STORAGE_KEYS.rules;

const defaultFxLocationId = CONFORMANCE_LOCATION_ID || "spf-warsaw";

const normalizeRule = (rule: {
  pattern: string;
  locationId?: string;
  profileId?: string;
  enabled?: boolean;
  geolocationEnabled?: boolean;
  ruleSeedKey?: string;
  authKey?: string;
  blockServiceWorkerRegistration?: boolean;
  relaxCspForWorkers?: boolean;
  fingerprintSurfaceOverrides?: SurfaceOverrides;
  groupId?: string;
}): DomainRule => {
  const surfaceOverrides = {
    ...(rule.fingerprintSurfaceOverrides ?? {}),
    ...(rule.geolocationEnabled === false &&
    rule.fingerprintSurfaceOverrides?.geolocation === undefined
      ? { geolocation: false }
      : {}),
    // Legacy: fold the old per-rule SW block boolean into the serviceWorker
    // surface override (true -> force block; false/absent -> inherit global).
    ...(rule.blockServiceWorkerRegistration === true &&
    rule.fingerprintSurfaceOverrides?.serviceWorker === undefined
      ? { serviceWorker: true }
      : {}),
  };

  const groupId = readGroupId(rule.groupId);
  return {
    pattern: rule.pattern,
    ...((rule.locationId ?? rule.profileId)
      ? { locationId: rule.locationId ?? rule.profileId }
      : {}),
    enabled: rule.enabled ?? true,
    ruleSeedKey: normalizeRuleSeedKey(rule.ruleSeedKey),
    authKey: withAuthKey(rule).authKey,
    relaxCspForWorkers: rule.relaxCspForWorkers ?? false,
    ...(Object.keys(surfaceOverrides).length > 0
      ? { fingerprintSurfaceOverrides: surfaceOverrides }
      : {}),
    ...(groupId ? { groupId } : {}),
  };
};

const patternKey = (pattern: string): string => pattern.trim().toLowerCase();

const inheritGroupId = (
  rule: DomainRule,
  previous: readonly DomainRule[],
): DomainRule => {
  if (rule.groupId) return rule;
  const prior = previous.find(
    (entry) => patternKey(entry.pattern) === patternKey(rule.pattern),
  );
  return prior?.groupId ? { ...rule, groupId: prior.groupId } : rule;
};

const storedRule = (rule: DomainRule): DomainRule => {
  const seeded = withAuthKey(withRuleSeedKey(rule));
  const groupId = readGroupId(seeded.groupId);
  const next = { ...seeded };
  delete next.groupId;
  return groupId ? { ...next, groupId } : next;
};

export const DEFAULT_RULES: DomainRule[] = FX_RUNTIME_TEST_HOST
  ? [
      normalizeRule({
        pattern: FX_RUNTIME_TEST_HOST,
        locationId: defaultFxLocationId,
        enabled: true,
      }),
    ]
  : [];

export const loadRules = async (): Promise<DomainRule[]> => {
  const stored = await chrome.storage.local.get(RULES_STORAGE_KEY);
  const rules = stored[RULES_STORAGE_KEY];
  const normalized = Array.isArray(rules)
    ? (
        rules as Array<{
          pattern: string;
          locationId?: string;
          profileId?: string;
          enabled?: boolean;
          geolocationEnabled?: boolean;
          ruleSeedKey?: string;
          authKey?: string;
          blockServiceWorkerRegistration?: boolean;
          relaxCspForWorkers?: boolean;
          fingerprintSurfaceOverrides?: SurfaceOverrides;
          groupId?: string;
        }>
      ).map(normalizeRule)
    : DEFAULT_RULES;
  const featureState = await loadFeatureState();
  const migrated = migrateLegacyRuleGroups(normalized, featureState.featureBindings);
  if (!migrated.changed) return normalized;
  const flattened = flattenCompatibleGroups(migrated.rules);
  validateRuleGroups(flattened);
  await chrome.storage.local.set({
    [RULES_STORAGE_KEY]: flattened,
    [FEATURE_STORAGE_KEY]: {
      featureBindings: projectFeatureBindings(
        featureState.featureBindings,
        flattened,
        normalized,
      ),
    },
  });
  return flattened;
};

export const saveRules = async (
  rules: readonly DomainRule[],
  decision?: RuleFeatureDecision,
): Promise<DomainRule[]> => {
  const [previous, stored] = await Promise.all([loadRules(), loadFeatureState()]);
  const normalized = rules.map((rule) => inheritGroupId(storedRule(rule), previous));
  let next = synchronizeRuleGroups(previous, normalized);
  let state = reconcileFeatureRefs(stored, previous, next);
  if (decision) {
    const updated = await applyFeatureDecision(next, state, decision);
    next = synchronizeRuleGroups(next, updated.rules);
    state = {
      ...updated.state,
      featureBindings: projectFeatureBindings(
        updated.state.featureBindings,
        next,
        previous,
      ),
    };
  }
  validateRuleGroups(next);
  validateFeatureBindings(state.featureBindings, next);
  await chrome.storage.local.set({
    [RULES_STORAGE_KEY]: next,
    [FEATURE_STORAGE_KEY]: { featureBindings: state.featureBindings },
    ...(decision?.featureId === null
      ? {
          [FEATURE_CACHE_KEY]: {
            featureMatches: state.featureMatches,
            dismissedMatches: state.dismissedMatches,
          },
        }
      : {}),
  });
  return next;
};
