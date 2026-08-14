import { clearExtensionLogs, logExtensionEvent } from "@/background/logger";
import { validateImportedSettings, validateSettings } from "@/background/settings";
import type { SettingsCommandDeps } from "@/background/settings-command-types";
import { saveSimpleSettings } from "@/background/settings-save-command";
import {
  loadContainerAssignments,
  saveContainerAssignments,
} from "@/background/storage/container-assignments";
import {
  clearLegacyBehavior,
  saveLegacyBehavior,
} from "@/background/storage/legacy-behavior-data";
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
import { DEFAULT_RULES, loadRules, saveRules } from "@/background/storage/rules";
import { clearSiteSuggestions } from "@/background/storage/site-suggestions";
import {
  DEFAULT_TRUSTED_SITES,
  loadTrustedSites,
  saveTrustedSites,
} from "@/background/storage/trusted-sites";
import type { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import { LogCategory } from "@/shared/types";
import type {
  ExtensionCommand,
  ExportSettingsResponse,
  ImportSettingsResponse,
  ResetSettingsResponse,
  SaveLocationResponse,
} from "@/shared/types";

export { getTrustedTabIds } from "@/background/settings-save-command";

type ImportCommand = Extract<
  ExtensionCommand,
  { type: typeof EXTENSION_COMMAND_TYPES.importSettings }
>;
type LocationModelCommand = Extract<
  ExtensionCommand,
  { type: typeof EXTENSION_COMMAND_TYPES.saveLocationModel }
>;
type ImportedSettings = ReturnType<typeof validateImportedSettings>;

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
    await deps.ensureStorageMigration();
    const settings = validateSettings(
      command.locations,
      command.rules,
      command.containerAssignments,
    );
    await Promise.all([
      saveLocations(settings.locations),
      saveRules(settings.rules),
      saveContainerAssignments(settings.containerAssignments),
    ]);
    deps.setCachedValues({
      profiles: settings.locations,
      rules: settings.rules,
      containerAssignments: settings.containerAssignments,
    });
    await deps.syncPreloadedState();
    await deps.resyncActiveHeaderRules();
    await deps.refreshFxInjectionMode();
    return {
      ok: true,
      locations: settings.locations,
      rules: settings.rules,
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

const persistImport = async (settings: ImportedSettings): Promise<void> => {
  const containerAssignments = settings.containerAssignments ?? [];
  await Promise.all([
    saveLocations(settings.locations),
    saveRules(settings.rules),
    saveTrustedSites(settings.trustedSites),
    saveContainerAssignments(containerAssignments),
    clearSiteSuggestions(),
    savePreferences({
      themeMode: settings.themeMode,
      themeAccentPreset: settings.themeAccentPreset,
      reduceMotion: settings.reduceMotion,
      debugMode: settings.debugMode,
      watchPositionDelay: settings.watchPositionDelay,
      osmConsent: settings.osmConsent,
      browserFingerprintSpoofingEnabled: settings.browserFingerprintSpoofingEnabled,
      featureFlags: settings.featureFlags,
      sharedWorkerHandlingMode: settings.sharedWorkerHandlingMode,
      sharedWorkerCompatibilityMode: settings.sharedWorkerCompatibilityMode,
      highContrastMode: settings.highContrastMode,
      highContrastExplicit: settings.highContrastExplicit,
      defaultNoiseRadius: settings.defaultNoiseRadius,
      randomizeGeneratedLocationByDefault: settings.randomizeGeneratedLocationByDefault,
      generatedLocationRandomizationRadiusKm:
        settings.generatedLocationRandomizationRadiusKm,
      onboardingCompleted: settings.onboardingCompleted,
      showBadgeQueryCount: settings.showBadgeQueryCount,
      includeDateCallsInBadgeCount: settings.includeDateCallsInBadgeCount,
    }),
    saveSharedSpoofing(settings.sharedSpoofing),
    saveGlobalFallbackRule(settings.globalFallbackRule),
  ]);
  await saveLegacyBehavior(settings.legacyBehavior);
};

const cacheImport = (deps: SettingsCommandDeps, settings: ImportedSettings): void => {
  deps.setCachedValues({
    profiles: settings.locations,
    rules: settings.rules,
    trustedSites: settings.trustedSites,
    themeMode: settings.themeMode,
    themeAccentPreset: settings.themeAccentPreset,
    reduceMotion: settings.reduceMotion,
    debugMode: settings.debugMode,
    watchPositionDelay: settings.watchPositionDelay,
    osmConsent: settings.osmConsent,
    browserFingerprintSpoofingEnabled: settings.browserFingerprintSpoofingEnabled,
    featureFlags: settings.featureFlags,
    sharedWorkerHandlingMode: settings.sharedWorkerHandlingMode,
    sharedWorkerCompatibilityMode: settings.sharedWorkerCompatibilityMode,
    sharedSpoofing: settings.sharedSpoofing,
    globalFallbackRule: settings.globalFallbackRule,
    highContrastMode: settings.highContrastMode,
    defaultNoiseRadius: settings.defaultNoiseRadius,
    randomizeGeneratedLocationByDefault: settings.randomizeGeneratedLocationByDefault,
    generatedLocationRandomizationRadiusKm:
      settings.generatedLocationRandomizationRadiusKm,
    showBadgeQueryCount: settings.showBadgeQueryCount,
    includeDateCallsInBadgeCount: settings.includeDateCallsInBadgeCount,
    containerAssignments: settings.containerAssignments ?? [],
  });
};

const buildImportResponse = (settings: ImportedSettings): ImportSettingsResponse => ({
  ok: true,
  locations: settings.locations,
  rules: settings.rules,
  trustedSites: settings.trustedSites,
  themeMode: settings.themeMode,
  themeAccentPreset: settings.themeAccentPreset,
  reduceMotion: settings.reduceMotion,
  debugMode: settings.debugMode,
  watchPositionDelay: settings.watchPositionDelay,
  osmConsent: settings.osmConsent,
  browserFingerprintSpoofingEnabled: settings.browserFingerprintSpoofingEnabled,
  featureFlags: settings.featureFlags,
  sharedWorkerHandlingMode: settings.sharedWorkerHandlingMode,
  sharedWorkerCompatibilityMode: settings.sharedWorkerCompatibilityMode,
  ...(settings.sharedSpoofing ? { sharedSpoofing: settings.sharedSpoofing } : {}),
  ...(settings.globalFallbackRule
    ? { globalFallbackRule: settings.globalFallbackRule }
    : {}),
  highContrastMode: settings.highContrastMode,
  defaultNoiseRadius: settings.defaultNoiseRadius,
  randomizeGeneratedLocationByDefault: settings.randomizeGeneratedLocationByDefault,
  generatedLocationRandomizationRadiusKm:
    settings.generatedLocationRandomizationRadiusKm,
  showBadgeQueryCount: settings.showBadgeQueryCount,
  includeDateCallsInBadgeCount: settings.includeDateCallsInBadgeCount,
  containerAssignments: settings.containerAssignments ?? [],
});

const applyImportEffects = async (
  deps: SettingsCommandDeps,
  settings: ImportedSettings,
): Promise<void> => {
  clearExtensionLogs();
  await deps.syncPreloadedState();
  await deps.resyncActiveHeaderRules();
  await deps.refreshFxInjectionMode();
  logExtensionEvent({
    enabled: settings.debugMode,
    category: LogCategory.System,
    event: "system.settings-imported",
    payload: {
      details: {
        locations: settings.locations.length,
        rules: settings.rules.length,
      },
    },
  });
};

const importSettings = async (
  deps: SettingsCommandDeps,
  command: ImportCommand,
): Promise<ImportSettingsResponse> => {
  try {
    await deps.ensureStorageMigration();
    const onboardingWasComplete = (await getPreferences()).onboardingCompleted;
    const settings = validateImportedSettings({
      ...command.settings,
      onboardingCompleted:
        command.settings.onboardingCompleted ?? onboardingWasComplete,
    });
    await persistImport(settings);
    cacheImport(deps, settings);
    await applyImportEffects(deps, settings);
    return buildImportResponse(settings);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Importing settings failed.",
    };
  }
};

export const createSettingsHandlers = (deps: SettingsCommandDeps) => ({
  exportSettings: exportSettings.bind(null, deps),
  saveSimpleSettings: saveSimpleSettings.bind(null, deps),
  saveLocationModel: saveLocationModel.bind(null, deps),
  resetSettings: resetSettings.bind(null, deps),
  importSettings: importSettings.bind(null, deps),
});
