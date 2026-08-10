import { type ReactNode, useMemo } from "react";

import { SettingsEmptyState } from "@/ui/components/SettingsEmptyState";
import { SettingsHelpCard } from "@/ui/components/SettingsHelpCard";
import { SettingsSectionCard } from "@/ui/components/SettingsSectionCard";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Combobox } from "@/ui/components/ui/combobox";
import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";
import { Separator } from "@/ui/components/ui/separator";
import { Switch } from "@/ui/components/ui/switch";
import { TabsContent } from "@/ui/components/ui/tabs";
import { t } from "@/ui/i18n";
import { LazyProfileDraftMap } from "@/ui/options/components/map/LazyProfileDraftMap";
import { ComparisonCards } from "@/ui/options/components/playground/PlaygroundComparisonCards";
import type { SystemGeoStatus } from "@/ui/options/components/playground/PlaygroundComparisonCards";
import { usePlaygroundState } from "@/ui/options/components/playground/usePlaygroundState";
import { PAGE_ANCHORS } from "@/ui/options/navigation";
import { icon } from "@/ui/options/utils";

type PlaygroundState = ReturnType<typeof usePlaygroundState>;

const formatMsRange = (minMs: number, maxMs: number): string =>
  `${Math.round(minMs)}-${Math.round(maxMs)} ms`;

const formatSecondsRange = (minSeconds: number, maxSeconds: number): string => {
  const format = (value: number): string =>
    Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${format(minSeconds)}-${format(maxSeconds)} s`;
};

const getRealLocationUi = (
  systemGeoStatus: SystemGeoStatus,
  hasNativeGeolocation: boolean,
) => {
  if (!hasNativeGeolocation) {
    return {
      title: t.demo.locationPreview.realLocationTitleUnavailable,
      description: t.demo.locationPreview.realLocationUnavailable,
      buttonLabel: t.demo.requestRealLocation,
      disabled: true,
      variant: "outline" as const,
    };
  }

  if (systemGeoStatus === "loading") {
    return {
      title: t.demo.locationPreview.realLocationTitleLoading,
      description: t.demo.locationPreview.realLocationDescription,
      buttonLabel: t.demo.waitingForPermission,
      disabled: true,
      variant: "default" as const,
    };
  }

  if (systemGeoStatus === "granted") {
    return {
      title: t.demo.locationPreview.realLocationTitleGranted,
      description: t.demo.locationPreview.realLocationGrantedDescription,
      buttonLabel: t.demo.locationPreview.realLocationRefresh,
      disabled: false,
      variant: "secondary" as const,
    };
  }

  if (systemGeoStatus === "denied") {
    return {
      title: t.demo.locationPreview.realLocationTitleDenied,
      description: t.demo.locationPreview.realLocationDeniedDescription,
      buttonLabel: t.demo.locationPreview.realLocationRefresh,
      disabled: false,
      variant: "outline" as const,
    };
  }

  return {
    title: t.demo.locationPreview.realLocationTitleIdle,
    description: t.demo.locationPreview.realLocationDescription,
    buttonLabel: t.demo.requestRealLocation,
    disabled: false,
    variant: "default" as const,
  };
};

const getSnapshotRangeCenter = (
  snapshot: PlaygroundState["snapshot"],
): { rangeCenter: { latitude: number; longitude: number } } | undefined => {
  if (!snapshot) {
    return undefined;
  }

  return {
    rangeCenter: {
      latitude: snapshot.geo.latitude,
      longitude: snapshot.geo.longitude,
    },
  };
};

const ComparisonRow = ({
  label,
  value,
  mono = true,
  trailing,
}: {
  label: string;
  value: string;
  mono?: boolean;
  trailing?: ReactNode;
}) => (
  <div className="flex flex-col gap-1 py-2.5 border-b border-border last:border-0">
    <div className="block text-[0.78rem] text-muted-foreground font-mono break-words [overflow-wrap:anywhere]">
      {label}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div
        className={[
          "text-[0.88rem] font-medium break-words text-foreground",
          mono ? "font-mono text-[0.82rem]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  </div>
);

const PlaygroundLoading = () => (
  <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
    <div className="text-muted-foreground">{t.demo.loadingSettings}</div>
  </div>
);

const PlaygroundTabEmptyState = ({
  openSettings,
}: Pick<PlaygroundState, "openSettings">) => (
  <div className="flex flex-col items-center justify-center p-12 bg-card rounded-[20px] border border-border text-center">
    <div className="font-semibold mb-2">{t.demo.noLocationsTitle}</div>
    <div className="text-sm text-muted-foreground mb-4">{t.demo.noLocationsBody}</div>
    <Button variant="secondary" onClick={openSettings}>
      {t.demo.openSettingsButton}
    </Button>
  </div>
);

const PlaygroundMapSection = ({
  selectedLocation,
  tracePoints,
  handleClearTrace,
  mapDraft,
  mapRadius,
  osmConsent,
  snapshot,
  requestOsmConsent,
}: Pick<
  PlaygroundState,
  | "selectedLocation"
  | "tracePoints"
  | "handleClearTrace"
  | "mapDraft"
  | "mapRadius"
  | "osmConsent"
  | "snapshot"
  | "requestOsmConsent"
>) => {
  const rangeCenterProps = getSnapshotRangeCenter(snapshot);

  return (
    <SettingsSectionCard
      title={<h3 className="text-base font-semibold">{t.demo.map.title}</h3>}
      contentClassName="gap-4"
      headerActions={
        selectedLocation ? (
          <Button
            size="sm"
            variant="outline"
            disabled={tracePoints.length === 0}
            onClick={handleClearTrace}
          >
            {t.demo.map.clearButton}
          </Button>
        ) : null
      }
    >
      <div className="relative h-[350px] overflow-hidden rounded-2xl border border-border/70 bg-muted/10">
        {!selectedLocation ? (
          <SettingsEmptyState
            centered
            variant="muted"
            className="flex h-full flex-col justify-center rounded-none border-0 bg-muted/20 px-6"
            title={t.demo.map.noLocationTitle}
            description={t.demo.map.noLocationDescription}
          />
        ) : (
          <LazyProfileDraftMap
            draft={mapDraft}
            opened
            onMove={() => {}}
            accuracyRadius={mapRadius}
            enabled={osmConsent === "granted"}
            readOnly
            readOnlyViewportMode="follow-marker"
            tracePoints={tracePoints}
            rangeRadius={snapshot?.geo.noiseRadius ?? 0}
            {...rangeCenterProps}
            placeholder={
              <div className="flex flex-col items-center justify-center gap-3 h-full p-4 text-center bg-card/50">
                <p className="font-semibold text-sm">{t.demo.map.osmRequired}</p>
                <p className="text-xs text-muted-foreground">
                  {t.demo.map.osmRequiredDescription}
                </p>
                <Button variant="secondary" size="sm" onClick={requestOsmConsent}>
                  {t.common.actions.allowOpenStreetMap}
                </Button>
              </div>
            }
          />
        )}
      </div>
    </SettingsSectionCard>
  );
};

const PlaygroundSelector = ({
  locations,
  selectedLocationId,
  handleSelectLocation,
}: Pick<
  PlaygroundState,
  "locations" | "selectedLocationId" | "handleSelectLocation"
>) => {
  const options = useMemo(
    () => locations.map((location) => ({ value: location.id, label: location.label })),
    [locations],
  );
  return (
    <div className="flex flex-col gap-1.5 mb-2">
      <Label id="demo-active-location-label">
        {t.demo.locationPreview.activeLocationLabel}
      </Label>
      <p
        id="demo-active-location-description"
        className="text-xs text-muted-foreground mb-1"
      >
        {t.demo.locationPreview.activeLocationDescription}
      </p>
      <Combobox
        options={options}
        value={selectedLocationId ?? ""}
        aria-labelledby="demo-active-location-label"
        aria-describedby="demo-active-location-description"
        onValueChange={(value) => handleSelectLocation(value || null)}
        searchPlaceholder={t.demo.locationPreview.activeLocationPlaceholder}
      />
    </div>
  );
};

const PlaygroundTiming = ({
  effectiveTimingSummary,
  handleRequestSystemGeo,
  hasNativeGeolocation,
  selectedLocation,
  setUseDemoInterval,
  systemGeoStatus,
  useDemoInterval,
}: Pick<
  PlaygroundState,
  | "effectiveTimingSummary"
  | "handleRequestSystemGeo"
  | "hasNativeGeolocation"
  | "selectedLocation"
  | "setUseDemoInterval"
  | "systemGeoStatus"
  | "useDemoInterval"
>) => {
  if (!selectedLocation || !effectiveTimingSummary) return null;
  const locationUi = getRealLocationUi(systemGeoStatus, hasNativeGeolocation);
  return (
    <div className="flex flex-col gap-4 mt-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{locationUi.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {locationUi.description}
            </p>
          </div>
          <Button
            size="sm"
            variant={locationUi.variant}
            className="w-fit shrink-0"
            onClick={handleRequestSystemGeo}
            disabled={locationUi.disabled}
          >
            {icon("fa-location-dot", "mr-2")}
            <span>{locationUi.buttonLabel}</span>
          </Button>
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ComparisonRow
          label={t.demo.locationPreview.playgroundCadenceLabel}
          value={formatSecondsRange(...effectiveTimingSummary.runtimeIntervalSeconds)}
          trailing={
            <div className="flex items-center gap-2">
              <Switch
                id="demo-interval-switch"
                checked={useDemoInterval}
                onCheckedChange={setUseDemoInterval}
              />
              <Label
                htmlFor="demo-interval-switch"
                className="text-xs text-muted-foreground"
              >
                {t.demo.map.demoIntervalLabel}
              </Label>
            </div>
          }
        />
        <ComparisonRow
          label={t.demo.locationPreview.realSiteCadenceLabel}
          value={formatSecondsRange(...effectiveTimingSummary.liveSiteIntervalSeconds)}
        />
        <ComparisonRow
          label={t.demo.locationPreview.configuredDelayLabel}
          value={formatSecondsRange(...effectiveTimingSummary.watchDelaySeconds)}
        />
        <ComparisonRow
          label={t.demo.locationPreview.callbackDelayLabel}
          value={formatMsRange(...effectiveTimingSummary.callbackDelayMs)}
        />
        <ComparisonRow
          label={t.demo.locationPreview.runtimeModeLabel}
          value={t.demo.locationPreview.runtimeModeSimple}
          mono={false}
        />
      </div>
    </div>
  );
};

const PlaygroundMain = (state: PlaygroundState) => {
  const {
    selectedLocation,
    localFingerprint,
    runtime,
    spoofedGeo,
    systemGeoStatus,
    systemGeo,
    systemValues,
  } = state;
  return (
    <div className="lg:col-span-8 flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.demo.locationPreview.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          <PlaygroundSelector {...state} />
          <PlaygroundTiming {...state} />
        </CardContent>
      </Card>

      <ComparisonCards
        runtime={runtime}
        selectedLocationLabel={selectedLocation?.label ?? null}
        systemValues={systemValues}
        localFingerprint={localFingerprint}
        spoofedGeo={spoofedGeo}
        systemGeoStatus={systemGeoStatus}
        systemGeo={systemGeo}
      />
    </div>
  );
};

const PlaygroundSidebar = (state: PlaygroundState) => {
  const {
    selectedLocation,
    tracePoints,
    handleClearTrace,
    mapDraft,
    mapRadius,
    previewSeedInput,
    osmConsent,
    snapshot,
    handlePreviewSeedChange,
    randomizePreviewSeed,
    requestOsmConsent,
  } = state;
  return (
    <div className="lg:col-span-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100dvh-1.5rem)] lg:overflow-y-auto lg:pr-1 flex flex-col gap-6">
      <SettingsHelpCard
        title={t.demo.howItWorks.title}
        collapsible
        defaultOpen={false}
        contentClassName="max-h-[18rem] overflow-y-auto pr-2"
      >
        <p dangerouslySetInnerHTML={{ __html: t.demo.howItWorks.body1 }} />
        <p dangerouslySetInnerHTML={{ __html: t.demo.howItWorks.body2 }} />
        <p dangerouslySetInnerHTML={{ __html: t.demo.howItWorks.body3 }} />
        <p>{t.demo.howItWorks.body4}</p>
      </SettingsHelpCard>

      <SettingsSectionCard
        title={<h3 className="text-base font-semibold">{t.demo.previewSeed.title}</h3>}
        description={t.demo.previewSeed.description}
        contentClassName="gap-3"
      >
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              id="playground-preview-seed"
              value={previewSeedInput}
              onChange={(event) => handlePreviewSeedChange(event.target.value)}
              aria-label={t.demo.previewSeed.inputAriaLabel}
              placeholder={t.demo.previewSeed.placeholder}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={6}
              className="font-mono"
            />
            <Button type="button" variant="outline" onClick={randomizePreviewSeed}>
              {icon("fa-shuffle", "mr-2")}
              <span>{t.demo.previewSeed.randomize}</span>
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t.demo.previewSeed.hint}
          </p>
        </div>
      </SettingsSectionCard>

      <PlaygroundMapSection
        selectedLocation={selectedLocation}
        tracePoints={tracePoints}
        handleClearTrace={handleClearTrace}
        mapDraft={mapDraft}
        mapRadius={mapRadius}
        osmConsent={osmConsent}
        snapshot={snapshot}
        requestOsmConsent={requestOsmConsent}
      />
    </div>
  );
};

const PlaygroundTabLoadedState = (state: PlaygroundState) => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <PlaygroundMain {...state} />
    <PlaygroundSidebar {...state} />
  </div>
);

export const PlaygroundTab = () => {
  const state = usePlaygroundState();

  let content: ReactNode;

  if (!state.loaded) {
    content = <PlaygroundLoading />;
  } else if (state.locations.length === 0) {
    content = <PlaygroundTabEmptyState openSettings={state.openSettings} />;
  } else {
    content = <PlaygroundTabLoadedState {...state} />;
  }

  return (
    <TabsContent
      value="playground"
      data-panel="playground"
      id={PAGE_ANCHORS.playground}
    >
      <div
        className="bg-tone-warning-bg text-tone-warning-text border border-tone-warning-border rounded-xl p-4 text-sm leading-relaxed mb-6"
        role="note"
      >
        <strong className="block mb-1 text-[0.85rem] uppercase tracking-wide opacity-80">
          {t.demo.disclaimer.title}
        </strong>
        <span dangerouslySetInnerHTML={{ __html: t.demo.disclaimer.body }} />
      </div>

      {content}
    </TabsContent>
  );
};
