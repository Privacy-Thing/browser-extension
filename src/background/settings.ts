import { z } from "zod";

import {
  readLegacyBehavior,
  type LegacyBehaviorData,
} from "@/background/storage/legacy-behavior-data";
import { normalizeFeatureFlags, type FeatureFlags } from "@/shared/feature-flags";
import { SHARED_WORKER_MODES } from "@/shared/fingerprint-types";
import { normalizeLocationLocales } from "@/shared/locale-catalog";
import {
  containerListSchema,
  domainRulesSchema,
  globalFallbackRuleSchema,
  sharedSpoofingSchema,
  trustedSitesSchema,
  locationProfilesSchema,
} from "@/shared/profile-schema";
import { withAuthKey, withContainerSeed, withRuleSeedKey } from "@/shared/rule-seed";
import { normalizePreferences } from "@/shared/settings-defaults";
import { MAX_RANDOM_RADIUS_KM, MIN_RANDOM_RADIUS_KM } from "@/shared/settings-defaults";
import { DEFAULT_THEME_MODE } from "@/shared/theme-types";
import { DEFAULT_ACCENT_PRESET, THEME_ACCENT_PRESETS } from "@/shared/types";
import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
  SharedSpoofingConfig,
  SharedWorkerHandlingMode,
  ExportedSettings,
  Location,
  OsmConsentState,
  TrustedSite,
  ThemeAccentPreset,
  ThemeMode,
} from "@/shared/types";

const THEME_MODE_VALUES = ["light", "dark", "system"] as const;
const OSM_CONSENT_VALUES = ["unknown", "granted", "denied"] as const;

const normalizeLegacySpoofing = <
  T extends {
    sharedSpoofing?: SharedSpoofingConfig | undefined;
    experimentalActiveSpoofing?: SharedSpoofingConfig | undefined;
  },
>({
  experimentalActiveSpoofing: legacySpoofing,
  sharedSpoofing,
  ...rest
}: T): Omit<T, "sharedSpoofing" | "experimentalActiveSpoofing"> & {
  sharedSpoofing?: SharedSpoofingConfig | undefined;
} => {
  const normalizedSharedSpoofing = sharedSpoofing ?? legacySpoofing;
  return normalizedSharedSpoofing === undefined
    ? rest
    : { ...rest, sharedSpoofing: normalizedSharedSpoofing };
};

const settingsCommandSchema = z
  .object({
    themeMode: z.enum(THEME_MODE_VALUES).optional(),
    themeAccentPreset: z.enum(THEME_ACCENT_PRESETS).optional(),
    reduceMotion: z.boolean().optional(),
    debugMode: z.boolean().optional(),
    watchPositionDelay: z
      .tuple([z.number().finite().nonnegative(), z.number().finite().nonnegative()])
      .refine(([min, max]) => min <= max, {
        message: "watchPositionDelay must be ordered as [min, max].",
      })
      .optional(),
    osmConsent: z.enum(OSM_CONSENT_VALUES).optional(),
    browserFingerprintSpoofingEnabled: z.boolean().optional(),
    featureFlags: z
      .object({
        temporalApi: z.boolean().optional(),
      })
      .optional(),
    sharedWorkerHandlingMode: z.enum(SHARED_WORKER_MODES).optional(),
    sharedWorkerCompatibilityMode: z.boolean().optional(),
    sharedSpoofing: sharedSpoofingSchema.optional(),
    globalFallbackRule: globalFallbackRuleSchema.optional(),
    trustedSites: trustedSitesSchema.optional(),
    experimentalActiveSpoofing: sharedSpoofingSchema.optional(),
    highContrastMode: z.boolean().optional(),
    highContrastExplicit: z.boolean().optional(),
    defaultNoiseRadius: z.number().finite().min(0).max(500).optional(),
    randomizeGeneratedLocationByDefault: z.boolean().optional(),
    generatedLocationRandomizationRadiusKm: z
      .number()
      .int()
      .min(MIN_RANDOM_RADIUS_KM)
      .max(MAX_RANDOM_RADIUS_KM)
      .optional(),
    onboardingCompleted: z.boolean().optional(),
    showBadgeQueryCount: z.boolean().optional(),
    includeDateCallsInBadgeCount: z.boolean().optional(),
  })
  .transform(normalizeLegacySpoofing);

export type ValidatedSettingsCommand = z.infer<typeof settingsCommandSchema>;

const sanitizeThemeMode = (themeMode: ThemeMode | undefined): ThemeMode =>
  themeMode === "light" || themeMode === "dark" || themeMode === "system"
    ? themeMode
    : DEFAULT_THEME_MODE;

const sanitizeAccent = (
  themeAccentPreset: ThemeAccentPreset | undefined,
): ThemeAccentPreset =>
  THEME_ACCENT_PRESETS.includes(themeAccentPreset ?? DEFAULT_ACCENT_PRESET)
    ? (themeAccentPreset ?? DEFAULT_ACCENT_PRESET)
    : DEFAULT_ACCENT_PRESET;

const sanitizeLocations = (locations: readonly Location[]): Location[] =>
  locationProfilesSchema.parse(locations).map((location) => {
    return normalizeLocationLocales({
      id: location.id,
      label: location.label,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      language: location.language,
      languages: location.languages,
      noiseRadius: location.noiseRadius ?? 50,
      timeZone: location.timeZone.trim(),
      preferEnglishContent: location.preferEnglishContent,
    });
  });

const assertUniqueLocationIds = (locations: readonly Location[]): void => {
  const duplicateLocationIds = locations
    .map((location) => location.id)
    .filter((locationId, index, all) => all.indexOf(locationId) !== index);

  if (duplicateLocationIds.length > 0) {
    throw new Error(
      `Duplicate location ids: ${[...new Set(duplicateLocationIds)].join(", ")}`,
    );
  }
};

const assertRuleLocations = (
  rules: readonly DomainRule[],
  knownLocationIds: ReadonlySet<string>,
): void => {
  for (const rule of rules) {
    if (!rule.locationId) {
      continue;
    }

    if (!knownLocationIds.has(rule.locationId)) {
      throw new Error(`Unknown locationId referenced by rule: ${rule.locationId}`);
    }
  }
};

const assertValidAssignments = (
  assignments: readonly ContainerAssignment[],
  knownLocationIds: ReadonlySet<string>,
): void => {
  const assignedCookieStoreIds = new Set<string>();

  for (const assignment of assignments) {
    if (assignment.locationId && !knownLocationIds.has(assignment.locationId)) {
      throw new Error(
        `Unknown locationId referenced by container assignment: ${assignment.locationId}`,
      );
    }

    if (assignedCookieStoreIds.has(assignment.cookieStoreId)) {
      throw new Error(
        `Duplicate container assignment for cookieStoreId: ${assignment.cookieStoreId}`,
      );
    }

    assignedCookieStoreIds.add(assignment.cookieStoreId);
  }
};

const sanitizeAssignments = (
  assignments: readonly ContainerAssignment[] | undefined,
): ContainerAssignment[] => {
  if (!assignments || !Array.isArray(assignments)) {
    return [];
  }

  return containerListSchema
    .parse(assignments)
    .map((assignment) => withContainerSeed(assignment));
};

const sanitizeRules = (rules: readonly DomainRule[]): DomainRule[] =>
  domainRulesSchema
    .parse(rules as Array<DomainRule & { profileId?: string }>)
    .map((rule) =>
      withAuthKey(
        withRuleSeedKey({
          pattern: rule.pattern.trim().toLowerCase(),
          ...(rule.locationId?.trim() ? { locationId: rule.locationId.trim() } : {}),
          enabled: rule.enabled,
          ruleSeedKey: rule.ruleSeedKey,
          ...(rule.authKey ? { authKey: rule.authKey } : {}),
          relaxCspForWorkers: rule.relaxCspForWorkers ?? false,
          ...(rule.fingerprintSurfaceOverrides
            ? { fingerprintSurfaceOverrides: rule.fingerprintSurfaceOverrides }
            : {}),
        }),
      ),
    )
    .filter(
      (rule, index, all) =>
        all.findIndex((candidate) => candidate.pattern === rule.pattern) === index,
    );

const sanitizeTrustedSites = (
  trustedSites: readonly TrustedSite[] | undefined,
): TrustedSite[] => {
  if (!trustedSites || !Array.isArray(trustedSites)) {
    return [];
  }

  return trustedSitesSchema
    .parse(trustedSites)
    .filter(
      (site, index, all) =>
        all.findIndex((candidate) => candidate.pattern === site.pattern) === index,
    );
};

export const validateSettings = (
  locations: readonly Location[],
  rules: readonly DomainRule[],
  containerAssignments: readonly ContainerAssignment[] = [],
): {
  locations: Location[];
  rules: DomainRule[];
  containerAssignments: ContainerAssignment[];
} => {
  const nextLocations = sanitizeLocations(locations);
  const nextRules = sanitizeRules(rules);
  const nextAssignments = sanitizeAssignments(containerAssignments);
  const knownLocationIds = new Set(nextLocations.map((location) => location.id));
  assertUniqueLocationIds(nextLocations);
  assertRuleLocations(nextRules, knownLocationIds);
  assertValidAssignments(nextAssignments, knownLocationIds);

  return {
    locations: nextLocations,
    rules: nextRules,
    containerAssignments: nextAssignments,
  };
};

export const validateImportedSettings = (
  settings: ExportedSettings,
): {
  locations: Location[];
  rules: DomainRule[];
  trustedSites: TrustedSite[];
  globalFallbackRule?: GlobalFallbackRule | undefined;
  themeMode: ThemeMode;
  themeAccentPreset: ThemeAccentPreset;
  reduceMotion: boolean;
  legacyBehavior: LegacyBehaviorData;
  containerAssignments?: ContainerAssignment[];
  debugMode: boolean;
  watchPositionDelay: [number, number];
  osmConsent: OsmConsentState;
  browserFingerprintSpoofingEnabled: boolean;
  featureFlags: FeatureFlags;
  sharedWorkerHandlingMode: SharedWorkerHandlingMode;
  sharedWorkerCompatibilityMode: boolean;
  sharedSpoofing?: SharedSpoofingConfig | undefined;
  highContrastMode: boolean;
  highContrastExplicit: boolean;
  defaultNoiseRadius: number;
  randomizeGeneratedLocationByDefault: boolean;
  generatedLocationRandomizationRadiusKm: number;
  onboardingCompleted: boolean;
  showBadgeQueryCount: boolean;
  includeDateCallsInBadgeCount: boolean;
} => {
  if (settings.version !== 1 && settings.version !== 2 && settings.version !== 3) {
    throw new Error(`Unsupported settings export version: ${settings.version}`);
  }

  if (!settings.exportedAt || Number.isNaN(Date.parse(settings.exportedAt))) {
    throw new Error("Invalid exportedAt timestamp.");
  }

  const validated = validateSettings(
    settings.locations,
    settings.rules,
    settings.containerAssignments ?? [],
  );
  const legacyBehavior = readLegacyBehavior(settings);

  const normalizedSettings = normalizeLegacySpoofing(settings);
  const sharedSpoofing = normalizedSettings.sharedSpoofing
    ? sharedSpoofingSchema.parse(normalizedSettings.sharedSpoofing)
    : undefined;
  const trustedSites = sanitizeTrustedSites(normalizedSettings.trustedSites);
  const knownLocationIds = new Set(validated.locations.map((location) => location.id));
  const parsedFallbackRule = normalizedSettings.globalFallbackRule
    ? globalFallbackRuleSchema.parse(normalizedSettings.globalFallbackRule)
    : undefined;
  const globalFallbackRule = parsedFallbackRule
    ? withAuthKey(parsedFallbackRule)
    : undefined;

  if (
    globalFallbackRule?.locationId &&
    !knownLocationIds.has(globalFallbackRule.locationId)
  ) {
    throw new Error(
      `Unknown locationId referenced by global fallback rule: ${globalFallbackRule.locationId}`,
    );
  }

  // Scalar preference defaults come from the single canon, not inline literals.
  const preferences = normalizePreferences(settings);

  return {
    ...validated,
    trustedSites,
    themeMode: sanitizeThemeMode(settings.themeMode),
    themeAccentPreset: sanitizeAccent(settings.themeAccentPreset),
    reduceMotion: preferences.reduceMotion,
    debugMode: preferences.debugMode,
    watchPositionDelay: preferences.watchPositionDelay,
    osmConsent: preferences.osmConsent,
    legacyBehavior,
    browserFingerprintSpoofingEnabled: preferences.browserFingerprintSpoofingEnabled,
    featureFlags: normalizeFeatureFlags(settings.featureFlags),
    sharedWorkerHandlingMode: preferences.sharedWorkerHandlingMode,
    sharedWorkerCompatibilityMode: preferences.sharedWorkerCompatibilityMode,
    ...(sharedSpoofing ? { sharedSpoofing } : {}),
    ...(globalFallbackRule ? { globalFallbackRule } : {}),
    highContrastMode: preferences.highContrastMode,
    highContrastExplicit: preferences.highContrastExplicit,
    defaultNoiseRadius: preferences.defaultNoiseRadius,
    randomizeGeneratedLocationByDefault:
      preferences.randomizeGeneratedLocationByDefault,
    generatedLocationRandomizationRadiusKm:
      preferences.generatedLocationRandomizationRadiusKm,
    onboardingCompleted: preferences.onboardingCompleted,
    showBadgeQueryCount: preferences.showBadgeQueryCount,
    includeDateCallsInBadgeCount: preferences.includeDateCallsInBadgeCount,
  };
};

export const validateSettingsCommand = (command: unknown): ValidatedSettingsCommand =>
  settingsCommandSchema.parse(command);
