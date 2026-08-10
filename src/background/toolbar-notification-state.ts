import type { SurfaceAssessment } from "@privacy-brand/xray-protocol";

import {
  isNoticeUnread,
  isUnreadAttention,
  type PopupNotificationTone,
} from "@/shared/popup-notification-state";
import type { PopupNotification } from "@/shared/types";

export const NOTICE_BADGE_COLORS: Record<
  PopupNotificationTone,
  { background: string; text: string }
> = {
  warning: { background: "#f59e0b", text: "#111827" },
  info: { background: "#0f766e", text: "#ffffff" },
};

export const PROTECTION_BADGE_COLORS = {
  degraded: { background: "#c5221f", text: "#ffffff" },
  unrecoverable: { background: "#991b1b", text: "#ffffff" },
} as const;

export type ToolbarProtectionFailure = keyof typeof PROTECTION_BADGE_COLORS;

export const resolveProtectionFailure = (
  assessments: readonly Pick<SurfaceAssessment, "presentation">[],
): ToolbarProtectionFailure | null => {
  if (assessments.some(({ presentation }) => presentation === "unrecoverable")) {
    return "unrecoverable";
  }
  if (assessments.some(({ presentation }) => presentation === "degraded")) {
    return "degraded";
  }
  return null;
};

export const selectToolbarNotice = (
  notifications: readonly PopupNotification[],
): PopupNotification | null =>
  notifications.find(isUnreadAttention) ?? notifications.find(isNoticeUnread) ?? null;
