import { slugifyToken } from "@/shared/slugify";
import type { DomainRule, Location } from "@/shared/types";

const slugifyId = (value: string): string => slugifyToken(value);

const createUniqueLocationId = (
  baseId: string,
  existingIds: readonly string[],
): string => {
  const normalizedBaseId = slugifyId(baseId) || "profile-copy";
  if (!existingIds.includes(normalizedBaseId)) {
    return normalizedBaseId;
  }

  for (let index = 2; ; index += 1) {
    const candidate = `${normalizedBaseId}-${index}`;
    if (!existingIds.includes(candidate)) {
      return candidate;
    }
  }
};

export const duplicateLocation = (
  location: Location,
  existingIds: readonly string[],
): Location => {
  const baseId = `${location.id}-copy`;
  const nextId = createUniqueLocationId(baseId, existingIds);
  const nextLabel = location.label.trim() ? `${location.label} copy` : "Location copy";

  return {
    ...location,
    id: nextId,
    label: nextLabel,
  };
};

export const duplicateRule = (rule: DomainRule): DomainRule => ({
  ...rule,
});
