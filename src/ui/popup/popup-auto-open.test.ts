import { describe, expect, it } from "vitest";

import type { PopupNotification } from "@/shared/types";
import { resolvePopupAutoOpen } from "@/ui/popup/popup-auto-open";

const createNotification = (
  id: string,
  autoPresentedAt: string | null = null,
): PopupNotification => ({
  id,
  kind: "worker-csp-relaxation",
  scope: "site",
  dedupeKey: id,
  severity: "needs-action",
  hostname: "example.com",
  createdAt: "2026-07-16T10:00:00.000Z",
  lastDetectedAt: "2026-07-16T10:00:00.000Z",
  generation: 1,
  readAt: null,
  resolvedAt: null,
  autoPresentedAt,
  pulseShownAt: null,
  actionTarget: "notification-list",
});

const resolve = (notifications: readonly PopupNotification[]) =>
  resolvePopupAutoOpen({ notifications });

describe("popup automatic opening", () => {
  it("keeps the main view open when there are no new notifications", () => {
    expect(resolve([])).toBeNull();
  });

  it("opens the detail for exactly one new notification", () => {
    expect(resolve([createNotification("one")])).toMatchObject({
      kind: "notification-detail",
      notification: { id: "one" },
    });
  });

  it("opens the notification list for multiple new notifications", () => {
    expect(resolve([createNotification("one"), createNotification("two")])).toEqual({
      kind: "notification-list",
      notificationIds: ["one", "two"],
    });
  });

  it("does not reopen an auto-presented batch and reacts to a later notification", () => {
    const presentedAt = "2026-07-16T10:01:00.000Z";
    const previous = [
      createNotification("one", presentedAt),
      createNotification("two", presentedAt),
    ];

    expect(resolve(previous)).toBeNull();
    expect(resolve([...previous, createNotification("three")])).toMatchObject({
      kind: "notification-detail",
      notification: { id: "three" },
    });
  });
});
