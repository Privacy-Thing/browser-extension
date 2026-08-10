import { SettingsHelpCard } from "@/ui/components/SettingsHelpCard";
import { SettingsSectionCard } from "@/ui/components/SettingsSectionCard";
import { Button } from "@/ui/components/ui/button";
import { Combobox } from "@/ui/components/ui/combobox";
import { TableSearchInput } from "@/ui/components/ui/table-search-input";
import { TableToolbar } from "@/ui/components/ui/table-toolbar";
import { TabsContent } from "@/ui/components/ui/tabs";
import { t } from "@/ui/i18n";
import { RuleInspectorCard } from "@/ui/options/components/RuleInspectorCard";
import { RulesTable } from "@/ui/options/components/tabs/RulesTable";
import { PAGE_ANCHORS, SECTION_ANCHORS } from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";
import { icon } from "@/ui/options/utils";

const RulesToolbar = () => {
  const {
    linkedRuleLocationId,
    ruleProfileOptions,
    rulesFilter,
    setRuleLocationFilter,
    setRulesFilter,
  } = useSettings();
  const hasFilters = Boolean(linkedRuleLocationId || rulesFilter.trim());
  return (
    <TableToolbar
      id="rules-toolbar"
      search={
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <label htmlFor="rules-filter" className="sr-only">
              {t.rules.filterLabel}
            </label>
            <TableSearchInput
              id="rules-filter"
              name="rulesFilter"
              placeholder={t.rules.filterPlaceholder}
              value={rulesFilter}
              onChange={(event) => setRulesFilter(event.currentTarget.value)}
            />
          </div>
          <div
            className="w-full shrink-0 md:w-48"
            data-location-filter={linkedRuleLocationId ? "set" : "all"}
          >
            <label htmlFor="rules-location-filter" className="sr-only">
              {t.rules.locationFilterLabel}
            </label>
            <Combobox
              options={ruleProfileOptions}
              value={linkedRuleLocationId ?? ""}
              id="rules-location-filter"
              ariaLabel={t.rules.locationFilterLabel}
              placeholder={t.rules.locationFilterPlaceholder}
              searchPlaceholder={t.rules.dialog.bulkAssignSearchPlaceholder}
              emptyMessage="No locations found."
              className="w-full"
              onValueChange={(locationId) => setRuleLocationFilter(locationId || null)}
            />
          </div>
        </div>
      }
      actions={
        hasFilters ? (
          <Button
            id="clear-rules-toolbar-filters"
            type="button"
            variant="ghost"
            className="shrink-0"
            onClick={() => {
              setRulesFilter("");
              setRuleLocationFilter(null);
            }}
          >
            {t.common.actions.clear}
          </Button>
        ) : undefined
      }
    />
  );
};

const RulesSidebar = () => {
  const { highlightedAnchorId } = useSettings();
  return (
    <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
      <SettingsHelpCard
        anchorId={SECTION_ANCHORS.rules.help}
        copyLabel={t.common.copyLinkTo(t.rules.copyLinkHelpLabel)}
        title={t.rules.help.title}
        highlighted={highlightedAnchorId === SECTION_ANCHORS.rules.help}
      >
        <p>
          <span dangerouslySetInnerHTML={{ __html: t.rules.help.body1 }} />
        </p>
        <p>{t.rules.help.body2}</p>
      </SettingsHelpCard>
      <RuleInspectorCard
        anchorId={SECTION_ANCHORS.rules.inspector}
        copyLabel={t.common.copyLinkTo(t.rules.copyLinkInspectorLabel)}
        highlighted={highlightedAnchorId === SECTION_ANCHORS.rules.inspector}
        inputId="rules-preview-hostname"
      />
    </div>
  );
};

export const RulesTab = () => {
  const { highlightedAnchorId, openRuleDialog } = useSettings();
  return (
    <TabsContent value="rules" data-panel="rules" id={PAGE_ANCHORS.rules}>
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <SettingsSectionCard
            anchorId={SECTION_ANCHORS.rules.overview}
            copyLabel={t.common.copyLinkTo(t.rules.copyLinkLabel)}
            title={<h2 className="text-xl font-semibold">{t.rules.title}</h2>}
            description={<p id="rules-hint">{t.rules.hint}</p>}
            highlighted={highlightedAnchorId === SECTION_ANCHORS.rules.overview}
            headerActions={
              <Button
                id="open-rule-dialog"
                className="shrink-0"
                onClick={() => openRuleDialog()}
              >
                {icon("fa-plus")}
                {t.rules.addButton}
              </Button>
            }
          >
            <RulesToolbar />
            <RulesTable />
          </SettingsSectionCard>
        </div>
        <RulesSidebar />
      </div>
    </TabsContent>
  );
};
