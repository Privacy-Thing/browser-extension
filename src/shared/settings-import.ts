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

/** Issue code for an import file that uses a reserved name as an ID or key. */
export const RESERVED_IMPORT_NAME = "reserved_name";
export type ReservedImportNameIssue = {
  code: typeof RESERVED_IMPORT_NAME;
  /** Where the name occurs in the file, e.g. `["locations", 0, "id"]`. */
  path: Array<string | number>;
  name: string;
  /** Top-level field holding the name; empty for a top-level key. */
  scope: string;
  message: string;
};
