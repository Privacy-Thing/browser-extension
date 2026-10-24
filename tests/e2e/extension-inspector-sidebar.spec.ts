import type { CDPSession, Page } from "@playwright/test";

import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";

import { expect, test } from "./fixtures";

// Playwright's trace recorder calls Date.now in the page on navigation.
test.use({ trace: "off" });

type PauseFrame = {
  url: string;
  location: { scriptId: string; lineNumber: number };
};

const spyScript = `window.inspectorProbe = async function chosenRead(method) {
  if (method === "battery") { const manager = await navigator.getBattery(); return manager.level; }
  return Date.now();
};`;

const observePauses = async (cdp: CDPSession) => {
  const scripts = new Map<string, string>();
  const pauses: PauseFrame[][] = [];
  cdp.on("Debugger.scriptParsed", (event) => scripts.set(event.scriptId, event.url));
  cdp.on("Debugger.paused", (event) => {
    pauses.push(event.callFrames);
    void cdp.send("Debugger.resume");
  });
  await cdp.send("Debugger.enable");
  return {
    pauses,
    caller: (frames: PauseFrame[]) =>
      frames
        .map((frame) => ({
          url: frame.url || scripts.get(frame.location.scriptId) || "",
          line: frame.location.lineNumber,
        }))
        .find((frame) => !frame.url.startsWith("chrome-extension://")),
  };
};

const armFromSidebar = async (sidebar: Page, category: string, methodId: string) => {
  const panel = sidebar.locator("[data-xray-inspector-panel]");
  await sidebar
    .locator(`[data-inspector-category="${category}"] [data-inspector-disclosure]`)
    .click();
  await sidebar.locator(`[data-inspector-method="${methodId}"] input`).check();
  // A live document offers a single action instead of reload and next-load.
  await expect(sidebar.locator("[data-inspector-apply]")).toHaveCount(1);
  await sidebar
    .locator('[data-inspector-actions="arm"] [data-inspector-apply="now"]')
    .click();
  await expect(sidebar.locator("[data-inspector-applied-via]")).toHaveAttribute(
    "data-inspector-applied-via",
    "live",
  );
  await expect(panel).toHaveAttribute("data-inspector-phase", "armed");
  await expect(panel).toHaveAttribute("data-inspector-pending-reload", "false");
};

const disarmFromSidebar = async (sidebar: Page) => {
  await sidebar
    .locator('[data-inspector-actions="disarm"] [data-inspector-apply="now"]')
    .click();
  await expect(sidebar.locator("[data-xray-inspector-panel]")).toHaveAttribute(
    "data-inspector-phase",
    "idle",
  );
  await expect(sidebar.locator("[data-inspector-applied-via]")).toHaveAttribute(
    "data-inspector-applied-via",
    "live",
  );
};

test("the X-Ray sidebar arms one chosen read live and disarms it without reloading", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const sidebar = await context.newPage();
  await sidebar.goto(`chrome-extension://${extensionId}/src/ui/sidebar/index.html`);
  const command = (type: string, fields: Record<string, unknown> = {}) =>
    sidebar.evaluate(
      ({ type, fields }) => chrome.runtime.sendMessage({ type, ...fields }),
      { type, fields },
    );
  const examples = await command(EXTENSION_COMMAND_TYPES.loadSampleData);
  expect(
    (
      await command(EXTENSION_COMMAND_TYPES.saveSimpleSettings, {
        browserFingerprintSpoofingEnabled: true,
        globalFallbackRule: { enabled: true, locationId: examples.locations[0].id },
        sharedSpoofing: { battery: true },
      })
    ).ok,
  ).toBe(true);
  const probeUrl = `${serverUrl}/inspector-sidebar-probe`;
  const spyUrl = `${serverUrl}/distinctive-sidebar-spy.js`;
  await context.route(probeUrl, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><script src="/distinctive-sidebar-spy.js"></script>',
    }),
  );
  await context.route(spyUrl, (route) =>
    route.fulfill({ contentType: "application/javascript", body: spyScript }),
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const observed = await observePauses(cdp);
  await page.goto(probeUrl);
  const run = (method: string) =>
    page.evaluate(`window.inspectorProbe(${JSON.stringify(method)})`);
  // Exercise both reads once so X-Ray lists them as used on this page.
  await run("battery");
  await run("date");
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await sidebar.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url });
    await chrome.tabs.update(tab!.id!, { active: true });
  }, probeUrl);

  await sidebar.locator("[data-xray-inspector-toggle]").click();
  const panel = sidebar.locator("[data-xray-inspector-panel]");
  await expect(panel).toHaveAttribute("data-inspector-phase", "idle");
  await expect(panel).toHaveAttribute("data-inspector-applies-live", "true");

  for (const [category, methodId, selected, other, line] of [
    ["battery", "battery.manager.level", "battery", "date", 1],
    ["timeLocale", "date.now", "date", "battery", 2],
  ] as const) {
    await armFromSidebar(sidebar, category, methodId);
    observed.pauses.length = 0;
    await run(other);
    expect(observed.pauses).toHaveLength(0);
    await run(selected);
    expect(observed.pauses).toHaveLength(1);
    expect(observed.caller(observed.pauses[0]!)).toEqual({ url: spyUrl, line });
    await disarmFromSidebar(sidebar);
    await run(selected);
    expect(observed.pauses).toHaveLength(1);
    // The draft keeps its selection after disarming; the next round picks only one method.
    await sidebar.locator(`[data-inspector-method="${methodId}"] input`).uncheck();
  }
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  await cdp.detach();
});
