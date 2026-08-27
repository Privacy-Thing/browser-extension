import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadPopupNotifications,
  markNoticeRead,
  markNoticesAutoPresented,
  NOTICES_STORAGE_KEY,
  recordSiteNotice,
  resolvePopupNotification,
  selectPopupNotifications,
  syncUpdateNotices,
  syncSiteNotices,
} from "@/background/storage/popup-notifications";
import type { ReleaseNotice } from "@/shared/release-notification";

const storage = new Map<string, unknown>();

const extensionNotification = (
  id: string,
  introducedInVersion: string,
  channel: "release" | "beta" = "release",
  actionUrl: string | null = `https://example.com/changes/${id}`,
): ReleaseNotice => ({
  id,
  channel,
  introducedInVersion,
  title: id,
  message: [id],
  ...(actionUrl ? { actionUrl } : {}),
});

describe("popup notifications", () => {
  beforeEach(() => {
    storage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T20:00:00.000Z"));
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: storage.get(key) })),
          set: vi.fn(async (values: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(values)) storage.set(key, value);
          }),
        },
      },
    });
  });

  it("keeps a site warning acknowledged across later detection generations", async () => {
    const first = await recordSiteNotice({
      hostname: "example.com",
      kind: "shared-worker-injection-relaxation",
      generation: 1,
      detectedAt: "2026-07-12T20:00:00.000Z",
    });
    await markNoticeRead(first.id);
    await resolvePopupNotification(first.id);

    const rediscovered = await recordSiteNotice({
      hostname: "example.com",
      kind: "shared-worker-injection-relaxation",
      generation: 2,
      detectedAt: "2026-07-12T21:00:00.000Z",
    });

    expect(rediscovered.id).toBe(first.id);
    expect(rediscovered.generation).toBe(2);
    expect(rediscovered.readAt).not.toBeNull();
    expect(rediscovered.resolvedAt).not.toBeNull();
    expect(await loadPopupNotifications()).toHaveLength(1);
  });

  it("keeps read and resolved as separate states", async () => {
    const notification = await recordSiteNotice({
      hostname: "example.com",
      kind: "worker-csp-relaxation",
      generation: 1,
      detectedAt: "2026-07-12T20:00:00.000Z",
    });
    const read = await markNoticeRead(notification.id);

    expect(read?.readAt).not.toBeNull();
    expect(read?.resolvedAt).toBeNull();
  });

  it("deduplicates significant updates by notification ID rather than version", async () => {
    const catalog = [
      extensionNotification("release-overview", "0.9.0"),
      extensionNotification("privacy-follow-up", "0.9.0"),
    ];
    await syncUpdateNotices({
      notifications: catalog,
      buildChannel: "release",
      currentVersion: "0.9.0",
      includeCurrent: true,
    });
    await syncUpdateNotices({
      notifications: catalog,
      buildChannel: "release",
      currentVersion: "0.9.0",
      includeCurrent: true,
    });

    const notifications = await loadPopupNotifications();
    expect(notifications).toHaveLength(2);
    expect(notifications).toContainEqual(
      expect.objectContaining({
        id: "release-overview",
        scope: "extension",
        kind: "significant-update",
        channel: "release",
        introducedInVersion: "0.9.0",
      }),
    );

    const acknowledged = await markNoticeRead("release-overview");
    expect(acknowledged?.readAt).not.toBeNull();
  });

  it("recognizes a legacy version-based notification when recording its catalog ID", async () => {
    storage.set(NOTICES_STORAGE_KEY, [
      {
        id: "extension:update:0.9.0",
        kind: "significant-update",
        scope: "extension",
        dedupeKey: "extension:update:0.9.0",
        severity: "info",
        version: "0.9.0",
        createdAt: "2026-07-12T19:00:00.000Z",
        lastDetectedAt: "2026-07-12T19:00:00.000Z",
        generation: 1,
        readAt: "2026-07-12T19:05:00.000Z",
        resolvedAt: null,
        pulseShownAt: null,
        actionTarget: "https://example.com/old",
      },
    ]);

    const notifications = await syncUpdateNotices({
      notifications: [extensionNotification("release-overview", "0.9.0")],
      buildChannel: "release",
      currentVersion: "0.9.0",
      includeCurrent: true,
    });
    const notification = notifications[0]!;

    expect(notification.id).toBe("release-overview");
    expect(notification.dedupeKey).toBe("extension:update:release-overview");
    expect(notification.channel).toBe("release");
    expect(notification.introducedInVersion).toBe("0.9.0");
    expect(notification.readAt).toBe("2026-07-12T19:05:00.000Z");
    expect(notification.autoPresentedAt).toBeNull();
    expect(await loadPopupNotifications()).toHaveLength(1);
  });

  it("removes a previously stored link when the catalog notification has no action", async () => {
    await syncUpdateNotices({
      notifications: [extensionNotification("release-overview", "0.9.0")],
      buildChannel: "local",
      includeCurrent: true,
    });

    const synced = await syncUpdateNotices({
      notifications: [
        extensionNotification("release-overview", "0.9.0", "release", null),
      ],
      buildChannel: "local",
      includeCurrent: true,
    });

    expect(synced[0]?.actionTarget).toBeUndefined();
  });

  it("keeps invalid legacy versions visible without aging them", async () => {
    storage.set(NOTICES_STORAGE_KEY, [
      {
        id: "legacy-invalid",
        kind: "significant-update",
        scope: "extension",
        dedupeKey: "extension:update:legacy-invalid",
        severity: "info",
        version: "legacy",
        createdAt: "2026-07-12T19:00:00.000Z",
        lastDetectedAt: "2026-07-12T19:00:00.000Z",
        generation: 1,
        readAt: null,
        resolvedAt: null,
        pulseShownAt: null,
        actionTarget: "https://example.com/legacy",
      },
    ]);

    const synced = await syncUpdateNotices({
      notifications: [],
      buildChannel: "release",
      currentVersion: "0.10.0",
      includeCurrent: false,
    });

    expect(synced).toContainEqual(
      expect.objectContaining({
        id: "legacy-invalid",
        channel: "release",
        introducedInVersion: "legacy",
        readAt: null,
      }),
    );
  });

  it("does not add a current release notification on a fresh install or startup", async () => {
    const synced = await syncUpdateNotices({
      notifications: [extensionNotification("current-release", "0.10.0")],
      buildChannel: "release",
      currentVersion: "0.10.0",
      includeCurrent: false,
    });

    expect(synced).toEqual([]);
  });

  it("marks an auto-presented batch atomically without marking it read", async () => {
    const first = await recordSiteNotice({
      hostname: "example.com",
      kind: "worker-csp-relaxation",
      generation: 1,
      detectedAt: "2026-07-12T20:00:00.000Z",
    });
    const synced = await syncUpdateNotices({
      notifications: [extensionNotification("release-overview", "0.9.0")],
      buildChannel: "release",
      currentVersion: "0.9.0",
      includeCurrent: true,
    });
    const second = synced.find((item) => item.id === "release-overview")!;

    const updated = await markNoticesAutoPresented([first.id, second.id]);

    expect(updated).toHaveLength(2);
    expect(
      updated.every((item) => item.autoPresentedAt === "2026-07-12T20:00:00.000Z"),
    ).toBe(true);
    expect(updated.every((item) => item.readAt === null)).toBe(true);
    expect(
      (await loadPopupNotifications()).filter((item) => item.autoPresentedAt !== null),
    ).toHaveLength(2);
  });

  it("selects the active site plus extension notifications", async () => {
    await recordSiteNotice({
      hostname: "example.com",
      kind: "worker-csp-relaxation",
      generation: 1,
      detectedAt: "2026-07-12T20:00:00.000Z",
    });
    await recordSiteNotice({
      hostname: "other.example",
      kind: "worker-csp-relaxation",
      generation: 1,
      detectedAt: "2026-07-12T20:01:00.000Z",
    });
    await syncUpdateNotices({
      notifications: [extensionNotification("release-overview", "0.9.0")],
      buildChannel: "release",
      currentVersion: "0.9.0",
      includeCurrent: true,
    });

    expect(
      selectPopupNotifications(await loadPopupNotifications(), "example.com"),
    ).toHaveLength(2);
  });

  it("marks only older unread notifications from the current channel as read", async () => {
    const catalog = [
      extensionNotification("old-release", "0.9.0"),
      extensionNotification("current-release", "0.10.0"),
      extensionNotification("future-release", "0.11.0"),
      extensionNotification("old-beta", "0.2026.719.1200", "beta"),
    ];
    await syncUpdateNotices({
      notifications: catalog,
      buildChannel: "local",
      includeCurrent: true,
    });

    const synced = await syncUpdateNotices({
      notifications: catalog,
      buildChannel: "release",
      currentVersion: "0.10.0",
      includeCurrent: true,
      detectedAt: "2026-07-12T21:00:00.000Z",
    });

    expect(synced.find((item) => item.id === "old-release")?.readAt).toBe(
      "2026-07-12T21:00:00.000Z",
    );
    expect(synced.find((item) => item.id === "old-release")?.resolvedAt).toBeNull();
    expect(synced.find((item) => item.id === "current-release")?.readAt).toBeNull();
    expect(synced.find((item) => item.id === "future-release")?.readAt).toBeNull();
    expect(synced.find((item) => item.id === "old-beta")?.readAt).toBeNull();
  });

  it("does not age current-release notifications when only the metadata revision changes", async () => {
    const catalog = [
      extensionNotification("old-release", "0.9.2"),
      extensionNotification("current-release", "0.10.0"),
    ];
    await syncUpdateNotices({
      notifications: catalog,
      buildChannel: "local",
      includeCurrent: true,
    });

    const synced = await syncUpdateNotices({
      notifications: catalog,
      buildChannel: "release",
      currentVersion: "0.10.0.6",
      includeCurrent: true,
      detectedAt: "2026-07-12T21:00:00.000Z",
    });

    expect(synced.find((item) => item.id === "old-release")?.readAt).toBe(
      "2026-07-12T21:00:00.000Z",
    );
    expect(synced.find((item) => item.id === "current-release")?.readAt).toBeNull();
    expect(
      synced.find((item) => item.id === "current-release")?.introducedInVersion,
    ).toBe("0.10.0");
  });

  it("adds the matching product-version catalog entry on a revision update", async () => {
    const synced = await syncUpdateNotices({
      notifications: [
        extensionNotification("old-release", "0.9.2"),
        extensionNotification("current-release", "0.10.0"),
      ],
      buildChannel: "release",
      currentVersion: "0.10.0.1",
      includeCurrent: true,
    });

    expect(synced.map((item) => item.id)).toEqual(["current-release"]);
    expect(synced[0]?.introducedInVersion).toBe("0.10.0");
    expect(synced[0]?.readAt).toBeNull();
  });

  it("loads the full catalog in local builds without resetting persisted state", async () => {
    const initialCatalog = [
      extensionNotification("release-note", "0.10.0"),
      extensionNotification("beta-note", "0.2026.720.1530", "beta"),
    ];
    await syncUpdateNotices({
      notifications: initialCatalog,
      buildChannel: "local",
      includeCurrent: false,
    });
    await markNoticeRead("release-note");
    await resolvePopupNotification("beta-note");
    vi.setSystemTime(new Date("2026-08-20T20:00:00.000Z"));

    const synced = await syncUpdateNotices({
      notifications: [
        ...initialCatalog,
        extensionNotification("new-release-note", "0.11.0"),
      ],
      buildChannel: "local",
      includeCurrent: true,
    });

    expect(synced.find((item) => item.id === "release-note")?.readAt).not.toBeNull();
    expect(synced.find((item) => item.id === "beta-note")?.resolvedAt).not.toBeNull();
    expect(synced.find((item) => item.id === "new-release-note")?.readAt).toBeNull();
  });

  it("ages beta notifications without changing release notifications", async () => {
    const catalog = [
      extensionNotification("release-note", "0.10.0"),
      extensionNotification("old-beta", "0.2026.719.2359", "beta"),
      extensionNotification("current-beta", "0.2026.720.1", "beta"),
    ];
    await syncUpdateNotices({
      notifications: catalog,
      buildChannel: "local",
      includeCurrent: false,
    });

    const synced = await syncUpdateNotices({
      notifications: catalog,
      buildChannel: "beta",
      currentVersion: "0.2026.720.1",
      includeCurrent: true,
    });

    expect(synced.find((item) => item.id === "old-beta")?.readAt).not.toBeNull();
    expect(synced.find((item) => item.id === "current-beta")?.readAt).toBeNull();
    expect(synced.find((item) => item.id === "release-note")?.readAt).toBeNull();
  });

  it("keeps default and Firefox Container warning scopes independent", async () => {
    await recordSiteNotice({
      hostname: "example.com",
      kind: "worker-csp-relaxation",
      generation: 1,
      detectedAt: "2026-07-12T20:00:00.000Z",
    });
    await recordSiteNotice({
      hostname: "example.com",
      cookieStoreId: "firefox-container-2",
      kind: "worker-csp-relaxation",
      generation: 1,
      detectedAt: "2026-07-12T20:01:00.000Z",
    });
    const notifications = await loadPopupNotifications();

    expect(selectPopupNotifications(notifications, "example.com")).toHaveLength(1);
    expect(
      selectPopupNotifications(notifications, "example.com", "firefox-container-2"),
    ).toHaveLength(1);
    expect(
      selectPopupNotifications(notifications, "example.com", "firefox-container-2")[0]
        ?.cookieStoreId,
    ).toBe("firefox-container-2");
  });

  it("keeps acknowledged policy warnings active until the user dismisses them", async () => {
    const first = await syncSiteNotices({
      hostname: "example.com",
      applicableKinds: ["service-worker-block", "shared-worker-strict"],
      activeKinds: ["service-worker-block", "shared-worker-strict"],
    });
    await markNoticeRead("site:default:example.com:service-worker-block");
    const stable = await syncSiteNotices({
      hostname: "example.com",
      applicableKinds: ["service-worker-block", "shared-worker-strict"],
      activeKinds: ["service-worker-block", "shared-worker-strict"],
    });

    expect(first.filter((item) => item.resolvedAt === null)).toHaveLength(2);
    expect(
      stable.find((item) => item.kind === "service-worker-block")?.readAt,
    ).not.toBeNull();

    const afterReloadWithoutUsage = await syncSiteNotices({
      hostname: "example.com",
      applicableKinds: ["service-worker-block", "shared-worker-strict"],
      activeKinds: [],
    });
    expect(
      afterReloadWithoutUsage.find((item) => item.kind === "service-worker-block")
        ?.resolvedAt,
    ).toBeNull();
    expect(
      afterReloadWithoutUsage.some((item) => item.kind === "shared-worker-strict"),
    ).toBe(false);

    await resolvePopupNotification("site:default:example.com:service-worker-block");
    const afterDismiss = await syncSiteNotices({
      hostname: "example.com",
      applicableKinds: ["service-worker-block", "shared-worker-strict"],
      activeKinds: ["service-worker-block", "shared-worker-strict"],
    });
    expect(
      afterDismiss.find((item) => item.kind === "service-worker-block")?.resolvedAt,
    ).not.toBeNull();
  });

  it.each([
    ["service-worker-block", "unread"],
    ["service-worker-block", "read"],
    ["service-worker-block", "resolved"],
    ["shared-worker-strict", "unread"],
    ["shared-worker-strict", "read"],
    ["shared-worker-strict", "resolved"],
  ] as const)(
    "creates a fresh unread %s warning after a %s occurrence stops applying and is used again",
    async (kind, previousState) => {
      const notificationId = `site:default:example.com:${kind}`;
      await syncSiteNotices({
        hostname: "example.com",
        applicableKinds: [kind],
        activeKinds: [kind],
        detectedAt: "2026-07-12T20:00:00.000Z",
      });
      if (previousState === "read") {
        await markNoticeRead(notificationId);
      } else if (previousState === "resolved") {
        await resolvePopupNotification(notificationId);
      }

      const inactive = await syncSiteNotices({
        hostname: "example.com",
        applicableKinds: [],
        activeKinds: [],
        detectedAt: "2026-07-12T20:01:00.000Z",
      });
      expect(inactive.some((item) => item.kind === kind)).toBe(false);

      const reenabledBeforeUsage = await syncSiteNotices({
        hostname: "example.com",
        applicableKinds: [kind],
        activeKinds: [],
        detectedAt: "2026-07-12T20:02:00.000Z",
      });
      expect(reenabledBeforeUsage.some((item) => item.kind === kind)).toBe(false);

      const recurring = await syncSiteNotices({
        hostname: "example.com",
        applicableKinds: [kind],
        activeKinds: [kind],
        detectedAt: "2026-07-12T20:03:00.000Z",
      });
      expect(recurring.find((item) => item.kind === kind)).toMatchObject({
        createdAt: "2026-07-12T20:03:00.000Z",
        readAt: null,
        resolvedAt: null,
        autoPresentedAt: null,
        pulseShownAt: null,
      });
    },
  );

  it("removes acknowledged and dismissed policy warnings when the policy stops applying", async () => {
    await syncSiteNotices({
      hostname: "example.com",
      applicableKinds: ["service-worker-block", "shared-worker-strict"],
      activeKinds: ["service-worker-block", "shared-worker-strict"],
    });
    await markNoticeRead("site:default:example.com:service-worker-block");
    await resolvePopupNotification("site:default:example.com:shared-worker-strict");

    const inactive = await syncSiteNotices({
      hostname: "example.com",
      applicableKinds: [],
      activeKinds: [],
    });

    expect(inactive.some((item) => item.kind === "service-worker-block")).toBe(false);
    expect(inactive.some((item) => item.kind === "shared-worker-strict")).toBe(false);
  });

  it("retains acknowledged site warnings beyond the notification history window", async () => {
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    const notification = await recordSiteNotice({
      hostname: "example.com",
      kind: "worker-csp-relaxation",
      generation: 1,
      detectedAt: "2026-06-01T12:00:00.000Z",
    });
    await resolvePopupNotification(notification.id);
    vi.setSystemTime(new Date("2026-07-12T20:00:00.000Z"));

    expect(await loadPopupNotifications()).toContainEqual(
      expect.objectContaining({ id: notification.id, resolvedAt: expect.any(String) }),
    );
  });
});
