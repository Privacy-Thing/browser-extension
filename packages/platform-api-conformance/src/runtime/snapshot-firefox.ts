import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { BrowserContext, Page } from "@playwright/test";
import { firefox } from "@playwright/test";
import { resolveRequiredFxBinary } from "@privacy-brand/tooling-shared/firefox-binary";

import {
  buildTargetScriptPath,
  firefoxBuildDir,
  repositoryRootDirectory,
  webExtRemoteModulePath,
} from "../repo-paths.js";
import type { RuntimeSnapshot, ValueProbe } from "../types.js";

import {
  FIREFOX_SEEDED_LOCATION,
  FIREFOX_SEEDED_READINESS,
  buildTempPrefix,
} from "./snapshot-fixtures.js";
import {
  GETTER_THIS_MAP,
  captureDescriptorsInPage,
  captureValueProbes,
} from "./snapshot-page.js";
import { waitForSpoofingActive } from "./snapshot-readiness.js";
import type { CaptureResult } from "./snapshot-types.js";

type RemoteFirefox = {
  installTemporaryAddon: (
    addonPath: string,
    openDevTools?: boolean,
  ) => Promise<unknown>;
  disconnect: () => void;
};

async function findFreeTcpPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Unable to allocate free TCP port"));
        return;
      }
      server.close((err) => (err ? reject(err) : resolve(addr.port)));
    });
  });
}

function buildFxArtifact(hostname: string, outputDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [buildTargetScriptPath, "firefox", outputDir],
      {
        cwd: repositoryRootDirectory,
        stdio: "inherit",
        env: {
          ...process.env,
          PT_FIREFOX_RUNTIME_TEST_HOST: hostname,
          PT_API_CONFORMANCE_SEEDED: "1",
          PT_API_CONFORMANCE_LOCATION_ID: FIREFOX_SEEDED_LOCATION.id,
        },
      },
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`Seeded Firefox conformance build exited with code ${code ?? 1}.`),
      );
    });
  });
}

export async function captureFirefoxVanilla(
  serverUrl: string,
  surfaces: string[],
  valueProbes: ValueProbe[],
): Promise<CaptureResult> {
  const executablePath = await resolveRequiredFxBinary(
    "Firefox API conformance snapshot",
  );
  const browser = await firefox.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage();
    await page.goto(serverUrl, { waitUntil: "load" });
    const descriptors = (await page.evaluate(captureDescriptorsInPage, {
      surfaces,
      getterThisMap: GETTER_THIS_MAP,
    })) as RuntimeSnapshot;
    const probes = await page.evaluate(captureValueProbes, valueProbes);
    return { descriptors, probes };
  } finally {
    await browser.close();
  }
}

export async function captureFirefoxSpoofed(
  serverUrl: string,
  surfaces: string[],
  valueProbes: ValueProbe[],
): Promise<CaptureResult> {
  const fxBuildPath = firefoxBuildDir;
  if (!existsSync(fxBuildPath)) {
    throw new Error(
      `Firefox extension build not found at ${fxBuildPath}. Run 'pnpm task build:firefox' first.`,
    );
  }

  const webExtRemotePath = webExtRemoteModulePath;
  if (!existsSync(webExtRemotePath)) {
    throw new Error("web-ext remote module not found. Run 'pnpm install' first.");
  }

  const debuggerPort = await findFreeTcpPort();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), buildTempPrefix("ff")));
  const seededBuildDir = await mkdtemp(
    path.join(os.tmpdir(), buildTempPrefix("ff-build")),
  );
  const executablePath = await resolveRequiredFxBinary(
    "Firefox API conformance snapshot",
  );
  const hostname = new URL(serverUrl).hostname;

  try {
    await buildFxArtifact(hostname, seededBuildDir);

    const context = await firefox.launchPersistentContext(userDataDir, {
      executablePath,
      headless: true,
      args: ["-start-debugger-server", String(debuggerPort)],
      firefoxUserPrefs: {
        "xpinstall.signatures.required": false,
        "extensions.autoDisableScopes": 10,
        "devtools.debugger.remote-enabled": true,
        "devtools.debugger.prompt-connection": false,
        "extensions.enabledScopes": 5,
        "browser.startup.homepage": "about:blank",
        "startup.homepage_welcome_url": "about:blank",
        "startup.homepage_welcome_url.additional": "",
        "browser.aboutwelcome.enabled": false,
        "browser.messaging-system.rpl.enabled": false,
        "browser.newtabpage.enabled": false,
        "browser.onboarding.enabled": false,
        "browser.shell.checkDefaultBrowser": false,
        "browser.startup.firstrunok": true,
        "browser.tabs.warnOnClose": false,
      },
    });

    try {
      // Install extension via web-ext remote protocol.
      const { connectWithMaxRetries } = (await import(
        pathToFileURL(webExtRemotePath).href
      )) as {
        connectWithMaxRetries: (opts: {
          maxRetries?: number;
          retryInterval?: number;
          port: number;
        }) => Promise<RemoteFirefox>;
      };

      const remote = await connectWithMaxRetries({
        port: debuggerPort,
        maxRetries: 250,
        retryInterval: 120,
      });
      try {
        await remote.installTemporaryAddon(seededBuildDir, false);
      } finally {
        remote.disconnect();
      }

      // Wait for extension to initialise by polling a test page for spoofing
      // readiness, rather than using a static delay.
      await waitForFirefoxReady({
        context,
        expectedLanguage: FIREFOX_SEEDED_READINESS.language,
        expectedLanguages: FIREFOX_SEEDED_READINESS.languages,
        expectedTimeZone: FIREFOX_SEEDED_READINESS.timeZone,
        serverUrl,
      });

      const page = await prepareFirefoxHostPage(context);
      await page.goto(serverUrl, { waitUntil: "load" });
      // Wait for content-script injection to complete (spoofing active).
      await waitForSpoofingActive({
        expectedLanguage: FIREFOX_SEEDED_READINESS.language,
        expectedLanguages: FIREFOX_SEEDED_READINESS.languages,
        expectedTimeZone: FIREFOX_SEEDED_READINESS.timeZone,
        page,
        reloadOnTimeout: true,
      });

      const descriptors = (await page.evaluate(captureDescriptorsInPage, {
        surfaces,
        getterThisMap: GETTER_THIS_MAP,
      })) as RuntimeSnapshot;
      const probes = await page.evaluate(captureValueProbes, valueProbes);
      return { descriptors, probes };
    } finally {
      await context.close();
    }
  } finally {
    await rm(seededBuildDir, { recursive: true, force: true });
    await rm(userDataDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Warmup helpers
// ---------------------------------------------------------------------------

async function prepareFirefoxHostPage(context: BrowserContext): Promise<Page> {
  for (const page of [...context.pages()]) {
    const url = page.url();
    if (
      url === "about:home" ||
      url === "about:newtab" ||
      url.startsWith("about:welcome")
    ) {
      await page.close();
    }
  }

  const blankPage = context.pages().find((page) => page.url() === "about:blank");
  if (blankPage) {
    return blankPage;
  }

  const existingPage = context.pages()[0];
  if (existingPage) {
    try {
      await existingPage.goto("about:blank", { waitUntil: "load", timeout: 5000 });
      return existingPage;
    } catch {
      // Fall through to a new page if the pre-opened tab is not reusable.
    }
  }

  return context.newPage();
}

/**
 * Poll a test page to confirm the Firefox extension has initialised and
 * content-script injection is working. Replaces a static 1500ms delay.
 *
 * Uses the same multi-signal readiness check as {@link waitForSpoofingActive}
 * (language + full languages array) to avoid false positives on hosts where
 * the test locale is natively installed.
 *
 * Throws on timeout — a silent fallthrough would let the subsequent snapshot
 * capture run against an un-spoofed runtime, hiding regressions.
 */
type FirefoxReadyOptions = {
  context: BrowserContext;
  expectedLanguage: string;
  expectedLanguages: readonly string[];
  expectedTimeZone: string | undefined;
  serverUrl: string;
};

async function waitForFirefoxReady(options: FirefoxReadyOptions): Promise<void> {
  const { context, expectedLanguage, expectedLanguages, expectedTimeZone, serverUrl } =
    options;
  for (let attempt = 0; attempt < 15; attempt++) {
    const page = await prepareFirefoxHostPage(context);
    try {
      await page.goto(serverUrl, { waitUntil: "load", timeout: 5000 });
      // Multi-signal check: both language and full languages array must match.
      const spoofed = await page.evaluate(
        (expected: { language: string; languages: string[]; timeZone?: string }) => {
          if (navigator.language !== expected.language) return false;
          const langs = navigator.languages;
          if (langs.length !== expected.languages.length) return false;
          if (!expected.languages.every((l, idx) => langs[idx] === l)) return false;
          if (!expected.timeZone) return true;
          return (
            new Intl.DateTimeFormat().resolvedOptions().timeZone === expected.timeZone
          );
        },
        {
          language: expectedLanguage,
          languages: [...expectedLanguages],
          ...(expectedTimeZone ? { timeZone: expectedTimeZone } : {}),
        },
      );
      if (spoofed) return;
    } catch {
      // Keep and reuse the existing page instead of repeatedly opening new tabs
      // in a persistent Firefox context after temporary addon installation.
    }
    // Backoff between attempts.
    try {
      await page.goto("about:blank", { waitUntil: "load", timeout: 5000 });
    } catch {
      if (!page.isClosed()) {
        await page.close().catch(() => {});
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(
    `Firefox extension spoofing not detected after 15 attempts. ` +
      `Expected navigator.language="${expectedLanguage}" with ` +
      `languages=[${expectedLanguages.join(", ")}]` +
      `${expectedTimeZone ? ` and timeZone="${expectedTimeZone}"` : ""}. ` +
      `Aborting: snapshot against un-spoofed runtime would produce misleading results.`,
  );
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
