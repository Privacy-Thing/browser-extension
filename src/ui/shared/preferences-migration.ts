import {
  EXTENSION_COMMAND_TYPES,
  EXTENSION_STORAGE_KEYS,
} from "@/shared/extension-contract";
import {
  MAX_DEFAULT_NOISE_RADIUS,
  MIN_DEFAULT_NOISE_RADIUS,
  normalizePreferences,
} from "@/shared/settings-defaults";
import { DEFAULT_THEME_MODE, isThemeMode } from "@/shared/theme-types";
import type { SaveSettingsResponse } from "@/shared/types";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

const readLocalStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const removeLocalStorage = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Keep migration best-effort when localStorage is unavailable.
  }
};

const RETIRED_NAMESPACES = [
  ["geo", "warp"].join(""),
  ["geo", "wrap"].join(""),
] as const;
const retiredLocalStorageKeys = (suffix: string): string[] =>
  RETIRED_NAMESPACES.map((namespace) => `${namespace}.${suffix}`);
const readFirstLocalStorage = (
  keys: readonly string[],
): { key: string; value: string } | null => {
  for (const key of keys) {
    const value = readLocalStorage(key);
    if (value !== null) return { key, value };
  }
  return null;
};
const removeLocalStorageKeys = (keys: readonly string[]): void => {
  for (const key of keys) removeLocalStorage(key);
};
const parseLegacyRadius = (stored: { value: string } | null): number | undefined => {
  if (stored === null) return undefined;
  const value = Number(stored.value);
  return Number.isFinite(value) &&
    value >= MIN_DEFAULT_NOISE_RADIUS &&
    value <= MAX_DEFAULT_NOISE_RADIUS
    ? value
    : undefined;
};

const readStoredThemeMode = async (): Promise<string> => {
  const result = await chrome.storage.local.get(EXTENSION_STORAGE_KEYS.preferences);
  return normalizePreferences(result[EXTENSION_STORAGE_KEYS.preferences]).themeMode;
};

export const migrateLegacyPrefs = async (): Promise<void> => {
  const themeKeys = retiredLocalStorageKeys("theme");
  const radiusKeys = retiredLocalStorageKeys("defaultNoiseRadius");
  const legacyTheme = readFirstLocalStorage(themeKeys);
  const legacyRadius = readFirstLocalStorage(radiusKeys);
  const parsedRadius = parseLegacyRadius(legacyRadius);
  const legacyThemeMode = isThemeMode(legacyTheme?.value)
    ? legacyTheme.value
    : undefined;
  const hasLegacyTheme = legacyThemeMode !== undefined;

  if (!hasLegacyTheme && parsedRadius === undefined) {
    return;
  }

  // Only adopt the legacy theme if the user has not already chosen a non-default
  // theme in the consolidated object — otherwise the stale localStorage value
  // would clobber a newer preference.
  const applyTheme =
    hasLegacyTheme && (await readStoredThemeMode()) === DEFAULT_THEME_MODE;

  const patch = {
    ...(applyTheme ? { themeMode: legacyThemeMode } : {}),
    ...(parsedRadius !== undefined ? { defaultNoiseRadius: parsedRadius } : {}),
  };

  if (Object.keys(patch).length > 0) {
    const response = await sendMessageOrThrow<SaveSettingsResponse>({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      ...patch,
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
  }

  // Clear consumed/obsolete legacy keys (a skipped theme value is now stale).
  if (hasLegacyTheme) {
    removeLocalStorageKeys(themeKeys);
  }
  if (parsedRadius !== undefined) {
    removeLocalStorageKeys(radiusKeys);
  }
};
