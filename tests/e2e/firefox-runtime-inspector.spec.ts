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

type Packet = {
  from?: string;
  type?: string;
  why?: { type?: string };
  frame?: {
    threadActor?: string;
    where?: { line?: number; source?: { url?: string } };
  };
  tabs?: { actor: string; url: string }[];
  frames?: {
    displayName?: string;
    where: { actor: string; line: number; column: number };
  }[];
};
type Remote = {
  disconnect(): void;
  client: {
    request(packet: Record<string, unknown> | string): Promise<Packet>;
    _handleMessage(packet: Packet): void;
    on(event: "unsolicited-event", listener: (packet: Packet) => void): void;
  };
};

test("Firefox Inspector pauses at a selected native getter in the real MAIN runtime", async ({
  context,
  extensionOrigin,
  debuggerPort,
}) => {
  const options = await openFxOptionsProbe({ context, extensionOrigin, debuggerPort });
  const command = (type: string, fields: Record<string, unknown> = {}) =>
    options.evaluate<Record<string, unknown>>(
      `chrome.runtime.sendMessage(${JSON.stringify({ type, ...fields })})`,
    );
  const page = await context.newPage();
  const server = createServer((request, response) => {
    if (request.url === "/distinctive-firefox-spy.js") {
      response.writeHead(200, { "content-type": "application/javascript" });
      response.end(
        'document.getElementById("read").onclick = function chosenRead() { document.getElementById("result").textContent = String(navigator.webdriver); };',
      );
    } else {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(
        '<!doctype html><button id="read">Read</button><output id="result"></output><script src="/distinctive-firefox-spy.js"></script>',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing probe port");
  const probeUrl = `http://127.0.0.1:${address.port}/inspector-probe`;
  const spyUrl = `http://127.0.0.1:${address.port}/distinctive-firefox-spy.js`;
  const api = (await import(
    pathToFileURL(path.resolve("node_modules/web-ext/lib/firefox/remote.js")).href
  )) as {
    connectWithMaxRetries(options: {
      port: number;
      maxRetries: number;
    }): Promise<Remote>;
  };
  const remote = await api.connectWithMaxRetries({ port: debuggerPort, maxRetries: 0 });
  // web-ext's reload client does not classify debugger packets as unsolicited.
  // Observe real pause packets without feeding them into its request queue.
  const handleMessage = remote.client._handleMessage.bind(remote.client);
  let onPause = (_packet: Packet): void => undefined;
  remote.client._handleMessage = (packet) => {
    if (packet.type === "paused") onPause(packet);
    else if (
      packet.type !== "newSource" &&
      packet.type !== "newGlobal" &&
      packet.type !== "resource-available-form" &&
      packet.type !== "resource-destroyed-form" &&
      packet.type !== "resource-updated-form"
    )
      handleMessage(packet);
  };
  try {
    const settings = await command(EXTENSION_COMMAND_TYPES.loadSampleData);
    expect(settings.ok).toBe(true);
    const locations = settings.locations as { id: string }[];
    expect(locations[0]).toBeDefined();
    expect(
      (
        await command(EXTENSION_COMMAND_TYPES.saveSimpleSettings, {
          browserFingerprintSpoofingEnabled: true,
          globalFallbackRule: { enabled: true, locationId: locations[0]!.id },
        })
      ).ok,
    ).toBe(true);
    await page.goto(probeUrl);
    const tabs = await options.evaluate<{ id: number; url: string }[]>(
      "chrome.tabs.query({})",
    );
    const tabId = tabs.find((tab) => tab.url === probeUrl)!.id;
    const state = await command(CMD_XRAY_GET_INSPECTOR_STATE, { tabId });
    expect(state.trappableMethodIds).toContain("navigator.webdriver");
    expect(state.trappableMethodIds).not.toContain("date.now");
    expect(state.trappableMethodIds).not.toContain("navigator.deviceMemory");
    // Covers delivery inside a new document; live arming has its own test below.
    expect(
      (
        await command(CMD_XRAY_SET_INSPECTOR, {
          tabId,
          methodIds: ["navigator.webdriver"],
          mode: "every-call",
          apply: "next-load",
        })
      ).appliedVia,
    ).toBe("next-load");
    await page.reload();
    const listed = await remote.client.request("listTabs");
    const tab = listed.tabs!.find((row) => row.url.startsWith(probeUrl))!;
    const target = await remote.client.request({ to: tab.actor, type: "getTarget" });
    const threadActor = target.frame!.threadActor!;
    await remote.client.request({
      to: threadActor,
      type: "attach",
      options: { useSourceMaps: true },
    });
    const paused = new Promise<Packet>((resolve) => {
      onPause = (packet) => {
        if (packet.why?.type === "debuggerStatement") resolve(packet);
      };
    });
    const value = page.locator("#read").click();
    const event = await paused;
    expect(event.why?.type).toBe("debuggerStatement");
    const frames = await remote.client.request({
      to: threadActor,
      type: "frames",
      start: 0,
      count: 12,
    });
    const caller = frames.frames!.find((frame) => frame.displayName === "chosenRead");
    expect(caller?.where.line).toBe(1);
    expect(frames.frames![0]!.where.actor).not.toBe(caller!.where.actor);
    await test.info().attach("firefox-pause", {
      body: JSON.stringify(
        {
          reason: event.why?.type,
          spyUrl,
          frames: frames.frames!.map((frame) => ({
            name: frame.displayName,
            ...frame.where,
          })),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await remote.client.request({ to: threadActor, type: "resume" });
    await value;
    await expect(page.locator("#result")).toHaveText("false");
  } finally {
    remote.disconnect();
    await page.close();
    await options.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("Firefox Inspector arms and clears a loaded document live", async ({
  context,
  extensionOrigin,
  debuggerPort,
}) => {
  const options = await openFxOptionsProbe({ context, extensionOrigin, debuggerPort });
  const command = (type: string, fields: Record<string, unknown> = {}) =>
    options.evaluate<Record<string, unknown>>(
      `chrome.runtime.sendMessage(${JSON.stringify({ type, ...fields })})`,
    );
  const page = await context.newPage();
  const server = createServer((request, response) => {
    if (request.url === "/distinctive-firefox-live-spy.js") {
      response.writeHead(200, { "content-type": "application/javascript" });
      response.end(
        [
          'document.getElementById("read").onclick = function chosenRead() {',
          '  const value = document.createElement("canvas").toDataURL();',
          '  document.getElementById("result").textContent = String(++reads) + ":" + value.slice(0, 5);',
          "};",
          "let reads = 0;",
        ].join("\n"),
      );
    } else {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(
        '<!doctype html><button id="read">Read</button><output id="result"></output><script src="/distinctive-firefox-live-spy.js"></script>',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing probe port");
  const probeUrl = `http://127.0.0.1:${address.port}/inspector-live-probe`;
  const api = (await import(
    pathToFileURL(path.resolve("node_modules/web-ext/lib/firefox/remote.js")).href
  )) as {
    connectWithMaxRetries(options: {
      port: number;
      maxRetries: number;
    }): Promise<Remote>;
  };
  const remote = await api.connectWithMaxRetries({ port: debuggerPort, maxRetries: 0 });
  const handleMessage = remote.client._handleMessage.bind(remote.client);
  const pauses: Packet[] = [];
  let onPause = (_packet: Packet): void => undefined;
  remote.client._handleMessage = (packet) => {
    if (packet.type === "paused") {
      pauses.push(packet);
      onPause(packet);
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
    const settings = await command(EXTENSION_COMMAND_TYPES.loadSampleData);
    expect(settings.ok).toBe(true);
    const locations = settings.locations as { id: string }[];
    expect(
      (
        await command(EXTENSION_COMMAND_TYPES.saveSimpleSettings, {
          browserFingerprintSpoofingEnabled: true,
          globalFallbackRule: { enabled: true, locationId: locations[0]!.id },
        })
      ).ok,
    ).toBe(true);
    await page.goto(probeUrl);
    const timeOrigin = await page.evaluate(() => performance.timeOrigin);
    const tabs = await options.evaluate<{ id: number; url: string }[]>(
      "chrome.tabs.query({})",
    );
    const tabId = tabs.find((tab) => tab.url === probeUrl)!.id;
    const state = await command(CMD_XRAY_GET_INSPECTOR_STATE, { tabId });
    expect(state).toMatchObject({ available: true, appliesLive: true });
    expect(state.trappableMethodIds).toContain("canvas.toDataURL");

    const listed = await remote.client.request("listTabs");
    const tab = listed.tabs!.find((row) => row.url.startsWith(probeUrl))!;
    const target = await remote.client.request({ to: tab.actor, type: "getTarget" });
    const threadActor = target.frame!.threadActor!;
    await remote.client.request({ to: threadActor, type: "attach", options: {} });

    expect(
      await command(CMD_XRAY_SET_INSPECTOR, {
        tabId,
        methodIds: ["canvas.toDataURL"],
        mode: "every-call",
        apply: "now",
      }),
    ).toMatchObject({ appliedVia: "live", liveCoverage: { notLive: 0 } });
    const paused = new Promise<Packet>((resolve) => {
      onPause = (packet) => {
        if (packet.why?.type === "debuggerStatement") resolve(packet);
      };
    });
    // The click cannot settle while the page is paused; await it after resuming.
    const read = page.locator("#read").click();
    expect((await paused).why?.type).toBe("debuggerStatement");
    const frames = await remote.client.request({
      to: threadActor,
      type: "frames",
      start: 0,
      count: 12,
    });
    expect(frames.frames!.map((frame) => frame.displayName)).toContain("chosenRead");
    await remote.client.request({ to: threadActor, type: "resume" });
    await read;
    await expect(page.locator("#result")).toHaveText(/^1:/);

    expect(
      await command(CMD_XRAY_CLEAR_INSPECTOR, { tabId, apply: "now" }),
    ).toMatchObject({ appliedVia: "live", state: { armed: false } });
    const before = pauses.length;
    await page.locator("#read").click();
    // A paused read could not write its result, so the result proves no pause.
    await expect(page.locator("#result")).toHaveText(/^2:/);
    expect(pauses).toHaveLength(before);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  } finally {
    remote.disconnect();
    await page.close();
    await options.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
