import { createUniqueLocationId } from "@/shared/location-id";
import type { DomainRule, Location } from "@/shared/types";

export const duplicateLocation = (
  location: Location,
  existingIds: readonly string[],
): Location => {
  const baseId = `${location.id}-copy`;
  const nextId = createUniqueLocationId(baseId, existingIds, "profile-copy");
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
