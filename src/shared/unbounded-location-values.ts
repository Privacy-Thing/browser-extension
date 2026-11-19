/**
 * JSON-safe form of the unbounded (`Infinity`) location values.
 *
 * Location `accuracy` and `noiseRadius` accept `+Infinity` for stored-data
 * compatibility, but JSON (and Chromium messaging) turns it into `null`. Settings
 * exports therefore write the string `"Infinity"` for those two fields only; the
 * import path turns it back. Persisted storage keeps its shape.
 */

import type { ExportedSettings } from "@/shared/shared-model-types";

export const UNBOUNDED_VALUE_TOKEN = "Infinity";

const UNBOUNDED_FIELDS = ["accuracy", "noiseRadius"] as const;
type UnboundedField = (typeof UNBOUNDED_FIELDS)[number];

type LocationRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is LocationRecord =>
  typeof value === "object" && value !== null;

const mapLocations = (
  settings: ExportedSettings,
  mapField: (location: LocationRecord, field: UnboundedField) => unknown,
): ExportedSettings => {
  if (!Array.isArray(settings.locations)) return settings;
  let changed = false;
  const locations = (settings.locations as unknown[]).map((entry) => {
    if (!isRecord(entry)) return entry;
    const next: LocationRecord = { ...entry };
    for (const field of UNBOUNDED_FIELDS) {
      if (!Object.hasOwn(entry, field)) continue;
      const mapped = mapField(entry, field);
      if (mapped !== entry[field]) {
        next[field] = mapped;
        changed = true;
      }
    }
    return next;
  });
  return changed
    ? { ...settings, locations: locations as ExportedSettings["locations"] }
    : settings;
};

/** Writes `Infinity` as `"Infinity"` so the value survives `JSON.stringify`. */
export const encodeUnbounded = (settings: ExportedSettings): ExportedSettings =>
  mapLocations(settings, (location, field) =>
    location[field] === Infinity ? UNBOUNDED_VALUE_TOKEN : location[field],
  );

const locationName = (location: LocationRecord): string => {
  const name = [location.label, location.id].find(
    (part): part is string => typeof part === "string" && part !== "",
  );
  return name ? `"${name}"` : "A location";
};

/**
 * Reads `"Infinity"` back as `Infinity`. A bare `null` can only come from an older
 * export that serialized `Infinity` as `null`; the original value is unknown, so it
 * is rejected with a readable message instead of guessing an unbounded value.
 *
 * `storageKeepsInfinity` is false where extension storage is JSON-backed (Chromium):
 * `Infinity` would be written as `null` and break loading the locations.
 */
export const decodeUnbounded = (
  settings: ExportedSettings,
  options: { storageKeepsInfinity: boolean },
): ExportedSettings =>
  mapLocations(settings, (location, field) => {
    const value = location[field];
    if (value === null) {
      throw new Error(
        `${locationName(location)}: ${field} is empty in this file. Older exports wrote an unbounded value as null. Set ${field} to a number and import again.`,
      );
    }
    if (value !== UNBOUNDED_VALUE_TOKEN && value !== Infinity) return value;
    if (!options.storageKeepsInfinity) {
      throw new Error(
        `${locationName(location)}: ${field} is unbounded ("${UNBOUNDED_VALUE_TOKEN}"), which this browser cannot store. Set ${field} to a number and import again.`,
      );
    }
    return Infinity;
  });
