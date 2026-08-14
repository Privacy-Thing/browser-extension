/**
 * Shared domain contracts exchanged between the background worker, injected
 * runtimes, and UI surfaces.
 */

import type {
  SharedWorkerStatus,
  SurfaceActivity,
  SurfaceApplicability,
  SurfaceAssessment,
  SurfaceAttention,
  SurfaceEnforcementKind,
  SurfaceInstallationState,
  SurfaceIntegrityState,
  SurfacePolicyState,
  SurfacePresentationState,
  ProtectionEvidence,
  SurfaceProtectionReason,
} from "@privacy-brand/xray-protocol";

import type { FeatureFlags } from "./feature-flags.js";
import type {
  BrowserClientHintBrand,
  BrowserClientHints,
  BrowserFingerprint,
  CapturedFingerprint,
  FingerprintToggles,
  SurfaceOverrides,
  LegacySpoofingInput,
  SharedWorkerHandlingMode,
  SharedSpoofingConfig,
} from "./fingerprint-types.js";
import type {
  FirefoxContainerColor,
  FirefoxContainerIcon,
} from "./firefox-containers.js";
import {
  ExtensionLogLevel,
  getLogLevelsAtOrAbove,
  LogCategory,
  normalizeLogLevel,
} from "./logging-types.js";
import type {
  ClearLogsResponse,
  ExtensionLogEntry,
  GetLogsResponse,
} from "./logging-types.js";
import type { NotificationChannel } from "./notification-version.js";
import type {
  XRaySurfaceCategory,
  SpoofingSurfaceKey,
  SpoofingSurfaceMethodId,
  SurfaceMethodQueryCounts,
} from "./spoofing-surfaces.js";
import { XRAY_SURFACE_CATEGORIES } from "./spoofing-surfaces.js";
import { DEFAULT_ACCENT_PRESET, THEME_ACCENT_PRESETS } from "./theme-types.js";
import type { ThemeAccentPreset, ThemeMode } from "./theme-types.js";

export type {
  BrowserClientHintBrand,
  BrowserClientHints,
  BrowserFingerprint,
  CapturedFingerprint,
  ClearLogsResponse,
  ExtensionLogEntry,
  FingerprintToggles,
  SurfaceOverrides,
  GetLogsResponse,
  LegacySpoofingInput,
  SharedWorkerHandlingMode,
  SharedSpoofingConfig,
  XRaySurfaceCategory,
  SpoofingSurfaceMethodId,
  SurfaceMethodQueryCounts,
  SurfaceActivity,
  SurfaceApplicability,
  SurfaceAssessment,
  SurfaceAttention,
  SurfaceEnforcementKind,
  SurfaceInstallationState,
  SurfaceIntegrityState,
  SurfacePolicyState,
  SurfacePresentationState,
  ProtectionEvidence,
  SurfaceProtectionReason,
  SharedWorkerStatus,
  ThemeAccentPreset,
  ThemeMode,
};
export {
  ExtensionLogLevel,
  DEFAULT_ACCENT_PRESET,
  XRAY_SURFACE_CATEGORIES,
  getLogLevelsAtOrAbove,
  LogCategory,
  normalizeLogLevel,
  THEME_ACCENT_PRESETS,
};

/**
 * Privacy Thing-owned spoofing fields shared by rules, container assignments, and
 * the Default Rule. Browser-managed container metadata lives elsewhere.
 */
export type SpoofingTargetFields = {
  locationId?: string | undefined;
  ruleSeedKey?: string;
  fingerprintSurfaceOverrides?: SurfaceOverrides | undefined;
  /** Opaque diagnostic registration nonce. Stable per spoofing target — never rotated. */
  authKey?: string;
};

export type ToggleableSurfaceFields = SpoofingTargetFields & {
  enabled?: boolean | undefined;
};

/**
 * Per-domain routing rule that activates a saved location profile for matching
 * hostnames.
 */
export type DomainRule = ToggleableSurfaceFields & {
  pattern: string;
  enabled: boolean;
  /**
   * Service Worker blocking is no longer a dedicated field — it is the
   * `serviceWorker` entry of {@link SurfaceOverrides} (global default
   * in `sharedSpoofing`). Legacy `blockServiceWorkerRegistration` input is
   * migrated to that override by `domainRuleSchema`.
   */
  relaxCspForWorkers?: boolean;
};

/**
 * Domain patterns where Privacy Thing must remain disabled before any other
 * resolution source is considered.
 */
export type TrustedSite = {
  pattern: string;
  enabled: boolean;
};

/**
 * Global fallback rule applied only when no domain rule and no container
 * assignment resolve a location for the current tab.
 */
export type GlobalFallbackRule = SpoofingTargetFields & {
  enabled: boolean;
  ruleSeedKey: string;
};

export type SiteSuggestionKind =
  "worker-csp-relaxation" | "shared-worker-injection-relaxation";
export type SiteSuggestionStatus = "pending" | "dismissed" | "accepted";
export type WorkerInjectionMode = Extract<SharedWorkerHandlingMode, "native" | "spoof">;

export type PopupSiteSuggestion = {
  kind: SiteSuggestionKind;
  status: Exclude<SiteSuggestionStatus, "accepted">;
  rediscovered: boolean;
  detectionCount: number;
  lastDetectedAt: string;
};

export type PopupPolicyNoticeKind = "service-worker-block" | "shared-worker-strict";
export type PopupNotificationKind =
  SiteSuggestionKind | PopupPolicyNoticeKind | "significant-update";
export type PopupNoticeSeverity = "info" | "needs-action";
export type PopupNotificationScope = "site" | "extension";

export type PopupNotification = {
  id: string;
  kind: PopupNotificationKind;
  scope: PopupNotificationScope;
  dedupeKey: string;
  severity: PopupNoticeSeverity;
  hostname?: string;
  cookieStoreId?: string;
  channel?: NotificationChannel;
  introducedInVersion?: string;
  createdAt: string;
  lastDetectedAt: string;
  generation: number;
  readAt: string | null;
  resolvedAt: string | null;
  autoPresentedAt: string | null;
  pulseShownAt: string | null;
  actionTarget?: string;
};

export type ContainerAssignment = ToggleableSurfaceFields & {
  cookieStoreId: string;
};

export type SeenHostRecord = {
  hostname: string;
  exactOrigin?: string;
  cookieStoreId?: string;
  identityKind: "rule" | "container" | "fallback";
  identityPattern?: string;
  identityStoreId?: string;
  identitySeedKey: string;
  lastSeenAt: string;
};

export type ContainerPresentation = {
  cookieStoreId: string;
  name: string;
  icon: FirefoxContainerIcon;
  iconUrl: string;
  color: FirefoxContainerColor;
  colorCode: string;
};

export type HydratedAssignment = ContainerAssignment & {
  container: ContainerPresentation;
};

/**
 * Human-readable location profile persisted in extension settings and selected
 * by rules or Firefox container assignments.
 */
export type Location = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  noiseRadius: number;
  language: string;
  languages: string[];
  preferEnglishContent?: boolean;
  timeZone: string;
};

export type ProfileDraft = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  noiseRadius: number;
  language: string;
  languages: string[];
  preferEnglishContent?: boolean;
  timeZone: string;
  sourceLabel: string;
  languageSelection: {
    options: Array<{
      value: string;
      label: string;
      language: string;
      languages: string[];
    }>;
    selectedValue: string;
    required: boolean;
  };
};

export type LocationSearchCandidate = {
  id: string;
  label: string;
  description: string;
  sourceLabel: string;
  latitude: number;
  longitude: number;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
};

export type OsmConsentState = "unknown" | "granted" | "denied";

/**
 * Normalized runtime payload injected into the page `MAIN` world and worker
 * bootstraps. Hot-path code should read from this snapshot instead of querying
 * background state.
 */
export type RuntimeSnapshot = {
  geo: {
    latitude: number;
    longitude: number;
    accuracy: number;
    noiseRadius: number;
  };
  locale: {
    language: string;
    languages: readonly string[];
    timeZone: string;
    acceptLanguage: string;
    formattingLanguage?: string;
    formattingLanguages?: readonly string[];
  };
  /** @deprecated Compatibility payload for pre-epoch-fix runtimes. New code uses locale.timeZone. */
  date: {
    baseEpochMs: number;
    offsetMs: number;
    timeZone: string;
  };
  debugMode: boolean;
  watchPositionDelay: [number, number];
  sharedWorkerHandlingMode?: SharedWorkerHandlingMode;
  sharedWorkerCompatibilityMode?: boolean;
  geolocationEnabled?: boolean | undefined;
  timeLocaleEnabled?: boolean | undefined;
  temporalApiEnabled?: boolean | undefined;
  fingerprint?: BrowserFingerprint;
  logEventName?: string;
  blockServiceWorkerRegistration?: boolean;
  /** Opaque diagnostic registration nonce propagated from the winning rule. */
  authKey?: string;
};

/**
 * Portable settings export/import format used by backups, migrations, and
 * automation-oriented setup flows.
 */
export type ExportedSettings = {
  version: 1 | 2 | 3;
  exportedAt: string;
  locations: Array<Location & { behaviorProfileId?: string }>;
  rules: DomainRule[];
  trustedSites?: TrustedSite[];
  globalFallbackRule?: GlobalFallbackRule | undefined;
  themeMode?: ThemeMode;
  themeAccentPreset?: ThemeAccentPreset;
  reduceMotion?: boolean;
  debugMode?: boolean;
  watchPositionDelay?: [number, number];
  osmConsent?: OsmConsentState;
  browserFingerprintSpoofingEnabled?: boolean;
  sharedWorkerHandlingMode?: SharedWorkerHandlingMode;
  sharedWorkerCompatibilityMode?: boolean;
  sharedSpoofing?: SharedSpoofingConfig | undefined;
  /** Legacy import-only alias accepted for backward compatibility. */
  experimentalActiveSpoofing?: LegacySpoofingInput | undefined;
  /** Active flags are exported; unknown keys remain import-only legacy data. */
  featureFlags?: Partial<FeatureFlags> & Record<string, boolean>;
  /** Legacy import-only flag preserved locally but never used or exported. */
  behavioralProfilesEnabled?: boolean;
  /** Legacy import-only data preserved locally but never used or exported. */
  behavioralProfiles?: unknown[];
  containerAssignments?: ContainerAssignment[];
  highContrastMode?: boolean;
  highContrastExplicit?: boolean;
  defaultNoiseRadius?: number;
  randomizeGeneratedLocationByDefault?: boolean;
  generatedLocationRandomizationRadiusKm?: number;
  onboardingCompleted?: boolean;
  showBadgeQueryCount?: boolean;
  includeDateCallsInBadgeCount?: boolean;
};

/**
 * Popup-facing state assembled by the background worker for the active tab.
 */
export type PopupEffectiveSource =
  "site-rule" | "container" | "default-rule" | "trusted-site" | "none";

export type PopupResolutionState =
  | "active"
  | "protections"
  | "disabled"
  | "unconfigured"
  | "trusted"
  | "unsupported"
  | "panic";

export type PopupSurfaceGroup = SurfaceAssessment["group"];

export type PopupEffectiveSurface = SurfaceAssessment;

export type PopupSurfaceCounts = Record<SurfacePresentationState, number>;

export type PopupSurfaceGroupState =
  "protected" | "native-by-policy" | "pending" | "mixed";

export type PopupSurfaceGroupSummary = {
  key: PopupSurfaceGroup;
  state: PopupSurfaceGroupState;
  counts: PopupSurfaceCounts;
  attentionCount: number;
  surfaces: PopupEffectiveSurface[];
};

export type PopupEffectiveAttention = {
  kind: PopupNotificationKind;
  group: PopupSurfaceGroup;
  surfaceKey?: SpoofingSurfaceKey;
  reasonKey: string;
  actionTarget: string;
};

export type PopupEffectiveSummary = {
  generation: number;
  resolutionContext: {
    source: PopupEffectiveSource;
    state: PopupResolutionState;
    pattern: string | null;
    editable: boolean;
    toggleable: boolean;
  };
  surfaceSummary: {
    catalogSize: number;
    complete: boolean;
    counts: PopupSurfaceCounts;
    attentionCount: number;
    groups: PopupSurfaceGroupSummary[];
    surfaces: PopupEffectiveSurface[];
    highestPriorityException: PopupEffectiveSurface | null;
    highestPriorityAttention: PopupEffectiveAttention | null;
    highestPriorityContext: PopupEffectiveAttention | null;
  };
};

export type PopupState = {
  panicMode: boolean;
  effectiveSummary: PopupEffectiveSummary;
  availableLocations: Array<{
    id: string;
    label: string;
    language: string;
    languages: string[];
  }>;
  currentRule: {
    pattern: string | null;
    locationId?: string | null;
    enabled: boolean | null;
    type: "exact" | "suffix" | null;
    canToggle: boolean;
    canEdit: boolean;
    isExplicit: boolean;
    blockServiceWorkerRegistration: boolean;
    serviceWorkerOverride?: boolean;
    workerHandlingOverride?: SharedWorkerHandlingMode;
    regionalPresetEnabled: boolean;
    relaxCspForWorkers: boolean;
  };
  currentTab: {
    supported: boolean;
    hostname: string | null;
    url: string | null;
    locationLabel: string | null;
    locationId: string | null;
    locationProfileActive?: boolean;
    fallbackState?: PopupFallbackState;
    containerAssignment?: ContainerAssignment | null;
    containerAssignmentConfigured?: boolean;
    displayedRulePattern?: string | null;
    matchedRulePattern: string | null;
    matchedTrustedSitePattern?: string | null;
    matchedTrustedSiteEnabled?: boolean | null;
    hasExactRule: boolean;
    canCleanDomain: boolean;
    pendingRulePattern: string | null;
    hasMatch: boolean;
    activeContainer?: ContainerPresentation | null;
    winningSource?: "rule" | "container" | "fallback" | "trusted-site" | "none";
    firefoxFirstInlinePermissionRequired?: boolean;
    firefoxFirstInlineEnabled?: boolean;
  };
  suggestions: PopupSiteSuggestion[];
  hasSuggestionWarning: boolean;
  notifications: PopupNotification[];
  hasUnreadNotification: boolean;
};

export type PopupFallbackState = "disabled" | "active" | "protections" | "unconfigured";
