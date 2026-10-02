import { readFile } from "node:fs/promises";

import { serializeDiagnosticText } from "@privacy-brand/xray-protocol/diagnostic-report";

import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";

import { expect, test } from "./fixtures";

test("X-Ray report previews and downloads only consented local data", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const site = await context.newPage();
  await site.goto(serverUrl);
  const ui = await context.newPage();
  await ui.goto(`chrome-extension://${extensionId}/src/ui/sidebar/index.html`);
  const host = new URL(serverUrl).hostname;
  await ui.evaluate(
    async ({ url, command }) => {
      const [tab] = await chrome.tabs.query({ url: `${url}/*` });
      if (!tab?.id) throw new Error("Missing target tab");
      await chrome.tabs.update(tab.id, { active: true });
      return chrome.runtime.sendMessage({ type: command, tabId: tab.id });
    },
    { url: serverUrl, command: EXTENSION_COMMAND_TYPES.getXRayState },
  );
  await expect(ui.locator("header + div")).toContainText(host);
  await ui.locator("[data-report-prepare]").click();
  const dialog = ui.locator("[data-diagnostic-report]");
  await expect(dialog).toHaveAttribute("data-report-site", "excluded");
  const preview = ui.locator("[data-report-preview]");
  const text = await preview.inputValue();
  expect(text).not.toContain(host);
  await ui.locator('[data-report-view="json"]').click();
  const json = await preview.inputValue();
  expect(serializeDiagnosticText(JSON.parse(json))).toBe(text);
  for (const [format, expected] of [
    ["json", json],
    ["text", text],
  ] as const) {
    const downloaded = ui.waitForEvent("download");
    await ui.locator(`[data-report-download="${format}"]`).click();
    const download = await downloaded;
    expect(await readFile((await download.path())!, "utf8")).toBe(expected);
  }
  await ui.locator("[data-report-site-toggle]").check();
  const withSite = JSON.parse(await preview.inputValue());
  expect(withSite.site.hostname).toBe(host);
  const { site: _site, ...rest } = withSite;
  expect(rest).toEqual(JSON.parse(json));
  const downloads: string[] = [];
  ui.on("download", (download) => downloads.push(download.suggestedFilename()));
  await ui.locator("[data-report-cancel]").click();
  await expect(dialog).toHaveCount(0);
  expect(downloads).toEqual([]);
  await ui.locator("[data-report-prepare]").click();
  await expect(dialog).toHaveAttribute("data-report-site", "excluded");
  await ui.locator("[data-report-cancel]").click();

  // A failed background request yields a usable partial report without the raw
  // error. The shared messaging boundary catches a rejected worker request.
  await ui.evaluate(() => {
    chrome.runtime.sendMessage = (() =>
      Promise.reject(
        new Error("SECRET private.example.test missing permission"),
      )) as typeof chrome.runtime.sendMessage;
  });
  await site.reload();
  await expect(ui.locator("[data-report-prepare]")).toBeVisible();
  await expect(
    ui.locator('[data-xray-report-entry] + [data-tone="error"]'),
  ).toBeVisible();
  await ui.locator("[data-report-prepare]").click();
  await expect(dialog).toHaveAttribute("data-report-status", "partial");
  await ui.locator('[data-report-view="json"]').click();
  const partial = await preview.inputValue();
  expect(JSON.parse(partial).reasonCodes).toContain("state-unavailable");
  expect(partial).not.toContain("SECRET");
  expect(partial).not.toContain(host);
});
