import React from "react";

import { cn } from "@/ui/components/lib/utils";
import {
  getSettingDescriptionId,
  getSettingTitleId,
} from "@/ui/components/settings-control-metadata";
import { SettingsControlCard } from "@/ui/components/SettingsControlCard";
import { SettingsHelpCard } from "@/ui/components/SettingsHelpCard";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent } from "@/ui/components/ui/card";
import { Switch } from "@/ui/components/ui/switch";
import { TabsContent } from "@/ui/components/ui/tabs";
import { t } from "@/ui/i18n";
import { AnchorHeading } from "@/ui/options/components/AnchorHeading";
import {
  PAGE_ANCHORS,
  SECTION_ANCHORS,
  SETTING_ANCHORS,
} from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";
import { icon } from "@/ui/options/utils";

const LazyLogsSubpage = React.lazy(async () => {
  const module = await import("@/ui/options/components/subpages/LogsSubpage");
  return { default: module.LogsSubpage };
});

const settingTitle = (text: string) => (
  <h3 className="text-sm font-semibold">{text}</h3>
);

const RuntimeCard = () => {
  const {
    debugMode,
    setDebugMode,
    settingsLoaded,
    scheduleAutosave,
    highlightedAnchorId,
  } = useSettings();
  return (
    <Card
      id={SECTION_ANCHORS.advanced.runtime}
      data-anchor-id={SECTION_ANCHORS.advanced.runtime}
      className={cn(
        "gw-anchor-target scroll-mt-7",
        highlightedAnchorId === SECTION_ANCHORS.advanced.runtime &&
          "gw-anchor-highlighted",
      )}
    >
      <CardContent className="pt-6 flex flex-col gap-6">
        <div>
          <AnchorHeading
            anchorId={SECTION_ANCHORS.advanced.runtime}
            label={t.common.copyLinkTo(t.advanced.copyLinkRuntimeLabel)}
          >
            <h2 className="text-xl font-semibold">{t.advanced.runtimeTitle}</h2>
          </AnchorHeading>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.advanced.runtimeDescription}
          </p>
        </div>
        <SettingsControlCard
          anchorId={SETTING_ANCHORS.advanced.debugMode}
          copyLabel={t.common.copyLinkTo(t.advanced.debugMode.copyLinkLabel)}
          title={settingTitle(t.advanced.debugMode.title)}
          description={t.advanced.debugMode.description}
          focusControlOnTitleClick
          highlighted={highlightedAnchorId === SETTING_ANCHORS.advanced.debugMode}
          action={
            <Switch
              aria-labelledby={getSettingTitleId(SETTING_ANCHORS.advanced.debugMode)}
              aria-describedby={getSettingDescriptionId(
                SETTING_ANCHORS.advanced.debugMode,
              )}
              checked={debugMode}
              disabled={!settingsLoaded}
              onCheckedChange={(checked) => {
                setDebugMode(checked);
                scheduleAutosave({ debugMode: checked });
              }}
            />
          }
        />
      </CardContent>
    </Card>
  );
};

const ExperimentalCard = () => {
  const {
    featureFlags,
    highlightedAnchorId,
    scheduleAutosave,
    setFeatureFlags,
    settingsLoaded,
  } = useSettings();
  return (
    <Card
      id={SECTION_ANCHORS.advanced.experimental}
      data-anchor-id={SECTION_ANCHORS.advanced.experimental}
      className={cn(
        "gw-anchor-target scroll-mt-7",
        highlightedAnchorId === SECTION_ANCHORS.advanced.experimental &&
          "gw-anchor-highlighted",
      )}
    >
      <CardContent className="pt-6 flex flex-col gap-6">
        <div>
          <AnchorHeading
            anchorId={SECTION_ANCHORS.advanced.experimental}
            label={t.common.copyLinkTo(t.advanced.experimental.copyLinkLabel)}
          >
            <h2 className="text-xl font-semibold">{t.advanced.experimental.title}</h2>
          </AnchorHeading>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.advanced.experimental.description}
          </p>
        </div>
        <SettingsControlCard
          anchorId={SETTING_ANCHORS.advanced.temporalApi}
          copyLabel={t.common.copyLinkTo(
            t.advanced.experimental.temporalApi.copyLinkLabel,
          )}
          title={settingTitle(t.advanced.experimental.temporalApi.title)}
          description={t.advanced.experimental.temporalApi.description}
          focusControlOnTitleClick
          highlighted={highlightedAnchorId === SETTING_ANCHORS.advanced.temporalApi}
          action={
            <Switch
              aria-labelledby={getSettingTitleId(SETTING_ANCHORS.advanced.temporalApi)}
              aria-describedby={getSettingDescriptionId(
                SETTING_ANCHORS.advanced.temporalApi,
              )}
              checked={featureFlags.temporalApi}
              disabled={!settingsLoaded}
              onCheckedChange={(checked) => {
                const next = { ...featureFlags, temporalApi: checked };
                setFeatureFlags(next);
                scheduleAutosave({ featureFlags: { temporalApi: checked } });
              }}
            />
          }
        />
      </CardContent>
    </Card>
  );
};

const PanicControl = () => {
  const { panicMode, handleSetPanicMode, highlightedAnchorId } = useSettings();
  return (
    <SettingsControlCard
      anchorId={SETTING_ANCHORS.advanced.panicMode}
      copyLabel={t.common.copyLinkTo(t.advanced.danger.spoofing.copyLinkLabel)}
      title={settingTitle(t.advanced.danger.spoofing.title)}
      description={t.advanced.danger.spoofing.description}
      focusControlOnTitleClick
      highlighted={highlightedAnchorId === SETTING_ANCHORS.advanced.panicMode}
      action={
        <Switch
          id="panic-toggle"
          aria-labelledby={getSettingTitleId(SETTING_ANCHORS.advanced.panicMode)}
          aria-describedby={getSettingDescriptionId(SETTING_ANCHORS.advanced.panicMode)}
          checked={panicMode}
          onCheckedChange={(checked) => void handleSetPanicMode(checked)}
        />
      }
    />
  );
};

const ExportControl = () => {
  const { handleExportSettings, highlightedAnchorId } = useSettings();
  return (
    <SettingsControlCard
      anchorId={SETTING_ANCHORS.advanced.exportSettings}
      copyLabel={t.common.copyLinkTo(t.advanced.danger.export.copyLinkLabel)}
      title={settingTitle(t.advanced.danger.export.title)}
      description={t.advanced.danger.export.description}
      highlighted={highlightedAnchorId === SETTING_ANCHORS.advanced.exportSettings}
      action={
        <Button
          id="export-settings"
          variant="outline"
          className="shrink-0"
          onClick={() => void handleExportSettings()}
        >
          {icon("fa-file-export")}
          {t.advanced.danger.export.button}
        </Button>
      }
    />
  );
};

const ImportControl = () => {
  const { importSettingsRef, handleImportSettings, highlightedAnchorId } =
    useSettings();
  return (
    <SettingsControlCard
      anchorId={SETTING_ANCHORS.advanced.importSettings}
      copyLabel={t.common.copyLinkTo(t.advanced.danger.import.copyLinkLabel)}
      title={settingTitle(t.advanced.danger.import.title)}
      description={t.advanced.danger.import.description}
      highlighted={highlightedAnchorId === SETTING_ANCHORS.advanced.importSettings}
      action={
        <>
          <input
            id="import-settings-file"
            ref={importSettingsRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => void handleImportSettings(event)}
          />
          <Button
            id="import-settings"
            variant="outline"
            className="shrink-0"
            onClick={() => importSettingsRef.current?.click()}
          >
            {icon("fa-file-import")}
            {t.advanced.danger.import.button}
          </Button>
        </>
      }
    />
  );
};

const ReloadControl = () => {
  const { handleReloadSettings, highlightedAnchorId, saveInFlight } = useSettings();
  return (
    <SettingsControlCard
      anchorId={SETTING_ANCHORS.advanced.reloadSettings}
      copyLabel={t.common.copyLinkTo(t.advanced.danger.reload.copyLinkLabel)}
      title={settingTitle(t.advanced.danger.reload.title)}
      description={t.advanced.danger.reload.description}
      highlighted={highlightedAnchorId === SETTING_ANCHORS.advanced.reloadSettings}
      action={
        <Button
          id="reload-settings"
          variant="outline"
          className="shrink-0"
          onClick={() => void handleReloadSettings()}
          disabled={saveInFlight}
        >
          {icon("fa-rotate-right")}
          {t.advanced.danger.reload.button}
        </Button>
      }
    />
  );
};

const ResetControl = () => {
  const { requestResetSettings, highlightedAnchorId, saveInFlight } = useSettings();
  return (
    <SettingsControlCard
      anchorId={SETTING_ANCHORS.advanced.resetSettings}
      copyLabel={t.common.copyLinkTo(t.advanced.danger.reset.copyLinkLabel)}
      title={settingTitle(t.advanced.danger.reset.title)}
      description={t.advanced.danger.reset.description}
      highlighted={highlightedAnchorId === SETTING_ANCHORS.advanced.resetSettings}
      action={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            id="reset-settings"
            variant="destructive-outline"
            className="shrink-0"
            onClick={() => void requestResetSettings()}
            disabled={saveInFlight}
          >
            {icon("fa-rotate-left")}
            {t.advanced.danger.reset.button}
          </Button>
        </div>
      }
    />
  );
};

const DangerCard = () => {
  const { highlightedAnchorId } = useSettings();
  return (
    <Card
      id={SECTION_ANCHORS.advanced.danger}
      data-anchor-id={SECTION_ANCHORS.advanced.danger}
      className={cn(
        "gw-anchor-target scroll-mt-7",
        highlightedAnchorId === SECTION_ANCHORS.advanced.danger &&
          "gw-anchor-highlighted",
      )}
    >
      <CardContent className="pt-6 flex flex-col gap-6">
        <div>
          <AnchorHeading
            anchorId={SECTION_ANCHORS.advanced.danger}
            label={t.common.copyLinkTo(t.advanced.danger.copyLinkLabel)}
          >
            <h2 className="text-xl font-semibold">{t.advanced.danger.title}</h2>
          </AnchorHeading>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.advanced.danger.description}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <PanicControl />
          <ExportControl />
          <ImportControl />
          <ReloadControl />
          <ResetControl />
        </div>
      </CardContent>
    </Card>
  );
};

const AdvancedOverview = () => {
  const { highlightedAnchorId } = useSettings();
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-5">
        <RuntimeCard />
        <ExperimentalCard />
        <DangerCard />
      </div>
      <div className="col-span-12 lg:col-span-4">
        <SettingsHelpCard
          anchorId={SECTION_ANCHORS.advanced.help}
          copyLabel={t.common.copyLinkTo(t.advanced.copyLinkHelpLabel)}
          title={t.advanced.help.title}
          highlighted={highlightedAnchorId === SECTION_ANCHORS.advanced.help}
        >
          <p>{t.advanced.help.body1}</p>
          <p>{t.advanced.help.body2}</p>
        </SettingsHelpCard>
      </div>
    </div>
  );
};

export const AdvancedTab = () => {
  const { logsHostFilter, settingsSubpageView } = useSettings();
  return (
    <TabsContent value="advanced" data-panel="advanced" id={PAGE_ANCHORS.advanced}>
      {settingsSubpageView === "logs" ? (
        <React.Suspense fallback={null}>
          <LazyLogsSubpage initialHostFilter={logsHostFilter} />
        </React.Suspense>
      ) : (
        <AdvancedOverview />
      )}
    </TabsContent>
  );
};
