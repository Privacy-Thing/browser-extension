import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test as base } from "@playwright/test";
import type { BrowserContext, Frame, Page } from "@playwright/test";
import { resolveRequiredFxBinary } from "@privacy-brand/tooling-shared/firefox-binary";

import { BRAND_DISPLAY_NAME } from "../../src/shared/brand";
import {
  EXTENSION_COMMAND_TYPES,
  FXT_BRIDGE_EVENTS,
} from "../../src/shared/extension-contract";
import type {
  AssignLocationResponse,
  CleanupDomainResponse,
  ClearLogsResponse,
  DomainRule,
  ExtensionLogEntry,
  GetSettingsResponse,
  GetLogsResponse,
  SaveLocationResponse,
  SaveSettingsResponse,
} from "../../src/shared/types";

import {
  FX_TEST_LOCAL_KEY,
  FX_TEST_SESSION_KEY,
  TEST_COOKIE_FRAGMENT,
  TEST_PRESENT_VALUE,
} from "./harness/probe-state";

const FIREFOX_HEADLESS = process.env.FIREFOX_HEADLESS !== "0";
const DIST_FIREFOX_DIR = path.resolve(process.cwd(), "build", "firefox");
const FIREFOX_MANIFEST_PATH = path.join(DIST_FIREFOX_DIR, "manifest.json");
const WEB_EXT_MODULE_PATH = path.resolve(
  process.cwd(),
  "node_modules",
  "web-ext",
  "lib",
  "firefox",
  "remote.js",
);
const TIME_LOCALE_RACE_SCRIPT = readFileSync(
  new URL("./probes/time-locale-race.js", import.meta.url),
  "utf8",
);
const FIRST_CALL_RACE_SCRIPT = readFileSync(
  new URL("./probes/firefox-first-call-race.js", import.meta.url),
  "utf8",
);
const HOST_PROBE_SCRIPT = readFileSync(
  new URL("./probes/firefox-host.js", import.meta.url),
  "utf8",
);
const DATE_INTL_PARITY_SCRIPT = readFileSync(
  new URL("./probes/firefox-date-intl-consistency.js", import.meta.url),
  "utf8",
);
const COOKIE_RACE_PROBE_SCRIPT = readFileSync(
  new URL("./probes/firefox-cookie-race.js", import.meta.url),
  "utf8",
);
const FIRST_CALL_RACE_PAGE = readFileSync(
  new URL("./probes/firefox-first-call-race.html", import.meta.url),
  "utf8",
);
const TIME_LOCALE_RACE_PAGE = readFileSync(
  new URL("./probes/firefox-time-locale-race.html", import.meta.url),
  "utf8",
);
const DATE_INTL_PARITY_PAGE = readFileSync(
  new URL("./probes/firefox-date-intl-consistency.html", import.meta.url),
  "utf8",
);
const COOKIE_RACE_PAGE = readFileSync(
  new URL("./probes/firefox-cookie-race.html", import.meta.url),
  "utf8",
);
const WORKER_SCOPE_RACE_PAGE = readFileSync(
  new URL("./probes/firefox-worker-scope-race.html", import.meta.url),
  "utf8",
);
const WORKER_SCOPE_RACE_SCRIPT = readFileSync(
  new URL("./probes/firefox-worker-scope-race.js", import.meta.url),
  "utf8",
);
const WORKER_DEDICATED_SCRIPT = readFileSync(
  new URL("./probes/firefox-worker-scope-race-dedicated.js", import.meta.url),
  "utf8",
);
const WORKER_SHARED_SCRIPT = readFileSync(
  new URL("./probes/firefox-worker-scope-race-shared.js", import.meta.url),
  "utf8",
);
const WORKER_SERVICE_SCRIPT = readFileSync(
  new URL("./probes/firefox-worker-scope-race-service.js", import.meta.url),
  "utf8",
);
const MAIN_WORLD_TIMING_PAGE = readFileSync(
  new URL("./probes/firefox-main-world-timing.html", import.meta.url),
  "utf8",
);
const HOST_PAGE = readFileSync(
  new URL("./probes/firefox-host.html", import.meta.url),
  "utf8",
);

type FirefoxExtensionFixtures = {
  context: BrowserContext;
  debuggerPort: number;
  extensionOrigin: string;
  firefoxExecutablePath: string;
  serverUrl: string;
  userDataDir: string;
};

type FxContextSession = {
  getContext: () => Promise<BrowserContext>;
  restartContext: () => Promise<BrowserContext>;
};

type FxExtWorkerFixtures = {
  persistentContextSession: FxContextSession;
};

type RemoteFirefoxTab = {
  actor: string;
  selected?: boolean;
  title?: string;
  url?: string;
};

type RemoteFxListTabsResult = {
  tabs: RemoteFirefoxTab[];
};

type RemoteFxTargetResult = {
  frame: {
    consoleActor: string;
  };
};

type RemoteFxConsoleResult = {
  from?: string;
  resultID?: string;
};

type RemoteFirefoxClient = {
  request(packet: "listTabs"): Promise<RemoteFxListTabsResult>;
  request(packet: { to: string; type: "getTarget" }): Promise<RemoteFxTargetResult>;
  request(packet: {
    text: string;
    to: string;
    type: "evaluateJSAsync";
  }): Promise<RemoteFxConsoleResult>;
  on(event: "error", listener: (error: Error) => void): void;
  off?(event: "error", listener: (error: Error) => void): void;
};

type RemoteFirefox = {
  client: RemoteFirefoxClient;
  installTemporaryAddon: (
    addonPath: string,
    openDevTools?: boolean,
  ) => Promise<{ addon?: { id?: string } }>;
  disconnect: () => void;
};

type FirefoxManifest = {
  browser_specific_settings?: {
    gecko?: {
      id?: string;
    };
  };
};

type LiveFxCreepState = {
  href: string;
  language: string;
  languages: string[];
  timeZone: string;
  resolvedLocale: string;
  formattedDate: string;
  formattedParts: Intl.DateTimeFormatPart[];
  timezoneOffset: number;
  nowString: string;
  runtimeLocale: {
    language: string;
    languages: readonly string[];
    timeZone: string;
    acceptLanguage: string;
  } | null;
  bodySnippet: string;
};

type FxSettingsBridgeError = {
  ok: false;
  error: string;
};

type FxCookieProbeResult =
  | {
      ok: true;
    }
  | FxSettingsBridgeError;

let firefoxAddonIdPromise: Promise<string> | null = null;

const readFirefoxAddonId = async (): Promise<string> => {
  firefoxAddonIdPromise ??= (async () => {
    const manifest = JSON.parse(
      await readFile(FIREFOX_MANIFEST_PATH, "utf8"),
    ) as FirefoxManifest;
    const addonId = manifest.browser_specific_settings?.gecko?.id;

    if (!addonId) {
      throw new Error(
        `Missing browser_specific_settings.gecko.id in ${FIREFOX_MANIFEST_PATH}.`,
      );
    }

    return addonId;
  })();

  return firefoxAddonIdPromise;
};

const readExtOriginFromPrefs = async (
  userDataDir: string,
  addonId: string,
): Promise<string | null> => {
  const prefsPath = path.join(userDataDir, "prefs.js");

  try {
    const prefsContents = await readFile(prefsPath, "utf8");
    const uuidLine = prefsContents
      .split("\n")
      .find((line) => line.includes('user_pref("extensions.webextensions.uuids"'));
    if (!uuidLine) {
      return null;
    }

    const prefix = 'user_pref("extensions.webextensions.uuids", "';
    const prefixIndex = uuidLine.indexOf(prefix);
    if (prefixIndex === -1) {
      return null;
    }

    const start = prefixIndex + prefix.length;
    const end = uuidLine.lastIndexOf('");');
    if (end === -1 || end <= start) {
      return null;
    }

    const rawValue = uuidLine.slice(start, end);
    const decoded = rawValue.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    const uuids = JSON.parse(decoded) as Record<string, string>;
    const uuid = uuids[addonId];

    return uuid ? `moz-extension://${uuid}` : null;
  } catch {
    return null;
  }
};

const waitForFxExtOrigin = async (userDataDir: string): Promise<string> => {
  const addonId = await readFirefoxAddonId();
  let extensionOrigin: string | null = null;

  await expect
    .poll(
      async () => {
        extensionOrigin = await readExtOriginFromPrefs(userDataDir, addonId);
        return extensionOrigin;
      },
      {
        timeout: 15_000,
        intervals: [100, 250, 500],
      },
    )
    .not.toBeNull();

  return extensionOrigin!;
};

const findFreeTcpPort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createNetServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to allocate a free TCP port"));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });

const loadWebExtRemoteApi = async (): Promise<{
  connectWithMaxRetries: (options: {
    maxRetries?: number;
    retryInterval?: number;
    port: number;
  }) => Promise<RemoteFirefox>;
}> =>
  import(pathToFileURL(WEB_EXT_MODULE_PATH).href) as Promise<{
    connectWithMaxRetries: (options: {
      maxRetries?: number;
      retryInterval?: number;
      port: number;
    }) => Promise<RemoteFirefox>;
  }>;

const connectRemoteFirefox = async (debuggerPort: number): Promise<RemoteFirefox> => {
  const { connectWithMaxRetries } = await loadWebExtRemoteApi();
  return connectWithMaxRetries({
    port: debuggerPort,
    maxRetries: 250,
    retryInterval: 120,
  });
};

const installTemporaryAddon = async (debuggerPort: number): Promise<void> => {
  const remoteFirefox = await connectRemoteFirefox(debuggerPort);

  try {
    await remoteFirefox.installTemporaryAddon(DIST_FIREFOX_DIR, false);
  } finally {
    remoteFirefox.disconnect();
  }
};

const renderFirstCallScript = (): string => FIRST_CALL_RACE_SCRIPT;

const renderTimeLocaleScript = (): string => TIME_LOCALE_RACE_SCRIPT;

const renderCookieRaceScript = (): string => COOKIE_RACE_PROBE_SCRIPT;

const renderHostProbeScript = (): string => HOST_PROBE_SCRIPT;

const renderMethodPostPage = (requestMethod: string): string =>
  requestMethod.toUpperCase() === "POST"
    ? `<!doctype html>
<html>
  <head>
    <script>
      globalThis.__firefoxPostMethodSnapshot = {
        requestMethod: ${JSON.stringify(requestMethod.toUpperCase())},
        initialHash: location.hash
      };
    </script>
  </head>
  <body>
    <pre id="snapshot">posted</pre>
  </body>
</html>`
    : `<!doctype html>
<html>
  <body>
    <form id="post-form" method="post" action="/method-preserving-post#posted">
      <input name="token" value="seed-check" />
      <button type="submit">Submit POST</button>
    </form>
  </body>
</html>`;

const renderFirstCallRacePage = (): string => FIRST_CALL_RACE_PAGE;

const renderTimeLocaleRacePage = (): string => TIME_LOCALE_RACE_PAGE;

const renderCookieRacePage = (): string => COOKIE_RACE_PAGE;

const renderDateIntlScript = (): string => DATE_INTL_PARITY_SCRIPT;

const renderDateIntlPage = (): string => DATE_INTL_PARITY_PAGE;

const renderWorkerRacePage = (): string => WORKER_SCOPE_RACE_PAGE;

const renderWorkerRaceScript = (): string => WORKER_SCOPE_RACE_SCRIPT;

const renderWorkerDedicated = (): string => WORKER_DEDICATED_SCRIPT;

const renderWorkerShared = (): string => WORKER_SHARED_SCRIPT;

const renderWorkerService = (): string => WORKER_SERVICE_SCRIPT;

const renderMainTimingPage = (): string => MAIN_WORLD_TIMING_PAGE;

const renderHostPage = (): string => HOST_PAGE;

const renderAcceptLangPage = (acceptLanguage: string): string => `<!doctype html>
<html>
  <body>
    <pre id="accept-language">${acceptLanguage}</pre>
  </body>
</html>`;

const routeFxRuntimeReq = (
  requestUrl: string | undefined,
  requestMethod: string | undefined,
  requestAcceptLanguage: string | string[] | undefined,
  response: Parameters<Parameters<typeof createServer>[0]>[1],
): boolean => {
  const requestPath = requestUrl
    ? new URL(requestUrl, "http://127.0.0.1").pathname
    : undefined;
  const acceptLanguage = Array.isArray(requestAcceptLanguage)
    ? requestAcceptLanguage.join(",")
    : (requestAcceptLanguage ?? "");

  if (requestPath === "/first-call-race.js") {
    response.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
    });
    response.end(renderFirstCallScript());
    return true;
  }

  if (requestPath === "/time-locale-race.js") {
    response.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
    });
    response.end(renderTimeLocaleScript());
    return true;
  }

  if (requestPath === "/cookie-race.js") {
    response.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
    });
    response.end(renderCookieRaceScript());
    return true;
  }

  if (requestPath === "/page.js") {
    response.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
    });
    response.end(renderHostProbeScript());
    return true;
  }

  if (requestPath === "/worker-scope-race.js") {
    response.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
    });
    response.end(renderWorkerRaceScript());
    return true;
  }

  if (requestPath === "/worker-scope-race-dedicated.js") {
    response.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
    });
    response.end(renderWorkerDedicated());
    return true;
  }

  if (requestPath === "/worker-scope-race-shared.js") {
    response.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
    });
    response.end(renderWorkerShared());
    return true;
  }

  if (requestPath === "/worker-scope-race-service.js") {
    response.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
    });
    response.end(renderWorkerService());
    return true;
  }

  if (requestPath === "/first-call-race") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderFirstCallRacePage());
    return true;
  }

  if (requestPath === "/time-locale-race") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderTimeLocaleRacePage());
    return true;
  }

  if (requestPath === "/cookie-race") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderCookieRacePage());
    return true;
  }

  if (requestPath === "/worker-scope-race") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderWorkerRacePage());
    return true;
  }

  if (requestPath === "/date-intl-consistency.js") {
    response.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
    });
    response.end(renderDateIntlScript());
    return true;
  }

  if (requestPath === "/date-intl-consistency") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderDateIntlPage());
    return true;
  }

  if (requestPath === "/main-world-timing") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderMainTimingPage());
    return true;
  }

  if (requestPath === "/method-preserving-post") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderMethodPostPage(requestMethod ?? "GET"));
    return true;
  }

  if (requestPath === "/echo-accept-language") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderAcceptLangPage(acceptLanguage));
    return true;
  }

  return false;
};

const test = base.extend<FirefoxExtensionFixtures & FxExtWorkerFixtures>({
  serverUrl: [
    async ({ browserName: _browserName }, use) => {
      const server = createServer((request, response) => {
        if (
          routeFxRuntimeReq(
            request.url,
            request.method,
            request.headers["accept-language"],
            response,
          )
        ) {
          return;
        }

        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(renderHostPage());
      });

      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Unable to resolve Firefox runtime test server address.");
      }

      await use(`http://127.0.0.1:${address.port}`);
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
    { scope: "worker" },
  ],
  userDataDir: [
    async ({ browserName: _browserName }, use) => {
      const userDataDir = await mkdtemp(path.join(os.tmpdir(), "pt-ff-e2e-"));
      try {
        await use(userDataDir);
      } finally {
        await rm(userDataDir, { recursive: true, force: true });
      }
    },
    { scope: "worker" },
  ],
  firefoxExecutablePath: [
    async ({ browserName: _browserName }, use) => {
      await use(await resolveRequiredFxBinary("Firefox runtime Playwright suite"));
    },
    { scope: "worker" },
  ],
  debuggerPort: [
    async ({ browserName: _browserName }, use) => {
      await use(await findFreeTcpPort());
    },
    { scope: "worker" },
  ],
  persistentContextSession: [
    async ({ playwright, userDataDir, firefoxExecutablePath, debuggerPort }, use) => {
      let activeContext: BrowserContext | null = null;
      let launchPromise: Promise<BrowserContext> | null = null;

      const launchContext = async (): Promise<BrowserContext> => {
        const context = await playwright.firefox.launchPersistentContext(userDataDir, {
          executablePath: firefoxExecutablePath,
          headless: FIREFOX_HEADLESS,
          args: ["-start-debugger-server", String(debuggerPort)],
          firefoxUserPrefs: {
            "browser.dom.window.dump.enabled": true,
            "datareporting.policy.dataSubmissionEnabled": false,
            "devtools.debugger.remote-enabled": true,
            "devtools.debugger.prompt-connection": false,
            "devtools.browserconsole.contentMessages": true,
            "extensions.logging.enabled": false,
            "extensions.checkCompatibility.nightly": false,
            "extensions.update.enabled": false,
            "extensions.update.notifyUser": false,
            "extensions.enabledScopes": 5,
            "extensions.getAddons.cache.enabled": false,
            "extensions.installDistroAddons": false,
            "extensions.autoDisableScopes": 10,
            "app.update.enabled": false,
            "xpinstall.signatures.required": false,
            "browser.startup.homepage": "about:blank",
            "startup.homepage_welcome_url": "about:blank",
            "startup.homepage_welcome_url.additional": "",
            "devtools.errorconsole.enabled": true,
            "devtools.chrome.enabled": true,
            "urlclassifier.updateinterval": 172800,
            "browser.safebrowsing.provider.0.gethashURL":
              "http://localhost/safebrowsing-dummy/gethash",
            "browser.safebrowsing.provider.0.keyURL":
              "http://localhost/safebrowsing-dummy/newkey",
            "browser.safebrowsing.provider.0.updateURL":
              "http://localhost/safebrowsing-dummy/update",
            "browser.selfsupport.url": "https://localhost/selfrepair",
            "browser.reader.detectedFirstArticle": true,
            "datareporting.policy.firstRunURL": "",
            "extensions.langpacks.signatures.required": false,
            "extensions.install.requireBuiltInCerts": false,
            "intl.accept_languages": "en-US",
            "intl.locale.requested": "en-US",
            "browser.aboutwelcome.enabled": false,
            "browser.messaging-system.rpl.enabled": false,
            "browser.newtabpage.enabled": false,
            "browser.onboarding.enabled": false,
            "browser.shell.checkDefaultBrowser": false,
            "browser.startup.firstrunok": true,
            "browser.tabs.warnOnClose": false,
            "datareporting.healthreport.uploadEnabled": false,
            "trailhead.firstrun.branches": "nofirstrun-empty",
            "browser.startup.page": 0,
            "browser.usedOnboarding": true,
            "datareporting.policy.dataSubmissionPolicyAccepted": true,
            "browser.startup.homepage_override.mstone": "ignore",
            "browser.rights.3.shown": true,
            "toolkit.telemetry.enabled": false,
            "toolkit.telemetry.unified": false,
            "app.shield.optoutstudies.enabled": false,
            "browser.search.update": false,
            "extensions.manifestV3.enabled": true,
            "extensions.userScripts.enabled": true,
            "extensions.webapi.testing": true,
            "extensions.webapi.testing.non_user_events_allowed": true,
            // Firefox runtime optional-permission prompts are browser-chrome UI. In
            // headless temporary-addon tests we still require a real popup click,
            // but the prompt itself must auto-approve so the harness can observe the
            // actual extension flow without an unobservable doorhanger.
            "extensions.webextOptionalPermissionPrompts": false,
            "devtools.selfxss.count": 100,
          },
        });

        context.on("close", () => {
          if (activeContext === context) {
            activeContext = null;
          }
        });

        await installTemporaryAddon(debuggerPort);
        // Installing the temporary add-on triggers chrome.runtime.onInstalled with
        // reason "install", which auto-opens an onboarding tab
        // (src/ui/options/index.html?onboarding=1). Close it so it doesn't throw off
        // Firefox's tab-count expectations on subsequent context.newPage() calls.
        await expect
          .poll(
            () => context.pages().some((page) => page.url().includes("onboarding=1")),
            {
              timeout: 10_000,
            },
          )
          .toBe(true)
          .catch(() => undefined);
        for (const page of context.pages()) {
          if (page.url().includes("onboarding=1")) {
            await page.close().catch(() => undefined);
          }
        }
        activeContext = context;
        return context;
      };

      const session: FxContextSession = {
        getContext: async () => {
          if (activeContext) {
            return activeContext;
          }

          if (!launchPromise) {
            launchPromise = launchContext().finally(() => {
              launchPromise = null;
            });
          }

          return launchPromise;
        },
        restartContext: async () => {
          await activeContext?.close().catch(() => undefined);
          activeContext = null;
          return launchContext();
        },
      };

      try {
        await use(session);
      } finally {
        await activeContext?.close().catch(() => undefined);
      }
    },
    { scope: "worker" },
  ],
  context: async ({ persistentContextSession }, use) => {
    await use(await persistentContextSession.getContext());
  },
  extensionOrigin: [
    async ({ persistentContextSession, userDataDir }, use) => {
      await persistentContextSession.getContext();
      await use(await waitForFxExtOrigin(userDataDir));
    },
    { scope: "worker" },
  ],
});

test.setTimeout(120_000);

const isRecoverableFxPageError = (error: unknown): error is Error =>
  error instanceof Error &&
  error.message.includes(
    'Protocol error (Browser.newPage): can\'t access property "delayedStartupPromise", window is null',
  );

const newFirefoxPage = async (context: BrowserContext): Promise<Page> => {
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await context.newPage();
    } catch (error) {
      if (!isRecoverableFxPageError(error) || attempt === maxAttempts - 1) {
        throw error;
      }

      await expect
        .poll(() => context.pages().some((page) => !page.isClosed()), {
          message: "Firefox browser window remains observable after delayed startup",
          timeout: 2_000,
        })
        .toBe(true);
    }
  }

  throw new Error("Firefox newPage retry exhausted without returning a page.");
};

test.afterEach(async ({ persistentContextSession }) => {
  // Always fetch the current active context — a test may have called restartContext(),
  // closing the context captured by the `context` fixture before afterEach runs.
  const context = await persistentContextSession.getContext();

  await context.clearPermissions();
  await context.clearCookies();

  const pages = [...context.pages()];
  let survivor = pages.find((page) => page.url() === "about:blank") ?? pages[0] ?? null;

  for (const page of pages) {
    if (page === survivor) {
      continue;
    }

    await page.close().catch(() => undefined);
  }

  if (survivor === null) {
    survivor = await newFirefoxPage(context);
  }

  if (survivor.url() !== "about:blank") {
    await survivor
      .goto("about:blank", { waitUntil: "domcontentloaded" })
      .catch(() => undefined);
  }
});

test.beforeEach(async ({ context, extensionOrigin, debuggerPort }) => {
  const bridgeMarker = Math.random().toString(36).slice(2, 10);
  const bridgeUrl = `${extensionOrigin}/test-bridge.html?pt-e2e-reset=${bridgeMarker}`;
  const page = await newFirefoxPage(context);

  try {
    // moz-extension:// navigation never fires CDP commit/load events in Firefox+Playwright,
    // so page.evaluate() and locator operations on the page block indefinitely.
    // Use the Firefox Remote Debugging Protocol instead: it evaluates directly in the JS context
    // regardless of Playwright's CDP navigation state.
    try {
      await page.goto(bridgeUrl, { waitUntil: "commit", timeout: 500 });
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "TimeoutError") throw error;
    }

    const remoteFirefox = await connectRemoteFirefox(debuggerPort);
    try {
      const tab = await waitForRemoteFirefoxTab(remoteFirefox, bridgeMarker);
      const consoleActor = await getRemoteFxConsoleActor(remoteFirefox, tab.actor);
      // Clear storage first, then explicitly reset debugMode via saveSimpleSettings.
      // chrome.storage.local.clear() triggers handleConfigMutation() in the background,
      // but that function does NOT re-read preferences — it keeps the stale lastKnownDebugMode.
      // Sending saveSimpleSettings forces the background to update lastKnownDebugMode in memory.
      await probeRemoteFxTabValue(
        remoteFirefox,
        consoleActor,
        bridgeMarker,
        `(async () => {
          await chrome.storage.local.clear();
          await chrome.runtime.sendMessage({ type: "pt:save-simple-settings", debugMode: false, onboardingCompleted: true });
          return "done";
        })()`,
        "storage-reset",
        15_000,
        tab.actor,
      );
    } finally {
      remoteFirefox.disconnect();
    }
  } finally {
    await page.close().catch(() => undefined);
  }
});

const runFirefoxRuntimePhase = async <T>(
  title: string,
  action: () => Promise<T>,
): Promise<T> => test.step(`phase: ${title}`, action);

const prepareFirefoxHostPage = async (context: BrowserContext): Promise<Page> => {
  const existingPage = context.pages().find((page) => page.url() === "about:blank");
  if (existingPage) {
    return existingPage;
  }

  return newFirefoxPage(context);
};

const isRecoverableFxNavError = (error: unknown): error is Error =>
  error instanceof Error &&
  (error.message.includes("interrupted by another navigation") ||
    error.message.includes("NS_BINDING_ABORTED") ||
    error.message.includes("NS_BINDING_CANCELLED_OLD_LOAD"));

const gotoFirefoxHostUrl = async (page: Page, url: string): Promise<void> => {
  const expectedUrl = new URL(url);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    return;
  } catch (error) {
    if (!isRecoverableFxNavError(error)) {
      throw error;
    }
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.waitForURL(
        (currentUrl) =>
          currentUrl.origin === expectedUrl.origin &&
          currentUrl.pathname === expectedUrl.pathname &&
          currentUrl.search === expectedUrl.search &&
          currentUrl.hash === expectedUrl.hash,
        { timeout: 15_000, waitUntil: "commit" },
      );
      await page.waitForLoadState("domcontentloaded");
      return;
    } catch (error) {
      if (!isRecoverableFxNavError(error) || attempt === 1) {
        throw error;
      }
    }
  }
};

const reloadFirefoxHostPage = async (page: Page): Promise<void> => {
  const expectedUrl = new URL(page.url());

  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    return;
  } catch (error) {
    if (!isRecoverableFxNavError(error)) {
      throw error;
    }
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.waitForURL(
        (currentUrl) =>
          currentUrl.origin === expectedUrl.origin &&
          currentUrl.pathname === expectedUrl.pathname &&
          currentUrl.search === expectedUrl.search &&
          currentUrl.hash === expectedUrl.hash,
        { timeout: 15_000, waitUntil: "commit" },
      );
      await page.waitForLoadState("domcontentloaded");
      return;
    } catch (error) {
      if (!isRecoverableFxNavError(error) || attempt === 1) {
        throw error;
      }
    }
  }
};

const waitForFxHostBasePage = async (page: Page, serverUrl: string): Promise<void> => {
  const expectedUrl = new URL(serverUrl);
  const currentUrl = page.url();

  if (currentUrl) {
    const resolvedCurrentUrl = new URL(currentUrl);
    if (
      resolvedCurrentUrl.origin === expectedUrl.origin &&
      resolvedCurrentUrl.pathname === expectedUrl.pathname &&
      resolvedCurrentUrl.search === expectedUrl.search &&
      resolvedCurrentUrl.hash === expectedUrl.hash
    ) {
      await page.waitForLoadState("domcontentloaded");
      await waitForHostProbeReady(page);
      await waitForFxBridge(page);
      return;
    }
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.waitForURL(
        (currentUrl) =>
          currentUrl.origin === expectedUrl.origin &&
          currentUrl.pathname === expectedUrl.pathname &&
          currentUrl.search === expectedUrl.search &&
          currentUrl.hash === expectedUrl.hash,
        { timeout: 15_000 },
      );
      break;
    } catch (error) {
      if (!isRecoverableFxNavError(error) || attempt === 1) {
        throw error;
      }
    }
  }
  await page.waitForLoadState("domcontentloaded");
  await waitForHostProbeReady(page);
  await waitForFxBridge(page);
};

const FX_BRIDGE_READY_MS = 20_000;

/**
 * Nested inside another `expect.poll`, a wait longer than the outer budget turns
 * the retry into a single blocking attempt. Callers polling on their own clock
 * must pass a `timeout` below their budget.
 */
const waitForFxBridge = async (
  page: Page,
  { timeout = FX_BRIDGE_READY_MS }: { timeout?: number } = {},
): Promise<void> => {
  await page.waitForFunction(
    () =>
      document.documentElement?.getAttribute("data-pt-firefox-settings-bridge") ===
      "ready",
    undefined,
    { timeout },
  );
};

/**
 * Rule mutations reload the active tab from the background as a fire-and-forget
 * follow-up (`persistPopupRuleMutation`), so the bridge reply reaches the test
 * before the document is replaced. Arm this before the mutation and await it
 * afterwards to turn that reload into an observable boundary; otherwise the next
 * read straddles the swap, its reply lands on a dead document, and the wait can
 * only time out.
 */
const armFxExtTriggeredReload = (page: Page): Promise<void> => {
  const navigated = page.waitForEvent("framenavigated", {
    predicate: (frame) => frame === page.mainFrame(),
    timeout: 30_000,
  });

  const settled = (async () => {
    await navigated;
    // The hash-seed redirect and the hash-stripping replaceState add further
    // navigations; both waits below re-evaluate on the settled document.
    await page.waitForLoadState("domcontentloaded");
    await waitForFxBridge(page);
  })();

  // An assertion between arming and awaiting can abandon this promise; keep the
  // rejection observed so it never surfaces as an unhandled rejection. Awaiting
  // callers still see the original failure.
  settled.catch(() => undefined);
  return settled;
};

type FirefoxPopupPageHandle = {
  page: Page;
  urlFragment: string;
};

const FX_POPUP_OPEN_TIMEOUT_MS = 500;

const navigateFirefoxPopupPage = async (
  popupPage: Page,
  popupUrl: string,
): Promise<void> => {
  try {
    await popupPage.goto(popupUrl, {
      waitUntil: "commit",
      timeout: FX_POPUP_OPEN_TIMEOUT_MS,
    });
  } catch (error) {
    // Remote tab discovery is the authoritative readiness check for Firefox popup tests.
    if (!(error instanceof Error) || error.name !== "TimeoutError") {
      throw error;
    }
  }
};

const openFirefoxPopupPage = async (
  context: BrowserContext,
  extensionOrigin: string,
  targetPage?: Page,
): Promise<FirefoxPopupPageHandle> => {
  const popupPage = await context.newPage();
  const popupUrl = new URL(`${extensionOrigin}/src/ui/popup/index.html`);
  popupUrl.searchParams.set("pt-e2e-popup", Math.random().toString(36).slice(2, 10));

  await navigateFirefoxPopupPage(popupPage, popupUrl.toString());

  if (targetPage) {
    await targetPage.bringToFront();
    await popupPage
      .reload({
        waitUntil: "commit",
        timeout: FX_POPUP_OPEN_TIMEOUT_MS,
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error) || error.name !== "TimeoutError") {
          throw error;
        }
      });
  }

  return {
    page: popupPage,
    urlFragment: popupUrl.toString(),
  };
};

const listRemoteFirefoxTabs = async (
  remoteFirefox: RemoteFirefox,
): Promise<RemoteFirefoxTab[]> => (await remoteFirefox.client.request("listTabs")).tabs;

const findRemoteFirefoxTab = (
  tabs: readonly RemoteFirefoxTab[],
  urlFragment: string,
): RemoteFirefoxTab | undefined => {
  const exactMatches = tabs.filter((candidate) => candidate.url?.includes(urlFragment));
  if (exactMatches.length > 0) {
    return exactMatches.find((candidate) => candidate.selected) ?? exactMatches.at(-1);
  }

  try {
    const normalizedUrl = new URL(urlFragment);
    if (!normalizedUrl.searchParams.has("pt-e2e-popup")) {
      return undefined;
    }

    const relaxedMatches = tabs.filter((candidate) => {
      if (!candidate.url) {
        return false;
      }

      try {
        const candidateUrl = new URL(candidate.url);
        return (
          candidateUrl.origin === normalizedUrl.origin &&
          candidateUrl.pathname === normalizedUrl.pathname
        );
      } catch {
        return false;
      }
    });

    return (
      relaxedMatches.find((candidate) => candidate.selected) ?? relaxedMatches.at(-1)
    );
  } catch {
    return undefined;
  }
};

const waitForRemoteFirefoxTab = async (
  remoteFirefox: RemoteFirefox,
  urlFragment: string,
  timeoutMs = 15_000,
): Promise<RemoteFirefoxTab> => {
  let matchingTab: RemoteFirefoxTab | undefined;

  await expect
    .poll(
      async () => {
        matchingTab = findRemoteFirefoxTab(
          await listRemoteFirefoxTabs(remoteFirefox),
          urlFragment,
        );
        return matchingTab;
      },
      {
        timeout: timeoutMs,
        intervals: [100, 250, 500],
      },
    )
    .toBeDefined();

  return matchingTab!;
};

const waitForRemoteFxPopup = async (
  remoteFirefox: RemoteFirefox,
  urlFragment: string,
  timeoutMs = 15_000,
): Promise<RemoteFirefoxTab> => {
  let matchingTab: RemoteFirefoxTab | undefined;

  await expect
    .poll(
      async () => {
        matchingTab = findRemoteFirefoxTab(
          await listRemoteFirefoxTabs(remoteFirefox),
          urlFragment,
        );

        return matchingTab?.title === BRAND_DISPLAY_NAME ? matchingTab.title : null;
      },
      {
        timeout: timeoutMs,
        intervals: [100, 250, 500],
      },
    )
    .toBe(BRAND_DISPLAY_NAME);

  return matchingTab!;
};

const waitForRemoteFxTabTitle = async (
  remoteFirefox: RemoteFirefox,
  urlFragment: string,
  prefix: string,
  timeoutMs = 10_000,
  tabActor?: string,
): Promise<string> => {
  let matchingTitle: string | null = null;
  let lastTitle: string | null = null;

  await expect
    .poll(
      async () => {
        const tabs = await listRemoteFirefoxTabs(remoteFirefox);
        const tab =
          (tabActor
            ? tabs.find((candidate) => candidate.actor === tabActor)
            : undefined) ?? findRemoteFirefoxTab(tabs, urlFragment);
        lastTitle = tab?.title ?? null;
        matchingTitle = tab?.title?.startsWith(prefix) ? tab.title : null;
        return matchingTitle;
      },
      {
        timeout: timeoutMs,
        intervals: [100, 250, 500],
      },
    )
    .not.toBeNull();

  if (matchingTitle === null) {
    throw new Error(
      `Timed out waiting for Firefox tab ${urlFragment} title prefix ${prefix}. Last title: ${lastTitle ?? "<none>"}.`,
    );
  }

  return matchingTitle;
};

const getRemoteFxConsoleActor = async (
  remoteFirefox: RemoteFirefox,
  tabActor: string,
): Promise<string> => {
  const target = await remoteFirefox.client.request({
    to: tabActor,
    type: "getTarget",
  });
  return target.frame.consoleActor;
};

const evaluateRemoteFxConsole = async (
  remoteFirefox: RemoteFirefox,
  consoleActor: string,
  text: string,
): Promise<void> => {
  await remoteFirefox.client.request({
    to: consoleActor,
    type: "evaluateJSAsync",
    text,
  });
};

const withRemoteFxEvalTrap = (
  remoteFirefox: RemoteFirefox,
): {
  assertNoUnexpectedErrors: () => void;
  dispose: () => void;
} => {
  let unexpectedError: Error | null = null;
  const onError = (error: Error) => {
    const message = String(error);
    if (
      !message.includes("evaluationResult") &&
      !message.includes("descriptor-destroyed") &&
      !message.includes("forwardingCancelled")
    ) {
      unexpectedError = error;
    }
  };

  remoteFirefox.client.on("error", onError);

  return {
    assertNoUnexpectedErrors: () => {
      if (unexpectedError) {
        throw unexpectedError;
      }
    },
    dispose: () => {
      remoteFirefox.client.off?.("error", onError);
    },
  };
};

const probeRemoteFxTabValue = async (
  remoteFirefox: RemoteFirefox,
  consoleActor: string,
  urlFragment: string,
  expression: string,
  label: string,
  timeoutMs = 5_000,
  tabActor?: string,
): Promise<string> => {
  const token = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const prefix = `${token}:`;
  const encodedPrefix = JSON.stringify(prefix);
  await evaluateRemoteFxConsole(
    remoteFirefox,
    consoleActor,
    `Promise.resolve(${expression}).then((value) => {
      document.title = ${encodedPrefix} + String(value);
    }).catch((error) => {
      document.title = ${encodedPrefix} + "error:" + (error instanceof Error ? error.message : String(error));
    })`,
  );
  const title = await waitForRemoteFxTabTitle(
    remoteFirefox,
    urlFragment,
    prefix,
    timeoutMs,
    tabActor,
  );
  return title.slice(prefix.length);
};

const probeRemoteFxTabJson = async <T>(
  remoteFirefox: RemoteFirefox,
  consoleActor: string,
  urlFragment: string,
  expression: string,
  label: string,
  timeoutMs = 5_000,
  tabActor?: string,
): Promise<T> => {
  const raw = await probeRemoteFxTabValue(
    remoteFirefox,
    consoleActor,
    urlFragment,
    `(async () => JSON.stringify(await (${expression})))()`,
    label,
    timeoutMs,
    tabActor,
  );

  if (raw.startsWith("error:")) {
    throw new Error(
      `Firefox remote probe ${label} failed: ${raw.slice("error:".length)}`,
    );
  }

  return JSON.parse(raw) as T;
};

const runFxPopupRuntimeJson = async <T>(
  context: BrowserContext,
  extensionOrigin: string,
  remoteFirefox: RemoteFirefox,
  expression: string,
  label: string,
  timeoutMs = 15_000,
): Promise<T> => {
  const popupHandle = await openFirefoxPopupPage(context, extensionOrigin);

  try {
    // The probe uses document.title as its result channel. Wait for the popup's
    // one-time title assignment before stamping the probe result so startup
    // cannot overwrite it.
    const popupTab = await waitForRemoteFxPopup(
      remoteFirefox,
      popupHandle.urlFragment,
      timeoutMs,
    );
    const popupConsoleActor = await getRemoteFxConsoleActor(
      remoteFirefox,
      popupTab.actor,
    );

    return await probeRemoteFxTabJson<T>(
      remoteFirefox,
      popupConsoleActor,
      popupHandle.urlFragment,
      expression,
      label,
      timeoutMs,
      popupTab.actor,
    );
  } finally {
    await popupHandle.page.close().catch(() => undefined);
  }
};

const readFxUserScriptsPerm = async (
  remoteFirefox: RemoteFirefox,
  consoleActor: string,
  popupUrlFragment: string,
  timeoutMs = 5_000,
): Promise<boolean> => {
  const result = await probeRemoteFxTabValue(
    remoteFirefox,
    consoleActor,
    popupUrlFragment,
    `browser.permissions.contains({ permissions: ["userScripts"] })`,
    "popup-userscripts-permission",
    timeoutMs,
  );

  if (result === "true") {
    return true;
  }
  if (result === "false") {
    return false;
  }

  throw new Error(`Unexpected Firefox popup permissions.contains result: ${result}`);
};

const readFxPermWithFreshActor = async (
  remoteFirefox: RemoteFirefox,
  popupUrlFragment: string,
  timeoutMs = 1_500,
): Promise<boolean> => {
  const popupTab = await waitForRemoteFirefoxTab(
    remoteFirefox,
    popupUrlFragment,
    timeoutMs,
  );
  const popupConsoleActor = await getRemoteFxConsoleActor(
    remoteFirefox,
    popupTab.actor,
  );
  return readFxUserScriptsPerm(
    remoteFirefox,
    popupConsoleActor,
    popupUrlFragment,
    timeoutMs,
  );
};

const clearFxUserScriptsPerm = async (
  remoteFirefox: RemoteFirefox,
  consoleActor: string,
  popupUrlFragment: string,
): Promise<void> => {
  const result = await probeRemoteFxTabValue(
    remoteFirefox,
    consoleActor,
    popupUrlFragment,
    `(async () => {
      await browser.permissions.remove({ permissions: ["userScripts"] });
      return browser.permissions.contains({ permissions: ["userScripts"] });
    })()`,
    "popup-userscripts-permission-clear",
  );

  if (result !== "false") {
    throw new Error(
      `Expected Firefox popup permissions.remove result to clear userScripts, got: ${result}`,
    );
  }
};

const FX_USER_SCRIPT_BUTTON_ID = "pt-test-userscripts-request";

const installFxPermButton = async (
  remoteFirefox: RemoteFirefox,
  consoleActor: string,
  popupUrlFragment: string,
): Promise<{ height: number; left: number; top: number; width: number }> => {
  const result = await probeRemoteFxTabValue(
    remoteFirefox,
    consoleActor,
    popupUrlFragment,
    `(() => {
      const buttonId = ${JSON.stringify(FX_USER_SCRIPT_BUTTON_ID)};
      let button = document.getElementById(buttonId);
      if (!(button instanceof HTMLButtonElement)) {
        button = document.createElement("button");
        button.id = buttonId;
        button.type = "button";
        button.textContent = "Grant userScripts";
        Object.assign(button.style, {
          position: "fixed",
          top: "12px",
          right: "12px",
          zIndex: "2147483647"
        });
        document.body.append(button);
      }

      globalThis.__ptTestUserScriptsPermissionResult = "pending";
      button.onclick = async () => {
        try {
          const grantedInPopup = await browser.permissions.request({ permissions: ["userScripts"] });
          if (grantedInPopup === false) {
            globalThis.__ptTestUserScriptsPermissionResult = "not-granted";
            return;
          }
          const response = await chrome.runtime.sendMessage({
            type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.requestFirefoxUserscriptsPermission)}
          });
          if (!response?.ok) {
            throw new Error(response?.error ?? "Failed to sync Firefox userScripts permission.");
          }
          globalThis.__ptTestUserScriptsPermissionResult = response.granted
            ? "granted"
            : "not-granted";
        } catch (error) {
          globalThis.__ptTestUserScriptsPermissionResult =
            "error:" + (error instanceof Error ? error.message : String(error));
        }
      };

      const rect = button.getBoundingClientRect();
      return ["ready", Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)].join(":");
    })()`,
    "popup-userscripts-permission-button",
    15_000,
  );

  const [kind, left, top, width, height] = result.split(":");
  if (kind !== "ready") {
    throw new Error(
      `Unexpected Firefox popup permission button setup result: ${result}`,
    );
  }

  return {
    left: Number(left),
    top: Number(top),
    width: Number(width),
    height: Number(height),
  };
};

const readFxPermRequestResult = async (
  remoteFirefox: RemoteFirefox,
  consoleActor: string,
  popupUrlFragment: string,
): Promise<string> =>
  probeRemoteFxTabValue(
    remoteFirefox,
    consoleActor,
    popupUrlFragment,
    `globalThis.__ptTestUserScriptsPermissionResult ?? "pending"`,
    "popup-userscripts-permission-request-result",
    15_000,
  );

const FX_BRIDGE_RESULT_MS = 15_000;

/**
 * A bridge reply is consumed once. When the document is replaced between the
 * request dispatch and the reply, the answer lands on a dead document and the
 * result wait can only time out, so `resultTimeout` must stay below the budget
 * of any `expect.poll` this runs inside — otherwise a single lost reply eats the
 * whole polling budget instead of costing one retry.
 */
const requestFxBridgeWithOpts = async <T>(
  page: Page,
  {
    requestEventName,
    resultEventName,
    detail,
    resultTimeout = FX_BRIDGE_RESULT_MS,
  }: {
    requestEventName: string;
    resultEventName: string;
    detail: unknown;
    resultTimeout?: number;
  },
): Promise<T> => {
  const isRecoverableBridgeError = (error: unknown): error is Error =>
    error instanceof Error &&
    (error.message.includes("Execution context was destroyed") ||
      error.message.includes("Cannot find context with specified id") ||
      error.message.includes("Frame was detached") ||
      error.name === "TimeoutError" ||
      isRecoverableFxNavError(error));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.evaluate(
        ({ requestEventName, resultEventName, detail }) => {
          document.documentElement?.removeAttribute(`data-${resultEventName}`);
          document.dispatchEvent(new CustomEvent(requestEventName, { detail }));
        },
        { requestEventName, resultEventName, detail },
      );

      const resultHandle = await page.waitForFunction(
        (eventName) =>
          document.documentElement?.getAttribute(`data-${eventName}`) ?? null,
        resultEventName,
        { timeout: resultTimeout },
      );

      return JSON.parse(await resultHandle.jsonValue()) as T;
    } catch (error) {
      if (!isRecoverableBridgeError(error) || attempt === 1) {
        throw error;
      }

      await page.waitForLoadState("domcontentloaded", { timeout: resultTimeout });
      await waitForFxBridge(page, { timeout: resultTimeout });
    }
  }

  throw new Error(
    `Firefox settings bridge failed without a terminal result for ${requestEventName}.`,
  );
};

const requestFxSettingsBridge = async <T>(
  page: Page,
  requestEventName: string,
  resultEventName: string,
  detail: unknown,
): Promise<T> =>
  requestFxBridgeWithOpts<T>(page, {
    requestEventName,
    resultEventName,
    detail,
  });

const readFxFallbackSeedKey = async (page: Page): Promise<string | null> => {
  await waitForFxBridge(page);

  const response = await requestFxSettingsBridge<
    GetSettingsResponse | FxSettingsBridgeError
  >(page, FXT_BRIDGE_EVENTS.getSettings, FXT_BRIDGE_EVENTS.getSettingsResult, null);

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.globalFallbackRule?.ruleSeedKey ?? null;
};

const readFirefoxHostState = async (
  page: Page,
): Promise<{
  cookie: string;
  localStorage: string | null;
  sessionStorage: string | null;
}> =>
  page.evaluate(
    ({ localStorageKey, sessionStorageKey }) => ({
      cookie: document.cookie,
      localStorage: globalThis.localStorage.getItem(localStorageKey),
      sessionStorage: globalThis.sessionStorage.getItem(sessionStorageKey),
    }),
    {
      localStorageKey: FX_TEST_LOCAL_KEY,
      sessionStorageKey: FX_TEST_SESSION_KEY,
    },
  );

const seedFirefoxHostState = async (page: Page): Promise<void> => {
  await page.evaluate(
    ({ cookieFragment, localStorageKey, sessionStorageKey, stateValue }) => {
      document.cookie = `${cookieFragment}; path=/; SameSite=Lax`;
      globalThis.localStorage.setItem(localStorageKey, stateValue);
      globalThis.sessionStorage.setItem(sessionStorageKey, stateValue);
    },
    {
      cookieFragment: TEST_COOKIE_FRAGMENT,
      localStorageKey: FX_TEST_LOCAL_KEY,
      sessionStorageKey: FX_TEST_SESSION_KEY,
      stateValue: TEST_PRESENT_VALUE,
    },
  );
};

/**
 * Budget for log reads driven by an `expect.poll`: short enough that a reply lost
 * to a document swap costs one retry instead of the whole polling budget. Only
 * for reads the poll can repeat — a single-shot read keeps the default.
 */
const FX_BRIDGE_LOG_TIMEOUT_MS = 4_000;

const readFirefoxBridgeLogs = async (
  page: Page,
  resultTimeout = FX_BRIDGE_RESULT_MS,
): Promise<ExtensionLogEntry[]> => {
  const response = await requestFxBridgeWithOpts<
    GetLogsResponse | FxSettingsBridgeError
  >(page, {
    requestEventName: FXT_BRIDGE_EVENTS.getLogs,
    resultEventName: FXT_BRIDGE_EVENTS.getLogsResult,
    detail: null,
    resultTimeout,
  });

  if (!("logs" in response)) {
    throw new Error(response.error);
  }

  return response.logs;
};

const readFxBridgeLogs = async (page: Page): Promise<ExtensionLogEntry[]> =>
  readFirefoxBridgeLogs(page, FX_BRIDGE_LOG_TIMEOUT_MS);

const clearFirefoxBridgeLogs = async (page: Page): Promise<void> => {
  const response = await requestFxSettingsBridge<
    ClearLogsResponse | FxSettingsBridgeError
  >(page, FXT_BRIDGE_EVENTS.clearLogs, FXT_BRIDGE_EVENTS.clearLogsResult, null);

  if (!("ok" in response) || response.ok !== true) {
    throw new Error("Failed to clear Firefox bridge logs.");
  }
};

const configureFxResultCookie = async (
  page: Page,
  detail: {
    hostname: string;
    cookieName: string;
    cookieValue: string | null;
  },
): Promise<void> => {
  const response = await requestFxSettingsBridge<FxCookieProbeResult>(
    page,
    FXT_BRIDGE_EVENTS.configureResponseCookie,
    FXT_BRIDGE_EVENTS.configureResponseCookieResult,
    detail,
  );

  if (!("ok" in response) || response.ok !== true) {
    throw new Error(response.error);
  }
};

const readLiveFxCreepState = async (page: Page): Promise<LiveFxCreepState> => {
  await page.goto("https://abrahamjuliot.github.io/creepjs/", {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForFunction(
    () => (document.body?.innerText ?? "").includes("ServiceWorkerGlobalScope"),
    undefined,
    { timeout: 120_000 },
  );

  return page.evaluate(() => {
    const sampleDate = new Date(Date.UTC(2024, 6, 1, 12, 0, 0));
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "long",
      timeZoneName: "short",
    });
    const bodyText = document.body?.innerText ?? "";
    const resolvedOptions = formatter.resolvedOptions();

    return {
      href: location.href,
      language: navigator.language,
      languages: Array.from(navigator.languages ?? []),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      resolvedLocale: resolvedOptions.locale,
      formattedDate: formatter.format(sampleDate),
      formattedParts: formatter.formatToParts(sampleDate),
      timezoneOffset: sampleDate.getTimezoneOffset(),
      nowString: new Date().toString(),
      runtimeLocale: globalThis.__PT_RUNTIME__?.locale ?? null,
      bodySnippet:
        bodyText.match(/Timezone[\s\S]{0,400}/)?.[0] ??
        bodyText.match(/Intl[\s\S]{0,400}/)?.[0] ??
        bodyText.slice(0, 1000),
    } satisfies LiveFxCreepState;
  });
};

const expectFxOttawaRuntime = (runtimeSnapshot: LiveFxCreepState): void => {
  expect(runtimeSnapshot.href).toContain("abrahamjuliot.github.io/creepjs/");
  expect(runtimeSnapshot.language).toBe("en-CA");
  expect(runtimeSnapshot.languages).toEqual(["en-CA", "en", "fr-CA", "fr"]);
  expect(runtimeSnapshot.timeZone).toBe("America/Toronto");
  expect(runtimeSnapshot.resolvedLocale).toBe("en-CA");
  expect(runtimeSnapshot.formattedDate).toBe("July at EDT");
  expect(runtimeSnapshot.timezoneOffset).toBe(240);
  expect(runtimeSnapshot.nowString).toContain("GMT-0400");
  if (runtimeSnapshot.runtimeLocale) {
    expect(runtimeSnapshot.runtimeLocale).toMatchObject({
      language: "en-CA",
      languages: ["en-CA", "en", "fr-CA", "fr"],
      timeZone: "America/Toronto",
    });
  }
};

const buildLiveFxOttawaRuleSet = (
  rules: DomainRule[],
  ottawaLocationId: string,
): DomainRule[] =>
  buildFxRuleSetForLoc(rules, "abrahamjuliot.github.io", ottawaLocationId);

const buildFxRuleSetForLoc = (
  rules: DomainRule[],
  pattern: string,
  locationId: string,
): DomainRule[] => [
  ...rules.filter((rule) => rule.pattern !== pattern),
  {
    pattern,
    locationId,
    enabled: true,
  },
];

const readSnapshot = async (
  page: Page | Frame,
): Promise<{
  language: string;
  timeZone: string;
  userAgent: string;
  platform: string;
  vendor: string;
  appVersion: string;
  hardwareConcurrency: number;
  deviceMemory: number | null;
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelDepth: number;
    devicePixelRatio: number;
  } | null;
  audio: {
    sampleRate: number;
    channelDataSample: number[];
    channelDataLength: number;
    error?: string;
  } | null;
  runtimePresent: boolean;
  runtimeInstalled?: boolean;
  earlyRuntimeInstalled?: boolean;
  runtimeConfigPresent?: boolean;
  runtimeScriptPresent?: boolean;
  dateConstructorSource: string;
  dateConstructorOwnNames: string[];
  dateConstructorDescriptorKeys: string[];
  datePrototypeConstructorMatches: boolean;
  dateGetTimezoneOffsetSource: string;
  dateToStringSource: string;
  dateToDateStringSource: string;
  dateToTimeStringSource: string;
  dateToLocaleStringSource: string;
  dateToLocaleDateStringSource: string;
  dateToLocaleTimeStringSource: string;
  geolocationGetCurrentPositionSource: string;
  geolocationGetCurrentPositionOwnNames: string[];
  geolocationGetCurrentPositionHasPrototype: boolean;
  geolocationWatchPositionSource: string;
  geolocationWatchPositionOwnNames: string[];
  geolocationWatchPositionHasPrototype: boolean;
  geolocationClearWatchSource: string;
  geolocationClearWatchOwnNames: string[];
  geolocationClearWatchHasPrototype: boolean;
  dateTimeFormatConstructorSource: string;
  dateTimeFormatConstructorOwnNames: string[];
  dateTimeFormatConstructorDescriptorKeys: string[];
  dateTimeFormatPrototypeConstructorMatches: boolean;
  dateTimeFormatSupportedLocalesSource: string;
  dateTimeFormatResolvedOptionsSource: string;
  dateTimeFormatFormatToPartsSource: string;
  dateTimeFormatFormatRangeSource: string;
  dateTimeFormatFormatRangeToPartsSource: string;
  dateTimeFormatFormatGetterSource: string | null;
  dateTimeFormatFormatGetterName: string | null;
  dateTimeFormatFormatPrototypeAccessError: string | null;
  permissions: {
    geolocation: string;
  };
  geo?: {
    latitude: number;
    longitude: number;
    timestamp?: number;
  };
  geoError?: string;
  probeError?: string;
}> => {
  await expect(page.locator("#snapshot")).not.toHaveText("pending");
  return JSON.parse((await page.locator("#snapshot").textContent()) ?? "{}") as {
    language: string;
    timeZone: string;
    userAgent: string;
    platform: string;
    vendor: string;
    appVersion: string;
    hardwareConcurrency: number;
    deviceMemory: number | null;
    screen: {
      width: number;
      height: number;
      availWidth: number;
      availHeight: number;
      colorDepth: number;
      pixelDepth: number;
      devicePixelRatio: number;
    } | null;
    audio: {
      sampleRate: number;
      channelDataSample: number[];
      channelDataLength: number;
      error?: string;
    } | null;
    runtimePresent: boolean;
    dateConstructorSource: string;
    dateConstructorOwnNames: string[];
    dateConstructorDescriptorKeys: string[];
    datePrototypeConstructorMatches: boolean;
    dateGetTimezoneOffsetSource: string;
    dateToStringSource: string;
    dateToDateStringSource: string;
    dateToTimeStringSource: string;
    dateToLocaleStringSource: string;
    dateToLocaleDateStringSource: string;
    dateToLocaleTimeStringSource: string;
    geolocationGetCurrentPositionSource: string;
    geolocationGetCurrentPositionOwnNames: string[];
    geolocationGetCurrentPositionHasPrototype: boolean;
    geolocationWatchPositionSource: string;
    geolocationWatchPositionOwnNames: string[];
    geolocationWatchPositionHasPrototype: boolean;
    geolocationClearWatchSource: string;
    geolocationClearWatchOwnNames: string[];
    geolocationClearWatchHasPrototype: boolean;
    dateTimeFormatConstructorSource: string;
    dateTimeFormatConstructorOwnNames: string[];
    dateTimeFormatConstructorDescriptorKeys: string[];
    dateTimeFormatPrototypeConstructorMatches: boolean;
    dateTimeFormatSupportedLocalesSource: string;
    dateTimeFormatResolvedOptionsSource: string;
    dateTimeFormatFormatToPartsSource: string;
    dateTimeFormatFormatRangeSource: string;
    dateTimeFormatFormatRangeToPartsSource: string;
    dateTimeFormatFormatGetterSource: string | null;
    dateTimeFormatFormatGetterName: string | null;
    dateTimeFormatFormatPrototypeAccessError: string | null;
    permissions: Record<string, string>;
    permissionsError?: string;
    geo?: {
      latitude: number;
      longitude: number;
      timestamp?: number;
    };
    geoError?: string;
    probeError?: string;
  };
};

const waitForHostProbeReady = async (page: Page | Frame): Promise<void> => {
  await expect
    .poll(
      async () => {
        try {
          return await page.evaluate(
            () => typeof globalThis.collectFirefoxRuntimeSnapshot === "function",
          );
        } catch (error) {
          if (
            error instanceof Error &&
            (error.message.includes("Execution context was destroyed") ||
              isRecoverableFxNavError(error))
          ) {
            return false;
          }

          throw error;
        }
      },
      {
        timeout: 5_000,
      },
    )
    .toBe(true);
};

const runHostProbe = async (page: Page | Frame): Promise<void> => {
  await page.evaluate(() => globalThis.collectFirefoxRuntimeSnapshot());
};

const useNativeFxSurfaces = async (page: Page): Promise<void> => {
  const saveSettingsResult = await requestFxSettingsBridge<SaveSettingsResponse>(
    page,
    FXT_BRIDGE_EVENTS.saveSimpleSettings,
    FXT_BRIDGE_EVENTS.saveSimpleSettingsResult,
    {
      browserFingerprintSpoofingEnabled: true,
      sharedSpoofing: {
        audio: false,
        navigator: false,
        screen: false,
      },
    },
  );
  expect(saveSettingsResult.ok).toBe(true);
  if (!saveSettingsResult.ok) {
    throw new Error(saveSettingsResult.error);
  }
};

const enableFxFpSpoofing = async (page: Page): Promise<void> => {
  const saveSettingsResult = await requestFxSettingsBridge<SaveSettingsResponse>(
    page,
    FXT_BRIDGE_EVENTS.saveSimpleSettings,
    FXT_BRIDGE_EVENTS.saveSimpleSettingsResult,
    {
      browserFingerprintSpoofingEnabled: true,
      sharedSpoofing: {
        audio: true,
        navigator: true,
        screen: true,
      },
    },
  );
  expect(saveSettingsResult.ok).toBe(true);
  if (!saveSettingsResult.ok) {
    throw new Error(saveSettingsResult.error);
  }
};

const waitForFirstCallRace = async (page: Page): Promise<void> => {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => typeof globalThis.collectFirefoxFirstCallRaceSnapshot === "function",
        ),
      {
        timeout: 5_000,
      },
    )
    .toBe(true);
};

const readFirstCallRaceState = async (
  page: Page,
): Promise<{
  permissionState: string | null;
  firstCurrentPosition: {
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null;
  firstCurrentError: string | null;
  firstWatchPosition: {
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null;
  firstWatchError: string | null;
  laterCurrentPosition?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null;
  laterCurrentError?: string | null;
}> => {
  await expect(page.locator("#snapshot")).not.toHaveText("pending");
  return JSON.parse((await page.locator("#snapshot").textContent()) ?? "{}") as {
    permissionState: string | null;
    firstCurrentPosition: {
      latitude: number;
      longitude: number;
      timestamp: number;
    } | null;
    firstCurrentError: string | null;
    firstWatchPosition: {
      latitude: number;
      longitude: number;
      timestamp: number;
    } | null;
    firstWatchError: string | null;
    laterCurrentPosition?: {
      latitude: number;
      longitude: number;
      timestamp: number;
    } | null;
    laterCurrentError?: string | null;
  };
};

const runFirstCallRaceProbe = async (page: Page): Promise<void> => {
  await page.evaluate(() => globalThis.collectFirefoxFirstCallRaceSnapshot());
};

const isTimeLocaleProbeReady = async (page: Page): Promise<boolean> => {
  try {
    return await page.evaluate(
      () => typeof globalThis.collectFirefoxTimeLocaleRaceSnapshot === "function",
    );
  } catch {
    return false;
  }
};

const waitForTimeLocaleRace = async (page: Page): Promise<void> => {
  await expect
    .poll(async () => isTimeLocaleProbeReady(page), {
      timeout: 5_000,
    })
    .toBe(true);
};

const readInitialLocaleState = async (
  page: Page,
  { timeout = 5_000 }: { timeout?: number } = {},
): Promise<{
  initialHash: string | null;
  initialLanguage: string | null;
  initialLanguages: string[] | null;
  initialTimeZone: string | null;
  initialTimezoneOffset: number | null;
}> => {
  await expect
    .poll(
      async () => {
        try {
          return await page.evaluate(
            () => typeof globalThis.__firefoxTimeLocaleRace === "object",
          );
        } catch {
          return false;
        }
      },
      {
        timeout,
        intervals: [50, 100, 250],
      },
    )
    .toBe(true);

  return page.evaluate(() => {
    const race = globalThis.__firefoxTimeLocaleRace ?? {};
    return {
      initialHash: typeof race.initialHash === "string" ? race.initialHash : null,
      initialLanguage:
        typeof race.initialLanguage === "string" ? race.initialLanguage : null,
      initialLanguages: Array.isArray(race.initialLanguages)
        ? race.initialLanguages
        : null,
      initialTimeZone:
        typeof race.initialTimeZone === "string" ? race.initialTimeZone : null,
      initialTimezoneOffset:
        typeof race.initialTimezoneOffset === "number"
          ? race.initialTimezoneOffset
          : null,
    };
  });
};

const waitForInitialLocale = async (
  page: Page,
  expected: Partial<Awaited<ReturnType<typeof readInitialLocaleState>>>,
  { allowReload = false }: { allowReload?: boolean } = {},
): Promise<Awaited<ReturnType<typeof readInitialLocaleState>>> => {
  let latestSnapshot: Awaited<ReturnType<typeof readInitialLocaleState>> | null = null;
  const maxReloads = allowReload ? 2 : 0;
  let lastError: unknown = null;

  for (let reloadAttempt = 0; reloadAttempt <= maxReloads; reloadAttempt += 1) {
    latestSnapshot = null;
    const pollTimeout = reloadAttempt === 0 && maxReloads > 0 ? 5_000 : 20_000;
    // Every wait nested in the poll body stays under the polling budget, so a
    // document swap costs one retry instead of the whole attempt.
    const nestedTimeout = Math.floor(pollTimeout / 2);

    try {
      await expect
        .poll(
          async () => {
            try {
              await waitForFxBridge(page, { timeout: nestedTimeout });
              if (!(await isTimeLocaleProbeReady(page))) {
                return null;
              }

              latestSnapshot = await readInitialLocaleState(page, {
                timeout: nestedTimeout,
              });
              return latestSnapshot;
            } catch (error) {
              if (
                error instanceof Error &&
                (error.message.includes("Execution context was destroyed") ||
                  isRecoverableFxNavError(error))
              ) {
                return null;
              }

              throw error;
            }
          },
          {
            timeout: pollTimeout,
            intervals: [100, 250, 500],
          },
        )
        .toMatchObject(expected);

      if (latestSnapshot === null) {
        throw new Error("Expected Firefox time/locale snapshot to become available.");
      }

      return latestSnapshot;
    } catch (error) {
      lastError = error;
    }

    if (reloadAttempt === maxReloads) {
      break;
    }

    await reloadFirefoxHostPage(page);
    await waitForFxBridge(page);
    await waitForTimeLocaleRace(page);
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Expected Firefox time/locale snapshot to become available.");
};

const waitForCookieRace = async (page: Page): Promise<void> => {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => typeof globalThis.collectFirefoxCookieRaceSnapshot === "function",
        ),
      {
        timeout: 5_000,
      },
    )
    .toBe(true);
};

const readCookieRaceSnapshot = async (
  page: Page,
): Promise<{
  initialCookie: string | null;
  laterCookie: string | null;
}> =>
  page.evaluate(async () => {
    const snapshot = await globalThis.collectFirefoxCookieRaceSnapshot();
    return {
      initialCookie:
        typeof snapshot.initialCookie === "string" ? snapshot.initialCookie : null,
      laterCookie:
        typeof snapshot.laterCookie === "string" ? snapshot.laterCookie : null,
    };
  });

const readPostMethodSnapshot = async (
  page: Page,
): Promise<{
  requestMethod: string | null;
  initialHash: string | null;
}> => {
  await expect
    .poll(
      async () => {
        try {
          return await page.evaluate(
            () => typeof globalThis.__firefoxPostMethodSnapshot === "object",
          );
        } catch {
          return false;
        }
      },
      {
        timeout: 5_000,
        intervals: [50, 100, 250],
      },
    )
    .toBe(true);

  return page.evaluate(() => {
    const snapshot = globalThis.__firefoxPostMethodSnapshot ?? {};
    return {
      requestMethod:
        typeof snapshot.requestMethod === "string" ? snapshot.requestMethod : null,
      initialHash:
        typeof snapshot.initialHash === "string" ? snapshot.initialHash : null,
    };
  });
};

const readLocaleHashNavState = async (
  page: Page,
): Promise<{
  hash: string | null;
  historyLength: number | null;
  hashchangeCount: number | null;
  scrollY: number | null;
  anchorInViewport: boolean;
}> => {
  await expect
    .poll(
      async () => {
        try {
          return await page.evaluate(() => {
            const anchor = document.querySelector("#hash-target");
            return (
              typeof location.hash === "string" &&
              anchor instanceof HTMLElement &&
              globalThis.scrollY > 0 &&
              anchor.getBoundingClientRect().top < globalThis.innerHeight
            );
          });
        } catch {
          return false;
        }
      },
      {
        timeout: 5_000,
        intervals: [50, 100, 250],
      },
    )
    .toBe(true);

  return page.evaluate(() => {
    const events = globalThis.__firefoxTimeLocaleRaceEvents ?? {};
    const anchor = document.querySelector("#hash-target");
    const anchorTop =
      anchor instanceof HTMLElement ? anchor.getBoundingClientRect().top : null;

    return {
      hash: typeof location.hash === "string" ? location.hash : null,
      historyLength: typeof history.length === "number" ? history.length : null,
      hashchangeCount: typeof events.hashchange === "number" ? events.hashchange : null,
      scrollY: typeof globalThis.scrollY === "number" ? globalThis.scrollY : null,
      anchorInViewport:
        anchorTop !== null && anchorTop >= 0 && anchorTop < globalThis.innerHeight,
    };
  });
};

const waitForSpoofedSnapshot = async (
  page: Page | Frame,
  { allowReload = false }: { allowReload?: boolean } = {},
): Promise<void> => {
  // Phase 1: Poll locale only (no permissions/geolocation call).
  // This keeps the warm-up probe lightweight and avoids stalling on the
  // async Firefox permissions shim while the full spoofed snapshot is still
  // validated in phase 2.
  const phase1Check = async (): Promise<boolean> =>
    page.evaluate(() => {
      return (
        navigator.language === "pl" &&
        Intl.DateTimeFormat().resolvedOptions().timeZone === "Europe/Warsaw"
      );
    });

  const maxReloads = allowReload && "reload" in page ? 2 : 0;
  let phase1Passed = false;
  let lastPhase1Error: unknown = null;

  for (let reloadAttempt = 0; reloadAttempt <= maxReloads; reloadAttempt += 1) {
    try {
      await expect
        .poll(phase1Check, {
          // The first window used to be 5s, which is ample on an idle host — the
          // bootstrap converges in about a second — but too tight once three
          // Firefox instances share the box. Falling through it bought nothing
          // except a reload and a longer window, so give the first window room
          // to succeed instead.
          timeout: 20_000,
          intervals: [250, 500, 1000],
        })
        .toBe(true);
      phase1Passed = true;
      break;
    } catch (error) {
      lastPhase1Error = error;
    }

    if (reloadAttempt === maxReloads) {
      break;
    }

    // Firefox sometimes misses the first one or two navigations right after the
    // temporary add-on install. Reload and retry once more before failing.
    await reloadFirefoxHostPage(page as Page);
    await waitForHostProbeReady(page);
    await waitForFxBridge(page as Page);
  }

  if (!phase1Passed) {
    const errorSuffix =
      lastPhase1Error instanceof Error ? `: ${lastPhase1Error.message}` : "";
    throw new Error(
      `waitForSpoofedSnapshot phase 1 timed out: locale not spoofed${errorSuffix}`,
    );
  }

  // Phase 2: Validate the full spoofed snapshot once the locale bootstrap has
  // converged.
  await runHostProbe(page);
  const snapshot = await readSnapshot(page);
  expect(snapshot.probeError, "Firefox host probe should complete").toBeUndefined();
  expect(
    snapshot.geoError,
    "Firefox geolocation probe should not fail",
  ).toBeUndefined();
  expect(Math.abs((snapshot.geo?.latitude ?? 0) - 52.2297)).toBeLessThan(0.02);
  expect(Math.abs((snapshot.geo?.longitude ?? 0) - 21.0122)).toBeLessThan(0.02);
};

/**
 * Primes the temporary add-on bootstrap path once per worker.
 *
 * `waitForSpoofedSnapshot` already retries with its own reload ladder, so this
 * used to wrap that ladder in three more attempts: nine polling windows and three
 * full page setups for one warm-up. On an idle host it converges in ~1s and the
 * nesting never showed, but under the three parallel workers CI uses it burned
 * the whole ladder every run — 121s in CI, 108s locally, versus at most 4.3s for
 * every other phase in the lane.
 *
 * The ladder cannot help here either: the locale surface it polls is the known
 * Firefox time/locale first-inline race (see "Known Technical Debt" in CLAUDE.md),
 * and a reload re-enters that same race rather than escaping it. So take one
 * window and move on — priming the bootstrap path is the point, and every test
 * still makes its own spoofing assertions afterwards.
 */
const warmUpFirefoxSpoofing = async (
  context: BrowserContext,
  serverUrl: string,
): Promise<void> => {
  let sawBridgeReady = false;
  const warmupPage = await prepareFirefoxHostPage(context);

  try {
    await gotoFirefoxHostUrl(warmupPage, serverUrl);
    await waitForHostProbeReady(warmupPage);
    await waitForFxBridge(warmupPage);
    sawBridgeReady = true;
    await waitForSpoofedSnapshot(warmupPage);
    await warmupPage
      .goto("about:blank", { waitUntil: "domcontentloaded" })
      .catch(() => undefined);
    return;
  } catch (error) {
    if (!warmupPage.isClosed()) {
      try {
        await warmupPage.goto("about:blank", { waitUntil: "domcontentloaded" });
      } catch {
        await warmupPage.close().catch(() => undefined);
      }
    }

    // Warm-up only primes the bootstrap path. Once the bridge is alive, each test
    // still performs its own page-specific spoofing assertions, so a transient
    // cold-start miss here should not fail the suite on its own.
    if (sawBridgeReady) {
      return;
    }

    throw error instanceof Error
      ? error
      : new Error("Firefox warmup failed before spoofed snapshot converged.");
  }
};

export const registerFxCoreTests = () => {
  test.describe.configure({ timeout: 120_000 });

  test("emits Firefox-style Accept-Language on matched navigations", async ({
    context,
    serverUrl,
  }) => {
    test.slow();
    const settingsPage = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(settingsPage, serverUrl);
    await waitForFxBridge(settingsPage);

    const settings = await requestFxSettingsBridge<
      GetSettingsResponse | FxSettingsBridgeError
    >(
      settingsPage,
      FXT_BRIDGE_EVENTS.getSettings,
      FXT_BRIDGE_EVENTS.getSettingsResult,
      null,
    );
    expect(settings.ok).toBe(true);
    if (!settings.ok) {
      throw new Error(settings.error);
    }

    const hostname = new URL(serverUrl).hostname;
    const locationId = "firefox-accept-language-e2e";
    const originalModel = {
      locations: settings.locations,
      rules: settings.rules,
      containerAssignments: settings.containerAssignments ?? [],
    };
    const nextLocations = [
      ...settings.locations.filter((location) => location.id !== locationId),
      {
        id: locationId,
        label: "Firefox Accept-Language E2E",
        latitude: 52.52,
        longitude: 13.405,
        accuracy: 25,
        noiseRadius: 50,
        language: "de-DE",
        languages: ["de-DE", "en-US"],
        timeZone: "Europe/Berlin",
      },
    ];

    const saveResult = await requestFxSettingsBridge<
      SaveLocationResponse | FxSettingsBridgeError
    >(
      settingsPage,
      FXT_BRIDGE_EVENTS.saveLocationModel,
      FXT_BRIDGE_EVENTS.saveLocationModelResult,
      {
        locations: nextLocations,
        rules: buildFxRuleSetForLoc(settings.rules, hostname, locationId),
        containerAssignments: settings.containerAssignments ?? [],
      },
    );
    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) {
      throw new Error(saveResult.error);
    }

    let testError: unknown = null;
    let page: Page | null = null;

    try {
      await warmUpFirefoxSpoofing(context, serverUrl);
      page = await prepareFirefoxHostPage(context);
      await gotoFirefoxHostUrl(page, `${serverUrl}/echo-accept-language`);
      await expect(page.locator("#accept-language")).toHaveText("de-DE,en-US;q=0.9");
    } catch (error) {
      testError = error;
    }

    // Restore settings using the active unthrottled page if available, falling back to settingsPage
    const bridgePage = page ?? settingsPage;

    try {
      await waitForFxBridge(bridgePage);
      const restoreResult = await requestFxSettingsBridge<
        SaveLocationResponse | FxSettingsBridgeError
      >(
        bridgePage,
        FXT_BRIDGE_EVENTS.saveLocationModel,
        FXT_BRIDGE_EVENTS.saveLocationModelResult,
        originalModel,
      );
      expect(restoreResult.ok).toBe(true);
      if (!restoreResult.ok) {
        throw new Error(restoreResult.error);
      }
    } catch (error) {
      if (!testError) {
        testError = error;
      }
    }

    await settingsPage.close().catch(() => undefined);
    if (page) {
      await page.close().catch(() => undefined);
    }

    if (testError) {
      throw testError;
    }
  });

  test("spoofs geolocation from the first inline script in Firefox", async ({
    persistentContextSession,
    serverUrl,
  }) => {
    const context = await persistentContextSession.restartContext();
    const geolocationSetupPage = await prepareFirefoxHostPage(context);
    await geolocationSetupPage.goto("about:blank", { waitUntil: "domcontentloaded" });
    await context.setGeolocation({
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 12,
    });
    await context.grantPermissions(["geolocation"], {
      origin: serverUrl,
    });

    // Prime the temporary addon so the Firefox MAIN-world shim and its shared
    // state are fully registered before we exercise the first inline script race.
    await warmUpFirefoxSpoofing(context, serverUrl);

    const page = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(page, `${serverUrl}/first-call-race`);
    await waitForFirstCallRace(page);
    await runFirstCallRaceProbe(page);

    const snapshot = await readFirstCallRaceState(page);

    expect(snapshot.permissionState).toBe("granted");
    expect(snapshot.firstCurrentError).toBeNull();
    expect(snapshot.firstWatchError).toBeNull();
    expect(snapshot.laterCurrentError ?? null).toBeNull();
    expect(snapshot.firstCurrentPosition?.latitude).toBeCloseTo(52.2297, 2);
    expect(snapshot.firstCurrentPosition?.longitude).toBeCloseTo(21.0122, 2);
    expect(snapshot.firstWatchPosition?.latitude).toBeCloseTo(52.2297, 2);
    expect(snapshot.firstWatchPosition?.longitude).toBeCloseTo(21.0122, 2);
    expect(snapshot.laterCurrentPosition?.latitude).toBeCloseTo(52.2297, 2);
    expect(snapshot.laterCurrentPosition?.longitude).toBeCloseTo(21.0122, 2);
    expect(snapshot.firstCurrentPosition?.timestamp).toBeGreaterThan(0);
    expect(snapshot.firstWatchPosition?.timestamp).toBeGreaterThan(0);
    expect(snapshot.laterCurrentPosition?.timestamp).toBeGreaterThan(0);
  });

  test("keeps Firefox runtime control-plane, snapshots, and native registries off page globals", async ({
    context,
    serverUrl,
  }) => {
    await warmUpFirefoxSpoofing(context, serverUrl);

    const page = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(page, serverUrl);
    await waitForHostProbeReady(page);
    await waitForSpoofedSnapshot(page, { allowReload: true });

    const exposure = await page.evaluate(() => {
      const readOwnValue = (key: PropertyKey): unknown => {
        try {
          return Reflect.get(globalThis, key);
        } catch {
          return undefined;
        }
      };
      const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
        typeof value === "object" && value !== null;
      const isRuntimeState = (value: unknown): boolean => {
        if (!isRecord(value)) return false;
        const native = isRecord(value.native) ? value.native : null;
        const snapshot = isRecord(value.snapshot) ? value.snapshot : null;
        return (
          value.modules instanceof Set ||
          Array.isArray(value.pendingInstallers) ||
          typeof native?.Date === "function" ||
          isRecord(snapshot?.fingerprint)
        );
      };
      const isFullSnapshot = (value: unknown): boolean =>
        isRecord(value) &&
        typeof value.authKey === "string" &&
        isRecord(value.fingerprint) &&
        isRecord(value.locale) &&
        isRecord(value.date);
      const label = (key: PropertyKey): string =>
        typeof key === "symbol"
          ? (Symbol.keyFor(key) ?? key.description ?? "<symbol>")
          : key;
      const symbols = Object.getOwnPropertySymbols(globalThis);
      const wrappedFunctions = [
        Function.prototype.toString,
        navigator.geolocation.getCurrentPosition,
      ];

      return {
        nativeRegistrySymbols: symbols
          .filter((key) => {
            const value = readOwnValue(key);
            return (
              value instanceof WeakMap && wrappedFunctions.some((fn) => value.has(fn))
            );
          })
          .map(label),
        runtimeStateSymbols: symbols
          .filter((key) => isRuntimeState(readOwnValue(key)))
          .map(label),
        suspiciousGlobals: Reflect.ownKeys(globalThis)
          .filter((key) => {
            const value = readOwnValue(key);
            return isRuntimeState(value) || isFullSnapshot(value);
          })
          .map(label),
      };
    });

    expect(exposure).toEqual({
      nativeRegistrySymbols: [],
      runtimeStateSymbols: [],
      suspiciousGlobals: [],
    });
  });

  test("brands TIMEOUT before the first Firefox srcdoc script", async ({
    persistentContextSession,
    serverUrl,
  }) => {
    const context = await persistentContextSession.restartContext();
    await warmUpFirefoxSpoofing(context, serverUrl);

    const page = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(page, serverUrl);
    await waitForHostProbeReady(page);
    await waitForSpoofedSnapshot(page, { allowReload: true });

    const result = await page.evaluate(async () => {
      const timeoutError = await new Promise<GeolocationPositionError>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => reject(new Error("Expected a geolocation timeout")),
            resolve,
            { timeout: 0 },
          );
        },
      );
      const callbackKey = `__gwFirefoxSrcdoc${Math.random().toString(36).slice(2)}`;
      const errorKey = `__gwFirefoxError${Math.random().toString(36).slice(2)}`;
      const parentGlobal = window as typeof window & Record<string, unknown>;
      parentGlobal[errorKey] = timeoutError;

      type Result = {
        code: number | null;
        error: string | null;
        productSymbolPresent: boolean;
      };
      return new Promise<Result>((resolve) => {
        const iframe = document.createElement("iframe");
        parentGlobal[callbackKey] = (value: Result) => {
          delete parentGlobal[callbackKey];
          delete parentGlobal[errorKey];
          iframe.remove();
          resolve(value);
        };
        iframe.setAttribute(
          "srcdoc",
          `<!doctype html><script>
        const getter = Object.getOwnPropertyDescriptor(
          GeolocationPositionError.prototype,
          "code"
        )?.get;
        try {
          parent[${JSON.stringify(callbackKey)}]({
            code: getter?.call(parent[${JSON.stringify(errorKey)}]) ?? null,
            error: null,
            productSymbolPresent: Object.hasOwn(
              top,
              Symbol.for("pt:native-sources")
            )
          });
        } catch (error) {
          parent[${JSON.stringify(callbackKey)}]({
            code: null,
            error: String(error),
            productSymbolPresent: Object.hasOwn(
              top,
              Symbol.for("pt:native-sources")
            )
          });
        }
      </script>`,
        );
        document.body.append(iframe);
      });
    });

    expect(result).toEqual({ code: 3, error: null, productSymbolPresent: false });
  });

  test("keeps spoofed values consistent in a Firefox iframe", async ({
    context,
    serverUrl,
  }) => {
    await warmUpFirefoxSpoofing(context, serverUrl);

    const iframePage = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(iframePage, serverUrl);
    await waitForHostProbeReady(iframePage);
    await waitForSpoofedSnapshot(iframePage, { allowReload: true });

    await iframePage.evaluate((src) => {
      const existing = document.getElementById("frame");
      existing?.remove();
      const iframe = document.createElement("iframe");
      iframe.id = "frame";
      iframe.src = src;
      document.body.appendChild(iframe);
    }, serverUrl);

    await expect
      .poll(
        async () =>
          iframePage
            .frames()
            .find((candidate) => candidate.url() === `${serverUrl}/`) !== undefined,
        { timeout: 5_000 },
      )
      .toBe(true);

    const frame = iframePage
      .frames()
      .find((candidate) => candidate.url() === `${serverUrl}/`);
    if (!frame) {
      throw new Error("Expected iframe content frame to be available");
    }

    await waitForHostProbeReady(frame);
    await waitForSpoofedSnapshot(frame);
    const snapshot = await readSnapshot(frame);
    expect(snapshot.runtimeInstalled).toBe(false);
    expect(snapshot.earlyRuntimeInstalled).toBe(false);
    expect(snapshot.runtimeConfigPresent).toBe(false);
    expect((snapshot as { runtimeScriptPresent?: boolean }).runtimeScriptPresent).toBe(
      false,
    );
    expect(snapshot.timeZone).toBe("Europe/Warsaw");
    expect(snapshot.language).toBe("pl");
    expect(snapshot.platform).not.toHaveLength(0);
    expect(snapshot.screen?.width).toBeGreaterThan(0);
    expect(snapshot.geo?.latitude).toBeCloseTo(52.2297, 2);
    expect(snapshot.geo?.longitude).toBeCloseTo(21.0122, 2);
    expect(snapshot.geo?.timestamp).toBeGreaterThan(0);
  });

  test("does not expose native Firefox iframe geolocation after navigator deletion", async ({
    persistentContextSession,
    serverUrl,
  }) => {
    const context = await persistentContextSession.restartContext();
    const geolocationSetupPage = await prepareFirefoxHostPage(context);
    await geolocationSetupPage.goto("about:blank", { waitUntil: "domcontentloaded" });
    await context.setGeolocation({
      latitude: -33.8688,
      longitude: 151.2093,
      accuracy: 12,
    });
    await context.grantPermissions(["geolocation"], {
      origin: serverUrl,
    });
    await warmUpFirefoxSpoofing(context, serverUrl);

    const page = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(page, serverUrl);
    await waitForHostProbeReady(page);
    await waitForSpoofedSnapshot(page, { allowReload: true });

    const result = await page.evaluate(async () => {
      const iframe = document.createElement("iframe");
      document.body.append(iframe);
      const childWindow = iframe.contentWindow;
      if (!childWindow) {
        throw new Error("Expected an about:blank child window");
      }

      const childNavigator = childWindow.navigator;
      const before = childNavigator.geolocation;
      const hadOwnShadow = Object.hasOwn(childNavigator, "geolocation");
      const removed = Reflect.deleteProperty(childNavigator, "geolocation");
      const after = childNavigator.geolocation;
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        after.getCurrentPosition(resolve, reject, {
          maximumAge: 0,
          timeout: 5_000,
        });
      });
      const watchPosition = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          let watchId = 0;
          watchId = after.watchPosition(
            (nextPosition) => {
              after.clearWatch(watchId);
              resolve(nextPosition);
            },
            reject,
            { maximumAge: 0, timeout: 5_000 },
          );
        },
      );
      const permissionState = await childNavigator.permissions
        .query({ name: "geolocation" })
        .then(({ state }) => state);

      const output = {
        afterUsesChildPrototype:
          Object.getPrototypeOf(after) === childWindow.Geolocation.prototype,
        beforeUsesChildPrototype:
          Object.getPrototypeOf(before) === childWindow.Geolocation.prototype,
        hadOwnShadow,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        parentObjectShared: after === navigator.geolocation,
        permissionState,
        removed,
        watchLatitude: watchPosition.coords.latitude,
        watchLongitude: watchPosition.coords.longitude,
      };
      iframe.remove();
      return output;
    });

    expect(result).toEqual({
      afterUsesChildPrototype: true,
      beforeUsesChildPrototype: true,
      hadOwnShadow: false,
      latitude: result.latitude,
      longitude: result.longitude,
      parentObjectShared: false,
      permissionState: "granted",
      removed: true,
      watchLatitude: result.watchLatitude,
      watchLongitude: result.watchLongitude,
    });
    expect(result.latitude).toBeCloseTo(52.2297, 2);
    expect(result.longitude).toBeCloseTo(21.0122, 2);
    expect(result.watchLatitude).toBeCloseTo(52.2297, 2);
    expect(result.watchLongitude).toBeCloseTo(21.0122, 2);
  });

  test("installs Firefox iframe surfaces independently from a poisoned parent", async ({
    persistentContextSession,
    serverUrl,
  }) => {
    const context = await persistentContextSession.restartContext();
    await warmUpFirefoxSpoofing(context, serverUrl);

    const page = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(page, serverUrl);
    await waitForHostProbeReady(page);
    await waitForSpoofedSnapshot(page, { allowReload: true });

    const result = await page.evaluate(async () => {
      const navigatorPrototype = Object.getPrototypeOf(navigator);
      const screenPrototype = Object.getPrototypeOf(screen);
      const descriptors = {
        canvasToDataURL: Object.getOwnPropertyDescriptor(
          HTMLCanvasElement.prototype,
          "toDataURL",
        ),
        devicePixelRatio: Object.getOwnPropertyDescriptor(window, "devicePixelRatio"),
        geolocationGetCurrentPosition: Object.getOwnPropertyDescriptor(
          Geolocation.prototype,
          "getCurrentPosition",
        ),
        language: Object.getOwnPropertyDescriptor(navigatorPrototype, "language"),
        permissionsQuery: Object.getOwnPropertyDescriptor(
          Permissions.prototype,
          "query",
        ),
        screenWidth: Object.getOwnPropertyDescriptor(screenPrototype, "width"),
        webGLGetParameter:
          typeof WebGLRenderingContext === "undefined"
            ? undefined
            : Object.getOwnPropertyDescriptor(
                WebGLRenderingContext.prototype,
                "getParameter",
              ),
      };
      const expected = {
        devicePixelRatio,
        language: navigator.language,
        screenWidth: screen.width,
      };
      const restoreDescriptor = (
        target: object,
        property: PropertyKey,
        descriptor: PropertyDescriptor | undefined,
      ): void => {
        if (descriptor) {
          Object.defineProperty(target, property, descriptor);
        }
      };

      try {
        Object.defineProperty(navigatorPrototype, "language", {
          configurable: true,
          get: () => "poison-parent",
        });
        Object.defineProperty(screenPrototype, "width", {
          configurable: true,
          get: () => 111,
        });
        Object.defineProperty(window, "devicePixelRatio", {
          configurable: true,
          get: () => 7,
        });
        Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
          configurable: true,
          writable: true,
          value: () => "data:,parent-poison",
        });
        Object.defineProperty(Geolocation.prototype, "getCurrentPosition", {
          configurable: true,
          writable: true,
          value: () => {
            throw new Error("parent-poison-geolocation");
          },
        });
        Object.defineProperty(Permissions.prototype, "query", {
          configurable: true,
          writable: true,
          value: async () => ({ state: "denied" }),
        });
        if (typeof WebGLRenderingContext !== "undefined") {
          Object.defineProperty(WebGLRenderingContext.prototype, "getParameter", {
            configurable: true,
            writable: true,
            value: () => "parent-poison-webgl",
          });
        }

        const iframe = document.createElement("iframe");
        document.body.append(iframe);
        const childWindow = iframe.contentWindow;
        if (!childWindow) {
          throw new Error("Expected an about:blank child window");
        }
        const childCanvas = childWindow.document.createElement("canvas");
        childCanvas.width = 16;
        childCanvas.height = 16;
        childCanvas.getContext("2d")?.fillRect(0, 0, 4, 4);
        const canvasExport = childCanvas.toDataURL();
        const webGLRenderer =
          childCanvas.getContext("webgl")?.getParameter(0x9246) ?? null;
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          childWindow.navigator.geolocation.getCurrentPosition(resolve, reject, {
            maximumAge: 0,
            timeout: 5_000,
          });
        });
        const permissionState = await childWindow.navigator.permissions
          .query({ name: "geolocation" })
          .then(({ state }) => state);
        const beforeParentRetamper = childWindow.navigator.language;
        Object.defineProperty(navigatorPrototype, "language", {
          configurable: true,
          get: () => "poison-parent-after-install",
        });

        const output = {
          afterParentRetamper: childWindow.navigator.language,
          beforeParentRetamper,
          canvasPoisoned: canvasExport === "data:,parent-poison",
          devicePixelRatio: childWindow.devicePixelRatio,
          language: childWindow.navigator.language,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          permissionState,
          screenWidth: childWindow.screen.width,
          webGLPoisoned: webGLRenderer === "parent-poison-webgl",
        };
        iframe.remove();
        return { expected, output };
      } finally {
        restoreDescriptor(
          HTMLCanvasElement.prototype,
          "toDataURL",
          descriptors.canvasToDataURL,
        );
        restoreDescriptor(window, "devicePixelRatio", descriptors.devicePixelRatio);
        restoreDescriptor(
          Geolocation.prototype,
          "getCurrentPosition",
          descriptors.geolocationGetCurrentPosition,
        );
        restoreDescriptor(navigatorPrototype, "language", descriptors.language);
        restoreDescriptor(Permissions.prototype, "query", descriptors.permissionsQuery);
        restoreDescriptor(screenPrototype, "width", descriptors.screenWidth);
        if (typeof WebGLRenderingContext !== "undefined") {
          restoreDescriptor(
            WebGLRenderingContext.prototype,
            "getParameter",
            descriptors.webGLGetParameter,
          );
        }
      }
    });

    const { latitude, longitude, ...stableOutput } = result.output;
    expect(stableOutput).toEqual({
      afterParentRetamper: result.expected.language,
      beforeParentRetamper: result.expected.language,
      canvasPoisoned: false,
      devicePixelRatio: result.expected.devicePixelRatio,
      language: result.expected.language,
      permissionState: "granted",
      screenWidth: result.expected.screenWidth,
      webGLPoisoned: false,
    });
    expect(latitude).toBeCloseTo(52.2297, 2);
    expect(longitude).toBeCloseTo(21.0122, 2);
  });

  test("keeps Firefox fingerprint surfaces consistent across page and iframe", async ({
    context,
    serverUrl,
  }) => {
    await warmUpFirefoxSpoofing(context, serverUrl);

    const page = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(page, serverUrl);
    await waitForHostProbeReady(page);
    await waitForSpoofedSnapshot(page, { allowReload: true });
    await waitForFxBridge(page);
    await useNativeFxSurfaces(page);
    await gotoFirefoxHostUrl(page, serverUrl);
    await waitForHostProbeReady(page);
    await waitForSpoofedSnapshot(page, { allowReload: true });
    await runHostProbe(page);
    const baselineSnapshot = await readSnapshot(page);

    expect(baselineSnapshot.audio).not.toBeNull();
    expect(baselineSnapshot.audio?.error).toBeUndefined();

    await waitForFxBridge(page);
    await enableFxFpSpoofing(page);
    await gotoFirefoxHostUrl(page, serverUrl);
    await waitForHostProbeReady(page);
    await waitForSpoofedSnapshot(page, { allowReload: true });

    await page.evaluate((src) => {
      const existing = document.getElementById("fingerprint-parity-frame");
      existing?.remove();
      const iframe = document.createElement("iframe");
      iframe.id = "fingerprint-parity-frame";
      iframe.src = src;
      document.body.appendChild(iframe);
    }, serverUrl);

    await expect
      .poll(
        async () =>
          page
            .frames()
            .find(
              (candidate) =>
                candidate !== page.mainFrame() && candidate.url() === `${serverUrl}/`,
            ) !== undefined,
        { timeout: 5_000 },
      )
      .toBe(true);

    const frame = page
      .frames()
      .find(
        (candidate) =>
          candidate !== page.mainFrame() && candidate.url() === `${serverUrl}/`,
      );
    if (!frame) {
      throw new Error("Expected fingerprint parity iframe to be available.");
    }

    await waitForHostProbeReady(frame);
    await waitForSpoofedSnapshot(frame);
    await runHostProbe(page);
    await runHostProbe(frame);

    const pageSnapshot = await readSnapshot(page);
    const frameSnapshot = await readSnapshot(frame);

    expect(pageSnapshot.audio).not.toBeNull();
    expect(frameSnapshot.audio).not.toBeNull();
    expect(pageSnapshot.audio?.error).toBeUndefined();
    expect(frameSnapshot.audio?.error).toBeUndefined();
    expect(pageSnapshot.audio?.channelDataSample).not.toEqual(
      baselineSnapshot.audio?.channelDataSample,
    );

    expect(frameSnapshot.language).toBe(pageSnapshot.language);
    expect(frameSnapshot.timeZone).toBe(pageSnapshot.timeZone);
    expect(frameSnapshot.userAgent).toBe(pageSnapshot.userAgent);
    expect(frameSnapshot.platform).toBe(pageSnapshot.platform);
    expect(frameSnapshot.vendor).toBe(pageSnapshot.vendor);
    expect(frameSnapshot.appVersion).toBe(pageSnapshot.appVersion);
    expect(frameSnapshot.hardwareConcurrency).toBe(pageSnapshot.hardwareConcurrency);
    expect(frameSnapshot.deviceMemory).toBe(pageSnapshot.deviceMemory);
    expect(frameSnapshot.screen).toEqual(pageSnapshot.screen);
    expect(frameSnapshot.audio).toEqual(pageSnapshot.audio);
  });

  test("keeps Firefox native masking consistent across page and iframe realms", async ({
    context,
    serverUrl,
  }) => {
    await warmUpFirefoxSpoofing(context, serverUrl);

    const page = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(page, serverUrl);
    await waitForHostProbeReady(page);
    await waitForSpoofedSnapshot(page, { allowReload: true });

    await page.evaluate((src) => {
      const existing = document.getElementById("to-string-parity-frame");
      existing?.remove();
      const iframe = document.createElement("iframe");
      iframe.id = "to-string-parity-frame";
      iframe.src = src;
      document.body.appendChild(iframe);
    }, serverUrl);

    await expect
      .poll(
        async () =>
          page
            .frames()
            .find(
              (candidate) =>
                candidate !== page.mainFrame() && candidate.url() === `${serverUrl}/`,
            ) !== undefined,
        { timeout: 5_000 },
      )
      .toBe(true);

    const frame = page
      .frames()
      .find(
        (candidate) =>
          candidate !== page.mainFrame() && candidate.url() === `${serverUrl}/`,
      );
    if (!frame) {
      throw new Error("Expected native-mask parity iframe to be available.");
    }

    await waitForHostProbeReady(frame);
    const toStringFailures = await frame.evaluate(() => {
      const candidates: Record<string, Function> = {
        geolocation: navigator.geolocation.getCurrentPosition,
        date: Date,
        dateMethod: Date.prototype.getTimezoneOffset,
        intl: Intl.DateTimeFormat,
      };
      const failures: Record<string, string> = {};
      for (const [name, candidate] of Object.entries(candidates)) {
        try {
          void candidate.toString();
        } catch (error) {
          failures[name] = String(error);
        }
      }
      return failures;
    });
    expect(toStringFailures).toEqual({});
    await waitForSpoofedSnapshot(frame);

    const crossRealmSnapshot = await page.evaluate(() => {
      const iframe = document.getElementById(
        "to-string-parity-frame",
      ) as HTMLIFrameElement | null;
      const iframeWindow = iframe?.contentWindow;
      if (!iframeWindow) {
        throw new Error("Expected same-origin iframe window.");
      }

      return {
        realmToStringWrappersAreLocal:
          iframeWindow.Function.prototype.toString !== Function.prototype.toString,
        dateConstructorSource: Function.prototype.toString.call(iframeWindow.Date),
        dateMethodSource: Function.prototype.toString.call(
          iframeWindow.Date.prototype.toString,
        ),
        geolocationSource: Function.prototype.toString.call(
          iframeWindow.navigator.geolocation.getCurrentPosition,
        ),
        geolocationOwnNames: Object.getOwnPropertyNames(
          iframeWindow.navigator.geolocation.getCurrentPosition,
        ).sort(),
        geolocationHasPrototype:
          "prototype" in iframeWindow.navigator.geolocation.getCurrentPosition,
        iframeWrapperOnPageDateSource:
          iframeWindow.Function.prototype.toString.call(Date),
        pageWrapperOnIframeToStringSource: Function.prototype.toString.call(
          iframeWindow.Function.prototype.toString,
        ),
      };
    });

    expect(crossRealmSnapshot.realmToStringWrappersAreLocal).toBe(true);
    expect(crossRealmSnapshot.dateConstructorSource).toContain("[native code]");
    expect(crossRealmSnapshot.dateMethodSource).toContain("[native code]");
    expect(crossRealmSnapshot.geolocationSource).toContain("[native code]");
    expect(crossRealmSnapshot.iframeWrapperOnPageDateSource).toContain("[native code]");
    expect(crossRealmSnapshot.pageWrapperOnIframeToStringSource).toContain(
      "[native code]",
    );
    expect(crossRealmSnapshot.geolocationOwnNames).toEqual(["length", "name"]);
    expect(crossRealmSnapshot.geolocationHasPrototype).toBe(false);
  });
};

export const registerFxBootstrap = () => {
  test.describe.configure({ timeout: 120_000 });
  const bootstrapScope = process.env.PT_FIREFOX_RUNTIME_BOOTSTRAP_SCOPE || "all";
  const includeBootstrapScope = (...scopes: string[]) =>
    bootstrapScope === "all" || scopes.includes(bootstrapScope);

  if (includeBootstrapScope("navigation-signals"))
    test("records Firefox bootstrap diagnostics in debug logs", async ({
      context,
      serverUrl,
    }) => {
      const page = await prepareFirefoxHostPage(context);
      await gotoFirefoxHostUrl(page, serverUrl);
      await waitForFxBridge(page);

      const saveSettingsResult = await requestFxSettingsBridge<SaveSettingsResponse>(
        page,
        FXT_BRIDGE_EVENTS.saveSimpleSettings,
        FXT_BRIDGE_EVENTS.saveSimpleSettingsResult,
        {
          debugMode: true,
        },
      );
      expect(saveSettingsResult.ok).toBe(true);
      if (!saveSettingsResult.ok) {
        throw new Error(saveSettingsResult.error);
      }

      await clearFirefoxBridgeLogs(page);
      await page.goto("about:blank", { waitUntil: "domcontentloaded" });
      await gotoFirefoxHostUrl(page, `${serverUrl}/time-locale-race`);
      await waitForFxBridge(page);
      await waitForTimeLocaleRace(page);

      await expect
        .poll(
          async () => {
            const logs = await readFxBridgeLogs(page);
            return logs.some(
              (entry) => entry.event === "FirefoxBootstrap.source-selected",
            );
          },
          {
            timeout: 15_000,
            intervals: [100, 250, 500],
          },
        )
        .toBe(true);

      const logs = await readFirefoxBridgeLogs(page);
      const sourceLogs = logs.filter(
        (entry) => entry.event === "FirefoxBootstrap.source-selected",
      );
      expect(sourceLogs.length).toBeGreaterThan(0);
      expect(logs.some((entry) => entry.event === "Bootstrap.channel-used")).toBe(true);
      expect(
        logs.some(
          (entry) =>
            entry.event === "navigation.firefox-window-name-seed" ||
            entry.event === "navigation.firefox-hash-seed-decision" ||
            entry.event === "navigation.firefox-userscript-sync",
        ),
      ).toBe(true);

      const parsedSourceLogs = sourceLogs.map((entry) => {
        const details = entry.details as
          | {
              result?: Record<string, unknown>;
            }
          | undefined;
        return details?.result;
      });
      const bootstrapPhaseSourceLog =
        parsedSourceLogs.find((result) => result?.phase === "initial") ??
        parsedSourceLogs.find((result) => result?.phase === "sync") ??
        parsedSourceLogs.find((result) => result?.phase === "event");

      const hashSeedDecisionLogs = logs
        .filter((entry) => entry.event === "navigation.firefox-hash-seed-decision")
        .map((entry) => {
          const details = entry.details as
            | {
                builtRedirect?: unknown;
              }
            | undefined;
          return details?.builtRedirect;
        });
      const bootstrapPhaseSource = bootstrapPhaseSourceLog?.source;
      expect(bootstrapPhaseSource).toBeDefined();
      if (bootstrapPhaseSource === "static") {
        expect(hashSeedDecisionLogs).not.toContain(true);
      }

      expect(
        parsedSourceLogs.some(
          (result) =>
            result?.phase === "initial" ||
            result?.phase === "sync" ||
            result?.phase === "event",
        ),
      ).toBe(true);

      for (const result of parsedSourceLogs) {
        const selectedSource = result?.source;
        expect(selectedSource).toBeDefined();
        expect(["static", "hash", "windowName", "ephemeral"]).toContain(selectedSource);
        const selectedRole = result?.role;
        const selectedPrecedence = result?.precedence;
        const selectedSelectionScope = result?.selectionScope;
        const selectedVisibility = result?.visibility;
        const selectedNeedsPerm = result?.needsOptionalPermission;
        expect(selectedSelectionScope).toBe("bootstrap-source");
        if (selectedSource === "static") {
          expect(selectedRole).toBe("authoritative-early-seed");
          expect(selectedPrecedence).toBe(1);
          expect(selectedVisibility).toBe("hidden");
          expect(selectedNeedsPerm).toBe(false);
        } else if (selectedSource === "hash") {
          expect(selectedRole).toBe("authoritative-early-seed");
          expect(selectedPrecedence).toBe(0);
          expect(selectedVisibility).toBe("visible");
          expect(selectedNeedsPerm).toBe(false);
        } else if (selectedSource === "windowName") {
          expect(selectedRole).toBe("authoritative-early-seed");
          expect(selectedPrecedence).toBe(2);
          expect(selectedVisibility).toBe("hidden");
          expect(selectedNeedsPerm).toBe(false);
        } else if (selectedSource === "ephemeral") {
          expect(selectedRole).toBe("late-convergence");
          expect(selectedPrecedence).toBe(3);
          expect(selectedVisibility).toBe("hidden");
          expect(selectedNeedsPerm).toBe(false);
        }
      }
    });

  if (includeBootstrapScope("navigation-signals"))
    test("keeps hash bootstrap authoritative on standard Firefox navigations", async ({
      context,
      serverUrl,
    }) => {
      await warmUpFirefoxSpoofing(context, serverUrl);
      const page = await prepareFirefoxHostPage(context);
      await gotoFirefoxHostUrl(page, serverUrl);
      await waitForFxBridge(page);

      const saveSettingsResult = await requestFxSettingsBridge<SaveSettingsResponse>(
        page,
        FXT_BRIDGE_EVENTS.saveSimpleSettings,
        FXT_BRIDGE_EVENTS.saveSimpleSettingsResult,
        {
          debugMode: true,
        },
      );
      expect(saveSettingsResult.ok).toBe(true);
      if (!saveSettingsResult.ok) {
        throw new Error(saveSettingsResult.error);
      }

      await clearFirefoxBridgeLogs(page);

      // Open the navigation page before closing the settings page so the context
      // always has at least one page alive (Firefox closes the context when the
      // last page is removed, which would make context.newPage() fail).
      const navigationPage = await prepareFirefoxHostPage(context);
      await page.close();
      await gotoFirefoxHostUrl(navigationPage, `${serverUrl}/time-locale-race`);
      await waitForFxBridge(navigationPage);
      await waitForTimeLocaleRace(navigationPage);
      const snapshot = await readInitialLocaleState(navigationPage);
      expect(snapshot.initialLanguage).toBe("pl");
      expect(snapshot.initialTimeZone).toBe("Europe/Warsaw");

      await expect
        .poll(
          async () => {
            const logs = await readFxBridgeLogs(navigationPage);
            const hasHashRedirectDecision = logs.some((entry) => {
              if (entry.event !== "navigation.firefox-hash-seed-decision") {
                return false;
              }

              const details = entry.details as
                | {
                    builtRedirect?: unknown;
                  }
                | undefined;
              return details?.builtRedirect === true;
            });
            return hasHashRedirectDecision;
          },
          {
            timeout: 15_000,
            intervals: [100, 250, 500],
          },
        )
        .toBe(true);

      const logs = await readFirefoxBridgeLogs(navigationPage);
      const hashSeedDecisions = logs.filter(
        (entry) => entry.event === "navigation.firefox-hash-seed-decision",
      );
      expect(hashSeedDecisions.length).toBeGreaterThan(0);
      expect(
        hashSeedDecisions.some((entry) => {
          const details = entry.details as
            | {
                builtRedirect?: unknown;
              }
            | undefined;
          return details?.builtRedirect === true;
        }),
      ).toBe(true);
      expect(
        logs.some((entry) => {
          if (entry.event !== "navigation.firefox-window-name-seed") {
            return false;
          }

          const details = entry.details as
            | {
                reason?: unknown;
                trigger?: unknown;
                hostname?: unknown;
              }
            | undefined;
          return (
            details?.reason === "hash-transport-preferred" &&
            details?.trigger === "on-before-request" &&
            details?.hostname === "127.0.0.1"
          );
        }),
      ).toBe(true);
      expect(
        logs.some((entry) => {
          if (entry.event !== "navigation.firefox-window-name-seed") {
            return false;
          }

          const details = entry.details as
            | {
                reason?: unknown;
                trigger?: unknown;
              }
            | undefined;
          return (
            details?.reason === "execute-script-failed" &&
            (details?.trigger === "on-before-navigate" ||
              details?.trigger === "on-before-request")
          );
        }),
      ).toBe(false);
    });
};

export const registerFxTransport = () => {
  test.describe.configure({ timeout: 120_000 });
  const transportScope = process.env.PT_FIREFOX_RUNTIME_TRANSPORT_SCOPE || "all";
  const includeTransportScope = (...scopes: string[]) =>
    transportScope === "all" || scopes.includes(transportScope);

  if (includeTransportScope("permission-seeds"))
    test("grants Firefox userScripts permission without displacing Firefox navigation seeds", async ({
      context,
      debuggerPort,
      extensionOrigin,
      serverUrl,
    }) => {
      test.slow();
      await runFirefoxRuntimePhase("warm up spoofing", async () => {
        await warmUpFirefoxSpoofing(context, serverUrl);
      });
      const setupRemoteFirefox = await runFirefoxRuntimePhase(
        "connect remote Firefox debugger for setup",
        async () => connectRemoteFirefox(debuggerPort),
      );
      try {
        const saveSettingsResult = await runFirefoxRuntimePhase(
          "enable debug mode",
          async () =>
            runFxPopupRuntimeJson<SaveSettingsResponse | FxSettingsBridgeError>(
              context,
              extensionOrigin,
              setupRemoteFirefox,
              `chrome.runtime.sendMessage({
          type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.saveSimpleSettings)},
          debugMode: true
        })`,
              "settings-save-debug-mode",
            ),
        );
        expect(saveSettingsResult.ok).toBe(true);
        if (!saveSettingsResult.ok) {
          throw new Error(saveSettingsResult.error);
        }

        const settings = await runFirefoxRuntimePhase("read setup settings", async () =>
          runFxPopupRuntimeJson<GetSettingsResponse | FxSettingsBridgeError>(
            context,
            extensionOrigin,
            setupRemoteFirefox,
            `chrome.runtime.sendMessage({
          type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.getSettings)}
        })`,
            "settings-read-setup",
          ),
        );
        expect(settings.ok).toBe(true);
        if (!settings.ok) {
          throw new Error(settings.error);
        }
        const warsawLocation = settings.locations.find(
          (location) => location.label === "Warsaw",
        );
        if (!warsawLocation) {
          throw new Error(
            'Expected "Warsaw" location to exist in Firefox runtime settings.',
          );
        }

        const resetModelResult = await runFirefoxRuntimePhase(
          "reset setup model",
          async () =>
            runFxPopupRuntimeJson<SaveLocationResponse | FxSettingsBridgeError>(
              context,
              extensionOrigin,
              setupRemoteFirefox,
              `chrome.runtime.sendMessage({
          type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.saveLocationModel)},
          locations: ${JSON.stringify(settings.locations)},
          rules: [{ pattern: "*", locationId: ${JSON.stringify(warsawLocation.id)}, enabled: true }],
          containerAssignments: []
        })`,
              "settings-reset-model",
            ),
        );
        if (!resetModelResult.ok) {
          throw new Error(resetModelResult.error);
        }
        expect(resetModelResult.ok).toBe(true);
      } finally {
        setupRemoteFirefox.disconnect();
      }

      const page = await runFirefoxRuntimePhase(
        "prepare host page and debug mode",
        async () => {
          const preparedPage = await prepareFirefoxHostPage(context);
          await gotoFirefoxHostUrl(preparedPage, serverUrl);
          await waitForFxBridge(preparedPage);

          await clearFirefoxBridgeLogs(preparedPage);
          return preparedPage;
        },
      );

      const seededBeforePermGrant = await runFirefoxRuntimePhase(
        "capture baseline seeded navigation snapshot",
        async () => {
          const baselinePage = await prepareFirefoxHostPage(context);
          await gotoFirefoxHostUrl(baselinePage, `${serverUrl}/time-locale-race`);
          const snapshot = await waitForInitialLocale(baselinePage, {});
          expect(snapshot.initialHash).not.toBeNull();
          expect(snapshot.initialLanguage).not.toBeNull();
          expect(snapshot.initialTimeZone).not.toBeNull();

          await baselinePage.close();
          await clearFirefoxBridgeLogs(page);

          return snapshot;
        },
      );

      const remoteFirefox = await runFirefoxRuntimePhase(
        "connect remote Firefox debugger",
        async () => connectRemoteFirefox(debuggerPort),
      );
      const remoteTrap = withRemoteFxEvalTrap(remoteFirefox);
      let popupPage: Page | null = null;

      try {
        await runFirefoxRuntimePhase("grant popup userScripts permission", async () => {
          let popupHandle = await openFirefoxPopupPage(context, extensionOrigin);
          popupPage = popupHandle.page;
          // Wait until the popup has finished its one-time document.title set
          // (popup.tsx assigns BRAND_DISPLAY_NAME at module load). Probing before
          // that races: the probe stamps the tab title and the popup then clobbers
          // it, so the title poll never sees the probe prefix.
          let popupTab = await waitForRemoteFxPopup(
            remoteFirefox,
            popupHandle.urlFragment,
          );
          let popupConsoleActor = await getRemoteFxConsoleActor(
            remoteFirefox,
            popupTab.actor,
          );

          await clearFxUserScriptsPerm(
            remoteFirefox,
            popupConsoleActor,
            popupHandle.urlFragment,
          );

          await popupPage.close();
          popupHandle = await openFirefoxPopupPage(context, extensionOrigin);
          popupPage = popupHandle.page;
          popupTab = await waitForRemoteFxPopup(remoteFirefox, popupHandle.urlFragment);
          popupConsoleActor = await getRemoteFxConsoleActor(
            remoteFirefox,
            popupTab.actor,
          );

          expect(
            await readFxUserScriptsPerm(
              remoteFirefox,
              popupConsoleActor,
              popupHandle.urlFragment,
            ),
          ).toBe(false);

          const popupButtonRect = await installFxPermButton(
            remoteFirefox,
            popupConsoleActor,
            popupHandle.urlFragment,
          );
          await popupPage.bringToFront();
          await popupPage.mouse.click(
            popupButtonRect.left + popupButtonRect.width / 2,
            popupButtonRect.top + popupButtonRect.height / 2,
          );

          await expect
            .poll(
              () => readFxPermWithFreshActor(remoteFirefox, popupHandle.urlFragment),
              { timeout: 15_000, intervals: [100, 250, 500] },
            )
            .toBe(true);
          await expect
            .poll(
              () =>
                readFxPermRequestResult(
                  remoteFirefox,
                  popupConsoleActor,
                  popupHandle.urlFragment,
                ),
              { timeout: 15_000, intervals: [100, 250, 500] },
            )
            .toBe("granted");

          await waitForFxHostBasePage(page, serverUrl);
        });

        await runFirefoxRuntimePhase(
          "verify initial seeded navigation snapshot",
          async () => {
            await gotoFirefoxHostUrl(page, `${serverUrl}/time-locale-race`);
            const snapshot = await waitForInitialLocale(
              page,
              {
                initialHash: seededBeforePermGrant.initialHash ?? undefined,
                initialLanguage: seededBeforePermGrant.initialLanguage ?? undefined,
                initialTimeZone: seededBeforePermGrant.initialTimeZone ?? undefined,
              },
              { allowReload: true },
            );
            expect(snapshot.initialHash).toBe(seededBeforePermGrant.initialHash);
            expect(snapshot.initialLanguage).toBe(
              seededBeforePermGrant.initialLanguage,
            );
            expect(snapshot.initialTimeZone).toBe(
              seededBeforePermGrant.initialTimeZone,
            );
          },
        );

        await runFirefoxRuntimePhase("verify initial sync and seed logs", async () => {
          await expect
            .poll(
              async () => {
                const logs = await readFxBridgeLogs(page);
                const hasUserScriptSync = logs.some((entry) => {
                  if (entry.event !== "navigation.firefox-userscript-sync") {
                    return false;
                  }

                  const details = entry.details as
                    | {
                        success?: unknown;
                        registrationCount?: unknown;
                      }
                    | undefined;
                  return (
                    details?.success === true &&
                    typeof details?.registrationCount === "number" &&
                    details.registrationCount > 0
                  );
                });

                const hasSameHostSkipDecision = logs.some((entry) => {
                  if (entry.event !== "navigation.firefox-hash-seed-decision") {
                    return false;
                  }

                  const details = entry.details as
                    | {
                        builtRedirect?: unknown;
                        skipSameHostDocument?: unknown;
                      }
                    | undefined;
                  return (
                    details?.builtRedirect === false &&
                    details?.skipSameHostDocument === true
                  );
                });

                const hasWindowNameSeed = logs.some((entry) => {
                  if (entry.event !== "navigation.firefox-window-name-seed") {
                    return false;
                  }

                  const details = entry.details as
                    | {
                        success?: unknown;
                        trigger?: unknown;
                      }
                    | undefined;
                  return (
                    details?.success === true &&
                    details?.trigger === "on-before-request"
                  );
                });

                return (
                  hasUserScriptSync && hasSameHostSkipDecision && hasWindowNameSeed
                );
              },
              { timeout: 15_000, intervals: [100, 250, 500] },
            )
            .toBe(true);
        });

        await runFirefoxRuntimePhase("verify reload seed preservation", async () => {
          await clearFirefoxBridgeLogs(page);
          await reloadFirefoxHostPage(page);
          await waitForFxBridge(page);
          await waitForTimeLocaleRace(page);

          const reloadedSnapshot = await readInitialLocaleState(page);
          expect(reloadedSnapshot.initialHash).toBe(seededBeforePermGrant.initialHash);
          expect(reloadedSnapshot.initialLanguage).toBe(
            seededBeforePermGrant.initialLanguage,
          );
          expect(reloadedSnapshot.initialTimeZone).toBe(
            seededBeforePermGrant.initialTimeZone,
          );

          await expect
            .poll(
              async () => {
                const logs = await readFxBridgeLogs(page);
                const hasBuiltRedirect = logs.some((entry) => {
                  if (entry.event !== "navigation.firefox-hash-seed-decision") {
                    return false;
                  }

                  const details = entry.details as
                    | {
                        builtRedirect?: unknown;
                      }
                    | undefined;
                  return details?.builtRedirect === true;
                });

                const hasHashPreferredSeed = logs.some((entry) => {
                  if (entry.event !== "navigation.firefox-window-name-seed") {
                    return false;
                  }

                  const details = entry.details as
                    | {
                        reason?: unknown;
                        trigger?: unknown;
                        hostname?: unknown;
                      }
                    | undefined;
                  return (
                    details?.reason === "hash-transport-preferred" &&
                    details?.trigger === "on-before-request" &&
                    details?.hostname === "127.0.0.1"
                  );
                });

                return hasBuiltRedirect && hasHashPreferredSeed;
              },
              { timeout: 15_000, intervals: [100, 250, 500] },
            )
            .toBe(true);
        });

        remoteTrap.assertNoUnexpectedErrors();
      } finally {
        await popupPage?.close().catch(() => undefined);
        remoteTrap.dispose();
        remoteFirefox.disconnect();
      }
    });

  if (includeTransportScope("location-refresh"))
    test("refreshes Firefox userScript payloads after a matched-rule location change", async ({
      context,
      debuggerPort,
      extensionOrigin,
      serverUrl,
    }) => {
      test.slow();
      await runFirefoxRuntimePhase("warm up spoofing", async () => {
        await warmUpFirefoxSpoofing(context, serverUrl);
      });
      const page = await runFirefoxRuntimePhase(
        "prepare host page and debug mode",
        async () => {
          const preparedPage = await prepareFirefoxHostPage(context);
          await gotoFirefoxHostUrl(preparedPage, serverUrl);
          await waitForFxBridge(preparedPage);

          const saveSettingsResult =
            await requestFxSettingsBridge<SaveSettingsResponse>(
              preparedPage,
              FXT_BRIDGE_EVENTS.saveSimpleSettings,
              FXT_BRIDGE_EVENTS.saveSimpleSettingsResult,
              {
                debugMode: true,
              },
            );
          expect(saveSettingsResult.ok).toBe(true);
          if (!saveSettingsResult.ok) {
            throw new Error(saveSettingsResult.error);
          }

          await clearFirefoxBridgeLogs(preparedPage);
          return preparedPage;
        },
      );

      const remoteFirefox = await runFirefoxRuntimePhase(
        "connect remote Firefox debugger",
        async () => connectRemoteFirefox(debuggerPort),
      );
      const remoteTrap = withRemoteFxEvalTrap(remoteFirefox);
      let popupPage: Page | null = null;

      try {
        await runFirefoxRuntimePhase("grant popup userScripts permission", async () => {
          let popupHandle = await openFirefoxPopupPage(context, extensionOrigin);
          popupPage = popupHandle.page;
          // Wait until the popup has finished its one-time document.title set
          // (popup.tsx assigns BRAND_DISPLAY_NAME at module load). Probing before
          // that races: the probe stamps the tab title and the popup then clobbers
          // it, so the title poll never sees the probe prefix.
          let popupTab = await waitForRemoteFxPopup(
            remoteFirefox,
            popupHandle.urlFragment,
          );
          let popupConsoleActor = await getRemoteFxConsoleActor(
            remoteFirefox,
            popupTab.actor,
          );

          await clearFxUserScriptsPerm(
            remoteFirefox,
            popupConsoleActor,
            popupHandle.urlFragment,
          );

          await popupPage.close();
          popupHandle = await openFirefoxPopupPage(context, extensionOrigin);
          popupPage = popupHandle.page;
          popupTab = await waitForRemoteFxPopup(remoteFirefox, popupHandle.urlFragment);
          popupConsoleActor = await getRemoteFxConsoleActor(
            remoteFirefox,
            popupTab.actor,
          );

          expect(
            await readFxUserScriptsPerm(
              remoteFirefox,
              popupConsoleActor,
              popupHandle.urlFragment,
            ),
          ).toBe(false);

          const popupButtonRect = await installFxPermButton(
            remoteFirefox,
            popupConsoleActor,
            popupHandle.urlFragment,
          );
          await popupPage.bringToFront();
          await popupPage.mouse.click(
            popupButtonRect.left + popupButtonRect.width / 2,
            popupButtonRect.top + popupButtonRect.height / 2,
          );

          await expect
            .poll(
              () => readFxPermWithFreshActor(remoteFirefox, popupHandle.urlFragment),
              { timeout: 15_000, intervals: [100, 250, 500] },
            )
            .toBe(true);
          await expect
            .poll(
              () =>
                readFxPermRequestResult(
                  remoteFirefox,
                  popupConsoleActor,
                  popupHandle.urlFragment,
                ),
              { timeout: 15_000, intervals: [100, 250, 500] },
            )
            .toBe("granted");

          await waitForFxHostBasePage(page, serverUrl);
        });

        await runFirefoxRuntimePhase(
          "verify initial seeded navigation snapshot",
          async () => {
            await gotoFirefoxHostUrl(page, `${serverUrl}/time-locale-race`);
            const initialSnapshot = await waitForInitialLocale(
              page,
              {
                initialHash: "",
                initialLanguage: "pl",
                initialTimeZone: "Europe/Warsaw",
              },
              { allowReload: true },
            );
            expect(initialSnapshot.initialHash).toBe("");
            expect(initialSnapshot.initialLanguage).toBe("pl");
            expect(initialSnapshot.initialTimeZone).toBe("Europe/Warsaw");
          },
        );

        await runFirefoxRuntimePhase(
          "assign matched location and refresh payload",
          async () => {
            const settings = await requestFxSettingsBridge<
              GetSettingsResponse | FxSettingsBridgeError
            >(
              page,
              FXT_BRIDGE_EVENTS.getSettings,
              FXT_BRIDGE_EVENTS.getSettingsResult,
              null,
            );
            expect(settings.ok).toBe(true);
            if (!settings.ok) {
              throw new Error(settings.error);
            }

            const ottawa = settings.locations.find(
              (location) => location.label === "Ottawa",
            );
            expect(ottawa).toBeDefined();
            if (!ottawa) {
              throw new Error("Missing Ottawa profile in test settings.");
            }

            await clearFirefoxBridgeLogs(page);
            const assignReload = armFxExtTriggeredReload(page);
            const assignResult = await requestFxSettingsBridge<
              AssignLocationResponse | FxSettingsBridgeError
            >(
              page,
              FXT_BRIDGE_EVENTS.assignDomainLocation,
              FXT_BRIDGE_EVENTS.assignDomainLocationResult,
              {
                locationId: ottawa.id,
                patternMode: "exact",
              },
            );
            expect(assignResult.ok).toBe(true);
            if (!assignResult.ok) {
              throw new Error(assignResult.error);
            }

            // The decision below is logged while this reload navigates, so the
            // entry is already stored once the reload settles.
            await assignReload;

            await expect
              .poll(
                async () => {
                  const logs = await readFxBridgeLogs(page);
                  return logs.some((entry) => {
                    if (entry.event !== "navigation.firefox-hash-seed-decision") {
                      return false;
                    }

                    const details = entry.details as
                      | {
                          builtRedirect?: unknown;
                        }
                      | undefined;
                    return details?.builtRedirect === true;
                  });
                },
                { timeout: 15_000, intervals: [100, 250, 500] },
              )
              .toBe(true);

            const refreshedSnapshot = await waitForInitialLocale(page, {
              initialHash: "",
              initialLanguage: "en-CA",
              initialTimeZone: "America/Toronto",
              initialTimezoneOffset: 240,
            });
            expect(refreshedSnapshot.initialHash).toBe("");
            expect(refreshedSnapshot.initialLanguage).toBe("en-CA");
            expect(refreshedSnapshot.initialTimeZone).toBe("America/Toronto");
            expect(refreshedSnapshot.initialTimezoneOffset).toBe(240);
          },
        );

        await runFirefoxRuntimePhase(
          "verify reload after location refresh",
          async () => {
            await clearFirefoxBridgeLogs(page);
            await reloadFirefoxHostPage(page);
            await waitForFxBridge(page);
            await waitForTimeLocaleRace(page);

            const reloadedSnapshot = await readInitialLocaleState(page);
            expect(reloadedSnapshot.initialHash).toBe("");
            expect(reloadedSnapshot.initialLanguage).toBe("en-CA");
            expect(reloadedSnapshot.initialTimeZone).toBe("America/Toronto");
            expect(reloadedSnapshot.initialTimezoneOffset).toBe(240);
          },
        );

        remoteTrap.assertNoUnexpectedErrors();
      } finally {
        await popupPage?.close().catch(() => undefined);
        remoteTrap.dispose();
        remoteFirefox.disconnect();
      }
    });

  if (includeTransportScope("state-ops"))
    test("round-trips Firefox container writes with Privacy Thing assignments", async ({
      context,
      debuggerPort,
      extensionOrigin,
    }) => {
      // Drive both container APIs and settings reads/writes through the popup's
      // Firefox remote debugging context. Avoid the host-page content bridge here:
      // content-script reinjection during settings writes made this test
      // timing-sensitive on loaded CI runners.
      test.slow();
      const createdName = "Privacy Thing Personal";
      const updatedName = "Privacy Thing Travel";
      const remoteFirefox = await connectRemoteFirefox(debuggerPort);
      const remoteTrap = withRemoteFxEvalTrap(remoteFirefox);
      let popupPage: Page | null = null;

      try {
        const popupHandle = await openFirefoxPopupPage(context, extensionOrigin);
        popupPage = popupHandle.page;
        const popupUrlFragment = popupHandle.urlFragment;
        const popupTab = await waitForRemoteFxPopup(remoteFirefox, popupUrlFragment);
        const popupConsoleActor = await getRemoteFxConsoleActor(
          remoteFirefox,
          popupTab.actor,
        );

        const runPopupJson = async <T>(
          expression: string,
          label: string,
          timeoutMs = 15_000,
        ): Promise<T> =>
          probeRemoteFxTabJson<T>(
            remoteFirefox,
            popupConsoleActor,
            popupUrlFragment,
            expression,
            label,
            timeoutMs,
            popupTab.actor,
          );

        const settings = await runPopupJson<
          GetSettingsResponse | FxSettingsBridgeError
        >(
          `chrome.runtime.sendMessage({ type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.getSettings)} })`,
          "settings-read",
        );
        expect(settings.ok).toBe(true);
        if (!settings.ok) {
          throw new Error(settings.error);
        }

        const primaryLocation = settings.locations[0] ?? {
          id: "firefox-container-test-location",
          label: "Container Test Location",
          latitude: 45.4215,
          longitude: -75.6972,
          accuracy: 25,
          noiseRadius: 50,
          language: "en-CA",
          languages: ["en-CA", "en"],
          timeZone: "America/Toronto",
        };
        const normalizedLocations =
          settings.locations.length > 0 ? settings.locations : [primaryLocation];

        const saveSimpleSettingsResult = await runPopupJson<
          SaveSettingsResponse | FxSettingsBridgeError
        >(
          `chrome.runtime.sendMessage({
        type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.saveSimpleSettings)},
        onboardingCompleted: true
      })`,
          "settings-save-simple",
        );
        expect(saveSimpleSettingsResult.ok).toBe(true);
        if (!saveSimpleSettingsResult.ok) {
          throw new Error(saveSimpleSettingsResult.error);
        }

        const resetModelResult = await runPopupJson<
          SaveLocationResponse | FxSettingsBridgeError
        >(
          `chrome.runtime.sendMessage({
        type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.saveLocationModel)},
        locations: ${JSON.stringify(normalizedLocations)},
        rules: ${JSON.stringify(settings.rules)},
        containerAssignments: []
      })`,
          "settings-reset-model",
        );
        expect(resetModelResult.ok).toBe(true);
        if (!resetModelResult.ok) {
          throw new Error(resetModelResult.error);
        }

        const createResult = await runPopupJson<{
          cookieStoreId: string;
          name: string;
          color: string | null;
          icon: string | null;
        }>(
          `(async () => {
        const created = await browser.contextualIdentities.create({
          name: ${JSON.stringify(createdName)},
          color: "purple",
          icon: "gift"
        });
        const settings = await chrome.runtime.sendMessage({ type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.getSettings)} });
        if (!settings?.ok) {
          throw new Error(settings?.error ?? "Failed to read settings.");
        }
        const saveResult = await chrome.runtime.sendMessage({
          type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.saveLocationModel)},
          locations: settings.locations,
          rules: settings.rules,
          containerAssignments: [{
            cookieStoreId: created.cookieStoreId,
            locationId: ${JSON.stringify(primaryLocation.id)}
          }]
        });
        if (!saveResult?.ok) {
          throw new Error(saveResult?.error ?? "Failed to save container assignment.");
        }
        return {
          cookieStoreId: created.cookieStoreId,
          name: created.name,
          color: created.color ?? null,
          icon: created.icon ?? null
        };
      })()`,
          "container-create",
        );
        expect(createResult).toMatchObject({
          name: createdName,
          color: "purple",
          icon: "gift",
        });

        await expect
          .poll(
            async () => {
              const refreshedSettings = await runPopupJson<
                GetSettingsResponse | FxSettingsBridgeError
              >(
                `chrome.runtime.sendMessage({ type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.getSettings)} })`,
                "settings-read-after-create",
              );
              if (!refreshedSettings.ok) {
                throw new Error(refreshedSettings.error);
              }
              return refreshedSettings.containerAssignments?.find(
                (assignment) => assignment.cookieStoreId === createResult.cookieStoreId,
              )?.locationId;
            },
            { timeout: 45_000, intervals: [50, 100, 250] },
          )
          .toBe(primaryLocation.id);

        const updatedResult = await runPopupJson<{
          cookieStoreId: string;
          name: string;
          color: string | null;
          icon: string | null;
        }>(
          `(async () => {
        const updated = await browser.contextualIdentities.update(
          ${JSON.stringify(createResult.cookieStoreId)},
          {
            name: ${JSON.stringify(updatedName)},
            color: "turquoise",
            icon: "vacation"
          }
        );
        const settings = await chrome.runtime.sendMessage({ type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.getSettings)} });
        if (!settings?.ok) {
          throw new Error(settings?.error ?? "Failed to read settings.");
        }
        const saveResult = await chrome.runtime.sendMessage({
          type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.saveLocationModel)},
          locations: settings.locations,
          rules: settings.rules,
          containerAssignments: []
        });
        if (!saveResult?.ok) {
          throw new Error(saveResult?.error ?? "Failed to clear container assignment.");
        }
        return {
          cookieStoreId: updated.cookieStoreId,
          name: updated.name,
          color: updated.color ?? null,
          icon: updated.icon ?? null
        };
      })()`,
          "container-update",
        );
        expect(updatedResult).toMatchObject({
          cookieStoreId: createResult.cookieStoreId,
          name: updatedName,
          color: "turquoise",
          icon: "vacation",
        });

        await expect
          .poll(
            async () => {
              const refreshedSettings = await runPopupJson<
                GetSettingsResponse | FxSettingsBridgeError
              >(
                `chrome.runtime.sendMessage({ type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.getSettings)} })`,
                "settings-read-after-clear",
              );
              if (!refreshedSettings.ok) {
                throw new Error(refreshedSettings.error);
              }
              return (
                refreshedSettings.containerAssignments?.some(
                  (assignment) =>
                    assignment.cookieStoreId === createResult.cookieStoreId,
                ) ?? false
              );
            },
            { timeout: 45_000, intervals: [50, 100, 250] },
          )
          .toBe(false);

        const reassignResult = await runPopupJson<{ ok?: boolean; error?: string }>(
          `(async () => {
        const settings = await chrome.runtime.sendMessage({ type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.getSettings)} });
        if (!settings?.ok) {
          throw new Error(settings?.error ?? "Failed to read settings.");
        }
        return chrome.runtime.sendMessage({
          type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.saveLocationModel)},
          locations: settings.locations,
          rules: settings.rules,
          containerAssignments: [{
            cookieStoreId: ${JSON.stringify(createResult.cookieStoreId)},
            locationId: ${JSON.stringify(primaryLocation.id)}
          }]
        });
      })()`,
          "container-reassign",
        );
        expect(reassignResult.ok).toBe(true);

        const deleteResult = await runPopupJson<{ stillExists: boolean }>(
          `(async () => {
        const settings = await chrome.runtime.sendMessage({ type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.getSettings)} });
        if (!settings?.ok) {
          throw new Error(settings?.error ?? "Failed to read settings.");
        }
        const saveResult = await chrome.runtime.sendMessage({
          type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.saveLocationModel)},
          locations: settings.locations,
          rules: settings.rules,
          containerAssignments: (settings.containerAssignments ?? []).filter(
            (assignment) => assignment.cookieStoreId !== ${JSON.stringify(createResult.cookieStoreId)}
          )
        });
        if (!saveResult?.ok) {
          throw new Error(
            saveResult?.error ?? "Failed to clear container assignment before delete."
          );
        }
        await browser.contextualIdentities.remove(${JSON.stringify(createResult.cookieStoreId)});
        const remaining = await browser.contextualIdentities.query({});
        return {
          stillExists: remaining.some(
            (identity) => identity.cookieStoreId === ${JSON.stringify(createResult.cookieStoreId)}
          )
        };
      })()`,
          "container-delete",
        );
        expect(deleteResult.stillExists).toBe(false);

        await expect
          .poll(
            async () => {
              const refreshedSettings = await runPopupJson<
                GetSettingsResponse | FxSettingsBridgeError
              >(
                `chrome.runtime.sendMessage({ type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.getSettings)} })`,
                "settings-read-after-delete",
              );
              if (!refreshedSettings.ok) {
                throw new Error(refreshedSettings.error);
              }
              return (
                refreshedSettings.containerAssignments?.some(
                  (assignment) =>
                    assignment.cookieStoreId === createResult.cookieStoreId,
                ) ?? false
              );
            },
            { timeout: 45_000, intervals: [50, 100, 250] },
          )
          .toBe(false);

        remoteTrap.assertNoUnexpectedErrors();
      } finally {
        await popupPage?.close().catch(() => undefined);
        remoteTrap.dispose();
        remoteFirefox.disconnect();
      }
    });

  if (includeTransportScope("state-ops"))
    test("cleanup-domain-state rotates the fallback seed and clears state across unmatched Firefox hosts", async ({
      context,
      debuggerPort,
      extensionOrigin,
      serverUrl,
    }) => {
      test.slow();
      const unmatchedServerUrl = serverUrl.replace("127.0.0.1", "localhost");
      await warmUpFirefoxSpoofing(context, serverUrl);
      const hostPage = await prepareFirefoxHostPage(context);
      await gotoFirefoxHostUrl(hostPage, serverUrl);
      await waitForFxBridge(hostPage);

      const remoteFirefox = await connectRemoteFirefox(debuggerPort);
      const remoteTrap = withRemoteFxEvalTrap(remoteFirefox);

      try {
        const settings = await runFxPopupRuntimeJson<
          GetSettingsResponse | FxSettingsBridgeError
        >(
          context,
          extensionOrigin,
          remoteFirefox,
          `chrome.runtime.sendMessage({
        type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.getSettings)}
      })`,
          "settings-read-state-ops",
        );
        expect(settings.ok).toBe(true);
        if (!settings.ok) {
          throw new Error(settings.error);
        }
        const warsawLocation = settings.locations.find(
          (location) => location.label === "Warsaw",
        );
        if (!warsawLocation) {
          throw new Error(
            'Expected "Warsaw" location to exist in Firefox runtime settings.',
          );
        }

        const saveSimpleSettingsResult = await runFxPopupRuntimeJson<
          SaveSettingsResponse | FxSettingsBridgeError
        >(
          context,
          extensionOrigin,
          remoteFirefox,
          `chrome.runtime.sendMessage({
        type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.saveSimpleSettings)},
        globalFallbackRule: {
          enabled: true,
          locationId: ${JSON.stringify(warsawLocation.id)}
        }
      })`,
          "settings-save-fallback-rule",
        );
        expect(saveSimpleSettingsResult.ok).toBe(true);
        if (!saveSimpleSettingsResult.ok) {
          throw new Error(saveSimpleSettingsResult.error);
        }

        const resetModelResult = await runFxPopupRuntimeJson<
          SaveLocationResponse | FxSettingsBridgeError
        >(
          context,
          extensionOrigin,
          remoteFirefox,
          `chrome.runtime.sendMessage({
        type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.saveLocationModel)},
        locations: ${JSON.stringify(settings.locations)},
        rules: [],
        containerAssignments: ${JSON.stringify(settings.containerAssignments ?? [])}
      })`,
          "settings-reset-state-ops-model",
        );
        expect(resetModelResult.ok).toBe(true);
        if (!resetModelResult.ok) {
          throw new Error(resetModelResult.error);
        }

        const previousFallbackSeedKey = await readFxFallbackSeedKey(hostPage);
        expect(previousFallbackSeedKey).toMatch(/^[a-z0-9]{6}$/);

        const unmatchedPage = await context.newPage();
        await gotoFirefoxHostUrl(unmatchedPage, unmatchedServerUrl);
        await seedFirefoxHostState(hostPage);
        await seedFirefoxHostState(unmatchedPage);

        const primarySeededState = await readFirefoxHostState(hostPage);
        expect(primarySeededState.cookie).toContain(TEST_COOKIE_FRAGMENT);
        expect(primarySeededState.localStorage).toBe("present");
        expect(primarySeededState.sessionStorage).toBe("present");

        const unmatchedSeededState = await readFirefoxHostState(unmatchedPage);
        expect(unmatchedSeededState.cookie).toContain(TEST_COOKIE_FRAGMENT);
        expect(unmatchedSeededState.localStorage).toBe("present");
        expect(unmatchedSeededState.sessionStorage).toBe("present");

        const cleanupResult = await runFxPopupRuntimeJson<
          CleanupDomainResponse | FxSettingsBridgeError
        >(
          context,
          extensionOrigin,
          remoteFirefox,
          `(async () => chrome.runtime.sendMessage({
        type: ${JSON.stringify(EXTENSION_COMMAND_TYPES.cleanupDomainState)},
        hostname: "127.0.0.1"
      }))()`,
          "cleanup-domain-state",
          15_000,
        );
        expect(cleanupResult.ok).toBe(true);
        if (!cleanupResult.ok) {
          throw new Error(cleanupResult.error);
        }

        const cleanedOrigins = new Set(cleanupResult.cleanedOrigins ?? []);
        expect(
          [...cleanedOrigins].some((origin) => origin.includes("//127.0.0.1")),
        ).toBe(true);
        expect(
          [...cleanedOrigins].some((origin) => origin.includes("//localhost")),
        ).toBe(true);

        await gotoFirefoxHostUrl(hostPage, serverUrl);
        await waitForFxBridge(hostPage);

        const nextFallbackSeedKey = await readFxFallbackSeedKey(hostPage);
        expect(nextFallbackSeedKey).toBe(previousFallbackSeedKey);

        await gotoFirefoxHostUrl(hostPage, serverUrl);
        const primaryCleanedState = await readFirefoxHostState(hostPage);
        expect(primaryCleanedState.cookie).not.toContain(TEST_COOKIE_FRAGMENT);
        expect(primaryCleanedState.localStorage).toBeNull();
        expect(primaryCleanedState.sessionStorage).toBeNull();

        await gotoFirefoxHostUrl(unmatchedPage, unmatchedServerUrl);
        const unmatchedCleanedState = await readFirefoxHostState(unmatchedPage);
        expect(unmatchedCleanedState.cookie).not.toContain(TEST_COOKIE_FRAGMENT);
        expect(unmatchedCleanedState.localStorage).toBeNull();
        expect(unmatchedCleanedState.sessionStorage).toBeNull();

        expect(previousFallbackSeedKey).toMatch(/^[a-z0-9]{6}$/);
        expect(nextFallbackSeedKey).toMatch(/^[a-z0-9]{6}$/);
        remoteTrap.assertNoUnexpectedErrors();
      } finally {
        remoteTrap.dispose();
        remoteFirefox.disconnect();
      }
    });

  if (includeTransportScope("state-ops"))
    test("Firefox DNR Set-Cookie reaches first inline document.cookie", async ({
      context,
      serverUrl,
    }) => {
      const page = await prepareFirefoxHostPage(context);
      const hostname = new URL(serverUrl).hostname;
      const cookieName = "pt_dnr_probe";
      const cookieValue = "first-inline";
      const encodedCookieValue = encodeURIComponent(cookieValue);

      await gotoFirefoxHostUrl(page, serverUrl);
      await waitForFxBridge(page);

      try {
        await configureFxResultCookie(page, {
          hostname,
          cookieName,
          cookieValue,
        });

        await gotoFirefoxHostUrl(page, `${serverUrl}/cookie-race`);
        await waitForFxBridge(page);
        await waitForCookieRace(page);

        const snapshot = await readCookieRaceSnapshot(page);
        expect(snapshot.initialCookie).toContain(`${cookieName}=${encodedCookieValue}`);
        expect(snapshot.laterCookie).toContain(`${cookieName}=${encodedCookieValue}`);
      } finally {
        if (!page.isClosed()) {
          await waitForFxBridge(page);
          await configureFxResultCookie(page, {
            hostname,
            cookieName,
            cookieValue: null,
          });
        }
      }
    });

  if (includeTransportScope("state-ops"))
    test("records Firefox bootstrap lifecycle heartbeats without debug mode", async ({
      context,
      serverUrl,
    }) => {
      const page = await prepareFirefoxHostPage(context);
      await gotoFirefoxHostUrl(page, serverUrl);
      await waitForFxBridge(page);
      await clearFirefoxBridgeLogs(page);

      // Navigate without debug mode to confirm heartbeats flow unconditionally.
      await gotoFirefoxHostUrl(page, `${serverUrl}/time-locale-race`);
      await waitForFxBridge(page);

      await expect
        .poll(
          async () => {
            const logs = await readFxBridgeLogs(page);
            return logs.some((e) => e.event === "FirefoxBootstrap.shim-installed");
          },
          { timeout: 15_000, intervals: [100, 250, 500] },
        )
        .toBe(true);

      const logs = await readFirefoxBridgeLogs(page);
      const hasSourceDiagnosis =
        logs.some((e) => e.event === "FirefoxBootstrap.early-source-present") ||
        logs.some((e) => e.event === "FirefoxBootstrap.no-early-source");
      expect(hasSourceDiagnosis).toBe(true);
      expect(logs.some((e) => e.event === "FirefoxBootstrap.state-applied")).toBe(true);

      const stateLog = logs.find((e) => e.event === "FirefoxBootstrap.state-applied");
      const stateDetails = stateLog?.details as
        { result?: Record<string, unknown> } | undefined;
      expect(stateDetails?.result).toBeDefined();
      expect(["ready", "absent"]).toContain(stateDetails?.result?.geoStatus);
    });
};

const liveFirefoxReproEnabled = process.env.PT_LIVE_FIREFOX_REPRO === "1";
const liveFirefoxReproHost = process.env.PT_FIREFOX_RUNTIME_TEST_HOST?.trim() ?? "";
const liveFxReproLocId = process.env.PT_API_CONFORMANCE_LOCATION_ID?.trim() ?? "";
export const registerFxEdgeTests = () => {
  test.describe.configure({ timeout: 120_000 });

  test("captures the live Firefox CreepJS Ottawa runtime", async ({ context }) => {
    test.slow();
    test.skip(
      !liveFirefoxReproEnabled ||
        liveFirefoxReproHost !== "abrahamjuliot.github.io" ||
        liveFxReproLocId !== "ottawa",
      "Build Firefox with PT_FIREFOX_RUNTIME_TEST_HOST=abrahamjuliot.github.io and PT_API_CONFORMANCE_LOCATION_ID=ottawa before running the live repro.",
    );
    const outputDir = path.resolve(
      process.cwd(),
      "build",
      "playwright",
      "firefox-creepjs-live",
    );
    await mkdir(outputDir, { recursive: true });

    const page = await prepareFirefoxHostPage(context);
    const runtimeSnapshot = await readLiveFxCreepState(page);

    await page.screenshot({
      path: path.join(outputDir, "creepjs-ottawa-firefox.png"),
      fullPage: true,
    });
    await writeFile(
      path.join(outputDir, "creepjs-ottawa-firefox.runtime.json"),
      JSON.stringify(runtimeSnapshot, null, 2),
      "utf8",
    );

    console.log("LIVE_FIREFOX_CREEPJS", JSON.stringify(runtimeSnapshot, null, 2));
    expectFxOttawaRuntime(runtimeSnapshot);
  });

  test("records live Firefox CreepJS bootstrap heartbeats", async ({ context }) => {
    test.slow();
    test.skip(
      !liveFirefoxReproEnabled ||
        liveFirefoxReproHost !== "abrahamjuliot.github.io" ||
        liveFxReproLocId !== "ottawa",
      "Build Firefox with PT_FIREFOX_RUNTIME_TEST_HOST=abrahamjuliot.github.io and PT_API_CONFORMANCE_LOCATION_ID=ottawa before running the live repro.",
    );

    const page = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(page, "https://abrahamjuliot.github.io/");
    await waitForFxBridge(page);
    await clearFirefoxBridgeLogs(page);

    await gotoFirefoxHostUrl(page, "https://abrahamjuliot.github.io/creepjs/");
    await waitForFxBridge(page);

    await expect
      .poll(
        async () => {
          const logs = await readFxBridgeLogs(page);
          return logs.some(
            (entry) => entry.event === "FirefoxBootstrap.shim-installed",
          );
        },
        { timeout: 20_000, intervals: [100, 250, 500] },
      )
      .toBe(true);

    const logs = await readFirefoxBridgeLogs(page);
    console.log(
      "LIVE_FIREFOX_CREEPJS_LOGS",
      JSON.stringify(
        logs.filter((entry) => entry.event.startsWith("FirefoxBootstrap.")),
        null,
        2,
      ),
    );

    const hasSourceDiagnosis =
      logs.some((entry) => entry.event === "FirefoxBootstrap.early-source-present") ||
      logs.some((entry) => entry.event === "FirefoxBootstrap.no-early-source");
    expect(hasSourceDiagnosis).toBe(true);
    expect(logs.some((entry) => entry.event === "FirefoxBootstrap.state-applied")).toBe(
      true,
    );
  });

  test("captures the live Firefox CreepJS Ottawa runtime from a saved rule", async ({
    context,
  }) => {
    test.slow();
    test.skip(
      !liveFirefoxReproEnabled ||
        liveFirefoxReproHost !== "abrahamjuliot.github.io" ||
        liveFxReproLocId !== "",
      "Build Firefox with PT_FIREFOX_RUNTIME_TEST_HOST=abrahamjuliot.github.io and without PT_API_CONFORMANCE_LOCATION_ID to exercise the saved-rule live repro.",
    );

    const outputDir = path.resolve(
      process.cwd(),
      "build",
      "playwright",
      "firefox-creepjs-live-saved-rule",
    );
    await mkdir(outputDir, { recursive: true });

    const page = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(page, "https://abrahamjuliot.github.io/");
    await waitForFxBridge(page);

    const settings = await requestFxSettingsBridge<
      GetSettingsResponse | FxSettingsBridgeError
    >(page, FXT_BRIDGE_EVENTS.getSettings, FXT_BRIDGE_EVENTS.getSettingsResult, null);
    expect(settings.ok).toBe(true);
    if (!settings.ok) {
      throw new Error(settings.error);
    }

    const ottawa = settings.locations.find((location) => location.label === "Ottawa");
    expect(ottawa).toBeDefined();
    if (!ottawa) {
      throw new Error("Missing Ottawa profile in test settings.");
    }

    const saveResult = await requestFxSettingsBridge<SaveLocationResponse>(
      page,
      FXT_BRIDGE_EVENTS.saveLocationModel,
      FXT_BRIDGE_EVENTS.saveLocationModelResult,
      {
        locations: settings.locations,
        rules: buildLiveFxOttawaRuleSet(settings.rules, ottawa.id),
        containerAssignments: settings.containerAssignments ?? [],
      },
    );

    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) {
      throw new Error(saveResult.error);
    }

    const runtimeSnapshot = await readLiveFxCreepState(page);

    await page.screenshot({
      path: path.join(outputDir, "creepjs-ottawa-firefox-saved-rule.png"),
      fullPage: true,
    });
    await writeFile(
      path.join(outputDir, "creepjs-ottawa-firefox-saved-rule.runtime.json"),
      JSON.stringify(runtimeSnapshot, null, 2),
      "utf8",
    );

    console.log(
      "LIVE_FIREFOX_CREEPJS_SAVED_RULE",
      JSON.stringify(runtimeSnapshot, null, 2),
    );
    expectFxOttawaRuntime(runtimeSnapshot);
  });

  test("records live Firefox CreepJS bootstrap heartbeats from a saved rule", async ({
    context,
  }) => {
    test.slow();
    test.skip(
      !liveFirefoxReproEnabled ||
        liveFirefoxReproHost !== "abrahamjuliot.github.io" ||
        liveFxReproLocId !== "",
      "Build Firefox with PT_FIREFOX_RUNTIME_TEST_HOST=abrahamjuliot.github.io and without PT_API_CONFORMANCE_LOCATION_ID to exercise the saved-rule live repro.",
    );

    const page = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(page, "https://abrahamjuliot.github.io/");
    await waitForFxBridge(page);

    const settings = await requestFxSettingsBridge<
      GetSettingsResponse | FxSettingsBridgeError
    >(page, FXT_BRIDGE_EVENTS.getSettings, FXT_BRIDGE_EVENTS.getSettingsResult, null);
    expect(settings.ok).toBe(true);
    if (!settings.ok) {
      throw new Error(settings.error);
    }

    const ottawa = settings.locations.find((location) => location.label === "Ottawa");
    expect(ottawa).toBeDefined();
    if (!ottawa) {
      throw new Error("Missing Ottawa profile in test settings.");
    }

    const saveResult = await requestFxSettingsBridge<SaveLocationResponse>(
      page,
      FXT_BRIDGE_EVENTS.saveLocationModel,
      FXT_BRIDGE_EVENTS.saveLocationModelResult,
      {
        locations: settings.locations,
        rules: buildLiveFxOttawaRuleSet(settings.rules, ottawa.id),
        containerAssignments: settings.containerAssignments ?? [],
      },
    );
    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) {
      throw new Error(saveResult.error);
    }

    await clearFirefoxBridgeLogs(page);
    await gotoFirefoxHostUrl(page, "https://abrahamjuliot.github.io/creepjs/");
    await waitForFxBridge(page);

    await expect
      .poll(
        async () => {
          const logs = await readFxBridgeLogs(page);
          return logs.some(
            (entry) => entry.event === "FirefoxBootstrap.shim-installed",
          );
        },
        { timeout: 20_000, intervals: [100, 250, 500] },
      )
      .toBe(true);

    const logs = await readFirefoxBridgeLogs(page);
    console.log(
      "LIVE_FIREFOX_CREEPJS_SAVED_RULE_LOGS",
      JSON.stringify(
        logs.filter((entry) => entry.event.startsWith("FirefoxBootstrap.")),
        null,
        2,
      ),
    );

    const hasSourceDiagnosis =
      logs.some((entry) => entry.event === "FirefoxBootstrap.early-source-present") ||
      logs.some((entry) => entry.event === "FirefoxBootstrap.no-early-source");
    expect(hasSourceDiagnosis).toBe(true);
    expect(logs.some((entry) => entry.event === "FirefoxBootstrap.state-applied")).toBe(
      true,
    );
  });

  test("preserves original hashes, anchor navigation, and history semantics across the Firefox hash seed redirect", async ({
    context,
    serverUrl,
  }) => {
    await warmUpFirefoxSpoofing(context, serverUrl);
    const unmatchedServerUrl = serverUrl.replace("127.0.0.1", "localhost");
    const page = await prepareFirefoxHostPage(context);
    await page.goto("about:blank", { waitUntil: "domcontentloaded" });
    const matchedHistoryLength = await page.evaluate(() => history.length);
    await gotoFirefoxHostUrl(page, `${serverUrl}/time-locale-race#hash-target`);
    await waitForTimeLocaleRace(page);

    const initialSnapshot = await readInitialLocaleState(page);
    expect(initialSnapshot.initialHash).toBe("#hash-target");
    const navigatedSnapshot = await readLocaleHashNavState(page);
    expect(navigatedSnapshot.hash).toBe("#hash-target");
    expect(navigatedSnapshot.hashchangeCount).not.toBeNull();
    expect(navigatedSnapshot.scrollY).toBeGreaterThan(0);
    expect(navigatedSnapshot.anchorInViewport).toBe(true);

    await reloadFirefoxHostPage(page);
    await waitForTimeLocaleRace(page);

    const reloadedInitialSnapshot = await readInitialLocaleState(page);
    expect(reloadedInitialSnapshot.initialHash).toBe("#hash-target");
    const reloadedSnapshot = await readLocaleHashNavState(page);
    expect(reloadedSnapshot.hash).toBe("#hash-target");
    expect(reloadedSnapshot.hashchangeCount).not.toBeNull();
    expect(reloadedSnapshot.scrollY).toBeGreaterThan(0);
    expect(reloadedSnapshot.anchorInViewport).toBe(true);

    const unmatchedPage = await context.newPage();
    await unmatchedPage.goto("about:blank", { waitUntil: "domcontentloaded" });
    const unmatchedHistoryLength = await unmatchedPage.evaluate(() => history.length);
    await gotoFirefoxHostUrl(
      unmatchedPage,
      `${unmatchedServerUrl}/time-locale-race#hash-target`,
    );
    await waitForTimeLocaleRace(unmatchedPage);

    const unmatchedInitialSnapshot = await readInitialLocaleState(unmatchedPage);
    expect(unmatchedInitialSnapshot.initialHash).toBe("#hash-target");
    const unmatchedNavState = await readLocaleHashNavState(unmatchedPage);

    await reloadFirefoxHostPage(unmatchedPage);
    await waitForTimeLocaleRace(unmatchedPage);

    const unmatchedReloadInitial = await readInitialLocaleState(unmatchedPage);
    expect(unmatchedReloadInitial.initialHash).toBe("#hash-target");
    const unmatchedReloadState = await readLocaleHashNavState(unmatchedPage);

    expect((navigatedSnapshot.historyLength ?? 0) - matchedHistoryLength).toBe(
      (unmatchedNavState.historyLength ?? 0) - unmatchedHistoryLength,
    );
    expect(navigatedSnapshot.hashchangeCount).toBe(unmatchedNavState.hashchangeCount);
    expect(navigatedSnapshot.anchorInViewport).toBe(unmatchedNavState.anchorInViewport);

    expect(
      (reloadedSnapshot.historyLength ?? 0) - (navigatedSnapshot.historyLength ?? 0),
    ).toBe(
      (unmatchedReloadState.historyLength ?? 0) -
        (unmatchedNavState.historyLength ?? 0),
    );
    expect(reloadedSnapshot.hashchangeCount).toBe(unmatchedReloadState.hashchangeCount);
    expect(reloadedSnapshot.anchorInViewport).toBe(
      unmatchedReloadState.anchorInViewport,
    );
  });

  test("does not restart matched-host POST navigations as GET requests", async ({
    context,
    serverUrl,
  }) => {
    await warmUpFirefoxSpoofing(context, serverUrl);
    const page = await prepareFirefoxHostPage(context);
    await gotoFirefoxHostUrl(page, `${serverUrl}/method-preserving-post`);
    await page.locator("#post-form button[type='submit']").click();

    const snapshot = await readPostMethodSnapshot(page);
    expect(snapshot.requestMethod).toBe("POST");
    expect(snapshot.initialHash).toBe("#posted");
  });
};
