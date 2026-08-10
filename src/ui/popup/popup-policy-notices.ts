import type { PopupPolicyNoticeKind } from "@/shared/types";
import { t } from "@/ui/i18n";

export type PopupPolicyNoticeView = {
  title: string;
  summary: string;
  description: string;
};

export const getPolicyNoticeView = (
  kind: PopupPolicyNoticeKind,
): PopupPolicyNoticeView => {
  switch (kind) {
    case "service-worker-block":
      return {
        title: t.popup.protectionServiceWorkerBlockTitle,
        summary: t.popup.protectionServiceWorkerBlockSummary,
        description: t.popup.protectionServiceWorkerBlockDescription,
      };
    case "shared-worker-strict":
      return {
        title: t.popup.protectionSharedWorkerStrictTitle,
        summary: t.popup.protectionSharedWorkerStrictSummary,
        description: t.popup.protectionSharedWorkerStrictDescription,
      };
  }
};
