import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";
import { findRuleMatches } from "../../src/shared/domain-match";
import type { DomainRule, Location } from "../../src/shared/types";

import {
  assignDomainProfile,
  assignCurrentPageProfile,
  cleanupDomainState,
  exportSettings,
  getProbeHostUrl,
  getPopupState,
  importSettings,
  openSettingsTab,
  openPopupPage,
  readFallbackSeedKey,
  readHostState,
  readNavigatorIdentity,
  readSettings,
  readSnapshot,
  reloadAfterCleanup,
  readRuleSeedKey,
  saveLocationModel,
  saveSimpleSettings,
  readWorkerSnapshot,
  waitForPersistedLocation,
} from "./extension-test.helpers";
import { ackReleaseNotices, expect, test } from "./fixtures";
import { TEST_COOKIE_FRAGMENT } from "./harness/probe-state";

test("persists settings changes and applies them to page spoofing", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const probePage = await context.newPage();
  await probePage.goto(getProbeHostUrl(serverUrl));
  const nativeIdentity = await readNavigatorIdentity(probePage);
  await probePage.close();

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await importSettings(optionsPage, {
    version: 2,
    exportedAt: new Date().toISOString(),
    locations: EXAMPLE_LOCATIONS,
    rules: [],
    osmConsent: "granted",
  });
  const updatedProfiles = EXAMPLE_LOCATIONS.map((location) =>
    location.id === "spf-warsaw"
      ? {
          ...location,
          language: "fr-FR",
          languages: ["fr-FR", "fr"],
          timeZone: "Europe/Paris",
        }
      : location,
  );
  await saveLocationModel(optionsPage, {
    locations: updatedProfiles,
    rules: [],
  });
  await waitForPersistedLocation(
    optionsPage,
    "spf-warsaw",
    (location) => location.language === "fr-FR" && location.timeZone === "Europe/Paris",
    "Edited Warsaw profile did not persist before rule assignment.",
  );
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();
  await expect
    .poll(
      async () => {
        await page.locator("#collect").click();
        const snapshot = await readSnapshot(page);
        return (
          snapshot.language === "fr-FR" &&
          snapshot.timeZone === "Europe/Paris" &&
          snapshot.webdriver === false
        );
      },
      {
        message:
          "Expected the updated location profile to propagate before asserting the snapshot.",
        timeout: 15_000,
      },
    )
    .toBe(true);

  const values = await readSnapshot(page);
  expect(values.language).toBe("fr-FR");
  expect(values.timeZone).toBe("Europe/Paris");
  expect(values.webdriver).toBe(false);
  expect(values.userAgent).toBe(nativeIdentity.userAgent);
  expect(values.userAgentData).toEqual(
    nativeIdentity.userAgentData
      ? expect.objectContaining({
          platform: nativeIdentity.userAgentData.platform,
          mobile: nativeIdentity.userAgentData.mobile,
          brands: nativeIdentity.userAgentData.brands,
        })
      : null,
  );
});

test("new identity clears site state for the current domain", async ({
  context,
  extensionId,
  serverUrl,
}, testInfo) => {
  testInfo.setTimeout(90_000);
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.locator("#seed-state").click();

  const seededState = await readHostState(page);
  expect(seededState.cookie).toContain(TEST_COOKIE_FRAGMENT);
  expect(seededState.localStorage).toBe("present");
  expect(seededState.sessionStorage).toBe("present");

  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/src/ui/popup/index.html`);
  await page.bringToFront();
  await popupPage.reload();
  const hostname = new URL(serverUrl).hostname;
  const matchedPattern = findRuleMatches(
    hostname,
    (await readSettings(popupPage)).rules,
  ).matchingRule?.pattern;
  if (!matchedPattern) {
    throw new Error(`Expected a rule matching ${hostname}.`);
  }
  const previousRuleSeedKey = await readRuleSeedKey(popupPage, matchedPattern);
  await popupPage.locator("#new-identity-current-domain").click();
  await popupPage.locator("#confirm-sheet-action").click();

  await expect
    .poll(async () => readRuleSeedKey(popupPage, matchedPattern))
    .not.toBe(previousRuleSeedKey);
  await popupPage.close();

  await expect
    .poll(
      async () => {
        const state = await reloadAfterCleanup(page, getProbeHostUrl(serverUrl));
        return {
          cookieCleaned: !state.cookie.includes(TEST_COOKIE_FRAGMENT),
          localStorage: state.localStorage,
          sessionStorage: state.sessionStorage,
        };
      },
      {
        timeout: 30_000,
        intervals: [500, 1000, 2000],
        message: "Expected state to be fully cleared after new identity.",
      },
    )
    .toEqual({
      cookieCleaned: true,
      localStorage: null,
      sessionStorage: null,
    });
});

test("cleanup-domain-state keeps the fallback seed and clears state across unmatched hosts", async ({
  context,
  extensionId,
  serverUrl,
  secondaryServerUrl,
}) => {
  const primaryHostUrl = getProbeHostUrl(serverUrl);
  const secondaryHostUrl = getProbeHostUrl(secondaryServerUrl);

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await saveLocationModel(optionsPage, {
    locations: EXAMPLE_LOCATIONS,
    rules: [],
  });
  await saveSimpleSettings(optionsPage, {
    globalFallbackRule: {
      enabled: true,
      locationId: "spf-warsaw",
    },
  });

  const previousFallbackSeedKey = await readFallbackSeedKey(optionsPage);
  expect(previousFallbackSeedKey).toMatch(/^[a-z0-9]{6}$/);

  const primaryPage = await context.newPage();
  await primaryPage.goto(primaryHostUrl);
  await primaryPage.locator("#seed-state").click();
  expect((await readHostState(primaryPage)).cookie).toContain(TEST_COOKIE_FRAGMENT);

  const secondaryPage = await context.newPage();
  await secondaryPage.goto(secondaryHostUrl);
  await secondaryPage.locator("#seed-state").click();
  expect((await readHostState(secondaryPage)).cookie).toContain(TEST_COOKIE_FRAGMENT);

  const cleanupResult = await cleanupDomainState(optionsPage, "127.0.0.1");
  const cleanedOrigins = new Set(cleanupResult.cleanedOrigins ?? []);
  expect(cleanedOrigins.has(new URL(primaryHostUrl).origin)).toBe(true);
  expect(cleanedOrigins.has(new URL(secondaryHostUrl).origin)).toBe(true);

  const nextFallbackSeedKey = await readFallbackSeedKey(optionsPage);
  expect(nextFallbackSeedKey).toBe(previousFallbackSeedKey);

  await expect
    .poll(
      async () => {
        const state = await reloadAfterCleanup(primaryPage, primaryHostUrl);
        return {
          cookieCleaned: !state.cookie.includes(TEST_COOKIE_FRAGMENT),
          localStorage: state.localStorage,
          sessionStorage: state.sessionStorage,
        };
      },
      {
        timeout: 15_000,
        intervals: [500, 1000, 2000],
        message: "Expected primary state to be fully cleared.",
      },
    )
    .toEqual({
      cookieCleaned: true,
      localStorage: null,
      sessionStorage: null,
    });

  await expect
    .poll(
      async () => {
        const state = await reloadAfterCleanup(secondaryPage, secondaryHostUrl);
        return {
          cookieCleaned: !state.cookie.includes(TEST_COOKIE_FRAGMENT),
          localStorage: state.localStorage,
          sessionStorage: state.sessionStorage,
        };
      },
      {
        timeout: 15_000,
        intervals: [500, 1000, 2000],
        message: "Expected secondary state to be fully cleared.",
      },
    )
    .toEqual({
      cookieCleaned: true,
      localStorage: null,
      sessionStorage: null,
    });

  expect(previousFallbackSeedKey).toMatch(/^[a-z0-9]{6}$/);
  expect(nextFallbackSeedKey).toMatch(/^[a-z0-9]{6}$/);

  await optionsPage.close();
});

test("supports import and export round-trips from the options page", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  const exported = await exportSettings<{
    version: 3;
    exportedAt: string;
    locations: Location[];
    rules: DomainRule[];
  }>(page);

  const nextSettings = {
    ...exported,
    locations: [
      ...exported.locations,
      {
        id: "rome",
        label: "Rome",
        latitude: 41.9028,
        longitude: 12.4964,
        accuracy: 25,
        language: "it-IT",
        languages: ["it-IT", "it"],
        timeZone: "Europe/Rome",
      },
    ],
    rules: [
      ...exported.rules,
      {
        pattern: "rome.example.com",
        locationId: "rome",
      },
    ],
  };

  await importSettings(page, nextSettings);

  const roundTrip = await exportSettings<{
    locations: Array<{ id: string; label: string }>;
    rules: Array<{ pattern: string; locationId: string }>;
  }>(page);

  expect(roundTrip.locations.some((profile) => profile.id === "rome")).toBe(true);
  expect(
    roundTrip.rules.some(
      (rule) => rule.pattern === "rome.example.com" && rule.locationId === "rome",
    ),
  ).toBe(true);
});

test("detects restrictive CSP and allows relaxation via popup notifications to enable worker spoofing", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  test.slow();
  await ackReleaseNotices(context, extensionId);
  const page = await context.newPage();

  await page.goto(`${serverUrl}/csp`);

  await assignCurrentPageProfile(context, extensionId, "Warsaw", page);
  await page.waitForLoadState("load");

  await page.locator("#collect-worker").click();

  const failedWorkerValues = await readWorkerSnapshot(page).catch((error: Error) => ({
    error: error.message,
    language: "CSP_BLOCKED",
  }));
  expect(failedWorkerValues.language).toBe("CSP_BLOCKED");

  await page.waitForLoadState("load");

  const statePage = await context.newPage();
  await statePage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await page.bringToFront();
  await expect
    .poll(
      async () => {
        const current = await getPopupState<{
          suggestions: Array<{ kind: string; status: string }>;
          notifications: Array<{ kind: string; resolvedAt: string | null }>;
        }>(statePage);
        return {
          suggestion: current.suggestions.some(
            (suggestion) =>
              suggestion.kind === "worker-csp-relaxation" &&
              suggestion.status === "pending",
          ),
          notification: current.notifications.some(
            (notification) =>
              notification.kind === "worker-csp-relaxation" &&
              notification.resolvedAt === null,
          ),
        };
      },
      {
        timeout: 15_000,
      },
    )
    .toEqual({ suggestion: true, notification: true });
  await statePage.close();

  // The runtime records the suggestion and its popup notification in two
  // consecutive storage writes. Mount the popup only after both are observable
  // so startup deterministically auto-opens the notification detail.
  const popupPage = await openPopupPage(context, extensionId, page);
  const allowWorkerSpoofing = popupPage.getByRole("button", {
    name: "Allow worker spoofing",
  });
  await expect(allowWorkerSpoofing).toBeVisible({ timeout: 10_000 });

  const navPromise = page
    .waitForNavigation({ waitUntil: "domcontentloaded" })
    .catch(() => {});
  await allowWorkerSpoofing.evaluate((node) => (node as HTMLElement).click());
  await navPromise;
  await popupPage.close();

  await page.locator("#collect-worker").click();
  const relaxedWorkerValues = await readWorkerSnapshot(page);
  expect(relaxedWorkerValues.language).toBe("pl");
  expect(relaxedWorkerValues.timeZone).toBe("Europe/Warsaw");
});

test("advanced settings allow toggling CSP relaxation manually", async ({
  context,
  extensionId,
  serverUrl,
}, testInfo) => {
  // Inherently propagation-bound: the poll loop below reloads the page until the
  // saved CSP-relaxation rule reaches the worker. This can exceed the default 30s
  // timeout, so triple it instead of papering over the propagation with retries.
  testInfo.slow();

  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(`${serverUrl}/csp`);
  await page.locator("#collect-worker").click();

  const failedWorkerValues = await readWorkerSnapshot(page).catch((error: Error) => ({
    error: error.message,
    language: "CSP_BLOCKED",
  }));
  expect(failedWorkerValues.language).toBe("CSP_BLOCKED");

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await openSettingsTab(optionsPage, "rules");
  const hostname = new URL(serverUrl).hostname;
  const matchedRule = findRuleMatches(
    hostname,
    (await readSettings(optionsPage)).rules,
  ).matchingRule;
  if (!matchedRule) {
    throw new Error(`Expected a rule matching ${hostname}.`);
  }
  await optionsPage.getByLabel(`Edit rule ${matchedRule.pattern}`).click();
  await optionsPage.locator("#open-rule-advanced-dialog").click();
  await expect(optionsPage.locator("#rule-advanced-dialog")).toBeVisible();
  await expect(optionsPage.locator("#dialog-rule-relax-csp")).toBeVisible();
  await optionsPage.locator("#dialog-rule-relax-csp").click();
  await optionsPage.locator("#confirm-rule-advanced-dialog").click();
  await expect(optionsPage.locator("#rule-advanced-dialog")).toHaveCount(0);
  await expect(optionsPage.locator("#rule-dialog")).toHaveAttribute(
    "data-state",
    "open",
  );
  await expect(optionsPage.locator("#save-rule-dialog")).toBeEnabled();
  await optionsPage.locator("#save-rule-dialog").click();
  await expect(optionsPage.locator("#rule-dialog")).toHaveCount(0);

  const exportedSettings = await exportSettings<{
    rules: Array<{
      pattern: string;
      relaxCspForWorkers?: boolean;
    }>;
  }>(optionsPage);
  expect(exportedSettings.rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        pattern: matchedRule.pattern,
        relaxCspForWorkers: true,
      }),
    ]),
  );

  await expect
    .poll(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("#collect-worker").click();

      try {
        const snapshot = await readWorkerSnapshot(page);
        return snapshot.language;
      } catch {
        return "CSP_BLOCKED";
      }
    })
    .toBe("pl");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#collect-worker").click();

  const relaxedWorkerValues = await readWorkerSnapshot(page);
  expect(relaxedWorkerValues.language).toBe("pl");
  expect(relaxedWorkerValues.timeZone).toBe("Europe/Warsaw");

  await optionsPage.close();
  await page.close();
});
