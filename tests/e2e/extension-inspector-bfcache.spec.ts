import type { CDPSession } from "@playwright/test";

import {
  CMD_XRAY_GET_INSPECTOR_STATE,
  CMD_XRAY_SET_INSPECTOR,
} from "../../packages/xray-protocol/src/inspector-commands";
import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";

import { expect, test } from "./fixtures";

// Playwright's trace recorder calls Date.now in the page on navigation.
test.use({ trace: "off", backForwardCache: true });

const spyScript = `window.inspectorProbe = function chosenRead() { return Date.now(); };
addEventListener("pageshow", (event) => {
  if (event.persisted) window.restores = (window.restores ?? 0) + 1;
});`;

const observePauses = async (cdp: CDPSession) => {
  const pauses: unknown[] = [];
  cdp.on("Debugger.paused", (event) => {
    pauses.push(event);
    void cdp.send("Debugger.resume");
  });
  await cdp.send("Debugger.enable");
  return pauses;
};

test("a page restored from the back/forward cache drops a selection the tab no longer has", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const ui = await context.newPage();
  await ui.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const command = (type: string, fields: Record<string, unknown> = {}) =>
    ui.evaluate(({ type, fields }) => chrome.runtime.sendMessage({ type, ...fields }), {
      type,
      fields,
    });
  const examples = await command(EXTENSION_COMMAND_TYPES.loadSampleData);
  expect(
    (
      await command(EXTENSION_COMMAND_TYPES.saveSimpleSettings, {
        browserFingerprintSpoofingEnabled: true,
        globalFallbackRule: { enabled: true, locationId: examples.locations[0].id },
      })
    ).ok,
  ).toBe(true);
  const probeUrl = `${serverUrl}/inspector-bfcache-probe`;
  await context.route(probeUrl, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><script src="/inspector-bfcache-spy.js"></script>',
    }),
  );
  await context.route(`${serverUrl}/inspector-bfcache-spy.js`, (route) =>
    route.fulfill({ contentType: "application/javascript", body: spyScript }),
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const pauses = await observePauses(cdp);
  await page.goto(probeUrl);
  const tabId = await ui.evaluate(
    async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url)!.id!,
    probeUrl,
  );
  const read = async () => {
    pauses.length = 0;
    await page.evaluate("window.inspectorProbe()");
    return pauses.length;
  };
  const dateNowReads = async () => {
    const state = await command(EXTENSION_COMMAND_TYPES.getXRayState, { tabId });
    const timeLocale = (
      state.assessments as { key: string; activity: { methodCounts: object } }[]
    ).find((assessment) => assessment.key === "timeLocale");
    return (timeLocale?.activity.methodCounts as Record<string, number>)["date.now"];
  };
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  expect(
    await command(CMD_XRAY_SET_INSPECTOR, {
      tabId,
      methodIds: ["date.now"],
      mode: "every-call",
      apply: "now",
    }),
  ).toMatchObject({ appliedVia: "live", state: { armed: true } });
  expect(await read()).toBe(1);
  await expect.poll(dateNowReads).toBe(1);

  // Every http(s) commit updates the tab's header session rule, and Chromium
  // empties the back/forward cache on any declarativeNetRequest rule update.
  // A document that does not run the runtime keeps the probe page cached.
  await page.goto("data:text/html,<p>Elsewhere</p>");
  await page.goBack({ waitUntil: "commit" });
  await page.waitForFunction("window.restores === 1");
  // The same document came back, with its runtime and the selection it was hidden with.
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  // Leaving the domain ended the tab's Inspector session.
  expect(await command(CMD_XRAY_GET_INSPECTOR_STATE, { tabId })).toMatchObject({
    armed: false,
    pendingReload: false,
    appliesLive: true,
  });
  // X-Ray reports the restored document's earlier reads again.
  await expect.poll(dateNowReads).toBe(1);
  // The restored document settles to what a new load would get: no selection.
  await expect.poll(read).toBe(0);
  expect(await read()).toBe(0);

  // Its live channel survived the cache.
  expect(
    await command(CMD_XRAY_SET_INSPECTOR, {
      tabId,
      methodIds: ["date.now"],
      mode: "first-call",
      apply: "now",
    }),
  ).toMatchObject({ appliedVia: "live", state: { armed: true, pendingReload: false } });
  expect(await read()).toBe(1);
  expect(await read()).toBe(0);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  await cdp.detach();
});
