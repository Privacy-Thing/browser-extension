import {
  DEFAULT_FEATURE_FLAGS,
  normalizeFeatureFlags,
  type FeatureFlags,
} from "@/shared/feature-flags";
import {
  normalizeWorkerMode,
  type SharedWorkerHandlingMode,
} from "@/shared/fingerprint-types";
import {
  DEFAULT_ACCENT_PRESET,
  DEFAULT_THEME_MODE,
  isThemeAccentPreset,
  isThemeMode,
} from "@/shared/theme-types";
import type { OsmConsentState, ThemeAccentPreset, ThemeMode } from "@/shared/types";

/**
 * Canonical scalar preferences for the extension.
 *
 * This is the single source of truth for these preference defaults. Storage
 * (the `preferences` object), the import parser, the runtime cache, and the
 * options UI all derive their defaults from {@link DEFAULT_PREFERENCES} via
 * {@link normalizePreferences} — never inline a per-field default.
 *
 * Out of scope: entity collections (locations, rules, trusted sites, container
 * assignments) and the schema-backed nullable objects
 * (sharedSpoofing, globalFallbackRule).
 */
export type Preferences = {
  featureFlags: FeatureFlags;
  debugMode: boolean;
  watchPositionDelay: [number, number];
  osmConsent: OsmConsentState;
  browserFingerprintSpoofingEnabled: boolean;
  sharedWorkerHandlingMode: SharedWorkerHandlingMode;
  /** @deprecated Import/migration compatibility. Use sharedWorkerHandlingMode. */
  sharedWorkerCompatibilityMode: boolean;
  onboardingCompleted: boolean;
  themeMode: ThemeMode;
  themeAccentPreset: ThemeAccentPreset;
  reduceMotion: boolean;
  highContrastMode: boolean;
  highContrastExplicit: boolean;
  defaultNoiseRadius: number;
  randomizeGeneratedLocationByDefault: boolean;
  generatedLocationRandomizationRadiusKm: number;
  showBadgeQueryCount: boolean;
  includeDateCallsInBadgeCount: boolean;
  attentionMotionEnabled: boolean;
};

export const DEFAULT_WATCH_DELAY: [number, number] = [60, 500];
export const DEFAULT_NOISE_RADIUS = 50;
export const MIN_DEFAULT_NOISE_RADIUS = 0;
export const MAX_DEFAULT_NOISE_RADIUS = 500;
export const DEFAULT_RANDOM_RADIUS_KM = 10;
export const MIN_RANDOM_RADIUS_KM = 1;
export const MAX_RANDOM_RADIUS_KM = 99;

export const DEFAULT_PREFERENCES: Preferences = {
  featureFlags: DEFAULT_FEATURE_FLAGS,
  debugMode: false,
  watchPositionDelay: DEFAULT_WATCH_DELAY,
  osmConsent: "unknown",
  // Browser surface protections are on by default; this is the contract the
  // whole settings stack must preserve.
  browserFingerprintSpoofingEnabled: true,
  sharedWorkerHandlingMode: "strict",
  sharedWorkerCompatibilityMode: false,
  onboardingCompleted: false,
  themeMode: DEFAULT_THEME_MODE,
  themeAccentPreset: DEFAULT_ACCENT_PRESET,
  reduceMotion: false,
  highContrastMode: false,
  highContrastExplicit: false,
  defaultNoiseRadius: DEFAULT_NOISE_RADIUS,
  randomizeGeneratedLocationByDefault: true,
  generatedLocationRandomizationRadiusKm: DEFAULT_RANDOM_RADIUS_KM,
  showBadgeQueryCount: true,
  includeDateCallsInBadgeCount: false,
  attentionMotionEnabled: false,
};

export const isOsmConsentState = (value: unknown): value is OsmConsentState =>
  value === "granted" || value === "denied" || value === "unknown";

const isWatchPositionDelay = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === "number" &&
  Number.isFinite(value[0]) &&
  typeof value[1] === "number" &&
  Number.isFinite(value[1]);

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

/**
 * Fills a partial/unknown preferences value with canonical defaults, validating
 * each field. The result is always a complete, well-typed {@link Preferences}.
 */
// Field-by-field validation lets malformed persisted settings fall back independently.
export const normalizePreferences = (raw: unknown): Preferences => {
  const source = asRecord(raw);

  return {
    featureFlags: normalizeFeatureFlags(source.featureFlags),
    debugMode:
      typeof source.debugMode === "boolean"
        ? source.debugMode
        : DEFAULT_PREFERENCES.debugMode,
    watchPositionDelay: isWatchPositionDelay(source.watchPositionDelay)
      ? source.watchPositionDelay
      : DEFAULT_PREFERENCES.watchPositionDelay,
    osmConsent: isOsmConsentState(source.osmConsent)
      ? source.osmConsent
      : DEFAULT_PREFERENCES.osmConsent,
    // Enabled unless explicitly stored as false (preserves a deliberate opt-out
    // while defaulting missing/invalid values to on).
    browserFingerprintSpoofingEnabled:
      source.browserFingerprintSpoofingEnabled !== false,
    sharedWorkerHandlingMode: normalizeWorkerMode(
      source.sharedWorkerHandlingMode,
      source.sharedWorkerCompatibilityMode,
    ),
    sharedWorkerCompatibilityMode:
      normalizeWorkerMode(
        source.sharedWorkerHandlingMode,
        source.sharedWorkerCompatibilityMode,
      ) === "native",
    onboardingCompleted:
      typeof source.onboardingCompleted === "boolean"
        ? source.onboardingCompleted
        : DEFAULT_PREFERENCES.onboardingCompleted,
    themeMode: isThemeMode(source.themeMode)
      ? source.themeMode
      : DEFAULT_PREFERENCES.themeMode,
    themeAccentPreset: isThemeAccentPreset(source.themeAccentPreset)
      ? source.themeAccentPreset
      : DEFAULT_PREFERENCES.themeAccentPreset,
    reduceMotion:
      typeof source.reduceMotion === "boolean"
        ? source.reduceMotion
        : DEFAULT_PREFERENCES.reduceMotion,
    highContrastMode:
      typeof source.highContrastMode === "boolean"
        ? source.highContrastMode
        : DEFAULT_PREFERENCES.highContrastMode,
    highContrastExplicit:
      typeof source.highContrastExplicit === "boolean"
        ? source.highContrastExplicit
        : DEFAULT_PREFERENCES.highContrastExplicit,
    defaultNoiseRadius:
      typeof source.defaultNoiseRadius === "number" &&
      Number.isFinite(source.defaultNoiseRadius) &&
      source.defaultNoiseRadius >= MIN_DEFAULT_NOISE_RADIUS &&
      source.defaultNoiseRadius <= MAX_DEFAULT_NOISE_RADIUS
        ? source.defaultNoiseRadius
        : DEFAULT_PREFERENCES.defaultNoiseRadius,
    randomizeGeneratedLocationByDefault:
      source.randomizeGeneratedLocationByDefault !== false,
    generatedLocationRandomizationRadiusKm:
      typeof source.generatedLocationRandomizationRadiusKm === "number" &&
      Number.isInteger(source.generatedLocationRandomizationRadiusKm) &&
      source.generatedLocationRandomizationRadiusKm >= MIN_RANDOM_RADIUS_KM &&
      source.generatedLocationRandomizationRadiusKm <= MAX_RANDOM_RADIUS_KM
        ? source.generatedLocationRandomizationRadiusKm
        : DEFAULT_PREFERENCES.generatedLocationRandomizationRadiusKm,
    // Enabled unless explicitly stored as false.
    showBadgeQueryCount: source.showBadgeQueryCount !== false,
    includeDateCallsInBadgeCount:
      typeof source.includeDateCallsInBadgeCount === "boolean"
        ? source.includeDateCallsInBadgeCount
        : DEFAULT_PREFERENCES.includeDateCallsInBadgeCount,
    attentionMotionEnabled:
      typeof source.attentionMotionEnabled === "boolean"
        ? source.attentionMotionEnabled
        : DEFAULT_PREFERENCES.attentionMotionEnabled,
  };
};
