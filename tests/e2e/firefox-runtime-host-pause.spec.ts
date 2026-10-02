import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";

import { openFxOptionsProbe, test } from "./firefox-runtime.shared";

const readWorkerLanguage = async (page: Page): Promise<string> => {
  // A DOM result channel observes the worker script itself.
  await page.evaluate(() => {
    const output = document.createElement("pre");
    output.id = "pt24-worker";
    const script = document.createElement("script");
    script.textContent = `(() => {
      const output = document.getElementById("pt24-worker");
      const worker = new Worker("/worker-scope-race-dedicated.js");
      worker.onmessage = event => {output.textContent = JSON.stringify({language: event.data.language}); worker.terminate();};
      worker.onerror = event => {output.textContent = JSON.stringify({error: event.message}); worker.terminate();};
    })();`;
    document.body.append(output, script);
  });
  await expect(page.locator("#pt24-worker")).not.toHaveText("");
  const result = JSON.parse(await page.locator("#pt24-worker").innerText()) as {
    language?: string;
    error?: string;
  };
  if (result.error) throw new Error(result.error);
  return result.language!;
};

test("Firefox host pause preserves top document scope and container assignments", async ({
  context,
  serverUrl,
  extensionOrigin,
  debuggerPort,
}) => {
  test.setTimeout(120_000);
  const options = await openFxOptionsProbe({ context, extensionOrigin, debuggerPort });
  const command = (type: string, fields: Record<string, unknown> = {}) =>
    options.evaluate<Record<string, unknown>>(
      `chrome.runtime.sendMessage(${JSON.stringify({ type, ...fields })})`,
    );
  const h = await context.newPage();
  const k = await context.newPage();
  const hUrl = serverUrl.replace("127.0.0.1", "localhost");
  const nativeLanguage = await h.evaluate(() => navigator.language);
  try {
    const settings = await command(EXTENSION_COMMAND_TYPES.getSettings);
    expect(settings.ok).toBe(true);
    const locations = settings.locations as { id: string; timeZone: string }[];
    const warsaw = locations.find((location) => location.timeZone === "Europe/Warsaw");
    expect(warsaw).toBeDefined();
    const saved = await command(EXTENSION_COMMAND_TYPES.saveSimpleSettings, {
      globalFallbackRule: { enabled: true, locationId: warsaw!.id },
      sharedWorkerHandlingMode: "spoof",
    });
    expect(saved.ok).toBe(true);
    await Promise.all([h.goto(`${hUrl}/?paused`), k.goto(`${serverUrl}/?protected`)]);
    await expect.poll(() => h.evaluate(() => navigator.language)).toBe("pl");
    await expect.poll(() => k.evaluate(() => navigator.language)).toBe("pl");
    const containerTab = await options.evaluate<{
      id: number;
      cookieStoreId: string;
    }>(`(async () => {
      const identity = await browser.contextualIdentities.create({name: "PT24 Scope", color: "blue", icon: "fingerprint"});
      const tab = await browser.tabs.create({url: ${JSON.stringify(`${hUrl}/?container`)}, cookieStoreId: identity.cookieStoreId, active: false});
      return {id: tab.id, cookieStoreId: identity.cookieStoreId};
    })()`);
    await expect
      .poll(() =>
        options.evaluate<{ status: string; url: string }>(
          `browser.tabs.get(${containerTab.id}).then(tab => ({status: tab.status, url: tab.url}))`,
        ),
      )
      .toEqual({ status: "complete", url: `${hUrl}/?container` });
    const containerLanguage = () =>
      options.evaluate<string>(
        `browser.scripting.executeScript({target: {tabId: ${containerTab.id}}, world: "MAIN", func: () => navigator.language}).then(results => results[0].result)`,
      );
    await expect.poll(containerLanguage).toBe("pl");
    const beforePause = await command(EXTENSION_COMMAND_TYPES.getSettings);
    const tabs = await options.evaluate<{ id: number; url: string }[]>(
      "chrome.tabs.query({})",
    );
    const tabId = tabs.find((tab) => tab.url?.startsWith(`${hUrl}/`))!.id;
    const navigation = h.waitForEvent("domcontentloaded");
    const paused = await command(EXTENSION_COMMAND_TYPES.setHostProtectionPause, {
      tabId,
      duration: "session",
    });
    expect(paused.ok).toBe(true);
    await navigation;
    await expect.poll(() => h.evaluate(() => navigator.language)).toBe(nativeLanguage);
    expect(await k.evaluate(() => navigator.language)).toBe("pl");
    await expect.poll(containerLanguage).toBe(nativeLanguage);
    for (const [page, url] of [
      [h, `${serverUrl}/?frame-k`],
      [k, `${hUrl}/?frame-h`],
    ] as const) {
      await page.evaluate((src) => {
        const iframe = document.createElement("iframe");
        iframe.src = src;
        document.body.append(iframe);
      }, url);
      await expect
        .poll(() => page.frames().some((frame) => frame.url() === url))
        .toBe(true);
      const frame = page.frames().find((frame) => frame.url() === url)!;
      await expect
        .poll(() => frame.evaluate(() => navigator.language))
        .toBe(page === h ? nativeLanguage : "pl");
    }
    expect(await readWorkerLanguage(h)).toBe(nativeLanguage);
    const after = await command(EXTENSION_COMMAND_TYPES.getSettings);
    expect(after.rules).toEqual(settings.rules);
    expect(after.containerAssignments).toEqual(beforePause.containerAssignments);
    expect(after.trustedSites).toEqual(settings.trustedSites);
    const resumedNavigation = h.waitForEvent("domcontentloaded");
    expect(
      (
        await command(EXTENSION_COMMAND_TYPES.setHostProtectionPause, {
          tabId,
          duration: "resume",
        })
      ).ok,
    ).toBe(true);
    await resumedNavigation;
    await expect.poll(() => h.evaluate(() => navigator.language)).toBe("pl");
    await expect.poll(containerLanguage).toBe("pl");
  } finally {
    const tabs = await options.evaluate<{ id: number; url: string }[]>(
      "chrome.tabs.query({})",
    );
    const tabId = tabs.find((tab) => tab.url?.startsWith(`${hUrl}/`))?.id;
    if (tabId !== undefined)
      await command(EXTENSION_COMMAND_TYPES.setHostProtectionPause, {
        tabId,
        duration: "resume",
      });
    await options.close();
  }
});
