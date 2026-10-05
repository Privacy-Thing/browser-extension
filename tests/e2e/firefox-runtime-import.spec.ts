import { expect } from "@playwright/test";

import {
  EXTENSION_COMMAND_TYPES as CMD,
  EXTENSION_STORAGE_KEYS as KEY,
} from "../../src/shared/extension-contract";
import type { ExportedSettings } from "../../src/shared/types";

import { IMPORT_FIXTURE, REGIONAL_IMPORT_FIXTURE } from "./config-import.shared";
import { openFxOptionsProbe, test } from "./firefox-runtime.shared";

// RDP evaluates JS directly; escape HTML delimiters too so serialized arguments
// remain safe if a probe is later embedded in a script element.
const scriptValue = (value: unknown): string =>
  JSON.stringify(value).replace(
    /[<>\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );

const createImportDriver = (ui: Awaited<ReturnType<typeof openFxOptionsProbe>>) => {
  const command = <T>(type: string, payload: object = {}) =>
    ui.evaluate<T>(`chrome.runtime.sendMessage(${scriptValue({ type, ...payload })})`);
  const chooseFile = (settings: ExportedSettings) =>
    ui.evaluate(`(() => {
    const input = document.getElementById("import-settings-file");
    const transfer = new DataTransfer();
    transfer.items.add(new File([${scriptValue(JSON.stringify(settings))}], "settings.json", { type: "application/json" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  const click = (selector: string) =>
    ui.evaluate(
      `(() => { const element = document.querySelector(${scriptValue(selector)}); element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); element.click(); return true; })()`,
    );
  const isPresent = (selector: string) =>
    ui.evaluate<boolean>(`Boolean(document.querySelector(${scriptValue(selector)}))`);
  const isEnabled = (selector: string) =>
    ui.evaluate<boolean>(`!document.querySelector(${scriptValue(selector)}).disabled`);
  const exported = async () => {
    const { settings } = await command<{ settings: ExportedSettings }>(
      CMD.exportSettings,
    );
    const { exportedAt: _exportedAt, ...comparable } = settings;
    return comparable;
  };
  const selectOption = async (selector: string, index: number) => {
    await ui.evaluate(
      `(() => { document.querySelector(${scriptValue(selector)}).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return true; })()`,
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
        `browser.contextualIdentities.remove(${scriptValue(container.cookieStoreId)})`,
      )
      .catch(() => undefined);
    await ui.close();
  }
});

test("Firefox restores an interrupted import before rebuilding runtime after restart", async ({
  context,
  extensionOrigin,
  debuggerPort,
  persistentContextSession,
  serverUrl,
}) => {
  let ui = await openFxOptionsProbe({ context, extensionOrigin, debuggerPort });
  let driver = createImportDriver(ui);
  try {
    const initial = await driver.exported();
    const nativeContainers = await ui.evaluate<Array<{ cookieStoreId: string }>>(
      "browser.contextualIdentities.query({})",
    );
    // Storage reset removes assignments; persist every real native identity so
    // startup reconciliation does not add unrelated state after journal recovery.
    await driver.command(CMD.saveLocationModel, {
      locations: initial.locations,
      rules: initial.rules,
      containerAssignments: nativeContainers.map(
        ({ cookieStoreId }) =>
          initial.containerAssignments?.find(
            (assignment) => assignment.cookieStoreId === cookieStoreId,
          ) ?? { cookieStoreId },
      ),
    });
    const before = await driver.exported();
    await expect.poll(() => driver.isPresent('[data-tab="advanced"]')).toBe(true);
    await driver.click('[data-tab="advanced"]');
    await expect.poll(() => driver.isPresent("#import-settings-file")).toBe(true);
    await driver.chooseFile(IMPORT_FIXTURE);
    await expect.poll(() => driver.isPresent("#settings-import-confirm")).toBe(true);
    await driver.click("#settings-import-confirm");
    await expect.poll(() => driver.isPresent("#settings-import-dialog")).toBe(false);
    const importedProbe = await context.newPage();
    await importedProbe.goto(serverUrl);
    await expect
      .poll(() =>
        importedProbe.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
      )
      .toBe("Europe/Paris");
    await ui.evaluate(
      `(async () => { const key = ${scriptValue(KEY.settingsImportJournal)}; const stored = await chrome.storage.local.get(key); await chrome.storage.local.set({ [key]: { ...stored[key], phase: "pending" } }); return true; })()`,
    );
    await ui.close();
    const restarted = await persistentContextSession.restartContext();
    ui = await openFxOptionsProbe({
      context: restarted,
      extensionOrigin,
      debuggerPort,
    });
    driver = createImportDriver(ui);
    expect(await driver.exported()).toEqual(before);
    const probe = await restarted.newPage();
    await probe.goto(serverUrl);
    const expected = before.locations.find(
      (location) => location.id === before.rules[0]?.locationId,
    )?.timeZone;
    expect(expected).toBeDefined();
    await expect
      .poll(() =>
        probe.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
      )
      .toBe(expected);
    expect(await driver.command(CMD.getImportUndoStatus)).toMatchObject({
      available: false,
    });
    await probe.close();
  } finally {
    await ui.close();
  }
});

test("Firefox regional import advice keeps intentional choices and changes only the suggested zone", async ({
  context,
  extensionOrigin,
  debuggerPort,
}) => {
  const ui = await openFxOptionsProbe({ context, extensionOrigin, debuggerPort });
  const driver = createImportDriver(ui);
  try {
    await expect.poll(() => driver.isPresent('[data-tab="advanced"]')).toBe(true);
    await driver.click('[data-tab="advanced"]');
    await expect.poll(() => driver.isPresent("#import-settings-file")).toBe(true);
    const before = await driver.exported();
    await driver.chooseFile(REGIONAL_IMPORT_FIXTURE);
    await expect
      .poll(() => driver.isPresent('[data-regional-warning="timeZone"]'))
      .toBe(true);
    await expect.poll(() => driver.isEnabled("#settings-import-confirm")).toBe(true);
    await driver.click("[data-regional-apply-timezone]");
    await expect
      .poll(() => driver.isPresent('[data-regional-warning="timeZone"]'))
      .toBe(false);
    await expect.poll(() => driver.isEnabled("#settings-import-confirm")).toBe(true);
    expect(await driver.exported()).toEqual(before);
    await driver.click("#settings-import-cancel");
    expect(await driver.exported()).toEqual(before);
    await driver.chooseFile(REGIONAL_IMPORT_FIXTURE);
    await expect
      .poll(() => driver.isPresent("[data-regional-apply-timezone]"))
      .toBe(true);
    await driver.click("[data-regional-apply-timezone]");
    await expect
      .poll(() => driver.isPresent('[data-regional-warning="timeZone"]'))
      .toBe(false);
    await expect.poll(() => driver.isEnabled("#settings-import-confirm")).toBe(true);
    await driver.click("#settings-import-confirm");
    await expect.poll(() => driver.isPresent("#settings-import-dialog")).toBe(false);
    expect((await driver.exported()).locations).toEqual([
      { ...REGIONAL_IMPORT_FIXTURE.locations[0], timeZone: "Europe/Paris" },
    ]);
    await driver.chooseFile(REGIONAL_IMPORT_FIXTURE);
    await expect
      .poll(() => driver.isPresent('[data-regional-warning="timeZone"]'))
      .toBe(true);
    await expect.poll(() => driver.isEnabled("#settings-import-confirm")).toBe(true);
    await driver.click("#settings-import-confirm");
    await expect.poll(() => driver.isPresent("#settings-import-dialog")).toBe(false);
    expect((await driver.exported()).locations).toEqual(
      REGIONAL_IMPORT_FIXTURE.locations,
    );
  } finally {
    await ui.close();
  }
});
