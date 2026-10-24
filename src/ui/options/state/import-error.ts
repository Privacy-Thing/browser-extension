import { RESERVED_IMPORT_NAME } from "@/shared/settings-import";
import { t } from "@/ui/i18n";

export type ImportErrorItem = {
  message: string;
  field: string | null;
  /** A reserved name the file uses as an ID or key, and the field holding it. */
  reserved: { name: string; scope: string } | null;
};
export type ParsedImportError = {
  items: ImportErrorItem[];
  /** Raw validation payload, kept only when it was structured. */
  technical: string | null;
};

type Issue = {
  message: string;
  path?: unknown;
  code?: unknown;
  name?: unknown;
  scope?: unknown;
};

const isIssue = (value: unknown): value is Issue =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { message?: unknown }).message === "string";

/** Collections use their dialog label; other fields keep their file name. */
const scopeLabel = (scope: string): string => {
  switch (scope) {
    case "":
      return t.settingsImport.settings;
    case "locations":
      return t.settingsImport.locations;
    case "rules":
      return t.settingsImport.rules;
    case "containerAssignments":
      return t.settingsImport.containerAssignments;
    case "trustedSites":
      return t.settingsImport.trustedSites;
    default:
      return scope;
  }
};

const toItem = (issue: Issue): ImportErrorItem => {
  if (
    issue.code === RESERVED_IMPORT_NAME &&
    typeof issue.name === "string" &&
    typeof issue.scope === "string"
  )
    return {
      message: t.settingsImport.reservedName(issue.name, scopeLabel(issue.scope)),
      field: "reservedName",
      reserved: { name: issue.name, scope: issue.scope },
    };
  const last = Array.isArray(issue.path) ? issue.path.at(-1) : undefined;
  return {
    message: issue.message,
    field: typeof last === "string" ? last : null,
    reserved: null,
  };
};

/**
 * Background validation reports a serialized issue list (`code`, `path`, `message`).
 * Show only each message; any other error text is kept as a single message.
 */
export const parseImportError = (error: string): ParsedImportError => {
  const plain = {
    items: [{ message: error, field: null, reserved: null }],
    technical: null,
  };
  if (!error.trimStart().startsWith("[")) return plain;
  let parsed: unknown;
  try {
    parsed = JSON.parse(error);
  } catch {
    return plain;
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isIssue))
    return plain;
  // Two entries with one reserved ID read the same; list the message once.
  const items = parsed
    .map(toItem)
    .filter(
      (item, index, all) =>
        all.findIndex((other) => other.message === item.message) === index,
    );
  return { items, technical: error };
};
