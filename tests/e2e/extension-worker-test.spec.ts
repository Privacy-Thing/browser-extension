import { readFile } from "node:fs/promises";

import type { Page, Frame } from "@playwright/test";

import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";
import { EXTENSION_COMMAND_TYPES as commands } from "../../src/shared/extension-contract";

import { getProbeHostUrl, readSharedWorkerSnapshot } from "./extension-test.helpers";
import { ackReleaseNotices, expect, test } from "./fixtures";

const registration = async (page: Page | Frame) =>
  page.evaluate(async () => {
    try {
      const worker = await navigator.serviceWorker.register(
        "/service-worker-probe.js",
        { scope: "/pt26/" },
      );
      await worker.unregister();
      return "allowed";
    } catch (error) {
      return error instanceof DOMException ? error.name : "error";
    }
  });
test("worker assistant restores a single host policy, inherits frames and keeps WebRTC and unrelated hosts", async ({
  context,
  extensionId,
  serverUrl,
  openPopup,
}) => {
  await ackReleaseNotices(context, extensionId, { reduceMotion: true });
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const before = await options.evaluate(
    async ({ commands, locations }) => {
      await chrome.runtime.sendMessage({
        type: commands.saveLocationModel,
        locations,
        rules: [],
      });
      await chrome.runtime.sendMessage({
        type: commands.saveSimpleSettings,
        globalFallbackRule: { enabled: true, locationId: "spf-warsaw" },
        sharedWorkerHandlingMode: "strict",
        sharedSpoofing: { serviceWorker: true },
      });
      return chrome.runtime.sendMessage({ type: commands.getSettings });
    },
    { commands, locations: EXAMPLE_LOCATIONS },
  );
  const privacyBefore = await options.evaluate(() =>
    chrome.privacy.network.webRTCIPHandlingPolicy.get({}),
  );
  const hUrl = getProbeHostUrl(serverUrl).replace("127.0.0.1", "localhost");
  const kUrl = getProbeHostUrl(serverUrl);
  const h = await context.newPage();
  const k = await context.newPage();
  await Promise.all([h.goto(hUrl), k.goto(kUrl)]);
  await expect.poll(() => h.evaluate(() => navigator.language)).toBe("pl");
  expect(await registration(h)).toBe("SecurityError");
  const popup = await openPopup(h);
  await popup.locator("[data-worker-test-open]").click();
  await expect(
    popup.locator('[data-worker-test-start="service-worker"]'),
  ).toBeEnabled();
  const testNavigation = h.waitForEvent("domcontentloaded");
  await popup.locator('[data-worker-test-start="service-worker"]').click();
  await testNavigation;
  await expect(popup.locator("[data-worker-test-phase]")).toHaveAttribute(
    "data-worker-test-phase",
    "testing",
  );
  await expect(popup.locator("[data-worker-test-failed]")).toBeEnabled();
  expect(await registration(h)).toBe("allowed");
  expect(await registration(k)).toBe("SecurityError");
  expect(await h.evaluate(() => navigator.language)).toBe("pl");
  const hk = `${kUrl}/frame?pt26-hk`;
  const kh = `${hUrl}/frame?pt26-kh`;
  await h
    .locator("#mirror-frame")
    .evaluate((element, url) => element.setAttribute("src", url), hk);
  await k
    .locator("#mirror-frame")
    .evaluate((element, url) => element.setAttribute("src", url), kh);
  await expect.poll(() => h.frames().some((frame) => frame.url() === hk)).toBe(true);
  await expect.poll(() => k.frames().some((frame) => frame.url() === kh)).toBe(true);
  expect(await registration(h.frames().find((frame) => frame.url() === hk)!)).toBe(
    "allowed",
  );
  expect(await registration(k.frames().find((frame) => frame.url() === kh)!)).toBe(
    "SecurityError",
  );
  const restoreNavigation = h.waitForEvent("domcontentloaded");
  await popup.locator("[data-worker-test-failed]").click();
  await restoreNavigation;
  await expect(popup.locator("[data-worker-test-phase]")).toHaveAttribute(
    "data-worker-test-phase",
    "failed",
  );
  expect(await registration(h)).toBe("SecurityError");
  await popup.locator("[data-worker-test-report] summary").click();
  await popup.locator('[data-worker-report-phase="after"]').click();
  const preview = await popup.locator("[data-worker-report-preview]").inputValue();
  expect(preview).not.toContain("localhost");
  expect(preview).not.toContain("authKey");
  const downloadEvent = popup.waitForEvent("download");
  await popup.locator("[data-worker-report-download]").click();
  const download = await downloadEvent;
  expect(await readFile((await download.path())!, "utf8")).toBe(preview);
  const after = await options.evaluate(
    async (type) => chrome.runtime.sendMessage({ type }),
    commands.getSettings,
  );
  expect(after.rules).toEqual(before.rules);
  expect(after.trustedSites).toEqual(before.trustedSites);
  expect(
    await options.evaluate(() => chrome.privacy.network.webRTCIPHandlingPolicy.get({})),
  ).toEqual(privacyBefore);
});
test("shared worker assistant needs two decisions to save a narrow exception and closes by restoring", async ({
  context,
  extensionId,
  serverUrl,
  openPopup,
}) => {
  await ackReleaseNotices(context, extensionId, { reduceMotion: true });
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const nativeLanguage = await options.evaluate(() => navigator.language);
  await options.evaluate(
    async ({ commands, locations }) => {
      await chrome.runtime.sendMessage({
        type: commands.saveLocationModel,
        locations,
        rules: [],
      });
      await chrome.runtime.sendMessage({
        type: commands.saveSimpleSettings,
        globalFallbackRule: { enabled: true, locationId: "spf-warsaw" },
        sharedWorkerHandlingMode: "strict",
      });
    },
    { commands, locations: EXAMPLE_LOCATIONS },
  );
  const h = await context.newPage();
  await h.goto(getProbeHostUrl(serverUrl));
  await expect.poll(() => h.evaluate(() => navigator.language)).toBe("pl");
  const popup = await openPopup(h);
  await popup.locator("[data-worker-test-open]").click();
  const navigation = h.waitForEvent("domcontentloaded");
  await popup.locator('[data-worker-test-start="shared-worker"]').click();
  await navigation;
  await expect(popup.locator("[data-worker-test-helped]")).toBeEnabled();
  await h.locator("#collect-shared-worker").click();
  expect((await readSharedWorkerSnapshot(h)).language).toBe(nativeLanguage);
  expect(await h.evaluate(() => navigator.language)).toBe("pl");
  await popup.locator("[data-worker-test-helped]").click();
  await expect(popup.locator("[data-worker-test-save]")).toBeEnabled();
  expect(
    (
      await options.evaluate(
        async (type) => chrome.runtime.sendMessage({ type }),
        commands.getSettings,
      )
    ).rules,
  ).toEqual([]);
  const restore = h.waitForEvent("domcontentloaded");
  await popup.keyboard.press("Escape");
  await restore;
  await expect(popup.locator("[data-worker-troubleshooter]")).toHaveCount(0);
  await popup.locator("[data-worker-test-open]").click();
  const secondNavigation = h.waitForEvent("domcontentloaded");
  await popup.locator('[data-worker-test-start="shared-worker"]').click();
  await secondNavigation;
  await expect(popup.locator("[data-worker-test-helped]")).toBeEnabled();
  await popup.locator("[data-worker-test-helped]").click();
  const savedNavigation = h.waitForEvent("domcontentloaded");
  await popup.locator("[data-worker-test-save]").click();
  await savedNavigation;
  await expect(popup.locator("[data-worker-test-phase]")).toHaveAttribute(
    "data-worker-test-phase",
    "saved",
  );
  const settings = await options.evaluate(
    async (type) => chrome.runtime.sendMessage({ type }),
    commands.getSettings,
  );
  expect(settings.rules).toHaveLength(1);
  expect(settings.rules[0]).toMatchObject({
    pattern: new URL(serverUrl).hostname,
    enabled: true,
    fingerprintSurfaceOverrides: { sharedWorker: "native" },
  });
});

test("closing the popup restores an active worker test without editing settings", async ({
  context,
  extensionId,
  serverUrl,
  openPopup,
}) => {
  await ackReleaseNotices(context, extensionId, { reduceMotion: true });
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await options.evaluate(
    async ({ commands, locations }) => {
      await chrome.runtime.sendMessage({
        type: commands.saveLocationModel,
        locations,
        rules: [],
      });
      await chrome.runtime.sendMessage({
        type: commands.saveSimpleSettings,
        globalFallbackRule: { enabled: true, locationId: "spf-warsaw" },
        sharedSpoofing: { serviceWorker: true },
      });
    },
    { commands, locations: EXAMPLE_LOCATIONS },
  );
  const h = await context.newPage();
  await h.goto(getProbeHostUrl(serverUrl));
  await expect.poll(() => h.evaluate(() => navigator.language)).toBe("pl");
  const popup = await openPopup(h);
  await popup.locator("[data-worker-test-open]").click();
  const navigation = h.waitForEvent("domcontentloaded");
  await popup.locator('[data-worker-test-start="service-worker"]').click();
  await navigation;
  await expect(popup.locator("[data-worker-test-helped]")).toBeEnabled();
  expect(await registration(h)).toBe("allowed");
  const restored = h.waitForEvent("domcontentloaded");
  await popup.close();
  await restored;
  expect(await registration(h)).toBe("SecurityError");
  expect(
    (
      await options.evaluate(
        async (type) => chrome.runtime.sendMessage({ type }),
        commands.getSettings,
      )
    ).rules,
  ).toEqual([]);
});
