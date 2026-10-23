export type ImportErrorItem = { message: string; field: string | null };
export type ParsedImportError = {
  items: ImportErrorItem[];
  /** Raw validation payload, kept only when it was structured. */
  technical: string | null;
};

const isIssue = (value: unknown): value is { message: string; path?: unknown } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { message?: unknown }).message === "string";

/**
 * Background validation reports a serialized issue list (`code`, `path`, `message`).
 * Show only each message; any other error text is kept as a single message.
 */
export const parseImportError = (error: string): ParsedImportError => {
  const plain = { items: [{ message: error, field: null }], technical: null };
  if (!error.trimStart().startsWith("[")) return plain;
  let parsed: unknown;
  try {
    parsed = JSON.parse(error);
  } catch {
    return plain;
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isIssue))
    return plain;
  return {
    items: parsed.map((issue) => {
      const last = Array.isArray(issue.path) ? issue.path.at(-1) : undefined;
      return { message: issue.message, field: typeof last === "string" ? last : null };
    }),
    technical: error,
  };
};
