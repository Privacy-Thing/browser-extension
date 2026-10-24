import { useId, useMemo, useState } from "react";

import {
  buildInspectorTree,
  getCategorySelection,
  toggleCategory,
  toggleMethod,
  type CategorySelection,
  type InspectorCategoryRow,
  type InspectorMethodRow,
} from "./inspector-selection";

import type { SurfaceMethodQueryCounts } from "@/shared/spoofing-surfaces";
import type { XRaySurfaceCategory } from "@/shared/types";
import { Button } from "@/ui/components/ui/button";
import { Checkbox } from "@/ui/components/ui/checkbox";
import { TableSearchInput } from "@/ui/components/ui/table-search-input";
import { t } from "@/ui/i18n";
import { getSurfaceMethodLabels } from "@/ui/shared/surface-method-labels";

const MethodMeta = ({
  method,
  reasonId,
}: {
  method: InspectorMethodRow;
  reasonId: string;
}) => {
  if (!method.trappable) {
    return (
      <span
        id={reasonId}
        title={t.sidebar.inspector.list.notTrappableReason}
        className="shrink-0 text-[11px] text-muted-foreground"
      >
        {t.sidebar.inspector.list.notTrappable}
        <span className="sr-only">. {t.sidebar.inspector.list.notTrappableReason}</span>
      </span>
    );
  }
  if (method.useCount === 0) return null;
  return (
    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
      <span aria-hidden="true">{method.useCount}×</span>
      <span className="sr-only">{t.sidebar.inspector.list.used(method.useCount)}</span>
    </span>
  );
};

const CHECKBOX_VALUE = {
  all: true,
  some: "indeterminate",
  none: false,
} as const satisfies Record<CategorySelection, boolean | "indeterminate">;

const MethodItem = ({
  method,
  checked,
  disabled,
  onToggle,
}: {
  method: InspectorMethodRow;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) => {
  const id = useId();
  const reasonId = useId();
  return (
    <li
      className="flex items-center gap-2 py-0.5"
      data-inspector-method={method.id}
      data-trappable={method.trappable}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled || !method.trappable}
        aria-describedby={method.trappable ? undefined : reasonId}
        onChange={onToggle}
      />
      <label
        htmlFor={id}
        title={method.id}
        className={`min-w-0 flex-1 truncate font-mono text-[11px] ${method.trappable ? "cursor-pointer text-foreground/90" : "cursor-not-allowed text-muted-foreground"}`}
      >
        {method.label}
      </label>
      <MethodMeta method={method} reasonId={reasonId} />
    </li>
  );
};

const CategoryItem = ({
  category,
  selection,
  expanded,
  disabled,
  onExpandedChange,
  onSelectionChange,
}: {
  category: InspectorCategoryRow;
  selection: ReadonlySet<string>;
  expanded: boolean;
  disabled: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSelectionChange: (next: Set<string>) => void;
}) => {
  const checkboxId = useId();
  const summaryId = useId();
  const groupId = useId();
  const state = getCategorySelection(category.methods, selection);
  const trappable = category.methods.filter((method) => method.trappable);
  const selectedCount = trappable.filter((method) => selection.has(method.id)).length;

  return (
    <li data-inspector-category={category.key} data-selection={state}>
      <div className="flex items-center gap-1.5 py-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6 shrink-0"
          aria-expanded={expanded}
          aria-controls={groupId}
          aria-label={t.sidebar.inspector.list.methodsOf(category.label)}
          data-inspector-disclosure
          onClick={() => onExpandedChange(!expanded)}
        >
          <i
            className={`fa-solid fa-chevron-right text-[9px] transition-transform ${expanded ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
        </Button>
        <Checkbox
          id={checkboxId}
          checked={CHECKBOX_VALUE[state]}
          disabled={disabled || trappable.length === 0}
          aria-describedby={summaryId}
          onChange={() =>
            onSelectionChange(toggleCategory(category.methods, selection))
          }
        />
        <label
          htmlFor={checkboxId}
          className={`min-w-0 flex-1 truncate text-xs ${trappable.length > 0 ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground"}`}
        >
          {category.label}
        </label>
        <span
          id={summaryId}
          className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
        >
          {trappable.length > 0 ? (
            <>
              <span aria-hidden="true">
                {t.sidebar.inspector.list.selectedOfTotal(
                  selectedCount,
                  trappable.length,
                )}
              </span>
              <span className="sr-only">
                {t.sidebar.inspector.list.selectedSummary(
                  selectedCount,
                  trappable.length,
                )}
              </span>
            </>
          ) : (
            t.sidebar.inspector.list.notTrappable
          )}
        </span>
      </div>
      {expanded ? (
        <ul
          id={groupId}
          className="mb-1 ml-3 flex flex-col border-l border-border/60 pl-[1.15rem]"
        >
          {category.methods.map((method) => (
            <MethodItem
              key={method.id}
              method={method}
              checked={selection.has(method.id)}
              disabled={disabled}
              onToggle={() => onSelectionChange(toggleMethod(method.id, selection))}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

export const XRayInspectorMethodList = ({
  categories,
  categoryLabel,
  methodCounts,
  trappableMethodIds,
  selection,
  disabled,
  onSelectionChange,
}: {
  categories: readonly XRaySurfaceCategory[];
  categoryLabel: (category: XRaySurfaceCategory) => string;
  methodCounts: SurfaceMethodQueryCounts;
  trappableMethodIds: readonly string[];
  selection: ReadonlySet<string>;
  disabled: boolean;
  onSelectionChange: (next: Set<string>) => void;
}) => {
  const listLabelId = useId();
  const [query, setQuery] = useState("");
  const [usedOnly, setUsedOnly] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  // While searching every matching category opens; the user can still fold one.
  const [foldedWhileSearching, setFoldedWhileSearching] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const searching = query.trim() !== "";
  const trappable = useMemo(() => new Set(trappableMethodIds), [trappableMethodIds]);
  const methodLabels = useMemo(() => getSurfaceMethodLabels(), []);
  const tree = buildInspectorTree({
    categories,
    trappableMethodIds: trappable,
    methodCounts,
    methodLabels,
    categoryLabel,
    query,
    usedOnly,
  });
  const usedCount = Object.values(methodCounts).filter(
    (count) => typeof count === "number" && count > 0,
  ).length;

  const isExpanded = (key: string) =>
    searching ? !foldedWhileSearching.has(key) : expanded.has(key);
  const setCategoryExpanded = (key: string, open: boolean) => {
    const update = (current: ReadonlySet<string>, add: boolean) => {
      const next = new Set(current);
      if (add) next.add(key);
      else next.delete(key);
      return next;
    };
    if (searching) setFoldedWhileSearching((current) => update(current, !open));
    else setExpanded((current) => update(current, open));
  };

  return (
    <div className="flex flex-col gap-2" data-xray-inspector-list>
      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput
          className="min-w-[10rem] flex-1"
          type="search"
          value={query}
          placeholder={t.sidebar.inspector.list.search}
          aria-label={t.sidebar.inspector.list.search}
          data-inspector-search
          onChange={(event) => {
            setQuery(event.target.value);
            setFoldedWhileSearching(new Set());
          }}
        />
        <Button
          variant={usedOnly ? "secondary" : "outline"}
          size="sm"
          className="h-9"
          aria-pressed={usedOnly}
          disabled={usedCount === 0 && !usedOnly}
          data-inspector-used-filter={usedOnly}
          onClick={() => setUsedOnly((current) => !current)}
        >
          <i className="fa-solid fa-filter mr-1.5 text-[10px]" aria-hidden="true" />
          {t.sidebar.inspector.list.usedOnly}
          <span className="ml-1.5 tabular-nums text-muted-foreground">{usedCount}</span>
        </Button>
      </div>

      <p id={listLabelId} className="sr-only">
        {t.sidebar.inspector.list.label}
      </p>
      {tree.length > 0 ? (
        <ul aria-labelledby={listLabelId} className="flex flex-col">
          {tree.map((category) => (
            <CategoryItem
              key={category.key}
              category={category}
              selection={selection}
              expanded={isExpanded(category.key)}
              disabled={disabled}
              onExpandedChange={(open) => setCategoryExpanded(category.key, open)}
              onSelectionChange={onSelectionChange}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-2 py-2" data-inspector-no-matches>
          <p className="text-xs text-muted-foreground">
            {t.sidebar.inspector.list.noMatches}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setUsedOnly(false);
            }}
          >
            {t.sidebar.inspector.list.clearFilters}
          </Button>
        </div>
      )}
    </div>
  );
};
