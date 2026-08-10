import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";
import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";
import type { Location, DomainRule } from "../../src/shared/types";
import { getRuleModalAnchor } from "../../src/ui/options/navigation";

import {
  assignDomainProfile,
  expectRuleSheetClosed,
  exportSettings,
  getProbeHostUrl,
  importSettings,
  openPopupWithDefaults,
  openSettingsTab,
  readSettings,
  readSnapshot,
  saveSimpleSettings,
  selectPopupOption,
} from "./extension-test.helpers";
import { ackReleaseNotices, expect, test } from "./fixtures";

test.beforeEach(async ({ context, extensionId }) => {
  await ackReleaseNotices(context, extensionId, { reduceMotion: true });
});

test("loads the popup and shows domain controls", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  test.slow();
  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));

  const popupPage = await openPopupWithDefaults(context, extensionId, page);

  await expect(popupPage.getByRole("img", { name: "Privacy Thing" })).toBeVisible();
  await expect(popupPage.locator("#current-profile")).toHaveCount(0);
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "fallback-inactive",
  );
  const neutralCardAccent = await popupPage
    .locator("#current-rule")
    .evaluate((card) => card.getAttribute("style") ?? "");
  expect(neutralCardAccent).not.toContain("tone-warning");
  await expect(popupPage.locator("#toggle-current-rule")).toBeDisabled();
  await expect(popupPage.locator("#open-rule-settings")).toHaveAttribute(
    "data-action-intent",
    "open-global-fallback-options",
  );
  await expect(popupPage.locator("#open-domain-rule-settings")).toHaveAttribute(
    "data-action-intent",
    "create-exact-domain-rule",
  );
  await popupPage.locator("#open-domain-rule-settings").click();
  await expect(popupPage.getByRole("dialog")).toBeVisible();
  await expect(popupPage.locator(".gw-popup-core-pane")).toBeVisible();
  await expect(popupPage.locator(".gw-popup-core-pane")).not.toHaveAttribute(
    "inert",
    "",
  );
  await expect(popupPage.locator(".gw-popup-core-pane")).not.toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await popupPage.setViewportSize({ width: 360, height: 700 });
  await expect(popupPage.locator(".gw-popup-core-pane")).toBeHidden();
  await expect(popupPage.getByRole("button", { name: "Back" })).toBeVisible();
  await selectPopupOption(popupPage, "#current-rule-mode", "Exact host");
  await selectPopupOption(popupPage, "#current-profile-select", "Warsaw");
  await popupPage.getByRole("button", { name: "Advanced" }).click();
  const serviceWorkerControl = popupPage.getByRole("group", {
    name: "Service Workers",
  });
  await expect(
    serviceWorkerControl.getByRole("button", { name: "Inherit" }),
  ).toHaveAttribute("aria-pressed", "true");
  await serviceWorkerControl.getByRole("button", { name: "Allow" }).click();
  await expect(
    serviceWorkerControl.getByRole("button", { name: "Allow" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(popupPage.locator("#open-full-rule-settings")).toBeVisible();

  await popupPage.locator("#apply-current-profile").click();
  await expectRuleSheetClosed(popupPage);
  await expect(popupPage.locator("#current-profile")).toContainText("Warsaw");
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "rule-active",
  );
  await expect(popupPage.locator("#current-rule")).toHaveClass(
    /gw-popup-rule-card--animated-border/,
  );
  await expect(
    popupPage.locator(".gw-popup-footer i, .gw-popup-footer svg"),
  ).toHaveCount(0);

  const languageTrigger = popupPage.locator(".gw-popup-language-trigger");
  const detailsLink = popupPage.getByRole("button", { name: "View details" });
  await expect(languageTrigger).toBeVisible();

  await languageTrigger.hover();
  const languageTooltip = popupPage.locator(".gw-popup-language-tooltip:visible");
  await expect(languageTooltip).toBeVisible();
  await expect(languageTooltip.locator(".gw-popup-language-tooltip-item")).toHaveCount(
    2,
  );

  // Stays in E2E deliberately: CSS `:hover` needs a real pointer, and
  // `userEvent.hover()` in a Storybook play function dispatches synthetic events
  // without setting `:hover`, so the halo never lights up there. Recorded as a
  // residual in config/test-layer-budget.json.
  const powerButton = popupPage.locator(".gw-popup-power-button");
  const basePowerShadow = await powerButton.evaluate(
    (button) => getComputedStyle(button).boxShadow,
  );
  await powerButton.hover();
  const hoveredPowerStyle = await powerButton.evaluate((button) => {
    button.getAnimations({ subtree: true }).forEach((animation) => animation.finish());
    return {
      baseShadow: getComputedStyle(button).boxShadow,
      haloOpacity: getComputedStyle(button, "::after").opacity,
    };
  });
  expect(hoveredPowerStyle.baseShadow).toBe(basePowerShadow);
  expect(hoveredPowerStyle.haloOpacity).toBe("1");

  await detailsLink.click();
  const xRayButton = popupPage.getByRole("button", { name: "View page activity" });
  await expect(xRayButton).toBeVisible();
  await expect(popupPage.locator("#toggle-current-rule")).toBeEnabled();
  await expect(popupPage.locator("#open-options")).toHaveAttribute(
    "aria-label",
    "Open settings",
  );
  await expect(popupPage.locator("#toggle-current-rule")).toBeEnabled();
});

test("warns about active worker policies only after the page uses their APIs", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const probeUrl = getProbeHostUrl(serverUrl);
  const hostname = new URL(probeUrl).hostname;
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const exported = await exportSettings<{
    version: 3;
    exportedAt: string;
    locations: Location[];
    rules: DomainRule[];
  }>(optionsPage);
  await importSettings(optionsPage, {
    ...exported,
    locations: EXAMPLE_LOCATIONS,
    rules: [
      {
        pattern: hostname,
        locationId: "spf-warsaw",
        enabled: true,
        fingerprintSurfaceOverrides: {
          serviceWorker: true,
          sharedWorker: "strict",
        },
      },
    ],
  });
  await optionsPage.close();

  const page = await context.newPage();
  await page.goto(probeUrl);
  const popupPage = await openPopupWithDefaults(context, extensionId, page);

  await expect(popupPage.locator("#toggle-current-rule")).toHaveAttribute(
    "aria-label",
    "Turn off this Domain Rule",
  );
  await expect(popupPage.locator("#current-rule")).not.toHaveAttribute(
    "data-protection-status",
    "needs-attention",
  );
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-compatibility-warning",
    "false",
  );
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-animation-timing",
    "steady",
  );

  await page.bringToFront();
  await page.evaluate(async () => {
    const serviceWorkerAttempt = navigator.serviceWorker
      .register("/service-worker-probe.js")
      .catch(() => undefined);
    try {
      const sharedWorker = new SharedWorker("/shared-worker-probe.js");
      sharedWorker.port.start();
    } catch {
      // Strict mode may reject the worker before native construction.
    }
    await serviceWorkerAttempt;
  });

  const targetTabId = Number(new URL(popupPage.url()).searchParams.get("tabId"));
  expect(targetTabId).toBeGreaterThan(0);
  await expect
    .poll(async () =>
      popupPage.evaluate(
        async ({ commandType, tabId }) => {
          const response = await chrome.runtime.sendMessage({
            type: commandType,
            tabId,
          });
          return response?.state?.effectiveSummary?.surfaceSummary?.attentionCount;
        },
        { commandType: EXTENSION_COMMAND_TYPES.getPopupState, tabId: targetTabId },
      ),
    )
    .toBe(2);

  await popupPage.reload();
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-protection-status",
    "needs-attention",
  );
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-compatibility-warning",
    "true",
  );
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-animation-timing",
    "boosted",
  );

  // Multiple new notifications auto-open the list without marking its items read.
  await expect(
    popupPage.getByRole("button", {
      name: /Service Workers are blocked/,
    }),
  ).toBeVisible();
  await expect(
    popupPage.getByRole("button", {
      name: /Strict Shared Worker mode is on/,
    }),
  ).toBeVisible();
  await popupPage.getByRole("button", { name: "Close Domain Rule" }).click();

  await popupPage.getByRole("button", { name: "View details" }).click();
  const protectionDetails = popupPage.getByRole("dialog");
  await expect(protectionDetails.locator(".gw-popup-protection-details")).toBeVisible();
  await expect(protectionDetails.locator(".gw-popup-notification-item")).toHaveCount(0);
  await expect(
    protectionDetails.getByRole("heading", { name: "Web Workers" }),
  ).toBeVisible();
  const workerRows = protectionDetails
    .locator(".gw-popup-protection-group")
    .filter({ hasText: "Web Workers" })
    .locator(".gw-popup-protection-surface");
  await expect(workerRows).toHaveCount(3);
  await expect(workerRows.nth(0)).toHaveAttribute("data-surface", "worker");
  await expect(workerRows.nth(1)).toHaveAttribute("data-surface", "serviceWorker");
  await expect(workerRows.nth(2)).toHaveAttribute("data-surface", "sharedWorker");
  // All three worker surfaces are protected (service-worker blocked, shared-worker
  // strict) — compatibility attention is now a separate overlay (#111) and no
  // longer forces the group to "Mixed".
  await expect(
    protectionDetails
      .locator('.gw-popup-protection-group[data-group="workers"]')
      .locator(".gw-popup-protection-group-state"),
  ).toHaveAttribute("data-group-state", "protected");
  await protectionDetails.locator("[data-compatibility-attention]").first().click();
  await expect(
    popupPage.getByRole("heading", {
      name: "Service Workers are blocked",
    }),
  ).toBeVisible();
  await expect(popupPage.getByText(/may not work while blocking is on/)).toBeVisible();
  await popupPage.getByRole("button", { name: "Back" }).click();
  await popupPage.getByRole("button", { name: "Close Domain Rule" }).click();

  await expect(
    popupPage.getByRole("button", { name: "1 unread notification" }),
  ).toBeVisible();
  await popupPage.getByRole("button", { name: "1 unread notification" }).click();
  await popupPage
    .getByRole("button", {
      name: /Strict Shared Worker mode is on/,
    })
    .click();
  await expect(
    popupPage.getByText(
      "Privacy Thing blocks any Shared Worker it cannot spoof before it starts.",
    ),
  ).toBeVisible();
  // Strict mode explains the page features at risk before offering the mode
  // changes, and keeping the current protection is an explicit action.
  await expect(
    popupPage.getByRole("heading", { name: "What this affects" }),
  ).toBeVisible();
  await expect(
    popupPage.getByText(
      /Cross-tab sync, shared connections, and live collaboration may not work/,
    ),
  ).toBeVisible();
  await expect(
    popupPage.locator("strong").filter({ hasText: /^Native$/ }),
  ).toBeVisible();
  await expect(
    popupPage.locator("strong").filter({ hasText: /^Spoof$/ }),
  ).toBeVisible();
  const nativeAction = popupPage.getByRole("button", { name: "Native", exact: true });
  const spoofAction = popupPage.getByRole("button", { name: "Spoof", exact: true });
  const keepAction = popupPage.getByRole("button", {
    name: "Keep strict mode",
    exact: true,
  });
  const sharedWorkerActions = [nativeAction, spoofAction, keepAction];
  for (const action of sharedWorkerActions) {
    await expect(action).toBeVisible();
    expect(
      await action.evaluate(
        (button) =>
          button.scrollWidth <= button.clientWidth &&
          button.scrollHeight <= button.clientHeight,
      ),
    ).toBe(true);
  }
  await spoofAction.click();

  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-compatibility-warning",
    "true",
  );
  await expect(popupPage.locator(".gw-popup-protection-counts")).toHaveAttribute(
    "data-protected-count",
    "12",
  );
  await expect(popupPage.locator("#toggle-current-rule")).toHaveAttribute(
    "aria-label",
    "Turn off this Domain Rule",
  );
});

test("keeps a read site warning active until the user dismisses it", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  test.slow();
  const probeUrl = getProbeHostUrl(serverUrl);
  const hostname = new URL(probeUrl).hostname;
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const exported = await exportSettings<{
    version: 3;
    exportedAt: string;
    locations: Location[];
    rules: DomainRule[];
  }>(optionsPage);
  await importSettings(optionsPage, {
    ...exported,
    locations: EXAMPLE_LOCATIONS,
    rules: [
      {
        pattern: hostname,
        locationId: "spf-warsaw",
        enabled: true,
        fingerprintSurfaceOverrides: { serviceWorker: true },
      },
    ],
  });

  const page = await context.newPage();
  await page.goto(probeUrl);
  await page.evaluate(() =>
    navigator.serviceWorker.register("/service-worker-probe.js").catch(() => undefined),
  );
  await page.bringToFront();
  const targetTabId = await optionsPage.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return activeTab?.id;
  });
  if (targetTabId === undefined) {
    throw new Error("Expected the probe page to have a browser tab id.");
  }
  expect(targetTabId).toBeGreaterThan(0);
  await expect
    .poll(async () =>
      optionsPage.evaluate(
        async ({ commandType, tabId }) => {
          const response = await chrome.runtime.sendMessage({
            type: commandType,
            tabId,
          });
          return response?.state?.effectiveSummary?.surfaceSummary?.attentionCount;
        },
        { commandType: EXTENSION_COMMAND_TYPES.getPopupState, tabId: targetTabId },
      ),
    )
    .toBe(1);
  await optionsPage.close();

  const popupPage = await context.newPage();
  await popupPage.goto(
    `chrome-extension://${extensionId}/src/ui/popup/index.html?tabId=${targetTabId}`,
  );
  await expect(popupPage.locator("#toggle-current-rule")).toBeVisible();
  await expect(popupPage.locator("#current-rule")).not.toHaveAttribute(
    "data-presentation",
    "loading",
  );

  // A single new notification auto-opens its detail and becomes read.
  await expect(
    popupPage.getByRole("heading", { name: "Service Workers are blocked" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      popupPage.evaluate((tabId) => chrome.action.getBadgeText({ tabId }), targetTabId),
    )
    .not.toBe("!");

  await page.reload();
  await page.evaluate(() =>
    navigator.serviceWorker.register("/service-worker-probe.js").catch(() => undefined),
  );
  await popupPage.reload();

  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-protection-status",
    "needs-attention",
  );
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-compatibility-warning",
    "true",
  );
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-animation-timing",
    "boosted",
  );
  await expect(
    popupPage.getByRole("button", { name: "1 unread notification" }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      popupPage.evaluate((tabId) => chrome.action.getBadgeText({ tabId }), targetTabId),
    )
    .not.toBe("!");

  await popupPage.getByRole("button", { name: "0 unread notifications" }).click();
  await popupPage.getByRole("button", { name: /Service Workers are blocked/ }).click();
  await popupPage.getByRole("button", { name: "Dismiss" }).click();
  await popupPage.reload();

  await expect(popupPage.locator("#current-rule")).not.toHaveAttribute(
    "data-protection-status",
    "needs-attention",
  );
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-compatibility-warning",
    "true",
  );
  await expect(popupPage.locator(".gw-popup-protection-counts")).toHaveAttribute(
    "data-protected-count",
    "12",
  );
  await popupPage.getByRole("button", { name: "View details" }).click();
  const serviceWorkerRow = popupPage
    .locator(".gw-popup-protection-surface")
    .filter({ hasText: "Service Workers" });
  const serviceWorkerState = serviceWorkerRow.locator(".gw-popup-protection-state");
  const geolocationState = popupPage
    .locator(".gw-popup-protection-surface")
    .filter({ hasText: "Geolocation" })
    .locator(".gw-popup-protection-state");
  // The protection state now shows the real status (Service Workers are blocked
  // → Protected); the compatibility affordance is a separate overlay button
  // beside it (#111).
  await expect(serviceWorkerState).toHaveAttribute("data-surface-state", "protected");
  const compatibilityAction = serviceWorkerRow.locator(
    "[data-compatibility-attention]",
  );
  await expect(compatibilityAction).toBeVisible();
  await expect(serviceWorkerRow.locator(".gw-popup-protection-state")).toHaveCount(1);
  await expect(geolocationState).toHaveAttribute("data-surface-state", "protected");

  await popupPage.getByRole("button", { name: "Close Domain Rule" }).click();
  await popupPage.locator("#open-rule-settings").click();
  await popupPage.getByRole("button", { name: "Advanced" }).click();
  const serviceWorkerControl = popupPage.getByRole("group", {
    name: "Service Workers",
  });
  await serviceWorkerControl.getByRole("button", { name: "Allow" }).click();
  await popupPage.locator("#apply-current-profile").click();
  await expectRuleSheetClosed(popupPage);

  await expect(popupPage.locator("#current-rule")).not.toHaveAttribute(
    "data-protection-status",
    "needs-attention",
  );
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-compatibility-warning",
    "false",
  );
  await expect(popupPage.locator(".gw-popup-protection-counts")).toHaveAttribute(
    "data-protected-count",
    "11",
  );
  await expect
    .poll(() =>
      popupPage.evaluate((tabId) => chrome.action.getBadgeText({ tabId }), targetTabId),
    )
    .not.toBe("!");

  await popupPage.getByRole("button", { name: "View details" }).click();
  await expect(
    popupPage
      .locator('.gw-popup-protection-surface[data-surface="serviceWorker"]')
      .locator(".gw-popup-protection-state"),
  ).toHaveAttribute("data-surface-state", "native-by-policy");
});

test("popup shows an enabled but unconfigured Default Rule", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const settings = await readSettings(optionsPage);
  await saveSimpleSettings(optionsPage, {
    themeMode: settings.themeMode,
    watchPositionDelay: settings.watchPositionDelay,
    browserFingerprintSpoofingEnabled: true,
    globalFallbackRule: {
      enabled: true,
      ruleSeedKey: "fallback-seed",
    },
  });
  await optionsPage.close();

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));

  const popupPage = await openPopupWithDefaults(context, extensionId, page);

  await expect(popupPage.locator("#current-profile")).toHaveCount(0);
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "fallback-protections",
  );
  await expect(popupPage.locator("#toggle-current-rule")).toBeEnabled();
  await popupPage.locator("#toggle-current-rule").click();
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "fallback-inactive",
  );
});

test("popup clears stale state on unsupported tabs", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const supportedPage = await context.newPage();
  await supportedPage.goto(getProbeHostUrl(serverUrl));

  await supportedPage.bringToFront();
  const popupPage = await openPopupWithDefaults(context, extensionId);
  await expect(popupPage.locator("#current-profile")).toContainText("Warsaw");

  await supportedPage.goto("chrome://extensions");
  await supportedPage.bringToFront();

  await expect(popupPage.locator("#current-profile")).toHaveCount(0);
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "unsupported",
  );
  await expect(popupPage.locator("#open-rule-settings")).toHaveCount(0);
  await expect(popupPage.locator("#toggle-current-rule")).toBeDisabled();
  await expect(popupPage.locator("#open-options")).toBeEnabled();
});

test("popup distinguishes broader rules from exact hostname matches", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  const exported = await exportSettings<{
    version: 3;
    exportedAt: string;
    locations: Location[];
    rules: DomainRule[];
  }>(optionsPage);

  await importSettings(optionsPage, {
    ...exported,
    locations: EXAMPLE_LOCATIONS,
    rules: [{ pattern: "127.0.0.*", locationId: "spf-warsaw", enabled: true }],
  });

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));

  const popupPage = await openPopupWithDefaults(context, extensionId, page);

  await expect(popupPage.locator("#current-profile")).toContainText("Warsaw");
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "rule-active",
  );
  await expect(popupPage.locator("#toggle-current-rule")).toBeEnabled();
});

test("popup can save suffix rules for the current domain", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));

  const popupPage = await openPopupWithDefaults(context, extensionId, page);
  await popupPage.locator("#open-domain-rule-settings").click();
  await selectPopupOption(popupPage, "#current-rule-mode", "Host + subdomains");
  await selectPopupOption(popupPage, "#current-profile-select", "Warsaw");
  await popupPage.locator("#apply-current-profile").click();
  await expectRuleSheetClosed(popupPage);
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "rule-active",
  );
  await expect(popupPage.locator("#toggle-current-rule")).toBeEnabled();
});

test("popup opens the workspace when editing an existing rule", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));

  const popupPage = await openPopupWithDefaults(context, extensionId, page);
  await popupPage.locator("#open-domain-rule-settings").click();
  await selectPopupOption(popupPage, "#current-rule-mode", "Exact host");
  await selectPopupOption(popupPage, "#current-profile-select", "Warsaw");
  await popupPage.locator("#apply-current-profile").click();
  await expectRuleSheetClosed(popupPage);
  await expect(popupPage.locator("#current-profile")).toContainText("Warsaw");

  await popupPage.locator("#open-rule-settings").click();
  await expect(popupPage.getByRole("dialog")).toBeVisible();
  await expect(popupPage.locator("#current-profile-select")).toContainText("Warsaw");
  await expect(popupPage.locator("#delete-current-rule")).toBeEnabled();
  const [optionsPage] = await Promise.all([
    context.waitForEvent("page"),
    popupPage.locator("#open-full-rule-settings").click(),
  ]);
  await optionsPage.waitForLoadState();
  await expect
    .poll(() => optionsPage.evaluate(() => window.location.hash))
    .toBe(`#${getRuleModalAnchor("127.0.0.1")}`);
  await expect(optionsPage.locator("#rule-dialog-form")).toBeVisible();
});

test("popup power toggles the current rule without removing it", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));

  const popupPage = await openPopupWithDefaults(context, extensionId, page);

  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "rule-active",
  );
  await popupPage.locator("#toggle-current-rule").click();
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "rule-inactive",
  );
  await popupPage.locator("#toggle-current-rule").click();
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "rule-active",
  );
});

test("popup shows the XRay button enabled", async ({ context, extensionId }) => {
  const popupPage = await openPopupWithDefaults(context, extensionId);
  await expect(popupPage.locator("#open-xray")).toBeEnabled();
});

test("reports intercepted page and Dedicated Worker activity to XRay", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.evaluate(() => {
    new Intl.DateTimeFormat().format(new Date());
    const workerUrl = URL.createObjectURL(
      new Blob(["self.close();"], {
        type: "text/javascript",
      }),
    );
    const worker = new Worker(workerUrl);
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
  });

  const popupPage = await openPopupWithDefaults(context, extensionId, page);
  const targetTabId = Number(new URL(popupPage.url()).searchParams.get("tabId"));
  expect(Number.isInteger(targetTabId)).toBe(true);

  await expect
    .poll(async () =>
      popupPage.evaluate(
        async ({ commandType, tabId }) => {
          const response = (await chrome.runtime.sendMessage({
            type: commandType,
            tabId,
          })) as {
            ok?: boolean;
            accessedCategories?: { timeLocale?: boolean; worker?: boolean };
            queryCounts?: { timeLocale?: number; worker?: number };
            methodCounts?: { "worker.constructor"?: number };
          };
          return Boolean(
            response.ok &&
            response.accessedCategories?.timeLocale &&
            response.accessedCategories?.worker &&
            (response.queryCounts?.timeLocale ?? 0) > 0 &&
            (response.queryCounts?.worker ?? 0) > 0 &&
            (response.methodCounts?.["worker.constructor"] ?? 0) > 0,
          );
        },
        {
          commandType: EXTENSION_COMMAND_TYPES.getXRayState,
          tabId: targetTabId,
        },
      ),
    )
    .toBe(true);
});

test("logs geolocation fetches when debugMode is enabled", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const settings = await readSettings(optionsPage);
  await saveSimpleSettings(optionsPage, {
    themeMode: settings.themeMode,
    debugMode: true,
    watchPositionDelay: settings.watchPositionDelay,
  });
  await optionsPage.close();

  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  const consoleMessages: string[] = [];
  page.on("console", (message) => {
    consoleMessages.push(message.text());
  });
  await page.goto(serverUrl);
  await page.waitForLoadState();

  await expect
    .poll(
      async () => {
        const result = await page.evaluate(() => {
          return new Promise<GeolocationPosition | GeolocationPositionError>(
            (resolve) => {
              navigator.geolocation.getCurrentPosition(resolve, resolve);
            },
          );
        });

        if (!("coords" in result)) return false;

        return Math.abs(result.coords.latitude - 52.229) < 0.1;
      },
      {
        message:
          "Expected geolocation runtime to be ready and spoofing Warsaw before checking logs.",
        timeout: 15_000,
      },
    )
    .toBe(true);

  await page.evaluate(async () => {
    await Promise.all(
      Array.from(
        { length: 3 },
        () =>
          new Promise((resolve) =>
            navigator.geolocation.getCurrentPosition(resolve, resolve),
          ),
      ),
    );
  });

  await expect
    .poll(
      () =>
        consoleMessages.some((message) =>
          message.includes("[Refract] Geolocation.getCurrentPosition intercepted"),
        ),
      {
        message: "Expected debug geolocation logs to appear in the page console.",
        timeout: 10_000,
      },
    )
    .toBe(true);
  await page.close();
});

test("turning Privacy Thing off removes runtime spoofing on reload", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await openSettingsTab(optionsPage, "advanced");
  await expect(optionsPage.locator("#panic-toggle")).toBeVisible();
  await optionsPage.locator("#panic-toggle").click();
  await optionsPage.close();

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.locator("#collect").click();

  const snapshot = await readSnapshot(page);

  expect(snapshot.runtimePresent).toBe(false);
  expect(snapshot.geo).toBeUndefined();
  expect(snapshot.geoError).toBeTruthy();
  expect(snapshot.permissions.geolocation).not.toBe("granted");
});

test("popup closes the sheet and updates after deleting a rule", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const page = await context.newPage();
  await page.goto(serverUrl);

  const popupPage = await openPopupWithDefaults(context, extensionId, page);
  await popupPage.locator("#open-domain-rule-settings").click();
  await selectPopupOption(popupPage, "#current-rule-mode", "Exact host");
  await selectPopupOption(popupPage, "#current-profile-select", "Warsaw");
  await popupPage.locator("#apply-current-profile").click();
  await expectRuleSheetClosed(popupPage);
  await expect(popupPage.locator("#current-profile")).toContainText("Warsaw");

  await popupPage.locator("#open-rule-settings").click();
  await expect(popupPage.locator("#current-profile-select")).toBeVisible();
  await popupPage.locator("#delete-current-rule").click();
  await expect(popupPage.locator("#confirm-sheet-action")).toBeVisible();
  await popupPage.locator("#confirm-sheet-action").click();

  await expectRuleSheetClosed(popupPage);
  await expect(popupPage.locator("#current-profile")).toHaveCount(0);
  await expect(popupPage.locator("#open-domain-rule-settings")).toHaveAttribute(
    "data-action-intent",
    "create-exact-domain-rule",
  );
  await expect(popupPage.locator("#toggle-current-rule")).toBeDisabled();
});
