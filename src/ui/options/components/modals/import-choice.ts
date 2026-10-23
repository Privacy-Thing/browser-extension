import type { SettingsImportSelection } from "@/shared/settings-import";

/**
 * Reads a collection choice by own key. IDs such as `constructor`, `toString` and
 * `__proto__` are valid and must not resolve to inherited `Object.prototype` members.
 */
export const readImportChoice = (
  selection: SettingsImportSelection,
  collection: "locations" | "rules",
  key: string,
): string | undefined => {
  const choices = selection[collection];
  return Object.hasOwn(choices, key) ? choices[key] : undefined;
};
