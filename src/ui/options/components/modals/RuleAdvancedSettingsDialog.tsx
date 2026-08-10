import { Button } from "@/ui/components/ui/button";
import { FormDialogShell } from "@/ui/components/ui/form-dialog-shell";
import { Switch } from "@/ui/components/ui/switch";
import { t } from "@/ui/i18n";
import { DialogToggleRow } from "@/ui/options/components/modals/dialog-primitives";
import { useSettings } from "@/ui/options/state/SettingsContext";

type RuleSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetLabel: string;
};

export const RuleSettingsDialog = ({
  open,
  onOpenChange,
  targetLabel,
}: RuleSettingsDialogProps) => {
  const { ruleRelaxCsp, setRuleRelaxCsp } = useSettings();

  const focusPrimaryControl = () => {
    document.getElementById("dialog-rule-relax-csp")?.focus();
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      id="rule-advanced-dialog"
      title={
        <span id="rule-advanced-dialog-title">
          {t.rules.dialog.advancedModal.title(targetLabel)}
        </span>
      }
      description={t.rules.dialog.advancedModal.description}
      closeLabel={t.common.actions.close}
      contentClassName="sm:max-w-2xl"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        queueMicrotask(focusPrimaryControl);
      }}
      footer={
        <Button
          id="confirm-rule-advanced-dialog"
          type="button"
          onClick={() => onOpenChange(false)}
        >
          {t.rules.dialog.advancedModal.confirm}
        </Button>
      }
    >
      <section className="rounded-xl border border-border/70 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="space-y-4">
          <DialogToggleRow
            htmlFor="dialog-rule-relax-csp"
            label={t.rules.dialog.relaxCspLabel}
            hint={
              <>
                <p>{t.rules.dialog.relaxCspHint}</p>
                <p className="font-semibold text-destructive">
                  {t.rules.dialog.relaxCspRiskHint}
                </p>
              </>
            }
            control={
              <Switch
                id="dialog-rule-relax-csp"
                checked={ruleRelaxCsp}
                onCheckedChange={setRuleRelaxCsp}
                aria-label={t.rules.dialog.relaxCspAriaLabel(targetLabel)}
              />
            }
          />
        </div>
      </section>
    </FormDialogShell>
  );
};
