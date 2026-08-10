import { cn } from "@/ui/components/lib/utils";
import { Button } from "@/ui/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { Label } from "@/ui/components/ui/label";
import { Switch } from "@/ui/components/ui/switch";
import { t } from "@/ui/i18n";
import { useSettings } from "@/ui/options/state/SettingsContext";

const OnboardingReset = () => {
  const { resetRunOnboarding, setResetRunOnboarding } = useSettings();
  return (
    <div className="mt-2 flex items-start justify-between gap-4">
      <div>
        <Label htmlFor="reset-run-onboarding" className="text-sm font-medium">
          {t.advanced.danger.reset.onboardingToggleLabel}
        </Label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t.advanced.danger.reset.onboardingToggleDescription}
        </p>
      </div>
      <Switch
        id="reset-run-onboarding"
        checked={resetRunOnboarding}
        onCheckedChange={setResetRunOnboarding}
      />
    </div>
  );
};

export const ConfirmDialog = () => {
  const { confirmDialogOpen, confirmDialogConfig, resolveConfirmDialog } =
    useSettings();
  const description =
    confirmDialogConfig?.description ??
    "Review this action and choose confirm or cancel.";
  const hasRichDescription =
    description != null &&
    typeof description !== "string" &&
    typeof description !== "number";
  const confirmButton = (
    <Button
      id="confirm-dialog-confirm"
      type="button"
      className={confirmDialogConfig?.confirmClassName}
      variant={
        confirmDialogConfig?.confirmVariant ??
        (confirmDialogConfig?.confirmTone === "destructive" ? "destructive" : "default")
      }
      onClick={() => resolveConfirmDialog(true)}
    >
      {confirmDialogConfig?.confirmLabel ?? t.common.actions.delete}
    </Button>
  );
  const cancelButton = (
    <Button
      id="confirm-dialog-cancel"
      type="button"
      className={confirmDialogConfig?.cancelClassName}
      variant={confirmDialogConfig?.cancelVariant ?? "secondary"}
      onClick={() => resolveConfirmDialog(false)}
    >
      {confirmDialogConfig?.cancelLabel ?? t.common.actions.cancel}
    </Button>
  );
  return (
    <Dialog
      open={confirmDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          resolveConfirmDialog(false);
        }
      }}
    >
      <DialogContent id="confirm-dialog" animationTiming="urgent" className="max-w-md">
        <DialogCloseButton label={t.common.actions.close} />
        <DialogHeader
          className={cn(
            confirmDialogConfig?.description && "border-b border-border/80 pb-4",
          )}
        >
          <DialogTitle className="pr-8">
            <span id="confirm-dialog-title">
              {confirmDialogConfig?.title ?? "Confirm action"}
            </span>
          </DialogTitle>
          {hasRichDescription ? (
            <DialogDescription className="sr-only">
              Review this action and choose confirm or cancel.
            </DialogDescription>
          ) : null}
          <div
            id="confirm-dialog-description"
            className={cn(
              "text-sm text-muted-foreground whitespace-pre-line",
              confirmDialogConfig?.description ? undefined : "sr-only",
            )}
          >
            {description}
          </div>
          {!hasRichDescription ? (
            <DialogDescription asChild>
              <div className="sr-only">{description}</div>
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {confirmDialogConfig?.showOnboardingReset ? <OnboardingReset /> : null}

        <DialogFooter
          className={cn(
            "mt-2",
            confirmDialogConfig?.footerLayout === "split" &&
              "flex-row justify-between gap-2 sm:justify-between sm:space-x-0",
          )}
        >
          {confirmDialogConfig?.actionOrder === "confirm-cancel" ? (
            <>
              {confirmButton}
              {cancelButton}
            </>
          ) : (
            <>
              {cancelButton}
              {confirmButton}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
