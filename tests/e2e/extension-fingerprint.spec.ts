import path from "node:path";

import type { BrowserContext, Page } from "@playwright/test";

import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";
import { appleHardwareCatalog } from "../../src/shared/hardware-profiles.apple.generated";
import { steamHardwareCatalog } from "../../src/shared/hardware-profiles.steam.generated";

import {
  assignDomainProfile,
  importSettings,
  readRuleSeedKey,
  readFingerprintSnapshot,
  readWorkerSnapshot,
} from "./extension-test.helpers";
import { expect, test } from "./fixtures";

// ---------------------------------------------------------------------------
// Valid screen presets from the simple-engine hardware catalogs plus the legacy
// fallback list in fingerprint-spoofing.ts.
// ---------------------------------------------------------------------------

const LEGACY_SCREEN_PRESETS = [
  { width: 1920, height: 1080, colorDepth: 24, devicePixelRatio: 1 },
  { width: 2560, height: 1440, colorDepth: 24, devicePixelRatio: 1 },
  { width: 1366, height: 768, colorDepth: 24, devicePixelRatio: 1 },
  { width: 1536, height: 864, colorDepth: 24, devicePixelRatio: 1.25 },
  { width: 1440, height: 900, colorDepth: 24, devicePixelRatio: 2 },
  { width: 1680, height: 1050, colorDepth: 24, devicePixelRatio: 1 },
  { width: 1920, height: 1200, colorDepth: 24, devicePixelRatio: 1 },
  { width: 3840, height: 2160, colorDepth: 24, devicePixelRatio: 2 },
];

const STEAM_SCREEN_PRESETS = Object.values(steamHardwareCatalog).flatMap((profile) =>
  profile.resolutions.map(({ value }) => ({
    width: value.width,
    height: value.height,
    colorDepth: 24,
    devicePixelRatio: 1,
  })),
);

const APPLE_SCREEN_PRESETS = appleHardwareCatalog.devices.map(({ value }) => ({
  width: value.screen.width,
  height: value.screen.height,
  colorDepth: value.screen.colorDepth,
  devicePixelRatio: value.screen.devicePixelRatio,
}));

const SIMPLE_SCREEN_PRESETS = [
  ...LEGACY_SCREEN_PRESETS,
  ...STEAM_SCREEN_PRESETS,
  ...APPLE_SCREEN_PRESETS,
];

const SIMPLE_RULE_SEED_KEY = "fpseed";
const VALID_MEMORY_VALUES = [0.25, 0.5, 1, 2, 4, 8];
// ---------------------------------------------------------------------------
// Settings payload factories
// ---------------------------------------------------------------------------

const makeSimpleSettings = (serverUrl: string) => ({
  version: 2 as const,
  exportedAt: new Date().toISOString(),
  locations: [
    {
      id: "fp-test-loc",
      label: "FP Test Location",
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 100,
      noiseRadius: 50,
      language: "en-US",
      languages: ["en-US"],
      timeZone: "America/New_York",
    },
  ],
  rules: [
    {
      pattern: new URL(serverUrl).hostname,
      locationId: "fp-test-loc",
      enabled: true,
      ruleSeedKey: SIMPLE_RULE_SEED_KEY,
    },
  ],
  browserFingerprintSpoofingEnabled: true,
  sharedSpoofing: {
    canvas: true,
    webGL: true,
    audio: true,
    screen: true,
    battery: true,
    webRTC: true,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const waitForSpoofedLocale = async (
  page: Parameters<typeof collectFingerprint>[0],
  primaryLocation: {
    language: string;
    languages: string[];
    timeZone: string;
  },
) => {
  await expect
    .poll(async () => {
      try {
        return await page.evaluate(() => ({
          language: navigator.language,
          languages: [...navigator.languages],
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }));
      } catch {
        // Tolerate a transient "execution context destroyed" while the page is
        // still navigating (e.g. right after a new-identity reload).
        return null;
      }
    })
    .toEqual({
      language: primaryLocation.language,
      languages: primaryLocation.languages,
      timeZone: primaryLocation.timeZone,
    });
};

type FingerprintSnapshot = Awaited<ReturnType<typeof readFingerprintSnapshot>>;
type AudioFingerprint = NonNullable<FingerprintSnapshot["audio"]>;
type CreepJsIframeProbeEntry = {
  uaReported: string;
  uaRestored: string;
  appVersionReported: string;
  appVersionRestored: string;
  features: string;
  platform: string;
  language: string;
  languages: string[];
  hardwareConcurrency: number;
  deviceMemory: number | null;
  maxTouchPoints: number;
  vendor: string;
  canvas: string | null;
};
type CreepJsIframeProbe = Record<string, CreepJsIframeProbeEntry | null>;

// "dead" (detached frame read after removal) is intentionally excluded: faithfully
// it resolves to undefined outside CreepJS's concurrent run. Blank-canvas
// consistency for such unreachable realms is guarded by asserting the blank canvas
// reads back native (see the "blank canvas is native" test).
const CREEPJS_OPEN_IFRAME_CTXS = [
  "window",
  "contentWindow",
  "nested",
  "windowIndex",
  "fragment",
  "sameOrigin",
] as const;

const expectAudioFpClose = (
  actual: AudioFingerprint,
  expected: AudioFingerprint,
): void => {
  expect(actual.sampleRate).toBe(expected.sampleRate);
  expect(actual.channelDataLength).toBe(expected.channelDataLength);
  expect(actual.channelDataSample).toHaveLength(expected.channelDataSample.length);

  for (const [index, value] of actual.channelDataSample.entries()) {
    expect(value).toBeCloseTo(expected.channelDataSample[index] ?? 0, 3);
  }
};

const importFpTestSettings = async (
  context: BrowserContext,
  extensionId: string,
  settings: Parameters<typeof importSettings>[1],
) => {
  const setupPage = await context.newPage();
  await setupPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await importSettings(setupPage, settings);
  await setupPage.close();
};

const prepareSpoofedPageState = async (
  context: BrowserContext,
  extensionId: string,
  settings: Parameters<typeof importSettings>[1],
) => {
  await importFpTestSettings(context, extensionId, settings);
};

const getFingerprintHostUrl = (serverUrl: string): string =>
  new URL("/__test/host", serverUrl).toString();

const readBatteryXRayCount = (
  extensionPage: Page,
  targetUrl: string,
): Promise<number | null> =>
  extensionPage.evaluate(
    async ({ commandType, pageUrl }) => {
      const tabs = await chrome.tabs.query({});
      const targetTab = tabs.find((tab) => tab.url === pageUrl);
      if (targetTab?.id === undefined) return null;
      const response = (await chrome.runtime.sendMessage({
        type: commandType,
        tabId: targetTab.id,
      })) as {
        methodCounts?: { "battery.getBattery"?: number };
      };
      return response.methodCounts?.["battery.getBattery"] ?? 0;
    },
    {
      commandType: EXTENSION_COMMAND_TYPES.getXRayState,
      pageUrl: targetUrl,
    },
  );

const openSpoofedPage = async (
  context: BrowserContext,
  serverUrl: string,
  primaryLocation: {
    language: string;
    languages: string[];
    timeZone: string;
  },
) => {
  const page = await context.newPage();
  await page.goto(getFingerprintHostUrl(serverUrl));
  await page.reload();
  await waitForSpoofedLocale(page, primaryLocation);
  return page;
};

/**
 * Import settings and assign the profile via popup, then return a fresh page
 * ready for fingerprint collection.
 */
const setupSpoofedPage = async (
  context: BrowserContext,
  extensionId: string,
  serverUrl: string,
  settings: Parameters<typeof importSettings>[1],
) => {
  const primaryLocation = settings.locations[0];
  if (!primaryLocation) {
    throw new Error("Fingerprint test settings must include at least one location.");
  }

  await prepareSpoofedPageState(context, extensionId, settings);
  return openSpoofedPage(context, serverUrl, primaryLocation);
};

const collectFingerprint = async (
  page: Awaited<ReturnType<typeof setupSpoofedPage>>,
) => {
  await page.locator("#collect-fingerprint").click();
  return readFingerprintSnapshot(page);
};

const collectCreepIframeProbe = async (
  page: Awaited<ReturnType<typeof setupSpoofedPage>>,
): Promise<CreepJsIframeProbe> =>
  page.evaluate(() => {
    const hashMini = (value: unknown): string => {
      const json = JSON.stringify(value);
      let hash = 0x811c9dc5;
      for (let index = 0; index < json.length; index += 1) {
        hash = (Math.imul(31, hash) + json.charCodeAt(index)) | 0;
      }
      return `0000000${(hash >>> 0).toString(16)}`.slice(-8);
    };

    const getWindowFeatureHash = (frameWindow: Window): string => {
      const keys = Object.getOwnPropertyNames(frameWindow);
      return hashMini({
        keys,
        apple: keys.filter((key) => /apple/i.test(key)).length,
        moz: keys.filter((key) => /moz/i.test(key)).length,
        webkit: keys.filter((key) => /webkit/i.test(key)).length,
      });
    };

    // Faithful to CreepJS iframes.js: it reads toDataURL() on a freshly created,
    // UN-drawn (fully transparent, default-size) canvas. This is the case that
    // exposed the bug — RGB-only noise is discarded by premultiplied alpha on a
    // transparent canvas, so the hash never rotated. Do not draw here.
    const getCanvasHash = (frameWindow: Window): string | null => {
      try {
        const canvas = frameWindow.document.createElement("canvas");
        return hashMini(canvas.toDataURL());
      } catch {
        return null;
      }
    };

    const getData = (
      frameWindow: Window | null | undefined,
    ): CreepJsIframeProbeEntry | null => {
      if (!frameWindow) {
        return null;
      }

      try {
        const navigatorSnapshot = frameWindow.navigator as Navigator & {
          deviceMemory?: number;
          userAgent?: string;
          appVersion?: string;
        };
        const uaReported = String(navigatorSnapshot.userAgent);
        const appVersionReported = String(navigatorSnapshot.appVersion);
        const features = getWindowFeatureHash(frameWindow);

        delete navigatorSnapshot.userAgent;
        delete navigatorSnapshot.appVersion;

        return {
          uaReported,
          uaRestored: String(navigatorSnapshot.userAgent),
          appVersionReported,
          appVersionRestored: String(navigatorSnapshot.appVersion),
          features,
          platform: frameWindow.navigator.platform,
          language: frameWindow.navigator.language,
          languages: [...frameWindow.navigator.languages],
          hardwareConcurrency: frameWindow.navigator.hardwareConcurrency,
          deviceMemory:
            typeof navigatorSnapshot.deviceMemory === "number"
              ? navigatorSnapshot.deviceMemory
              : null,
          maxTouchPoints: frameWindow.navigator.maxTouchPoints,
          vendor: frameWindow.navigator.vendor,
          canvas: getCanvasHash(frameWindow),
        };
      } catch {
        return null;
      }
    };

    const withIframe = <T>(callback: (iframe: HTMLIFrameElement) => T): T | null => {
      const iframe = document.createElement("iframe");
      document.body.append(iframe);
      try {
        return callback(iframe);
      } finally {
        iframe.remove();
      }
    };

    const probe: CreepJsIframeProbe = {
      window: getData(window),
      contentWindow: withIframe((iframe) => getData(iframe.contentWindow)),
      nested: withIframe((iframe) => {
        const parentWindow = iframe.contentWindow;
        if (!parentWindow) {
          return null;
        }
        const nestedIframe = parentWindow.document.createElement("iframe");
        parentWindow.document.body.append(nestedIframe);
        try {
          return getData(nestedIframe.contentWindow);
        } finally {
          nestedIframe.remove();
        }
      }),
      windowIndex: (() => {
        const numberOfIframes = window.length;
        const div = document.createElement("div");
        div.style.display = "none";
        document.body.append(div);
        try {
          div.innerHTML = "<iframe></iframe>";
          return getData(window[numberOfIframes]);
        } finally {
          div.remove();
        }
      })(),
      dead: (() => {
        const numberOfIframes = window.length;
        const div = document.createElement("div");
        div.style.display = "none";
        document.body.append(div);
        div.innerHTML = "<iframe></iframe>";
        // Faithful to CreepJS: remove the frame BEFORE reading window[n]. Outside
        // CreepJS's concurrent Promise.all this resolves to undefined (→ null), so
        // 'dead' is not asserted for parity here; blank-canvas consistency for
        // unreachable realms is guarded by the "blank canvas is native" test.
        div.remove();
        return getData(window[numberOfIframes]);
      })(),
      rejectedAbout: (() => {
        const iframe = document.createElement("iframe");
        iframe.src = "about:pt-rejected";
        document.body.append(iframe);
        try {
          return getData(iframe.contentWindow);
        } finally {
          iframe.remove();
        }
      })(),
      fragment: (() => {
        const fragment = new DocumentFragment();
        const iframe = document.createElement("iframe");
        fragment.append(iframe);
        document.body.append(fragment);
        try {
          return getData(iframe.contentWindow);
        } finally {
          iframe.remove();
        }
      })(),
      sameOrigin: (() => {
        const iframe = document.createElement("iframe");
        iframe.src = location.href;
        document.body.append(iframe);
        try {
          return getData(iframe.contentWindow);
        } finally {
          iframe.remove();
        }
      })(),
    };

    return probe;
  });

const expectCreepIframeParity = (
  probe: CreepJsIframeProbe,
  expectedWindow = probe.window,
): void => {
  expect(expectedWindow).not.toBeNull();
  if (!expectedWindow) {
    throw new Error("Expected the top-window iframe probe entry.");
  }

  for (const contextName of CREEPJS_OPEN_IFRAME_CTXS) {
    const context = probe[contextName];
    expect(context, `Expected ${contextName} probe data`).not.toBeNull();
    if (!context) {
      continue;
    }

    expect(context.uaRestored, `${contextName} restored userAgent`).toBe(
      context.uaReported,
    );
    expect(context.appVersionRestored, `${contextName} restored appVersion`).toBe(
      context.appVersionReported,
    );
    expect(context.uaReported, `${contextName} reported userAgent`).toBe(
      expectedWindow.uaReported,
    );
    expect(context.appVersionReported, `${contextName} reported appVersion`).toBe(
      expectedWindow.appVersionReported,
    );
    expect(context.platform, `${contextName} platform`).toBe(expectedWindow.platform);
    expect(context.language, `${contextName} language`).toBe(expectedWindow.language);
    expect(context.languages, `${contextName} languages`).toEqual(
      expectedWindow.languages,
    );
    expect(context.hardwareConcurrency, `${contextName} hardwareConcurrency`).toBe(
      expectedWindow.hardwareConcurrency,
    );
    expect(context.deviceMemory, `${contextName} deviceMemory`).toBe(
      expectedWindow.deviceMemory,
    );
    expect(context.maxTouchPoints, `${contextName} maxTouchPoints`).toBe(
      expectedWindow.maxTouchPoints,
    );
    expect(context.vendor, `${contextName} vendor`).toBe(expectedWindow.vendor);
    expect(context.canvas, `${contextName} canvas`).toBe(expectedWindow.canvas);
  }

  if (probe.rejectedAbout) {
    expect(probe.rejectedAbout.uaRestored).toBe(probe.rejectedAbout.uaReported);
    expect(probe.rejectedAbout.appVersionRestored).toBe(
      probe.rejectedAbout.appVersionReported,
    );
  }
};

/**
 * Collect a baseline fingerprint before any profile is assigned (no spoofing
 * active). The page is opened fresh against the test server so the extension
 * has no matching rule.
 */
const collectBaselineFp = async (context: BrowserContext, serverUrl: string) => {
  const browser = context.browser();
  if (!browser) {
    throw new Error("Browser handle unavailable for baseline fingerprint collection.");
  }

  const baselineContext = await browser.newContext();

  try {
    const page = await baselineContext.newPage();
    await page.goto(getFingerprintHostUrl(serverUrl));
    await page.locator("#collect-fingerprint").click();
    return await readFingerprintSnapshot(page);
  } finally {
    await baselineContext.close();
  }
};

const resetFpTestState = async (context: BrowserContext, extensionId: string) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await importSettings(page, {
    version: 2,
    exportedAt: new Date().toISOString(),
    locations: [],
    rules: [],
    browserFingerprintSpoofingEnabled: true,
    sharedSpoofing: {},
  });
  await page.close();
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("fingerprint surface spoofing", () => {
  test.beforeEach(async ({ context, extensionId }) => {
    await resetFpTestState(context, extensionId);
  });

  test("keeps realm-local fingerprint patches stable across repeated IIFE evaluation", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");
    const page = await context.newPage();
    await page.goto(getFingerprintHostUrl(serverUrl));
    await page.reload();
    const runtimePath = path.resolve(
      process.cwd(),
      "build",
      "chrome",
      "main-world-runtime.js",
    );
    const snapshot = {
      geo: { latitude: 52.2297, longitude: 21.0122, accuracy: 25, noiseRadius: 50 },
      locale: {
        language: "pl",
        languages: ["pl"],
        timeZone: "Europe/Warsaw",
        acceptLanguage: "pl",
      },
      date: { baseEpochMs: Date.now(), offsetMs: 0, timeZone: "Europe/Warsaw" },
      debugMode: false,
      watchPositionDelay: [60, 500],
      fingerprint: {
        canvasNoiseSeed: 42,
        audioNoiseSeed: 43,
        webGL: { readPixelsNoiseSeed: 44, suppressDebugInfo: true },
        spoofingToggles: {
          canvas: true,
          audio: true,
          webGL: true,
          navigator: true,
          screen: true,
          clientHints: true,
          battery: true,
          webRTC: true,
          geolocation: true,
        },
      },
    };
    await page.evaluate(() => {
      const target = globalThis as typeof globalThis & {
        __runtimeIifeAnchors?: Record<string, Function | undefined>;
      };
      target.__runtimeIifeAnchors = {
        canvasGetImageData: CanvasRenderingContext2D.prototype.getImageData,
        canvasToDataURL: HTMLCanvasElement.prototype.toDataURL,
        webGLGetParameter: globalThis.WebGLRenderingContext?.prototype.getParameter,
        webGLReadPixels: globalThis.WebGLRenderingContext?.prototype.readPixels,
        audioGetChannelData: globalThis.AudioBuffer?.prototype.getChannelData,
      };
    });
    const seedAndEvaluate = async (): Promise<void> => {
      await page.evaluate((payload) => {
        const script = document.createElement("script");
        script.type = "application/json";
        script.setAttribute("data-pt-runtime-config-playwright", "");
        script.textContent = JSON.stringify(payload);
        document.head.prepend(script);
      }, snapshot);
      await page.addScriptTag({ path: runtimePath });
    };

    await seedAndEvaluate();
    await seedAndEvaluate();

    const unchanged = await page.evaluate(() => {
      const anchors = (
        globalThis as typeof globalThis & {
          __runtimeIifeAnchors?: Record<string, Function | undefined>;
        }
      ).__runtimeIifeAnchors!;
      return {
        canvasGetImageData:
          anchors.canvasGetImageData ===
          CanvasRenderingContext2D.prototype.getImageData,
        canvasToDataURL:
          anchors.canvasToDataURL === HTMLCanvasElement.prototype.toDataURL,
        webGLGetParameter:
          anchors.webGLGetParameter ===
          globalThis.WebGLRenderingContext?.prototype.getParameter,
        webGLReadPixels:
          anchors.webGLReadPixels ===
          globalThis.WebGLRenderingContext?.prototype.readPixels,
        audioGetChannelData:
          anchors.audioGetChannelData ===
          globalThis.AudioBuffer?.prototype.getChannelData,
      };
    });

    expect(unchanged).toEqual({
      canvasGetImageData: true,
      canvasToDataURL: true,
      webGLGetParameter: true,
      webGLReadPixels: true,
      audioGetChannelData: true,
    });
    await page.close();
  });

  test("spoofs screen dimensions in simple engine mode", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    const fp = await collectFingerprint(page);

    // Screen values must be one of the 8 simple-engine presets
    const matchesPreset = SIMPLE_SCREEN_PRESETS.some(
      (preset) =>
        preset.width === fp.screen.width &&
        preset.height === fp.screen.height &&
        preset.colorDepth === fp.screen.colorDepth &&
        preset.devicePixelRatio === fp.screen.devicePixelRatio,
    );
    expect(matchesPreset).toBe(true);

    // pixelDepth must mirror colorDepth
    expect(fp.screen.pixelDepth).toBe(fp.screen.colorDepth);

    await page.close();
  });

  test("normalizes Battery Status API across top and iframe realms", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const page = await setupSpoofedPage(
      context,
      extensionId,
      serverUrl,
      makeSimpleSettings(serverUrl),
    );
    const extensionPage = await context.newPage();
    await extensionPage.goto(
      `chrome-extension://${extensionId}/src/ui/options/index.html`,
    );
    const pageUrl = page.url();
    const readBatteryCount = () => readBatteryXRayCount(extensionPage, pageUrl);
    const initialBatteryCount = await readBatteryCount();
    expect(initialBatteryCount).not.toBeNull();
    await page.evaluate(async () => {
      const getBattery = (
        navigator as Navigator & {
          getBattery?: () => Promise<unknown>;
        }
      ).getBattery;
      if (typeof getBattery !== "function") {
        throw new Error("Battery Status API unavailable");
      }
      await getBattery.call(navigator);
    });
    await expect.poll(readBatteryCount).toBe(initialBatteryCount! + 1);

    const trustedShape = await page.evaluate(() => {
      const syntheticEvent = new Event("battery-is-trusted-shape");
      const ownDescriptor = Object.getOwnPropertyDescriptor(
        syntheticEvent,
        "isTrusted",
      );
      const button = document.createElement("button");
      button.id = "battery-is-trusted-probe";
      button.addEventListener("click", (event) => {
        button.dataset.eventTrusted = String(event.isTrusted);
        button.dataset.capturedTrusted = String(
          ownDescriptor?.get ? Reflect.apply(ownDescriptor.get, event, []) : "missing",
        );
      });
      document.body.append(button);
      return {
        ownGetter: typeof ownDescriptor?.get,
        prototypeDescriptor: Object.getOwnPropertyDescriptor(
          Event.prototype,
          "isTrusted",
        ),
        syntheticTrusted: syntheticEvent.isTrusted,
        capturedSyntheticTrusted: ownDescriptor?.get
          ? Reflect.apply(ownDescriptor.get, syntheticEvent, [])
          : null,
      };
    });
    expect(trustedShape).toEqual({
      ownGetter: "function",
      prototypeDescriptor: undefined,
      syntheticTrusted: false,
      capturedSyntheticTrusted: false,
    });
    const trustedProbe = page.locator("#battery-is-trusted-probe");
    await trustedProbe.click();
    await expect(trustedProbe).toHaveAttribute("data-event-trusted", "true");
    await expect(trustedProbe).toHaveAttribute("data-captured-trusted", "true");

    const profiles = await page.evaluate(async () => {
      type BatteryManagerLike = EventTarget & {
        charging: boolean;
        chargingTime: number;
        dischargingTime: number;
        level: number;
      };
      type BatteryNavigator = Navigator & {
        getBattery?: () => Promise<BatteryManagerLike>;
      };
      const read = async (target: Window) => {
        const getBattery = (target.navigator as BatteryNavigator).getBattery;
        if (typeof getBattery !== "function") return null;
        const firstPromise = getBattery.call(target.navigator);
        const secondPromise = getBattery.call(target.navigator);
        const battery = await firstPromise;
        const secondBattery = await secondPromise;
        const managerPrototype = target.Object.getPrototypeOf(battery);
        const levelGetter = target.Object.getOwnPropertyDescriptor(
          managerPrototype,
          "level",
        )?.get;
        let manualEvents = 0;
        battery.addEventListener("levelchange", () => {
          manualEvents += 1;
        });
        battery.dispatchEvent(new target.Event("levelchange"));
        const outcome = (callback: () => unknown): string => {
          try {
            callback();
            return "allowed";
          } catch (error) {
            return error instanceof target.TypeError ? "TypeError" : "other";
          }
        };
        return {
          samePromise: firstPromise === secondPromise,
          sameManager: battery === secondBattery,
          ownKeys: target.Object.keys(battery),
          ownNames: target.Object.getOwnPropertyNames(battery),
          nativePrototype:
            managerPrototype ===
            (
              target as Window & {
                BatteryManager?: { prototype: object };
              }
            ).BatteryManager?.prototype,
          instanceOfBatteryManager:
            typeof (
              target as Window & {
                BatteryManager?: unknown;
              }
            ).BatteryManager === "function" &&
            battery instanceof
              (
                target as Window & {
                  BatteryManager: abstract new () => object;
                }
              ).BatteryManager,
          tag: target.Object.prototype.toString.call(battery),
          nativeConstructor:
            battery.constructor ===
            (
              target as Window & {
                BatteryManager?: unknown;
              }
            ).BatteryManager,
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
          level: battery.level,
          manualEvents,
          getBatteryName: getBattery.name,
          getBatteryLength: getBattery.length,
          getBatteryConstruct: outcome(() => target.Reflect.construct(getBattery, [])),
          getBatterySource: target.Function.prototype.toString.call(getBattery),
          levelGetterName: levelGetter?.name,
          levelGetterLength: levelGetter?.length,
          levelGetterConstruct: levelGetter
            ? outcome(() => target.Reflect.construct(levelGetter, []))
            : "missing",
          levelGetterBrand: levelGetter
            ? outcome(() => target.Reflect.apply(levelGetter, {}, []))
            : "missing",
          levelGetterSource: levelGetter
            ? target.Function.prototype.toString.call(levelGetter)
            : null,
        };
      };

      const aboutBlank = document.createElement("iframe");
      aboutBlank.id = "battery-about-blank";
      document.body.append(aboutBlank);
      const srcdoc = document.createElement("iframe");
      srcdoc.id = "battery-srcdoc";
      srcdoc.srcdoc =
        "<script>window.__batteryFirstInline = (() => { const first = navigator.getBattery(); const second = navigator.getBattery(); return first.then(manager => ({ samePromise: first === second, values: [manager.charging, manager.chargingTime, String(manager.dischargingTime), manager.level] })); })();</script>";
      const srcdocLoaded = new Promise<void>((resolve) => {
        srcdoc.addEventListener("load", () => resolve(), { once: true });
      });
      document.body.append(srcdoc);
      await srcdocLoaded;

      const navigated = document.createElement("iframe");
      navigated.id = "battery-navigated";
      navigated.src = `${location.origin}/battery-frame`;
      const navigatedLoaded = new Promise<void>((resolve) => {
        navigated.addEventListener("load", () => resolve(), { once: true });
      });
      document.body.append(navigated);
      await navigatedLoaded;
      return {
        top: await read(window),
        aboutBlank: aboutBlank.contentWindow
          ? await read(aboutBlank.contentWindow)
          : null,
        srcdoc: srcdoc.contentWindow ? await read(srcdoc.contentWindow) : null,
        srcdocFirstInline: srcdoc.contentWindow
          ? await (
              srcdoc.contentWindow as Window & {
                __batteryFirstInline?: Promise<{
                  samePromise: boolean;
                  values: [boolean, number, string, number];
                }>;
              }
            ).__batteryFirstInline
          : null,
        navigated: navigated.contentWindow ? await read(navigated.contentWindow) : null,
      };
    });

    expect(profiles.top).toMatchObject({
      samePromise: true,
      sameManager: true,
      ownKeys: [],
      ownNames: [],
      nativePrototype: true,
      instanceOfBatteryManager: true,
      tag: "[object BatteryManager]",
      nativeConstructor: true,
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1,
      manualEvents: 1,
      getBatteryName: "getBattery",
      getBatteryLength: 0,
      getBatteryConstruct: "TypeError",
      getBatterySource: "function getBattery() { [native code] }",
      levelGetterName: "get level",
      levelGetterLength: 0,
      levelGetterConstruct: "TypeError",
      levelGetterBrand: "TypeError",
      levelGetterSource: "function get level() { [native code] }",
    });
    expect(profiles.aboutBlank).toEqual(profiles.top);
    expect(profiles.srcdoc).toEqual(profiles.top);
    expect(profiles.navigated).toEqual(profiles.top);
    expect(profiles.srcdocFirstInline).toEqual({
      samePromise: true,
      values: [true, 0, "Infinity", 1],
    });

    await extensionPage.close();
    await page.evaluate(() => {
      document.querySelector("#battery-about-blank")?.remove();
      document.querySelector("#battery-srcdoc")?.remove();
      document.querySelector("#battery-navigated")?.remove();
    });
    await page.close();
  });

  test("spoofs Battery from the first top-level inline script", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const page = await setupSpoofedPage(
      context,
      extensionId,
      serverUrl,
      makeSimpleSettings(serverUrl),
    );
    const extensionPage = await context.newPage();
    await extensionPage.goto(
      `chrome-extension://${extensionId}/src/ui/options/index.html`,
    );

    const inlineBatteryUrl = new URL("/inline-battery", serverUrl).toString();
    await page.goto(inlineBatteryUrl);
    await expect
      .poll(async () => {
        const text =
          (await page.locator("#battery-first-inline").textContent()) ?? "{}";
        return (JSON.parse(text) as { status?: string }).status;
      })
      .toBe("resolved");
    const snapshot = JSON.parse(
      (await page.locator("#battery-first-inline").textContent()) ?? "{}",
    ) as {
      status?: string;
      available?: boolean;
      samePromise?: boolean;
      nativeManager?: boolean;
      ownNames?: string[] | null;
      charging?: boolean | null;
      chargingTime?: number | null;
      dischargingTime?: string | null;
      level?: number | null;
      error?: string | null;
    };

    expect(snapshot).toEqual({
      status: "resolved",
      available: true,
      samePromise: true,
      nativeManager: true,
      ownNames: [],
      charging: true,
      chargingTime: 0,
      dischargingTime: "Infinity",
      level: 1,
      error: null,
    });
    await expect
      .poll(() => readBatteryXRayCount(extensionPage, inlineBatteryUrl))
      .toBe(2);

    await extensionPage.close();
    await page.close();
  });

  test("installs new iframe surfaces from canonical policy after parent poisoning", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const page = await setupSpoofedPage(
      context,
      extensionId,
      serverUrl,
      makeSimpleSettings(serverUrl),
    );

    const result = await page.evaluate(async () => {
      const navigatorPrototype = Object.getPrototypeOf(navigator);
      const screenPrototype = Object.getPrototypeOf(screen);
      const userAgentData = (
        navigator as Navigator & {
          userAgentData?: { platform: string };
        }
      ).userAgentData;
      const userAgentDataPrototype = userAgentData
        ? Object.getPrototypeOf(userAgentData)
        : null;
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
        userAgentDataPlatform: userAgentDataPrototype
          ? Object.getOwnPropertyDescriptor(userAgentDataPrototype, "platform")
          : undefined,
        webGLGetParameter:
          typeof WebGLRenderingContext === "undefined"
            ? undefined
            : Object.getOwnPropertyDescriptor(
                WebGLRenderingContext.prototype,
                "getParameter",
              ),
      };
      const expectedPosition = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            maximumAge: 0,
            timeout: 5_000,
          });
        },
      );
      const expectedPermissionState = await navigator.permissions
        .query({ name: "geolocation" })
        .then(({ state }) => state);
      const expected = {
        devicePixelRatio,
        latitude: expectedPosition.coords.latitude,
        language: navigator.language,
        longitude: expectedPosition.coords.longitude,
        permissionState: expectedPermissionState,
        screenWidth: screen.width,
        userAgentDataPlatform: userAgentData?.platform ?? null,
      };

      const restore = (): void => {
        const restoreDescriptor = (
          target: object,
          property: PropertyKey,
          descriptor: PropertyDescriptor | undefined,
        ): void => {
          if (descriptor) {
            Object.defineProperty(target, property, descriptor);
          }
        };
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
        if (userAgentDataPrototype) {
          restoreDescriptor(
            userAgentDataPrototype,
            "platform",
            descriptors.userAgentDataPlatform,
          );
        }
        if (typeof WebGLRenderingContext !== "undefined") {
          restoreDescriptor(
            WebGLRenderingContext.prototype,
            "getParameter",
            descriptors.webGLGetParameter,
          );
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
        Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
          configurable: true,
          writable: true,
          value: () => "data:,parent-poison",
        });
        if (userAgentDataPrototype) {
          Object.defineProperty(userAgentDataPrototype, "platform", {
            configurable: true,
            get: () => "parent-poison-platform",
          });
        }
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
        const child2d = childCanvas.getContext("2d");
        child2d?.fillRect(0, 0, 4, 4);
        const canvasExport = childCanvas.toDataURL();
        const childWebGL = childCanvas.getContext("webgl");
        const webGLRenderer = childWebGL?.getParameter(0x9246) ?? null;
        const childPosition = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            childWindow.navigator.geolocation.getCurrentPosition(resolve, reject, {
              maximumAge: 0,
              timeout: 5_000,
            });
          },
        );
        const childPermissionState = await childWindow.navigator.permissions
          .query({ name: "geolocation" })
          .then(({ state }) => state);
        const beforeParentRetamper = childWindow.navigator.language;

        Object.defineProperty(navigatorPrototype, "language", {
          configurable: true,
          get: () => "poison-parent-after-install",
        });
        const afterParentRetamper = childWindow.navigator.language;

        const childUserAgentData = (
          childWindow.navigator as Navigator & {
            userAgentData?: { platform: string };
          }
        ).userAgentData;
        const output = {
          afterParentRetamper,
          beforeParentRetamper,
          canvasPoisoned: canvasExport === "data:,parent-poison",
          devicePixelRatio: childWindow.devicePixelRatio,
          latitude: childPosition.coords.latitude,
          language: childWindow.navigator.language,
          longitude: childPosition.coords.longitude,
          permissionState: childPermissionState,
          screenWidth: childWindow.screen.width,
          userAgentDataPlatform: childUserAgentData?.platform ?? null,
          webGLPoisoned: webGLRenderer === "parent-poison-webgl",
        };
        iframe.remove();
        return { expected, output };
      } finally {
        restore();
      }
    });

    const { latitude, longitude, ...stableOutput } = result.output;
    expect(stableOutput).toEqual({
      afterParentRetamper: result.expected.language,
      beforeParentRetamper: result.expected.language,
      canvasPoisoned: false,
      devicePixelRatio: result.expected.devicePixelRatio,
      language: result.expected.language,
      permissionState: result.expected.permissionState,
      screenWidth: result.expected.screenWidth,
      userAgentDataPlatform: result.expected.userAgentDataPlatform,
      webGLPoisoned: false,
    });
    expect(latitude).toBeCloseTo(40.7128, 3);
    expect(longitude).toBeCloseTo(-74.006, 3);
    await page.close();
  });

  test("suppresses WebGL debug info in simple engine mode", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    const fp = await collectFingerprint(page);

    expect(fp.webGL).not.toBeNull();
    expect(fp.webGL!.debugExtensionAvailable).toBe(false);
    expect(fp.webGL!.renderer).toBeNull();
    expect(fp.webGL!.vendor).toBeNull();
    expect(fp.webGL!.supportedExtensions).not.toContain("WEBGL_debug_renderer_info");

    await page.close();
  });

  test("keeps WebGL readPixels stable in simple engine mode", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const settings = makeSimpleSettings(serverUrl);
    const primaryLocation = settings.locations[0];
    if (!primaryLocation) {
      throw new Error("Fingerprint test settings must include at least one location.");
    }

    await importFpTestSettings(context, extensionId, settings);
    const page = await context.newPage();
    await page.goto(getFingerprintHostUrl(serverUrl));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForSpoofedLocale(page, primaryLocation);

    const initialFingerprint = await collectFingerprint(page);
    expect(initialFingerprint.webGL).not.toBeNull();
    expect(initialFingerprint.webGL?.error).toBeUndefined();

    await page.reload();
    await waitForSpoofedLocale(page, primaryLocation);

    const reloadedFingerprint = await collectFingerprint(page);
    expect(reloadedFingerprint.webGL).not.toBeNull();
    expect(reloadedFingerprint.webGL?.error).toBeUndefined();
    expect(reloadedFingerprint.webGL!.readPixelsHash).toBe(
      initialFingerprint.webGL!.readPixelsHash,
    );
    expect(reloadedFingerprint.webGL!.readPixelsSample).toEqual(
      initialFingerprint.webGL!.readPixelsSample,
    );
    await page.close();
  });

  test("coerces object readPixels arguments once and noises the converted region", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const page = await setupSpoofedPage(
      context,
      extensionId,
      serverUrl,
      makeSimpleSettings(serverUrl),
    );
    const result = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      const webGL = canvas.getContext("webgl2");
      if (!webGL) return null;
      let widthCoercions = 0;
      let offsetCoercions = 0;
      let illegalReceiverCoercions = 0;
      const pixels = new Uint8Array(64).fill(0xaa);
      Reflect.apply(webGL.readPixels, webGL, [
        0,
        0,
        {
          valueOf: () => {
            widthCoercions += 1;
            return 2;
          },
        },
        new Number(2),
        webGL.RGBA,
        webGL.UNSIGNED_BYTE,
        pixels,
        {
          valueOf: () => {
            offsetCoercions += 1;
            return 4;
          },
        },
      ]);
      let illegalReceiverError: string | null = null;
      try {
        Reflect.apply(webGL.readPixels, {}, [
          0,
          0,
          {
            valueOf: () => {
              illegalReceiverCoercions += 1;
              return 2;
            },
          },
          2,
          webGL.RGBA,
          webGL.UNSIGNED_BYTE,
          new Uint8Array(16),
          0,
        ]);
      } catch (error) {
        illegalReceiverError = error instanceof Error ? error.name : String(error);
      }
      return {
        body: Array.from(pixels.slice(4, 20)),
        error: webGL.getError(),
        illegalReceiverCoercions,
        illegalReceiverError,
        offsetCoercions,
        prefix: Array.from(pixels.slice(0, 4)),
        tail: Array.from(pixels.slice(20)),
        widthCoercions,
      };
    });

    expect(result).not.toBeNull();
    expect(result?.widthCoercions).toBe(1);
    expect(result?.offsetCoercions).toBe(1);
    expect(result?.error).toBe(0);
    expect(result?.illegalReceiverCoercions).toBe(0);
    expect(result?.illegalReceiverError).toBe("TypeError");
    expect(result?.prefix).toEqual(new Array(4).fill(0xaa));
    expect(result?.tail).toEqual(new Array(44).fill(0xaa));
    expect(result?.body.some((value) => value !== 0)).toBe(true);
    await page.close();
  });

  test("applies canvas noise (export or readback differs from baseline)", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const baseline = await collectBaselineFp(context, serverUrl);

    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    const fp = await collectFingerprint(page);

    expect(baseline.canvas).not.toBeNull();
    expect(fp.canvas).not.toBeNull();
    const exportChanged = fp.canvas!.toDataURL !== baseline.canvas!.toDataURL;
    const readbackChanged = fp.canvas!.imageDataHash !== baseline.canvas!.imageDataHash;

    expect(exportChanged || readbackChanged).toBe(true);

    await page.close();
  });

  test("keeps sparse large-canvas noise visible in JPEG exports", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const exportSparseJpeg = (target: Awaited<ReturnType<typeof setupSpoofedPage>>) =>
      target.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 2048;
        canvas.height = 513;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Expected 2D canvas context");
        context.fillStyle = "rgb(128, 128, 128)";
        // This row was outside every tile in the previous 4×4 sampler.
        context.fillRect(canvas.width - 1, 256, 1, 1);
        return canvas.toDataURL("image/jpeg", 1);
      });

    const browser = context.browser();
    if (!browser) throw new Error("Browser handle unavailable for JPEG baseline");
    const baselineContext = await browser.newContext();
    let baseline: string;
    try {
      const baselinePage = await baselineContext.newPage();
      await baselinePage.goto(getFingerprintHostUrl(serverUrl));
      baseline = await exportSparseJpeg(baselinePage);
    } finally {
      await baselineContext.close();
    }

    const page = await setupSpoofedPage(
      context,
      extensionId,
      serverUrl,
      makeSimpleSettings(serverUrl),
    );
    const spoofed = await exportSparseJpeg(page);

    expect(spoofed).not.toBe(baseline);
    await page.close();
  });

  test("noises a borrowed same-origin foreign canvas export", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const exportBorrowedJpeg = async (
      target: Awaited<ReturnType<typeof setupSpoofedPage>>,
    ): Promise<{ blank: string; drawn: string }> =>
      target.evaluate(async () => {
        const iframe = document.createElement("iframe");
        const loaded = new Promise<void>((resolve) => {
          iframe.addEventListener("load", () => resolve(), { once: true });
        });
        document.body.append(iframe);
        await loaded;
        const foreignWindow = iframe.contentWindow;
        if (!foreignWindow) throw new Error("Expected same-origin iframe window");
        const canvas = foreignWindow.document.createElement("canvas");
        canvas.width = 2048;
        canvas.height = 513;
        const blank = Reflect.apply(HTMLCanvasElement.prototype.toDataURL, canvas, [
          "image/jpeg",
          1,
        ]);
        const foreignContext = canvas.getContext("2d");
        if (!foreignContext) throw new Error("Expected foreign 2D context");
        foreignContext.fillStyle = "rgb(128, 128, 128)";
        foreignContext.fillRect(canvas.width - 1, 256, 1, 1);
        return {
          blank,
          drawn: Reflect.apply(HTMLCanvasElement.prototype.toDataURL, canvas, [
            "image/jpeg",
            1,
          ]),
        };
      });

    const browser = context.browser();
    if (!browser) throw new Error("Browser handle unavailable for foreign baseline");
    const baselineContext = await browser.newContext();
    let baseline: Awaited<ReturnType<typeof exportBorrowedJpeg>>;
    try {
      const baselinePage = await baselineContext.newPage();
      await baselinePage.goto(getFingerprintHostUrl(serverUrl));
      baseline = await exportBorrowedJpeg(baselinePage);
    } finally {
      await baselineContext.close();
    }

    const page = await setupSpoofedPage(
      context,
      extensionId,
      serverUrl,
      makeSimpleSettings(serverUrl),
    );
    const spoofed = await exportBorrowedJpeg(page);
    expect(spoofed.blank).toBe(baseline.blank);
    expect(spoofed.drawn).not.toBe(baseline.drawn);
    await page.close();
  });

  test("keeps a large blank canvas native after zero-area drawing no-ops", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const exportNoOpBlank = (target: Awaited<ReturnType<typeof setupSpoofedPage>>) =>
      target.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 2048;
        canvas.height = 513;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Expected 2D canvas context");
        context.clearRect(0, 0, 0, 0);
        context.fillRect(0, 0, 0, 0);
        context.globalAlpha = 0;
        context.fillRect(0, 0, 10, 10);
        context.globalAlpha = 1;
        context.beginPath();
        context.fill();
        return canvas.toDataURL("image/png");
      });

    const browser = context.browser();
    if (!browser) throw new Error("Browser handle unavailable for blank baseline");
    const baselineContext = await browser.newContext();
    let baseline: string;
    try {
      const baselinePage = await baselineContext.newPage();
      await baselinePage.goto(getFingerprintHostUrl(serverUrl));
      baseline = await exportNoOpBlank(baselinePage);
    } finally {
      await baselineContext.close();
    }

    const page = await setupSpoofedPage(
      context,
      extensionId,
      serverUrl,
      makeSimpleSettings(serverUrl),
    );
    expect(await exportNoOpBlank(page)).toBe(baseline);
    await page.close();
  });

  test("preserves native Function.toString errors for tracked canvases", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const page = await setupSpoofedPage(
      context,
      extensionId,
      serverUrl,
      makeSimpleSettings(serverUrl),
    );
    const error = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.getContext("2d")?.fillRect(0, 0, 1, 1);
      try {
        Reflect.apply(Function.prototype.toString, canvas, []);
        return null;
      } catch (caught) {
        return {
          message: caught instanceof Error ? caught.message : String(caught),
          name: caught instanceof Error ? caught.name : "",
        };
      }
    });

    expect(error?.name).toBe("TypeError");
    expect(error?.message).not.toContain("canvas-content:");
    await page.close();
  });

  test("applies audio noise (channel data differs from baseline)", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const baseline = await collectBaselineFp(context, serverUrl);

    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    const fp = await collectFingerprint(page);

    expect(baseline.audio).not.toBeNull();
    expect(fp.audio).not.toBeNull();
    expect(fp.audio!.channelDataSample).not.toEqual(baseline.audio!.channelDataSample);

    await page.close();
  });

  test("keeps fingerprint surfaces consistent inside same-origin iframes", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const baseline = await collectBaselineFp(context, serverUrl);
    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    await page.locator("#collect-fingerprint").click();
    const pageFingerprint = await readFingerprintSnapshot(page);

    const frame = page.frame({ url: /\/frame$/ });
    expect(frame).not.toBeNull();
    if (!frame) {
      throw new Error("Expected same-origin frame to be available.");
    }

    await frame.locator("#collect-fingerprint").click();
    const frameFingerprint = await readFingerprintSnapshot(frame);

    expect(pageFingerprint.navigator).toEqual(frameFingerprint.navigator);
    expect(pageFingerprint.screen).toEqual(frameFingerprint.screen);
    expect(baseline.audio).not.toBeNull();
    expect(pageFingerprint.audio).not.toBeNull();
    expect(frameFingerprint.audio).not.toBeNull();
    expect(pageFingerprint.audio?.error).toBeUndefined();
    expect(frameFingerprint.audio?.error).toBeUndefined();
    expect(pageFingerprint.audio!.channelDataSample).not.toEqual(
      baseline.audio!.channelDataSample,
    );
    expect(frameFingerprint.audio!.channelDataSample).not.toEqual(
      baseline.audio!.channelDataSample,
    );
    expectAudioFpClose(pageFingerprint.audio!, frameFingerprint.audio!);

    await page.close();
  });

  test("keeps fingerprint noisy surfaces consistent in dynamically inserted same-origin iframes", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    await page.locator("#collect-fingerprint").click();
    const pageFingerprint = await readFingerprintSnapshot(page);

    await page.evaluate(() => {
      const iframe = document.createElement("iframe");
      iframe.id = "dynamic-fingerprint-frame";
      iframe.src = "/frame?dynamic-fingerprint=1";
      document.body.append(iframe);
    });
    await expect
      .poll(() =>
        page
          .frames()
          .some((frame) => frame.url().includes("/frame?dynamic-fingerprint=1")),
      )
      .toBe(true);
    const dynamicFrame = page
      .frames()
      .find((frame) => frame.url().includes("/frame?dynamic-fingerprint=1"));
    if (!dynamicFrame) {
      throw new Error("Expected dynamic fingerprint iframe.");
    }
    await dynamicFrame.waitForLoadState("load");
    const ownershipIsStable = await page.evaluate(async () => {
      const iframe = document.getElementById(
        "dynamic-fingerprint-frame",
      ) as HTMLIFrameElement | null;
      const child = iframe?.contentWindow;
      if (!iframe || !child) {
        throw new Error("Expected dynamic iframe window.");
      }
      const userAgentData = (
        child.navigator as Navigator & {
          userAgentData?: {
            getHighEntropyValues?: (hints: readonly string[]) => Promise<unknown>;
          };
        }
      ).userAgentData;
      const before = {
        canvas: child.CanvasRenderingContext2D.prototype.getImageData,
        clientHints: userAgentData?.getHighEntropyValues,
        geolocation: child.navigator.geolocation.getCurrentPosition,
        webGL: child.WebGLRenderingContext?.prototype.getParameter,
      };

      for (let attempt = 0; attempt < 256; attempt += 1) {
        void iframe.contentWindow;
        void iframe.contentDocument;
      }
      await userAgentData?.getHighEntropyValues?.([]);

      return {
        canvas: child.CanvasRenderingContext2D.prototype.getImageData === before.canvas,
        clientHints: userAgentData?.getHighEntropyValues === before.clientHints,
        geolocation:
          child.navigator.geolocation.getCurrentPosition === before.geolocation,
        webGL: child.WebGLRenderingContext?.prototype.getParameter === before.webGL,
      };
    });
    expect(ownershipIsStable).toEqual({
      canvas: true,
      clientHints: true,
      geolocation: true,
      webGL: true,
    });
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const iframe = document.getElementById(
            "dynamic-fingerprint-frame",
          ) as HTMLIFrameElement | null;
          const iframeWindow = iframe?.contentWindow;
          if (!iframeWindow || typeof WebGLRenderingContext === "undefined") {
            return null;
          }

          return {
            sameCanvasMethodReference:
              iframeWindow.HTMLCanvasElement.prototype.toDataURL ===
              HTMLCanvasElement.prototype.toDataURL,
            sameWebGLMethodReference:
              iframeWindow.WebGLRenderingContext?.prototype.readPixels ===
              WebGLRenderingContext.prototype.readPixels,
          };
        }),
      )
      .toEqual({
        sameCanvasMethodReference: false,
        sameWebGLMethodReference: false,
      });
    await dynamicFrame.locator("#collect-fingerprint").click();
    const frameFingerprint = await readFingerprintSnapshot(dynamicFrame);
    const iframeMethodParity = await page.evaluate(() => {
      const iframe = document.getElementById(
        "dynamic-fingerprint-frame",
      ) as HTMLIFrameElement | null;
      const iframeWindow = iframe?.contentWindow;
      if (!iframeWindow || typeof WebGLRenderingContext === "undefined") {
        throw new Error("Expected dynamic iframe window.");
      }

      return {
        sameCanvasMethodReference:
          iframeWindow.HTMLCanvasElement.prototype.toDataURL ===
          HTMLCanvasElement.prototype.toDataURL,
        sameWebGLMethodReference:
          iframeWindow.WebGLRenderingContext?.prototype.readPixels ===
          WebGLRenderingContext.prototype.readPixels,
      };
    });

    expect(frameFingerprint.canvas).toEqual(pageFingerprint.canvas);
    expect(frameFingerprint.webGL).toEqual(pageFingerprint.webGL);
    expect(iframeMethodParity.sameCanvasMethodReference).toBe(false);
    expect(iframeMethodParity.sameWebGLMethodReference).toBe(false);

    await page.close();
  });

  test("keeps CreepJS-style iframe restore probes aligned with the top window", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    const probe = await collectCreepIframeProbe(page);

    expectCreepIframeParity(probe);

    await page.close();
  });

  test("leaves the blank canvas native so it is consistent across every realm", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const readBlankCanvas = (
      target: Awaited<ReturnType<typeof setupSpoofedPage>>,
    ): Promise<string> =>
      target.evaluate(() => document.createElement("canvas").toDataURL());

    // Native baseline: a fresh context without the extension loaded.
    const browser = context.browser();
    if (!browser) {
      throw new Error("Browser handle unavailable for baseline blank-canvas capture.");
    }
    const baselineContext = await browser.newContext();
    let baselineBlank: string;
    try {
      const basePage = await baselineContext.newPage();
      await basePage.goto(getFingerprintHostUrl(serverUrl));
      baselineBlank = await readBlankCanvas(basePage);
    } finally {
      await baselineContext.close();
    }

    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    const spoofedBlank = await readBlankCanvas(page);

    // A blank (zero-entropy) canvas must read back native on the spoofed page, so it
    // matches what every realm returns — including unreachable detached frames
    // (CreepJS's "dead" iframe). Noising it would create a detectable mismatch.
    expect(spoofedBlank).toBe(baselineBlank);

    await page.close();
  });

  test("keeps the blank canvas native and metadata stable across new identity", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    test.slow();
    const settings = makeSimpleSettings(serverUrl);
    const primaryLocation = settings.locations[0];
    if (!primaryLocation) {
      throw new Error("Fingerprint test settings must include at least one location.");
    }

    const browser = context.browser();
    if (!browser) {
      throw new Error(
        "Browser handle unavailable for native feature baseline capture.",
      );
    }
    const baselineContext = await browser.newContext();
    let nativeWindowKeys: string[];
    try {
      const baselinePage = await baselineContext.newPage();
      await baselinePage.goto(getFingerprintHostUrl(serverUrl));
      nativeWindowKeys = await baselinePage.evaluate(() =>
        Object.getOwnPropertyNames(window),
      );
    } finally {
      await baselineContext.close();
    }

    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    const initialProbe = await collectCreepIframeProbe(page);
    expectCreepIframeParity(initialProbe);
    expect(initialProbe.window?.canvas).not.toBeNull();
    // CreepJS's `features` column is the window own-property surface
    // (Object.getOwnPropertyNames + moz/webkit/apple counts). It is compatibility
    // evidence, NOT an identity field — it must stay stable across "new identity"
    // (rotating it would itself be a spoofer tell).
    //
    // Compare only the NATIVE browser surface. The live top window is polluted by
    // test infrastructure with nondeterministic names across reloads. A protected
    // about:blank iframe is no longer a clean baseline once fallback-origin
    // injection is enabled, so capture keys once from a context without the
    // extension and keep their stable ordering for both reads.
    const readCleanFeatures = async (): Promise<string> => {
      let value = "";
      await expect
        .poll(
          async () => {
            try {
              value = await page.evaluate((nativeKeys) => {
                const keys = nativeKeys.filter((key) => Object.hasOwn(window, key));
                const data = {
                  keys,
                  apple: keys.filter((k) => /apple/i.test(k)).length,
                  moz: keys.filter((k) => /moz/i.test(k)).length,
                  webkit: keys.filter((k) => /webkit/i.test(k)).length,
                };
                return JSON.stringify(data);
              }, nativeWindowKeys);
              return value.length > 0;
            } catch {
              // Tolerate transient "execution context destroyed" while the page
              // is still settling after the new-identity reload.
              return false;
            }
          },
          { timeout: 10_000 },
        )
        .toBe(true);
      return value;
    };
    const initialCleanFeatures = await readCleanFeatures();

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/ui/popup/index.html`);
    await page.bringToFront();
    await popupPage.reload();

    const rulePattern = new URL(serverUrl).hostname;
    const previousRuleSeedKey = await readRuleSeedKey(popupPage, rulePattern);

    await popupPage.locator("#new-identity-current-domain").click();
    await popupPage.locator("#confirm-sheet-action").click();

    await expect
      .poll(async () => readRuleSeedKey(popupPage, rulePattern))
      .not.toBe(previousRuleSeedKey);
    await popupPage.close();

    // New identity rotates only the seed, not the locale. A blank canvas is left
    // native (skipped), so new identity must NOT change it — every realm (including
    // the unreachable detached "dead" frame) stays consistent. Reload until the page
    // settles and confirm the blank canvas is still native and all contexts align.
    const initialBlankCanvas = initialProbe.window?.canvas ?? null;
    let settledProbe: CreepJsIframeProbe | null = null;
    await expect
      .poll(
        async () => {
          try {
            await page.reload();
            await page.waitForLoadState("load");
            const probe = await collectCreepIframeProbe(page);
            if (!probe.window) {
              return null;
            }
            settledProbe = probe;
            return probe.window.canvas;
          } catch {
            return null;
          }
        },
        { timeout: 20_000, message: "Expected the page to settle after new identity." },
      )
      .toBe(initialBlankCanvas);

    await expect
      .poll(async () => {
        try {
          return await page.evaluate(
            () => typeof globalThis.collectFingerprintSnapshot,
          );
        } catch {
          return "unavailable";
        }
      })
      .toBe("function");

    const finalProbe: CreepJsIframeProbe | null = settledProbe;
    if (!finalProbe) {
      throw new Error("Expected a CreepJS-style iframe probe after new identity.");
    }

    // All iframe contexts remain consistent with the top window after new identity.
    expectCreepIframeParity(finalProbe);
    // `features` and `platform` are stable compatibility evidence, not identity fields.
    const rotatedCleanFeatures = await readCleanFeatures();
    expect(rotatedCleanFeatures).toBe(initialCleanFeatures);
    expect(finalProbe.window?.platform).toBe(initialProbe.window?.platform);

    await page.close();
  });

  test("noises drawn main-thread OffscreenCanvas while leaving the blank one native", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);

    const readOffscreen = () =>
      page.evaluate(async () => {
        const fnv = (data: Uint8Array | Uint8ClampedArray): string => {
          let hash = 2166136261;
          for (let index = 0; index < data.length; index += 1) {
            hash = Math.imul(hash ^ data[index]!, 16777619);
          }
          return (hash >>> 0).toString(16);
        };
        // Drawn OffscreenCanvas: real content → noised. Covers both readback
        // (getImageData) and export (convertToBlob).
        const drawnProbe = async (
          frameWindow: Window | null,
        ): Promise<{ imageData: string; blob: string } | null> => {
          if (!frameWindow || typeof frameWindow.OffscreenCanvas === "undefined") {
            return null;
          }
          try {
            const canvas = new frameWindow.OffscreenCanvas(64, 32);
            const context2d = canvas.getContext("2d");
            if (!context2d) {
              return null;
            }
            context2d.fillStyle = "#069";
            context2d.fillRect(0, 0, 64, 32);
            context2d.fillStyle = "#f60";
            context2d.font = "12px Arial";
            context2d.fillText("gw", 2, 14);
            const imageData = fnv(context2d.getImageData(0, 0, 64, 32).data);
            const blob = await canvas.convertToBlob();
            return { imageData, blob: fnv(new Uint8Array(await blob.arrayBuffer())) };
          } catch {
            return null;
          }
        };
        // Blank OffscreenCanvas: zero entropy → must read back native.
        const blankProbe = (frameWindow: Window | null): string | null => {
          if (!frameWindow || typeof frameWindow.OffscreenCanvas === "undefined") {
            return null;
          }
          try {
            const canvas = new frameWindow.OffscreenCanvas(64, 32);
            const context2d = canvas.getContext("2d");
            return context2d ? fnv(context2d.getImageData(0, 0, 64, 32).data) : null;
          } catch {
            return null;
          }
        };

        const nativeBlank = fnv(new Uint8ClampedArray(64 * 32 * 4));
        const topDrawn = await drawnProbe(window);
        const topBlank = blankProbe(window);
        const iframe = document.createElement("iframe");
        document.body.append(iframe);
        let frameDrawn: { imageData: string; blob: string } | null;
        try {
          frameDrawn = await drawnProbe(iframe.contentWindow);
        } finally {
          iframe.remove();
        }
        return { topDrawn, topBlank, frameDrawn, nativeBlank };
      });

    const readStableOffscreen = async (): Promise<
      Awaited<ReturnType<typeof readOffscreen>>
    > => {
      let value: Awaited<ReturnType<typeof readOffscreen>> | null = null;
      await expect
        .poll(
          async () => {
            try {
              value = await readOffscreen();
              return value.topDrawn !== null;
            } catch {
              return false;
            }
          },
          { timeout: 15_000 },
        )
        .toBe(true);
      if (!value) {
        throw new Error("Expected a stable OffscreenCanvas probe.");
      }
      return value;
    };

    const initial = await readStableOffscreen();
    expect(initial.topDrawn).not.toBeNull();
    // A blank OffscreenCanvas is left native (skipped), matching every realm — the
    // same cross-realm consistency the HTMLCanvas blank-native test guards.
    expect(initial.topBlank).toBe(initial.nativeBlank);
    // The drawn OffscreenCanvas (both readback getImageData and export
    // convertToBlob) is noised and mirrored consistently into same-origin iframes.
    expect(initial.frameDrawn).toEqual(initial.topDrawn);

    await page.close();
  });

  test("keeps navigator fingerprint parity across dedicated workers", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    test.slow();

    // SharedWorker is intentionally left native (not blob-wrapped) for cross-tab
    // compatibility, so it is excluded from fingerprint-parity expectations;
    // dedicated Workers stay spoofed and must match the page.
    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    await page.locator("#collect-fingerprint").click();
    const pageFingerprint = await readFingerprintSnapshot(page);

    await page.locator("#collect-worker").click();
    const workerFingerprint = await readWorkerSnapshot(page);

    expect(workerFingerprint.platform).toBe(pageFingerprint.navigator.platform);
    expect(workerFingerprint.userAgent).toBe(pageFingerprint.navigator.userAgent);
    expect(workerFingerprint.hardwareConcurrency).toBe(
      pageFingerprint.navigator.hardwareConcurrency,
    );

    await page.close();
  });

  test("keeps Client Hints and WebGL parity across dedicated workers", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    test.slow();

    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    await page.locator("#collect-fingerprint").click();
    const pageFingerprint = await readFingerprintSnapshot(page);

    await page.locator("#collect-worker").click();
    const workerFingerprint = await readWorkerSnapshot(page);

    expect(workerFingerprint.clientHints).toEqual(pageFingerprint.clientHints);
    expect(workerFingerprint.clientHints?.error).toBeUndefined();

    expect(workerFingerprint.webGL).not.toBeNull();
    expect(pageFingerprint.webGL).not.toBeNull();
    expect(workerFingerprint.webGL?.error).toBeUndefined();
    expect(workerFingerprint.webGL!.debugExtensionAvailable).toBe(
      pageFingerprint.webGL!.debugExtensionAvailable,
    );
    expect(workerFingerprint.webGL!.renderer).toBe(pageFingerprint.webGL!.renderer);
    expect(workerFingerprint.webGL!.vendor).toBe(pageFingerprint.webGL!.vendor);
    expect(workerFingerprint.webGL!.supportedExtensions).toEqual(
      pageFingerprint.webGL!.supportedExtensions,
    );
    expect(workerFingerprint.webGL!.readPixelsSample).toHaveLength(
      pageFingerprint.webGL!.readPixelsSample.length,
    );
    expect(workerFingerprint.webGL!.readPixelsHash).toBe(
      pageFingerprint.webGL!.readPixelsHash,
    );
    expect(workerFingerprint.webGL!.readPixelsSample).toEqual(
      pageFingerprint.webGL!.readPixelsSample,
    );

    await page.close();
  });

  test("forces WebRTC relay transport policy", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    const fp = await collectFingerprint(page);

    expect(fp.webRTC).not.toBeNull();
    expect(fp.webRTC!.iceTransportPolicy).toBe("relay");

    await page.close();
  });

  test("spoofs navigator properties with fuzzed UA", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const nativePage = await context.newPage();
    await nativePage.goto(getFingerprintHostUrl(serverUrl));
    const nativeUA = await nativePage.evaluate(() => navigator.userAgent);
    await nativePage.close();

    const settings = makeSimpleSettings(serverUrl);
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    const fp = await collectFingerprint(page);

    // UA is fuzzed (build ±3), so it should differ slightly or remain the same
    // but appVersion should be derived from the (potentially fuzzed) UA
    expect(fp.navigator.userAgent).toBeTruthy();
    expect(fp.navigator.appVersion).toBeTruthy();
    // Platform and vendor pass through in simple engine mode
    expect(fp.navigator.platform).toBeTruthy();
    expect(fp.navigator.vendor).toBeTruthy();
    expect(Number.isInteger(fp.navigator.hardwareConcurrency)).toBe(true);
    expect(fp.navigator.hardwareConcurrency).toBeGreaterThan(0);
    expect(VALID_MEMORY_VALUES).toContain(fp.navigator.deviceMemory);

    // The UA string should still be a valid Chromium-like UA (contains "Chrome/")
    expect(fp.navigator.userAgent).toContain("Chrome/");
    // appVersion should derive from the fuzzed UA (starts with "5.0")
    expect(fp.navigator.appVersion).toMatch(/^5\.0/);

    // If the native UA happened to stay the same (fuzz delta=0), that's still valid.
    // But the navigator surface must be populated and coherent.
    if (fp.navigator.userAgent !== nativeUA) {
      // The fuzzed UA should differ only in the build number (±3 digits)
      // Both should share the same base structure
      expect(fp.navigator.userAgent).toContain("AppleWebKit/");
    }

    await page.close();
  });

  test("experimental toggle kills canvas surface globally", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const baseline = await collectBaselineFp(context, serverUrl);

    const settings = {
      ...makeSimpleSettings(serverUrl),
      sharedSpoofing: {
        canvas: false, // <-- canvas disabled globally
        webGL: true,
        audio: true,
        screen: true,
        webRTC: true,
      },
    };
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    const fp = await collectFingerprint(page);

    // Canvas should match baseline (no noise applied)
    expect(baseline.canvas).not.toBeNull();
    expect(fp.canvas).not.toBeNull();
    expect(fp.canvas!.toDataURL).toBe(baseline.canvas!.toDataURL);

    // Other surfaces should still be spoofed — screen should be a preset
    const matchesPreset = SIMPLE_SCREEN_PRESETS.some(
      (preset) =>
        preset.width === fp.screen.width &&
        preset.height === fp.screen.height &&
        preset.colorDepth === fp.screen.colorDepth &&
        preset.devicePixelRatio === fp.screen.devicePixelRatio,
    );
    expect(matchesPreset).toBe(true);

    // WebGL debug info should still be suppressed
    expect(fp.webGL).not.toBeNull();
    expect(fp.webGL!.debugExtensionAvailable).toBe(false);

    await page.close();
  });

  test("rule-level override disables screen spoofing for domain", async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    const nativePage = await context.newPage();
    await nativePage.goto(getFingerprintHostUrl(serverUrl));
    await nativePage.locator("#collect-fingerprint").click();
    const nativeScreen = (await readFingerprintSnapshot(nativePage)).screen;
    await nativePage.close();

    const settings = {
      ...makeSimpleSettings(serverUrl),
      rules: [
        {
          pattern: new URL(serverUrl).hostname,
          locationId: "fp-test-loc",
          enabled: true,
          fingerprintSurfaceOverrides: { screen: false },
        },
      ],
    };
    const page = await setupSpoofedPage(context, extensionId, serverUrl, settings);
    const fp = await collectFingerprint(page);

    // Screen should preserve native values (not spoofed)
    expect(fp.screen.width).toBe(nativeScreen.width);
    expect(fp.screen.height).toBe(nativeScreen.height);
    expect(fp.screen.colorDepth).toBe(nativeScreen.colorDepth);
    expect(fp.screen.devicePixelRatio).toBe(nativeScreen.devicePixelRatio);

    // WebGL should still be spoofed (suppressed in simple engine)
    expect(fp.webGL).not.toBeNull();
    expect(fp.webGL!.debugExtensionAvailable).toBe(false);

    await page.close();
  });
});
