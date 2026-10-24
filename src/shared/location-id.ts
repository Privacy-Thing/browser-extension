import { isReservedKey } from "@/shared/reserved-keys";
import { slugifyToken } from "@/shared/slugify";

/**
 * Slug ID for a new preset that is unique among `existingIds` and never a
 * reserved name, so a preset labelled "Constructor" becomes `constructor-2`.
 */
export const createUniqueLocationId = (
  value: string,
  existingIds: readonly string[],
  fallback: string,
): string => {
  const baseId = slugifyToken(value) || fallback;
  const available = (id: string) => !isReservedKey(id) && !existingIds.includes(id);
  if (available(baseId)) return baseId;
  for (let index = 2; ; index += 1) {
    const candidate = `${baseId}-${index}`;
    if (available(candidate)) return candidate;
  }
};
