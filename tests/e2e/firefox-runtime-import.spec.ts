import { expect } from "@playwright/test";

import { EXTENSION_COMMAND_TYPES as CMD } from "../../src/shared/extension-contract";
import type { ExportedSettings } from "../../src/shared/types";

import { IMPORT_FIXTURE } from "./config-import.shared";
import { openFxOptionsProbe, test } from "./firefox-runtime.shared";

const createImportDriver = (ui: Awaited<ReturnType<typeof openFxOptionsProbe>>) => {
  const command = <T>(type: string, payload: object = {}) =>
    ui.evaluate<T>(
      `chrome.runtime.sendMessage(${JSON.stringify({ type, ...payload })})`,
    );
  const chooseFile = (settings: ExportedSettings) =>
    ui.evaluate(`(() => {
    const input = document.getElementById("import-settings-file");
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(JSON.stringify(settings))}], "settings.json", { type: "application/json" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  const click = (selector: string) =>
    ui.evaluate(
      `(() => { const element = document.querySelector(${JSON.stringify(selector)}); element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); element.click(); return true; })()`,
    );
  const isPresent = (selector: string) =>
    ui.evaluate<boolean>(
      `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
    );
  const isEnabled = (selector: string) =>
    ui.evaluate<boolean>(
      `!document.querySelector(${JSON.stringify(selector)}).disabled`,
    );
  const exported = async () => {
    const { settings } = await command<{ settings: ExportedSettings }>(
      CMD.exportSettings,
    );
    const { exportedAt: _exportedAt, ...comparable } = settings;
    return comparable;
  };
  const selectOption = async (selector: string, index: number) => {
    await ui.evaluate(
      `(() => { document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return true; })()`,
    );
    await expect.poll(() => isPresent('[role="option"]')).toBe(true);
    await ui.evaluate(
      `(() => { document.querySelectorAll('[role="option"]')[${index}].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return true; })()`,
    );
    await expect.poll(() => isPresent('[role="option"]')).toBe(false);
  };
  return { command, chooseFile, click, isPresent, isEnabled, exported, selectOption };
};

test("Firefox import UI previews, cancels, detects edits, merges and undoes", async ({
  context,
  extensionOrigin,
  debuggerPort,
  serverUrl,
}) => {
  const ui = await openFxOptionsProbe({ context, extensionOrigin, debuggerPort });
  const { command, chooseFile, click, isPresent, isEnabled, exported, selectOption } =
    createImportDriver(ui);
  try {
    await expect.poll(() => isPresent('[data-tab="advanced"]')).toBe(true);
    await click('[data-tab="advanced"]');
    await expect.poll(() => isPresent("#import-settings-file")).toBe(true);
    const before = await exported();
    await chooseFile(IMPORT_FIXTURE);
    await expect.poll(() => isPresent("#settings-import-dialog")).toBe(true);
    expect(await exported()).toEqual(before);
    await expect.poll(() => isEnabled("#settings-import-cancel")).toBe(true);
    await click("#settings-import-cancel");
    expect(await exported()).toEqual(before);
    await chooseFile(IMPORT_FIXTURE);
    await expect.poll(() => isPresent("#settings-import-confirm")).toBe(true);
    await command(CMD.saveSimpleSettings, { themeMode: "light" });
    await click("#settings-import-confirm");
    await expect.poll(() => isPresent("[data-import-error]")).toBe(true);
    expect((await exported()).themeMode).toBe("light");
    await click("#settings-import-review");
    await expect.poll(() => isEnabled("#settings-import-confirm")).toBe(true);
    await click("#settings-import-confirm");
    await expect.poll(() => isPresent("#settings-import-dialog")).toBe(false);
    await expect.poll(() => isEnabled("#undo-settings-import")).toBe(true);
    const imported = await exported();
    expect(imported.locations).toEqual(IMPORT_FIXTURE.locations);
    const probe = await context.newPage();
    await probe.goto(serverUrl);
    await expect
      .poll(() =>
        probe.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
      )
      .toBe("Europe/Paris");
    await probe.close();
    await chooseFile({
      ...IMPORT_FIXTURE,
      locations: [{ ...IMPORT_FIXTURE.locations[0]!, label: "Conflict preset" }],
    });
    await expect.poll(() => isPresent("#settings-import-dialog")).toBe(true);
    await selectOption('#settings-import-dialog [role="combobox"]', 1);
    await expect.poll(() => isPresent('[data-import-selection="merge"]')).toBe(true);
    await expect.poll(() => isEnabled("#settings-import-confirm")).toBe(false);
    await selectOption('[data-import-item="preview-profile"] [role="combobox"]', 2);
    await selectOption('[data-import-item="127.0.0.1"] [role="combobox"]', 0);
    await expect.poll(() => isEnabled("#settings-import-confirm")).toBe(true);
    await click("#settings-import-confirm");
    await expect.poll(() => isPresent("#settings-import-dialog")).toBe(false);
    const merged = await exported();
    expect(merged.rules[0]?.locationId).toBe("preview-profile-import");
    expect(merged.locations).toContainEqual(
      expect.objectContaining({
        id: "preview-profile-import",
        label: "Conflict preset",
      }),
    );
    await click("#undo-settings-import");
    await expect.poll(() => isEnabled("#undo-settings-import")).toBe(false);
    expect(await exported()).toEqual(imported);
  } finally {
    await ui.close();
  }
});

test("Firefox container import requires a local mapping and undo survives browser restart", async ({
  context,
  extensionOrigin,
  debuggerPort,
  persistentContextSession,
}) => {
  let ui = await openFxOptionsProbe({ context, extensionOrigin, debuggerPort });
  let driver = createImportDriver(ui);
  const container = await ui.evaluate<{ cookieStoreId: string }>(
    'browser.contextualIdentities.create({ name: "Import test", color: "blue", icon: "briefcase" })',
  );
  try {
    await expect
      .poll(async () => {
        const state = await driver.command<{
          containerAssignments: Array<{ cookieStoreId: string }>;
        }>(CMD.getSettings);
        return state.containerAssignments.some(
          (assignment) => assignment.cookieStoreId === container.cookieStoreId,
        );
      })
      .toBe(true);
    await expect.poll(() => driver.isPresent('[data-tab="advanced"]')).toBe(true);
    await driver.click('[data-tab="advanced"]');
    await expect.poll(() => driver.isPresent("#import-settings-file")).toBe(true);
    const initial = await driver.exported();
    // The runtime fixture seeds in-memory defaults after clearing storage. Persist
    // the actual user model so its nonces remain identical across the restart.
    await driver.command(CMD.saveLocationModel, {
      locations: initial.locations,
      rules: initial.rules,
      containerAssignments: initial.containerAssignments,
    });
    const before = await driver.exported();
    await driver.chooseFile({
      ...IMPORT_FIXTURE,
      containerAssignments: [
        {
          cookieStoreId: "foreign-container",
          locationId: "preview-profile",
          enabled: true,
        },
      ],
    });
    await expect.poll(() => driver.isPresent("#settings-import-dialog")).toBe(true);
    await expect.poll(() => driver.isEnabled("#settings-import-confirm")).toBe(false);
    expect(await driver.exported()).toEqual(before);
    await ui.evaluate(
      `(() => { document.querySelector('[aria-label="foreign-container"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return true; })()`,
    );
    await expect.poll(() => driver.isPresent('[role="option"]')).toBe(true);
    await ui.evaluate(
      `(() => { Array.from(document.querySelectorAll('[role="option"]')).find(option => option.textContent === "Import test").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return true; })()`,
    );
    await expect.poll(() => driver.isEnabled("#settings-import-confirm")).toBe(true);
    await driver.click("#settings-import-confirm");
    await expect.poll(() => driver.isPresent("#settings-import-dialog")).toBe(false);
    const after = await driver.exported();
    expect(after.containerAssignments).toContainEqual(
      expect.objectContaining({
        cookieStoreId: container.cookieStoreId,
        locationId: "preview-profile",
      }),
    );
    expect(
      after.containerAssignments?.some(
        (assignment) => assignment.cookieStoreId === "foreign-container",
      ),
    ).toBe(false);
    expect(
      after.containerAssignments?.filter(
        (assignment) => assignment.cookieStoreId !== container.cookieStoreId,
      ),
    ).toEqual(
      before.containerAssignments?.filter(
        (assignment) => assignment.cookieStoreId !== container.cookieStoreId,
      ),
    );
    // Keep a browser window alive so restartContext owns the complete shutdown.
    await context.newPage();
    await ui.close();
    const restartedContext = await persistentContextSession.restartContext();
    ui = await openFxOptionsProbe({
      context: restartedContext,
      extensionOrigin,
      debuggerPort,
    });
    driver = createImportDriver(ui);
    await expect.poll(() => driver.isPresent('[data-tab="advanced"]')).toBe(true);
    await driver.click('[data-tab="advanced"]');
    await expect.poll(() => driver.isPresent("#undo-settings-import")).toBe(true);
    await expect.poll(() => driver.isEnabled("#undo-settings-import")).toBe(true);
    await driver.click("#undo-settings-import");
    await expect.poll(() => driver.isEnabled("#undo-settings-import")).toBe(false);
    expect(await driver.exported()).toEqual(before);
  } finally {
    await ui
      .evaluate(
        `browser.contextualIdentities.remove(${JSON.stringify(container.cookieStoreId)})`,
      )
      .catch(() => undefined);
    await ui.close();
  }
});
