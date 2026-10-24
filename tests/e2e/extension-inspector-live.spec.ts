import path from "node:path";

import type { BrowserContext, CDPSession, Page } from "@playwright/test";

import {
  CMD_XRAY_CLEAR_INSPECTOR,
  CMD_XRAY_GET_INSPECTOR_STATE,
  CMD_XRAY_SET_INSPECTOR,
} from "../../packages/xray-protocol/src/inspector-commands";
import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";

import { expect, test } from "./fixtures";
import { probeHiddenEvents, readPackagedNames } from "./packaged-names";

// Playwright's trace recorder calls Date.now in the page on navigation.
test.use({ trace: "off" });

type PauseFrame = {
  functionName: string;
  url: string;
  location: { scriptId: string; lineNumber: number; columnNumber: number };
};
type Pause = { callFrames: PauseFrame[] };

const spyScript = `window.inspectorProbe = async function chosenRead(method) {
  if (method === "battery") { const manager = await navigator.getBattery(); return manager.level; }
  return Date.now();
};`;

// Observer only: it records what page code could see and never forges events.
const observerScript = `(() => {
  const seen = [];
  let watching = false;
  window.inspectorObserver = { seen, start: () => { watching = true; }, stop: () => { watching = false; } };
  const note = (what) => { if (watching) seen.push(what); };
  const wrap = (owner, key, label) => {
    const original = owner[key];
    Object.defineProperty(owner, key, { configurable: true, writable: true, value: function (...args) {
      note(label);
      return Reflect.apply(original, this, args);
    } });
  };
  for (const [owner, key, label] of [
    [EventTarget.prototype, "addEventListener", "addEventListener"],
    [EventTarget.prototype, "dispatchEvent", "dispatchEvent"],
    [window, "postMessage", "postMessage"],
    [window, "queueMicrotask", "queueMicrotask"],
    [window, "setTimeout", "setTimeout"],
    [JSON, "parse", "JSON.parse"],
    [JSON, "stringify", "JSON.stringify"],
    [Reflect, "ownKeys", "Reflect.ownKeys"],
    [Object, "getOwnPropertyDescriptor", "getOwnPropertyDescriptor"],
    [Object, "defineProperty", "defineProperty"],
    [Object, "keys", "Object.keys"],
    [Set.prototype, "has", "Set.has"],
    [Set.prototype, "add", "Set.add"],
    [Set.prototype, "delete", "Set.delete"],
    [Map.prototype, "get", "Map.get"],
    [Map.prototype, "set", "Map.set"],
    [Array.prototype, Symbol.iterator, "Array iterator"],
    [performance, "now", "performance.now"],
    [Error, "captureStackTrace", "captureStackTrace"],
  ]) wrap(owner, key, label);
  for (const [owner, key] of [
    [CustomEvent.prototype, "detail"],
    [MouseEvent.prototype, "relatedTarget"],
    [Event.prototype, "type"],
  ]) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, key);
    Object.defineProperty(owner, key, { ...descriptor, get() { note(key); return descriptor.get.call(this); } });
  }
  for (const key of ["bubbles", "cancelable", "composed", "detail", "relatedTarget", "toJSON", Symbol.toPrimitive]) {
    Object.defineProperty(Object.prototype, key, { configurable: true, get() { note(String(key)); return undefined; } });
  }
  Error.prepareStackTrace = (error, frames) => { note("prepareStackTrace"); return String(error); };
  addEventListener("message", () => note("message"), true);
  new MutationObserver(() => note("mutation")).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  window.inspectorObserver.name = () => window.name;
})();`;

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

const openProbe = async (
  context: BrowserContext,
  extensionId: string,
  serverUrl: string,
  head = "",
  body = "",
) => {
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
  const probeUrl = `${serverUrl}/inspector-live-probe`;
  const spyUrl = `${serverUrl}/distinctive-live-spy.js`;
  await context.route(probeUrl, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><head>${head}<script src="/distinctive-live-spy.js"></script></head>${body}`,
    }),
  );
  await context.route(spyUrl, (route) =>
    route.fulfill({ contentType: "application/javascript", body: spyScript }),
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const observed = await observePauses(cdp);
  await page.goto(probeUrl);
  const tabIdOf = (url: string) =>
    ui.evaluate(
      async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url)!.id!,
      url,
    );
  const tabId = await tabIdOf(probeUrl);
  const run = (page: Page, method: string) =>
    page.evaluate(`window.inspectorProbe(${JSON.stringify(method)})`);
  return {
    command,
    page,
    cdp,
    observed,
    tabId,
    tabIdOf,
    spyUrl,
    run: (m: string) => run(page, m),
  };
};

test("Inspector arms and disarms a loaded document live, pausing only on the chosen read", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const probe = await openProbe(context, extensionId, serverUrl);
  const { command, observed, tabId, run } = probe;
  const timeOrigin = await probe.page.evaluate(() => performance.timeOrigin);
  expect(await command(CMD_XRAY_GET_INSPECTOR_STATE, { tabId })).toMatchObject({
    available: true,
    appliesLive: true,
  });

  for (const [methodId, selected, other, line] of [
    ["battery.manager.level", "battery", "date", 1],
    ["date.now", "date", "battery", 2],
  ] as const) {
    const applied = await command(CMD_XRAY_SET_INSPECTOR, {
      tabId,
      methodIds: [methodId],
      mode: "first-call",
      apply: "now",
    });
    expect(applied).toMatchObject({
      appliedVia: "live",
      liveCoverage: { live: 1, notLive: 0, reasons: [] },
      state: { armed: true, methodIds: [methodId], pendingReload: false },
    });
    observed.pauses.length = 0;
    await run(other);
    expect(observed.pauses).toHaveLength(0);
    await run(selected);
    expect(observed.pauses).toHaveLength(1);
    const [top] = observed.pauses[0]!.callFrames;
    expect(observed.url(top!)).toContain("main-world-runtime.js");
    const caller = observed.pauses[0]!.callFrames.find(
      (frame) => !observed.url(frame).startsWith("chrome-extension://"),
    );
    expect(observed.url(caller!)).toBe(probe.spyUrl);
    expect(caller!.location.lineNumber).toBe(line);
    await run(selected);
    expect(observed.pauses).toHaveLength(1);
  }

  const cleared = await command(CMD_XRAY_CLEAR_INSPECTOR, { tabId, apply: "now" });
  expect(cleared).toMatchObject({
    appliedVia: "live",
    state: { armed: false, pendingReload: false },
  });
  observed.pauses.length = 0;
  await run("date");
  await run("battery");
  expect(observed.pauses).toHaveLength(0);
  // The same document served every step: nothing reloaded it.
  expect(await probe.page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  await probe.cdp.detach();
});

test("a page observing its own realm sees no trace of live arming or disarming", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const probe = await openProbe(
    context,
    extensionId,
    serverUrl,
    `<script>${observerScript}</script>`,
  );
  const { command, observed, tabId, run, page } = probe;
  const nameBefore = await page.evaluate("window.inspectorObserver.name()");
  const watch = async (step: () => Promise<unknown>) => {
    await page.evaluate("window.inspectorObserver.start()");
    const result = await step();
    await page.evaluate("window.inspectorObserver.stop()");
    return result;
  };
  // Playwright's own evaluate plumbing is recorded as a baseline and excluded.
  const baseline = await watch(async () => undefined);
  const seenBaseline = (await page.evaluate(
    "window.inspectorObserver.seen.splice(0)",
  )) as string[];
  expect(baseline).toBeUndefined();

  expect(
    await watch(() =>
      command(CMD_XRAY_SET_INSPECTOR, {
        tabId,
        methodIds: ["battery.manager.level"],
        mode: "every-call",
        apply: "now",
      }),
    ),
  ).toMatchObject({ appliedVia: "live" });
  const seenArm = (await page.evaluate(
    "window.inspectorObserver.seen.splice(0)",
  )) as string[];
  // No page read sits between the windows, so each holds only its own step.
  expect(
    await watch(() => command(CMD_XRAY_CLEAR_INSPECTOR, { tabId, apply: "now" })),
  ).toMatchObject({ appliedVia: "live" });
  const seenDisarm = (await page.evaluate(
    "window.inspectorObserver.seen.splice(0)",
  )) as string[];
  observed.pauses.length = 0;
  await run("battery");
  expect(observed.pauses).toHaveLength(0);
  await command(CMD_XRAY_SET_INSPECTOR, {
    tabId,
    methodIds: ["battery.manager.level"],
    mode: "every-call",
    apply: "now",
  });
  await run("battery");
  expect(observed.pauses).toHaveLength(1);

  expect(seenArm).toEqual(seenBaseline);
  expect(seenDisarm).toEqual(seenBaseline);
  expect(await page.evaluate("window.inspectorObserver.name()")).toBe(nameBefore);
  await probe.cdp.detach();
});

test("a page that knows every packaged name cannot find the live channel", async ({
  context,
  extensionId,
  serverUrl,
  secondaryServerUrl,
}) => {
  const names = readPackagedNames(
    path.resolve(process.env.PT_E2E_EXTENSION_PATH?.trim() || "build/chrome"),
  );
  // The first page script of every document probes, and again after load.
  const earlyProbe = `<script>window.earlyHidden = (${probeHiddenEvents.toString()})(${JSON.stringify(names)});</script>`;
  for (const origin of [serverUrl, secondaryServerUrl])
    await context.route(`${origin}/inspector-probe-frame`, (route) =>
      route.fulfill({ contentType: "text/html", body: `<!doctype html>${earlyProbe}` }),
    );
  const probe = await openProbe(
    context,
    extensionId,
    serverUrl,
    earlyProbe,
    `<iframe src="/inspector-probe-frame"></iframe><iframe src="${secondaryServerUrl}/inspector-probe-frame"></iframe>`,
  );
  const { command, observed, page, tabId, run } = probe;
  await expect.poll(() => page.frames().length).toBe(3);
  for (const frame of page.frames()) {
    await frame.waitForFunction("Array.isArray(window.earlyHidden)");
    expect(await frame.evaluate("window.earlyHidden")).toEqual([]);
    expect(await frame.evaluate(probeHiddenEvents, names)).toEqual([]);
  }
  // The channel still works for the documents that own one.
  expect(
    await command(CMD_XRAY_SET_INSPECTOR, {
      tabId,
      methodIds: ["battery.manager.level"],
      mode: "every-call",
      apply: "now",
    }),
  ).toMatchObject({
    appliedVia: "live",
    liveCoverage: { live: 2, notLive: 1, reasons: ["same-origin-frame"] },
  });
  observed.pauses.length = 0;
  await run("battery");
  expect(observed.pauses).toHaveLength(1);
  await probe.cdp.detach();
});

test("a script-opened window falls back to reload and still pauses after it", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const probe = await openProbe(context, extensionId, serverUrl);
  const { command } = probe;
  const launcherUrl = `${serverUrl}/inspector-live-launcher`;
  await context.route(launcherUrl, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><button id="open" onclick="window.open(\'/inspector-live-probe\')">Open</button>',
    }),
  );
  await probe.page.goto(launcherUrl);
  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    probe.page.locator("#open").click(),
  ]);
  await popup.waitForLoadState("domcontentloaded");
  const cdp = await context.newCDPSession(popup);
  const observed = await observePauses(cdp);
  const tabId = await probe.tabIdOf(popup.url());
  expect(await command(CMD_XRAY_GET_INSPECTOR_STATE, { tabId })).toMatchObject({
    available: true,
    appliesLive: false,
  });
  const reloaded = popup.waitForEvent("domcontentloaded");
  expect(
    await command(CMD_XRAY_SET_INSPECTOR, {
      tabId,
      methodIds: ["battery.manager.level"],
      mode: "first-call",
      apply: "now",
    }),
  ).toMatchObject({
    appliedVia: "reload",
    liveCoverage: { live: 0, notLive: 1, reasons: ["opened-window"] },
  });
  await reloaded;
  observed.pauses.length = 0;
  await popup.evaluate(`window.inspectorProbe("date")`);
  expect(observed.pauses).toHaveLength(0);
  await popup.evaluate(`window.inspectorProbe("battery")`);
  expect(observed.pauses).toHaveLength(1);
  await cdp.detach();
  await probe.cdp.detach();
});

test("live updates reach cross-origin frames and leave same-origin frames to their next load", async ({
  context,
  extensionId,
  serverUrl,
  secondaryServerUrl,
}) => {
  const frameBody = '<!doctype html><script src="/distinctive-live-spy.js"></script>';
  for (const origin of [serverUrl, secondaryServerUrl]) {
    await context.route(`${origin}/inspector-live-frame`, (route) =>
      route.fulfill({ contentType: "text/html", body: frameBody }),
    );
    await context.route(`${origin}/distinctive-live-spy.js`, (route) =>
      route.fulfill({ contentType: "application/javascript", body: spyScript }),
    );
  }
  const probe = await openProbe(
    context,
    extensionId,
    serverUrl,
    "",
    `<iframe src="${secondaryServerUrl}/inspector-live-frame"></iframe><iframe src="/inspector-live-frame"></iframe>`,
  );
  const { command, page, tabId } = probe;
  const frameAt = (origin: string) =>
    page.frames().find((frame) => frame.url() === `${origin}/inspector-live-frame`)!;
  await expect.poll(() => page.frames().length).toBe(3);
  for (const origin of [serverUrl, secondaryServerUrl])
    await frameAt(origin).waitForFunction(
      "typeof window.inspectorProbe === 'function'",
    );
  const crossFrame = frameAt(secondaryServerUrl);
  // Cross-origin frames run out of process; observe their own debugger session.
  const crossCdp = await context.newCDPSession(crossFrame);
  const crossPauses = await observePauses(crossCdp);
  expect(
    await command(CMD_XRAY_SET_INSPECTOR, {
      tabId,
      methodIds: ["date.now"],
      mode: "every-call",
      apply: "now",
    }),
  ).toMatchObject({
    appliedVia: "live",
    liveCoverage: { live: 2, notLive: 1, reasons: ["same-origin-frame"] },
    state: { armed: true, pendingReload: true },
  });
  probe.observed.pauses.length = 0;
  await crossFrame.evaluate(`window.inspectorProbe("date")`);
  expect(crossPauses.pauses).toHaveLength(1);
  const caller = crossPauses.pauses[0]!.callFrames.find(
    (frame) => !crossPauses.url(frame).startsWith("chrome-extension://"),
  );
  expect(crossPauses.url(caller!)).toBe(
    `${secondaryServerUrl}/distinctive-live-spy.js`,
  );
  await frameAt(serverUrl).evaluate(`window.inspectorProbe("date")`);
  expect(probe.observed.pauses).toHaveLength(0);
  await probe.run("date");
  expect(probe.observed.pauses).toHaveLength(1);
  await crossCdp.detach();
  await probe.cdp.detach();
});
