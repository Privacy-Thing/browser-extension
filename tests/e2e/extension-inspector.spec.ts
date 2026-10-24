import type { CDPSession } from "@playwright/test";

import {
  CMD_XRAY_CLEAR_INSPECTOR,
  CMD_XRAY_GET_INSPECTOR_STATE,
  CMD_XRAY_SET_INSPECTOR,
} from "../../packages/xray-protocol/src/inspector-commands";
import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";

import { expect, test } from "./fixtures";

// Playwright's trace recorder calls Date.now in the page on navigation. That
// would consume the very first call this test needs to attribute to the spy.
test.use({ trace: "off" });

type PauseFrame = {
  functionName: string;
  url: string;
  location: { scriptId: string; lineNumber: number; columnNumber: number };
};
type Pause = { callFrames: PauseFrame[]; reason: string };
const probeScript = `window.inspectorProbe = async function chosenRead(method) {
  if (method === "battery") { const manager = await navigator.getBattery(); return manager.level; }
  return Date.now();
};`;

const observePauses = async (cdp: CDPSession) => {
  const scripts = new Map<string, string>();
  const pauses: Pause[] = [];
  cdp.on("Debugger.scriptParsed", (event) => scripts.set(event.scriptId, event.url));
  cdp.on("Debugger.paused", (event) => {
    pauses.push(event);
    void cdp.send("Debugger.resume");
  });
  await cdp.send("Debugger.enable");
  return {
    pauses,
    url: (frame: PauseFrame) => frame.url || scripts.get(frame.location.scriptId) || "",
  };
};

test("Inspector pauses only selected reads in the real runtime and leaves the plain path unpaused", async ({
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
  expect(examples.ok).toBe(true);
  expect(
    (
      await command(EXTENSION_COMMAND_TYPES.saveSimpleSettings, {
        browserFingerprintSpoofingEnabled: true,
        globalFallbackRule: { enabled: true, locationId: examples.locations[0].id },
        sharedSpoofing: { battery: true },
      })
    ).ok,
  ).toBe(true);

  const probeUrl = `${serverUrl}/inspector-probe`;
  const spyUrl = `${serverUrl}/distinctive-analyst-spy.js`;
  await context.route(probeUrl, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><script src="/distinctive-analyst-spy.js"></script>',
    }),
  );
  await context.route(spyUrl, (route) =>
    route.fulfill({ contentType: "application/javascript", body: probeScript }),
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const observed = await observePauses(cdp);
  await page.goto(probeUrl);
  const tabId = await ui.evaluate(
    async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url)!.id!,
    probeUrl,
  );
  const run = (method: string) =>
    page.evaluate(`window.inspectorProbe(${JSON.stringify(method)})`);
  await run("battery");
  await run("date");
  expect(observed.pauses).toHaveLength(0);
  const before = await command(EXTENSION_COMMAND_TYPES.getXRayState, { tabId });

  for (const [methodId, selected, other] of [
    ["battery.manager.level", "battery", "date"],
    ["date.now", "date", "battery"],
  ]) {
    const navigated = page.waitForEvent("domcontentloaded");
    const applied = await command(CMD_XRAY_SET_INSPECTOR, {
      tabId,
      methodIds: [methodId],
      mode: "first-call",
      apply: "now",
    });
    expect(applied.appliedVia).toBe("reload");
    await navigated;
    await expect
      .poll(
        async () =>
          (await command(CMD_XRAY_GET_INSPECTOR_STATE, { tabId })).pendingReload,
      )
      .toBe(false);
    observed.pauses.length = 0;
    await run(other!);
    expect(observed.pauses).toHaveLength(0);
    await run(selected!);
    expect(observed.pauses).toHaveLength(1);
    const pause = observed.pauses[0]!;
    const top = pause.callFrames[0]!;
    expect(observed.url(top)).toContain("main-world-runtime.js");
    const caller = pause.callFrames.find(
      (frame) => !observed.url(frame).startsWith("chrome-extension://"),
    );
    expect(caller).toBeDefined();
    expect(observed.url(caller!)).toBe(spyUrl);
    expect(caller!.location.lineNumber).toBe(
      methodId === "battery.manager.level" ? 1 : 2,
    );
    const scriptSource = await cdp.send("Debugger.getScriptSource", {
      scriptId: top.location.scriptId,
    });
    const pausedLine = scriptSource.scriptSource.split("\n")[top.location.lineNumber]!;
    expect(
      pausedLine.slice(top.location.columnNumber, top.location.columnNumber + 12),
    ).toMatch(/^debugger\b/);
    const after = await command(EXTENSION_COMMAND_TYPES.getXRayState, { tabId });
    expect(after.snapshot.authKey).toBe(before.snapshot.authKey);
    await run(selected!);
    expect(observed.pauses).toHaveLength(1);
    await test.info().attach(`${methodId}-frames`, {
      body: JSON.stringify(
        pause.callFrames.map((frame) => ({
          name: frame.functionName,
          url: observed.url(frame),
          line: frame.location.lineNumber + 1,
        })),
        null,
        2,
      ),
      contentType: "application/json",
    });
  }
  const everyNavigation = page.waitForEvent("domcontentloaded");
  await command(CMD_XRAY_SET_INSPECTOR, {
    tabId,
    methodIds: ["date.now"],
    mode: "every-call",
    apply: "now",
  });
  await everyNavigation;
  observed.pauses.length = 0;
  await run("date");
  await run("date");
  expect(observed.pauses).toHaveLength(2);
  const pending = await command(CMD_XRAY_SET_INSPECTOR, {
    tabId,
    methodIds: ["battery.manager.level"],
    mode: "first-call",
    apply: "next-load",
  });
  expect(pending).toMatchObject({
    appliedVia: "next-load",
    state: { pendingReload: true },
  });
  observed.pauses.length = 0;
  await run("battery");
  expect(observed.pauses).toHaveLength(0);
  await run("date");
  expect(observed.pauses).toHaveLength(1);
  await page.reload();
  observed.pauses.length = 0;
  await run("date");
  expect(observed.pauses).toHaveLength(0);
  await run("battery");
  expect(observed.pauses).toHaveLength(1);
  const navigated = page.waitForEvent("domcontentloaded");
  expect(
    (await command(CMD_XRAY_CLEAR_INSPECTOR, { tabId, apply: "now" })).appliedVia,
  ).toBe("reload");
  await navigated;
  observed.pauses.length = 0;
  await run("date");
  await run("battery");
  expect(observed.pauses).toHaveLength(0);
  await cdp.detach();
});
