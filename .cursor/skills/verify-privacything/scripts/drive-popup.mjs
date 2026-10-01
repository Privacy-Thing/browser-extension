#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { resolveChromeExecutable } from "./resolve-chrome.mjs";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(skillRoot, "../../..");
const chromeRoot = path.resolve(repoRoot, "build", "chrome");
const artifactsRoot = path.join(
  repoRoot,
  "build",
  "verify-privacything",
  "popup-protection",
);
const headed = process.env.PT_VERIFY_HEADED === "1";

const deriveChromiumExtId = (extensionPath) => {
  const idBytes = createHash("sha256").update(extensionPath).digest().subarray(0, 16);
  return Array.from(
    idBytes,
    (byte) =>
      `${String.fromCharCode(97 + (byte >> 4))}${String.fromCharCode(97 + (byte & 0x0f))}`,
  ).join("");
};

const startProbe = async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      "<!doctype html><title>verify-privacything host</title><h1>Privacy Thing verify host</h1>",
    );
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Probe server did not bind a TCP port.");
  }
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
};

const sendExtensionCommand = async (page, payload) =>
  page.evaluate(async (message) => chrome.runtime.sendMessage(message), payload);

const selectOption = async (page, triggerSelector, optionLabel) => {
  const trigger = page.locator(triggerSelector);
  await trigger.click();
  const option = page.getByRole("option", { name: optionLabel, exact: true });
  await option.waitFor({ state: "visible" });
  await option.click();
  await trigger.filter({ hasText: optionLabel }).waitFor();
};

const closeWelcomePages = async (context) => {
  for (const page of context.pages()) {
    const url = page.url();
    if (url.includes("/welcome/") || url.includes("onboarding=1")) {
      await page.close();
    }
  }
};

const writeArtifacts = async (files) => {
  await mkdir(artifactsRoot, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
      await writeFile(path.join(artifactsRoot, name), body);
    } else {
      await writeFile(path.join(artifactsRoot, name), body, "utf8");
    }
  }
};

const extensionId = deriveChromiumExtId(chromeRoot);
const manifest = JSON.parse(
  readFileSync(path.join(chromeRoot, "manifest.json"), "utf8"),
);
const versionName = manifest.version_name ?? manifest.version ?? "(unknown)";
const userDataDir = await mkdtemp(path.join(os.tmpdir(), "pt-verify-"));
const probe = await startProbe();
let context;
await mkdir(artifactsRoot, { recursive: true });

try {
  context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: resolveChromeExecutable(),
    headless: !headed,
    args: [
      `--disable-extensions-except=${chromeRoot}`,
      `--load-extension=${chromeRoot}`,
    ],
  });

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const onboard = await sendExtensionCommand(optionsPage, {
    type: "pt:save-simple-settings",
    onboardingCompleted: true,
  });
  if (onboard && onboard.ok === false) {
    throw new Error(onboard.error ?? "onboarding save failed");
  }
  const seeded = await sendExtensionCommand(optionsPage, {
    type: "pt:load-sample-data",
  });
  if (seeded && seeded.ok === false) {
    throw new Error(seeded.error ?? "load-sample-data failed");
  }
  await closeWelcomePages(context);

  const sitePage = await context.newPage();
  await sitePage.goto(probe.url, { waitUntil: "load" });

  const popupPage = await context.newPage();
  const popupUrl = new URL(`chrome-extension://${extensionId}/src/ui/popup/index.html`);
  await popupPage.goto(popupUrl.toString());
  const targetTabId = await popupPage.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    return tabs
      .filter((tab) => tab.url === url && typeof tab.id === "number")
      .sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))[0]
      ?.id;
  }, sitePage.url());
  if (targetTabId === undefined) {
    throw new Error("Could not resolve the probe tab id for the popup.");
  }
  popupUrl.searchParams.set("tabId", String(targetTabId));
  await popupPage.goto(popupUrl.toString());
  await popupPage.locator("#toggle-current-rule").waitFor({ state: "visible" });
  await popupPage.waitForFunction(() => {
    const presentation = document
      .querySelector("#current-rule")
      ?.getAttribute("data-presentation");
    return Boolean(presentation) && presentation !== "loading";
  });

  const beforePresentation = await popupPage
    .locator("#current-rule")
    .getAttribute("data-presentation");
  await popupPage.screenshot({ path: path.join(artifactsRoot, "before.png") });

  await popupPage.locator("#open-domain-rule-settings").click();
  await popupPage.getByRole("dialog").waitFor({ state: "visible" });
  await selectOption(popupPage, "#current-rule-mode", "Exact host");
  await selectOption(popupPage, "#current-profile-select", "Warsaw");
  await popupPage.locator("#apply-current-profile").click();
  await popupPage.locator("#current-profile").waitFor({ state: "visible" });
  const profileText = (await popupPage.locator("#current-profile").innerText()).trim();
  if (!profileText.includes("Warsaw")) {
    throw new Error(
      `Expected Warsaw on #current-profile, found ${JSON.stringify(profileText)}`,
    );
  }
  const afterPresentation = await popupPage
    .locator("#current-rule")
    .getAttribute("data-presentation");
  if (afterPresentation !== "rule-active") {
    throw new Error(
      `Expected data-presentation=rule-active, found ${JSON.stringify(afterPresentation)}`,
    );
  }

  await mkdir(artifactsRoot, { recursive: true });
  await popupPage.screenshot({ path: path.join(artifactsRoot, "after.png") });
  const aria = await popupPage.locator("body").ariaSnapshot();
  const settings = await sendExtensionCommand(optionsPage, { type: "pt:get-settings" });
  if (!settings?.ok) {
    throw new Error(settings?.error ?? "pt:get-settings failed");
  }
  const probeHost = new URL(probe.url).hostname;
  const matchingRule = (settings.rules ?? []).find((rule) => {
    const pattern = String(rule.pattern ?? "");
    return pattern === probeHost || pattern.includes(probeHost);
  });

  const meta = {
    feature: "popup-protection",
    extensionId,
    versionName,
    probeUrl: probe.url,
    targetTabId,
    beforePresentation,
    afterPresentation,
    profileText,
    matchingRule: matchingRule
      ? {
          pattern: matchingRule.pattern,
          locationId: matchingRule.locationId,
        }
      : null,
    artifacts: ["before.png", "after.png", "after.aria.yml", "meta.json"],
  };

  await writeArtifacts({
    "after.aria.yml": aria,
    "meta.json": `${JSON.stringify(meta, null, 2)}\n`,
  });

  if (!matchingRule) {
    throw new Error(`No persisted rule matched probe host ${probeHost}.`);
  }

  console.log("[verify-privacything drive-popup] ok");
  console.log(`artifacts: ${artifactsRoot}`);
  console.log(`extension_id: ${extensionId}`);
  console.log(`probe: ${probe.url}`);
  console.log(`rule: ${matchingRule.pattern} -> ${matchingRule.locationId}`);
} finally {
  if (context) {
    await context.close().catch(() => undefined);
  }
  await probe.close().catch(() => undefined);
  await rm(userDataDir, { recursive: true, force: true });
}
