import type { CDPSession } from "@playwright/test";

import {
  CMD_XRAY_CLEAR_INSPECTOR,
  CMD_XRAY_GET_INSPECTOR_STATE,
  CMD_XRAY_SET_INSPECTOR,
} from "../../packages/xray-protocol/src/inspector-commands";
import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";

import { readSettings, saveLocationModel } from "./extension-test.helpers";
import { expect, test } from "./fixtures";
import {
  catalogMethodIds,
  classifyArmable,
  expectedOutcomes,
  PROBE_SCRIPT_PATH,
  probeScript,
  type StopOutcome,
  withKnownDefects,
  probeTableIds,
  protocolMethodIds,
} from "./inspector-method-probes";

// Playwright's trace recorder reads Date in the page and would add stops.
test.use({ trace: "off" });

type Stop = { top: string; urls: string[] };
type AsyncTrace = { callFrames: { url: string }[]; parent?: AsyncTrace };

// Records the stopping script and every script on the synchronous and async
// stacks, which DevTools shows the analyst the same way.
const observeStops = async (cdp: CDPSession) => {
  const scripts = new Map<string, string>();
  const stops: Stop[] = [];
  cdp.on("Debugger.scriptParsed", (event) => scripts.set(event.scriptId, event.url));
  cdp.on("Debugger.paused", (event) => {
    const urls = event.callFrames.map(
      (frame) => frame.url || scripts.get(frame.location.scriptId) || "",
    );
    for (let trace = event.asyncStackTrace as AsyncTrace | undefined; trace;) {
      urls.push(...trace.callFrames.map((frame) => frame.url));
      trace = trace.parent;
    }
    stops.push({ top: urls[0] ?? "", urls });
    void cdp.send("Debugger.resume");
  });
  await cdp.send("Debugger.enable");
  await cdp.send("Debugger.setAsyncCallStackDepth", { maxDepth: 32 });
  return stops;
};

test("every armable Inspector method stops exactly once per armed page call", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  // Four passes over every covered method share one tab.
  test.slow();
  const sorted = (ids: readonly string[]) => [...ids].sort();
  // The protocol schema, the surface catalog and the probe table list the same methods.
  expect(sorted(catalogMethodIds())).toEqual(sorted(protocolMethodIds()));
  expect(sorted(probeTableIds())).toEqual(sorted(protocolMethodIds()));

  const ui = await context.newPage();
  await ui.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const command = (type: string, fields: Record<string, unknown> = {}) =>
    ui.evaluate(({ type, fields }) => chrome.runtime.sendMessage({ type, ...fields }), {
      type,
      fields,
    });
  const examples = await command(EXTENSION_COMMAND_TYPES.loadSampleData);
  expect(examples.ok).toBe(true);
  const locationId = examples.locations[0].id as string;
  expect(
    (
      await command(EXTENSION_COMMAND_TYPES.saveSimpleSettings, {
        browserFingerprintSpoofingEnabled: true,
        globalFallbackRule: { enabled: true, locationId },
        sharedSpoofing: {
          canvas: true,
          webGL: true,
          audio: true,
          screen: true,
          webRTC: true,
          battery: true,
        },
        featureFlags: { temporalApi: true },
      })
    ).ok,
  ).toBe(true);
  // Service Worker registration is armable only where a rule blocks it.
  const hostname = new URL(serverUrl).hostname;
  const settings = await readSettings(ui);
  await saveLocationModel(ui, {
    locations: settings.locations,
    rules: [
      ...settings.rules.filter((rule) => rule.pattern !== hostname),
      {
        pattern: hostname,
        locationId,
        enabled: true,
        blockServiceWorkerRegistration: true,
      },
    ],
  });

  const probeUrl = `${serverUrl}/inspector-coverage`;
  const scriptUrl = `${serverUrl}${PROBE_SCRIPT_PATH}`;
  await context.route(probeUrl, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><script src="${PROBE_SCRIPT_PATH}"></script>`,
    }),
  );
  await context.route(scriptUrl, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      // Worker bootstraps fetch their scripts outside page routing: use the
      // probe server's own worker scripts.
      body: probeScript({
        worker: "/worker-probe.js",
        sharedWorker: "/shared-worker-probe.js",
        serviceWorker: "/service-worker-probe.js",
      }),
    }),
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const observed = await observeStops(cdp);
  await page.goto(probeUrl);
  const tabId = await ui.evaluate(
    async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url)!.id!,
    probeUrl,
  );

  const state = await command(CMD_XRAY_GET_INSPECTOR_STATE, { tabId });
  expect(state).toMatchObject({ available: true, appliesLive: true, armed: false });
  const coverage = classifyArmable("chromium", state.trappableMethodIds as string[]);
  // With every surface on, the Inspector offers the Chromium catalog except the
  // listed payload gaps, and every offered method has a probe or an exception.
  expect(coverage).toMatchObject({
    uncovered: [],
    unexpected: [],
    notOffered: Object.keys(coverage.notOfferedReasons).sort(),
  });
  const { covered } = coverage;
  await test.info().attach("inspector-coverage", {
    body: JSON.stringify({ ...coverage, covered: covered.length }, null, 2),
    contentType: "application/json",
  });

  const run = (step: "setup" | "call" | "cleanup", id: string) =>
    page.evaluate(`window.inspectorCoverage.${step}(${JSON.stringify(id)})`);
  const stops = async (id: string) => {
    observed.length = 0;
    await run("call", id);
    const seen = [...observed];
    await run("cleanup", id);
    return seen;
  };

  // One stop in extension code with the probe script's call on its stack.
  const outcome = (seen: Stop[]): StopOutcome => {
    expect(seen.every((stop) => stop.top.startsWith("chrome-extension://"))).toBe(true);
    return seen.length === 1 && !seen[0]!.urls.includes(scriptUrl)
      ? "no-page-caller"
      : seen.length;
  };
  const callEach = async (arm?: (id: string) => Promise<void>) => {
    const outcomes: Record<string, StopOutcome> = {};
    for (const id of covered) {
      await run("setup", id);
      await arm?.(id);
      outcomes[id] = outcome(await stops(id));
    }
    return outcomes;
  };
  const reloadWith = async (fields: Record<string, unknown>) => {
    expect(
      await command(
        fields.methodIds ? CMD_XRAY_SET_INSPECTOR : CMD_XRAY_CLEAR_INSPECTOR,
        {
          tabId,
          ...fields,
          apply: "next-load",
        },
      ),
    ).toMatchObject({ appliedVia: "next-load" });
    await page.reload();
    await expect
      .poll(
        async () =>
          (await command(CMD_XRAY_GET_INSPECTOR_STATE, { tabId })).pendingReload,
      )
      .toBe(false);
  };
  const none = Object.fromEntries(covered.map((id) => [id, 0]));

  // Not armed: the page calls produce no stop.
  expect(await callEach()).toEqual(none);

  // Armed alone and live in every-call mode: one page call gives exactly one stop.
  const live = await callEach(async (id) => {
    expect(
      await command(CMD_XRAY_SET_INSPECTOR, {
        tabId,
        methodIds: [id],
        mode: "every-call",
        apply: "now",
      }),
    ).toMatchObject({ appliedVia: "live", liveCoverage: { notLive: 0 } });
  });
  expect(withKnownDefects("chromium", "live", live)).toEqual(
    expectedOutcomes("chromium", "live", covered),
  );

  // Armed together for the next load, the selection reaches the early-inline
  // and full runtime layers: a second layer reporting the same call stops twice.
  await reloadWith({ methodIds: covered, mode: "every-call" });
  expect(withKnownDefects("chromium", "next-load", await callEach())).toEqual(
    expectedOutcomes("chromium", "next-load", covered),
  );

  await reloadWith({});
  expect(await callEach()).toEqual(none);
  await cdp.detach();
});
