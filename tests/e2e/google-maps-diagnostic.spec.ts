import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";

import {
  readSettings,
  saveLocationModel,
  saveSimpleSettings,
} from "./extension-test.helpers";

const captureDiagnosticShot = async (
  page: Page,
  screenshotPath: string,
): Promise<void> => {
  try {
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
    });
    console.log(`\nScreenshot saved to ${screenshotPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`\nScreenshot skipped for ${screenshotPath}: ${message}`);
  }
};

test("diagnose Google Maps with Privacy Thing spoofing active", async ({
  playwright,
}) => {
  test.slow();
  test.setTimeout(150_000);

  const extensionPath = path.resolve(process.cwd(), "build", "chrome");
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "pt-gmaps-"));

  const context = await playwright.chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: process.env.PLAYWRIGHT_HEADFUL ? false : true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    // Get extension ID
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(serviceWorker.url()).host;

    // Warm extension
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

    // Seed EXAMPLE_LOCATIONS first because defaults are empty post-e559005.
    await saveLocationModel(optionsPage, {
      locations: EXAMPLE_LOCATIONS,
      rules: [],
      containerAssignments: [],
    });
    const currentSettings = await readSettings(optionsPage);

    const newYork = currentSettings.locations.find((loc) => loc.label === "New York");
    expect(newYork).toBeTruthy();

    // Save rule for google.com → New York
    await saveLocationModel(optionsPage, {
      locations: currentSettings.locations,
      rules: [{ pattern: "www.google.com", locationId: newYork!.id }],
      containerAssignments: currentSettings.containerAssignments,
    });
    await saveSimpleSettings(optionsPage, {
      themeMode: currentSettings.themeMode as "light" | "dark" | "system",
      debugMode: true,
      watchPositionDelay: currentSettings.watchPositionDelay,
    });
    await optionsPage.close();

    // Navigate to Google Maps and collect console messages
    const mapsPage = await context.newPage();
    const consoleMessages: Array<{
      type: string;
      text: string;
      location: string;
    }> = [];

    mapsPage.on("console", (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text().slice(0, 500),
        location: msg.location().url?.slice(0, 200) ?? "",
      });
    });

    mapsPage.on("pageerror", (error) => {
      consoleMessages.push({
        type: "PAGE_ERROR",
        text: error.message.slice(0, 500),
        location: error.stack?.slice(0, 300) ?? "",
      });
    });

    // Catch unhandled promise rejections (not caught by pageerror)
    const unhandledRejections: string[] = [];
    await mapsPage.exposeFunction("__gw_rejection", (msg: string) => {
      unhandledRejections.push(msg);
    });
    await mapsPage.addInitScript(() => {
      window.addEventListener("unhandledrejection", (e) => {
        (window as any).__gw_rejection(
          `${e.reason?.message ?? e.reason ?? "unknown"} | ${e.reason?.stack?.slice(0, 300) ?? ""}`,
        );
      });
    });

    // Monitor failed network requests
    const failedRequests: Array<{ url: string; status: number; failure: string }> = [];
    mapsPage.on("requestfailed", (req) => {
      failedRequests.push({
        url: req.url().slice(0, 200),
        status: 0,
        failure: req.failure()?.errorText ?? "unknown",
      });
    });
    mapsPage.on("response", (res) => {
      if (res.status() >= 400) {
        failedRequests.push({
          url: res.url().slice(0, 200),
          status: res.status(),
          failure: `HTTP ${res.status()}`,
        });
      }
    });

    await mapsPage.goto("https://www.google.com/maps", {
      waitUntil: "domcontentloaded",
    });

    // Dismiss Google consent screen if present
    try {
      const consentButton = mapsPage
        .locator(
          'button:has-text("Odrzuć wszystko"), button:has-text("Reject all"), button:has-text("Accept all"), button:has-text("Zaakceptuj wszystko"), form[action*="consent"] button',
        )
        .first();
      await consentButton.waitFor({ timeout: 5_000 });
      await consentButton.click();
      console.log("Consent screen dismissed");
      // Wait for redirect/reload after consent
      await mapsPage.waitForURL(
        (url) =>
          url.hostname === "www.google.com" &&
          (url.pathname === "/maps" || url.pathname.startsWith("/maps/")),
        { timeout: 10_000 },
      );
    } catch {
      console.log("No consent screen detected");
    }

    // Wait for Maps to fully initialize
    await expect(
      mapsPage.locator("#searchboxinput, #searchbox, input[name='q']").first(),
    ).toBeVisible({
      timeout: 30_000,
    });

    // Check for errors
    const errors = consoleMessages.filter(
      (msg) => msg.type === "error" || msg.type === "PAGE_ERROR",
    );

    console.log("\n=== CONSOLE ERRORS ===");
    for (const err of errors) {
      console.log(`[${err.type}] ${err.text}`);
      if (err.location) console.log(`  at: ${err.location}`);
    }
    console.log(`\nTotal errors: ${errors.length}`);
    console.log(`Total console messages: ${consoleMessages.length}`);

    // Dump warnings too — they may indicate initialization issues
    const warnings = consoleMessages.filter((msg) => msg.type === "warning");
    if (warnings.length > 0) {
      console.log(`\n=== WARNINGS (${warnings.length}) ===`);
      for (const w of warnings.slice(0, 20)) {
        console.log(`[warn] ${w.text}`);
      }
    }

    // Check for Refract log messages
    const spoofLogs = consoleMessages.filter(
      (msg) => msg.text.includes("Refract") || msg.text.includes("Privacy Thing"),
    );
    console.log(`\n=== SPOOF LOGS (${spoofLogs.length}) ===`);
    for (const s of spoofLogs.slice(0, 10)) {
      console.log(`[${s.type}] ${s.text}`);
    }

    // Check if Maps UI loaded
    const hasSearchBox = await mapsPage
      .locator('#searchboxinput, #searchbox, input[name="q"]')
      .first()
      .isVisible()
      .catch(() => false);

    // Bottom-right controls: location button (my location dot), zoom in/out
    const bottomRightControls = await mapsPage
      .locator(
        '#widget-mylocation, [data-tooltip*="location"], [aria-label*="location"], [data-value="Twoja lokalizacja"], [data-value="Your location"]',
      )
      .count()
      .catch(() => 0);

    const zoomIn = await mapsPage
      .locator(
        '#widget-zoom-in, [aria-label*="Zoom in"], [aria-label*="Powiększ"], button[jsaction*="zoom.in"]',
      )
      .count()
      .catch(() => 0);

    const zoomOut = await mapsPage
      .locator(
        '#widget-zoom-out, [aria-label*="Zoom out"], [aria-label*="Pomniejsz"], button[jsaction*="zoom.out"]',
      )
      .count()
      .catch(() => 0);

    console.log("\n=== UI STATE ===");
    console.log(`Search box visible: ${hasSearchBox}`);
    console.log(`Location button count: ${bottomRightControls}`);
    console.log(`Zoom in count: ${zoomIn}`);
    console.log(`Zoom out count: ${zoomOut}`);

    // Report unhandled rejections
    if (unhandledRejections.length > 0) {
      console.log(`\n=== UNHANDLED REJECTIONS (${unhandledRejections.length}) ===`);
      for (const r of unhandledRejections) {
        console.log(`  ${r}`);
      }
    } else {
      console.log("\n=== NO UNHANDLED REJECTIONS ===");
    }

    // Report failed network requests
    if (failedRequests.length > 0) {
      console.log(`\n=== FAILED REQUESTS (${failedRequests.length}) ===`);
      for (const r of failedRequests.slice(0, 30)) {
        console.log(`  [${r.status || r.failure}] ${r.url}`);
      }
    } else {
      console.log("\n=== NO FAILED REQUESTS ===");
    }

    // Check for iframe issues
    const iframeCount = await mapsPage.evaluate(() => {
      const iframes = document.querySelectorAll("iframe");
      return Array.from(iframes).map((f) => ({
        src: f.src?.slice(0, 150) ?? "",
        id: f.id,
        visible: f.offsetParent !== null,
        width: f.offsetWidth,
        height: f.offsetHeight,
      }));
    });
    console.log(`\n=== IFRAMES (${iframeCount.length}) ===`);
    for (const f of iframeCount) {
      console.log(
        `  #${f.id} ${f.width}x${f.height} visible=${f.visible} src=${f.src}`,
      );
    }

    // Check if the WebGL canvas exists (map tile renderer)
    const canvasCount = await mapsPage.locator("canvas").count();
    console.log(`\nCanvas elements: ${canvasCount}`);

    // Dump all interactive elements in the bottom-right area
    const allButtons = await mapsPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
      return buttons
        .map((b) => ({
          tag: b.tagName,
          ariaLabel: b.getAttribute("aria-label") ?? "",
          id: b.id,
          dataTooltip: b.getAttribute("data-tooltip") ?? "",
          visible: b.offsetParent !== null,
          rect: b.getBoundingClientRect(),
        }))
        .filter((b) => b.rect.right > 600 && b.rect.bottom > 400)
        .map(
          (b) =>
            `${b.tag}#${b.id} aria="${b.ariaLabel}" tooltip="${b.dataTooltip}" visible=${b.visible} (${Math.round(b.rect.left)},${Math.round(b.rect.top)})`,
        );
    });

    console.log(`\n=== BOTTOM-RIGHT BUTTONS (${allButtons.length}) ===`);
    for (const btn of allButtons) {
      console.log(`  ${btn}`);
    }

    // Total button and all elements count — compare ON vs OFF
    const totalButtons = await mapsPage.locator("button").count();
    const totalDivs = await mapsPage.evaluate(
      () => document.querySelectorAll("div").length,
    );
    console.log(`\nTotal buttons on page: ${totalButtons}`);
    console.log(`Total divs on page: ${totalDivs}`);

    // Check self.location in a worker to verify our patch
    const workerLocationTest = await mapsPage.evaluate(() => {
      return new Promise<string>((resolve) => {
        const workerCode = `self.postMessage(JSON.stringify({
          href: self.location.href,
          origin: self.location.origin,
          search: self.location.search,
          pathname: self.location.pathname
        }));`;
        const blob = new Blob([workerCode], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const w = new Worker(url);
        w.onmessage = (e) => {
          w.terminate();
          URL.revokeObjectURL(url);
          resolve(e.data as string);
        };
        w.onerror = () => resolve("WORKER_ERROR");
      });
    });

    console.log("\n=== WORKER LOCATION TEST ===");
    console.log(workerLocationTest);

    // Take a screenshot for visual inspection
    await captureDiagnosticShot(mapsPage, "build/test-results/google-maps-spoofed.png");

    // === NOW TEST WITHOUT SPOOFING ===
    // Remove the rule so spoofing is inactive
    const optionsPage2 = await context.newPage();
    await optionsPage2.goto(
      `chrome-extension://${extensionId}/src/ui/options/index.html`,
    );
    await saveLocationModel(optionsPage2, {
      locations: currentSettings.locations,
      rules: [],
      containerAssignments: currentSettings.containerAssignments,
    });
    await saveSimpleSettings(optionsPage2, {
      themeMode: currentSettings.themeMode as "light" | "dark" | "system",
      debugMode: currentSettings.debugMode,
      watchPositionDelay: currentSettings.watchPositionDelay,
    });
    await optionsPage2.close();

    // Navigate to Maps WITHOUT spoofing
    const mapsPageOff = await context.newPage();
    await mapsPageOff.goto("https://www.google.com/maps", {
      waitUntil: "domcontentloaded",
    });

    // Dismiss consent if it appears again
    try {
      const consentBtn = mapsPageOff
        .locator(
          'button:has-text("Odrzuć wszystko"), button:has-text("Reject all"), button:has-text("Accept all"), button:has-text("Zaakceptuj wszystko"), form[action*="consent"] button',
        )
        .first();
      await consentBtn.waitFor({ timeout: 5_000 });
      await consentBtn.click();
      await mapsPageOff.waitForURL(
        (url) =>
          url.hostname === "www.google.com" &&
          (url.pathname === "/maps" || url.pathname.startsWith("/maps/")),
        { timeout: 10_000 },
      );
    } catch {
      /* no consent */
    }

    await expect(
      mapsPageOff.locator("#searchboxinput, #searchbox, input[name='q']").first(),
    ).toBeVisible({
      timeout: 30_000,
    });

    const offButtons = await mapsPageOff.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
      return buttons
        .map((b) => ({
          tag: b.tagName,
          ariaLabel: b.getAttribute("aria-label") ?? "",
          id: b.id,
          dataTooltip: b.getAttribute("data-tooltip") ?? "",
          visible: b.offsetParent !== null,
          rect: b.getBoundingClientRect(),
        }))
        .filter((b) => b.rect.right > 600 && b.rect.bottom > 400)
        .map(
          (b) =>
            `${b.tag}#${b.id} aria="${b.ariaLabel}" tooltip="${b.dataTooltip}" visible=${b.visible} (${Math.round(b.rect.left)},${Math.round(b.rect.top)})`,
        );
    });

    console.log(`\n=== OFF: BOTTOM-RIGHT BUTTONS (${offButtons.length}) ===`);
    for (const btn of offButtons) {
      console.log(`  ${btn}`);
    }

    await captureDiagnosticShot(
      mapsPageOff,
      "build/test-results/google-maps-nospoofing.png",
    );

    console.log("\n=== DONE ===");
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});
