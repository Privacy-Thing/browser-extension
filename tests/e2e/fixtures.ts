import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test as base } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { deriveChromiumExtId } from "@privacy-brand/tooling-shared/chromium-extension-id";

import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";

import { startProbeServers, type StartedProbeServers } from "./harness/probe-server";

type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
  serverUrl: string;
  secondaryServerUrl: string;
  openPopup: (page: Page) => Promise<Page>;
};

type InternalFixtures = {
  probeServers: StartedProbeServers;
};

const getChromiumExtensionPath = (): string =>
  path.resolve(
    process.cwd(),
    process.env.PT_E2E_EXTENSION_PATH?.trim() || path.join("build", "chrome"),
  );

const prepareExtensionUiState = async (
  context: BrowserContext,
  extensionId: string,
): Promise<void> => {
  // Make the onboarding bypass an explicit part of the shared test harness
  // instead of an incidental side effect hidden inside popup/options tests.
  const warmPage = await context.newPage();
  try {
    await warmPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
    await warmPage.evaluate(
      async (commandType) =>
        chrome.runtime.sendMessage({ type: commandType, onboardingCompleted: true }),
      EXTENSION_COMMAND_TYPES.saveSimpleSettings,
    );
  } finally {
    await warmPage.close();
  }

  for (const page of context.pages()) {
    if (page.url().includes("/welcome/") || page.url().includes("onboarding=1")) {
      await page.close();
    }
  }
};

export const ackReleaseNotices = async (
  context: BrowserContext,
  extensionId: string,
  options: { reduceMotion?: boolean } = {},
): Promise<void> => {
  const page = await context.newPage();
  try {
    await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
    await expect
      .poll(async () =>
        page.evaluate(async (commandType) => {
          const response = await chrome.runtime.sendMessage({ type: commandType });
          return Array.isArray(response?.state?.notifications);
        }, EXTENSION_COMMAND_TYPES.getPopupState),
      )
      .toBe(true);
    const releaseNotificationIds = await page.evaluate(async (commandType) => {
      const response = await chrome.runtime.sendMessage({ type: commandType });
      return (response?.state?.notifications ?? [])
        .filter(
          (notification: { kind?: unknown }) =>
            notification.kind === "significant-update",
        )
        .map((notification: { id: string }) => notification.id);
    }, EXTENSION_COMMAND_TYPES.getPopupState);
    await page.evaluate(
      async ({ commandType, notificationIds }) => {
        await Promise.all(
          notificationIds.map((id) =>
            chrome.runtime.sendMessage({ type: commandType, id }),
          ),
        );
      },
      {
        commandType: EXTENSION_COMMAND_TYPES.markNoticeRead,
        notificationIds: releaseNotificationIds,
      },
    );
    if (options.reduceMotion !== undefined) {
      await page.evaluate(
        async ({ commandType, reduceMotion }) => {
          await chrome.runtime.sendMessage({ type: commandType, reduceMotion });
        },
        {
          commandType: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
          reduceMotion: options.reduceMotion,
        },
      );
    }
  } finally {
    await page.close();
  }
};

export const test = base.extend<ExtensionFixtures & InternalFixtures>({
  probeServers: [
    async ({ browserName: _browserName }, use) => {
      const servers = await startProbeServers({
        primaryPort: 0,
        secondaryPort: 0,
      });
      try {
        await use(servers);
      } finally {
        await servers.close();
      }
    },
    { scope: "worker" },
  ],
  serverUrl: async ({ probeServers }, use) => {
    await use(probeServers.primaryUrl);
  },
  secondaryServerUrl: async ({ probeServers }, use) => {
    await use(probeServers.secondaryUrl);
  },
  context: async ({ playwright }, use) => {
    const extensionPath = getChromiumExtensionPath();
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "pt-e2e-"));
    const context = await playwright.chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    try {
      await use(context);
    } finally {
      await context.close();
      await rm(userDataDir, { recursive: true, force: true });
    }
  },
  extensionId: async ({ context }, use) => {
    // Chromium derives an unpacked extension ID from its absolute path. Resolve it
    // directly so opening the extension page wakes MV3 instead of passively waiting
    // for a service-worker startup event that Chromium is not required to emit.
    const extensionPath = getChromiumExtensionPath();
    const extensionId = deriveChromiumExtId(extensionPath);

    await prepareExtensionUiState(context, extensionId);

    await use(extensionId);
  },
  openPopup: async ({ context, extensionId }, use) => {
    await use(async (page: Page) => {
      const popupPage = await context.newPage();
      const popupUrl = new URL(
        `chrome-extension://${extensionId}/src/ui/popup/index.html`,
      );
      await popupPage.goto(popupUrl.toString());
      const targetTabId = await popupPage.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        return tabs
          .filter((tab) => tab.url === url && typeof tab.id === "number")
          .sort(
            (left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0),
          )[0]?.id;
      }, page.url());
      if (targetTabId !== undefined) {
        popupUrl.searchParams.set("tabId", String(targetTabId));
        await popupPage.goto(popupUrl.toString());
      }
      await popupPage.bringToFront();
      return popupPage;
    });
  },
});

export { expect };
