import { keepLegacyPrefs } from "./legacy-behavior-data";

import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import {
  globalFallbackRuleSchema,
  sharedSpoofingSchema,
} from "@/shared/profile-schema";
import { isValidAuthKey } from "@/shared/rule-seed";
import { normalizePreferences, type Preferences } from "@/shared/settings-defaults";
import type {
  GlobalFallbackRule,
  SharedSpoofingConfig,
  SharedWorkerHandlingMode,
  OsmConsentState,
  ThemeAccentPreset,
  ThemeMode,
} from "@/shared/types";

export const PREFERENCES_STORAGE_KEY = EXTENSION_STORAGE_KEYS.preferences;

// ---------------------------------------------------------------------------
// Consolidated preferences object
//
// All scalar preferences live under a single `preferences` storage key.
// Defaults come exclusively from DEFAULT_PREFERENCES via
// normalizePreferences. Writes are serialized through a module-level queue so
// concurrent partial updates (e.g. saveSimpleSettings) never lose fields via a
// read-modify-write race within this worker.
// ---------------------------------------------------------------------------

export const getPreferences = async (): Promise<Preferences> => {
  const result = await chrome.storage.local.get(PREFERENCES_STORAGE_KEY);
  return normalizePreferences(result[PREFERENCES_STORAGE_KEY]);
};

let preferencesWriteQueue: Promise<void> = Promise.resolve();

export const savePreferences = (patch: Partial<Preferences>): Promise<void> => {
  const write = preferencesWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const stored = await chrome.storage.local.get(PREFERENCES_STORAGE_KEY);
      const current = normalizePreferences(stored[PREFERENCES_STORAGE_KEY]);
      const next = normalizePreferences({
        ...current,
        ...patch,
        featureFlags: {
          ...current.featureFlags,
          ...patch.featureFlags,
        },
      });
      await chrome.storage.local.set({
        [PREFERENCES_STORAGE_KEY]: keepLegacyPrefs(
          stored[PREFERENCES_STORAGE_KEY],
          next as unknown as Record<string, unknown>,
        ),
      });
    });
  preferencesWriteQueue = write;

  return write;
};

export const getThemeMode = async (): Promise<ThemeMode> =>
  (await getPreferences()).themeMode;

export const saveThemeMode = async (themeMode: ThemeMode): Promise<void> => {
  await savePreferences({ themeMode });
};

export const getThemeAccentPreset = async (): Promise<ThemeAccentPreset> =>
  (await getPreferences()).themeAccentPreset;

export const saveThemeAccentPreset = async (
  themeAccentPreset: ThemeAccentPreset,
): Promise<void> => {
  await savePreferences({ themeAccentPreset });
};

export const getHighContrastMode = async (): Promise<boolean> =>
  (await getPreferences()).highContrastMode;

export const saveHighContrastMode = async (
  highContrastMode: boolean,
): Promise<void> => {
  await savePreferences({ highContrastMode });
};

export const getDefaultNoiseRadius = async (): Promise<number> =>
  (await getPreferences()).defaultNoiseRadius;

export const saveDefaultNoiseRadius = async (
  defaultNoiseRadius: number,
): Promise<void> => {
  await savePreferences({ defaultNoiseRadius });
};

// Scalar accessors — thin wrappers over the consolidated object so
// existing call sites keep working while the object is the single source.

export const getDebugMode = async (): Promise<boolean> =>
  (await getPreferences()).debugMode;

export const saveDebugMode = async (debugMode: boolean): Promise<void> => {
  await savePreferences({ debugMode });
};

export const getWatchPositionDelay = async (): Promise<[number, number]> =>
  (await getPreferences()).watchPositionDelay;

export const saveWatchPositionDelay = async (
  delay: [number, number],
): Promise<void> => {
  await savePreferences({ watchPositionDelay: delay });
};

export const getOsmConsent = async (): Promise<OsmConsentState> =>
  (await getPreferences()).osmConsent;

export const saveOsmConsent = async (osmConsent: OsmConsentState): Promise<void> => {
  await savePreferences({ osmConsent });
};

export const getFingerprintEnabled = async (): Promise<boolean> =>
  (await getPreferences()).browserFingerprintSpoofingEnabled;

export const getWorkerCompatibility = async (): Promise<boolean> =>
  (await getPreferences()).sharedWorkerCompatibilityMode;

export const getWorkerMode = async (): Promise<SharedWorkerHandlingMode> =>
  (await getPreferences()).sharedWorkerHandlingMode;

export const saveFingerprintEnabled = async (enabled: boolean): Promise<void> => {
  await savePreferences({ browserFingerprintSpoofingEnabled: enabled });
};

export const getOnboardingCompleted = async (): Promise<boolean> =>
  (await getPreferences()).onboardingCompleted;

export const saveOnboardingCompleted = async (
  onboardingCompleted: boolean,
): Promise<void> => {
  await savePreferences({ onboardingCompleted });
};

export const SPOOFING_STORAGE_KEY = "sharedSpoofing";
export const LEGACY_SPOOFING_KEY = "experimentalActiveSpoofing";
export const FALLBACK_STORAGE_KEY = "globalFallbackRule";

export const getSharedSpoofing = async (): Promise<
  SharedSpoofingConfig | undefined
> => {
  const result = await chrome.storage.local.get(SPOOFING_STORAGE_KEY);
  const parsed = sharedSpoofingSchema.safeParse(result[SPOOFING_STORAGE_KEY]);

  return parsed.success ? parsed.data : undefined;
};

export const saveSharedSpoofing = async (
  value: SharedSpoofingConfig | undefined,
): Promise<void> => {
  if (value === undefined) {
    await chrome.storage.local.remove(SPOOFING_STORAGE_KEY);
  } else {
    await chrome.storage.local.set({ [SPOOFING_STORAGE_KEY]: value });
  }
};

/**
 * Loads the global fallback ("Default") rule and persists its authKey nonce once
 * for legacy rules that predate authKeys.
 *
 * The schema mints a fresh random authKey on read when one is absent; this
 * write-back pins that value so the nonce stays stable for the rule's lifetime
 * and every independent consumer (runtime cache, XRay cache) reads the same
 * key. The write is **guarded on a genuinely missing/invalid stored authKey** so
 * it fires exactly once for legacy data and does not race a normal save — do not
 * widen it to an unconditional write-back (the earlier deep-equal version did,
 * and could clobber an in-flight save).
 *
 * @see createAuthKey (in `@/shared/rule-seed`) for the full authKey contract.
 */
export const getGlobalFallbackRule = async (): Promise<
  GlobalFallbackRule | undefined
> => {
  const result = await chrome.storage.local.get(FALLBACK_STORAGE_KEY);
  const storedValue = result[FALLBACK_STORAGE_KEY];
  const parsed = globalFallbackRuleSchema.safeParse(storedValue);

  if (!parsed.success) {
    return undefined;
  }

  const storedAuthKey = (storedValue as { authKey?: unknown } | null | undefined)
    ?.authKey;
  if (!isValidAuthKey(typeof storedAuthKey === "string" ? storedAuthKey : undefined)) {
    await chrome.storage.local.set({
      [FALLBACK_STORAGE_KEY]: parsed.data,
    });
  }

  return parsed.data;
};

export const saveGlobalFallbackRule = async (
  value: GlobalFallbackRule | undefined,
): Promise<void> => {
  if (value === undefined) {
    await chrome.storage.local.remove(FALLBACK_STORAGE_KEY);
    return;
  }

  await chrome.storage.local.set({
    [FALLBACK_STORAGE_KEY]: globalFallbackRuleSchema.parse(value),
  });
};
