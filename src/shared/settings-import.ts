import type { ExportedSettings } from "./shared-model-types";

export type LocationImportChoice = "import" | "keep" | "copy" | "skip";
export type RuleImportChoice = "import" | "keep" | "skip";
export type SettingsImportSelection = {
  mode: "replace" | "merge";
  locations: Record<string, LocationImportChoice>;
  rules: Record<string, RuleImportChoice>;
  /** Every foreign assignment requires an explicit local ID or null to skip. */
  containers: Record<string, string | null>;
};
export type SettingsImportChange = {
  collection:
    "locations" | "rules" | "trustedSites" | "containerAssignments" | "settings";
  key: string;
  kind: "added" | "changed" | "removed";
  before?: unknown;
  after?: unknown;
};
export type SettingsImportPreview = {
  token: string;
  source: ExportedSettings;
  selection: SettingsImportSelection;
  conflicts: { locations: string[]; rules: string[] };
  localContainers: Array<{ cookieStoreId: string; name: string }>;
  changes: SettingsImportChange[];
  problems: string[];
};
export type ImportPreviewResponse =
  { ok: true; preview: SettingsImportPreview } | { ok: false; error: string };
export type ImportUndoStatusResponse = {
  ok: true;
  available: boolean;
  expiresAt: number | null;
};
