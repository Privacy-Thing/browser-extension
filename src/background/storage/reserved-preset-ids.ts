import { CONTAINERS_STORAGE_KEY } from "@/background/storage/container-assignments";
import { LOCATIONS_STORAGE_KEY } from "@/background/storage/locations";
import { FALLBACK_STORAGE_KEY } from "@/background/storage/preferences";
import { RULES_STORAGE_KEY } from "@/background/storage/rules";
import { createUniqueLocationId } from "@/shared/location-id";
import { isReservedKey } from "@/shared/reserved-keys";

const STORAGE_KEYS = [
  LOCATIONS_STORAGE_KEY,
  RULES_STORAGE_KEY,
  CONTAINERS_STORAGE_KEY,
  FALLBACK_STORAGE_KEY,
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const relink = (item: unknown, renamed: ReadonlyMap<string, string>): unknown => {
  if (!isObject(item) || typeof item.locationId !== "string") return item;
  const locationId = renamed.get(item.locationId);
  return locationId ? { ...item, locationId } : item;
};

const relinkAll = (
  items: unknown,
  renamed: ReadonlyMap<string, string>,
): unknown[] | null => {
  if (!Array.isArray(items)) return null;
  const next = items.map((item: unknown) => relink(item, renamed));
  return next.some((item, index) => item !== items[index]) ? next : null;
};

/**
 * Presets saved before reserved names were refused (a preset labelled
 * "Constructor") get a fresh slug ID and every reference follows, so the export
 * stays importable. Other fields, including rule seeds and auth keys, stay
 * verbatim. Returns only the storage entries that change.
 */
export const renameReservedPresetIds = (
  stored: Record<string, unknown>,
): Record<string, unknown> => {
  const locations = stored[LOCATIONS_STORAGE_KEY];
  if (!Array.isArray(locations)) return {};
  const ids = locations.flatMap((location: unknown) =>
    isObject(location) && typeof location.id === "string" ? [location.id] : [],
  );
  const renamed = new Map<string, string>();
  const taken = [...ids];
  for (const id of ids) {
    if (!isReservedKey(id) || renamed.has(id)) continue;
    const next = createUniqueLocationId(id, taken, "profile");
    renamed.set(id, next);
    taken.push(next);
  }
  if (renamed.size === 0) return {};

  const changes: Record<string, unknown> = {
    [LOCATIONS_STORAGE_KEY]: locations.map((location: unknown) => {
      if (!isObject(location) || typeof location.id !== "string") return location;
      const id = renamed.get(location.id);
      return id ? { ...location, id } : location;
    }),
  };
  for (const key of [RULES_STORAGE_KEY, CONTAINERS_STORAGE_KEY]) {
    const items = relinkAll(stored[key], renamed);
    if (items) changes[key] = items;
  }
  const fallback = relink(stored[FALLBACK_STORAGE_KEY], renamed);
  if (fallback !== stored[FALLBACK_STORAGE_KEY])
    changes[FALLBACK_STORAGE_KEY] = fallback;
  return changes;
};

export const migrateReservedPresetIds = async (): Promise<boolean> => {
  const changes = renameReservedPresetIds(await chrome.storage.local.get(STORAGE_KEYS));
  if (Object.keys(changes).length === 0) return false;
  await chrome.storage.local.set(changes);
  return true;
};
