import { createSnapshotCache } from "@/background/effective-snapshot-cache";
import type { UserScriptRuleEntry } from "@/background/firefox-user-scripts";
import { createRewriteTracker } from "@/background/shared-worker-rewrite";
import type { FeatureFlags } from "@/shared/feature-flags";
import type {
  ContainerAssignment,
  ControlState,
  DomainRule,
  EffectiveTabContext,
  GlobalFallbackRule,
  Location,
  OsmConsentState,
  SharedSpoofingConfig,
  SharedWorkerHandlingMode,
  ThemeAccentPreset,
  ThemeMode,
  TrustedSite,
} from "@/shared/types";

export type CachedSettings = {
  profiles: Location[] | null;
  rules: DomainRule[] | null;
  trustedSites: TrustedSite[] | null;
  themeMode: ThemeMode | null;
  themeAccentPreset: ThemeAccentPreset | null;
  reduceMotion: boolean | null;
  debugMode: boolean | null;
  watchPositionDelay: [number, number] | null;
  osmConsent: OsmConsentState | null;
  browserFingerprintSpoofingEnabled: boolean | null;
  featureFlags: FeatureFlags | null;
  sharedWorkerHandlingMode: SharedWorkerHandlingMode | null;
  sharedWorkerCompatibilityMode: boolean | null;
  sharedSpoofingLoaded: boolean;
  sharedSpoofing: SharedSpoofingConfig | undefined;
  globalFallbackRuleLoaded: boolean;
  globalFallbackRule: GlobalFallbackRule | undefined;
  highContrastMode: boolean | null;
  defaultNoiseRadius: number | null;
  randomizeGeneratedLocationByDefault: boolean | null;
  generatedLocationRandomizationRadiusKm: number | null;
  showBadgeQueryCount: boolean | null;
  includeDateCallsInBadgeCount: boolean | null;
  containerAssignments: ContainerAssignment[] | null;
};

export type MutableCachedSettings = Partial<{
  profiles: Location[];
  rules: DomainRule[];
  trustedSites: TrustedSite[];
  themeMode: ThemeMode;
  themeAccentPreset: ThemeAccentPreset;
  reduceMotion: boolean;
  debugMode: boolean;
  watchPositionDelay: [number, number];
  osmConsent: OsmConsentState;
  browserFingerprintSpoofingEnabled: boolean;
  featureFlags: FeatureFlags;
  sharedWorkerHandlingMode: SharedWorkerHandlingMode;
  sharedWorkerCompatibilityMode: boolean;
  sharedSpoofing: SharedSpoofingConfig | undefined;
  globalFallbackRule: GlobalFallbackRule | undefined;
  highContrastMode: boolean;
  defaultNoiseRadius: number;
  randomizeGeneratedLocationByDefault: boolean;
  generatedLocationRandomizationRadiusKm: number;
  showBadgeQueryCount: boolean;
  includeDateCallsInBadgeCount: boolean;
  containerAssignments: ContainerAssignment[];
}>;

export type CachedSettingsState = {
  profiles: Location[];
  rules: DomainRule[];
  trustedSites: TrustedSite[];
  controlState: ControlState;
  themeMode: ThemeMode;
  themeAccentPreset: ThemeAccentPreset;
  reduceMotion: boolean;
  debugMode: boolean;
  watchPositionDelay: [number, number];
  osmConsent: OsmConsentState;
  browserFingerprintSpoofingEnabled: boolean;
  featureFlags: FeatureFlags;
  sharedWorkerHandlingMode: SharedWorkerHandlingMode;
  sharedWorkerCompatibilityMode: boolean;
  sharedSpoofing: SharedSpoofingConfig | undefined;
  globalFallbackRule: GlobalFallbackRule | undefined;
  highContrastMode: boolean;
  defaultNoiseRadius: number;
  randomizeGeneratedLocationByDefault: boolean;
  generatedLocationRandomizationRadiusKm: number;
  showBadgeQueryCount: boolean;
  includeDateCallsInBadgeCount: boolean;
  attentionMotionEnabled: boolean;
  containerAssignments: ContainerAssignment[];
};

class BackgroundRuntimeState<TPreparedDecisions> {
  readonly activeTabContexts = new Map<number, EffectiveTabContext>();
  readonly effectiveSnapshotCache = createSnapshotCache();
  readonly rewriteTracker = createRewriteTracker();
  readonly rewriteRequestIds = new Set<string>();

  private rules: DomainRule[] | null = null;
  private trustedSites: TrustedSite[] | null = null;
  private profiles: Location[] | null = null;
  private controlState: ControlState | null = null;
  private themeMode: ThemeMode | null = null;
  private accent: ThemeAccentPreset | null = null;
  private reduceMotion: boolean | null = null;
  private debugMode: boolean | null = null;
  private watchDelay: [number, number] | null = null;
  private osmConsent: OsmConsentState | null = null;
  private fingerprintEnabled: boolean | null = null;
  private featureFlags: FeatureFlags | null = null;
  private workerMode: SharedWorkerHandlingMode | null = null;
  private workerCompatibility: boolean | null = null;
  private spoofingLoaded = false;
  private sharedSpoofing: SharedSpoofingConfig | undefined;
  private fallbackLoaded = false;
  private fallback: GlobalFallbackRule | undefined;
  private highContrast: boolean | null = null;
  private noiseRadius: number | null = null;
  private randomizeLocations: boolean | null = null;
  private randomRadius: number | null = null;
  private badgeCount: boolean | null = null;
  private dateBadge: boolean | null = null;
  private attentionMotion: boolean | null = null;
  private containers: ContainerAssignment[] | null = null;
  private fxSeedEntries: UserScriptRuleEntry[] | null = null;
  private preparedDecisions: TPreparedDecisions | null = null;
  private userScriptCount = 0;
  private userScriptSyncOk = false;

  private invalidateDecisions = (): void => {
    this.preparedDecisions = null;
  };

  getActiveTabContexts = (): EffectiveTabContext[] => [
    ...this.activeTabContexts.values(),
  ];
  getLastKnownRules = (): DomainRule[] | null => this.rules;
  setLastKnownRules = (value: DomainRule[] | null): void => {
    this.rules = value;
    this.effectiveSnapshotCache.clear();
    this.invalidateDecisions();
  };
  getLastKnownTrustedSites = (): TrustedSite[] | null => this.trustedSites;
  setLastKnownTrustedSites = (value: TrustedSite[] | null): void => {
    this.trustedSites = value;
    this.effectiveSnapshotCache.clear();
    this.invalidateDecisions();
  };
  getLastKnownProfiles = (): Location[] | null => this.profiles;
  setLastKnownProfiles = (value: Location[] | null): void => {
    this.profiles = value;
    this.invalidateDecisions();
  };
  getLastKnownControlState = (): ControlState | null => this.controlState;
  setLastKnownControlState = (value: ControlState | null): void => {
    this.controlState = value;
    this.invalidateDecisions();
  };
  getLastKnownThemeMode = (): ThemeMode | null => this.themeMode;
  setLastKnownThemeMode = (value: ThemeMode | null): void => {
    this.themeMode = value;
  };
  getKnownAccent = (): ThemeAccentPreset | null => this.accent;
  setKnownAccent = (value: ThemeAccentPreset | null): void => {
    this.accent = value;
  };
  getLastKnownReduceMotion = (): boolean | null => this.reduceMotion;
  setLastKnownReduceMotion = (value: boolean | null): void => {
    this.reduceMotion = value;
  };
  getLastKnownDebugMode = (): boolean | null => this.debugMode;
  setLastKnownDebugMode = (value: boolean | null): void => {
    this.debugMode = value;
    this.invalidateDecisions();
  };
  getKnownWatchDelay = (): [number, number] | null => this.watchDelay;
  setKnownWatchDelay = (value: [number, number] | null): void => {
    this.watchDelay = value;
  };
  getLastKnownOsmConsent = (): OsmConsentState | null => this.osmConsent;
  setLastKnownOsmConsent = (value: OsmConsentState | null): void => {
    this.osmConsent = value;
  };
  getKnownFingerprintEnabled = (): boolean | null => this.fingerprintEnabled;
  setKnownFingerprintEnabled = (value: boolean | null): void => {
    this.fingerprintEnabled = value;
  };
  getKnownWorkerMode = (): SharedWorkerHandlingMode | null => this.workerMode;
  setKnownWorkerMode = (value: SharedWorkerHandlingMode | null): void => {
    this.workerMode = value;
  };
  getKnownWorkerCompatibility = (): boolean | null => this.workerCompatibility;
  setKnownWorkerCompatibility = (value: boolean | null): void => {
    this.workerCompatibility = value;
  };
  getSpoofingLoaded = (): boolean => this.spoofingLoaded;
  getLastKnownSharedSpoofing = (): SharedSpoofingConfig | undefined =>
    this.sharedSpoofing;
  setLastKnownSharedSpoofing = (value: SharedSpoofingConfig | undefined): void => {
    this.spoofingLoaded = true;
    this.sharedSpoofing = value;
  };
  getKnownFallbackLoaded = (): boolean => this.fallbackLoaded;
  getKnownFallback = (): GlobalFallbackRule | undefined => this.fallback;
  setKnownFallback = (value: GlobalFallbackRule | undefined): void => {
    this.fallbackLoaded = true;
    this.fallback = value;
    this.invalidateDecisions();
  };
  getKnownHighContrast = (): boolean | null => this.highContrast;
  setKnownHighContrast = (value: boolean | null): void => {
    this.highContrast = value;
  };
  getKnownNoiseRadius = (): number | null => this.noiseRadius;
  setKnownNoiseRadius = (value: number | null): void => {
    this.noiseRadius = value;
  };
  getKnownRandomizeLocations = (): boolean | null => this.randomizeLocations;
  setKnownRandomizeLocations = (value: boolean | null): void => {
    this.randomizeLocations = value;
  };
  getKnownRandomRadius = (): number | null => this.randomRadius;
  setKnownRandomRadius = (value: number | null): void => {
    this.randomRadius = value;
  };
  getBadgeCountSetting = (): boolean | null => this.badgeCount;
  setKnownBadgeCount = (value: boolean | null): void => {
    this.badgeCount = value;
  };
  getDateBadgeSetting = (): boolean | null => this.dateBadge;
  setKnownDateBadge = (value: boolean | null): void => {
    this.dateBadge = value;
  };
  getKnownAttentionMotion = (): boolean | null => this.attentionMotion;
  setKnownAttentionMotion = (value: boolean | null): void => {
    this.attentionMotion = value;
  };
  getKnownContainers = (): ContainerAssignment[] | null => this.containers;
  setKnownContainers = (value: ContainerAssignment[] | null): void => {
    this.containers = value;
    this.invalidateDecisions();
  };
  getKnownFxSeedEntries = (): UserScriptRuleEntry[] | null => this.fxSeedEntries;
  setKnownFxSeedEntries = (value: UserScriptRuleEntry[] | null): void => {
    this.fxSeedEntries = value;
  };
  getPreparedDecisions = (): TPreparedDecisions | null => this.preparedDecisions;
  setPreparedRuntimeDecisions = (value: TPreparedDecisions | null): void => {
    this.preparedDecisions = value;
  };
  getKnownUserScriptCount = (): number => this.userScriptCount;
  setKnownUserScriptCount = (value: number): void => {
    this.userScriptCount = value;
  };
  getUserScriptSyncOk = (): boolean => this.userScriptSyncOk;
  setUserScriptSyncOk = (value: boolean): void => {
    this.userScriptSyncOk = value;
  };

  getCachedValues = (): CachedSettings => ({
    profiles: this.profiles,
    rules: this.rules,
    trustedSites: this.trustedSites,
    themeMode: this.themeMode,
    themeAccentPreset: this.accent,
    reduceMotion: this.reduceMotion,
    debugMode: this.debugMode,
    watchPositionDelay: this.watchDelay,
    osmConsent: this.osmConsent,
    browserFingerprintSpoofingEnabled: this.fingerprintEnabled,
    featureFlags: this.featureFlags,
    sharedWorkerHandlingMode: this.workerMode,
    sharedWorkerCompatibilityMode: this.workerCompatibility,
    sharedSpoofingLoaded: this.spoofingLoaded,
    sharedSpoofing: this.sharedSpoofing,
    globalFallbackRuleLoaded: this.fallbackLoaded,
    globalFallbackRule: this.fallback,
    highContrastMode: this.highContrast,
    defaultNoiseRadius: this.noiseRadius,
    randomizeGeneratedLocationByDefault: this.randomizeLocations,
    generatedLocationRandomizationRadiusKm: this.randomRadius,
    showBadgeQueryCount: this.badgeCount,
    includeDateCallsInBadgeCount: this.dateBadge,
    containerAssignments: this.containers,
  });

  getCachedState = (): CachedSettingsState | null => {
    if (
      !this.profiles ||
      !this.rules ||
      !this.trustedSites ||
      !this.controlState ||
      this.themeMode === null ||
      this.accent === null ||
      this.reduceMotion === null ||
      this.debugMode === null ||
      this.watchDelay === null ||
      this.osmConsent === null ||
      this.fingerprintEnabled === null ||
      this.featureFlags === null ||
      this.workerMode === null ||
      this.workerCompatibility === null ||
      this.highContrast === null ||
      this.noiseRadius === null ||
      this.randomizeLocations === null ||
      this.randomRadius === null ||
      this.badgeCount === null ||
      this.dateBadge === null ||
      this.attentionMotion === null ||
      this.containers === null
    ) {
      return null;
    }
    return {
      profiles: this.profiles,
      rules: this.rules,
      trustedSites: this.trustedSites,
      controlState: this.controlState,
      themeMode: this.themeMode,
      themeAccentPreset: this.accent,
      reduceMotion: this.reduceMotion,
      debugMode: this.debugMode,
      watchPositionDelay: this.watchDelay,
      osmConsent: this.osmConsent,
      browserFingerprintSpoofingEnabled: this.fingerprintEnabled,
      featureFlags: this.featureFlags,
      sharedWorkerHandlingMode: this.workerMode,
      sharedWorkerCompatibilityMode: this.workerCompatibility,
      sharedSpoofing: this.sharedSpoofing,
      globalFallbackRule: this.fallback,
      highContrastMode: this.highContrast,
      defaultNoiseRadius: this.noiseRadius,
      randomizeGeneratedLocationByDefault: this.randomizeLocations,
      generatedLocationRandomizationRadiusKm: this.randomRadius,
      showBadgeQueryCount: this.badgeCount,
      includeDateCallsInBadgeCount: this.dateBadge,
      attentionMotionEnabled: this.attentionMotion,
      containerAssignments: this.containers,
    };
  };

  // eslint-disable-next-line sonarjs/cognitive-complexity
  setCachedValues = (values: MutableCachedSettings): void => {
    if (Object.hasOwn(values, "profiles")) this.profiles = values.profiles!;
    if (Object.hasOwn(values, "rules")) this.rules = values.rules!;
    if (Object.hasOwn(values, "trustedSites")) {
      this.trustedSites = values.trustedSites!;
    }
    if (Object.hasOwn(values, "themeMode")) this.themeMode = values.themeMode!;
    if (Object.hasOwn(values, "themeAccentPreset")) {
      this.accent = values.themeAccentPreset!;
    }
    if (Object.hasOwn(values, "reduceMotion")) {
      this.reduceMotion = values.reduceMotion!;
    }
    if (Object.hasOwn(values, "debugMode")) this.debugMode = values.debugMode!;
    if (Object.hasOwn(values, "watchPositionDelay")) {
      this.watchDelay = values.watchPositionDelay!;
    }
    if (Object.hasOwn(values, "osmConsent")) this.osmConsent = values.osmConsent!;
    if (Object.hasOwn(values, "browserFingerprintSpoofingEnabled")) {
      this.fingerprintEnabled = values.browserFingerprintSpoofingEnabled!;
    }
    if (Object.hasOwn(values, "featureFlags")) {
      this.featureFlags = values.featureFlags!;
      this.effectiveSnapshotCache.clear();
      this.invalidateDecisions();
    }
    if (Object.hasOwn(values, "sharedWorkerHandlingMode")) {
      this.workerMode = values.sharedWorkerHandlingMode!;
      this.workerCompatibility = values.sharedWorkerHandlingMode === "native";
    }
    if (Object.hasOwn(values, "sharedWorkerCompatibilityMode")) {
      this.workerCompatibility = values.sharedWorkerCompatibilityMode!;
    }
    if (Object.hasOwn(values, "sharedSpoofing")) {
      this.spoofingLoaded = true;
      this.sharedSpoofing = values.sharedSpoofing;
    }
    if (Object.hasOwn(values, "globalFallbackRule")) {
      this.fallbackLoaded = true;
      this.fallback = values.globalFallbackRule;
    }
    if (Object.hasOwn(values, "highContrastMode")) {
      this.highContrast = values.highContrastMode!;
    }
    if (Object.hasOwn(values, "defaultNoiseRadius")) {
      this.noiseRadius = values.defaultNoiseRadius!;
    }
    if (Object.hasOwn(values, "randomizeGeneratedLocationByDefault")) {
      this.randomizeLocations = values.randomizeGeneratedLocationByDefault!;
    }
    if (Object.hasOwn(values, "generatedLocationRandomizationRadiusKm")) {
      this.randomRadius = values.generatedLocationRandomizationRadiusKm!;
    }
    if (Object.hasOwn(values, "showBadgeQueryCount")) {
      this.badgeCount = values.showBadgeQueryCount!;
    }
    if (Object.hasOwn(values, "includeDateCallsInBadgeCount")) {
      this.dateBadge = values.includeDateCallsInBadgeCount!;
    }
    if (Object.hasOwn(values, "containerAssignments")) {
      this.containers = values.containerAssignments!;
    }
  };
}

export const createRuntimeState = <TPreparedDecisions>() =>
  new BackgroundRuntimeState<TPreparedDecisions>();
