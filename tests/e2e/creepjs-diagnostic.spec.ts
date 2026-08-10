import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { readSettings, saveLocationModel } from "./extension-test.helpers";

test.skip(
  process.env.PT_CREEPJS !== "1",
  "Set PT_CREEPJS=1 to run the external CreepJS diagnostic.",
);

test("diagnose creepjs headless and stealth signals with Privacy Thing", async ({
  playwright,
}) => {
  test.slow();
  test.setTimeout(150_000);

  const extensionPath = path.resolve(process.cwd(), "build", "chrome");
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "pt-creepjs-"));

  const context = await playwright.chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: process.env.PLAYWRIGHT_HEADFUL ? false : true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(serviceWorker.url()).host;

    const optionsPage = await context.newPage();
    await expect
      .poll(
        async () => {
          try {
            await optionsPage.goto(
              `chrome-extension://${extensionId}/src/ui/options/index.html`,
            );
            return true;
          } catch {
            return false;
          }
        },
        {
          timeout: 10_000,
          intervals: [500, 1000],
        },
      )
      .toBe(true);

    const currentSettings = await readSettings(optionsPage);

    const sydney = currentSettings.locations.find(
      (profile) => profile.label === "Sydney",
    );
    expect(sydney).toBeTruthy();

    if (!sydney?.id) {
      throw new Error('Expected profile "Sydney" to exist.');
    }

    await saveLocationModel(optionsPage, {
      locations: currentSettings.locations,
      rules: [{ pattern: "abrahamjuliot.github.io", locationId: sydney.id }],
    });

    const creepPage = await context.newPage();

    let fingerprint: {
      headless?: {
        headless?: Record<string, boolean>;
        headlessRating?: number;
        stealth?: Record<string, boolean>;
        stealthRating?: number;
        likeHeadless?: Record<string, boolean>;
        likeHeadlessRating?: number;
      };
    } | null = null;

    creepPage.on("console", (message) => {
      void (async () => {
        for (const arg of message.args()) {
          try {
            const value = await arg.jsonValue();
            if (
              value &&
              typeof value === "object" &&
              "headless" in value &&
              (value as { headless?: unknown }).headless &&
              typeof (value as { headless?: { headlessRating?: unknown } }).headless
                ?.headlessRating === "number"
            ) {
              fingerprint = value as typeof fingerprint;
            }
          } catch {
            // Ignore unserializable console args.
          }
        }
      })();
    });

    await creepPage.goto("https://abrahamjuliot.github.io/creepjs/", {
      waitUntil: "domcontentloaded",
    });

    await expect(creepPage.locator(".headless-rating")).toBeVisible({
      timeout: 45_000,
    });

    const visibleRatings = await creepPage.evaluate(() => ({
      headlessText:
        document
          .querySelector(".headless-rating")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? null,
      stealthText:
        document
          .querySelector(".stealth-rating")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? null,
      likeHeadlessText:
        document
          .querySelector(".like-headless-rating")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? null,
      webdriver: navigator.webdriver,
    }));

    console.log(
      "CREEPJS_DIAGNOSTIC",
      JSON.stringify(
        {
          ratings: {
            headlessText: visibleRatings.headlessText,
            stealthText: visibleRatings.stealthText,
            likeHeadlessText: visibleRatings.likeHeadlessText,
            webdriver: visibleRatings.webdriver,
          },
          headless: fingerprint?.headless ?? null,
          lies: (
            fingerprint as {
              lies?: Record<string, unknown>;
            } | null
          )?.lies?.data
            ? {
                "Function.toString":
                  (fingerprint as { lies?: { data?: Record<string, unknown> } }).lies
                    ?.data?.["Function.toString"] ?? null,
                "Navigator.webdriver":
                  (fingerprint as { lies?: { data?: Record<string, unknown> } }).lies
                    ?.data?.["Navigator.webdriver"] ?? null,
              }
            : null,
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});
