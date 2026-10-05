import { expect } from "@playwright/test";
import { serializeDiagnosticText } from "@privacy-brand/xray-protocol/diagnostic-report";

import { openFxSidebarProbe, test } from "./firefox-runtime.shared";

test("Firefox X-Ray locally previews, cancels and downloads a partial report", async ({
  context,
  extensionOrigin,
  debuggerPort,
  serverUrl,
}) => {
  const site = await context.newPage();
  await site.goto(serverUrl);
  const ui = await openFxSidebarProbe({ context, extensionOrigin, debuggerPort });
  const present = (selector: string) =>
    ui.evaluate<boolean>(
      `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
    );
  const click = (selector: string) =>
    ui.evaluate(
      `(() => { const element = document.querySelector(${JSON.stringify(selector)}); element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); element.click(); return true; })()`,
    );
  const preview = () =>
    ui.evaluate<string>('document.querySelector("[data-report-preview]").value');
  try {
    await expect.poll(() => present("[data-report-prepare]")).toBe(true);
    await ui.evaluate(
      `Promise.all([chrome.tabs.query({}), chrome.windows.getCurrent()]).then(async ([tabs, currentWindow]) => { const tab = tabs.find(candidate => candidate.url?.startsWith(${JSON.stringify(serverUrl)})); if (!tab) throw new Error("Missing target tab"); if (tab.windowId !== currentWindow.id) await chrome.tabs.move(tab.id, { windowId: currentWindow.id, index: -1 }); await chrome.tabs.update(tab.id, { active: true }); return true; })`,
    );
    const host = new URL(serverUrl).hostname;
    await expect
      .poll(() =>
        ui.evaluate<string>(
          'document.querySelector("header + div")?.textContent ?? ""',
        ),
      )
      .toContain(host);
    // Record the actual Blob contents and still invoke the native download.
    // Playwright does not expose extension-page download events in Firefox RDP.
    await ui.evaluate(`(() => {
      window.__reportDownloads = [];
      const original = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        if (this.download.startsWith("privacy-thing-diagnostic")) {
          const filename = this.download;
          fetch(this.href).then(response => response.text()).then(content => window.__reportDownloads.push({ filename, content }));
        }
        return original.call(this);
      };
      return true;
    })()`);
    await click("[data-report-prepare]");
    const text = await preview();
    expect(text).not.toContain(host);
    await click('[data-report-view="json"]');
    const json = await preview();
    expect(JSON.parse(json).browser.family).toBe("firefox");
    expect(serializeDiagnosticText(JSON.parse(json))).toBe(text);
    for (const format of ["json", "text"])
      await click(`[data-report-download="${format}"]`);
    await expect
      .poll(() => ui.evaluate<number>("window.__reportDownloads.length"))
      .toBe(2);
    expect(await ui.evaluate("window.__reportDownloads")).toEqual([
      { filename: "privacy-thing-diagnostic-v1.json", content: json },
      { filename: "privacy-thing-diagnostic-v1.txt", content: text },
    ]);
    await click("[data-report-site-toggle]");
    expect(JSON.parse(await preview()).site.hostname).toBe(host);
    await click("[data-report-cancel]");
    await expect.poll(() => present("[data-diagnostic-report]")).toBe(false);
    expect(await ui.evaluate<number>("window.__reportDownloads.length")).toBe(2);
    await click("[data-report-prepare]");
    expect(await preview()).not.toContain(host);
    await click("[data-report-cancel]");
    await ui.evaluate(
      `(() => { chrome.runtime.sendMessage = () => Promise.reject(new Error("SECRET private.example.test missing permission")); return true; })()`,
    );
    await ui.evaluate(
      `chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => chrome.tabs.reload(tab.id)).then(() => true)`,
    );
    await expect
      .poll(() => present('[data-xray-report-entry] + [data-tone="error"]'))
      .toBe(true);
    await click("[data-report-prepare]");
    await click('[data-report-view="json"]');
    const partial = await preview();
    expect(JSON.parse(partial).reasonCodes).toContain("state-unavailable");
    expect(partial).not.toContain("SECRET");
    expect(partial).not.toContain(host);
  } finally {
    await ui.close();
  }
});
