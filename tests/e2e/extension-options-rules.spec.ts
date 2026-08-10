import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";

import {
  expectToast,
  exportSettings,
  importSettings,
  openSettingsTab,
  readSettings,
  saveLocationModel,
  saveSimpleSettings,
} from "./extension-test.helpers";
import { expect, test } from "./fixtures";

const domainRuleRows = (page: any) =>
  page.locator("#rules-list tbody tr").filter({
    has: page.locator('button[aria-label^="Edit rule "]'),
  });

test("keeps Default Rule enabled when its preset is unassigned", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  await saveLocationModel(page, {
    locations: EXAMPLE_LOCATIONS,
    rules: [],
  });
  await saveSimpleSettings(page, {
    globalFallbackRule: {
      enabled: true,
      locationId: "spf-warsaw",
    },
  });

  await page.reload();
  await openSettingsTab(page, "rules");

  await page.getByRole("button", { name: "Edit Default Rule" }).click();
  await expect(page.locator("#global-fallback-rule-dialog")).toBeVisible();
  await expect(page.locator("#dialog-default-rule-enabled")).toHaveAttribute(
    "data-state",
    "checked",
  );
  await expect(page.locator("#dialog-global-fallback-location")).toBeEnabled();

  const locationSelect = page.locator("#dialog-global-fallback-location");
  await locationSelect.click();
  await page.getByRole("option", { name: "No preset assigned" }).click();

  await expect(page.locator("#dialog-default-rule-enabled")).toHaveAttribute(
    "data-state",
    "checked",
  );
  await expect(locationSelect).toHaveAttribute("data-selected-value", "unassigned");

  await page.getByRole("button", { name: "Save rule" }).click();

  await expectToast(page, "Default Rule updated.");
  await expect(page.locator("#global-fallback-rule-dialog")).toHaveCount(0);

  const persisted = await readSettings(page);
  expect(persisted.globalFallbackRule).toMatchObject({
    enabled: true,
  });
  expect(persisted.globalFallbackRule?.locationId).toBeUndefined();

  const globalRuleRow = page.locator("#rules-list tbody tr[data-fallback-state]");
  await expect(globalRuleRow).toHaveAttribute("data-fallback-state", "unconfigured");
  await expect(globalRuleRow).toHaveAttribute("data-fallback-preset", "none");

  await page.getByRole("button", { name: "Edit Default Rule" }).click();
  await expect(page.locator("#dialog-default-rule-enabled")).toHaveAttribute(
    "data-state",
    "checked",
  );
  await expect(page.locator("#dialog-global-fallback-location")).toHaveAttribute(
    "data-selected-value",
    "unassigned",
  );
});

test("adds a rule through the modal dialog", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  await importSettings(page, {
    version: 2,
    exportedAt: new Date().toISOString(),
    locations: EXAMPLE_LOCATIONS,
    rules: [],
  });
  await page.reload();
  await openSettingsTab(page, "rules");

  await page.locator("#open-rule-dialog").click();
  await expect(page.locator("#dialog-rule-pattern")).toBeVisible();
  await page.locator("#dialog-rule-pattern").fill("shop.example.com");
  await page.locator("#dialog-rule-profile").click();
  await page.getByRole("option", { name: "Warsaw" }).click();
  await page.locator("#save-rule-dialog").click();

  await expectToast(page, "Rule added.");
  await expect(page.locator("#rule-dialog")).toHaveCount(0);
  const exported = await exportSettings<{
    rules: Array<{ pattern: string; locationId: string; enabled?: boolean }>;
  }>(page);
  expect(exported.rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        pattern: "shop.example.com",
        locationId: "spf-warsaw",
        enabled: true,
      }),
    ]),
  );
});

test("edits a rule enabled state through the modal dialog", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  await importSettings(page, {
    version: 2,
    exportedAt: new Date().toISOString(),
    locations: EXAMPLE_LOCATIONS,
    rules: [{ pattern: "127.0.0.1", locationId: "spf-warsaw", enabled: true }],
  });

  await page.reload();
  await openSettingsTab(page, "rules");
  await expect(domainRuleRows(page)).toHaveCount(1);
  await page.locator('[aria-label="Edit rule 127.0.0.1"]').click();
  await expect(page.locator("#rule-dialog-title")).toHaveAttribute("data-mode", "edit");
  await expect(page.locator("#dialog-rule-pattern")).toHaveValue("127.0.0.1");
  await expect(page.locator("#dialog-rule-enabled")).toBeVisible();
  await expect(page.locator("#dialog-rule-enabled")).toHaveAttribute(
    "data-state",
    "checked",
  );
  await page.locator("#dialog-rule-enabled").click();
  await page.locator("#save-rule-dialog").click();

  await expectToast(page, "Rule updated.");
  await expect(page.locator("#rule-dialog")).toHaveCount(0);
  const exportedAfterDisable = await exportSettings<{
    rules: Array<{ pattern: string; locationId: string; enabled?: boolean }>;
  }>(page);
  expect(exportedAfterDisable.rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        pattern: "127.0.0.1",
        locationId: "spf-warsaw",
        enabled: false,
      }),
    ]),
  );

  await page.reload();
  const exportedAfterReload = await exportSettings<{
    rules: Array<{ pattern: string; locationId: string; enabled?: boolean }>;
  }>(page);
  expect(exportedAfterReload.rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        pattern: "127.0.0.1",
        enabled: false,
      }),
    ]),
  );
  await expect(page.locator("#rule-dialog-title")).toHaveAttribute("data-mode", "edit");
  await expect(page.locator("#dialog-rule-enabled")).toHaveAttribute(
    "data-state",
    "unchecked",
  );
});

test("re-enables a disabled rule while its popup is open", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  test.slow();
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await importSettings(page, {
    version: 2,
    exportedAt: new Date().toISOString(),
    locations: EXAMPLE_LOCATIONS,
    rules: [{ pattern: "127.0.0.1", locationId: "spf-warsaw", enabled: false }],
  });
  await page.reload();
  await openSettingsTab(page, "rules");
  await page.locator('[aria-label="Edit rule 127.0.0.1"]').click();
  await expect(page.locator("#dialog-rule-enabled")).toHaveAttribute(
    "data-state",
    "unchecked",
  );

  const appPage = await context.newPage();
  await appPage.goto(serverUrl);

  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/src/ui/popup/index.html`);
  await appPage.bringToFront();
  await popupPage.reload();

  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "rule-inactive",
  );
  await expect(popupPage.locator("#toggle-current-rule")).toBeEnabled();

  await page.bringToFront();
  await page.locator("#dialog-rule-enabled").click();
  await page.locator("#save-rule-dialog").click();
  await expectToast(page, "Rule updated.");

  await appPage.bringToFront();
  await popupPage.reload();
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "rule-active",
  );
  await expect(popupPage.locator("#toggle-current-rule")).toHaveAttribute(
    "aria-label",
    /^Turn off /,
  );
});

test("rotates a rule Seed Key from the rule dialog without changing its assigned preset", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  await importSettings(page, {
    version: 2,
    exportedAt: new Date().toISOString(),
    locations: EXAMPLE_LOCATIONS,
    rules: [{ pattern: "127.0.0.1", locationId: "spf-warsaw", enabled: true }],
  });

  await page.reload();
  await openSettingsTab(page, "rules");
  await page.locator('[aria-label="Edit rule 127.0.0.1"]').click();

  const previousRuleSeedKey =
    (await readSettings(page)).rules?.find((rule) => rule.pattern === "127.0.0.1")
      ?.ruleSeedKey ?? null;
  expect(previousRuleSeedKey).toMatch(/^[a-z0-9]{6}$/);

  await expect(
    page.locator('#rule-dialog [data-dialog-section="identity"]'),
  ).toBeVisible();

  await page.locator('[data-dialog-section="identity"] button').click();
  await page.locator("#confirm-dialog-confirm").click();
  await expectToast(page, "Saved a new rule identity.");

  const updatedRule = (await readSettings(page)).rules?.find(
    (rule) => rule.pattern === "127.0.0.1",
  );
  expect(updatedRule?.locationId).toBe("spf-warsaw");
  expect(updatedRule?.ruleSeedKey).toMatch(/^[a-z0-9]{6}$/);
  expect(updatedRule?.ruleSeedKey).not.toBe(previousRuleSeedKey);

  await expect(page.locator("#rule-dialog")).toHaveCount(0);
});

test("supports bulk reassignment in the rules table", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  const exported = await exportSettings<{
    version: 3;
    exportedAt: string;
    locations: Array<{
      id: string;
      label: string;
      latitude: number;
      longitude: number;
      accuracy: number;
      noiseRadius?: number;
      language: string;
      languages: string[];
      timeZone: string;
    }>;
    rules: Array<{
      pattern: string;
      locationId: string;
    }>;
  }>(page);

  await importSettings(page, {
    ...exported,
    locations: [
      ...EXAMPLE_LOCATIONS,
      {
        id: "lyon",
        label: "Lyon",
        latitude: 45.764,
        longitude: 4.8357,
        accuracy: 25,
        noiseRadius: 50,
        language: "fr-FR",
        languages: ["fr-FR", "fr"],
        timeZone: "Europe/Paris",
      },
    ],
    rules: [
      { pattern: "*.example.com", locationId: "spf-warsaw" },
      { pattern: "shop.example.com", locationId: "lyon" },
    ],
  });

  await page.reload();
  await openSettingsTab(page, "rules");
  await expect(domainRuleRows(page)).toHaveCount(2);

  await page.locator('[aria-label="Select rule *.example.com"]').click();
  await page.locator("#bulk-rule-profile").click();
  await page.getByPlaceholder("Search presets...").fill("Paris");
  await page.getByRole("option", { name: "Paris" }).click();
  await expectToast(page, "Selected rules updated.");
  await page.reload();
  await openSettingsTab(page, "rules");
  await expect(
    page.locator("#rules-list tbody tr").filter({ hasText: "*.example.com" }),
  ).toContainText("Paris");
});

test("surfaces and clears the linked location filter in the rules toolbar", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  await importSettings(page, {
    version: 2,
    exportedAt: new Date().toISOString(),
    locations: EXAMPLE_LOCATIONS,
    rules: [
      { pattern: "*.example.com", locationId: "spf-warsaw", enabled: true },
      { pattern: "shop.example.com", locationId: "spf-paris", enabled: true },
    ],
  });

  await page.reload();
  await openSettingsTab(page, "profiles");
  await page
    .locator('[data-anchor-id^="location-"]')
    .filter({ hasText: "Warsaw" })
    .getByRole("link", { name: "Show 1 domain rules assigned to Warsaw" })
    .click();

  await expect(page.locator('[data-panel="rules"]')).toBeVisible();
  await expect(page.locator("#rules-location-filter")).toContainText("Warsaw");
  await expect(page.locator("#clear-rules-toolbar-filters")).toBeVisible();
  await expect(domainRuleRows(page)).toHaveCount(1);
  await expect(page.locator("#rules-list")).toContainText("*.example.com");
  await expect(page).toHaveURL(/#page-rules\?rules-location=spf-warsaw$/);

  await page.locator("#rules-filter").fill("zzzzz");

  await expect(page.locator("#clear-rules-toolbar-filters")).toBeVisible();
  await expect(domainRuleRows(page)).toHaveCount(0);

  await page.locator("#clear-rules-toolbar-filters").click();

  await expect(page.locator("#clear-rules-toolbar-filters")).toHaveCount(0);
  await expect(page.locator('[data-location-filter="all"]')).toBeVisible();
  await expect(page.locator("#rules-filter")).toHaveValue("");
  await expect(domainRuleRows(page)).toHaveCount(2);
  await expect(page).toHaveURL(/#page-rules$/);

  await page.locator("#rules-location-filter").click();
  await page.getByPlaceholder("Search presets...").fill("Paris");
  await page.getByRole("option", { name: "Paris", exact: true }).click();

  await expect(page.locator("#rules-location-filter")).toContainText("Paris");
  await expect(domainRuleRows(page)).toHaveCount(1);
  await expect(page.locator("#rules-list")).toContainText("shop.example.com");
  await expect(page).toHaveURL(/#page-rules\?rules-location=spf-paris$/);

  await page.locator("#clear-rules-toolbar-filters").click();

  await expect(page.locator("#clear-rules-toolbar-filters")).toHaveCount(0);
  await expect(page.locator('[data-location-filter="all"]')).toBeVisible();
  await expect(domainRuleRows(page)).toHaveCount(2);
  await expect(page).toHaveURL(/#page-rules$/);
});

test("uses a custom confirm dialog for bulk rule deletion", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  await importSettings(page, {
    version: 2,
    exportedAt: new Date().toISOString(),
    locations: EXAMPLE_LOCATIONS,
    rules: [
      { pattern: "*.example.com", locationId: "spf-warsaw" },
      { pattern: "shop.example.com", locationId: "spf-paris" },
    ],
  });

  await page.reload();
  await openSettingsTab(page, "rules");
  await page.locator('[aria-label="Select rule *.example.com"]').click();
  await page.locator("#delete-selected-rules").click();

  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await expect(page.locator("#confirm-dialog-title")).toHaveText(
    "Delete selected rules?",
  );
  await expect(page.locator("#confirm-dialog-description")).toContainText(
    "Delete the selected rules?",
  );

  await page.locator("#confirm-dialog-confirm").click();

  await expectToast(page, "Selected rules removed.");
  await expect(
    page.locator("#rules-list tbody tr").filter({ hasText: "*.example.com" }),
  ).toHaveCount(0);
  await expect(domainRuleRows(page)).toHaveCount(1);
});
