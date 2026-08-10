import { describe, expect, it } from "vitest";

import {
  findUnreadNotice,
  getPopupNotificationTone,
  isNoticeAttention,
  isNoticeUnread,
} from "@/shared/popup-notification-state";
import type { PopupNotification } from "@/shared/types";

const createNotification = (
  id: string,
  severity: PopupNotification["severity"],
  readAt: string | null,
  resolvedAt: string | null,
): PopupNotification => ({
  id,
  kind: severity === "info" ? "significant-update" : "worker-csp-relaxation",
  scope: severity === "info" ? "extension" : "site",
  dedupeKey: id,
  severity,
  createdAt: "2026-07-14T10:00:00.000Z",
  lastDetectedAt: "2026-07-14T10:00:00.000Z",
  generation: 1,
  readAt,
  resolvedAt,
  autoPresentedAt: null,
  pulseShownAt: null,
  actionTarget: "test",
});

describe("popup notification state", () => {
  it("keeps an active warning separate from its unread state", () => {
    const unread = createNotification("unread", "needs-action", null, null);
    const read = createNotification(
      "read",
      "needs-action",
      "2026-07-14T10:01:00.000Z",
      null,
    );

    expect(isNoticeUnread(unread)).toBe(true);
    expect(isNoticeAttention(unread)).toBe(true);
    expect(isNoticeUnread(read)).toBe(false);
    expect(isNoticeAttention(read)).toBe(true);
  });

  it("does not select a read warning for automatic popup opening", () => {
    const read = createNotification(
      "read",
      "needs-action",
      "2026-07-14T10:01:00.000Z",
      null,
    );
    expect(findUnreadNotice([read], "worker-csp-relaxation")).toBeUndefined();
  });

  it("prioritizes the warning tone over info and hides tone after acknowledgement", () => {
    const info = createNotification("info", "info", null, null);
    const warning = createNotification("warning", "needs-action", null, null);
    const readWarning = createNotification(
      "read-warning",
      "needs-action",
      "2026-07-14T10:01:00.000Z",
      null,
    );

    expect(getPopupNotificationTone([info, warning])).toBe("warning");
    expect(getPopupNotificationTone([info, readWarning])).toBe("info");
    expect(getPopupNotificationTone([readWarning])).toBeNull();
  });
});
