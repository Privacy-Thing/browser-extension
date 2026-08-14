/**
 * Message and response contracts exchanged with the extension background worker.
 */

import type { EXTENSION_COMMAND_TYPES } from "./extension-contract.js";
import type { FeatureFlags } from "./feature-flags.js";
import type {
  LegacySpoofingInput,
  SharedWorkerHandlingMode,
  SharedSpoofingConfig,
} from "./fingerprint-types.js";
import type { ExtensionLogLevel } from "./logging-types.js";
import type {
  ContainerAssignment,
  DomainRule,
  ExportedSettings,
  GlobalFallbackRule,
  Location,
  LocationSearchCandidate,
  OsmConsentState,
  PopupPolicyNoticeKind,
  PopupState,
  ProfileDraft,
  RuntimeSnapshot,
  SiteSuggestionKind,
  TrustedSite,
  WorkerInjectionMode,
} from "./shared-model-types.js";
import type {
  SurfaceMethodQueryCounts,
  XRaySurfaceCategory,
} from "./spoofing-surfaces.js";
import type { ThemeAccentPreset, ThemeMode } from "./theme-types.js";

export type ResolveSnapshotRequest = {
  type: typeof EXTENSION_COMMAND_TYPES.resolveRuntimeSnapshot;
  hostname: string;
};

/**
 * Successful response returned when a caller resolves the effective spoofing
 * snapshot for a hostname.
 */
export type ResolveSnapshotResponse = {
  ok: true;
  snapshot: RuntimeSnapshot | null;
};

/**
 * Message contract understood by the background worker. This union is the
 * canonical source for extension message types across UI, content, and tests.
 */
export type ExtensionCommand =
  | {
      type: typeof EXTENSION_COMMAND_TYPES.resolveRuntimeSnapshot;
      hostname: string;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.saveSimpleSettings;
      themeMode?: ThemeMode;
      themeAccentPreset?: ThemeAccentPreset;
      debugMode?: boolean;
      watchPositionDelay?: [number, number];
      osmConsent?: OsmConsentState;
      browserFingerprintSpoofingEnabled?: boolean;
      featureFlags?: Partial<FeatureFlags>;
      sharedWorkerHandlingMode?: SharedWorkerHandlingMode;
      sharedWorkerCompatibilityMode?: boolean;
      sharedSpoofing?: SharedSpoofingConfig | undefined;
      globalFallbackRule?: GlobalFallbackRule | undefined;
      trustedSites?: TrustedSite[];
      /** Legacy alias accepted at the validation boundary. */
      experimentalActiveSpoofing?: LegacySpoofingInput | undefined;
      highContrastMode?: boolean;
      highContrastExplicit?: boolean;
      defaultNoiseRadius?: number;
      randomizeGeneratedLocationByDefault?: boolean;
      generatedLocationRandomizationRadiusKm?: number;
      onboardingCompleted?: boolean;
      showBadgeQueryCount?: boolean;
      includeDateCallsInBadgeCount?: boolean;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.saveLocationModel;
      locations: Location[];
      rules: DomainRule[];
      containerAssignments?: ContainerAssignment[];
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.cleanupDomainState;
      hostname: string;
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.getCleanupAssociations;
      hostname: string;
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.previewIdentityCleanup;
      target: "rule";
      pattern: string;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.previewIdentityCleanup;
      target: "container";
      cookieStoreId: string;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.rotateIdentityTarget;
      target: "rule";
      pattern: string;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.rotateIdentityTarget;
      target: "container";
      cookieStoreId: string;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.setPanicMode;
      enabled: boolean;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.getControlState;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.getSettings;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.resetSettings;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.exportSettings;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.importSettings;
      settings: ExportedSettings;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.loadSampleData;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.importPresetLocations;
      locationIds: string[];
      randomizeWithinMeters?: number | false;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.getPopupState;
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.markNoticeRead;
      id: string;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.markNoticesAutoPresented;
      ids: string[];
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.resolvePopupNotification;
      id: string;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.upsertTrustedSite;
      hostname: string;
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.setTrustedSiteEnabled;
      pattern: string;
      enabled: boolean;
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.getUserScriptsStatus;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.requestFirefoxUserscriptsPermission;
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.assignDomainLocation;
      locationId: string;
      patternMode: "exact" | "suffix";
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.updateCurrentRule;
      /** Omit to create a protection-only rule that inherits its effective location. */
      locationId?: string;
      patternMode: "exact" | "suffix";
      replaceExisting: boolean;
      createExactOverride?: boolean;
      blockServiceWorkerRegistration?: boolean;
      /** `null` clears the override and restores inheritance. */
      serviceWorkerOverride?: boolean | null;
      /** `null` clears the Dedicated and Shared Worker mode override. */
      workerHandlingOverride?: SharedWorkerHandlingMode | null;
      /** False disables both geolocation and time/locale for this rule. */
      regionalPresetEnabled?: boolean;
      relaxCspForWorkers?: boolean;
      hostname?: string;
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.toggleCurrentRule;
      enabled: boolean;
      hostname?: string;
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.deleteCurrentRule;
      hostname?: string;
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.acceptPopupSuggestion;
      kind: SiteSuggestionKind;
      sharedWorkerHandlingMode?: WorkerInjectionMode;
      hostname?: string;
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.applyPopupPolicyAction;
      kind: PopupPolicyNoticeKind;
      sharedWorkerHandlingMode?: WorkerInjectionMode;
      hostname?: string;
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.dismissPopupSuggestion;
      kind: SiteSuggestionKind;
      hostname?: string;
      tabId?: number;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.getLogs;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.clearLogs;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.firefoxTestConfigureResponseCookie;
      hostname: string;
      cookieName: string;
      cookieValue: string | null;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.logEvent;
      event: string;
      level?: ExtensionLogLevel;
      heartbeat?: boolean;
      details: unknown;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.createLocationDraft;
      query: string;
      randomizeWithinMeters?: number | false;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.createDraftFromCandidate;
      candidate: LocationSearchCandidate;
      randomizeWithinMeters?: number | false;
    }
  | { type: typeof EXTENSION_COMMAND_TYPES.getXRayState; tabId?: number }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.sharedWorkerRewriteCandidate;
      url: string;
      name: string;
      workerType: "classic" | "module";
      origin: string;
      attemptId: string;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.surfaceUsage;
      categories: XRaySurfaceCategory[];
      sourceId?: string;
      counts?: Partial<Record<XRaySurfaceCategory, number>>;
      methodCounts?: SurfaceMethodQueryCounts;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.surfaceError;
      categories: XRaySurfaceCategory[];
    }
  | { type: typeof EXTENSION_COMMAND_TYPES.requestSurfaceUsage };

export type ControlState = {
  panicMode: boolean;
};

export type CleanupSurfaceKey =
  | "cookies"
  | "local-storage"
  | "indexed-db"
  | "cache-storage"
  | "service-workers"
  | "page-storage";

export type CleanupPlan = {
  target: "chromium" | "firefox-default" | "firefox-container";
  expectedOutcome: "complete" | "partial";
  surfaces: Array<{
    key: CleanupSurfaceKey;
    available: boolean;
    reasonKey?: string;
  }>;
};

export type CleanupResult = {
  outcome: "complete" | "partial" | "failed";
  surfaces: Array<{
    key: CleanupSurfaceKey;
    status: "cleaned" | "skipped" | "failed";
    reasonKey?: string;
  }>;
};

export type CleanupDomainResponse = {
  ok: true;
  cleanedOrigins: string[];
  plan: CleanupPlan;
  result: CleanupResult;
};

export type CleanupAssociation = {
  hostname: string;
  exactOrigin: string | null;
  cookieStoreId: string | null;
  identityKind: "rule" | "container" | "fallback" | "current";
  identityPattern: string | null;
  identityStoreId: string | null;
};

export type CleanupLinksResponse = {
  ok: true;
  hostname: string;
  trigger: "new-identity";
  cleanupHostnames: string[];
  exactOrigins: string[];
  cookieStoreId: string | null;
  associations: CleanupAssociation[];
  plan: CleanupPlan;
};

export type CleanupPreviewResponse =
  | {
      ok: true;
      target: "rule";
      pattern: string;
      cleanupHostnames: string[];
    }
  | {
      ok: true;
      target: "container";
      cookieStoreId: string;
      cleanupHostnames: string[];
    }
  | {
      ok: false;
      error: string;
    };

export type RotateIdentityResponse =
  | {
      ok: true;
      cleanedOrigins: string[];
      target: "rule";
      pattern: string;
      ruleSeedKey: string;
    }
  | {
      ok: true;
      cleanedOrigins: string[];
      target: "container";
      cookieStoreId: string;
      ruleSeedKey: string;
    }
  | {
      ok: false;
      error: string;
    };

export type SetPanicModeResponse = {
  ok: true;
  state: ControlState;
};

export type GetControlStateResponse = {
  ok: true;
  state: ControlState;
};

/**
 * Response returned when the options page asks for the full persisted settings
 * model plus any migration notice that should be shown to the user.
 */
export type GetSettingsResponse = {
  ok: true;
  locations: Location[];
  rules: DomainRule[];
  trustedSites: TrustedSite[];
  globalFallbackRule?: GlobalFallbackRule | undefined;
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
  sharedSpoofing?: SharedSpoofingConfig | undefined;
  containerAssignments?: ContainerAssignment[];
  highContrastMode: boolean;
  defaultNoiseRadius: number;
  randomizeGeneratedLocationByDefault: boolean;
  generatedLocationRandomizationRadiusKm: number;
  showBadgeQueryCount: boolean;
  includeDateCallsInBadgeCount: boolean;
  onboardingCompleted?: boolean;
  notice: string | null;
};

export type SaveSettingsResponse =
  | {
      ok: true;
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
      sharedSpoofing?: SharedSpoofingConfig | undefined;
      globalFallbackRule?: GlobalFallbackRule | undefined;
      trustedSites: TrustedSite[];
      highContrastMode: boolean;
      defaultNoiseRadius: number;
      randomizeGeneratedLocationByDefault: boolean;
      generatedLocationRandomizationRadiusKm: number;
      showBadgeQueryCount: boolean;
      includeDateCallsInBadgeCount: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export type SaveLocationResponse =
  | {
      ok: true;
      locations: Location[];
      rules: DomainRule[];
      containerAssignments?: ContainerAssignment[];
    }
  | {
      ok: false;
      error: string;
    };

export type ResetSettingsResponse = {
  ok: true;
  locations: Location[];
  rules: DomainRule[];
  trustedSites: TrustedSite[];
  globalFallbackRule?: GlobalFallbackRule | undefined;
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
  sharedSpoofing?: SharedSpoofingConfig | undefined;
  containerAssignments?: ContainerAssignment[];
  highContrastMode: boolean;
  defaultNoiseRadius: number;
  randomizeGeneratedLocationByDefault: boolean;
  generatedLocationRandomizationRadiusKm: number;
  showBadgeQueryCount: boolean;
  includeDateCallsInBadgeCount: boolean;
};

export type ExportSettingsResponse = {
  ok: true;
  settings: ExportedSettings;
};

export type ImportSettingsResponse =
  | {
      ok: true;
      locations: Location[];
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
      sharedSpoofing?: SharedSpoofingConfig | undefined;
      globalFallbackRule?: GlobalFallbackRule | undefined;
      containerAssignments?: ContainerAssignment[];
      highContrastMode: boolean;
      defaultNoiseRadius: number;
      randomizeGeneratedLocationByDefault: boolean;
      generatedLocationRandomizationRadiusKm: number;
      showBadgeQueryCount: boolean;
      includeDateCallsInBadgeCount: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export type LoadSampleDataResponse =
  | {
      ok: true;
      locations: Location[];
      importedLocationIds: string[];
    }
  | {
      ok: false;
      error: string;
    };

export type ImportLocationsResponse =
  | {
      ok: true;
      locations: Location[];
      importedLocationIds: string[];
    }
  | {
      ok: false;
      error: string;
    };

export type GetPopupStateResponse = {
  ok: true;
  state: PopupState;
};

export type FxUserScriptsResponse = {
  ok: true;
  readiness: {
    hasPermission: boolean;
    registrationCount: number;
    lastSyncSucceeded: boolean;
    ready: boolean;
  };
};

export type FxPermissionResponse =
  | {
      ok: true;
      granted: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export type AssignLocationResponse =
  | {
      ok: true;
      state: PopupState;
    }
  | {
      ok: false;
      error: string;
    };

export type UpdateRuleResponse =
  | {
      ok: true;
      state: PopupState;
      replacedExisting: boolean;
    }
  | {
      ok: false;
      error: string;
      conflictPattern?: string;
    };

export type ToggleRuleResponse =
  | {
      ok: true;
      state: PopupState;
    }
  | {
      ok: false;
      error: string;
    };

export type DeleteRuleResponse =
  | {
      ok: true;
      state: PopupState;
    }
  | {
      ok: false;
      error: string;
    };

export type ApplySuggestionResponse =
  | {
      ok: true;
      state: PopupState;
    }
  | {
      ok: false;
      error: string;
    };

export type LocationDraftResponse =
  | {
      ok: true;
      location: ProfileDraft;
    }
  | {
      ok: true;
      candidates: LocationSearchCandidate[];
    }
  | {
      ok: false;
      error: string;
    };

export type EffectiveTabContext = {
  tabId: number;
  hostname: string;
  cookieStoreId?: string;
};

export type DynamicHeaderRule = {
  id: number;
  priority: number;
  action: chrome.declarativeNetRequest.RuleAction;
  condition: chrome.declarativeNetRequest.RuleCondition;
};

export type XRayAccessedCategories = Partial<Record<XRaySurfaceCategory, true>>;
