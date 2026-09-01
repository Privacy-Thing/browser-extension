import { readFileSync } from "node:fs";

import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";
import { compareNoticeVersions } from "../../src/shared/notification-version";

import { expect, test } from "./fixtures";

type NotificationSnapshot = {
  id: string;
  introducedInVersion: string;
  readAt: string | null;
  resolvedAt: string | null;
  autoPresentedAt: string | null;
};

type CatalogNotification = {
  id: string;
  channel: "release" | "beta";
  introducedInVersion: string;
  delivery: "all-current-users" | "upgrades-only";
};

const notificationCatalog = JSON.parse(
  readFileSync(
    new URL("../../src/shared/extension-notifications.json", import.meta.url),
    "utf8",
  ),
) as { notifications: CatalogNotification[] };
const packageVersion = (
  JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

test("fresh release installs present the current announcement and retain history", async ({
  context,
  extensionId,
}) => {
  const controlPage = await context.newPage();
  await controlPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const manifest = await controlPage.evaluate(() => chrome.runtime.getManifest());
  const manifestVersion = manifest.version;
  expect(manifestVersion).toBe(packageVersion);
  expect(manifest.version_name).toBeUndefined();
  const expectedCatalog = notificationCatalog.notifications.filter(
    (notification) =>
      notification.channel === "release" &&
      compareNoticeVersions(
        "release",
        notification.introducedInVersion,
        manifestVersion,
      ) !== 1,
  );
  const expectedAutoPresentedIds = expectedCatalog
    .filter(
      (notification) =>
        notification.delivery === "all-current-users" &&
        compareNoticeVersions(
          "release",
          notification.introducedInVersion,
          manifestVersion,
        ) === 0,
    )
    .map((notification) => notification.id);

  await expect
    .poll(async () =>
      controlPage.evaluate(async (commandType) => {
        const response = await chrome.runtime.sendMessage({ type: commandType });
        return (response?.state?.notifications ?? []).filter(
          (notification: { kind?: unknown }) =>
            notification.kind === "significant-update",
        ).length;
      }, EXTENSION_COMMAND_TYPES.getPopupState),
    )
    .toBe(expectedCatalog.length);

  const initialNotifications = await controlPage.evaluate(async (commandType) => {
    const response = await chrome.runtime.sendMessage({ type: commandType });
    return (response?.state?.notifications ?? [])
      .filter(
        (notification: { kind?: unknown }) =>
          notification.kind === "significant-update",
      )
      .map((notification: NotificationSnapshot): NotificationSnapshot => ({
        id: notification.id,
        introducedInVersion: notification.introducedInVersion,
        readAt: notification.readAt,
        resolvedAt: notification.resolvedAt,
        autoPresentedAt: notification.autoPresentedAt,
      }));
  }, EXTENSION_COMMAND_TYPES.getPopupState);
  const initialById = new Map(
    initialNotifications.map((notification) => [notification.id, notification]),
  );

  expect([...initialById.keys()].sort()).toEqual(
    expectedCatalog.map((notification) => notification.id).sort(),
  );
  for (const notification of expectedCatalog) {
    const stored = initialById.get(notification.id);
    expect(stored?.resolvedAt).toBeNull();
    if (expectedAutoPresentedIds.includes(notification.id)) {
      expect(stored?.readAt).toBeNull();
      expect(stored?.autoPresentedAt).toBeNull();
    } else {
      expect(stored?.readAt).not.toBeNull();
      expect(stored?.autoPresentedAt).not.toBeNull();
    }
  }

  const firstPopup = await context.newPage();
  await firstPopup.goto(`chrome-extension://${extensionId}/src/ui/popup/index.html`);
  await expect(firstPopup.locator("#open-notifications")).toBeVisible();

  if (expectedAutoPresentedIds.length === 1) {
    const currentId = expectedAutoPresentedIds[0]!;
    await expect(
      firstPopup.locator(`[data-notification-id="${currentId}"]`),
    ).toBeVisible();
    await expect
      .poll(async () =>
        controlPage.evaluate(
          async ({ commandType, id }) => {
            const response = await chrome.runtime.sendMessage({ type: commandType });
            return response?.state?.notifications?.find(
              (notification: { id?: unknown }) => notification.id === id,
            )?.readAt;
          },
          { commandType: EXTENSION_COMMAND_TYPES.getPopupState, id: currentId },
        ),
      )
      .not.toBeNull();
  } else if (expectedAutoPresentedIds.length > 1) {
    for (const currentId of expectedAutoPresentedIds) {
      await expect(
        firstPopup.locator(`[data-notification-id="${currentId}"]`),
      ).toBeVisible();
    }
  }
  await firstPopup.close();

  const secondPopup = await context.newPage();
  await secondPopup.goto(`chrome-extension://${extensionId}/src/ui/popup/index.html`);
  await expect(secondPopup.locator("#open-notifications")).toBeVisible();
  for (const currentId of expectedAutoPresentedIds) {
    await expect(
      secondPopup.locator(
        `[data-notification-view="detail"][data-notification-id="${currentId}"]`,
      ),
    ).toHaveCount(0);
  }

  await secondPopup.locator("#open-notifications").click();
  const expectedHistoryCount =
    expectedCatalog.length -
    (expectedAutoPresentedIds.length > 1 ? expectedAutoPresentedIds.length : 0);
  const history = secondPopup.locator('[data-notification-history="extension"]');
  if (expectedHistoryCount > 0) {
    await expect(history.locator("[data-notification-id]")).toHaveCount(
      expectedHistoryCount,
    );
  } else {
    await expect(history).toHaveCount(0);
  }
});
