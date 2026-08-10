import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import type { Location } from "@/shared/types";

export const LEGACY_BEHAVIOR_KEY = "behavioralProfiles";
const LEGACY_REF_KEY = "behaviorProfileId";
const LEGACY_FLAG_KEY = "behavioralProfiles";
const LEGACY_FLAT_FLAG_KEY = "behavioralProfilesEnabled";
const LOCATIONS_KEY = EXTENSION_STORAGE_KEYS.locations;
const PREFERENCES_KEY = EXTENSION_STORAGE_KEYS.preferences;

type LegacyRef = {
  id: string;
  profileId: string;
};

export type LegacyBehaviorData = {
  profiles?: unknown[];
  enabled?: boolean;
  refs?: LegacyRef[];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const readFlag = (value: unknown): boolean | undefined => {
  const source = asRecord(value);
  if (!source) {
    return undefined;
  }

  const flags = asRecord(source.featureFlags);
  if (typeof flags?.[LEGACY_FLAG_KEY] === "boolean") {
    return flags[LEGACY_FLAG_KEY];
  }

  return typeof source[LEGACY_FLAT_FLAG_KEY] === "boolean"
    ? source[LEGACY_FLAT_FLAG_KEY]
    : undefined;
};

const readRefs = (locations: unknown): LegacyRef[] | undefined => {
  if (!Array.isArray(locations)) {
    return undefined;
  }

  const refs = locations.flatMap((value): LegacyRef[] => {
    const location = asRecord(value);
    return typeof location?.id === "string" &&
      typeof location[LEGACY_REF_KEY] === "string"
      ? [{ id: location.id, profileId: location[LEGACY_REF_KEY] }]
      : [];
  });

  return refs.length > 0 ? refs : undefined;
};

export const readLegacyBehavior = (value: unknown): LegacyBehaviorData => {
  const source = asRecord(value);
  if (!source) {
    return {};
  }
  const enabled = readFlag(source);
  const refs = readRefs(source.locations);

  return {
    ...(Array.isArray(source[LEGACY_BEHAVIOR_KEY])
      ? { profiles: source[LEGACY_BEHAVIOR_KEY] }
      : {}),
    ...(enabled !== undefined ? { enabled } : {}),
    ...(refs ? { refs } : {}),
  };
};

export const keepLegacyPrefs = (
  stored: unknown,
  preferences: Record<string, unknown>,
): Record<string, unknown> => {
  const source = asRecord(stored);
  if (!source) {
    return preferences;
  }

  return {
    ...preferences,
    ...(Object.hasOwn(source, "featureFlags")
      ? { featureFlags: source.featureFlags }
      : {}),
    ...(Object.hasOwn(source, LEGACY_FLAT_FLAG_KEY)
      ? { [LEGACY_FLAT_FLAG_KEY]: source[LEGACY_FLAT_FLAG_KEY] }
      : {}),
  };
};

export const mergeLegacyRefs = (
  locations: readonly Location[],
  stored: unknown,
): Array<Location | (Location & Record<string, unknown>)> => {
  const refs = new Map(
    (readRefs(stored) ?? []).map(({ id, profileId }) => [id, profileId]),
  );

  return locations.map((location) => {
    const profileId = refs.get(location.id);
    return profileId ? { ...location, [LEGACY_REF_KEY]: profileId } : location;
  });
};

export const stripLegacyRefs = (locations: unknown): unknown[] =>
  Array.isArray(locations)
    ? locations.map((value) => {
        const location = asRecord(value);
        if (!location || !Object.hasOwn(location, LEGACY_REF_KEY)) {
          return value;
        }
        const next = { ...location };
        delete next[LEGACY_REF_KEY];
        return next;
      })
    : [];

export const saveLegacyBehavior = async (data: LegacyBehaviorData): Promise<void> => {
  if (data.profiles) {
    await chrome.storage.local.set({ [LEGACY_BEHAVIOR_KEY]: data.profiles });
  }

  if (data.enabled !== undefined) {
    const stored = await chrome.storage.local.get(PREFERENCES_KEY);
    const preferences = asRecord(stored[PREFERENCES_KEY]) ?? {};
    const flags = asRecord(preferences.featureFlags) ?? {};
    await chrome.storage.local.set({
      [PREFERENCES_KEY]: {
        ...preferences,
        featureFlags: { ...flags, [LEGACY_FLAG_KEY]: data.enabled },
      },
    });
  }

  if (data.refs) {
    const stored = await chrome.storage.local.get(LOCATIONS_KEY);
    const locations = stored[LOCATIONS_KEY];
    if (Array.isArray(locations)) {
      const refs = new Map(data.refs.map(({ id, profileId }) => [id, profileId]));
      await chrome.storage.local.set({
        [LOCATIONS_KEY]: locations.map((value) => {
          const location = asRecord(value);
          const id = typeof location?.id === "string" ? location.id : null;
          const profileId = id ? refs.get(id) : undefined;
          return location && profileId
            ? { ...location, [LEGACY_REF_KEY]: profileId }
            : value;
        }),
      });
    }
  }
};

export const clearLegacyBehavior = async (): Promise<void> => {
  const stored = await chrome.storage.local.get([LOCATIONS_KEY, PREFERENCES_KEY]);
  const preferences = asRecord(stored[PREFERENCES_KEY]);
  const cleanPreferences = preferences ? { ...preferences } : null;
  if (cleanPreferences) {
    delete cleanPreferences.featureFlags;
    delete cleanPreferences[LEGACY_FLAT_FLAG_KEY];
  }

  const locations = stored[LOCATIONS_KEY];
  const cleanLocations = Array.isArray(locations) ? stripLegacyRefs(locations) : null;

  await chrome.storage.local.remove(LEGACY_BEHAVIOR_KEY);
  await chrome.storage.local.set({
    ...(cleanPreferences ? { [PREFERENCES_KEY]: cleanPreferences } : {}),
    ...(cleanLocations ? { [LOCATIONS_KEY]: cleanLocations } : {}),
  });
};
