import {
  getSurfaceDefinition,
  SURFACE_METHOD_IDS,
  type SpoofingSurfaceMethodId,
  type SurfaceMethodQueryCounts,
} from "@/shared/spoofing-surfaces";
import type { XRaySurfaceCategory } from "@/shared/types";

export type CategorySelection = "all" | "some" | "none";

export interface InspectorMethodRow {
  id: SpoofingSurfaceMethodId;
  label: string;
  trappable: boolean;
  useCount: number;
}

export interface InspectorCategoryRow {
  key: XRaySurfaceCategory;
  label: string;
  /** Methods matching the active search and filter, in catalog order. */
  methods: InspectorMethodRow[];
}

export interface InspectorTreeInput {
  categories: readonly XRaySurfaceCategory[];
  trappableMethodIds: ReadonlySet<string>;
  methodCounts: SurfaceMethodQueryCounts;
  methodLabels: Record<SpoofingSurfaceMethodId, string>;
  categoryLabel: (category: XRaySurfaceCategory) => string;
  query: string;
  usedOnly: boolean;
}

const includesQuery = (value: string, query: string) =>
  value.toLowerCase().includes(query);

/** Builds the visible category/method tree; categories without visible methods drop out. */
export const buildInspectorTree = ({
  categories,
  trappableMethodIds,
  methodCounts,
  methodLabels,
  categoryLabel,
  query,
  usedOnly,
}: InspectorTreeInput): InspectorCategoryRow[] => {
  const normalizedQuery = query.trim().toLowerCase();
  return categories
    .map((key) => {
      const label = categoryLabel(key);
      const categoryMatches =
        normalizedQuery === "" || includesQuery(label, normalizedQuery);
      const methods = getSurfaceDefinition(key)
        .methods.map((method): InspectorMethodRow => ({
          id: method.id,
          label: methodLabels[method.id],
          trappable: trappableMethodIds.has(method.id),
          useCount: methodCounts[method.id] ?? 0,
        }))
        .filter(
          (method) =>
            (!usedOnly || method.useCount > 0) &&
            (categoryMatches ||
              includesQuery(method.label, normalizedQuery) ||
              includesQuery(method.id, normalizedQuery)),
        );
      return { key, label, methods };
    })
    .filter((category) => category.methods.length > 0);
};

const trappableIds = (methods: readonly InspectorMethodRow[]) =>
  methods.filter((method) => method.trappable).map((method) => method.id);

/** Tri-state value of a category checkbox over its visible, trappable methods. */
export const getCategorySelection = (
  methods: readonly InspectorMethodRow[],
  selected: ReadonlySet<string>,
): CategorySelection => {
  const ids = trappableIds(methods);
  const selectedCount = ids.filter((id) => selected.has(id)).length;
  if (selectedCount === 0) return "none";
  return selectedCount === ids.length ? "all" : "some";
};

/** A fully selected category clears; a partial or empty one selects every visible method. */
export const toggleCategory = (
  methods: readonly InspectorMethodRow[],
  selected: ReadonlySet<string>,
): Set<string> => {
  const next = new Set(selected);
  const clear = getCategorySelection(methods, selected) === "all";
  for (const id of trappableIds(methods)) {
    if (clear) next.delete(id);
    else next.add(id);
  }
  return next;
};

export const toggleMethod = (
  id: string,
  selected: ReadonlySet<string>,
): Set<string> => {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/** Selected IDs that can be armed, in stable catalog order. */
export const armableSelection = (
  selected: ReadonlySet<string>,
  trappableMethodIds: ReadonlySet<string>,
): string[] =>
  SURFACE_METHOD_IDS.filter((id) => selected.has(id) && trappableMethodIds.has(id));

export const sameMethodSet = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
};
