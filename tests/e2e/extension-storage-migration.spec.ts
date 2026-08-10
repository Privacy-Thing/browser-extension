import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test, type BrowserContext, type Playwright } from "@playwright/test";

import { DEFAULT_PREFERENCES } from "../../src/shared/settings-defaults";

import { openSettingsTab, readSettings } from "./extension-test.helpers";
import { buildHistoricalEntries, seedHistoricalStorage } from "./historical-storage";

const launchExtension = async (
  playwright: Playwright,
  userDataDir: string,
): Promise<BrowserContext> => {
  const extensionPath = path.resolve(process.cwd(), "build", "chrome");
  return playwright.chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
};

const getExtensionId = async (context: BrowserContext): Promise<string> => {
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  return new URL(worker.url()).host;
};

test("imports persisted settings from the retired namespace", async ({
  playwright,
}) => {
  const location = {
    id: "historical-warsaw",
    label: "Historical Warsaw",
    latitude: 52.2297,
    longitude: 21.0122,
    accuracy: 25,
    noiseRadius: 50,
    language: "pl",
    languages: ["pl"],
    timeZone: "Europe/Warsaw",
  };
  const rule = {
    pattern: "historical.example",
    locationId: location.id,
    enabled: true,
    ruleSeedKey: "abc123",
    authKey: "auth1234",
    relaxCspForWorkers: false,
  };
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "pt-migration-e2e-"));
  let context: BrowserContext | null = null;
  try {
    context = await launchExtension(playwright, userDataDir);
    const extensionId = await getExtensionId(context);
    await seedHistoricalStorage(
      context,
      extensionId,
      buildHistoricalEntries({
        locations: [location],
        rules: [rule],
        preferences: {
          ...DEFAULT_PREFERENCES,
          debugMode: true,
          onboardingCompleted: true,
        },
      }),
    );
    await context.close();

    context = await launchExtension(playwright, userDataDir);
    expect(await getExtensionId(context)).toBe(extensionId);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

    const migratedStorage = await page.evaluate(() => chrome.storage.local.get(null));
    expect(migratedStorage["pt.preferences"]).toMatchObject({ debugMode: true });

    await expect
      .poll(async () => {
        const settings = await readSettings(page);
        return {
          locations: settings.locations.map(({ label }) => label),
          rules: settings.rules.map(({ pattern }) => pattern),
          debugMode: settings.debugMode,
        };
      })
      .toEqual({
        locations: ["Historical Warsaw"],
        rules: ["historical.example"],
        debugMode: true,
      });

    await openSettingsTab(page, "profiles");
    await expect(page.locator("#profiles-list")).toContainText("Historical Warsaw");
    await openSettingsTab(page, "rules");
    await expect(
      page.locator('[aria-label="Edit rule historical.example"]'),
    ).toBeVisible();
    await openSettingsTab(page, "advanced");
    await expect(
      page.locator('[data-anchor-id="setting-debug-mode"] button[role="switch"]'),
    ).toHaveAttribute("data-state", "checked");
  } finally {
    await context?.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
