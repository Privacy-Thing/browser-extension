import { syncDynamicHeaderRules } from "@/background/dnr";
import { removeRetiredMenuItems } from "@/background/sidebar-menus";
import {
  CONTAINERS_STORAGE_KEY,
  loadContainerAssignments,
  saveContainerAssignments,
} from "@/background/storage/container-assignments";
import { CONTROL_STORAGE_KEY } from "@/background/storage/control-state";
import { keepLegacyPrefs } from "@/background/storage/legacy-behavior-data";
import { LOCATIONS_STORAGE_KEY } from "@/background/storage/locations";
import {
  FALLBACK_STORAGE_KEY,
  LEGACY_SPOOFING_KEY,
  SPOOFING_STORAGE_KEY,
  getGlobalFallbackRule,
  saveGlobalFallbackRule,
} from "@/background/storage/preferences";
import { RULES_STORAGE_KEY, loadRules, saveRules } from "@/background/storage/rules";
import { migrateRetiredNamespace } from "@/background/storage-namespace-migration";
import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { sharedSpoofingSchema } from "@/shared/profile-schema";
import { normalizeRuleSeedKey } from "@/shared/rule-seed";
import { DEFAULT_PREFERENCES, normalizePreferences } from "@/shared/settings-defaults";
import type { DomainRule } from "@/shared/types";

export const MIGRATION_NOTICE_KEY = EXTENSION_STORAGE_KEYS.migrationNotice;

const WILDCARD_RULE_NOTICE =
  "Removed legacy global '*' rules during migration to safer defaults.";

const normalizeRule = (rule: DomainRule): DomainRule => ({
  ...rule,
  enabled: rule.enabled ?? true,
  ruleSeedKey: normalizeRuleSeedKey(rule.ruleSeedKey),
  relaxCspForWorkers: rule.relaxCspForWorkers ?? false,
});

const migrateLegacyGeoControls = async (): Promise<boolean> => {
  const stored = await chrome.storage.local.get([
    RULES_STORAGE_KEY,
    FALLBACK_STORAGE_KEY,
    CONTAINERS_STORAGE_KEY,
  ]);
  const hasLegacyRuleFlag = Array.isArray(stored[RULES_STORAGE_KEY])
    ? stored[RULES_STORAGE_KEY].some(
        (rule) =>
          typeof rule === "object" &&
          rule !== null &&
          Object.hasOwn(rule as Record<string, unknown>, "geolocationEnabled"),
      )
    : false;
  const hasLegacyFallbackFlag =
    typeof stored[FALLBACK_STORAGE_KEY] === "object" &&
    stored[FALLBACK_STORAGE_KEY] !== null &&
    Object.hasOwn(
      stored[FALLBACK_STORAGE_KEY] as Record<string, unknown>,
      "geolocationEnabled",
    );
  const hasLegacyContainerFlag = Array.isArray(stored[CONTAINERS_STORAGE_KEY])
    ? stored[CONTAINERS_STORAGE_KEY].some(
        (assignment) =>
          typeof assignment === "object" &&
          assignment !== null &&
          Object.hasOwn(assignment as Record<string, unknown>, "geolocationEnabled"),
      )
    : false;

  if (!hasLegacyRuleFlag && !hasLegacyFallbackFlag && !hasLegacyContainerFlag) {
    return false;
  }

  const rules = await loadRules();
  const globalFallbackRule = await getGlobalFallbackRule();
  const containerAssignments = await loadContainerAssignments();

  if (hasLegacyRuleFlag) {
    await saveRules(rules);
  }

  if (hasLegacyFallbackFlag) {
    await saveGlobalFallbackRule(globalFallbackRule);
  }

  if (hasLegacyContainerFlag) {
    await saveContainerAssignments(containerAssignments);
  }

  return true;
};

const PREFERENCES_STORAGE_KEY = EXTENSION_STORAGE_KEYS.preferences;
const SURFACE_RESET_KEY = EXTENSION_STORAGE_KEYS.surfaceProtectionsDefaultReset;
const FINGERPRINT_SETTING_KEY = "browserFingerprintSpoofingEnabled";
// Legacy flat keys that now live inside the consolidated `preferences` object.
const LEGACY_PREFERENCE_KEYS = [
  "debugMode",
  "watchPositionDelay",
  "osmConsent",
  FINGERPRINT_SETTING_KEY,
  "behavioralProfilesEnabled",
  "onboardingCompleted",
  "themeMode",
  "themeAccentPreset",
  "highContrastMode",
  "highContrastExplicit",
] as const;
const NAMESPACED_PREF_KEYS = [
  EXTENSION_STORAGE_KEYS.defaultNoiseRadius,
  EXTENSION_STORAGE_KEYS.watchPositionDelayMin,
  EXTENSION_STORAGE_KEYS.watchPositionDelayMax,
  EXTENSION_STORAGE_KEYS.theme,
  SURFACE_RESET_KEY,
] as const;

/**
 * Consolidate legacy per-field preference keys and materialize newly added
 * fields in the single `preferences` object.
 *
 * Existing values are preserved so upgrades keep their configuration. As part
 * of the move, a stale explicit `browserFingerprintSpoofingEnabled === false`
 * left by pre-"enabled by default" builds is dropped so it normalizes back to
 * on; because the move runs exactly once, a deliberate opt-out made afterwards
 * (written into the object) is preserved.
 */
const consolidatePreferences = async (): Promise<boolean> => {
  const stored = await chrome.storage.local.get([
    PREFERENCES_STORAGE_KEY,
    ...LEGACY_PREFERENCE_KEYS,
    ...NAMESPACED_PREF_KEYS,
  ]);
  const existing = stored[PREFERENCES_STORAGE_KEY];
  const hasPreferences = typeof existing === "object" && existing !== null;
  const hasLegacyKeys = [...LEGACY_PREFERENCE_KEYS, ...NAMESPACED_PREF_KEYS].some(
    (key) => Object.hasOwn(stored, key),
  );
  const hasLegacyDelay =
    Object.hasOwn(stored, EXTENSION_STORAGE_KEYS.watchPositionDelayMin) ||
    Object.hasOwn(stored, EXTENSION_STORAGE_KEYS.watchPositionDelayMax);
  const namespacedSnapshot: Record<string, unknown> = hasPreferences
    ? {}
    : {
        ...(Object.hasOwn(stored, EXTENSION_STORAGE_KEYS.defaultNoiseRadius)
          ? {
              defaultNoiseRadius: stored[EXTENSION_STORAGE_KEYS.defaultNoiseRadius],
            }
          : {}),
        ...(hasLegacyDelay
          ? {
              watchPositionDelay: [
                stored[EXTENSION_STORAGE_KEYS.watchPositionDelayMin] ??
                  DEFAULT_PREFERENCES.watchPositionDelay[0],
                stored[EXTENSION_STORAGE_KEYS.watchPositionDelayMax] ??
                  DEFAULT_PREFERENCES.watchPositionDelay[1],
              ],
            }
          : {}),
        ...(Object.hasOwn(stored, EXTENSION_STORAGE_KEYS.theme)
          ? { themeMode: stored[EXTENSION_STORAGE_KEYS.theme] }
          : {}),
      };
  const snapshot: Record<string, unknown> = {
    ...stored,
    ...namespacedSnapshot,
    ...(hasPreferences ? (existing as Record<string, unknown>) : {}),
  };
  // Treat a legacy explicit `false` as the stale old default, not an opt-out.
  if (existing === undefined && snapshot[FINGERPRINT_SETTING_KEY] === false) {
    delete snapshot[FINGERPRINT_SETTING_KEY];
  }
  if (
    (hasPreferences || hasLegacyKeys) &&
    !Object.hasOwn(snapshot, "sharedWorkerHandlingMode") &&
    !Object.hasOwn(snapshot, "sharedWorkerCompatibilityMode")
  ) {
    snapshot.sharedWorkerCompatibilityMode = true;
  }

  const normalized = normalizePreferences(snapshot);
  const nextPreferences = keepLegacyPrefs(
    snapshot,
    normalized as unknown as Record<string, unknown>,
  );
  const needsWrite = JSON.stringify(existing) !== JSON.stringify(nextPreferences);

  if (needsWrite) {
    await chrome.storage.local.set({
      [PREFERENCES_STORAGE_KEY]: nextPreferences,
    });
  }
  if (hasLegacyKeys) {
    await chrome.storage.local.remove([
      ...LEGACY_PREFERENCE_KEYS,
      ...NAMESPACED_PREF_KEYS,
    ]);
  }

  return needsWrite || hasLegacyKeys;
};

const recordMissingSeedKey = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  !Object.hasOwn(value as Record<string, unknown>, "ruleSeedKey");

const normalizeStoredSeeds = async (): Promise<boolean> => {
  const stored = await chrome.storage.local.get([
    RULES_STORAGE_KEY,
    FALLBACK_STORAGE_KEY,
    CONTAINERS_STORAGE_KEY,
  ]);
  const hasRuleSeedGap = Array.isArray(stored[RULES_STORAGE_KEY])
    ? stored[RULES_STORAGE_KEY].some(recordMissingSeedKey)
    : false;
  const hasFallbackSeedGap = recordMissingSeedKey(stored[FALLBACK_STORAGE_KEY]);
  const hasContainerSeedGap = Array.isArray(stored[CONTAINERS_STORAGE_KEY])
    ? stored[CONTAINERS_STORAGE_KEY].some(recordMissingSeedKey)
    : false;

  if (!hasRuleSeedGap && !hasFallbackSeedGap && !hasContainerSeedGap) {
    return false;
  }

  if (hasRuleSeedGap) {
    await saveRules(await loadRules());
  }
  if (hasFallbackSeedGap) {
    await saveGlobalFallbackRule(await getGlobalFallbackRule());
  }
  if (hasContainerSeedGap) {
    await saveContainerAssignments(await loadContainerAssignments());
  }

  return true;
};

const migrateLegacySpoofingKey = async (): Promise<boolean> => {
  const stored = await chrome.storage.local.get([
    SPOOFING_STORAGE_KEY,
    LEGACY_SPOOFING_KEY,
  ]);

  const nextEntries: Record<string, unknown> = {};
  const keysToRemove: string[] = [];

  const hasSharedSpoofing = SPOOFING_STORAGE_KEY in stored;
  const hasLegacySharedSpoofing = LEGACY_SPOOFING_KEY in stored;
  if (!hasSharedSpoofing && hasLegacySharedSpoofing) {
    const legacySpoofing = sharedSpoofingSchema.safeParse(stored[LEGACY_SPOOFING_KEY]);
    if (legacySpoofing.success) {
      nextEntries[SPOOFING_STORAGE_KEY] = legacySpoofing.data;
      keysToRemove.push(LEGACY_SPOOFING_KEY);
    }
  } else if (hasSharedSpoofing && hasLegacySharedSpoofing) {
    keysToRemove.push(LEGACY_SPOOFING_KEY);
  }

  if (Object.keys(nextEntries).length > 0) {
    await chrome.storage.local.set(nextEntries);
  }

  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }

  return Object.keys(nextEntries).length > 0 || keysToRemove.length > 0;
};

export const removeWildcardRules = (
  rules: readonly DomainRule[],
): {
  nextRules: DomainRule[];
  removedCount: number;
} => {
  const removedRules = rules.filter((rule) => rule.pattern === "*");
  if (removedRules.length === 0) {
    return {
      nextRules: [...rules],
      removedCount: 0,
    };
  }

  return {
    nextRules: rules.filter((rule) => rule.pattern !== "*"),
    removedCount: removedRules.length,
  };
};

export const runStorageMigration = async (): Promise<{
  removedWildcardRules: number;
}> => {
  const migratedNamespace = await migrateRetiredNamespace();
  await removeRetiredMenuItems();
  const migratedLegacySpoofing = await migrateLegacySpoofingKey();
  const migratedGeoControls = await migrateLegacyGeoControls();
  const normalizedSeeds = await normalizeStoredSeeds();
  const consolidatedPreferences = await consolidatePreferences();

  const stored = await chrome.storage.local.get(RULES_STORAGE_KEY);
  const rawRules = stored[RULES_STORAGE_KEY];
  const rules = await loadRules();
  const normalizedRules = rules.map(normalizeRule);
  const hadDisabledShapeGap = Array.isArray(rawRules)
    ? rawRules.some(
        (rule) =>
          typeof rule === "object" &&
          rule !== null &&
          (!("enabled" in (rule as Record<string, unknown>)) ||
            !("ruleSeedKey" in (rule as Record<string, unknown>))),
      )
    : false;
  const migration = removeWildcardRules(normalizedRules);

  if (
    migration.removedCount === 0 &&
    !hadDisabledShapeGap &&
    !migratedNamespace &&
    !migratedLegacySpoofing &&
    !migratedGeoControls &&
    !normalizedSeeds &&
    !consolidatedPreferences
  ) {
    return {
      removedWildcardRules: 0,
    };
  }

  await saveRules(migration.nextRules);

  if (migration.removedCount > 0) {
    await chrome.storage.local.set({
      [MIGRATION_NOTICE_KEY]: WILDCARD_RULE_NOTICE,
    });
  }

  await syncDynamicHeaderRules([]);

  return {
    removedWildcardRules: migration.removedCount,
  };
};

export const consumeMigrationNotice = async (): Promise<string | null> => {
  const stored = await chrome.storage.local.get(MIGRATION_NOTICE_KEY);
  const notice = stored[MIGRATION_NOTICE_KEY];
  if (typeof notice !== "string" || !notice) {
    return null;
  }

  await chrome.storage.local.remove(MIGRATION_NOTICE_KEY);
  return notice;
};

export const clearRulesForTests = async (): Promise<void> => {
  await chrome.storage.local.remove([
    RULES_STORAGE_KEY,
    LOCATIONS_STORAGE_KEY,
    CONTROL_STORAGE_KEY,
    SPOOFING_STORAGE_KEY,
    LEGACY_SPOOFING_KEY,
    CONTAINERS_STORAGE_KEY,
    FALLBACK_STORAGE_KEY,
    MIGRATION_NOTICE_KEY,
  ]);
};
