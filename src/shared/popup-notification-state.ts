import type { PopupNotification, PopupNotificationKind } from "@/shared/types";

export type PopupNotificationTone = "warning" | "info";

export const isNoticeUnread = (notification: PopupNotification): boolean =>
  notification.readAt === null && notification.resolvedAt === null;

export const isNoticeAttention = (notification: PopupNotification): boolean =>
  notification.severity === "needs-action" && notification.resolvedAt === null;

export const isUnreadAttention = (notification: PopupNotification): boolean =>
  isNoticeAttention(notification) && isNoticeUnread(notification);

export const getPopupNotificationTone = (
  notifications: readonly PopupNotification[],
): PopupNotificationTone | null => {
  if (notifications.some(isUnreadAttention)) return "warning";
  return notifications.some(isNoticeUnread) ? "info" : null;
};

export const findUnreadNotice = (
  notifications: readonly PopupNotification[],
  kind: PopupNotificationKind,
): PopupNotification | undefined =>
  notifications.find(
    (notification) => notification.kind === kind && isNoticeUnread(notification),
  );
