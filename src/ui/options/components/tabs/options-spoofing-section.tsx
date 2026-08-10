import type { SpoofingSurfaceMethodId } from "@/shared/spoofing-surfaces";
import { cn } from "@/ui/components/lib/utils";
import {
  getSettingDescriptionId,
  getSettingTitleId,
  joinAriaIds,
} from "@/ui/components/settings-control-metadata";
import { SettingsControlCard } from "@/ui/components/SettingsControlCard";
import { SettingsSectionCard } from "@/ui/components/SettingsSectionCard";
import { SettingsSubcard } from "@/ui/components/SettingsSubcard";
import { Button } from "@/ui/components/ui/button";
import { Switch } from "@/ui/components/ui/switch";
import { t } from "@/ui/i18n";
import {
  getSegmentButtonClass,
  SEGMENTED_GROUP_CLASS,
} from "@/ui/options/components/modals/dialog-primitives";
import type { OptionsModel } from "@/ui/options/components/tabs/options-model";
import {
  FULL_WIDTH_SURFACES,
  type SpoofingSurface,
} from "@/ui/options/components/tabs/options-surface-data";
import { AnimatedVersionHint } from "@/ui/options/components/tabs/options-version-hint";
import { SECTION_ANCHORS, SETTING_ANCHORS } from "@/ui/options/navigation";
import { SURFACE_METHOD_LABELS } from "@/ui/shared/surface-method-labels";

const MethodList = ({ methods }: Pick<SpoofingSurface, "methods">) => (
  <details className="group min-w-0">
    <summary className="list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <span className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        {`Intercepts ${methods.length} browser APIs`}
      </span>
    </summary>
    <div className="mt-2 flex flex-wrap gap-1">
      {methods.map((method) => (
        <span
          key={method.id}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.72rem] text-foreground"
        >
          {SURFACE_METHOD_LABELS[method.id as SpoofingSurfaceMethodId]}
        </span>
      ))}
    </div>
  </details>
);

const SharedWorkerCard = ({
  model,
  surface,
}: {
  model: OptionsModel;
  surface: SpoofingSurface;
}) => {
  const disabled =
    model.simpleDisabled || !model.settings.browserFingerprintSpoofingEnabled;
  return (
    <SettingsControlCard
      className="lg:col-span-2"
      anchorId={surface.anchorId}
      copyLabel={t.common.copyLinkTo(
        t.optionsPage.browserFingerprintSpoofing.items.sharedWorker.copyLinkLabel,
      )}
      title={<h3 className="text-sm font-semibold">{surface.label}</h3>}
      description={surface.description}
      focusControlOnTitleClick
      highlighted={
        model.settings.highlightedAnchorId === surface.anchorId ||
        model.settings.highlightedAnchorId ===
          SETTING_ANCHORS.advanced.sharedWorkerCompatibilityMode
      }
      action={
        <div
          className={SEGMENTED_GROUP_CLASS}
          role="group"
          aria-labelledby={getSettingTitleId(surface.anchorId)}
          aria-describedby={joinAriaIds(
            getSettingDescriptionId(surface.anchorId),
            !model.settings.browserFingerprintSpoofingEnabled &&
              model.fingerprintNoteId,
          )}
        >
          {(["native", "spoof", "strict"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={model.settings.sharedWorkerHandlingMode === mode}
              className={cn(
                getSegmentButtonClass({
                  active: model.settings.sharedWorkerHandlingMode === mode,
                  disabled,
                  ...(mode !== "native"
                    ? { dividerClassName: "border-l border-border" }
                    : {}),
                }),
                "whitespace-nowrap px-2",
              )}
              disabled={disabled}
              onClick={() => {
                model.settings.setWorkerMode(mode);
                model.settings.scheduleAutosave({
                  sharedWorkerHandlingMode: mode,
                  sharedWorkerCompatibilityMode: mode === "native",
                });
              }}
            >
              {t.optionsPage.browserFingerprintSpoofing.items.sharedWorker[mode]}
            </button>
          ))}
        </div>
      }
    >
      <MethodList methods={surface.methods} />
    </SettingsControlCard>
  );
};

const ServiceWorkerControl = ({
  checked,
  disabled,
  model,
  surface,
  update,
}: {
  checked: boolean;
  disabled: boolean;
  model: OptionsModel;
  surface: SpoofingSurface;
  update: (checked: boolean) => void;
}) => (
  <div
    className={SEGMENTED_GROUP_CLASS}
    role="group"
    aria-labelledby={getSettingTitleId(surface.anchorId)}
    aria-describedby={joinAriaIds(
      getSettingDescriptionId(surface.anchorId),
      !model.settings.browserFingerprintSpoofingEnabled && model.fingerprintNoteId,
    )}
  >
    {([false, true] as const).map((value, index) => (
      <button
        key={value ? "block" : "allow"}
        type="button"
        aria-pressed={checked === value}
        className={cn(
          getSegmentButtonClass({
            active: checked === value,
            disabled,
            ...(index > 0 ? { dividerClassName: "border-l border-border" } : {}),
          }),
          "whitespace-nowrap px-2",
        )}
        disabled={disabled}
        onClick={() => update(value)}
      >
        {value
          ? t.optionsPage.browserFingerprintSpoofing.items.serviceWorker.block
          : t.optionsPage.browserFingerprintSpoofing.items.serviceWorker.allow}
      </button>
    ))}
  </div>
);

const VersionRotation = ({
  model,
  surface,
}: {
  model: OptionsModel;
  surface: SpoofingSurface;
}) => {
  const animated =
    model.settings.browserFingerprintSpoofingEnabled &&
    surface.checked &&
    model.versionRotationOn;
  return (
    <SettingsSubcard
      anchorId={SETTING_ANCHORS.options.clientHintsVersionRotation}
      copyLabel={t.common.copyLinkTo(
        t.optionsPage.browserFingerprintSpoofing.items.clientHintsVersionRotation.label,
      )}
      title={
        <h4 className="min-w-0 text-sm font-medium leading-5 text-foreground">
          {
            t.optionsPage.browserFingerprintSpoofing.items.clientHintsVersionRotation
              .label
          }
        </h4>
      }
      description={
        <>
          <div className="inline-flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">
              {
                t.optionsPage.browserFingerprintSpoofing.items
                  .clientHintsVersionRotation.hintPrefix
              }
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.72rem] text-foreground">
              {model.version.example ? (
                <AnimatedVersionHint
                  example={model.version.example}
                  enabled={animated}
                  catalogVersionDigits={model.version.catalog}
                />
              ) : (
                t.optionsPage.browserFingerprintSpoofing.items
                  .clientHintsVersionRotation.hint
              )}
            </span>
          </div>
          <p className="mt-1">
            {t.optionsPage.browserFingerprintSpoofing.items.clientHintsVersionRotation.description(
              model.version.catalog.length,
            )}
          </p>
        </>
      }
      focusControlOnTitleClick
      highlighted={
        model.settings.highlightedAnchorId ===
        SETTING_ANCHORS.options.clientHintsVersionRotation
      }
      className="mt-3"
      action={
        <Switch
          aria-labelledby={getSettingTitleId(
            SETTING_ANCHORS.options.clientHintsVersionRotation,
          )}
          aria-describedby={joinAriaIds(
            getSettingDescriptionId(SETTING_ANCHORS.options.clientHintsVersionRotation),
            !model.settings.browserFingerprintSpoofingEnabled &&
              model.fingerprintNoteId,
          )}
          className="mt-0.5 origin-left scale-90"
          checked={model.versionRotationOn}
          disabled={
            model.simpleDisabled ||
            !model.settings.browserFingerprintSpoofingEnabled ||
            !surface.checked
          }
          onCheckedChange={(checked) => {
            const next = {
              ...model.activeSpoofing,
              clientHintsVersionRotation: checked,
            };
            model.settings.setSharedSpoofing(next);
            model.settings.scheduleAutosave({ sharedSpoofing: next });
          }}
        />
      }
    />
  );
};

const SurfaceCard = ({
  model,
  surface,
}: {
  model: OptionsModel;
  surface: SpoofingSurface;
}) => {
  if (surface.key === "sharedWorker")
    return <SharedWorkerCard model={model} surface={surface} />;
  const disabled =
    model.simpleDisabled || !model.settings.browserFingerprintSpoofingEnabled;
  const update = (checked: boolean): void => {
    const next = { ...model.activeSpoofing, [surface.key]: checked };
    model.settings.setSharedSpoofing(next);
    model.settings.scheduleAutosave({ sharedSpoofing: next });
  };
  const action =
    surface.key === "serviceWorker" ? (
      <ServiceWorkerControl
        checked={surface.checked}
        disabled={disabled}
        model={model}
        surface={surface}
        update={update}
      />
    ) : (
      <Switch
        aria-labelledby={getSettingTitleId(surface.anchorId)}
        aria-describedby={joinAriaIds(
          getSettingDescriptionId(surface.anchorId),
          !model.settings.browserFingerprintSpoofingEnabled && model.fingerprintNoteId,
        )}
        checked={surface.checked}
        disabled={disabled}
        onCheckedChange={update}
      />
    );
  return (
    <SettingsControlCard
      className={
        (model.browserTarget === "chromium" && surface.key === "geolocation") ||
        surface.key === "clientHints" ||
        surface.key === "serviceWorker"
          ? "lg:col-span-2"
          : undefined
      }
      anchorId={surface.anchorId}
      copyLabel={t.common.copyLinkTo(surface.label)}
      title={<h3 className="text-sm font-semibold">{surface.label}</h3>}
      description={surface.description}
      focusControlOnTitleClick
      highlighted={model.settings.highlightedAnchorId === surface.anchorId}
      action={action}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <MethodList methods={surface.methods} />
        {surface.key === "geolocation" ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => model.setGeoDialogOpen(true)}
          >
            {t.optionsPage.browserFingerprintSpoofing.items.geolocation.advancedButton}
          </Button>
        ) : null}
      </div>
      {surface.key === "clientHints" ? (
        <VersionRotation model={model} surface={surface} />
      ) : null}
    </SettingsControlCard>
  );
};

export const SpoofingSection = ({ model }: { model: OptionsModel }) => {
  const enabled = model.settings.browserFingerprintSpoofingEnabled;
  const surfaces = [...model.surfaces].sort(
    (a, b) => FULL_WIDTH_SURFACES.indexOf(a.key) - FULL_WIDTH_SURFACES.indexOf(b.key),
  );
  return (
    <div
      id={SECTION_ANCHORS.options.overview}
      data-anchor-id={SECTION_ANCHORS.options.overview}
      className="gw-anchor-target scroll-mt-7"
    >
      <SettingsSectionCard
        anchorId={SETTING_ANCHORS.options.browserFingerprintSpoofing}
        copyLabel={t.common.copyLinkTo(
          t.optionsPage.browserFingerprintSpoofing.copyLinkLabel,
        )}
        title={
          <h2 className="text-xl font-semibold">
            {t.optionsPage.browserFingerprintSpoofing.title}
          </h2>
        }
        description={t.optionsPage.browserFingerprintSpoofing.description}
        focusControlOnTitleClick
        highlighted={model.spoofingHighlighted}
        contentClassName="flex flex-col gap-4 pt-6"
        headerActions={
          <Switch
            aria-labelledby={getSettingTitleId(
              SETTING_ANCHORS.options.browserFingerprintSpoofing,
            )}
            aria-describedby={joinAriaIds(
              getSettingDescriptionId(
                SETTING_ANCHORS.options.browserFingerprintSpoofing,
              ),
              !enabled && model.fingerprintNoteId,
            )}
            checked={enabled}
            disabled={model.simpleDisabled}
            onCheckedChange={(checked) => {
              model.settings.setFingerprintSpoofing(checked);
              model.settings.scheduleAutosave({
                browserFingerprintSpoofingEnabled: checked,
              });
            }}
          />
        }
      >
        {!enabled ? (
          <p id={model.fingerprintNoteId} className="text-sm text-muted-foreground">
            {t.optionsPage.browserFingerprintSpoofing.disabledNote}
          </p>
        ) : null}
        <div
          id={SECTION_ANCHORS.options.surfaces}
          data-anchor-id={SECTION_ANCHORS.options.surfaces}
          className="h-0 overflow-hidden"
          aria-hidden="true"
        />
        <div
          id={SETTING_ANCHORS.options.activeSpoofing}
          data-anchor-id={SETTING_ANCHORS.options.activeSpoofing}
          className="grid gap-3 lg:grid-cols-2"
        >
          {surfaces.map((surface) => (
            <SurfaceCard key={surface.key} model={model} surface={surface} />
          ))}
        </div>
      </SettingsSectionCard>
    </div>
  );
};
