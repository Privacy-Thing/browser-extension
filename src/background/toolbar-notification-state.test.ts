import { describe, expect, it } from "vitest";

import {
  resolveProtectionFailure,
  selectToolbarNotice,
  NOTICE_BADGE_COLORS,
  PROTECTION_BADGE_COLORS,
} from "@/background/toolbar-notification-state";
import type { PopupNotification } from "@/shared/types";

const notification = (
  id: string,
  severity: PopupNotification["severity"],
  readAt: string | null = null,
  resolvedAt: string | null = null,
): PopupNotification => ({
  id,
  kind: severity === "info" ? "significant-update" : "service-worker-block",
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

describe("toolbar notification state", () => {
  it("prioritizes unread warnings and ignores acknowledged notifications", () => {
    const selected = selectToolbarNotice([
      notification("read-warning", "needs-action", "2026-07-14T10:01:00.000Z"),
      notification("update", "info"),
      notification("warning", "needs-action"),
    ]);

    expect(selected?.id).toBe("warning");
    expect(
      selectToolbarNotice([
        notification("read-warning", "needs-action", "2026-07-14T10:01:00.000Z"),
      ]),
    ).toBeNull();
  });

  it("uses distinct accessible semantic colors for warnings and updates", () => {
    expect(NOTICE_BADGE_COLORS.warning).toEqual({
      background: "#f59e0b",
      text: "#111827",
    });
    expect(NOTICE_BADGE_COLORS.info).toEqual({
      background: "#0f766e",
      text: "#ffffff",
    });
  });

  it("keeps current protection failures red independently of notification state", () => {
    expect(
      resolveProtectionFailure([
        { presentation: "protected" },
        { presentation: "degraded" },
      ]),
    ).toBe("degraded");
    expect(
      resolveProtectionFailure([
        { presentation: "degraded" },
        { presentation: "unrecoverable" },
      ]),
    ).toBe("unrecoverable");
    expect(
      resolveProtectionFailure([
        { presentation: "protected" },
        { presentation: "repaired" },
      ]),
    ).toBeNull();
    expect(PROTECTION_BADGE_COLORS.degraded).toEqual({
      background: "#c5221f",
      text: "#ffffff",
    });
  });
});
