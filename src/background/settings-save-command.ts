import {
  shouldReloadRuntimeTabs,
  shouldSyncHeaderRules,
  shouldSyncPreload,
} from "@/background/runtime-refresh";
import type { CachedSettings } from "@/background/runtime-state";
import {
  validateSettingsCommand,
  type ValidatedSettingsCommand,
} from "@/background/settings";
import type { SettingsCommandDeps } from "@/background/settings-command-types";
import {
  getGlobalFallbackRule,
  getPreferences,
  getSharedSpoofing,
  saveGlobalFallbackRule,
  savePreferences,
  saveSharedSpoofing,
} from "@/background/storage/preferences";
import {
  DEFAULT_TRUSTED_SITES,
  loadTrustedSites,
  saveTrustedSites,
} from "@/background/storage/trusted-sites";
import type { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import { normalizeFeatureFlags } from "@/shared/feature-flags";
import type { FeatureFlags } from "@/shared/feature-flags";
import { normalizeWorkerMode } from "@/shared/fingerprint-types";
import { matchTrustedSite } from "@/shared/rule-resolution";
import type { Preferences } from "@/shared/settings-defaults";
import type {
  EffectiveTabContext,
  ExtensionCommand,
  GlobalFallbackRule,
  OsmConsentState,
  SaveSettingsResponse,
  SharedSpoofingConfig,
  SharedWorkerHandlingMode,
  ThemeAccentPreset,
  ThemeMode,
  TrustedSite,
} from "@/shared/types";

type ResolvedSimpleSettings = {
  nextThemeMode: ThemeMode;
  nextTrustedSites: TrustedSite[];
  nextThemeAccentPreset: ThemeAccentPreset;
  nextReduceMotion: boolean;
  nextDebugMode: boolean;
  nextWatchPositionDelay: [number, number];
  nextOsmConsent: OsmConsentState;
  nextFingerprintEnabled: boolean;
  nextFeatureFlags: FeatureFlags;
  nextWorkerMode: SharedWorkerHandlingMode;
  nextWorkerCompatibility: boolean;
  nextSharedSpoofing: SharedSpoofingConfig | undefined;
  nextGlobalFallbackRule: GlobalFallbackRule | undefined;
  nextHighContrastMode: boolean;
  nextDefaultNoiseRadius: number;
  nextRandomizeLocations: boolean;
  nextRandomRadius: number;
  nextShowBadgeQueryCount: boolean;
  nextDateBadge: boolean;
};

const isTrustedHost = (
  hostname: string,
  trustedSites: readonly TrustedSite[],
): boolean => Boolean(matchTrustedSite(hostname, trustedSites));

export const getTrustedTabIds = (
  activeTabContexts: readonly EffectiveTabContext[],
  previousTrustedSites: readonly TrustedSite[],
  nextTrustedSites: readonly TrustedSite[],
): number[] =>
  activeTabContexts.flatMap((context) =>
    isTrustedHost(context.hostname, previousTrustedSites) ===
    isTrustedHost(context.hostname, nextTrustedSites)
      ? []
      : [context.tabId],
  );

const resolveCachedSetting = <T>(
  commandValue: T | undefined,
  cachedValue: T | null,
  currentValue: T,
): T => commandValue ?? cachedValue ?? currentValue;

const resolveStoredValue = async <T>({
  command,
  key,
  cachedLoaded,
  cachedValue,
  loadCurrent,
}: {
  command: ValidatedSettingsCommand;
  key: "sharedSpoofing" | "globalFallbackRule";
  cachedLoaded: boolean;
  cachedValue: T | undefined;
  loadCurrent: () => Promise<T | undefined>;
}): Promise<T | undefined> => {
  if (Object.hasOwn(command, key)) return command[key] as T | undefined;
  return cachedLoaded ? cachedValue : loadCurrent();
};

const resolveSettings = async (
  nextCommand: ValidatedSettingsCommand,
  cachedValues: CachedSettings,
  currentPreferences: Preferences,
  previousTrustedSites: readonly TrustedSite[],
): Promise<ResolvedSimpleSettings> => {
  const nextThemeMode = resolveCachedSetting(
    nextCommand.themeMode,
    cachedValues.themeMode,
    currentPreferences.themeMode,
  );
  const nextTrustedSites = Object.hasOwn(nextCommand, "trustedSites")
    ? [...(nextCommand.trustedSites ?? DEFAULT_TRUSTED_SITES)]
    : [...previousTrustedSites];
  const nextThemeAccentPreset = resolveCachedSetting(
    nextCommand.themeAccentPreset,
    cachedValues.themeAccentPreset,
    currentPreferences.themeAccentPreset,
  );
  const nextReduceMotion = resolveCachedSetting(
    nextCommand.reduceMotion,
    cachedValues.reduceMotion,
    currentPreferences.reduceMotion,
  );
  const nextDebugMode = resolveCachedSetting(
    nextCommand.debugMode,
    cachedValues.debugMode,
    currentPreferences.debugMode,
  );
  const nextWatchPositionDelay = resolveCachedSetting(
    nextCommand.watchPositionDelay,
    cachedValues.watchPositionDelay,
    currentPreferences.watchPositionDelay,
  );
  const nextOsmConsent = resolveCachedSetting(
    nextCommand.osmConsent,
    cachedValues.osmConsent,
    currentPreferences.osmConsent,
  );
  const nextFingerprintEnabled = resolveCachedSetting(
    nextCommand.browserFingerprintSpoofingEnabled,
    cachedValues.browserFingerprintSpoofingEnabled,
    currentPreferences.browserFingerprintSpoofingEnabled,
  );
  const nextFeatureFlags = normalizeFeatureFlags({
    ...currentPreferences.featureFlags,
    ...(cachedValues.featureFlags ?? {}),
    ...nextCommand.featureFlags,
  });
  const commandWorkerMode =
    nextCommand.sharedWorkerHandlingMode ??
    (Object.hasOwn(nextCommand, "sharedWorkerCompatibilityMode")
      ? normalizeWorkerMode(undefined, nextCommand.sharedWorkerCompatibilityMode)
      : undefined);
  const nextWorkerMode = resolveCachedSetting(
    commandWorkerMode,
    cachedValues.sharedWorkerHandlingMode,
    currentPreferences.sharedWorkerHandlingMode,
  );
  const nextSharedSpoofing = await resolveStoredValue({
    command: nextCommand,
    key: "sharedSpoofing",
    cachedLoaded: cachedValues.sharedSpoofingLoaded,
    cachedValue: cachedValues.sharedSpoofing,
    loadCurrent: getSharedSpoofing,
  });
  const nextGlobalFallbackRule = await resolveStoredValue({
    command: nextCommand,
    key: "globalFallbackRule",
    cachedLoaded: cachedValues.globalFallbackRuleLoaded,
    cachedValue: cachedValues.globalFallbackRule,
    loadCurrent: getGlobalFallbackRule,
  });
  return {
    nextThemeMode,
    nextTrustedSites,
    nextThemeAccentPreset,
    nextReduceMotion,
    nextDebugMode,
    nextWatchPositionDelay,
    nextOsmConsent,
    nextFingerprintEnabled,
    nextFeatureFlags,
    nextWorkerMode,
    nextWorkerCompatibility: nextWorkerMode === "native",
    nextSharedSpoofing,
    nextGlobalFallbackRule,
    nextHighContrastMode: resolveCachedSetting(
      nextCommand.highContrastMode,
      cachedValues.highContrastMode,
      currentPreferences.highContrastMode,
    ),
    nextDefaultNoiseRadius: resolveCachedSetting(
      nextCommand.defaultNoiseRadius,
      cachedValues.defaultNoiseRadius,
      currentPreferences.defaultNoiseRadius,
    ),
    nextRandomizeLocations: resolveCachedSetting(
      nextCommand.randomizeGeneratedLocationByDefault,
      cachedValues.randomizeGeneratedLocationByDefault,
      currentPreferences.randomizeGeneratedLocationByDefault,
    ),
    nextRandomRadius: resolveCachedSetting(
      nextCommand.generatedLocationRandomizationRadiusKm,
      cachedValues.generatedLocationRandomizationRadiusKm,
      currentPreferences.generatedLocationRandomizationRadiusKm,
    ),
    nextShowBadgeQueryCount: resolveCachedSetting(
      nextCommand.showBadgeQueryCount,
      cachedValues.showBadgeQueryCount,
      currentPreferences.showBadgeQueryCount,
    ),
    nextDateBadge: resolveCachedSetting(
      nextCommand.includeDateCallsInBadgeCount,
      cachedValues.includeDateCallsInBadgeCount,
      currentPreferences.includeDateCallsInBadgeCount,
    ),
  };
};

const buildPreferencesPatch = (
  nextCommand: ValidatedSettingsCommand,
  nextWorkerMode: SharedWorkerHandlingMode,
  nextFeatureFlags: FeatureFlags,
): Partial<Preferences> => {
  const patch: Partial<Preferences> = {};
  for (const key of [
    "themeMode",
    "themeAccentPreset",
    "reduceMotion",
    "debugMode",
    "watchPositionDelay",
    "osmConsent",
    "browserFingerprintSpoofingEnabled",
    "sharedWorkerHandlingMode",
    "sharedWorkerCompatibilityMode",
    "highContrastMode",
    "highContrastExplicit",
    "defaultNoiseRadius",
    "randomizeGeneratedLocationByDefault",
    "generatedLocationRandomizationRadiusKm",
    "onboardingCompleted",
    "showBadgeQueryCount",
    "includeDateCallsInBadgeCount",
  ] as const) {
    if (Object.hasOwn(nextCommand, key))
      Object.assign(patch, { [key]: nextCommand[key] });
  }
  if (
    Object.hasOwn(nextCommand, "sharedWorkerHandlingMode") ||
    Object.hasOwn(nextCommand, "sharedWorkerCompatibilityMode")
  ) {
    patch.sharedWorkerHandlingMode = nextWorkerMode;
    patch.sharedWorkerCompatibilityMode = nextWorkerMode === "native";
  }
  if (Object.hasOwn(nextCommand, "featureFlags")) {
    patch.featureFlags = nextFeatureFlags;
  }
  return patch;
};

const persistSettings = async ({
  nextCommand,
  preferencesPatch,
  settings,
}: {
  nextCommand: ValidatedSettingsCommand;
  preferencesPatch: Partial<Preferences>;
  settings: ResolvedSimpleSettings;
}): Promise<void> => {
  await Promise.all([
    ...(Object.keys(preferencesPatch).length > 0
      ? [savePreferences(preferencesPatch)]
      : []),
    ...(Object.hasOwn(nextCommand, "sharedSpoofing")
      ? [saveSharedSpoofing(settings.nextSharedSpoofing)]
      : []),
    ...(Object.hasOwn(nextCommand, "globalFallbackRule")
      ? [saveGlobalFallbackRule(settings.nextGlobalFallbackRule)]
      : []),
    ...(Object.hasOwn(nextCommand, "trustedSites")
      ? [saveTrustedSites(settings.nextTrustedSites)]
      : []),
  ]);
};

const applySettingsEffects = async (
  deps: SettingsCommandDeps,
  nextCommand: ValidatedSettingsCommand,
  previousTrustedSites: readonly TrustedSite[],
  nextTrustedSites: readonly TrustedSite[],
): Promise<void> => {
  if (shouldSyncPreload(nextCommand)) await deps.syncPreloadedState();
  if (shouldSyncHeaderRules(nextCommand)) await deps.resyncActiveHeaderRules();
  const tabIds = new Set<number>();
  if (shouldReloadRuntimeTabs(nextCommand)) {
    for (const context of deps.getActiveTabContexts()) tabIds.add(context.tabId);
  }
  if (Object.hasOwn(nextCommand, "trustedSites")) {
    for (const tabId of getTrustedTabIds(
      deps.getActiveTabContexts(),
      previousTrustedSites,
      nextTrustedSites,
    )) {
      tabIds.add(tabId);
    }
  }
  if (tabIds.size > 0) await deps.reloadTabs([...tabIds]);
};

const cacheResolvedSettings = (
  deps: SettingsCommandDeps,
  settings: ResolvedSimpleSettings,
): void => {
  deps.setCachedValues({
    themeMode: settings.nextThemeMode,
    trustedSites: settings.nextTrustedSites,
    themeAccentPreset: settings.nextThemeAccentPreset,
    reduceMotion: settings.nextReduceMotion,
    debugMode: settings.nextDebugMode,
    watchPositionDelay: settings.nextWatchPositionDelay,
    osmConsent: settings.nextOsmConsent,
    browserFingerprintSpoofingEnabled: settings.nextFingerprintEnabled,
    featureFlags: settings.nextFeatureFlags,
    sharedWorkerHandlingMode: settings.nextWorkerMode,
    sharedWorkerCompatibilityMode: settings.nextWorkerCompatibility,
    sharedSpoofing: settings.nextSharedSpoofing,
    globalFallbackRule: settings.nextGlobalFallbackRule,
    highContrastMode: settings.nextHighContrastMode,
    defaultNoiseRadius: settings.nextDefaultNoiseRadius,
    randomizeGeneratedLocationByDefault: settings.nextRandomizeLocations,
    generatedLocationRandomizationRadiusKm: settings.nextRandomRadius,
    showBadgeQueryCount: settings.nextShowBadgeQueryCount,
    includeDateCallsInBadgeCount: settings.nextDateBadge,
  });
};

const buildSaveResponse = (settings: ResolvedSimpleSettings): SaveSettingsResponse => ({
  ok: true,
  themeMode: settings.nextThemeMode,
  themeAccentPreset: settings.nextThemeAccentPreset,
  reduceMotion: settings.nextReduceMotion,
  debugMode: settings.nextDebugMode,
  watchPositionDelay: settings.nextWatchPositionDelay,
  osmConsent: settings.nextOsmConsent,
  browserFingerprintSpoofingEnabled: settings.nextFingerprintEnabled,
  featureFlags: settings.nextFeatureFlags,
  sharedWorkerHandlingMode: settings.nextWorkerMode,
  sharedWorkerCompatibilityMode: settings.nextWorkerCompatibility,
  trustedSites: settings.nextTrustedSites,
  ...(settings.nextSharedSpoofing
    ? { sharedSpoofing: settings.nextSharedSpoofing }
    : {}),
  ...(settings.nextGlobalFallbackRule
    ? { globalFallbackRule: settings.nextGlobalFallbackRule }
    : {}),
  highContrastMode: settings.nextHighContrastMode,
  defaultNoiseRadius: settings.nextDefaultNoiseRadius,
  randomizeGeneratedLocationByDefault: settings.nextRandomizeLocations,
  generatedLocationRandomizationRadiusKm: settings.nextRandomRadius,
  showBadgeQueryCount: settings.nextShowBadgeQueryCount,
  includeDateCallsInBadgeCount: settings.nextDateBadge,
});

export const saveSimpleSettings = async (
  deps: SettingsCommandDeps,
  command: Extract<
    ExtensionCommand,
    { type: typeof EXTENSION_COMMAND_TYPES.saveSimpleSettings }
  >,
): Promise<SaveSettingsResponse> => {
  try {
    await deps.ensureStorageMigration();
    const nextCommand = validateSettingsCommand(command);
    const cachedValues = deps.getCachedValues();
    const currentPreferences = await getPreferences();
    const previousTrustedSites =
      cachedValues.trustedSites ?? (await loadTrustedSites());
    const settings = await resolveSettings(
      nextCommand,
      cachedValues,
      currentPreferences,
      previousTrustedSites,
    );
    await persistSettings({
      nextCommand,
      preferencesPatch: buildPreferencesPatch(
        nextCommand,
        settings.nextWorkerMode,
        settings.nextFeatureFlags,
      ),
      settings,
    });
    cacheResolvedSettings(deps, settings);
    await applySettingsEffects(
      deps,
      nextCommand,
      previousTrustedSites,
      settings.nextTrustedSites,
    );
    return buildSaveResponse(settings);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Saving settings failed.",
    };
  }
};
