import type { ExportedSettings } from "../../src/shared/types";

import {
  IMPORT_FIXTURE,
  REGIONAL_IMPORT_FIXTURE,
  chooseImportFile,
} from "./config-import.shared";
import {
  verifyImportAndUndo,
  verifySelectedMerge,
  verifyStaleImport,
} from "./config-import.shared";
import {
  exportSettings,
  openSettingsTab,
  saveSimpleSettings,
} from "./extension-test.helpers";
import { test, expect } from "./fixtures";

test("configuration import previews, cancels, confirms and undoes with runtime refresh", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await verifyImportAndUndo(
    await context.newPage(),
    context,
    `chrome-extension://${extensionId}`,
    serverUrl,
  );
});
test("configuration import detects newer settings and invalidates undo after an edit", async ({
  context,
  extensionId,
}) => {
  await verifyStaleImport(
    await context.newPage(),
    context,
    `chrome-extension://${extensionId}`,
  );
});
test("selected merge resolves ID/pattern conflicts and remaps dependent rules", async ({
  context,
  extensionId,
}) => {
  await verifySelectedMerge(
    await context.newPage(),
    `chrome-extension://${extensionId}`,
  );
});

test("onboarding import uses the same preview and preserves undo without an extra save", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${extensionId}/src/ui/options/index.html?onboarding=1`,
  );
  await saveSimpleSettings(page, { onboardingCompleted: false });
  await page.reload();
  const before = await exportSettings<ExportedSettings>(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("invalid json"),
  });
  await expect(page.locator("[data-import-error]")).toBeVisible();
  await page.locator("#settings-import-cancel").click();
  const afterError = await exportSettings<ExportedSettings>(page);
  expect(afterError.locations).toEqual(before.locations);
  expect(afterError.onboardingCompleted).toBe(false);
  await page.locator('input[type="file"]').setInputFiles({
    name: "settings.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...IMPORT_FIXTURE, onboardingCompleted: false }),
    ),
  });
  await expect(page.locator("#settings-import-confirm")).toBeEnabled();
  await page.locator("#settings-import-confirm").click();
  await expect(page.locator("#settings-import-dialog")).toHaveCount(0);
  await openSettingsTab(page, "advanced");
  await expect(page.locator("#undo-settings-import")).toBeEnabled();
  expect((await exportSettings<ExportedSettings>(page)).onboardingCompleted).toBe(true);
  await page.locator("#undo-settings-import").click();
  await expect(page.locator("#undo-settings-import")).toBeDisabled();
  expect((await exportSettings<ExportedSettings>(page)).onboardingCompleted).toBe(
    false,
  );
});

test("regional import advice is optional and corrections only change the shown time zone", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await saveSimpleSettings(page, { onboardingCompleted: true });
  await page.reload();
  await openSettingsTab(page, "advanced");
  const before = await exportSettings<ExportedSettings>(page);
  await chooseImportFile(page, REGIONAL_IMPORT_FIXTURE);
  await expect(page.locator('[data-regional-warning="timeZone"]')).toBeVisible();
  await expect(page.locator("#settings-import-confirm")).toBeEnabled();
  await page.locator("[data-regional-apply-timezone]").click();
  await expect(page.locator('[data-regional-warning="timeZone"]')).toHaveCount(0);
  await expect(page.locator("#settings-import-confirm")).toBeEnabled();
  expect((await exportSettings<ExportedSettings>(page)).locations).toEqual(
    before.locations,
  );
  await page.locator("#settings-import-cancel").click();
  expect((await exportSettings<ExportedSettings>(page)).locations).toEqual(
    before.locations,
  );
  await chooseImportFile(page, REGIONAL_IMPORT_FIXTURE);
  await page.locator("[data-regional-apply-timezone]").click();
  await expect(page.locator('[data-regional-warning="timeZone"]')).toHaveCount(0);
  await page.locator("#settings-import-confirm").click();
  await expect(page.locator("#settings-import-dialog")).toHaveCount(0);
  expect((await exportSettings<ExportedSettings>(page)).locations).toEqual([
    { ...REGIONAL_IMPORT_FIXTURE.locations[0], timeZone: "Europe/Paris" },
  ]);
  await chooseImportFile(page, REGIONAL_IMPORT_FIXTURE);
  await expect(page.locator('[data-regional-warning="timeZone"]')).toBeVisible();
  await page.locator("#settings-import-confirm").click();
  await expect(page.locator("#settings-import-dialog")).toHaveCount(0);
  expect((await exportSettings<ExportedSettings>(page)).locations).toEqual(
    REGIONAL_IMPORT_FIXTURE.locations,
  );
});
