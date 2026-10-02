import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type { HostPauseStatus } from "@/shared/host-protection-pause";
import { Button } from "@/ui/components/ui/button";
import { t } from "@/ui/i18n";
import { sendRuntimeMessage } from "@/ui/shared/runtime-messaging";

export const HostPauseNotice = ({
  status,
  tabId,
  refresh,
}: {
  status: HostPauseStatus | undefined;
  tabId: number | undefined;
  refresh: () => void;
}) =>
  status?.pause || status?.reloadRequired ? (
    <div
      role="status"
      className="mb-4 rounded-lg border border-border p-3 text-sm"
      data-host-pause={status.pause ? "active" : "reload-required"}
    >
      <p className="font-semibold">
        {status.pause ? t.popup.pauseActive : t.popup.pauseReloadRequired}
      </p>
      <p className="mt-2 text-muted-foreground">
        {status.pause ? t.popup.pauseReloadHint : t.popup.pauseExpiredHint}
      </p>
      <p className="mt-2 text-muted-foreground">{t.popup.pauseLimits}</p>
      <Button
        className="mt-2"
        size="sm"
        onClick={() =>
          void sendRuntimeMessage({
            type: EXTENSION_COMMAND_TYPES.setHostProtectionPause,
            duration: "resume",
            ...(tabId === undefined ? {} : { tabId }),
          }).then(refresh)
        }
      >
        {t.popup.pauseResumeReload}
      </Button>
    </div>
  ) : null;
