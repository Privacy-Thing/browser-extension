import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";

import { readSettings, saveLocationModel } from "./extension-test.helpers";

test.describe("live service worker blocking", () => {
  test("prevents creepjs workers.html from registering a page service worker in Chrome", async ({
    playwright,
  }) => {
    test.slow();
    test.setTimeout(150_000);

    const extensionPath = path.resolve(process.cwd(), "build", "chrome");
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "pt-sw-block-"));

    const context = await playwright.chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: process.env.PLAYWRIGHT_HEADFUL ? false : true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    try {
      const extensionWorker =
        context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
      const extensionId = new URL(extensionWorker.url()).host;

      const optionsPage = await context.newPage();
      await optionsPage.goto(
        `chrome-extension://${extensionId}/src/ui/options/index.html`,
      );

      // Seed EXAMPLE_LOCATIONS first because defaults are empty post-e559005.
      await saveLocationModel(optionsPage, {
        locations: EXAMPLE_LOCATIONS,
        rules: [],
        containerAssignments: [],
      });
      const settings = await readSettings(optionsPage);

      const warsawId = settings.locations.find(
        (location) => location.label === "Warsaw",
      )?.id;
      if (!warsawId) {
        throw new Error('Expected default "Warsaw" location to exist.');
      }

      const nextRules = [
        ...settings.rules.filter((rule) => rule.pattern !== "abrahamjuliot.github.io"),
        {
          pattern: "abrahamjuliot.github.io",
          locationId: warsawId,
          enabled: true,
          blockServiceWorkerRegistration: true,
        },
      ];

      await saveLocationModel(optionsPage, {
        locations: settings.locations,
        rules: nextRules,
      });
      await optionsPage.close();

      const page = await context.newPage();
      await page.goto("https://abrahamjuliot.github.io/creepjs/tests/workers.html", {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator("#fingerprint-data")).toBeVisible({ timeout: 30_000 });
      await expect
        .poll(
          async () =>
            page.evaluate(() => ({
              language: navigator.language,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })),
          {
            timeout: 30_000,
            intervals: [250, 500, 1_000],
          },
        )
        .toEqual({
          language: "pl",
          timeZone: "Europe/Warsaw",
        });

      const snapshot = await page.evaluate(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        let manualRegisterResult: { name: string; message: string } | "allowed";
        try {
          const registration = await navigator.serviceWorker.register(
            `worker_service.js?probe=${Date.now()}`,
            { scope: "../tests/" },
          );
          await registration.unregister();
          manualRegisterResult = "allowed";
        } catch (error) {
          manualRegisterResult = {
            name: error instanceof DOMException ? error.name : "UnknownError",
            message: error instanceof Error ? error.message : String(error),
          };
        }

        return {
          registrations: registrations.map((registration) => ({
            scope: registration.scope,
            active: registration.active?.scriptURL ?? null,
            installing: registration.installing?.scriptURL ?? null,
            waiting: registration.waiting?.scriptURL ?? null,
          })),
          manualRegisterResult,
        };
      });

      expect(snapshot.registrations).toEqual([]);
      expect(snapshot.manualRegisterResult).toMatchObject({
        name: "SecurityError",
      });
    } finally {
      await context.close();
      await rm(userDataDir, { recursive: true, force: true });
    }
  });
});
