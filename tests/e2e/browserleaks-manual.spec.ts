import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

import { readSettings, saveLocationModel } from "./extension-test.helpers";
import { test } from "./fixtures";

const BROWSERLEAKS_MANUAL = process.env.PT_BROWSERLEAKS === "1";
const OUTPUT_DIR = path.resolve(process.cwd(), "build", "playwright", "browserleaks");

const assignDomainProfile = async (
  extensionId: string,
  context: BrowserContext,
  hostname: string,
  profileLabel: string,
): Promise<void> => {
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  const settings = await readSettings(optionsPage);

  const profileId = settings.locations.find(
    (profile) => profile.label === profileLabel,
  )?.id;
  if (!profileId) {
    throw new Error(`Expected profile "${profileLabel}" to exist`);
  }

  const nextRules = [
    ...settings.rules.filter((rule) => rule.pattern !== hostname),
    {
      pattern: hostname,
      locationId: profileId,
    },
  ];

  await saveLocationModel(optionsPage, {
    locations: settings.locations,
    rules: nextRules,
  });

  await optionsPage.close();
};

const captureArtifact = async (
  page: Page,
  slug: string,
): Promise<{
  runtimeSnapshot: {
    runtimeInstalled: boolean;
    runtimePresent: boolean;
    language: string;
    languages: string[];
    timeZone: string;
    userAgent: string;
    platform: string;
    webdriver: boolean;
    permissions: string;
  };
  comparison: Record<string, boolean> | null;
}> => {
  const bodyText = await page.locator("body").innerText();
  const runtimeSnapshot = await page.evaluate(async () => {
    const permissions =
      "permissions" in navigator
        ? await navigator.permissions
            .query({ name: "geolocation" })
            .then((status) => status.state)
            .catch((error) =>
              error instanceof Error
                ? `error:${error.message}`
                : `error:${String(error)}`,
            )
        : "missing";

    return {
      runtimeInstalled: Boolean(
        (
          globalThis as typeof globalThis & {
            __PT_RUNTIME_INSTALLED__?: boolean;
          }
        ).__PT_RUNTIME_INSTALLED__,
      ),
      runtimePresent: Boolean(
        (
          globalThis as typeof globalThis & {
            __PT_RUNTIME__?: unknown;
          }
        ).__PT_RUNTIME__,
      ),
      language: navigator.language,
      languages: navigator.languages,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      webdriver: navigator.webdriver,
      permissions,
    };
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${slug}.png`),
    fullPage: true,
  });
  await writeFile(path.join(OUTPUT_DIR, `${slug}.txt`), bodyText, "utf8");
  await writeFile(
    path.join(OUTPUT_DIR, `${slug}.runtime.json`),
    JSON.stringify(runtimeSnapshot, null, 2),
    "utf8",
  );

  let comparison: Record<string, boolean> | null = null;

  if (slug === "javascript") {
    const normalizedBody = bodyText.replace(/\s+/g, " ");
    comparison = {
      languageMatches: normalizedBody.includes(runtimeSnapshot.language),
      timeZoneMatches: normalizedBody.includes(runtimeSnapshot.timeZone),
      platformMatches: normalizedBody.includes(runtimeSnapshot.platform),
      userAgentMatches: normalizedBody.includes(runtimeSnapshot.userAgent),
      webdriverLooksPatched:
        !normalizedBody.includes("webdriver true") &&
        !normalizedBody.includes("webdriver\ttrue"),
    };
    await writeFile(
      path.join(OUTPUT_DIR, `${slug}.comparison.json`),
      JSON.stringify(comparison, null, 2),
      "utf8",
    );
  }

  if (slug === "geo") {
    const normalizedBody = bodyText.replace(/\s+/g, " ");
    const latitudeMatch = bodyText.match(/Latitude\s+(-?\d+(?:\.\d+)?)/);
    const longitudeMatch = bodyText.match(/Longitude\s+(-?\d+(?:\.\d+)?)/);
    const latitude = latitudeMatch ? Number(latitudeMatch[1]) : null;
    const longitude = longitudeMatch ? Number(longitudeMatch[1]) : null;
    comparison = {
      permissionGranted: normalizedBody.includes('"granted"'),
      permissionDenied: normalizedBody.includes('"denied"'),
      latitudeLooksSpoofed: latitude !== null && Math.abs(latitude - 52.2297) < 0.02,
      longitudeLooksSpoofed: longitude !== null && Math.abs(longitude - 21.0122) < 0.02,
      hasPermissionDeniedError: normalizedBody.includes("PERMISSION_DENIED"),
    };
    await writeFile(
      path.join(OUTPUT_DIR, `${slug}.comparison.json`),
      JSON.stringify(comparison, null, 2),
      "utf8",
    );
  }

  return {
    runtimeSnapshot,
    comparison,
  };
};

test.describe("manual browserleaks acceptance", () => {
  test.skip(
    !BROWSERLEAKS_MANUAL,
    "Set PT_BROWSERLEAKS=1 to run live BrowserLeaks checks.",
  );
  test.describe.configure({ mode: "serial" });

  test("captures javascript report with an active profile", async ({
    context,
    extensionId,
  }) => {
    test.slow();
    const page = await context.newPage();
    await page.goto("https://browserleaks.com/javascript", {
      waitUntil: "domcontentloaded",
    });
    await assignDomainProfile(extensionId, context, "browserleaks.com", "Warsaw");
    await page.waitForLoadState("domcontentloaded");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#js-detect")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/browserleaks\.com\/javascript/);
    const artifact = await captureArtifact(page, "javascript");
    expect(artifact.runtimeSnapshot.timeZone).toBe("Europe/Warsaw");
    expect(artifact.runtimeSnapshot.webdriver).toBe(false);
    expect(artifact.comparison).toEqual(
      expect.objectContaining({
        timeZoneMatches: true,
        platformMatches: true,
        userAgentMatches: true,
        webdriverLooksPatched: true,
      }),
    );
  });

  test("captures geolocation report with an active profile", async ({
    context,
    extensionId,
  }) => {
    test.slow();
    const page = await context.newPage();
    await page.goto("https://browserleaks.com/geo", {
      waitUntil: "domcontentloaded",
    });
    await assignDomainProfile(extensionId, context, "browserleaks.com", "Warsaw");
    await page.waitForLoadState("domcontentloaded");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#geo-perm")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/browserleaks\.com\/geo/);
    const artifact = await captureArtifact(page, "geo");
    expect(artifact.runtimeSnapshot.permissions).toBe("granted");
    expect(artifact.comparison).toEqual(
      expect.objectContaining({
        permissionGranted: true,
        latitudeLooksSpoofed: true,
        longitudeLooksSpoofed: true,
        hasPermissionDeniedError: false,
      }),
    );
  });
});
