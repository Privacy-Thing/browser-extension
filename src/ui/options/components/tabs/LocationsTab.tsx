import { cn } from "@/ui/components/lib/utils";
import { SettingsHelpCard } from "@/ui/components/SettingsHelpCard";
import { SettingsSectionCard } from "@/ui/components/SettingsSectionCard";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";
import { TableSearchInput } from "@/ui/components/ui/table-search-input";
import { TableToolbar } from "@/ui/components/ui/table-toolbar";
import { TabsContent } from "@/ui/components/ui/tabs";
import { t } from "@/ui/i18n";
import { AnchorHeading } from "@/ui/options/components/AnchorHeading";
import {
  PAGE_ANCHORS,
  SECTION_ANCHORS,
  getRulesLocationHref,
} from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";
import { icon } from "@/ui/options/utils";

const LocationCards = () => {
  const {
    profiles,
    profilesSearch,
    profileUsage,
    handleOpenProfileEditor,
    highlightedAnchorId,
    getLocationAnchor,
  } = useSettings();
  const query = profilesSearch.toLowerCase();
  return (
    <div id="profiles-list">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {profiles
          .filter(
            (profile) =>
              profile.label.toLowerCase().includes(query) ||
              profile.timeZone.toLowerCase().includes(query),
          )
          .map((profile, index) => {
            const usageCount = profileUsage.get(profile.id) ?? 0;
            const anchorId = getLocationAnchor(profile.id);
            return (
              <Card
                key={profile.id}
                id={anchorId}
                data-anchor-id={anchorId}
                className={cn(
                  "h-full border-dashed gw-anchor-target gw-anchor-no-pulse scroll-mt-7 transition-[background-color,border-color,box-shadow] duration-150 hover:border-border hover:bg-accent/35 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.38)]",
                  highlightedAnchorId === anchorId && "gw-anchor-highlighted",
                )}
              >
                <CardContent className="pt-4 h-full flex flex-col justify-between gap-3">
                  <div>
                    <AnchorHeading
                      anchorId={anchorId}
                      label={t.common.copyLinkTo(profile.label)}
                      className="gw-anchor-heading-compact"
                    >
                      <h3 className="text-base font-semibold leading-snug">
                        {profile.label}
                      </h3>
                    </AnchorHeading>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {profile.language} • {profile.timeZone}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    {usageCount === 0 ? (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {t.locations.unused}
                      </span>
                    ) : (
                      <Button
                        asChild
                        variant="link"
                        className="h-auto p-0 text-sm font-semibold"
                      >
                        <a
                          href={getRulesLocationHref(profile.id)}
                          aria-label={t.locations.viewAssignedRulesAriaLabel(
                            profile.label,
                            usageCount,
                          )}
                        >
                          {t.locations.assigned(usageCount)}
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenProfileEditor(index)}
                    >
                      {t.common.actions.edit}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
};

const LocationsSidebar = () => {
  const { highlightedAnchorId, navigateToAnchor } = useSettings();
  return (
    <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t.locations.playgroundCard.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {t.locations.playgroundCard.body1}
          </p>
          <p className="text-sm text-muted-foreground">
            {t.locations.playgroundCard.body2}
          </p>
          <Button
            className="w-fit self-center"
            onClick={() =>
              navigateToAnchor(PAGE_ANCHORS.playground, { highlight: false })
            }
          >
            {icon("fa-rocket")}
            {t.common.actions.openPlayground}
          </Button>
        </CardContent>
      </Card>
      <SettingsHelpCard
        anchorId={SECTION_ANCHORS.profiles.help}
        copyLabel={t.common.copyLinkTo(t.locations.copyLinkHelpLabel)}
        title={t.locations.help.title}
        highlighted={highlightedAnchorId === SECTION_ANCHORS.profiles.help}
      >
        <p>{t.locations.help.body1}</p>
        <p>{t.locations.help.body2}</p>
        <p>{t.locations.help.body3}</p>
        <h4 className="mt-1 text-sm font-semibold text-tone-info-text">
          {t.locations.help.privacyTitle}
        </h4>
        <p>{t.locations.help.privacyBody}</p>
        <h4 className="mt-1 text-sm font-semibold text-tone-info-text">
          {t.locations.help.networkTitle}
        </h4>
        <p>
          {t.locations.help.networkBodyPrefix}
          <a
            href={`#${SECTION_ANCHORS.about.limitations}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t.locations.help.networkBodyLinkLabel}
          </a>
          {t.locations.help.networkBodySuffix}
        </p>
      </SettingsHelpCard>
    </div>
  );
};

export const LocationsTab = () => {
  const {
    profilesSearch,
    setProfilesSearch,
    handleAddProfile,
    openGenerator,
    highlightedAnchorId,
  } = useSettings();

  return (
    <TabsContent value="profiles" data-panel="profiles" id={PAGE_ANCHORS.profiles}>
      <div className="grid grid-cols-12 gap-5">
        {/* ── Main content column ── */}
        <div className="col-span-12 lg:col-span-8">
          <SettingsSectionCard
            anchorId={SECTION_ANCHORS.profiles.overview}
            copyLabel={t.common.copyLinkTo(t.locations.copyLinkLabel)}
            title={<h2 className="text-xl font-semibold">{t.locations.title}</h2>}
            description={t.locations.description}
            highlighted={highlightedAnchorId === SECTION_ANCHORS.profiles.overview}
            headerActions={
              <div className="flex items-center gap-2 shrink-0">
                <div className="inline-flex items-stretch">
                  <Button
                    id="open-profile-generator"
                    variant="default"
                    className="shrink-0 rounded-r-none border-r-0"
                    onClick={() => {
                      openGenerator();
                    }}
                  >
                    {icon("fa-wand-magic-sparkles")}
                    {t.locations.generateButton}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        id="open-profile-actions-menu"
                        variant="default"
                        className="rounded-l-none px-2.5"
                        aria-label={t.locations.actionsMenuLabel}
                      >
                        {icon("fa-ellipsis-vertical")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        id="add-profile-manually"
                        onSelect={() => {
                          void handleAddProfile();
                        }}
                      >
                        {t.locations.addManualButton}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            }
          >
            <TableToolbar
              id="profiles-toolbar"
              search={
                <div className="min-w-0 w-full flex-1">
                  <label htmlFor="profiles-search" className="sr-only">
                    {t.locations.searchPlaceholder}
                  </label>
                  <TableSearchInput
                    id="profiles-search"
                    className="w-full"
                    placeholder={t.locations.searchPlaceholder}
                    value={profilesSearch}
                    onChange={(event) => setProfilesSearch(event.currentTarget.value)}
                  />
                </div>
              }
            />

            <LocationCards />
          </SettingsSectionCard>
        </div>

        <LocationsSidebar />
      </div>
    </TabsContent>
  );
};
