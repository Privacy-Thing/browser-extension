import { decorateFeatureBindings } from "@/background/feature-provider-registry";
import { clearExtensionLogs } from "@/background/logger";
import { validateSettings } from "@/background/settings";
import type { SettingsCommandDeps } from "@/background/settings-command-types";
import { createImportHandlers } from "@/background/settings-import-commands";
import { saveSimpleSettings } from "@/background/settings-save-command";
import {
  loadContainerAssignments,
  saveContainerAssignments,
} from "@/background/storage/container-assignments";
import { clearLegacyBehavior } from "@/background/storage/legacy-behavior-data";
import {
  DEFAULT_LOCATIONS,
  loadLocations,
  saveLocations,
} from "@/background/storage/locations";
import {
  getGlobalFallbackRule,
  getPreferences,
  getSharedSpoofing,
  saveGlobalFallbackRule,
  savePreferences,
  saveSharedSpoofing,
} from "@/background/storage/preferences";
import {
  loadFeatureBindings,
  saveFeatureState,
} from "@/background/storage/provider-features";
import { DEFAULT_RULES, loadRules, saveRules } from "@/background/storage/rules";
import { clearSiteSuggestions } from "@/background/storage/site-suggestions";
import {
  DEFAULT_TRUSTED_SITES,
  loadTrustedSites,
  saveTrustedSites,
} from "@/background/storage/trusted-sites";
import type { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import type {
  ExtensionCommand,
  ExportSettingsResponse,
  ResetSettingsResponse,
  SaveLocationResponse,
} from "@/shared/types";

export { getTrustedTabIds } from "@/background/settings-save-command";

type LocationModelCommand = Extract<
  ExtensionCommand,
  { type: typeof EXTENSION_COMMAND_TYPES.saveLocationModel }
>;

const exportSettings = async (
  deps: SettingsCommandDeps,
): Promise<ExportSettingsResponse> => {
  await deps.ensureStorageMigration();
  const [
    profiles,
    rules,
    trustedSites,
    preferences,
    sharedSpoofing,
    globalFallbackRule,
    containerAssignments,
  ] = await Promise.all([
    loadLocations(),
    loadRules(),
    loadTrustedSites(),
    getPreferences(),
    getSharedSpoofing(),
    getGlobalFallbackRule(),
    loadContainerAssignments(),
  ]);
  deps.setCachedValues({
    profiles,
    rules,
    trustedSites,
    ...preferences,
    sharedSpoofing,
    globalFallbackRule,
    containerAssignments,
  });
  return {
    ok: true,
    settings: {
      version: 3,
      exportedAt: new Date().toISOString(),
      locations: profiles,
      rules,
      featureBindings: await loadFeatureBindings(),
      trustedSites,
      ...preferences,
      ...(sharedSpoofing ? { sharedSpoofing } : {}),
      ...(globalFallbackRule ? { globalFallbackRule } : {}),
      containerAssignments,
    },
  };
};

const saveLocationModel = async (
  deps: SettingsCommandDeps,
  command: LocationModelCommand,
): Promise<SaveLocationResponse> => {
  try {
    const settings = validateSettings(
      command.locations,
      command.rules,
      command.containerAssignments,
    );
    await deps.ensureStorageMigration();
    const [, savedRules] = await Promise.all([
      saveLocations(settings.locations),
      saveRules(settings.rules, command.featureDecision),
      saveContainerAssignments(settings.containerAssignments),
    ]);
    settings.rules = savedRules ?? settings.rules;
    deps.setCachedValues({
      profiles: settings.locations,
      rules: settings.rules,
      containerAssignments: settings.containerAssignments,
    });
    await deps.syncPreloadedState();
    await deps.resyncActiveHeaderRules();
    await deps.refreshFxInjectionMode();
    const featureBindings = await loadFeatureBindings();
    return {
      ok: true,
      locations: settings.locations,
      rules: settings.rules,
      featureBindings,
      decorators: decorateFeatureBindings(featureBindings),
      containerAssignments: settings.containerAssignments,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Saving settings failed.",
    };
  }
};

const resetSettings = async (
  deps: SettingsCommandDeps,
): Promise<ResetSettingsResponse> => {
  await deps.ensureStorageMigration();
  await Promise.all([
    saveLocations(DEFAULT_LOCATIONS),
    saveRules(DEFAULT_RULES),
    saveTrustedSites(DEFAULT_TRUSTED_SITES),
    saveContainerAssignments([]),
    clearSiteSuggestions(),
    savePreferences(DEFAULT_PREFERENCES),
    saveSharedSpoofing(undefined),
    saveGlobalFallbackRule(undefined),
  ]);
  await clearLegacyBehavior();
  await saveFeatureState({
    featureBindings: [],
    featureMatches: [],
    dismissedMatches: [],
  });
  deps.setCachedValues({
    profiles: DEFAULT_LOCATIONS,
    rules: DEFAULT_RULES,
    trustedSites: DEFAULT_TRUSTED_SITES,
    ...DEFAULT_PREFERENCES,
    sharedSpoofing: undefined,
    globalFallbackRule: undefined,
    containerAssignments: [],
  });
  clearExtensionLogs();
  await deps.syncPreloadedState();
  await deps.resyncActiveHeaderRules();
  await deps.refreshFxInjectionMode();
  return {
    ok: true,
    locations: DEFAULT_LOCATIONS,
    rules: DEFAULT_RULES,
    trustedSites: DEFAULT_TRUSTED_SITES,
    ...DEFAULT_PREFERENCES,
    containerAssignments: [],
  };
};

export const createSettingsHandlers = (deps: SettingsCommandDeps) => ({
  exportSettings: exportSettings.bind(null, deps),
  saveSimpleSettings: saveSimpleSettings.bind(null, deps),
  saveLocationModel: saveLocationModel.bind(null, deps),
  resetSettings: resetSettings.bind(null, deps),
  ...createImportHandlers(deps),
});
