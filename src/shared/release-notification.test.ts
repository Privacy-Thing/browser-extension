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
      delivery: "upgrades-only",
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
      delivery: "upgrades-only",
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
    expect(getVersionNotices("release", "0.9.0.4").map((item) => item.id)).toEqual([
      "privacy-thing-rename",
      "notification-center-intro",
    ]);
    expect(getVersionNotices("release", "0.0.0-test")).toEqual([]);
    expect(getVersionNotices("beta", "0.10.0")).toEqual([]);
  });

  it("includes the approved 0.9.2 Temporal and open-source announcements", () => {
    const notifications = getVersionNotices("release", "0.9.2");

    expect(notifications).toEqual([
      expect.objectContaining({
        id: "experimental-temporal-api",
        title: "Temporal API protection is ready to try",
        actionUrl:
          "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal",
      }),
      expect.objectContaining({
        id: "privacy-thing-open-source",
        title: "Privacy Thing is now open source!",
        actionUrl: "https://github.com/Privacy-Thing/browser-extension",
      }),
    ]);
    expect(notifications[0]?.message[1]).toContain(
      "Settings → Advanced → Experimental",
    );
    expect(notifications[0]?.message.at(-1)).toBe(
      "Want to know more? You can read about the Temporal API on Mozilla Developer Network using the link below.",
    );
  });

  it("includes the approved 0.9.3 Domain fencing announcement", () => {
    expect(getVersionNotices("release", "0.9.3")).toEqual([
      {
        id: "experimental-domain-fencing",
        channel: "release",
        introducedInVersion: "0.9.3",
        delivery: "all-current-users",
        title: "Domain fencing is ready to try",
        message: [
          "On Chrome and Firefox, Domain fencing gives each site its own stable variation of the generated fingerprint when the Default Rule applies. On Firefox, it also separates identities assigned through containers.",
          "The same site and its subdomains share one identity, while unrelated sites receive separate variations. Your chosen regional preset stays unchanged, and manually configured Domain Rules are not fenced.",
          "Domain fencing is experimental and off by default. To try it, open Settings → Advanced → Experimental and turn on Domain fencing.",
        ],
      },
    ]);
    expect(getVersionNotices("release", "0.9.3.1")).toHaveLength(1);
  });

  it("rejects invalid entries and duplicate IDs", () => {
    const validEntry = {
      id: "release-note",
      channel: "release",
      introducedInVersion: "1.2.3",
      delivery: "upgrades-only",
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
        notifications: [{ ...validEntry, introducedInVersion: "1.2.3.4" }],
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
    const { delivery: _delivery, ...entryWithoutDelivery } = validEntry;
    expect(() =>
      parseNoticeCatalog({
        notifications: [entryWithoutDelivery],
      }),
    ).toThrow("Invalid extension notification");
    expect(() =>
      parseNoticeCatalog({
        notifications: [{ ...validEntry, delivery: "everyone" }],
      }),
    ).toThrow("Invalid extension notification");
  });
});
