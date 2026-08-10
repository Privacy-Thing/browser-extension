import { Button } from "@/ui/components/ui/button";
import { FormDialogShell } from "@/ui/components/ui/form-dialog-shell";
import { Switch } from "@/ui/components/ui/switch";
import { t } from "@/ui/i18n";
import {
  DialogIdentitySection,
  DialogToggleRow,
} from "@/ui/options/components/modals/dialog-primitives";
import {
  LocationFormFields,
  UNASSIGNED_VALUE,
} from "@/ui/options/components/modals/LocationFormFields";
import { SurfaceOverridesControls } from "@/ui/options/components/modals/surface-overrides-controls";
import { SECTION_ANCHORS, getFallbackModalAnchor } from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";

const FallbackDialogBody = () => {
  const {
    isFallbackEnabled,
    setFallbackEnabled,
    fallbackLocationId,
    setFallbackLocationId,
    fallbackSurfaceOverrides,
    setFallbackSurfaces,
    fallbackSeedKey,
    ruleProfileOptions,
    onboardingOptions,
  } = useSettings();
  const limitationsHref = `${chrome.runtime.getURL("src/ui/options/index.html")}#${SECTION_ANCHORS.about.limitations}`;
  const presetOptions = ruleProfileOptions.map((option) =>
    typeof option === "string"
      ? { value: option, label: option }
      : { value: option.value, label: option.label },
  );
  const allPresetOptions = [
    { value: UNASSIGNED_VALUE, label: t.rules.globalFallback.noPresetLabel },
    ...presetOptions,
  ];
  return (
    <>
      {onboardingOptions !== null ? (
        <p className="mb-4 text-sm leading-6 text-muted-foreground">
          {t.welcome.steps.scope.defaultRuleDialogDescription}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.95fr)] md:items-start">
        <section className="rounded-xl border border-border/70 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="space-y-4">
            <DialogToggleRow
              htmlFor="dialog-default-rule-enabled"
              label={t.rules.globalFallback.dialog.enabledLabel}
              hint={t.rules.globalFallback.dialog.enabledHint}
              control={
                <Switch
                  id="dialog-default-rule-enabled"
                  checked={isFallbackEnabled}
                  onCheckedChange={setFallbackEnabled}
                  aria-label={t.rules.globalFallback.dialog.enabledAriaLabel}
                />
              }
            />
            <LocationFormFields
              sectionLabel={t.rules.globalFallback.dialog.locationProfileLabel}
              sectionHint={t.rules.globalFallback.dialog.locationProfileHint}
              warning={
                <>
                  {t.rules.globalFallback.dialog.locationProfileWarningPrefix}
                  <a
                    href={limitationsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {t.rules.globalFallback.dialog.locationProfileWarningLinkLabel}
                  </a>
                  {t.rules.globalFallback.dialog.locationProfileWarningSuffix}
                </>
              }
              selectId="dialog-global-fallback-location"
              selectLabel={t.rules.globalFallback.dialog.locationLabel}
              selectPlaceholder={t.rules.globalFallback.dialog.locationPlaceholder}
              selectValue={fallbackLocationId || UNASSIGNED_VALUE}
              selectOptions={allPresetOptions}
              onSelectValueChange={(value) =>
                setFallbackLocationId(value === UNASSIGNED_VALUE ? "" : value)
              }
            />
            {fallbackSeedKey ? (
              <>
                <div className="border-t border-border/70" />
                <DialogIdentitySection
                  title={t.rules.dialog.identity.sectionTitle}
                  description={t.rules.globalFallback.dialog.identityDescription}
                />
              </>
            ) : null}
          </div>
        </section>
        <section className="rounded-xl border border-border/70 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t.rules.dialog.surfaceOverrides.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.rules.dialog.surfaceOverrides.description}
              </p>
            </div>
            <SurfaceOverridesControls
              value={fallbackSurfaceOverrides}
              onChange={setFallbackSurfaces}
              labelVariant="field"
              labelClassName="mb-0"
            />
          </div>
        </section>
      </div>
    </>
  );
};

export const GlobalFallbackRuleDialog = () => {
  const {
    isFallbackDialogOpen,
    closeFallbackDialog,
    submitFallbackRule,
    submitOnboardingFallback,
    onboardingOptions,
  } = useSettings();
  const modalAnchorId = getFallbackModalAnchor();
  const onboardingMode = onboardingOptions !== null;
  const focusPrimaryControl = () => {
    document.getElementById("dialog-default-rule-enabled")?.focus();
  };

  return (
    <FormDialogShell
      open={isFallbackDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeFallbackDialog();
        }
      }}
      id="global-fallback-rule-dialog"
      title={<span>{t.rules.globalFallback.dialog.title}</span>}
      description={t.rules.globalFallback.dialog.description}
      closeLabel={t.common.actions.close}
      contentClassName="sm:max-w-[58rem]"
      headerProps={{
        id: modalAnchorId,
        "data-anchor-id": modalAnchorId,
      }}
      headerClassName="gw-anchor-target"
      formProps={{
        id: "global-fallback-rule-form",
        onSubmit: onboardingMode ? submitOnboardingFallback : submitFallbackRule,
      }}
      footerClassName="sm:justify-between"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        queueMicrotask(focusPrimaryControl);
      }}
      footer={
        <>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={closeFallbackDialog}>
              {t.common.actions.cancel}
            </Button>
          </div>
          <Button type="submit">{t.rules.globalFallback.dialog.submit}</Button>
        </>
      }
    >
      <FallbackDialogBody />
    </FormDialogShell>
  );
};
