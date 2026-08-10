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
import { t } from "@/ui/i18n";
import { useSettings } from "@/ui/options/state/SettingsContext";

export const OsmConsentModal = () => {
  const { isOsmDialogOpen, closeOsmDialog, grantOsmConsent, denyOsmConsent } =
    useSettings();

  return (
    <Dialog
      open={isOsmDialogOpen}
      onOpenChange={(open) => {
        if (!open) closeOsmDialog();
      }}
    >
      <DialogContent>
        <DialogCloseButton label={t.common.actions.close} />
        <DialogHeader>
          <DialogTitle className="pr-8">{t.osm.modalTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <DialogDescription>{t.osm.body1}</DialogDescription>
          <DialogDescription>{t.osm.body2}</DialogDescription>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => void denyOsmConsent()}>
            {t.common.actions.notNow}
          </Button>
          <Button onClick={() => void grantOsmConsent()}>
            {t.common.actions.allowOpenStreetMap}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
