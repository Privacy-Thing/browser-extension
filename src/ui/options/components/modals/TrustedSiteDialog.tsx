import { Button } from "@/ui/components/ui/button";
import { FormDialogShell } from "@/ui/components/ui/form-dialog-shell";
import { Input } from "@/ui/components/ui/input";
import { t } from "@/ui/i18n";
import { DialogFieldRow } from "@/ui/options/components/modals/dialog-primitives";
import { useSettings } from "@/ui/options/state/SettingsContext";

export const TrustedSiteDialog = () => {
  const {
    trustedSiteDialogOpened,
    closeTrustedSiteDialog,
    handleTrustedSiteSubmit,
    trustedSitePattern,
    setTrustedSitePattern,
    saveInFlight,
  } = useSettings();

  const focusPrimaryControl = () => {
    document.getElementById("dialog-trusted-site-pattern")?.focus();
  };

  return (
    <FormDialogShell
      open={trustedSiteDialogOpened}
      onOpenChange={(open) => {
        if (!open) {
          closeTrustedSiteDialog();
        }
      }}
      id="trusted-site-dialog"
      title={<span id="trusted-site-dialog-title">{t.trustedSites.dialog.title}</span>}
      description={t.trustedSites.dialog.description}
      closeLabel={t.common.actions.close}
      contentClassName="sm:max-w-xl"
      formProps={{
        id: "trusted-site-dialog-form",
        onSubmit: handleTrustedSiteSubmit,
      }}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        queueMicrotask(focusPrimaryControl);
      }}
      footer={
        <>
          <Button
            id="close-trusted-site-dialog"
            type="button"
            variant="ghost"
            onClick={closeTrustedSiteDialog}
            disabled={saveInFlight}
          >
            {t.common.actions.cancel}
          </Button>
          <Button id="save-trusted-site-dialog" type="submit" disabled={saveInFlight}>
            {t.trustedSites.dialog.submit}
          </Button>
        </>
      }
    >
      <section className="rounded-xl border border-border/70 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <DialogFieldRow
          htmlFor="dialog-trusted-site-pattern"
          label={t.trustedSites.patternLabel}
          labelInfo={
            <span
              dangerouslySetInnerHTML={{ __html: t.trustedSites.dialog.patternInfo }}
            />
          }
          labelInfoAriaLabel={t.trustedSites.dialog.patternInfoAriaLabel}
        >
          <Input
            id="dialog-trusted-site-pattern"
            name="pattern"
            placeholder={t.trustedSites.patternPlaceholder}
            value={trustedSitePattern}
            onChange={(event) => setTrustedSitePattern(event.currentTarget.value)}
          />
        </DialogFieldRow>
      </section>
    </FormDialogShell>
  );
};
