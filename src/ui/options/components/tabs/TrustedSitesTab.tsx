import { cn } from "@/ui/components/lib/utils";
import { SettingsHelpCard } from "@/ui/components/SettingsHelpCard";
import { SettingsSectionCard } from "@/ui/components/SettingsSectionCard";
import { Badge } from "@/ui/components/ui/badge";
import { Button } from "@/ui/components/ui/button";
import { Switch } from "@/ui/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/components/ui/table";
import { TableSearchInput } from "@/ui/components/ui/table-search-input";
import { TableToolbar } from "@/ui/components/ui/table-toolbar";
import { TabsContent } from "@/ui/components/ui/tabs";
import { t } from "@/ui/i18n";
import { RuleInspectorCard } from "@/ui/options/components/RuleInspectorCard";
import {
  PAGE_ANCHORS,
  SECTION_ANCHORS,
  getTrustedSiteAnchor,
} from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";
import { icon } from "@/ui/options/utils";

type TrustedSitesRulesCta = {
  title: string;
  description: string;
  actionLabel: string;
  targetAnchorId: string;
};

export const buildRulesCta = ({
  activeRuleCount,
  hasEnabledGlobalFallback,
}: {
  activeRuleCount: number;
  hasEnabledGlobalFallback: boolean;
}): TrustedSitesRulesCta | null => {
  if (activeRuleCount > 0) {
    return {
      title: t.trustedSites.rulesCta.title,
      description: hasEnabledGlobalFallback
        ? t.trustedSites.rulesCta.activeRulesWithDefault(activeRuleCount)
        : t.trustedSites.rulesCta.activeRulesOnly(activeRuleCount),
      actionLabel: t.trustedSites.rulesCta.openRules,
      targetAnchorId: SECTION_ANCHORS.rules.overview,
    };
  }

  if (!hasEnabledGlobalFallback) {
    return null;
  }

  return {
    title: t.trustedSites.rulesCta.title,
    description: t.trustedSites.rulesCta.defaultRuleOnly,
    actionLabel: t.trustedSites.rulesCta.openDefaultRule,
    targetAnchorId: SECTION_ANCHORS.rules.globalFallback,
  };
};

const TrustedSiteTable = () => {
  const {
    filteredTrustedSites,
    handleDeleteTrustedSite,
    handleToggleTrustedSite,
    highlightedAnchorId,
    saveInFlight,
    trustedSitesFilter,
  } = useSettings();
  const hasFilter = trustedSitesFilter.trim().length > 0;
  return (
    <div className="overflow-hidden rounded-md border">
      <Table className="w-full table-fixed text-sm">
        <TableHeader>
          <TableRow className="border-b bg-muted/40">
            <TableHead className="px-3 py-3 text-left font-semibold">
              {t.trustedSites.tableHeadPattern}
            </TableHead>
            <TableHead className="w-[8rem] px-3 py-3 text-left font-semibold">
              {t.trustedSites.tableHeadStatus}
            </TableHead>
            <TableHead className="w-[9rem] px-3 py-3 text-right font-semibold">
              {t.trustedSites.tableHeadActions}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTrustedSites.length > 0 ? (
            filteredTrustedSites.map((site) => {
              const anchor = getTrustedSiteAnchor(site.pattern);
              return (
                <TableRow
                  key={site.pattern}
                  id={anchor}
                  className={cn(
                    "gw-anchor-target gw-anchor-no-pulse scroll-mt-7 border-b last:border-0 hover:bg-muted/30 transition-colors",
                    !site.enabled ? "text-muted-foreground" : undefined,
                    highlightedAnchorId === anchor && "gw-anchor-highlighted",
                  )}
                >
                  <TableCell className="px-3 py-3 align-middle font-medium text-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{site.pattern}</span>
                      {!site.enabled ? (
                        <Badge
                          variant="secondary"
                          className="shrink-0 px-2 py-0 text-[10px] font-semibold uppercase tracking-[0.08em]"
                        >
                          {t.trustedSites.inactiveBadge}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 align-middle">
                    <div className="flex items-center">
                      <Switch
                        checked={site.enabled}
                        disabled={saveInFlight}
                        aria-label={t.trustedSites.toggleSiteAriaLabel(
                          site.pattern,
                          site.enabled,
                        )}
                        onCheckedChange={(enabled) =>
                          void handleToggleTrustedSite(site.pattern, enabled)
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t.trustedSites.deleteSiteAriaLabel(site.pattern)}
                      title={t.trustedSites.deleteSiteTitle}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={saveInFlight}
                      onClick={() => void handleDeleteTrustedSite(site.pattern)}
                    >
                      {icon("fa-trash")}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={3}
                className="px-3 py-8 text-center text-sm text-muted-foreground"
              >
                {hasFilter ? t.trustedSites.filteredEmpty : t.trustedSites.empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const TrustedSitesSidebar = ({
  rulesCta,
}: {
  rulesCta: TrustedSitesRulesCta | null;
}) => {
  const { highlightedAnchorId, navigateToAnchor } = useSettings();
  return (
    <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
      <SettingsHelpCard
        anchorId={SECTION_ANCHORS.trustedSites.help}
        copyLabel={t.common.copyLinkTo(t.trustedSites.copyLinkHelpLabel)}
        title={t.trustedSites.help.title}
        highlighted={highlightedAnchorId === SECTION_ANCHORS.trustedSites.help}
      >
        <p>{t.trustedSites.help.body1}</p>
        <p dangerouslySetInnerHTML={{ __html: t.trustedSites.help.body2 }} />
      </SettingsHelpCard>
      {rulesCta ? (
        <SettingsSectionCard
          title={<h3 className="text-base font-semibold">{rulesCta.title}</h3>}
          description={rulesCta.description}
          headerActions={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                navigateToAnchor(rulesCta.targetAnchorId, { highlight: true })
              }
            >
              {rulesCta.actionLabel}
            </Button>
          }
        />
      ) : null}
      <RuleInspectorCard
        anchorId={SECTION_ANCHORS.trustedSites.inspector}
        copyLabel={t.common.copyLinkTo(t.trustedSites.copyLinkInspectorLabel)}
        highlighted={highlightedAnchorId === SECTION_ANCHORS.trustedSites.inspector}
        inputId="trusted-sites-preview-hostname"
      />
    </div>
  );
};

export const TrustedSitesTab = () => {
  const {
    rules,
    globalFallbackRule,
    trustedSitesFilter,
    setTrustedSitesFilter,
    openTrustedSiteDialog,
    highlightedAnchorId,
  } = useSettings();

  const hasFilter = trustedSitesFilter.trim().length > 0;
  const rulesCta = buildRulesCta({
    activeRuleCount: rules.filter((rule) => rule.enabled).length,
    hasEnabledGlobalFallback: globalFallbackRule?.enabled === true,
  });

  return (
    <TabsContent
      value="trusted-sites"
      data-panel="trusted-sites"
      id={PAGE_ANCHORS["trusted-sites"]}
    >
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <SettingsSectionCard
            anchorId={SECTION_ANCHORS.trustedSites.overview}
            copyLabel={t.common.copyLinkTo(t.trustedSites.copyLinkLabel)}
            title={<h2 className="text-xl font-semibold">{t.trustedSites.title}</h2>}
            description={<p>{t.trustedSites.hint}</p>}
            highlighted={highlightedAnchorId === SECTION_ANCHORS.trustedSites.overview}
            headerActions={
              <Button
                id="open-trusted-site-dialog"
                className="shrink-0"
                onClick={openTrustedSiteDialog}
              >
                {icon("fa-plus")}
                {t.trustedSites.addButton}
              </Button>
            }
          >
            <TableToolbar
              id="trusted-sites-toolbar"
              search={
                <div className="min-w-0 flex-1">
                  <label htmlFor="trusted-sites-filter" className="sr-only">
                    {t.trustedSites.filterLabel}
                  </label>
                  <TableSearchInput
                    id="trusted-sites-filter"
                    name="trustedSitesFilter"
                    placeholder={t.trustedSites.filterPlaceholder}
                    value={trustedSitesFilter}
                    onChange={(event) =>
                      setTrustedSitesFilter(event.currentTarget.value)
                    }
                  />
                </div>
              }
              actions={
                hasFilter ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => setTrustedSitesFilter("")}
                  >
                    {t.common.actions.clear}
                  </Button>
                ) : undefined
              }
            />

            <TrustedSiteTable />
          </SettingsSectionCard>
        </div>

        <TrustedSitesSidebar rulesCta={rulesCta} />
      </div>
    </TabsContent>
  );
};
