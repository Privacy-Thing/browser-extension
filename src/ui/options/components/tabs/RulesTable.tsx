import { cn } from "@/ui/components/lib/utils";
import { Badge } from "@/ui/components/ui/badge";
import { Button } from "@/ui/components/ui/button";
import { Checkbox } from "@/ui/components/ui/checkbox";
import { Combobox } from "@/ui/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/components/ui/table";
import { TableSelectionMenu } from "@/ui/components/ui/table-selection-menu";
import { TableSelectionNotice } from "@/ui/components/ui/table-selection-notice";
import { t } from "@/ui/i18n";
import { AnchorHeading } from "@/ui/options/components/AnchorHeading";
import {
  isFallbackIncomplete,
  isGlobalFallbackInactive,
} from "@/ui/options/components/tabs/global-fallback-state";
import { SECTION_ANCHORS } from "@/ui/options/navigation";
import {
  toggleMatchingSelections,
  toggleVisibleSelections,
} from "@/ui/options/rule-selection";
import { useSettings } from "@/ui/options/state/SettingsContext";
import { icon, normalizeRulePattern } from "@/ui/options/utils";

const selectionState = (
  allSelected: boolean,
  someSelected: boolean,
): boolean | "indeterminate" => {
  if (allSelected) return true;
  return someSelected ? "indeterminate" : false;
};

const fallbackState = (
  inactive: boolean,
  unconfigured: boolean,
): "inactive" | "unconfigured" | "configured" => {
  if (inactive) return "inactive";
  return unconfigured ? "unconfigured" : "configured";
};

const RulesSelectionHead = () => {
  const {
    allRuleKeys,
    bulkSelectionState,
    setSelectedRulePatterns,
    viewModels,
    visibleRuleKeys,
  } = useSettings();
  const active = viewModels
    .filter(({ rule }) => rule.enabled)
    .map(({ rule }) => normalizeRulePattern(rule.pattern));
  const inactive = viewModels
    .filter(({ rule }) => !rule.enabled)
    .map(({ rule }) => normalizeRulePattern(rule.pattern));
  const selectMatching = (keys: string[]) =>
    setSelectedRulePatterns((current) =>
      toggleMatchingSelections(
        keys,
        toggleVisibleSelections(visibleRuleKeys, current, false),
        true,
      ),
    );
  return (
    <TableSelectionMenu
      checked={selectionState(
        bulkSelectionState.allVisibleSelected,
        bulkSelectionState.someVisibleSelected,
      )}
      toggleAllAriaLabel={t.rules.selectAllAriaLabel}
      menuAriaLabel={t.rules.selectMenuAriaLabel}
      onToggleAll={() =>
        setSelectedRulePatterns((current) =>
          toggleVisibleSelections(
            visibleRuleKeys,
            current,
            !bulkSelectionState.allVisibleSelected,
          ),
        )
      }
      options={[
        {
          id: "all-visible",
          label: t.rules.selectionMenuAllVisible,
          onSelect: () =>
            setSelectedRulePatterns((current) =>
              toggleVisibleSelections(visibleRuleKeys, current, true),
            ),
          disabled: visibleRuleKeys.length === 0,
        },
        {
          id: "all",
          label: t.rules.selectionMenuAll,
          onSelect: () =>
            setSelectedRulePatterns((current) =>
              toggleMatchingSelections(allRuleKeys, current, true),
            ),
          disabled: allRuleKeys.length === 0,
        },
        {
          id: "none",
          label: t.rules.selectionMenuNone,
          onSelect: () =>
            setSelectedRulePatterns((current) =>
              toggleVisibleSelections(visibleRuleKeys, current, false),
            ),
          disabled: visibleRuleKeys.length === 0,
        },
        {
          id: "active",
          label: t.rules.selectionMenuActive,
          onSelect: () => selectMatching(active),
          disabled: active.length === 0,
        },
        {
          id: "inactive",
          label: t.rules.selectionMenuInactive,
          onSelect: () => selectMatching(inactive),
          disabled: inactive.length === 0,
        },
      ]}
    />
  );
};

const RulesSelectionNotice = () => {
  const {
    assignBulkLocation,
    handleBulkDelete,
    ruleProfileOptions,
    selectedRulePatterns,
    setSelectedRulePatterns,
  } = useSettings();
  if (selectedRulePatterns.size === 0) return null;
  return (
    <div className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">
          {t.common.selectionCount(selectedRulePatterns.size)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-muted-foreground hover:text-foreground"
          onClick={() => setSelectedRulePatterns(new Set())}
        >
          {t.common.actions.clearSelection}
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="w-full sm:w-44">
          <Combobox
            options={ruleProfileOptions}
            id="bulk-rule-profile"
            ariaLabel={t.rules.assignLocationLabel}
            placeholder={t.rules.assignLocationLabel}
            searchPlaceholder={t.rules.dialog.bulkAssignSearchPlaceholder}
            emptyMessage="No locations found."
            size="sm"
            className="w-full"
            onValueChange={(locationId) => {
              if (locationId) void assignBulkLocation(locationId);
            }}
          />
        </div>
        <Button
          id="delete-selected-rules"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => void handleBulkDelete()}
        >
          {t.common.actions.deleteSelected}
        </Button>
      </div>
    </div>
  );
};

const FallbackRuleRow = () => {
  const { globalFallbackRule, highlightedAnchorId, openFallbackDialog, profiles } =
    useSettings();
  const locationLabel = globalFallbackRule?.locationId
    ? (profiles.find((profile) => profile.id === globalFallbackRule.locationId)
        ?.label ?? globalFallbackRule.locationId)
    : null;
  const overrideCount = Object.values(
    globalFallbackRule?.fingerprintSurfaceOverrides ?? {},
  ).filter((value) => value !== undefined).length;
  const unconfigured = isFallbackIncomplete(globalFallbackRule);
  const inactive = isGlobalFallbackInactive(globalFallbackRule);
  const state = fallbackState(inactive, unconfigured);
  return (
    <TableRow
      id={SECTION_ANCHORS.rules.globalFallback}
      data-anchor-id={SECTION_ANCHORS.rules.globalFallback}
      data-fallback-state={state}
      data-fallback-preset={locationLabel ? "set" : "none"}
      className={cn(
        "gw-anchor-target gw-anchor-no-pulse scroll-mt-7 border-b transition-colors hover:bg-muted/20",
        inactive && "bg-muted/20 text-muted-foreground",
        highlightedAnchorId === SECTION_ANCHORS.rules.globalFallback &&
          "gw-anchor-highlighted",
      )}
    >
      <TableCell className="w-[3.75rem] min-w-[3.75rem] px-2 py-3" />
      <TableCell className="px-3 py-3">
        <div className="gw-rule-cell">
          <AnchorHeading
            anchorId={SECTION_ANCHORS.rules.globalFallback}
            label={t.common.copyLinkTo(t.rules.globalFallback.copyLinkLabel)}
            className="gw-anchor-heading-compact"
          >
            <span className="inline-flex max-w-full items-center gap-2">
              <span
                className={cn(
                  "min-w-0 truncate font-semibold",
                  inactive && "text-muted-foreground",
                )}
              >
                {t.rules.globalFallback.title}
              </span>
              {inactive ? (
                <Badge
                  variant="secondary"
                  className="shrink-0 px-2 py-0 text-[10px] font-semibold uppercase tracking-[0.08em]"
                >
                  {t.rules.inactiveBadge}
                </Badge>
              ) : null}
              {overrideCount > 0 ? (
                <Badge variant="outline" className="shrink-0">
                  {t.rules.globalFallback.overridesBadge(overrideCount)}
                </Badge>
              ) : null}
            </span>
          </AnchorHeading>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {unconfigured
              ? t.rules.globalFallback.setupHint
              : t.rules.globalFallback.tableHint}
          </p>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 text-sm">
        <span className={cn("block truncate", inactive && "text-muted-foreground")}>
          {locationLabel ?? t.rules.globalFallback.noPresetLabel}
        </span>
      </TableCell>
      <TableCell className="px-3 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.rules.globalFallback.editAriaLabel}
            title={t.rules.globalFallback.editTitle}
            onClick={() => openFallbackDialog()}
          >
            {icon("fa-pen")}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

const DomainRuleRows = () => {
  const {
    getRuleAnchor,
    handleDeleteRule,
    highlightedAnchorId,
    openRuleDialog,
    rulesFilter,
    linkedRuleLocationId,
    selectedRulePatterns,
    setSelectedRulePatterns,
    viewModels,
  } = useSettings();
  if (viewModels.length === 0) {
    return (
      <TableRow>
        <TableCell
          colSpan={4}
          className="px-3 py-6 text-center text-sm text-muted-foreground"
        >
          {rulesFilter || linkedRuleLocationId
            ? t.rules.noRulesFiltered
            : t.rules.noRulesEmpty}
        </TableCell>
      </TableRow>
    );
  }
  return viewModels.map(({ rule, locationLabel, conflicts }) => {
    const key = normalizeRulePattern(rule.pattern);
    const anchor = getRuleAnchor(rule.pattern);
    return (
      <TableRow
        key={key}
        id={anchor}
        data-anchor-id={anchor}
        className={cn(
          "rule-table-row gw-anchor-target gw-anchor-no-pulse scroll-mt-7 border-b last:border-0 hover:bg-muted/30 transition-colors",
          !rule.enabled && "bg-muted/20 text-muted-foreground",
          highlightedAnchorId === anchor && "gw-anchor-highlighted",
        )}
      >
        <TableCell className="w-[3.75rem] min-w-[3.75rem] px-2 py-3">
          <div className="flex items-center justify-center">
            <Checkbox
              aria-label={t.rules.selectRuleAriaLabel(rule.pattern)}
              checked={selectedRulePatterns.has(key)}
              readOnly
              onClick={() =>
                setSelectedRulePatterns((current) => {
                  const next = new Set(current);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
            />
          </div>
        </TableCell>
        <TableCell className="px-3 py-3">
          <div className="gw-rule-cell">
            <AnchorHeading
              anchorId={anchor}
              label={t.rules.copyLinkRuleAriaLabel(rule.pattern)}
              className="gw-anchor-heading-compact"
            >
              <span className="inline-flex max-w-full items-center gap-2">
                <span
                  className={cn(
                    "min-w-0 truncate font-semibold",
                    !rule.enabled && "text-muted-foreground",
                  )}
                >
                  {rule.pattern}
                </span>
                {!rule.enabled ? (
                  <Badge
                    variant="secondary"
                    className="shrink-0 px-2 py-0 text-[10px] font-semibold uppercase tracking-[0.08em]"
                  >
                    {t.rules.inactiveBadge}
                  </Badge>
                ) : null}
              </span>
            </AnchorHeading>
            {conflicts[0] ? (
              <p className="mt-0.5 text-xs text-tone-warning-text">
                {conflicts[0].message}
              </p>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="px-3 py-3 text-sm">
          <span className="block truncate">{locationLabel}</span>
        </TableCell>
        <TableCell className="px-3 py-3">
          <div className="flex items-center gap-1.5 justify-end">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.rules.editRuleAriaLabel(rule.pattern)}
              title={t.rules.editRuleTitle}
              onClick={() => openRuleDialog(rule)}
            >
              {icon("fa-pen")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.rules.deleteRuleAriaLabel(rule.pattern)}
              title={t.rules.deleteRuleTitle}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => void handleDeleteRule(key, rule.pattern)}
            >
              {icon("fa-trash")}
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  });
};

export const RulesTable = () => (
  <div id="rules-list">
    <div className="overflow-hidden rounded-md border">
      <Table className="gw-rules-table rule-table w-full table-fixed text-sm">
        <TableHeader>
          <TableRow className="border-b bg-muted/40">
            <TableHead className="w-[3.75rem] min-w-[3.75rem] px-2 py-3 text-left">
              <RulesSelectionHead />
            </TableHead>
            <TableHead className="px-3 py-3 text-left font-semibold">
              {t.rules.tableHeadRule}
            </TableHead>
            <TableHead className="w-[9.5rem] px-3 py-3 text-left font-semibold">
              {t.rules.tableHeadProfile}
            </TableHead>
            <TableHead className="w-[6.5rem] px-3 py-3 text-right font-semibold">
              {t.rules.tableHeadActions}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableSelectionNotice id="rules-selection-count" colSpan={4}>
            <RulesSelectionNotice />
          </TableSelectionNotice>
          <FallbackRuleRow />
          <DomainRuleRows />
        </TableBody>
      </Table>
    </div>
  </div>
);
