import { isReservedKey } from "@/shared/reserved-keys";
import { rulePatternKey } from "@/shared/rule-groups";
import {
  RESERVED_IMPORT_NAME,
  type ReservedImportNameIssue,
} from "@/shared/settings-import";

type Path = ReservedImportNameIssue["path"];

const formatPath = (path: Path): string =>
  path.reduce<string>((text, part) => {
    if (typeof part === "number") return `${text}[${part}]`;
    return text ? `${text}.${part}` : part;
  }, "");

const reservedName = (path: Path, name: string): ReservedImportNameIssue => ({
  code: RESERVED_IMPORT_NAME,
  path,
  name,
  scope: path.length > 1 ? String(path[0]) : "",
  message: `Reserved name "${name}" at ${formatPath(path)} cannot be imported.`,
});

/** Every own key in the parsed file; `JSON.parse` keeps `"__proto__"` as one. */
const findReservedKeys = (settings: unknown): ReservedImportNameIssue[] => {
  const issues: ReservedImportNameIssue[] = [];
  const seen = new WeakSet<object>();
  const queue: Array<{ value: unknown; path: Path }> = [{ value: settings, path: [] }];
  for (let index = 0; index < queue.length; index += 1) {
    const { value, path } = queue[index]!;
    if (typeof value !== "object" || value === null || seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, position) =>
        queue.push({ value: item, path: [...path, position] }),
      );
      continue;
    }
    for (const key of Object.keys(value)) {
      if (isReservedKey(key)) issues.push(reservedName([...path, key], key));
      else queue.push({ value: Reflect.get(value, key), path: [...path, key] });
    }
  }
  return issues;
};

const entries = (settings: unknown, collection: string): Array<[number, object]> => {
  const items: unknown =
    typeof settings === "object" && settings !== null
      ? Reflect.get(settings, collection)
      : undefined;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item: unknown, index): Array<[number, object]> =>
    typeof item === "object" && item !== null ? [[index, item]] : [],
  );
};

const readString = (item: object, field: string): string | null => {
  const value: unknown = Object.hasOwn(item, field) ? Reflect.get(item, field) : null;
  return typeof value === "string" ? value : null;
};

/**
 * Identifiers that the import selection and plugins use as object keys, compared
 * in the form validation stores. Rule patterns are user-typed hostnames, so only
 * `__proto__` is refused there: object literals and the selection schema drop it,
 * while `constructor` or `prototype` remain valid single-label hosts.
 */
const findReservedIds = (settings: unknown): ReservedImportNameIssue[] => [
  ...entries(settings, "locations").flatMap(([index, location]) => {
    const id = readString(location, "id");
    return id !== null && isReservedKey(id)
      ? [reservedName(["locations", index, "id"], id)]
      : [];
  }),
  ...entries(settings, "rules").flatMap(([index, rule]) => {
    const pattern = readString(rule, "pattern");
    return pattern !== null && rulePatternKey(pattern) === "__proto__"
      ? [reservedName(["rules", index, "pattern"], "__proto__")]
      : [];
  }),
  ...entries(settings, "containerAssignments").flatMap(([index, assignment]) => {
    const id = readString(assignment, "cookieStoreId")?.trim();
    return id !== undefined && isReservedKey(id)
      ? [reservedName(["containerAssignments", index, "cookieStoreId"], id)]
      : [];
  }),
];

export const findReservedImportNames = (
  settings: unknown,
): ReservedImportNameIssue[] => [
  ...findReservedKeys(settings),
  ...findReservedIds(settings),
];

/** Rejects an import file before any preview, merge or write can use the name. */
export const assertAllowedImportNames = (settings: unknown): void => {
  const issues = findReservedImportNames(settings);
  if (issues.length > 0) throw new Error(JSON.stringify(issues));
};
