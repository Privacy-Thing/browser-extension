import { expect, type BrowserContext, type Page } from "@playwright/test";

import { EXTENSION_COMMAND_TYPES as CMD } from "../../src/shared/extension-contract";
import type { ExportedSettings } from "../../src/shared/types";

import {
  exportSettings,
  openSettingsTab,
  saveSimpleSettings,
} from "./extension-test.helpers";

export const IMPORT_FIXTURE: ExportedSettings = {
  version: 3,
  exportedAt: "2026-10-02T09:00:00Z",
  locations: [
    {
      id: "preview-profile",
      label: "Imported preset",
      latitude: 48.85,
      longitude: 2.35,
      accuracy: 25,
      noiseRadius: 50,
      language: "fr-FR",
      languages: ["fr-FR", "fr"],
      timeZone: "Europe/Paris",
      preferEnglishContent: false,
    },
  ],
  rules: [{ pattern: "127.0.0.1", locationId: "preview-profile", enabled: true }],
  trustedSites: [{ pattern: "trusted.example", enabled: true }],
  themeMode: "dark",
  highContrastExplicit: true,
  onboardingCompleted: true,
};
export const REGIONAL_IMPORT_FIXTURE: ExportedSettings = {
  ...IMPORT_FIXTURE,
  locations: [
    {
      ...IMPORT_FIXTURE.locations[0]!,
      timeZone: "Asia/Tokyo",
      preferEnglishContent: true,
    },
  ],
};
const comparable = ({ exportedAt: _exportedAt, ...settings }: ExportedSettings) =>
  settings;
export const chooseImportFile = (
  page: Page,
  settings: ExportedSettings = IMPORT_FIXTURE,
) =>
  page.locator("#import-settings-file").setInputFiles({
    name: "settings.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(settings)),
  });
const openImport = async (page: Page): Promise<void> => {
  await saveSimpleSettings(page, { onboardingCompleted: true });
  await page.reload();
  await openSettingsTab(page, "advanced");
};

export const verifyImportAndUndo = async (
  page: Page,
  context: BrowserContext,
  origin: string,
  serverUrl: string,
): Promise<void> => {
  await page.goto(`${origin}/src/ui/options/index.html`);
  await openImport(page);
  const before = await exportSettings<ExportedSettings>(page);
  await chooseImportFile(page);
  await expect(page.locator("#settings-import-dialog")).toBeVisible();
  await expect(page.locator('[data-import-change="added"]')).not.toHaveCount(0);
  expect(comparable(await exportSettings<ExportedSettings>(page))).toEqual(
    comparable(before),
  );
  await page.locator("#settings-import-cancel").click();
  expect(comparable(await exportSettings<ExportedSettings>(page))).toEqual(
    comparable(before),
  );
  await chooseImportFile(page);
  await page.locator("#settings-import-confirm").click();
  await expect(page.locator("#settings-import-dialog")).toHaveCount(0);
  await expect(page.locator("#undo-settings-import")).toBeEnabled();
  const imported = await exportSettings<ExportedSettings>(page);
  expect(imported.locations).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "preview-profile" })]),
  );
  expect(imported.rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ pattern: "127.0.0.1", locationId: "preview-profile" }),
    ]),
  );
  const probe = await context.newPage();
  await probe.goto(serverUrl);
  await expect
    .poll(() =>
      probe.evaluate(() => ({
        language: navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })),
    )
    .toEqual({ language: "fr-FR", timeZone: "Europe/Paris" });
  await probe.close();
  await page.locator("#undo-settings-import").click();
  await expect(page.locator("#undo-settings-import")).toBeDisabled();
  expect(comparable(await exportSettings<ExportedSettings>(page))).toEqual(
    comparable(before),
  );
  await page.reload();
  await openSettingsTab(page, "advanced");
  await expect(page.locator("#undo-settings-import")).toBeDisabled();
};

export const verifyStaleImport = async (
  page: Page,
  context: BrowserContext,
  origin: string,
): Promise<void> => {
  await page.goto(`${origin}/src/ui/options/index.html`);
  await openImport(page);
  await chooseImportFile(page);
  const other = await context.newPage();
  await other.goto(`${origin}/src/ui/options/index.html`);
  await saveSimpleSettings(other, { themeMode: "light" });
  await page.locator("#settings-import-confirm").click();
  await expect(page.locator("[data-import-error]")).toBeVisible();
  expect((await exportSettings<ExportedSettings>(page)).themeMode).toBe("light");
  await page.locator("#settings-import-review").click();
  await expect(page.locator("[data-import-error]")).toHaveCount(0);
  await page.locator("#settings-import-confirm").click();
  await expect(page.locator("#settings-import-dialog")).toHaveCount(0);
  await expect(page.locator("#undo-settings-import")).toBeEnabled();
  await saveSimpleSettings(other, { themeMode: "light" });
  await expect(page.locator("#undo-settings-import")).toBeDisabled();
  await other.close();
};

export const verifySelectedMerge = async (
  page: Page,
  origin: string,
): Promise<void> => {
  await page.goto(`${origin}/src/ui/options/index.html`);
  await openImport(page);
  const imported = await page.evaluate(
    async ({ type, settings }) => chrome.runtime.sendMessage({ type, settings }),
    { type: CMD.importSettings, settings: IMPORT_FIXTURE },
  );
  expect(imported.ok).toBe(true);
  await page.reload();
  await openSettingsTab(page, "advanced");
  const before = await exportSettings<ExportedSettings>(page);
  await chooseImportFile(page, {
    ...IMPORT_FIXTURE,
    locations: [
      { ...IMPORT_FIXTURE.locations[0]!, label: "Conflict preset" },
      { ...IMPORT_FIXTURE.locations[0]!, id: "skip-profile", label: "Skipped preset" },
    ],
    themeMode: "light",
  });
  await page.locator('#settings-import-dialog [role="combobox"]').first().click();
  await page.getByRole("option").nth(1).click();
  await expect(page.locator('[data-import-selection="merge"]')).toBeVisible();
  await expect(page.locator("#settings-import-confirm")).toBeDisabled();
  await page.locator('[data-import-item="preview-profile"] [role="combobox"]').click();
  await page.getByRole("option").nth(2).click();
  await page.locator('[data-import-item="skip-profile"] [role="combobox"]').click();
  await page.getByRole("option").last().click();
  await page.locator('[data-import-item="127.0.0.1"] [role="combobox"]').click();
  await page.getByRole("option").first().click();
  await expect(page.locator("#settings-import-confirm")).toBeEnabled();
  await page.locator("#settings-import-confirm").click();
  await expect(page.locator("#settings-import-dialog")).toHaveCount(0);
  const after = await exportSettings<ExportedSettings>(page);
  expect(after.locations.find((item) => item.id === "preview-profile")).toEqual(
    before.locations.find((item) => item.id === "preview-profile"),
  );
  expect(after.locations).toContainEqual(
    expect.objectContaining({ id: "preview-profile-import", label: "Conflict preset" }),
  );
  expect(after.locations.some((item) => item.id === "skip-profile")).toBe(false);
  expect(after.rules[0]?.locationId).toBe("preview-profile-import");
  expect(after.themeMode).toBe(before.themeMode);
  expect(after.trustedSites).toEqual(before.trustedSites);
  await page.locator("#undo-settings-import").click();
  await expect(page.locator("#undo-settings-import")).toBeDisabled();
  expect(comparable(await exportSettings<ExportedSettings>(page))).toEqual(
    comparable(before),
  );
};
