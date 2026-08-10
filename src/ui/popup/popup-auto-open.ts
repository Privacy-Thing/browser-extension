import { isNoticeUnread } from "@/shared/popup-notification-state";
import type { PopupNotification } from "@/shared/types";

export type PopupAutoOpenResolution =
  | { kind: "notification-detail"; notification: PopupNotification }
  | { kind: "notification-list"; notificationIds: string[] }
  | null;

export const resolvePopupAutoOpen = ({
  notifications,
}: {
  notifications: readonly PopupNotification[];
}): PopupAutoOpenResolution => {
  const newNotifications = notifications.filter(
    (notification) =>
      isNoticeUnread(notification) && notification.autoPresentedAt === null,
  );
  if (newNotifications.length === 0) return null;
  if (newNotifications.length === 1) {
    return { kind: "notification-detail", notification: newNotifications[0]! };
  }
  return {
    kind: "notification-list",
    notificationIds: newNotifications.map((notification) => notification.id),
  };
};
