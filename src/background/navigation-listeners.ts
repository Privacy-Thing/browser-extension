import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { ResolveSnapshotResponse } from "@/shared/types";

type TabWithCookieStore = chrome.tabs.Tab & { cookieStoreId?: string };
type FirefoxRequestDetails = chrome.webRequest.OnBeforeRequestDetails & {
  cookieStoreId?: string;
};
type NavigationTabContext = { tabId: number; hostname: string; cookieStoreId?: string };
type RuntimeDecision = {
  snapshot: ResolveSnapshotResponse["snapshot"];
  trustedSiteMatched: boolean;
};

export type NavigationDeps = {
  listenFirefoxRequest: (
    listener: (
      details: FirefoxRequestDetails,
    ) => Promise<{ redirectUrl: string } | undefined>,
  ) => void;
  clearSurfaceAccess: (tabId: number) => void;
  loadRuntimeCaches: () => Promise<void>;
  getPopupTabById: (
    tabId: number | undefined,
  ) => Promise<TabWithCookieStore | undefined>;
  getExactHostname: (url: string) => string;
  resolveRuntimeDecision: (
    hostname: string,
    cookieStoreId?: string,
    exactOrigin?: string,
  ) => Promise<RuntimeDecision>;
  readDecisionCache: (
    tabId: number,
    frameId: number,
    hostname: string,
    cookieStoreId?: string,
  ) => RuntimeDecision | undefined;
  cacheDecision: (input: {
    tabId: number;
    frameId: number;
    hostname: string;
    value: RuntimeDecision;
    cookieStoreId?: string;
  }) => void;
  injectFirefoxState: (
    tabId: number,
    frameId: number,
    snapshot: ResolveSnapshotResponse["snapshot"],
  ) => Promise<void>;
  seedChromiumSnapshot: (
    tabId: number,
    frameId: number,
    decision: RuntimeDecision,
  ) => Promise<void>;
  cleanFirefoxSeedUrl: (tabId: number, frameId: number, url: string) => Promise<void>;
  injectSnapshot: (
    tabId: number,
    frameId: number,
    decision: RuntimeDecision,
    documentId?: string,
  ) => Promise<void>;
  primeFirefoxSeed: (
    tabId: number,
    frameId: number,
    trigger?: "on-before-navigate" | "on-committed-about-blank",
  ) => void;
  upsertTabContext: (
    tabId: number,
    context: NavigationTabContext,
    snapshot: ResolveSnapshotResponse["snapshot"],
  ) => Promise<void>;
  refreshActionState: (tabId?: number) => Promise<void>;
  buildFirefoxSeedRedirect: (
    url: string,
    cookieStoreId?: string,
    tabId?: number,
  ) => Promise<string | null>;
  injectFirefoxSeed: (input: {
    tabId: number;
    frameId: number;
    cookieStoreId?: string;
    trigger?: "on-before-request" | "on-before-navigate" | "on-committed-about-blank";
    navigationUrl?: string;
  }) => Promise<void>;
};

const registerFirefoxRequest = (deps: NavigationDeps): void => {
  if (BUILD_BROWSER_TARGET !== "firefox") return;
  deps.listenFirefoxRequest(async (details) => {
    const firefoxDetails = details as FirefoxRequestDetails;
    const unsupported =
      firefoxDetails.tabId < 0 ||
      firefoxDetails.frameId !== 0 ||
      (!firefoxDetails.url.startsWith("http://") &&
        !firefoxDetails.url.startsWith("https://"));
    if (unsupported) return undefined;
    await deps.loadRuntimeCaches();
    const redirectUrl =
      firefoxDetails.method.toUpperCase() === "GET"
        ? await deps.buildFirefoxSeedRedirect(
            firefoxDetails.url,
            firefoxDetails.cookieStoreId,
            firefoxDetails.tabId,
          )
        : null;
    if (redirectUrl === null) {
      await deps.injectFirefoxSeed({
        tabId: firefoxDetails.tabId,
        frameId: 0,
        ...(firefoxDetails.cookieStoreId
          ? { cookieStoreId: firefoxDetails.cookieStoreId }
          : {}),
        trigger: "on-before-request",
        navigationUrl: firefoxDetails.url,
      });
    }
    return redirectUrl ? { redirectUrl } : undefined;
  });
};

const registerBeforeNavigate = (deps: NavigationDeps): void => {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (!details.url.startsWith("http://") && !details.url.startsWith("https://")) {
      if (
        BUILD_BROWSER_TARGET === "firefox" &&
        details.frameId === 0 &&
        details.url === "about:blank"
      ) {
        deps.primeFirefoxSeed(details.tabId, details.frameId, "on-before-navigate");
      }
      return;
    }

    // Clear stale page-activity data before the new page loads so the sidebar
    // never shows categories from the previous navigation.
    if (details.frameId === 0) {
      deps.clearSurfaceAccess(details.tabId);
    }

    const hostname = deps.getExactHostname(details.url);
    if (BUILD_BROWSER_TARGET === "chromium") {
      const cachedDecision = deps.readDecisionCache(
        details.tabId,
        details.frameId,
        hostname,
      );
      if (cachedDecision !== undefined) {
        deps
          .seedChromiumSnapshot(details.tabId, details.frameId, cachedDecision)
          .catch(() => undefined);
        return;
      }
    }

    void (async () => {
      await deps.loadRuntimeCaches();

      // cookieStoreId is Firefox-only (container tabs). On Chromium the tabs.get
      // round-trip is pure latency that makes the window.name seed lose its race
      // with the new document's first inline reads — skip it so the seed lands in
      // time and becomes the primary (artifact-free) bootstrap channel.
      const activeTab =
        BUILD_BROWSER_TARGET === "firefox"
          ? await deps.getPopupTabById(details.tabId)
          : undefined;
      // Every HTTP(S) document resolves its own policy. A top-frame decision
      // has no authority over a cross-origin subframe or its Trusted Site state.
      const decision = await deps.resolveRuntimeDecision(
        hostname,
        activeTab?.cookieStoreId,
        details.url,
      );

      deps.cacheDecision({
        tabId: details.tabId,
        frameId: details.frameId,
        hostname,
        value: decision,
        ...(activeTab?.cookieStoreId ? { cookieStoreId: activeTab.cookieStoreId } : {}),
      });

      if (BUILD_BROWSER_TARGET === "firefox") {
        await deps.injectFirefoxState(
          details.tabId,
          details.frameId,
          decision.snapshot,
        );
        return;
      }

      if (BUILD_BROWSER_TARGET !== "chromium") {
        return;
      }

      await deps.seedChromiumSnapshot(details.tabId, details.frameId, decision);
    })();
  });
};

const registerCommitted = (deps: NavigationDeps): void => {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (!details.url.startsWith("http://") && !details.url.startsWith("https://")) {
      if (
        BUILD_BROWSER_TARGET === "firefox" &&
        details.frameId === 0 &&
        details.url === "about:blank"
      ) {
        deps.primeFirefoxSeed(
          details.tabId,
          details.frameId,
          "on-committed-about-blank",
        );
      }
      return;
    }

    void (async () => {
      await deps.loadRuntimeCaches();

      const activeTab =
        BUILD_BROWSER_TARGET === "firefox"
          ? await deps.getPopupTabById(details.tabId)
          : undefined;
      const hostname = deps.getExactHostname(details.url);
      const decision = await deps.resolveRuntimeDecision(
        hostname,
        activeTab?.cookieStoreId,
        details.url,
      );

      deps.cacheDecision({
        tabId: details.tabId,
        frameId: details.frameId,
        hostname,
        value: decision,
        ...(activeTab?.cookieStoreId ? { cookieStoreId: activeTab.cookieStoreId } : {}),
      });
      await Promise.all([
        deps.cleanFirefoxSeedUrl(details.tabId, details.frameId, details.url),
        deps.injectSnapshot(
          details.tabId,
          details.frameId,
          decision,
          details.documentId,
        ),
        deps.injectFirefoxState(details.tabId, details.frameId, decision.snapshot),
      ]);

      if (details.frameId === 0) {
        await deps.upsertTabContext(
          details.tabId,
          {
            tabId: details.tabId,
            hostname,
            ...(activeTab?.cookieStoreId
              ? { cookieStoreId: activeTab.cookieStoreId }
              : {}),
          },
          decision.snapshot,
        );
        await deps.refreshActionState(details.tabId);
      }
    })();
  });
};

export const registerNavListeners = (deps: NavigationDeps): void => {
  registerFirefoxRequest(deps);
  registerBeforeNavigate(deps);
  registerCommitted(deps);
};
