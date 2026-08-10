import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { BrowserContext, Page, Worker as PwWorker } from "@playwright/test";
import { chromium } from "@playwright/test";
import { EXTENSION_STORAGE_KEYS } from "@privacy-brand/tooling-shared/extension-contract";

import { chromiumBuildDir } from "../repo-paths.js";
import type { RuntimeSnapshot, ValueProbe } from "../types.js";

import { deriveChromiumExtId } from "./snapshot-cache.js";
import {
  CHROMIUM_MARKER_PATH,
  TEST_RUNTIME_ACTIVATOR,
  TEST_RUNTIME_SNAPSHOT,
  buildTempPrefix,
  type SnapshotRuntimeActivator,
} from "./snapshot-fixtures.js";
import {
  GETTER_THIS_MAP,
  captureDescriptorsInPage,
  captureValueProbes,
} from "./snapshot-page.js";
import { warmUpExtension } from "./snapshot-readiness.js";
import type { CaptureResult } from "./snapshot-types.js";

const POLL_INTERVAL_MS = 100;
const POLL_MAX_ATTEMPTS = 50; // 5 seconds max
const READY_TIMEOUT_MS = POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS;

const getRuntimeMarkerAttr = (): string => {
  if (!existsSync(CHROMIUM_MARKER_PATH)) {
    throw new Error(
      `Runtime-applied marker not found at ${CHROMIUM_MARKER_PATH}. ` +
        `Rebuild the Chromium extension artifact first.`,
    );
  }

  let runtimeAppliedMarkerAttr: string;
  try {
    runtimeAppliedMarkerAttr = readFileSync(CHROMIUM_MARKER_PATH, "utf8").trim();
  } catch (error) {
    throw new Error(
      `Failed to read runtime-applied marker at ${CHROMIUM_MARKER_PATH}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  if (!/^[a-z][a-z0-9]{3,15}$/.test(runtimeAppliedMarkerAttr)) {
    throw new Error(`Runtime-applied marker at ${CHROMIUM_MARKER_PATH} is invalid.`);
  }

  return `data-${runtimeAppliedMarkerAttr}`;
};

async function setChromiumPreload(sw: PwWorker, storageKey: string): Promise<void> {
  await sw.evaluate(
    async ({
      runtimeActivator,
      key,
    }: {
      runtimeActivator: SnapshotRuntimeActivator;
      key: string;
    }) => {
      if (!chrome.storage.session.setAccessLevel) {
        throw new Error("Session storage access-level API is unavailable");
      }
      await chrome.storage.session.setAccessLevel({
        accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
      });
      await chrome.storage.session.set({
        [key]: runtimeActivator,
      });
    },
    {
      runtimeActivator: TEST_RUNTIME_ACTIVATOR,
      key: storageKey,
    },
  );
}

/**
 * Poll until `chrome.storage.session` contains the expected preload key.
 * Replaces a static 200ms delay after `chrome.storage.session.set()`.
 */
async function waitForSessionPreload(
  sw: PwWorker,
  storageKey: string,
  expectedActivator?: SnapshotRuntimeActivator,
): Promise<void> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    // Playwright evaluate callbacks run in the browser context, so pass
    // extension contract values through arguments instead of closing over them.
    const observed = await sw.evaluate(async (key: string) => {
      const result = await chrome.storage.session.get(key);
      return result[key] as unknown;
    }, storageKey);
    const ready = expectedActivator
      ? isDeepStrictEqual(observed, expectedActivator)
      : observed != null;
    if (ready) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  const observed = await sw.evaluate(async (key: string) => {
    const result = await chrome.storage.session.get(key);
    return result[key] as unknown;
  }, storageKey);

  throw new Error(
    expectedActivator
      ? `Expected session storage preload not available after polling. Observed: ${JSON.stringify(observed)}`
      : "Session storage preload not available after polling",
  );
}

/**
 * `chrome.storage.session.set()` resolves in the service worker first, but the
 * content bootstrap reads the preload from a renderer-side extension context.
 * Wait until an extension page can observe the exact test activator before
 * navigating the target page, otherwise CI can race into a native capture on
 * cold startup or proceed after a background sync replaced the test preload.
 */
async function waitForRendererPreload(
  context: BrowserContext,
  extensionPageUrl: string,
  storageKey: string,
  expectedActivator: SnapshotRuntimeActivator,
): Promise<void> {
  const page = await context.newPage();

  try {
    await page.goto(extensionPageUrl, { timeout: 5_000 });

    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      const observed = await page.evaluate(async (key: string) => {
        const result = await chrome.storage.session.get(key);
        return result[key] as unknown;
      }, storageKey);
      const ready = isDeepStrictEqual(observed, expectedActivator);

      if (ready) {
        return;
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  } finally {
    await page.close();
  }

  throw new Error(
    "Expected renderer session storage preload not available after polling",
  );
}

type ChromiumReadyOptions = {
  expectedLanguage: string;
  expectedLanguages: readonly string[];
  expectedTimeZone: string | undefined;
  page: Page;
  reloadOnTimeout: boolean;
  runtimeMarkerAttr: string;
};

async function waitForChromiumReady(options: ChromiumReadyOptions): Promise<void> {
  const {
    expectedLanguage,
    expectedLanguages,
    expectedTimeZone,
    page,
    reloadOnTimeout,
    runtimeMarkerAttr,
  } = options;
  const matchesReadiness = async (): Promise<boolean> =>
    page.evaluate(
      (readiness: { language: string; languages: string[]; timeZone?: string }) => {
        if (navigator.language !== readiness.language) {
          return false;
        }

        const langs = navigator.languages;
        if (langs.length !== readiness.languages.length) {
          return false;
        }

        if (
          !readiness.languages.every((language, index) => langs[index] === language)
        ) {
          return false;
        }

        if (!readiness.timeZone) {
          return true;
        }

        return (
          new Intl.DateTimeFormat().resolvedOptions().timeZone === readiness.timeZone
        );
      },
      {
        language: expectedLanguage,
        languages: [...expectedLanguages],
        ...(expectedTimeZone ? { timeZone: expectedTimeZone } : {}),
      },
    );

  const waitForMarker = async (): Promise<boolean> => {
    try {
      const markerHandle = await page.waitForFunction(
        (attributeName: string) =>
          document.documentElement?.hasAttribute(attributeName) ?? false,
        runtimeMarkerAttr,
        {
          timeout: READY_TIMEOUT_MS,
        },
      );
      await markerHandle.dispose();
      return matchesReadiness();
    } catch {
      return false;
    }
  };

  if (await waitForMarker()) {
    return;
  }

  if (reloadOnTimeout) {
    await page.reload({ waitUntil: "load" });
    if (await waitForMarker()) {
      return;
    }
  }

  const observedState = await page.evaluate(
    (attributeName: string) => ({
      markerPresent: document.documentElement?.hasAttribute(attributeName) ?? false,
      language: navigator.language,
      languages: [...navigator.languages],
      timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    runtimeMarkerAttr,
  );

  throw new Error(
    `Runtime applied marker "${runtimeMarkerAttr}" did not yield spoofed ` +
      `navigator.language="${expectedLanguage}" with languages=[${expectedLanguages.join(", ")}]` +
      `${expectedTimeZone ? ` and timeZone="${expectedTimeZone}"` : ""}. ` +
      `Observed state: ${JSON.stringify(observedState)}. ` +
      `Aborting: snapshot against un-spoofed runtime would produce misleading results.`,
  );
}

// ---------------------------------------------------------------------------
// Chromium snapshot
// ---------------------------------------------------------------------------

export async function captureChromiumVanilla(
  serverUrl: string,
  surfaces: string[],
  valueProbes: ValueProbe[],
): Promise<CaptureResult> {
  // Use channel: "chromium" to match the system-installed Chrome used by
  // captureChromiumSpoofed (which needs it for extension loading).
  // Without this, vanilla uses Playwright's bundled Chromium which is a
  // different build — API surface differences (e.g. Web Share API presence)
  // would be falsely attributed to the extension.
  const browser = await chromium.launch({ headless: true, channel: "chromium" });
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

export async function captureChromiumSpoofed(
  serverUrl: string,
  surfaces: string[],
  valueProbes: ValueProbe[],
  contextAttempt = 0,
): Promise<CaptureResult> {
  const extensionPath = chromiumBuildDir;
  if (!existsSync(extensionPath)) {
    throw new Error(
      `Chromium extension build not found at ${extensionPath}. Run 'pnpm task build:chrome' first.`,
    );
  }

  const userDataDir = await mkdtemp(path.join(os.tmpdir(), buildTempPrefix("cr")));

  try {
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    try {
      const extensionId = deriveChromiumExtId(extensionPath);
      const optionsPageUrl = `chrome-extension://${extensionId}/src/ui/options/index.html`;

      // launchPersistentContext can complete before Chromium activates an MV3
      // background worker. Open an extension-owned page to wake it explicitly
      // instead of relying on a passive startup timeout.
      let sw = context.serviceWorkers()[0];
      if (!sw) {
        const serviceWorkerPromise = context.waitForEvent("serviceworker", {
          timeout: 15_000,
        });
        const activationPage = await context.newPage();
        try {
          const [activatedWorker] = await Promise.all([
            serviceWorkerPromise,
            activationPage.goto(optionsPageUrl, { waitUntil: "load" }),
          ]);
          sw = activatedWorker;
        } finally {
          await activationPage.close().catch(() => {});
        }
      }

      // Warm up: ensure the background worker is fully initialised.
      await warmUpExtension(context, optionsPageUrl);

      // Suppress the onboarding welcome page that opens on fresh installs.
      // Without this, the welcome tab races with bootstrap transport and can
      // prevent spoofing from activating within the readiness timeout.
      await sw.evaluate(async () => {
        await chrome.storage.local.set({ onboardingCompleted: true });
      });
      for (const p of context.pages()) {
        if (p.url().includes("/welcome/")) {
          await p.close();
        }
      }

      // Preload a runtime snapshot that activates ALL spoofing paths.
      const preloadStorageKey = EXTENSION_STORAGE_KEYS.preloadedRuntimeState;
      // Wait for the background-owned initial sync before replacing its preload.
      // Otherwise the startup sync can finish after this write and restore the
      // empty default decisions, leaving every capture page unspoofed.
      await waitForSessionPreload(sw, preloadStorageKey);
      await setChromiumPreload(sw, preloadStorageKey);

      // Wait for session storage preload to propagate to the service worker.
      await waitForSessionPreload(sw, preloadStorageKey, TEST_RUNTIME_ACTIVATOR);
      await waitForRendererPreload(
        context,
        optionsPageUrl,
        preloadStorageKey,
        TEST_RUNTIME_ACTIVATOR,
      );

      const runtimeMarkerAttr = getRuntimeMarkerAttr();
      let lastPageError: unknown;

      // Chromium can occasionally miss document_start extension injection on a
      // fresh persistent context in CI. Retry with a new page before failing so
      // we do not capture an un-spoofed snapshot from a transient injection miss.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const page = await context.newPage();

        try {
          await page.goto(serverUrl, { waitUntil: "load" });
          // Wait for the injected page-world runtime to mark that patch
          // installation completed before capturing descriptors.
          await waitForChromiumReady({
            expectedLanguage: TEST_RUNTIME_SNAPSHOT.locale.language,
            expectedLanguages: TEST_RUNTIME_SNAPSHOT.locale.languages,
            expectedTimeZone: TEST_RUNTIME_SNAPSHOT.locale.timeZone,
            page,
            reloadOnTimeout: true,
            runtimeMarkerAttr,
          });

          const descriptors = (await page.evaluate(captureDescriptorsInPage, {
            surfaces,
            getterThisMap: GETTER_THIS_MAP,
          })) as RuntimeSnapshot;
          const probes = await page.evaluate(captureValueProbes, valueProbes);
          return { descriptors, probes };
        } catch (error) {
          lastPageError = error;
          await page.close().catch(() => {});

          if (attempt === 2) {
            throw error;
          }

          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      throw lastPageError;
    } finally {
      await context.close();
    }
  } catch (error) {
    if (contextAttempt === 0) {
      // A page retry cannot recover when Chromium missed document_start for the
      // entire persistent context. Relaunch with a fresh profile instead.
      return captureChromiumSpoofed(serverUrl, surfaces, valueProbes, 1);
    }

    throw error;
  } finally {
    await rm(userDataDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Firefox snapshot (required once build/firefox is present; skipped only when
// the Firefox extension build is missing)
// ---------------------------------------------------------------------------
