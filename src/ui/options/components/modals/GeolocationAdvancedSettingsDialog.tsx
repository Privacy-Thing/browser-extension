import { type ReactNode, useEffect, useState } from "react";

import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { MAX_RANDOM_RADIUS_KM, MIN_RANDOM_RADIUS_KM } from "@/shared/settings-defaults";
import { cn } from "@/ui/components/lib/utils";
import {
  getSettingDescriptionId,
  getSettingTitleId,
} from "@/ui/components/settings-control-metadata";
import { Button } from "@/ui/components/ui/button";
import { FormDialogShell } from "@/ui/components/ui/form-dialog-shell";
import { Input } from "@/ui/components/ui/input";
import { Slider } from "@/ui/components/ui/slider";
import { Switch } from "@/ui/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";
import { t } from "@/ui/i18n";
import { AnchorHeading } from "@/ui/options/components/AnchorHeading";
import { SETTING_ANCHORS } from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";

type GeoSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type GeoSettingsAnchor =
  | typeof SETTING_ANCHORS.advanced.defaultNoiseRadius
  | typeof SETTING_ANCHORS.advanced.randomizeGeneratedLocationByDefault
  | typeof SETTING_ANCHORS.advanced.generatedLocationRandomizationRadius
  | typeof SETTING_ANCHORS.advanced.watchPositionDelay;

export const isGeoSettingsAnchor = (
  anchorId: string | null,
): anchorId is GeoSettingsAnchor =>
  anchorId === SETTING_ANCHORS.advanced.defaultNoiseRadius ||
  anchorId === SETTING_ANCHORS.advanced.randomizeGeneratedLocationByDefault ||
  anchorId === SETTING_ANCHORS.advanced.generatedLocationRandomizationRadius ||
  anchorId === SETTING_ANCHORS.advanced.watchPositionDelay;

type DialogSliderRowProps = {
  anchorId: GeoSettingsAnchor;
  copyLabel: string;
  title: string;
  description: ReactNode;
  highlighted: boolean;
  children: ReactNode;
};

const DialogSliderRow = ({
  anchorId,
  copyLabel,
  title,
  description,
  highlighted,
  children,
}: DialogSliderRowProps) => (
  <div
    id={anchorId}
    data-anchor-id={anchorId}
    className={cn(
      "gw-anchor-target scroll-mt-6 rounded-lg p-2",
      highlighted && "gw-anchor-highlighted",
    )}
  >
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] md:items-start">
      <div className="min-w-0">
        <AnchorHeading anchorId={anchorId} label={copyLabel}>
          <h3 className="text-sm font-semibold">{title}</h3>
        </AnchorHeading>
        <div
          id={getSettingDescriptionId(anchorId)}
          className="mt-1 text-sm leading-relaxed text-muted-foreground"
        >
          {description}
        </div>
      </div>
      <div className="min-w-0 md:pt-0.5">{children}</div>
    </div>
  </div>
);

const DialogControlRow = ({
  anchorId,
  copyLabel,
  title,
  description,
  highlighted,
  children,
}: DialogSliderRowProps) => (
  <div
    id={anchorId}
    data-anchor-id={anchorId}
    className={cn(
      "gw-anchor-target scroll-mt-6 rounded-lg p-2",
      highlighted && "gw-anchor-highlighted",
    )}
  >
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <AnchorHeading anchorId={anchorId} label={copyLabel}>
          <h3 className="text-sm font-semibold">{title}</h3>
        </AnchorHeading>
      </div>
      <div className="min-w-0 md:justify-self-end">{children}</div>
      <div
        id={getSettingDescriptionId(anchorId)}
        className="text-sm leading-relaxed text-muted-foreground md:col-span-2"
      >
        {description}
      </div>
    </div>
  </div>
);

const RandomizationTooltip = () => (
  <TooltipProvider delayDuration={150}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {t.advanced.generatedLocationRandomization.enabled.readWhy}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-80 px-3 py-2 text-xs leading-relaxed">
        <p>{t.advanced.generatedLocationRandomization.enabled.tooltipPrivacy}</p>
        <p className="mt-2">
          {t.advanced.generatedLocationRandomization.enabled.tooltipExact}
        </p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const clampRadiusKm = (value: number): number =>
  Math.min(Math.max(value, MIN_RANDOM_RADIUS_KM), MAX_RANDOM_RADIUS_KM);

const RandomizeControl = () => {
  const {
    randomizeGeneratedLocationByDefault: value,
    setRandomizeDefault,
    settingsLoaded,
    scheduleAutosave,
    highlightedAnchorId,
  } = useSettings();
  const anchor = SETTING_ANCHORS.advanced.randomizeGeneratedLocationByDefault;
  return (
    <DialogControlRow
      anchorId={anchor}
      copyLabel={t.common.copyLinkTo(
        t.advanced.generatedLocationRandomization.enabled.copyLinkLabel,
      )}
      title={t.advanced.generatedLocationRandomization.enabled.title}
      description={
        <>
          {t.advanced.generatedLocationRandomization.enabled.description}{" "}
          <RandomizationTooltip />
        </>
      }
      highlighted={highlightedAnchorId === anchor}
    >
      <div className="flex justify-end">
        <Switch
          aria-labelledby={getSettingTitleId(anchor)}
          aria-describedby={getSettingDescriptionId(anchor)}
          checked={value}
          disabled={!settingsLoaded}
          onCheckedChange={(checked) => {
            setRandomizeDefault(checked);
            scheduleAutosave({ randomizeGeneratedLocationByDefault: checked });
          }}
        />
      </div>
    </DialogControlRow>
  );
};

const RandomRadiusControl = () => {
  const {
    generatedLocationRandomizationRadiusKm: radiusKm,
    setRadiusKm,
    settingsLoaded,
    scheduleAutosave,
    highlightedAnchorId,
  } = useSettings();
  const [draft, setDraft] = useState(String(radiusKm));
  const anchor = SETTING_ANCHORS.advanced.generatedLocationRandomizationRadius;
  useEffect(() => setDraft(String(radiusKm)), [radiusKm]);
  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    const next = clampRadiusKm(Number.isFinite(parsed) ? parsed : radiusKm);
    setDraft(String(next));
    setRadiusKm(next);
    scheduleAutosave({ generatedLocationRandomizationRadiusKm: next });
  };
  return (
    <DialogControlRow
      anchorId={anchor}
      copyLabel={t.common.copyLinkTo(
        t.advanced.generatedLocationRandomization.radius.copyLinkLabel,
      )}
      title={t.advanced.generatedLocationRandomization.radius.title}
      description={t.advanced.generatedLocationRandomization.radius.description}
      highlighted={highlightedAnchorId === anchor}
    >
      <div className="flex items-center justify-end gap-2">
        <Input
          aria-labelledby={getSettingTitleId(anchor)}
          aria-describedby={getSettingDescriptionId(anchor)}
          aria-label={t.advanced.generatedLocationRandomization.radius.inputLabel}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={draft}
          disabled={!settingsLoaded}
          className="h-9 w-16 px-2 text-center"
          onChange={(event) => {
            const next = event.currentTarget.value.replace(/\D/g, "").slice(0, 2);
            setDraft(next);
            if (next) setRadiusKm(clampRadiusKm(Number.parseInt(next, 10)));
          }}
          onBlur={commit}
        />
        <span className="text-sm text-muted-foreground">km</span>
      </div>
    </DialogControlRow>
  );
};

const NoiseRadiusControl = () => {
  const {
    defaultNoiseRadius,
    setDefaultNoiseRadius,
    settingsLoaded,
    scheduleAutosave,
    highlightedAnchorId,
  } = useSettings();
  const anchor = SETTING_ANCHORS.advanced.defaultNoiseRadius;
  return (
    <DialogSliderRow
      anchorId={anchor}
      copyLabel={t.common.copyLinkTo(t.advanced.noiseRadius.copyLinkLabel)}
      title={t.advanced.noiseRadius.title}
      description={t.advanced.noiseRadius.description}
      highlighted={highlightedAnchorId === anchor}
    >
      <Slider
        aria-labelledby={getSettingTitleId(anchor)}
        aria-describedby={getSettingDescriptionId(anchor)}
        valueLabel={`${defaultNoiseRadius}m`}
        minLabel="0m"
        maxLabel="500m"
        min={0}
        max={500}
        step={10}
        value={[defaultNoiseRadius]}
        disabled={!settingsLoaded}
        onValueChange={(value) => {
          const next = value[0];
          if (next !== undefined) setDefaultNoiseRadius(next);
        }}
        onValueCommit={(value) => {
          const next = value[0];
          if (next !== undefined) scheduleAutosave({ defaultNoiseRadius: next });
        }}
      />
    </DialogSliderRow>
  );
};

const WatchDelayControl = () => {
  const {
    watchPositionDelay,
    setWatchPositionDelay,
    settingsLoaded,
    scheduleAutosave,
    highlightedAnchorId,
  } = useSettings();
  const anchor = SETTING_ANCHORS.advanced.watchPositionDelay;
  return (
    <DialogSliderRow
      anchorId={anchor}
      copyLabel={t.common.copyLinkTo(t.advanced.watchPositionDelay.copyLinkLabel)}
      title={t.advanced.watchPositionDelay.title}
      description={t.advanced.watchPositionDelay.description}
      highlighted={highlightedAnchorId === anchor}
    >
      <Slider
        aria-labelledby={getSettingTitleId(anchor)}
        aria-describedby={getSettingDescriptionId(anchor)}
        valueLabel={`${watchPositionDelay[0]}s - ${watchPositionDelay[1]}s`}
        minLabel="1s"
        maxLabel="600s"
        min={1}
        max={600}
        step={1}
        value={[watchPositionDelay[0], watchPositionDelay[1]]}
        disabled={!settingsLoaded}
        onValueChange={(value) =>
          setWatchPositionDelay([
            value[0] ?? watchPositionDelay[0],
            value[1] ?? watchPositionDelay[1],
          ])
        }
        onValueCommit={(value) => {
          const next: [number, number] = [
            value[0] ?? watchPositionDelay[0],
            value[1] ?? watchPositionDelay[1],
          ];
          localStorage.setItem(
            EXTENSION_STORAGE_KEYS.watchPositionDelayMin,
            next[0].toString(),
          );
          localStorage.setItem(
            EXTENSION_STORAGE_KEYS.watchPositionDelayMax,
            next[1].toString(),
          );
          scheduleAutosave({ watchPositionDelay: next });
        }}
      />
    </DialogSliderRow>
  );
};

export const GeoSettingsDialog = ({ open, onOpenChange }: GeoSettingsDialogProps) => {
  const { highlightedAnchorId } = useSettings();

  useEffect(() => {
    if (!open || !isGeoSettingsAnchor(highlightedAnchorId)) {
      return;
    }

    const anchorId = highlightedAnchorId;
    queueMicrotask(() => {
      document.getElementById(anchorId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [highlightedAnchorId, open]);

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      id="geolocation-advanced-settings-dialog"
      title={
        t.optionsPage.browserFingerprintSpoofing.items.geolocation.advancedModal.title
      }
      description={
        t.optionsPage.browserFingerprintSpoofing.items.geolocation.advancedModal
          .description
      }
      closeLabel={t.common.actions.close}
      contentClassName="sm:max-w-2xl"
      footer={
        <Button
          id="close-geolocation-advanced-settings-dialog"
          type="button"
          onClick={() => onOpenChange(false)}
        >
          {t.common.actions.close}
        </Button>
      }
    >
      <section className="rounded-xl border border-border/70 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="space-y-2">
          <RandomizeControl />
          <div className="border-t border-border/70" />
          <RandomRadiusControl />
          <div className="border-t border-border/70" />
          <NoiseRadiusControl />
          <div className="border-t border-border/70" />
          <WatchDelayControl />
        </div>
      </section>
    </FormDialogShell>
  );
};
