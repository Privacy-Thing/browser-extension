import { describe, expect, it } from "vitest";

import notificationCatalog from "@/shared/extension-notifications.json";
import {
  getReleaseNotice,
  getVersionNotices,
  parseNoticeCatalog,
  RELEASE_NOTICES,
} from "@/shared/release-notification";

describe("extension notification catalog", () => {
  it("stores the product name as a rebrandable token", () => {
    const rawCatalog = JSON.stringify(notificationCatalog);
    expect(rawCatalog).toContain("{{brand}}");
    expect(rawCatalog).not.toContain("Privacy Thing");
  });

  it("keeps notification identity separate from its release version", () => {
    const notification = getReleaseNotice("notification-center-intro");

    expect(notification).toMatchObject({
      id: "notification-center-intro",
      channel: "release",
      introducedInVersion: "0.9.0",
      title: "Notifications are now in the popup",
    });
    expect(notification?.id).not.toBe(notification?.introducedInVersion);
    expect(RELEASE_NOTICES).toHaveProperty("notification-center-intro");
  });

  it("keeps each message paragraph as a separate localized item", () => {
    const notification = getReleaseNotice("notification-center-intro");

    expect(notification?.message).toEqual([
      "Privacy Thing now shows important updates and compatibility notices in the popup.",
      "Opening a notification marks it as read. It remains available until you dismiss it.",
    ]);
  });

  it("includes the 0.9.0 rename announcement", () => {
    const source = notificationCatalog.notifications.find(
      (notification) => notification.id === "privacy-thing-rename",
    );
    const rendered = getReleaseNotice("privacy-thing-rename");

    expect(source).toBeDefined();
    expect(rendered).toMatchObject({
      channel: "release",
      introducedInVersion: "0.9.0",
    });
    expect(rendered?.title).toBe(
      source?.title.en.replace("{{brand}}", "Privacy Thing"),
    );
    expect(rendered?.message).toEqual(
      source?.message.en.map((paragraph) =>
        paragraph.replaceAll("{{brand}}", "Privacy Thing"),
      ),
    );
    expect(rendered?.actionUrl).toBeUndefined();
  });

  it("falls back from a regional locale to English and indexes entries by version", () => {
    expect(getReleaseNotice("notification-center-intro", "en-US")?.title).toBe(
      "Notifications are now in the popup",
    );
    expect(getVersionNotices("release", "0.9.0").map((item) => item.id)).toEqual([
      "privacy-thing-rename",
      "notification-center-intro",
    ]);
    expect(getVersionNotices("release", "0.0.0-test")).toEqual([]);
    expect(getVersionNotices("beta", "0.10.0")).toEqual([]);
  });

  it("rejects invalid entries and duplicate IDs", () => {
    const validEntry = {
      id: "release-note",
      channel: "release",
      introducedInVersion: "1.2.3",
      title: { en: "Title" },
      message: { en: ["Message"] },
      actionUrl: "https://example.com",
    };

    expect(() =>
      parseNoticeCatalog({
        notifications: [{ ...validEntry, introducedInVersion: "1.2" }],
      }),
    ).toThrow("Invalid extension notification");
    expect(() =>
      parseNoticeCatalog({
        notifications: [validEntry, { ...validEntry }],
      }),
    ).toThrow("Duplicate extension notification ID");
    expect(() =>
      parseNoticeCatalog({
        notifications: [
          {
            ...validEntry,
            channel: "beta",
            introducedInVersion: "0.2026.720.1530",
          },
        ],
      }),
    ).not.toThrow();
    const { actionUrl: _actionUrl, ...entryWithoutAction } = validEntry;
    expect(() =>
      parseNoticeCatalog({
        notifications: [entryWithoutAction],
      }),
    ).not.toThrow();
    expect(() =>
      parseNoticeCatalog({
        notifications: [{ ...validEntry, actionUrl: "" }],
      }),
    ).toThrow("Invalid extension notification");
  });
});
