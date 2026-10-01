import { validateImportedSettings } from "@/background/settings";
import {
  isSettingsImportActive,
  needsImportRecovery,
  setImportProgress,
} from "@/background/settings-import-progress";
import { readLegacyBehavior } from "@/background/storage/legacy-behavior-data";
import { DEFAULT_LOCATIONS } from "@/background/storage/locations";
import { DEFAULT_RULES } from "@/background/storage/rules";
import { DEFAULT_TRUSTED_SITES } from "@/background/storage/trusted-sites";
import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { normalizePreferences } from "@/shared/settings-defaults";
import type { ExportedSettings } from "@/shared/types";

export const IMPORT_JOURNAL_KEY = EXTENSION_STORAGE_KEYS.settingsImportJournal;
export const CONFIG_REVISION_KEY = EXTENSION_STORAGE_KEYS.configurationRevision;
export const readConfigRevision = async (): Promise<string> => {
  const stored = await chrome.storage.local.get(CONFIG_REVISION_KEY);
  return typeof stored[CONFIG_REVISION_KEY] === "string"
    ? stored[CONFIG_REVISION_KEY]
    : "";
};
export const IMPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const IMPORT_CONFIG_KEYS = [
  EXTENSION_STORAGE_KEYS.locations,
  EXTENSION_STORAGE_KEYS.rules,
  EXTENSION_STORAGE_KEYS.trustedSites,
  EXTENSION_STORAGE_KEYS.containerAssignments,
  EXTENSION_STORAGE_KEYS.preferences,
  "sharedSpoofing",
  "globalFallbackRule",
  "behavioralProfiles",
] as const;
export type ConfigurationSnapshot = Record<string, unknown>;
export type ImportJournal = {
  version: 1;
  phase: "pending" | "committed";
  before: ConfigurationSnapshot;
  afterFingerprint: string;
  expiresAt: number;
};

export const readConfiguration = async (): Promise<ConfigurationSnapshot> =>
  chrome.storage.local.get([...IMPORT_CONFIG_KEYS]);

export const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
};
export const configurationFingerprint = async (value: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

export const configurationToExport = (raw: ConfigurationSnapshot): ExportedSettings => {
  const locations = raw[EXTENSION_STORAGE_KEYS.locations] ?? DEFAULT_LOCATIONS;
  const preferences = normalizePreferences(raw[EXTENSION_STORAGE_KEYS.preferences]);
  const legacy = readLegacyBehavior({
    ...(raw[EXTENSION_STORAGE_KEYS.preferences] as object),
    locations,
    behavioralProfiles: raw.behavioralProfiles,
  });
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    locations: locations as ExportedSettings["locations"],
    rules: (raw[EXTENSION_STORAGE_KEYS.rules] ??
      DEFAULT_RULES) as ExportedSettings["rules"],
    trustedSites: (raw[EXTENSION_STORAGE_KEYS.trustedSites] ??
      DEFAULT_TRUSTED_SITES) as NonNullable<ExportedSettings["trustedSites"]>,
    containerAssignments: (raw[EXTENSION_STORAGE_KEYS.containerAssignments] ??
      []) as NonNullable<ExportedSettings["containerAssignments"]>,
    ...preferences,
    ...(raw.sharedSpoofing
      ? { sharedSpoofing: raw.sharedSpoofing as ExportedSettings["sharedSpoofing"] }
      : {}),
    ...(raw.globalFallbackRule
      ? {
          globalFallbackRule:
            raw.globalFallbackRule as ExportedSettings["globalFallbackRule"],
        }
      : {}),
    ...(legacy.profiles ? { behavioralProfiles: legacy.profiles } : {}),
    ...(legacy.enabled !== undefined
      ? { behavioralProfilesEnabled: legacy.enabled }
      : {}),
  };
};

export const importedConfiguration = (
  source: ExportedSettings,
): ConfigurationSnapshot => {
  const settings = validateImportedSettings(source);
  const refs = new Map(
    settings.legacyBehavior.refs?.map((ref) => [ref.id, ref.profileId]),
  );
  const preferences = normalizePreferences(settings);
  return {
    [EXTENSION_STORAGE_KEYS.locations]: settings.locations.map((location) => {
      const behaviorProfileId = refs.get(location.id);
      return behaviorProfileId ? { ...location, behaviorProfileId } : location;
    }),
    [EXTENSION_STORAGE_KEYS.rules]: settings.rules,
    [EXTENSION_STORAGE_KEYS.trustedSites]: settings.trustedSites,
    [EXTENSION_STORAGE_KEYS.containerAssignments]: settings.containerAssignments ?? [],
    [EXTENSION_STORAGE_KEYS.preferences]: {
      ...preferences,
      featureFlags: {
        ...preferences.featureFlags,
        ...(settings.legacyBehavior.enabled !== undefined
          ? { behavioralProfiles: settings.legacyBehavior.enabled }
          : {}),
      },
    },
    ...(settings.sharedSpoofing ? { sharedSpoofing: settings.sharedSpoofing } : {}),
    ...(settings.globalFallbackRule
      ? { globalFallbackRule: settings.globalFallbackRule }
      : {}),
    ...(settings.legacyBehavior.profiles
      ? { behavioralProfiles: settings.legacyBehavior.profiles }
      : {}),
  };
};

/** A single batch writes present keys; the journal protects absent-key removal too. */
export const writeConfiguration = async (
  snapshot: ConfigurationSnapshot,
): Promise<void> => {
  await chrome.storage.local.set(snapshot);
  const absent = IMPORT_CONFIG_KEYS.filter((key) => !Object.hasOwn(snapshot, key));
  if (absent.length > 0) await chrome.storage.local.remove(absent);
};

export const readImportJournal = async (): Promise<ImportJournal | null> => {
  const stored = await chrome.storage.local.get(IMPORT_JOURNAL_KEY);
  const journal = stored[IMPORT_JOURNAL_KEY] as ImportJournal | undefined;
  if (!journal) return null;
  const quarantined = journal as { version: number; phase: string; expiresAt: number };
  if (quarantined.version === 0 && quarantined.phase === "quarantined") {
    if (!Number.isFinite(quarantined.expiresAt) || quarantined.expiresAt <= Date.now())
      await chrome.storage.local.remove(IMPORT_JOURNAL_KEY);
    return null;
  }
  if (
    journal.version !== 1 ||
    !["pending", "committed"].includes(journal.phase) ||
    !Number.isFinite(journal.expiresAt) ||
    typeof journal.afterFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(journal.afterFingerprint) ||
    !journal.before ||
    typeof journal.before !== "object" ||
    Array.isArray(journal.before) ||
    Object.keys(journal.before).some(
      (key) => !(IMPORT_CONFIG_KEYS as readonly string[]).includes(key),
    )
  ) {
    // Keep at most one bounded recovery copy, including incompatible versions.
    // Normal imports replace this quarantine; the expiry alarm removes it too.
    await chrome.storage.local.set({
      [IMPORT_JOURNAL_KEY]: {
        version: 0,
        phase: "quarantined",
        record: journal,
        expiresAt: Date.now() + IMPORT_RETENTION_MS,
      },
    });
    setImportProgress({ active: isSettingsImportActive(), recoveryNeeded: true });
    console.warn("Quarantined unreadable configuration recovery journal.");
    return null;
  }
  return journal;
};

/** Pending records never expire: recovery must precede every runtime bootstrap. */
export const recoverSettingsImport = async (): Promise<boolean> => {
  const journal = await readImportJournal();
  if (!journal) {
    const rebuild = needsImportRecovery();
    setImportProgress({ active: false, recoveryNeeded: false });
    return rebuild;
  }
  if (journal.phase === "pending") {
    await writeConfiguration(journal.before);
    await chrome.storage.local.remove(IMPORT_JOURNAL_KEY);
    setImportProgress({ active: false, recoveryNeeded: false });
    return true;
  }
  if (
    journal.expiresAt <= Date.now() ||
    journal.afterFingerprint !==
      (await configurationFingerprint(await readConfiguration()))
  ) {
    await chrome.storage.local.remove(IMPORT_JOURNAL_KEY);
  }
  return false;
};
