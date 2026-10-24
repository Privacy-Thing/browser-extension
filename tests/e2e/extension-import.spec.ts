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

test("two regional corrections in one tick are both kept", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await saveSimpleSettings(page, { onboardingCompleted: true });
  await page.reload();
  await openSettingsTab(page, "advanced");
  await chooseImportFile(page, {
    ...REGIONAL_IMPORT_FIXTURE,
    rules: [],
    locations: ["a", "b", "c"].map((id) => ({
      ...REGIONAL_IMPORT_FIXTURE.locations[0]!,
      id,
      label: id,
    })),
  });
  await expect(page.locator('[data-regional-warning="timeZone"]')).toHaveCount(3);
  await page.evaluate(() => {
    for (const id of ["a", "b"])
      document
        .querySelector<HTMLElement>(
          `[data-regional-profile="${id}"] [data-regional-apply-timezone]`,
        )
        ?.click();
  });
  await expect(page.locator('[data-regional-warning="timeZone"]')).toHaveCount(1);
  await expect(
    page.locator('[data-regional-profile="c"] [data-regional-warning="timeZone"]'),
  ).toBeVisible();
});

test("import offers a supported time zone for each rejected preset and previews the corrected file", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await saveSimpleSettings(page, { onboardingCompleted: true });
  await page.reload();
  await openSettingsTab(page, "advanced");
  const before = await exportSettings<ExportedSettings>(page);
  const preset = IMPORT_FIXTURE.locations[0]!;
  await chooseImportFile(page, {
    ...IMPORT_FIXTURE,
    locations: [
      { ...preset, id: "mars", label: "Mars", timeZone: "Mars/Olympus" },
      { ...preset, id: "venus", label: "Venus", timeZone: "Venus/Cloud" },
    ],
    rules: [],
  });
  const error = page.locator("[data-import-error]");
  await expect(error).toBeVisible();
  await expect(error).toHaveAttribute("role", "alert");
  const item = error.locator("[data-import-error-item]");
  await expect(item).toHaveCount(2);
  await expect(item.first()).toHaveAttribute("data-import-error-item", "timeZone");
  await expect(item.first()).toContainText("Mars/Olympus");
  await expect(item.first()).not.toContainText('"code"');
  await expect(error.locator("[data-import-error-hint]")).toHaveCount(0);
  await expect(error.locator("[data-import-error-details] pre")).toBeHidden();
  const mars = page.locator('[data-import-time-zone-correction="mars"]');
  const venus = page.locator('[data-import-time-zone-correction="venus"]');
  await expect(mars).toHaveAttribute("data-import-rejected-time-zone", "Mars/Olympus");
  await expect(venus).toHaveAttribute("data-import-time-zone-state", "missing");
  await expect(page.locator("#settings-import-confirm")).toBeDisabled();
  const choose = async (row: typeof mars, timeZone: string) => {
    await row.getByRole("combobox").click();
    await page.locator(`[data-combobox-option-value="${timeZone}"]`).click();
  };
  await choose(mars, "Asia/Tokyo");
  await expect(mars).toHaveAttribute("data-import-time-zone-state", "chosen");
  await expect(error).toBeVisible();
  await expect(page.locator("#settings-import-confirm")).toBeDisabled();
  await choose(venus, "Europe/Paris");
  await expect(error).toHaveCount(0);
  await expect(
    page.locator('[data-regional-profile="mars"] [data-regional-warning="timeZone"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-regional-profile="venus"] [data-regional-warning]'),
  ).toHaveCount(0);
  await expect(page.locator("#settings-import-confirm")).toBeEnabled();
  await choose(mars, "Europe/Paris");
  await expect(
    page.locator('[data-regional-profile="mars"] [data-regional-warning="timeZone"]'),
  ).toHaveCount(0);
  await expect(page.locator("#settings-import-confirm")).toBeEnabled();
  expect((await exportSettings<ExportedSettings>(page)).locations).toEqual(
    before.locations,
  );
  await page.locator("#settings-import-confirm").click();
  await expect(page.locator("#settings-import-dialog")).toHaveCount(0);
  expect(
    (await exportSettings<ExportedSettings>(page)).locations.map((location) => [
      location.id,
      location.timeZone,
    ]),
  ).toEqual([
    ["mars", "Europe/Paris"],
    ["venus", "Europe/Paris"],
  ]);
});

test("regional import flags coordinates outside land instead of suggesting an Etc zone", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await saveSimpleSettings(page, { onboardingCompleted: true });
  await page.reload();
  await openSettingsTab(page, "advanced");
  const at = (latitude: number, longitude: number, timeZone: string) => ({
    ...REGIONAL_IMPORT_FIXTURE,
    locations: [
      { ...REGIONAL_IMPORT_FIXTURE.locations[0]!, latitude, longitude, timeZone },
    ],
  });
  for (const [latitude, longitude, timeZone] of [
    [0, 48.8566, "UTC"],
    [30, -40, "Europe/Warsaw"],
  ] as const) {
    await chooseImportFile(page, at(latitude, longitude, timeZone));
    await expect(page.locator('[data-regional-warning="coordinates"]')).toBeVisible();
    await expect(page.locator('[data-regional-warning="timeZone"]')).toHaveCount(0);
    await expect(page.locator("[data-regional-apply-timezone]")).toHaveCount(0);
    await expect(page.locator("#settings-import-confirm")).toBeEnabled();
    await page.locator("#settings-import-cancel").click();
  }
});
