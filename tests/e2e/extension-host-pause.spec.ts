import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";
import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";

import { getProbeHostUrl, readWorkerSnapshot } from "./extension-test.helpers";
import { ackReleaseNotices, expect, test } from "./fixtures";

test("host pause reloads matching tabs, inherits through frames and workers, and preserves independent hosts and WebRTC", async ({
  context,
  extensionId,
  serverUrl,
  openPopup,
}) => {
  await ackReleaseNotices(context, extensionId, { reduceMotion: true });
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const nativeLanguage = await options.evaluate(() => navigator.language);
  const settingsBefore = await options.evaluate(
    async ({ commands, locations }) => {
      await chrome.runtime.sendMessage({
        type: commands.saveLocationModel,
        locations,
        rules: [],
      });
      await chrome.runtime.sendMessage({
        type: commands.saveSimpleSettings,
        globalFallbackRule: { enabled: true, locationId: "spf-warsaw" },
        sharedWorkerHandlingMode: "spoof",
      });
      return chrome.runtime.sendMessage({ type: commands.getSettings });
    },
    { commands: EXTENSION_COMMAND_TYPES, locations: EXAMPLE_LOCATIONS },
  );
  const readPolicy = () =>
    options.evaluate(async () => chrome.privacy.network.webRTCIPHandlingPolicy.get({}));
  const privacyBefore = await readPolicy();
  const hUrl = new URL(getProbeHostUrl(serverUrl));
  hUrl.hostname = "localhost";
  const kUrl = getProbeHostUrl(serverUrl);
  const h = await context.newPage();
  const h2 = await context.newPage();
  const k = await context.newPage();
  await Promise.all([h.goto(hUrl.toString()), h2.goto(`${hUrl}?second`), k.goto(kUrl)]);
  await expect.poll(() => h.evaluate(() => navigator.language)).toBe("pl");
  await expect.poll(() => k.evaluate(() => navigator.language)).toBe("pl");
  const popup = await openPopup(h);
  await popup.locator("#host-protection-pause").click();
  const pausedNavigations = Promise.all([
    h.waitForEvent("domcontentloaded"),
    h2.waitForEvent("domcontentloaded"),
  ]);
  await popup.locator("#pause-host-ten-minutes").click();
  await pausedNavigations;
  await expect(popup.locator("#host-protection-pause")).toHaveAttribute(
    "data-pause-state",
    "active",
  );
  await expect.poll(() => h.evaluate(() => navigator.language)).toBe(nativeLanguage);
  await expect.poll(() => h2.evaluate(() => navigator.language)).toBe(nativeLanguage);
  expect(await k.evaluate(() => navigator.language)).toBe("pl");
  expect(await readPolicy()).toEqual(privacyBefore);

  // H → iframe K inherits H's exception. K → iframe H inherits K's protection.
  const frameKUrl = new URL("/frame?in-h", kUrl).toString();
  const frameHUrl = new URL("/frame?in-k", hUrl).toString();
  await h
    .locator("#mirror-frame")
    .evaluate((element, url) => element.setAttribute("src", url), frameKUrl);
  await k
    .locator("#mirror-frame")
    .evaluate((element, url) => element.setAttribute("src", url), frameHUrl);
  await expect
    .poll(() => h.frames().some((frame) => frame.url() === frameKUrl))
    .toBe(true);
  await expect
    .poll(() => k.frames().some((frame) => frame.url() === frameHUrl))
    .toBe(true);
  const frameK = h.frames().find((frame) => frame.url() === frameKUrl)!;
  const frameH = k.frames().find((frame) => frame.url() === frameHUrl)!;
  await expect
    .poll(() => frameK.evaluate(() => navigator.language))
    .toBe(nativeLanguage);
  await expect.poll(() => frameH.evaluate(() => navigator.language)).toBe("pl");
  await h.locator("#collect-worker").click();
  expect((await readWorkerSnapshot(h)).language).toBe(nativeLanguage);
  await frameH.locator("#collect-worker").click();
  // Cross-origin frame workers remain native by the existing worker policy.
  expect((await readWorkerSnapshot(frameH)).language).toBe(nativeLanguage);
  await k.locator("#collect-worker").click();
  expect((await readWorkerSnapshot(k)).language).toBe("pl");
  const pausedHeaders = await frameK.evaluate(async () =>
    (await fetch("/echo-accept-language")).text(),
  );
  const protectedHeaders = await frameH.evaluate(async () =>
    (await fetch("/echo-accept-language")).text(),
  );
  expect(pausedHeaders).not.toContain("pl");
  expect(protectedHeaders).toContain("pl");

  // Resume uses the latest configuration, never a saved copy from pause start.
  await options.evaluate(
    async (commands) =>
      chrome.runtime.sendMessage({
        type: commands.saveSimpleSettings,
        globalFallbackRule: { enabled: true, locationId: "spf-paris" },
      }),
    EXTENSION_COMMAND_TYPES,
  );
  const resumedNavigations = Promise.all([
    h.waitForEvent("domcontentloaded"),
    h2.waitForEvent("domcontentloaded"),
  ]);
  await popup.locator("#resume-host-protection").click();
  await resumedNavigations;
  await expect
    .poll(() => h.evaluate(() => navigator.language))
    .toBe(EXAMPLE_LOCATIONS.find((location) => location.id === "spf-paris")!.language);
  await expect
    .poll(() => h2.evaluate(() => navigator.language))
    .toBe(EXAMPLE_LOCATIONS.find((location) => location.id === "spf-paris")!.language);
  await expect(popup.locator("#host-protection-pause")).toHaveAttribute(
    "data-pause-state",
    "none",
  );
  const settingsAfter = await options.evaluate(
    async (type) => chrome.runtime.sendMessage({ type }),
    EXTENSION_COMMAND_TYPES.getSettings,
  );
  expect(settingsAfter.rules).toEqual(settingsBefore.rules);
  expect(settingsAfter.trustedSites).toEqual(settingsBefore.trustedSites);
  expect(await readPolicy()).toEqual(privacyBefore);
});

test("expired host pauses restore new documents and mark existing native documents for reload", async ({
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
      });
    },
    { commands: EXTENSION_COMMAND_TYPES, locations: EXAMPLE_LOCATIONS },
  );
  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await expect.poll(() => page.evaluate(() => navigator.language)).toBe("pl");
  const popup = await openPopup(page);
  await popup.locator("#host-protection-pause").click();
  const pausedNavigation = page.waitForEvent("domcontentloaded");
  await popup.locator("#pause-host-ten-minutes").click();
  await pausedNavigation;
  await expect.poll(() => page.evaluate(() => navigator.language)).toBe(nativeLanguage);
  await expect(popup.locator("#host-protection-pause")).toHaveAttribute(
    "data-pause-state",
    "active",
  );
  await popup.keyboard.press("Escape");
  await popup.locator("#host-protection-pause").click();
  const background =
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const restored = await context.newPage();
  try {
    await background.evaluate(() => {
      const originalNow = Date.now;
      Object.defineProperty(globalThis, "__pt24OriginalNow", {
        value: originalNow,
        configurable: true,
      });
      const expiredNow = originalNow() + 10 * 60_000;
      Date.now = () => expiredNow;
    });
    // Navigation must reconcile expiry even when the browser alarm is delayed.
    await restored.goto(`${getProbeHostUrl(serverUrl)}?after-expiry`);
    await popup.bringToFront();
    await expect(popup.locator("#host-protection-pause")).toHaveAttribute(
      "data-pause-state",
      "reload-required",
    );
  } finally {
    await background.evaluate(() => {
      const scope = globalThis as typeof globalThis & {
        __pt24OriginalNow?: typeof Date.now;
      };
      if (scope.__pt24OriginalNow) Date.now = scope.__pt24OriginalNow;
      delete scope.__pt24OriginalNow;
    });
  }
  expect(await page.evaluate(() => navigator.language)).toBe(nativeLanguage);
  await expect.poll(() => restored.evaluate(() => navigator.language)).toBe("pl");
  const resumedNavigation = page.waitForEvent("domcontentloaded");
  await popup.locator("#resume-host-protection").click();
  await resumedNavigation;
  await expect.poll(() => page.evaluate(() => navigator.language)).toBe("pl");
  await expect(popup.locator("#host-protection-pause")).toHaveAttribute(
    "data-pause-state",
    "none",
  );
});
