import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerNavListeners,
  type NavigationDeps,
} from "@/background/navigation-listeners";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { ResolveSnapshotResponse } from "@/shared/types";

type NavigationDetails = {
  tabId: number;
  frameId: number;
  url: string;
  parentFrameId?: number;
  processId?: number;
  frameType?: string;
  documentId?: string;
  timeStamp?: number;
};

type NavigationListener = (details: NavigationDetails) => void;

const makeSnapshot = (lang: string): NonNullable<ResolveSnapshotResponse["snapshot"]> =>
  ({
    geo: { latitude: 0, longitude: 0, accuracy: 10, noiseRadius: 100 },
    locale: {
      language: lang,
      languages: [lang],
      timeZone: "UTC",
      acceptLanguage: lang,
    },
    date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
    debugMode: false,
    watchPositionDelay: [100, 500] as [number, number],
  }) as NonNullable<ResolveSnapshotResponse["snapshot"]>;

const londonSnapshot = makeSnapshot("en-GB");
const berlinSnapshot = makeSnapshot("de-DE");
const londonDecision = { snapshot: londonSnapshot, trustedSiteMatched: false };
const berlinDecision = { snapshot: berlinSnapshot, trustedSiteMatched: false };

const makeDeps = (overrides: Partial<NavigationDeps> = {}): NavigationDeps => ({
  listenFirefoxRequest: vi.fn(),
  clearSurfaceAccess: vi.fn(),
  loadRuntimeCaches: vi.fn().mockResolvedValue(undefined),
  getPopupTabById: vi.fn().mockResolvedValue(undefined),
  getExactHostname: vi.fn().mockImplementation((url: string) => new URL(url).hostname),
  resolveRuntimeDecision: vi.fn().mockResolvedValue(berlinDecision),
  readDecisionCache: vi.fn(),
  cacheDecision: vi.fn(),
  injectFirefoxState: vi.fn().mockResolvedValue(undefined),
  seedChromiumSnapshot: vi.fn().mockResolvedValue(undefined),
  cleanFirefoxSeedUrl: vi.fn().mockResolvedValue(undefined),
  injectSnapshot: vi.fn().mockResolvedValue(undefined),
  primeFirefoxSeed: vi.fn(),
  upsertTabContext: vi.fn().mockResolvedValue(undefined),
  refreshActionState: vi.fn().mockResolvedValue(undefined),
  buildFirefoxSeedRedirect: vi.fn().mockResolvedValue(null),
  injectFirefoxSeed: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("registerNavListeners — per-frame resolution", () => {
  const beforeNavigateListeners: NavigationListener[] = [];
  const committedListeners: NavigationListener[] = [];

  beforeEach(() => {
    beforeNavigateListeners.length = 0;
    committedListeners.length = 0;

    vi.stubGlobal("chrome", {
      webNavigation: {
        onBeforeNavigate: {
          addListener: (fn: NavigationListener) => beforeNavigateListeners.push(fn),
        },
        onCommitted: {
          addListener: (fn: NavigationListener) => committedListeners.push(fn),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const fire = async (
    listeners: NavigationListener[],
    details: NavigationDetails,
  ): Promise<void> => {
    for (const listener of listeners) {
      listener(details);
    }
    // Drain the microtask queue so the listeners' async IIFEs settle. The code
    // under test uses no real timers, so ordered microtask flushes are fully
    // deterministic — no wall-clock dependency.
    for (let tick = 0; tick < 10; tick += 1) {
      await Promise.resolve();
    }
  };

  it("resolves the top frame independently and caches it", async () => {
    const resolveRuntimeDecision = vi.fn().mockResolvedValue(londonDecision);
    const cacheDecision = vi.fn();

    const deps = makeDeps({ resolveRuntimeDecision, cacheDecision });
    registerNavListeners(deps);

    await fire(committedListeners, {
      tabId: 1,
      frameId: 0,
      url: "https://publer.com/",
    });

    expect(resolveRuntimeDecision).toHaveBeenCalledWith(
      "publer.com",
      undefined,
      "https://publer.com/",
    );
    expect(cacheDecision).toHaveBeenCalledWith({
      tabId: 1,
      frameId: 0,
      hostname: "publer.com",
      value: londonDecision,
    });
  });

  it("resolves the committed top frame against its current hostname", async () => {
    const resolveRuntimeDecision = vi.fn().mockResolvedValue(londonDecision);
    const cacheDecision = vi.fn();

    const deps = makeDeps({ resolveRuntimeDecision, cacheDecision });
    registerNavListeners(deps);

    await fire(committedListeners, {
      tabId: 1,
      frameId: 0,
      url: "https://publer.com/",
    });

    expect(resolveRuntimeDecision).toHaveBeenCalledWith(
      "publer.com",
      undefined,
      "https://publer.com/",
    );
    expect(cacheDecision).toHaveBeenCalledWith({
      tabId: 1,
      frameId: 0,
      hostname: "publer.com",
      value: londonDecision,
    });
  });

  it.runIf(BUILD_BROWSER_TARGET === "chromium")(
    "does not fetch tab state for Chromium committed frames",
    async () => {
      const getPopupTabById = vi.fn().mockResolvedValue({ cookieStoreId: "ignored" });
      const deps = makeDeps({ getPopupTabById });
      registerNavListeners(deps);

      await fire(committedListeners, {
        tabId: 1,
        frameId: 2,
        url: "https://frame.example/",
      });

      expect(getPopupTabById).not.toHaveBeenCalled();
    },
  );

  it("resolves a cross-origin subframe instead of inheriting the top-frame decision", async () => {
    const resolveRuntimeDecision = vi.fn().mockResolvedValue(berlinDecision);
    const cacheDecision = vi.fn();

    const deps = makeDeps({ resolveRuntimeDecision, cacheDecision });
    registerNavListeners(deps);

    await fire(committedListeners, {
      tabId: 1,
      frameId: 2,
      url: "https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/g/turnstile",
    });

    expect(resolveRuntimeDecision).toHaveBeenCalledWith(
      "challenges.cloudflare.com",
      undefined,
      "https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/g/turnstile",
    );
    expect(cacheDecision).toHaveBeenCalledWith({
      tabId: 1,
      frameId: 2,
      hostname: "challenges.cloudflare.com",
      value: berlinDecision,
    });
  });

  it("binds Chromium injection to the committed document", async () => {
    const injectSnapshot = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({ injectSnapshot });
    registerNavListeners(deps);

    await fire(committedListeners, {
      tabId: 1,
      frameId: 2,
      documentId: "document-a",
      url: "https://example.com/",
    });

    expect(injectSnapshot).toHaveBeenCalledWith(1, 2, berlinDecision, "document-a");
  });

  it("does not cross tab boundaries when resolving a subframe", async () => {
    const resolveRuntimeDecision = vi.fn().mockResolvedValue(berlinDecision);
    const cacheDecision = vi.fn();

    const deps = makeDeps({ resolveRuntimeDecision, cacheDecision });
    registerNavListeners(deps);

    await fire(committedListeners, {
      tabId: 2,
      frameId: 3,
      url: "https://challenges.cloudflare.com/",
    });

    expect(resolveRuntimeDecision).toHaveBeenCalledWith(
      "challenges.cloudflare.com",
      undefined,
      "https://challenges.cloudflare.com/",
    );
    expect(cacheDecision).toHaveBeenCalledWith({
      tabId: 2,
      frameId: 3,
      hostname: "challenges.cloudflare.com",
      value: berlinDecision,
    });
  });

  it("resolves a subframe during onBeforeNavigate", async () => {
    const resolveRuntimeDecision = vi.fn().mockResolvedValue(londonDecision);
    const cacheDecision = vi.fn();

    const deps = makeDeps({ resolveRuntimeDecision, cacheDecision });
    registerNavListeners(deps);

    await fire(beforeNavigateListeners, {
      tabId: 1,
      frameId: 5,
      url: "https://challenges.cloudflare.com/",
    });

    expect(resolveRuntimeDecision).toHaveBeenCalledWith(
      "challenges.cloudflare.com",
      undefined,
      "https://challenges.cloudflare.com/",
    );
    expect(cacheDecision).toHaveBeenCalledWith({
      tabId: 1,
      frameId: 5,
      hostname: "challenges.cloudflare.com",
      value: londonDecision,
    });
  });

  it.runIf(BUILD_BROWSER_TARGET === "chromium")(
    "seeds a cached Chromium decision before asynchronous resolution",
    () => {
      const loadRuntimeCaches = vi.fn().mockResolvedValue(undefined);
      const resolveRuntimeDecision = vi.fn().mockResolvedValue(berlinDecision);
      const seedChromiumSnapshot = vi.fn().mockResolvedValue(undefined);
      const deps = makeDeps({
        loadRuntimeCaches,
        resolveRuntimeDecision,
        readDecisionCache: vi.fn().mockReturnValue(londonDecision),
        seedChromiumSnapshot,
      });
      registerNavListeners(deps);

      beforeNavigateListeners[0]?.({
        tabId: 1,
        frameId: 0,
        url: "https://publer.com/next",
      });

      expect(seedChromiumSnapshot).toHaveBeenCalledWith(1, 0, londonDecision);
      expect(loadRuntimeCaches).not.toHaveBeenCalled();
      expect(resolveRuntimeDecision).not.toHaveBeenCalled();
    },
  );
});
