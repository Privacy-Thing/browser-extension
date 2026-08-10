/**
 * Zod schemas for persisted extension data plus normalization helpers that turn
 * partially specified payloads into fully usable runtime structures.
 */

import { z } from "zod";

import { SHARED_WORKER_MODES } from "@/shared/fingerprint-types";
import { normalizeRuleSeedKey, withFallbackSeed } from "@/shared/rule-seed";

const workerModeSchema = z.enum(SHARED_WORKER_MODES);

export const surfaceOverridesSchema = z
  .object({
    canvas: z.boolean().optional(),
    webGL: z.boolean().optional(),
    audio: z.boolean().optional(),
    navigator: z.boolean().optional(),
    screen: z.boolean().optional(),
    clientHints: z.boolean().optional(),
    battery: z.boolean().optional(),
    webRTC: z.boolean().optional(),
    geolocation: z.boolean().optional(),
    timeLocale: z.boolean().optional(),
    serviceWorker: z.boolean().optional(),
    sharedWorker: workerModeSchema.optional(),
  })
  .strict();

export const sharedSpoofingSchema = z
  .object({
    enabled: z.boolean().optional(),
    canvas: z.boolean().optional(),
    webGL: z.boolean().optional(),
    audio: z.boolean().optional(),
    navigator: z.boolean().optional(),
    screen: z.boolean().optional(),
    clientHints: z.boolean().optional(),
    battery: z.boolean().optional(),
    clientHintsVersionRotation: z.boolean().optional(),
    webRTC: z.boolean().optional(),
    geolocation: z.boolean().optional(),
    timeLocale: z.boolean().optional(),
    serviceWorker: z.boolean().optional(),
    sharedWorker: workerModeSchema.optional(),
  })
  .strict()
  .transform(({ enabled: _enabled, ...rest }) => rest);

const normalizeLegacyGeo = (
  surfaceOverrides: z.infer<typeof surfaceOverridesSchema> | undefined,
  geolocationEnabled: boolean | undefined,
): z.infer<typeof surfaceOverridesSchema> | undefined => {
  const normalizedOverrides = {
    ...(surfaceOverrides ?? {}),
    ...(geolocationEnabled === false && surfaceOverrides?.geolocation === undefined
      ? { geolocation: false }
      : {}),
  };

  return Object.keys(normalizedOverrides).length > 0 ? normalizedOverrides : undefined;
};

/**
 * Folds the legacy per-rule `blockServiceWorkerRegistration` boolean into the
 * `serviceWorker` surface override. `true` becomes a force-block override; a
 * legacy `false`/absent value maps to inherit (no override) so the rule follows
 * the global default — preserving behavior while the global default is OFF.
 */
const normalizeLegacyWorker = (
  surfaceOverrides: z.infer<typeof surfaceOverridesSchema> | undefined,
  blockServiceWorkers: boolean | undefined,
): z.infer<typeof surfaceOverridesSchema> | undefined => {
  const normalizedOverrides = {
    ...(surfaceOverrides ?? {}),
    ...(blockServiceWorkers === true && surfaceOverrides?.serviceWorker === undefined
      ? { serviceWorker: true }
      : {}),
  };

  return Object.keys(normalizedOverrides).length > 0 ? normalizedOverrides : undefined;
};

/**
 * Schema for a saved location profile selected by domain rules or container
 * assignments.
 */
export const locationProfileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive(),
  noiseRadius: z.number().nonnegative().optional().default(50),
  language: z.string().min(2),
  languages: z.array(z.string().min(2)).min(1),
  preferEnglishContent: z.boolean().optional().default(false),
  timeZone: z.string().min(1),
});

/**
 * Schema for persisted domain rules. Legacy `profileId` input is normalized to
 * `locationId` so storage reads can remain backward compatible.
 */
export const domainRuleSchema = z
  .object({
    pattern: z.string().min(1),
    locationId: z.string().min(1).optional(),
    profileId: z.string().min(1).optional(),
    enabled: z.boolean().optional().default(true),
    geolocationEnabled: z.boolean().optional().default(true),
    ruleSeedKey: z.string().optional(),
    authKey: z.string().optional(),
    blockServiceWorkerRegistration: z.boolean().optional().default(false),
    relaxCspForWorkers: z.boolean().optional().default(false),
    fingerprintSurfaceOverrides: surfaceOverridesSchema.optional(),
  })
  .transform(
    ({
      pattern,
      locationId,
      profileId,
      enabled,
      geolocationEnabled,
      ruleSeedKey,
      authKey,
      blockServiceWorkerRegistration: blockServiceWorkers,
      relaxCspForWorkers,
      fingerprintSurfaceOverrides: surfaceOverrides,
    }) => {
      const normalizedOverrides = normalizeLegacyWorker(
        normalizeLegacyGeo(surfaceOverrides, geolocationEnabled),
        blockServiceWorkers,
      );

      return {
        pattern,
        ...((locationId ?? profileId) ? { locationId: locationId ?? profileId } : {}),
        enabled,
        ruleSeedKey: normalizeRuleSeedKey(ruleSeedKey),
        ...(authKey ? { authKey } : {}),
        relaxCspForWorkers,
        ...(normalizedOverrides
          ? { fingerprintSurfaceOverrides: normalizedOverrides }
          : {}),
      };
    },
  );

export const globalFallbackRuleSchema = z
  .object({
    enabled: z.boolean().optional().default(false),
    geolocationEnabled: z.boolean().optional().default(true),
    locationId: z.string().min(1).optional(),
    ruleSeedKey: z.string().optional(),
    authKey: z.string().optional(),
    fingerprintSurfaceOverrides: surfaceOverridesSchema.optional(),
  })
  .strict()
  .transform(
    ({
      enabled,
      geolocationEnabled,
      locationId,
      ruleSeedKey,
      authKey,
      fingerprintSurfaceOverrides: surfaceOverrides,
    }) => {
      const normalizedOverrides = normalizeLegacyGeo(
        surfaceOverrides,
        geolocationEnabled,
      );

      return withFallbackSeed({
        enabled,
        ...(locationId ? { locationId } : {}),
        ruleSeedKey: normalizeRuleSeedKey(ruleSeedKey),
        ...(authKey ? { authKey } : {}),
        ...(normalizedOverrides
          ? { fingerprintSurfaceOverrides: normalizedOverrides }
          : {}),
      });
    },
  );

export const containerSchema = z
  .object({
    cookieStoreId: z.string().trim().min(1),
    enabled: z.boolean().optional().default(true),
    geolocationEnabled: z.boolean().optional().default(true),
    locationId: z.string().trim().min(1).optional().nullable(),
    fingerprintSurfaceOverrides: surfaceOverridesSchema.optional(),
    ruleSeedKey: z.string().optional(),
    authKey: z.string().optional(),
  })
  .strict()
  .transform(
    ({
      cookieStoreId,
      enabled,
      geolocationEnabled,
      locationId,
      fingerprintSurfaceOverrides: surfaceOverrides,
      ruleSeedKey,
      authKey,
    }) => {
      const normalizedOverrides = normalizeLegacyGeo(
        surfaceOverrides,
        geolocationEnabled,
      );

      return {
        cookieStoreId,
        ...(enabled !== true ? { enabled } : {}),
        ...(locationId ? { locationId } : {}),
        ...(normalizedOverrides
          ? { fingerprintSurfaceOverrides: normalizedOverrides }
          : {}),
        ruleSeedKey: normalizeRuleSeedKey(ruleSeedKey),
        ...(authKey ? { authKey } : {}),
      };
    },
  );

export const trustedSiteSchema = z
  .object({
    pattern: z.string().min(1),
    enabled: z.boolean().optional().default(true),
  })
  .strict()
  .transform(({ pattern, enabled }) => ({
    pattern: pattern.trim().toLowerCase(),
    enabled,
  }));

/** Array schema for all saved locations persisted in extension settings. */
export const locationProfilesSchema = z.array(locationProfileSchema);
/** Array schema for all saved domain rules persisted in extension settings. */
export const domainRulesSchema = z.array(domainRuleSchema);
/** Array schema for all saved trusted-site patterns persisted in extension settings. */
export const trustedSitesSchema = z.array(trustedSiteSchema);
/** Array schema for all saved container assignments persisted in extension settings. */
export const containerListSchema = z.array(containerSchema);
