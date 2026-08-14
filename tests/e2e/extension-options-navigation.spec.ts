import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";
import { BRAND_DISPLAY_NAME } from "../../src/shared/brand";
import {
  PAGE_ANCHORS,
  SECTION_ANCHORS,
  getLocationAnchor,
  getLocationModalAnchor,
  getRuleAnchor,
  getRuleModalAnchor,
} from "../../src/ui/options/navigation";

import {
  escapeForRegex,
  expectAnchorInViewport,
  importSettings,
  openSettingsTab,
} from "./extension-test.helpers";
import { expect, test } from "./fixtures";

test("loads the options page from the extension", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  await expect(page.locator('[data-tab="rules"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("#autosave-state")).toBeHidden();
  await expect(page.locator("#profiles-list .bg-card")).toHaveCount(0);
  await openSettingsTab(page, "rules");
  await expect(page.locator("#rules-preview-hostname")).toBeVisible();
  await expect(page.locator("#rules-preview-hostname-preview")).toHaveCount(0);
  await openSettingsTab(page, "advanced");
  await expect(page.locator("#export-settings")).toBeVisible();
  await openSettingsTab(page, "about");
  await expect(page.locator("#about-version")).toHaveText(/^\d+\.\d+/);
  await expect(page.getByRole("link", { name: "Tomasz Janusz" })).toHaveAttribute(
    "href",
    "https://tomaszjanusz.dev",
  );
  await expect(
    page.getByRole("link", { name: `${BRAND_DISPLAY_NAME} website` }),
  ).toHaveAttribute("href", "https://privacything.com");
  await expect(
    page.getByRole("link", { name: "Tomasz Janusz" }).locator(".."),
  ).toContainText(
    "This project was created by Tomasz Janusz. Copyright © 2025-present.",
  );
  await expect(
    page.getByText(/Advanced still contains other in-progress features/),
  ).toHaveCount(0);
});

test("keeps the selected settings tab in the URL across reloads", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${extensionId}/src/ui/options/index.html#${PAGE_ANCHORS.rules}`,
  );

  await expect(page.locator('[data-tab="rules"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page).toHaveURL(new RegExp(`#${escapeForRegex(PAGE_ANCHORS.rules)}$`));

  await page.reload();

  await expect(page.locator('[data-tab="rules"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page).toHaveURL(new RegExp(`#${escapeForRegex(PAGE_ANCHORS.rules)}$`));
});

test("focuses a linked profile anchor and highlights it", async ({
  context,
  extensionId,
}) => {
  const anchorId = getLocationAnchor(EXAMPLE_LOCATIONS[0]!.id);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await importSettings(page, {
    version: 2,
    exportedAt: new Date().toISOString(),
    locations: EXAMPLE_LOCATIONS,
    rules: [],
    osmConsent: "granted",
  });
  await page.reload();
  await page.goto(
    `chrome-extension://${extensionId}/src/ui/options/index.html#${anchorId}`,
  );

  await expect(page.locator('[data-tab="profiles"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("#profile-dialog")).toBeVisible();
  await expectAnchorInViewport(page, getLocationModalAnchor(EXAMPLE_LOCATIONS[0]!.id));
});

test("focuses a linked rule anchor and highlights it", async ({
  context,
  extensionId,
}) => {
  const pattern = "*.example.com";
  const anchorId = getRuleAnchor(pattern);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await importSettings(page, {
    version: 2,
    exportedAt: new Date().toISOString(),
    locations: EXAMPLE_LOCATIONS,
    rules: [{ pattern, locationId: EXAMPLE_LOCATIONS[0]!.id, enabled: true }],
    osmConsent: "granted",
  });
  await page.reload();
  await page.goto(
    `chrome-extension://${extensionId}/src/ui/options/index.html#${anchorId}`,
  );

  await expect(page.locator('[data-tab="rules"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("#rule-dialog")).toBeVisible();
  await expectAnchorInViewport(page, getRuleModalAnchor(pattern));
});

test("updates the hash when switching settings tabs", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  await openSettingsTab(page, "advanced");
  await expect(page).toHaveURL(
    new RegExp(`#${escapeForRegex(PAGE_ANCHORS.advanced)}$`),
  );

  await openSettingsTab(page, "about");
  await expect(page).toHaveURL(new RegExp(`#${escapeForRegex(PAGE_ANCHORS.about)}$`));
});

test("opens the playground from locations without reloading the options page", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  await openSettingsTab(page, "profiles");
  const marker = await page.evaluate(() => {
    const value = `marker-${Math.random().toString(36).slice(2)}`;
    (window as Window & { __gwMarker?: string }).__gwMarker = value;
    return value;
  });

  await page.getByRole("button", { name: /open playground/i }).click();

  await expect(page).toHaveURL(
    new RegExp(`#${escapeForRegex(PAGE_ANCHORS.playground)}$`),
  );
  await expect(page.locator('[data-panel="playground"]')).toBeVisible();
  await expect(
    page.evaluate(
      () => (window as Window & { __gwMarker?: string }).__gwMarker ?? null,
    ),
  ).resolves.toBe(marker);
});

test("supports browser history navigation to and from the playground", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  await openSettingsTab(page, "profiles");
  await page.getByRole("button", { name: /open playground/i }).click();
  await expect(page).toHaveURL(
    new RegExp(`#${escapeForRegex(PAGE_ANCHORS.playground)}$`),
  );

  await page.goBack();
  await expect(page).toHaveURL(
    new RegExp(`#${escapeForRegex(PAGE_ANCHORS.profiles)}$`),
  );
  await expect(page.locator('[data-tab="profiles"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.goForward();
  await expect(page).toHaveURL(
    new RegExp(`#${escapeForRegex(PAGE_ANCHORS.playground)}$`),
  );
  await expect(page.locator('[data-panel="playground"]')).toBeVisible();
});

test("navigates home from the playground when clicking the logo without reloading", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${extensionId}/src/ui/options/index.html#${PAGE_ANCHORS.playground}`,
  );

  const marker = await page.evaluate(() => {
    const value = `marker-${Math.random().toString(36).slice(2)}`;
    (window as Window & { __gwMarker?: string }).__gwMarker = value;
    return value;
  });

  await page.getByRole("link", { name: BRAND_DISPLAY_NAME }).click();

  await expect(page).toHaveURL(new RegExp(`#${escapeForRegex(PAGE_ANCHORS.rules)}$`));
  await expect(page.locator('[data-tab="rules"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.evaluate(
      () => (window as Window & { __gwMarker?: string }).__gwMarker ?? null,
    ),
  ).resolves.toBe(marker);
});

test("opens section and dynamic item hashes without anchor buttons", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  const optionsUrl = `chrome-extension://${extensionId}/src/ui/options/index.html`;
  await page.goto(optionsUrl);
  await importSettings(page, {
    version: 2,
    exportedAt: new Date().toISOString(),
    locations: EXAMPLE_LOCATIONS,
    rules: [],
    osmConsent: "granted",
  });
  await page.reload();

  const profileAnchorId = getLocationAnchor(EXAMPLE_LOCATIONS[0]!.id);
  await page.goto(`${optionsUrl}#${SECTION_ANCHORS.rules.overview}`);
  await expect(page).toHaveURL(
    new RegExp(`#${escapeForRegex(SECTION_ANCHORS.rules.overview)}$`),
  );
  await expect(page.locator('[data-tab="rules"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.locator(`[data-anchor-id="${SECTION_ANCHORS.rules.overview}"]`),
  ).toHaveClass(/gw-anchor-highlighted/);

  await page.goto(`${optionsUrl}#${profileAnchorId}`);
  await expect(page).toHaveURL(new RegExp(`#${escapeForRegex(profileAnchorId)}$`));
  await expect(page.locator('[data-tab="profiles"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(`[data-anchor-id="${profileAnchorId}"]`)).toBeVisible();
});

test("falls back gracefully when the hash target does not exist", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  const missingProfileAnchorId = getLocationAnchor("missing-profile");
  await page.goto(
    `chrome-extension://${extensionId}/src/ui/options/index.html#${missingProfileAnchorId}`,
  );

  await expect(page.locator('[data-tab="profiles"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator('[data-panel="profiles"]')).toBeVisible();
  await expect(page.locator("#profiles-list .bg-card")).toHaveCount(0);
  await expect(page.locator("#profile-dialog")).toBeHidden();
  await expect(
    page.locator(`[data-anchor-id="${missingProfileAnchorId}"]`),
  ).toHaveCount(0);
});

test("about tab includes icon font license information", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  await openSettingsTab(page, "about");
  await expect(
    page.locator('[data-panel="about"] [data-asset="font-awesome"]'),
  ).toBeVisible();
});
