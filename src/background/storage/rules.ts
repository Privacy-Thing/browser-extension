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
import { synchronizeFeatureGroups } from "@/shared/feature-groups";
import { validateFeatureBindings } from "@/shared/provider-feature";
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
  };
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
  return Array.isArray(rules)
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
        }>
      ).map(normalizeRule)
    : DEFAULT_RULES;
};

export const saveRules = async (
  rules: readonly DomainRule[],
  decision?: RuleFeatureDecision,
): Promise<DomainRule[]> => {
  const [previous, stored] = await Promise.all([loadRules(), loadFeatureState()]);
  const normalized = rules.map((rule) => withAuthKey(withRuleSeedKey(rule)));
  let state = reconcileFeatureRefs(stored, previous, normalized);
  let next = synchronizeFeatureGroups(previous, normalized, state.featureBindings);
  if (decision) {
    const updated = await applyFeatureDecision(next, state, decision);
    next = updated.rules;
    state = updated.state;
  }
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
