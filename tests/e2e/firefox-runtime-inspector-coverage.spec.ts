import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect } from "@playwright/test";

import {
  CMD_XRAY_CLEAR_INSPECTOR,
  CMD_XRAY_GET_INSPECTOR_STATE,
  CMD_XRAY_SET_INSPECTOR,
} from "../../packages/xray-protocol/src/inspector-commands";
import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";

import { openFxOptionsProbe, test } from "./firefox-runtime.shared";
import {
  classifyArmable,
  expectedOutcomes,
  PROBE_SCRIPT_PATH,
  probeScript,
  type StopOutcome,
  withKnownDefects,
} from "./inspector-method-probes";

type Packet = {
  from?: string;
  type?: string;
  why?: { type?: string };
  frame?: { threadActor?: string };
  tabs?: { actor: string; url: string }[];
};
type Remote = {
  disconnect(): void;
  client: {
    request(packet: Record<string, unknown> | string): Promise<Packet>;
    _handleMessage(packet: Packet): void;
  };
};

// The trace recorder reads Date in the page and would add stops.
test.use({ trace: "off" });

const WORKER_URLS = {
  worker: "/inspector-coverage-worker.js",
  sharedWorker: "/inspector-coverage-shared-worker.js",
  serviceWorker: "/inspector-coverage-service-worker.js",
};

test("each armed Inspector method stops exactly once per Firefox page call", async ({
  context,
  extensionOrigin,
  debuggerPort,
}) => {
  // Four passes over every covered method share one tab.
  test.slow();
  const options = await openFxOptionsProbe({ context, extensionOrigin, debuggerPort });
  const command = (type: string, fields: Record<string, unknown> = {}) =>
    options.evaluate<Record<string, unknown>>(
      `chrome.runtime.sendMessage(${JSON.stringify({ type, ...fields })})`,
    );
  const page = await context.newPage();
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === PROBE_SCRIPT_PATH) {
      response.writeHead(200, { "content-type": "application/javascript" });
      response.end(probeScript(WORKER_URLS));
    } else if (Object.values(WORKER_URLS).includes(pathname)) {
      response.writeHead(200, { "content-type": "application/javascript" });
      response.end("self.onmessage = () => undefined;");
    } else {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`<!doctype html><script src="${PROBE_SCRIPT_PATH}"></script>`);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing probe port");
  const probeUrl = `http://127.0.0.1:${address.port}/inspector-coverage`;
  const api = (await import(
    pathToFileURL(path.resolve("node_modules/web-ext/lib/firefox/remote.js")).href
  )) as {
    connectWithMaxRetries(options: {
      port: number;
      maxRetries: number;
    }): Promise<Remote>;
  };
  const remote = await api.connectWithMaxRetries({ port: debuggerPort, maxRetries: 0 });
  // web-ext's client does not classify debugger packets as unsolicited: count
  // and resume real stops without feeding them into its request queue.
  const handleMessage = remote.client._handleMessage.bind(remote.client);
  const stops: Packet[] = [];
  remote.client._handleMessage = (packet) => {
    if (packet.type === "paused") {
      if (packet.why?.type !== "debuggerStatement") return;
      stops.push(packet);
      void remote.client.request({ to: packet.from!, type: "resume" });
    } else if (
      packet.type !== "newSource" &&
      packet.type !== "newGlobal" &&
      packet.type !== "resource-available-form" &&
      packet.type !== "resource-destroyed-form" &&
      packet.type !== "resource-updated-form"
    )
      handleMessage(packet);
  };
  try {
    const examples = await command(EXTENSION_COMMAND_TYPES.loadSampleData);
    expect(examples.ok).toBe(true);
    const locationId = (examples.locations as { id: string }[])[0]!.id;
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
          },
          featureFlags: { temporalApi: true },
        })
      ).ok,
    ).toBe(true);
    // Service Worker registration is armable only where a rule blocks it.
    const settings = (await command(EXTENSION_COMMAND_TYPES.getSettings)) as {
      locations: unknown[];
      rules: { pattern: string }[];
      containerAssignments?: unknown[];
    };
    expect(
      (
        await command(EXTENSION_COMMAND_TYPES.saveLocationModel, {
          locations: settings.locations,
          rules: [
            ...settings.rules.filter((rule) => rule.pattern !== "127.0.0.1"),
            {
              pattern: "127.0.0.1",
              locationId,
              enabled: true,
              blockServiceWorkerRegistration: true,
            },
          ],
          containerAssignments: settings.containerAssignments ?? [],
        })
      ).ok,
    ).toBe(true);

    await page.goto(probeUrl);
    const tabs = await options.evaluate<{ id: number; url: string }[]>(
      "chrome.tabs.query({})",
    );
    const tabId = tabs.find((tab) => tab.url === probeUrl)!.id;
    const state = await command(CMD_XRAY_GET_INSPECTOR_STATE, { tabId });
    expect(state).toMatchObject({ available: true, appliesLive: true, armed: false });
    const coverage = classifyArmable("firefox", state.trappableMethodIds as string[]);
    expect(coverage).toMatchObject({
      uncovered: [],
      unexpected: [],
      notOffered: Object.keys(coverage.notOfferedReasons).sort(),
    });
    const { covered } = coverage;
    await test.info().attach("firefox-inspector-coverage", {
      body: JSON.stringify({ ...coverage, covered: covered.length }, null, 2),
      contentType: "application/json",
    });

    // A reload can keep the old thread actor alive; count stops of the current one.
    let thread = "";
    const attachThread = async () => {
      const listed = await remote.client.request("listTabs");
      const tab = listed.tabs!.find((row) => row.url.startsWith(probeUrl))!;
      const target = await remote.client.request({ to: tab.actor, type: "getTarget" });
      thread = target.frame!.threadActor!;
      await remote.client.request({ to: thread, type: "attach", options: {} });
    };
    await attachThread();

    const run = (step: "setup" | "call" | "cleanup", id: string) =>
      page.evaluate(`window.inspectorCoverage.${step}(${JSON.stringify(id)})`);
    // A stopped call cannot settle before its resume, so the count is complete
    // when the call returns.
    const count = async (id: string) => {
      stops.length = 0;
      await run("call", id);
      const seen = stops.filter((packet) => packet.from === thread).length;
      await run("cleanup", id);
      return seen;
    };
    const callEach = async (arm?: (id: string) => Promise<void>) => {
      const outcomes: Record<string, StopOutcome> = {};
      for (const id of covered) {
        await run("setup", id);
        await arm?.(id);
        outcomes[id] = await count(id);
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
      await attachThread();
    };
    const none = Object.fromEntries(covered.map((id) => [id, 0]));

    // Not armed: the page calls produce no stop.
    expect(await callEach()).toEqual(none);

    // Armed alone and live in every-call mode: a second wrapper or world
    // reporting the same call would stop twice.
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
    expect(withKnownDefects("firefox", "live", live)).toEqual(
      expectedOutcomes("firefox", "live", covered),
    );

    // Armed together for the next load, the selection reaches the early bundle
    // and the main runtime: each call still stops exactly once.
    await reloadWith({ methodIds: covered, mode: "every-call" });
    expect(withKnownDefects("firefox", "next-load", await callEach())).toEqual(
      expectedOutcomes("firefox", "next-load", covered),
    );

    await reloadWith({});
    expect(await callEach()).toEqual(none);
  } finally {
    remote.disconnect();
    await page.close();
    await options.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
