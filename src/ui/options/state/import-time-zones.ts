import { isSupportedTimeZone } from "@/shared/time-zone-validation";
import type { ExportedSettings } from "@/shared/types";

/** A preset whose time zone the background rejected while previewing an import. */
export type ImportTimeZoneCorrection = {
  id: string;
  label: string;
  /** Value from the file, shown so the user knows what is being replaced. */
  rejectedTimeZone: string;
  /** Supported zone chosen for the next preview, or `null` while still missing. */
  timeZone: string | null;
};

const readPresets = (source: ExportedSettings | null): unknown[] =>
  source && Array.isArray(source.locations) ? source.locations : [];

const readField = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null && Object.hasOwn(value, key)
    ? (value as Record<string, unknown>)[key]
    : undefined;

/**
 * Presets the user can repair with a picker. The file is untrusted JSON, so only
 * entries with a usable ID are offered; anything else stays a plain file error.
 */
export const findUnsupportedTimeZones = (
  source: ExportedSettings | null,
): Array<Omit<ImportTimeZoneCorrection, "timeZone">> =>
  readPresets(source).flatMap((preset) => {
    const id = readField(preset, "id");
    const label = readField(preset, "label");
    const timeZone = readField(preset, "timeZone");
    if (typeof id !== "string" || id === "") return [];
    if (typeof timeZone === "string" && isSupportedTimeZone(timeZone)) return [];
    return [
      {
        id,
        label: typeof label === "string" && label !== "" ? label : id,
        rejectedTimeZone: typeof timeZone === "string" ? timeZone : "",
      },
    ];
  });

/** Keeps the first rejected value per preset across repeated rejections. */
export const mergeCorrections = (
  current: Array<Omit<ImportTimeZoneCorrection, "timeZone">>,
  next: Array<Omit<ImportTimeZoneCorrection, "timeZone">>,
): Array<Omit<ImportTimeZoneCorrection, "timeZone">> => {
  const known = new Set(current.map((item) => item.id));
  const added = next.filter((item) => !known.has(item.id) && known.add(item.id));
  return added.length === 0 ? current : [...current, ...added];
};

/** Current choice for each rejected preset, read from the latest requested source. */
export const describeCorrections = (
  rejected: Array<Omit<ImportTimeZoneCorrection, "timeZone">>,
  source: ExportedSettings | null,
): ImportTimeZoneCorrection[] =>
  rejected.map((item) => {
    const preset = readPresets(source).find(
      (entry) => readField(entry, "id") === item.id,
    );
    const timeZone = readField(preset, "timeZone");
    return {
      ...item,
      timeZone:
        typeof timeZone === "string" && isSupportedTimeZone(timeZone) ? timeZone : null,
    };
  });

/** Replaces one preset's zone without assuming the untrusted entries are objects. */
export const withPresetTimeZone = (
  source: ExportedSettings,
  id: string,
  timeZone: string,
): ExportedSettings => ({
  ...source,
  locations: readPresets(source).map((preset) =>
    readField(preset, "id") === id ? { ...(preset as object), timeZone } : preset,
  ) as ExportedSettings["locations"],
});
