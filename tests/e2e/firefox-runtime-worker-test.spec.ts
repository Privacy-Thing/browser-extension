import { expect } from "@playwright/test";
import type { Page, Frame } from "@playwright/test";

import { EXTENSION_COMMAND_TYPES as commands } from "../../src/shared/extension-contract";
import type { WorkerTestResponse } from "../../src/shared/worker-test";

import { openFxOptionsProbe, test } from "./firefox-runtime.shared";

const probe = async (page: Page | Frame, kind: "service-worker" | "shared-worker") => {
  await page.evaluate((workerKind) => {
    document.getElementById("pt26-result")?.remove();
    const output = document.createElement("pre");
    output.id = "pt26-result";
    const script = document.createElement("script");
    script.textContent =
      workerKind === "service-worker"
        ? `navigator.serviceWorker.register("/worker-scope-race-service.js", {scope: "/pt26/"}).then(async registration => {await registration.unregister();document.getElementById("pt26-result").textContent = "allowed";}, error => {document.getElementById("pt26-result").textContent = error.name + ": " + error.message;});`
        : `(() => {try {const worker = new SharedWorker("/worker-scope-race-shared.js", {name: "pt26"});worker.onerror = () => {document.getElementById("pt26-result").textContent = "blocked";};worker.port.onmessage = event => {document.getElementById("pt26-result").textContent = event.data.language;worker.port.close();};worker.port.start();worker.port.postMessage("probe");} catch(error) {document.getElementById("pt26-result").textContent = error.name + ": " + error.message;}})();`;
    document.body.append(output, script);
  }, kind);
  await expect(page.locator("#pt26-result")).not.toHaveText("");
  return page.locator("#pt26-result").innerText();
};

test("Firefox worker assistant restores service workers and isolates native shared workers by top host", async ({
  context,
  serverUrl,
  extensionOrigin,
  debuggerPort,
}) => {
  const options = await openFxOptionsProbe({ context, extensionOrigin, debuggerPort });
  const command = <T>(type: string, fields: Record<string, unknown> = {}) =>
    options.evaluate<T>(
      `chrome.runtime.sendMessage(${JSON.stringify({ type, ...fields })})`,
    );
  const h = await context.newPage();
  const k = await context.newPage();
  const hUrl = serverUrl.replace("127.0.0.1", "localhost");
  const nativeLanguage = await h.evaluate(() => navigator.language);

  try {
    const native = await context.newPage();
    await native.goto(hUrl + "/?pt26-native");
    expect(await probe(native, "service-worker")).toBe("allowed");
    await native.close();
    const settings = await command<{ locations: { id: string; timeZone: string }[] }>(
      commands.getSettings,
    );
    const location = settings.locations.find(
      (item) => item.timeZone === "Europe/Warsaw",
    )!;
    expect(
      (
        await command<{ ok: boolean }>(commands.saveSimpleSettings, {
          globalFallbackRule: { enabled: true, locationId: location.id },
          sharedWorkerHandlingMode: "strict",
          sharedSpoofing: { serviceWorker: true },
        })
      ).ok,
    ).toBe(true);
    await Promise.all([h.goto(hUrl + "/?pt26-h"), k.goto(serverUrl + "/?pt26-k")]);
    await expect.poll(() => h.evaluate(() => navigator.language)).toBe("pl");
    const tabs = await options.evaluate<{ id: number; url: string }[]>(
      "chrome.tabs.query({})",
    );
    const tabId = tabs.find((tab) => tab.url === h.url())!.id;
    const hostname = "localhost";
    const before = await command(commands.getSettings);
    expect(await probe(h, "service-worker")).toMatch(/^SecurityError:/);
    const navigation = h.waitForEvent("domcontentloaded");
    const started = await command<WorkerTestResponse>(commands.startWorkerTest, {
      tabId,
      hostname,
      kind: "service-worker",
    });
    expect(started.ok, JSON.stringify(started)).toBe(true);
    await navigation;
    if (!started.ok || !started.session) throw new Error("Missing test session");
    expect(await probe(h, "service-worker")).toBe("allowed");
    expect(await probe(k, "service-worker")).toMatch(/^SecurityError:/);
    const restored = h.waitForEvent("domcontentloaded");
    expect(
      (
        await command<WorkerTestResponse>(commands.finishWorkerTest, {
          tabId,
          hostname,
          id: started.session.id,
          action: "failed",
        })
      ).ok,
    ).toBe(true);
    await restored;
    expect(await probe(h, "service-worker")).toMatch(/^SecurityError:/);
    const sharedNavigation = h.waitForEvent("domcontentloaded");
    const shared = await command<WorkerTestResponse>(commands.startWorkerTest, {
      tabId,
      hostname,
      kind: "shared-worker",
    });
    expect(shared.ok, JSON.stringify(shared)).toBe(true);
    await sharedNavigation;
    if (!shared.ok || !shared.session) throw new Error("Missing shared worker test");
    expect(await probe(h, "shared-worker")).toBe(nativeLanguage);
    expect(await h.evaluate(() => navigator.language)).toBe("pl");
    for (const [page, url, expected] of [
      [h, serverUrl + "/?pt26-frame-k", nativeLanguage],
      [k, hUrl + "/?pt26-frame-h", "blocked"],
    ] as const) {
      await page.evaluate((src) => {
        const frame = document.createElement("iframe");
        frame.src = src;
        document.body.append(frame);
      }, url);
      await expect
        .poll(() => page.frames().some((frame) => frame.url() === url))
        .toBe(true);
      const frame = page.frames().find((item) => item.url() === url)!;
      expect(await probe(frame, "shared-worker")).toBe(expected);
    }
    const cancelled = h.waitForEvent("domcontentloaded");
    expect(
      (
        await command<WorkerTestResponse>(commands.finishWorkerTest, {
          tabId,
          hostname,
          id: shared.session.id,
          action: "cancel",
        })
      ).ok,
    ).toBe(true);
    await cancelled;
    expect(await probe(h, "shared-worker")).toBe("blocked");
    expect(await command(commands.getSettings)).toEqual(before);
    const saveStartNavigation = h.waitForEvent("domcontentloaded");
    const saveTest = await command<WorkerTestResponse>(commands.startWorkerTest, {
      tabId,
      hostname,
      kind: "service-worker",
    });
    expect(saveTest.ok, JSON.stringify(saveTest)).toBe(true);
    await saveStartNavigation;
    if (!saveTest.ok || !saveTest.session)
      throw new Error("Missing saved test session");
    expect(
      (
        await command<WorkerTestResponse>(commands.finishWorkerTest, {
          tabId,
          hostname,
          id: saveTest.session.id,
          action: "helped",
        })
      ).ok,
    ).toBe(true);
    const savedNavigation = h.waitForEvent("domcontentloaded");
    expect(
      (
        await command<WorkerTestResponse>(commands.finishWorkerTest, {
          tabId,
          hostname,
          id: saveTest.session.id,
          action: "save",
        })
      ).ok,
    ).toBe(true);
    await savedNavigation;
    expect(await command(commands.getSettings)).toEqual({
      ...(before as object),
      workerPolicyExceptions: { localhost: { serviceWorker: false } },
    });
    expect(await probe(h, "service-worker")).toBe("allowed");
    expect(await probe(k, "service-worker")).toMatch(/^SecurityError:/);
    const removedNavigation = h.waitForEvent("domcontentloaded");
    expect(
      (
        await command<{ ok: boolean }>(commands.saveSimpleSettings, {
          removeWorkerPolicyException: hostname,
        })
      ).ok,
    ).toBe(true);
    await removedNavigation;
    expect(await probe(h, "service-worker")).toMatch(/^SecurityError:/);
    expect(await command(commands.getSettings)).toEqual(before);
  } finally {
    await options.close();
  }
});

test("Firefox saved worker exceptions preserve first-call protection in unrelated cross-origin frames", async ({
  context,
  serverUrl,
  extensionOrigin,
  debuggerPort,
}) => {
  const options = await openFxOptionsProbe({ context, extensionOrigin, debuggerPort });
  const command = <T>(type: string, fields: Record<string, unknown> = {}) =>
    options.evaluate<T>(
      `chrome.runtime.sendMessage(${JSON.stringify({ type, ...fields })})`,
    );
  try {
    const settings = await command<{ locations: { id: string; timeZone: string }[] }>(
      commands.getSettings,
    );
    const location = settings.locations.find(
      (item) => item.timeZone === "Europe/Warsaw",
    )!;
    expect(
      (
        await command<{ ok: boolean }>(commands.saveSimpleSettings, {
          globalFallbackRule: { enabled: true, locationId: location.id },
          sharedSpoofing: { serviceWorker: true },
          workerPolicyExceptions: { localhost: { serviceWorker: false } },
        })
      ).ok,
    ).toBe(true);
    await options.grantUserScripts();
    const page = await context.newPage();
    await page.goto(serverUrl + "/?worker-policy-protected-top");
    await expect.poll(() => page.evaluate(() => navigator.language)).toBe("pl");
    const frameUrl =
      serverUrl.replace("127.0.0.1", "localhost") + "/worker-policy-first-call";
    await page.evaluate((src) => {
      const frame = document.createElement("iframe");
      frame.src = src;
      document.body.append(frame);
    }, frameUrl);
    await expect
      .poll(() => page.frames().some((frame) => frame.url() === frameUrl))
      .toBe(true);
    const frame = page.frames().find((item) => item.url() === frameUrl)!;
    const result = frame.locator("#worker-policy-first-call");
    await expect
      .poll(async () => JSON.parse(await result.innerText()))
      .toEqual({
        language: "pl",
        serviceWorker: "SecurityError",
      });
  } finally {
    await options.close();
  }
});
