import {
  buildFirefoxShimState,
  parseFirefoxHashSeed,
  type FirefoxWindowSeedState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";

import { firefoxBrowserApi } from "@/background/firefox-browser-api";
import {
  buildFxHashRedirect,
  isFxSameHostNav,
} from "@/background/firefox-hash-navigation";
import { createFxInjection } from "@/background/firefox-injection";
import { createUserScriptRegs } from "@/background/firefox-user-scripts";
import {
  buildWindowSeedLog,
  type WindowSeedTrigger,
} from "@/background/firefox-window-name-seed-log";
import { seedFxWindowState } from "@/background/main-world-injection";
import {
  persistPreparedPreloadStateSafely,
  writePreparedPreloadState,
} from "@/background/preload-persist";
import {
  createPreparedDecisions,
  type PreparedRuntimeDecisions,
} from "@/background/prepared-runtime-decisions";
import type { createRuntimeState } from "@/background/runtime-state";
import { loadContainerAssignments } from "@/background/storage/container-assignments";
import { loadControlState } from "@/background/storage/control-state";
import { loadLocations } from "@/background/storage/locations";
import {
  getDebugMode,
  getFingerprintEnabled,
  getGlobalFallbackRule,
  getPreferences,
  getSharedSpoofing,
  getWatchPositionDelay,
  getWorkerMode,
} from "@/background/storage/preferences";
import { loadRules } from "@/background/storage/rules";
import { loadTrustedSites } from "@/background/storage/trusted-sites";
import { getFxTransportInfo } from "@/injection/firefox/bootstrap-transport-manifest";
import { fireAndForget } from "@/shared/async";
import { readFingerprintSource } from "@/shared/browser-fingerprint";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";

type RuntimeState = ReturnType<typeof createRuntimeState<PreparedRuntimeDecisions>>;
type PopupTab = chrome.tabs.Tab & { cookieStoreId?: string };

type FirefoxBootstrapDeps = {
  runtimeState: RuntimeState;
  getPopupTabById: (tabId?: number) => Promise<PopupTab | undefined>;
  getExactHostname: (url: string) => string;
  isSupportedWebUrl: (url: string | undefined) => url is string;
  logBootstrapEvent: (
    event: string,
    input: {
      hostname?: string;
      tabId?: number;
      details: Record<string, unknown>;
    },
  ) => void;
};

type FxWindowSeedInput = {
  tabId: number;
  frameId: number;
  cookieStoreId?: string;
  trigger?: WindowSeedTrigger;
  navigationUrl?: string;
};

const WINDOW_SEED_PREFIX = "\u001f\u001e";
const MAIN_WORLD = "MAIN" satisfies `${chrome.scripting.ExecutionWorld}`;

const canRequestUserScripts = (): boolean =>
  BUILD_BROWSER_TARGET === "firefox" &&
  Boolean(firefoxBrowserApi?.permissions?.request);

const hasUserScriptsPermission = async (): Promise<boolean> => {
  if (BUILD_BROWSER_TARGET !== "firefox") return false;
  if (firefoxBrowserApi?.userScripts) return true;
  if (!firefoxBrowserApi?.permissions?.contains) return false;
  try {
    return await firefoxBrowserApi.permissions.contains({
      permissions: ["userScripts"],
    });
  } catch {
    return false;
  }
};

const unregisterUserScripts = async (): Promise<void> => {
  if (!firefoxBrowserApi?.userScripts) return;
  try {
    await firefoxBrowserApi.userScripts.unregister();
  } catch {
    // Missing registrations and unavailable API states are harmless.
  }
};

const createUserScriptSync =
  (deps: FirefoxBootstrapDeps) => async (): Promise<string[]> => {
    const { runtimeState, logBootstrapEvent } = deps;
    runtimeState.setKnownUserScriptCount(0);
    runtimeState.setUserScriptSyncOk(false);
    if (!(await hasUserScriptsPermission()) || !firefoxBrowserApi?.userScripts) {
      await unregisterUserScripts();
      logBootstrapEvent("navigation.firefox-userscript-sync", {
        details: { success: false, registrationCount: 0, reason: "unavailable" },
      });
      return [];
    }
    const ruleEntries = runtimeState.getKnownFxSeedEntries();
    if (!ruleEntries) return [];
    try {
      await unregisterUserScripts();
      const registrations = createUserScriptRegs({
        ruleEntries,
        trustedPatterns: (runtimeState.getLastKnownTrustedSites() ?? []).map(
          (site) => site.pattern,
        ),
      });
      if (registrations.length === 0) {
        logBootstrapEvent("navigation.firefox-userscript-sync", {
          details: {
            success: false,
            registrationCount: 0,
            reason: "no-registrations",
          },
        });
        return [];
      }
      await firefoxBrowserApi.userScripts.register(registrations);
      runtimeState.setKnownUserScriptCount(registrations.length);
      runtimeState.setUserScriptSyncOk(true);
      logBootstrapEvent("navigation.firefox-userscript-sync", {
        details: {
          success: true,
          registrationCount: registrations.length,
          reason: "registered",
        },
      });
    } catch (error) {
      console.warn("Failed to sync Firefox userScripts registrations.", error);
      await unregisterUserScripts();
      logBootstrapEvent("navigation.firefox-userscript-sync", {
        details: {
          success: false,
          registrationCount: 0,
          reason: "register-error",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
    return [];
  };

const grantUserScripts = async (): Promise<boolean> => {
  if (BUILD_BROWSER_TARGET !== "firefox") return false;
  if (await hasUserScriptsPermission()) return true;
  if (!canRequestUserScripts()) return false;
  const permissionsApi = firefoxBrowserApi?.permissions;
  if (!permissionsApi?.request) return false;
  try {
    return await permissionsApi.request({ permissions: ["userScripts"] });
  } catch {
    return false;
  }
};

const createPreloadSync =
  (deps: FirefoxBootstrapDeps, syncUserScripts: () => Promise<string[]>) =>
  async (): Promise<void> => {
    const [
      rules,
      trustedSites,
      locations,
      controlState,
      debugMode,
      watchPositionDelay,
      fingerprintEnabled,
      preferences,
      workerMode,
      sharedSpoofing,
      globalFallbackRule,
      fingerprintSource,
      containerAssignments,
    ] = await Promise.all([
      loadRules(),
      loadTrustedSites(),
      loadLocations(),
      loadControlState(),
      getDebugMode(),
      getWatchPositionDelay(),
      getFingerprintEnabled(),
      getPreferences(),
      getWorkerMode(),
      getSharedSpoofing(),
      getGlobalFallbackRule(),
      readFingerprintSource(),
      loadContainerAssignments(),
    ]);
    const prepared = createPreparedDecisions({
      rules,
      trustedSites,
      locations,
      controlState,
      debugMode,
      watchPositionDelay,
      fingerprintEnabled,
      featureFlags: preferences.featureFlags,
      sharedWorkerHandlingMode: workerMode,
      sharedSpoofing,
      globalFallbackRule,
      browserFingerprintSource: fingerprintSource,
      containerAssignments,
    });
    deps.runtimeState.setLastKnownTrustedSites(trustedSites);
    const preloadedEntries = prepared.getPreloadedEntries();
    deps.runtimeState.setKnownFxSeedEntries(
      preloadedEntries.map((entry) => ({
        pattern: entry.pattern,
        state: buildFirefoxShimState(entry.snapshot),
      })),
    );
    deps.runtimeState.setPreparedRuntimeDecisions(prepared);
    await writePreparedPreloadState(prepared, trustedSites);
    if (BUILD_BROWSER_TARGET === "firefox") await syncUserScripts();
  };

const logSeedFailure = async (
  deps: FirefoxBootstrapDeps,
  input: Required<Pick<FxWindowSeedInput, "tabId" | "frameId">> &
    Pick<FxWindowSeedInput, "navigationUrl"> & {
      trigger: WindowSeedTrigger;
      cookieStoreId: string | undefined;
      error: unknown;
    },
): Promise<void> => {
  if (
    input.trigger === "on-before-navigate" &&
    input.navigationUrl === undefined &&
    input.error instanceof Error &&
    input.error.message === "Missing host permission for the tab"
  ) {
    deps.logBootstrapEvent("navigation.firefox-window-name-seed", {
      tabId: input.tabId,
      details: buildWindowSeedLog({
        outcome: "about-blank-seed-unavailable",
        frameId: input.frameId,
        cookieStoreId: input.cookieStoreId,
        trigger: input.trigger,
      }),
    });
    return;
  }
  const tab = await deps.getPopupTabById(input.tabId);
  const tabDiagnostics = tab
    ? {
        ...(typeof tab.url === "string" ? { url: tab.url } : {}),
        ...(typeof tab.pendingUrl === "string" ? { pendingUrl: tab.pendingUrl } : {}),
        ...(typeof tab.status === "string" ? { status: tab.status } : {}),
        ...(typeof tab.discarded === "boolean" ? { discarded: tab.discarded } : {}),
        ...(typeof tab.cookieStoreId === "string"
          ? { cookieStoreId: tab.cookieStoreId }
          : {}),
      }
    : undefined;
  deps.logBootstrapEvent("navigation.firefox-window-name-seed", {
    tabId: input.tabId,
    details: buildWindowSeedLog({
      outcome: "execute-script-failed",
      frameId: input.frameId,
      cookieStoreId: input.cookieStoreId,
      trigger: input.trigger,
      error: input.error,
      ...(tabDiagnostics ? { tab: tabDiagnostics } : {}),
    }),
  });
};

const createWindowSeed =
  (deps: FirefoxBootstrapDeps, syncPreloadedState: () => Promise<void>) =>
  async ({
    tabId,
    frameId,
    cookieStoreId,
    trigger = "on-before-navigate",
    navigationUrl,
  }: FxWindowSeedInput): Promise<void> => {
    if (BUILD_BROWSER_TARGET !== "firefox" || frameId !== 0) return;
    let resolvedCookieStoreId = cookieStoreId;
    try {
      const liveTab =
        cookieStoreId === undefined && deps.isSupportedWebUrl(navigationUrl)
          ? await deps.getPopupTabById(tabId)
          : undefined;
      resolvedCookieStoreId = cookieStoreId ?? liveTab?.cookieStoreId;
      const hostname =
        navigationUrl && deps.isSupportedWebUrl(navigationUrl)
          ? deps.getExactHostname(navigationUrl)
          : undefined;
      const seedHostname = hostname || undefined;
      let seedState =
        deps.runtimeState
          .getPreparedDecisions()
          ?.getFxWindowSeed(resolvedCookieStoreId, seedHostname) ?? null;
      if (!seedState) {
        await syncPreloadedState();
        seedState =
          deps.runtimeState
            .getPreparedDecisions()
            ?.getFxWindowSeed(resolvedCookieStoreId, seedHostname) ?? null;
      }
      if (seedHostname) {
        await persistPreparedPreloadStateSafely(deps.runtimeState);
      }
      if (!seedState) {
        deps.logBootstrapEvent("navigation.firefox-window-name-seed", {
          tabId,
          details: buildWindowSeedLog({
            outcome: "missing-seed-state",
            frameId,
            cookieStoreId: resolvedCookieStoreId,
            trigger,
          }),
        });
        return;
      }
      if (hostname && deps.isSupportedWebUrl(navigationUrl)) {
        if (parseFirefoxHashSeed(new URL(navigationUrl).hash) !== null) {
          deps.logBootstrapEvent("navigation.firefox-window-name-seed", {
            tabId,
            hostname,
            details: buildWindowSeedLog({
              outcome: "hash-transport-preferred",
              frameId,
              cookieStoreId: resolvedCookieStoreId,
              trigger,
              hostname,
            }),
          });
          return;
        }
      }
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        world: MAIN_WORLD,
        injectImmediately: true,
        func: seedFxWindowState,
        args: [seedState, WINDOW_SEED_PREFIX, __PT_SHIM_GUARD_KEY__],
      } as chrome.scripting.ScriptInjection<
        [FirefoxWindowSeedState, string, string],
        void
      > & { injectImmediately: boolean });
      deps.logBootstrapEvent("navigation.firefox-window-name-seed", {
        tabId,
        details: buildWindowSeedLog({
          outcome: "success",
          frameId,
          cookieStoreId: resolvedCookieStoreId,
          trigger,
          seedState,
        }),
      });
    } catch (error) {
      await logSeedFailure(deps, {
        tabId,
        frameId,
        ...(navigationUrl ? { navigationUrl } : {}),
        trigger,
        cookieStoreId: resolvedCookieStoreId,
        error,
      });
    }
  };

export const createFxBootstrap = (deps: FirefoxBootstrapDeps) => {
  const syncUserScripts = createUserScriptSync(deps);
  const syncPreloadedState = createPreloadSync(deps, syncUserScripts);
  const injectFxWindowSeed = createWindowSeed(deps, syncPreloadedState);
  const { refreshFxInjectionMode } = createFxInjection({
    mainWorld: MAIN_WORLD,
    hasUserScriptsPermission,
    syncFirefoxUserScripts: syncUserScripts,
    unregisterUserScripts,
  });
  const primeFxWindowSeed = (
    tabId: number,
    frameId: number,
    trigger: WindowSeedTrigger = "on-committed-about-blank",
  ): void => {
    if (BUILD_BROWSER_TARGET !== "firefox") return;
    const cachedContext = deps.runtimeState.activeTabContexts.get(tabId);
    if (cachedContext) {
      fireAndForget(
        injectFxWindowSeed({
          tabId,
          frameId,
          ...(cachedContext.cookieStoreId
            ? { cookieStoreId: cachedContext.cookieStoreId }
            : {}),
          trigger,
        }),
      );
      return;
    }
    fireAndForget(
      deps
        .getPopupTabById(tabId)
        .then((tab) =>
          injectFxWindowSeed({
            tabId,
            frameId,
            ...(tab?.cookieStoreId ? { cookieStoreId: tab.cookieStoreId } : {}),
            trigger,
          }),
        )
        .catch(() => undefined),
    );
  };
  const maybeBuildFxRedirect = async (
    url: string,
    cookieStoreId?: string,
    tabId?: number,
  ): Promise<string | null> => {
    if (BUILD_BROWSER_TARGET !== "firefox") return null;
    const hostname = deps.getExactHostname(url);
    const seedHostname = hostname || undefined;
    let seedState =
      deps.runtimeState
        .getPreparedDecisions()
        ?.getFxWindowSeed(cookieStoreId, seedHostname) ?? null;
    if (!seedState) {
      await syncPreloadedState();
      seedState =
        deps.runtimeState
          .getPreparedDecisions()
          ?.getFxWindowSeed(cookieStoreId, seedHostname) ?? null;
    }
    if (seedHostname) {
      await persistPreparedPreloadStateSafely(deps.runtimeState);
    }
    const activeTab = await deps.getPopupTabById(tabId);
    let skipSameHostDocument: boolean;
    try {
      skipSameHostDocument = isFxSameHostNav(new URL(url), activeTab?.url);
    } catch {
      skipSameHostDocument = false;
    }
    const redirectUrl = buildFxHashRedirect({
      ...(activeTab?.url ? { currentTabUrl: activeTab.url } : {}),
      method: "GET",
      url,
      seedState,
    });
    deps.logBootstrapEvent("navigation.firefox-hash-seed-decision", {
      hostname,
      details: {
        builtRedirect: redirectUrl !== null,
        hasSeedState: seedState !== null,
        cookieStoreId: cookieStoreId ?? null,
        skipSameHostDocument,
        hashTransportPrecedence: getFxTransportInfo("hash").precedence,
        hashTransportStatus: getFxTransportInfo("hash").status,
        windowNameTransportPrecedence: getFxTransportInfo("windowName").precedence,
        windowNameTransportStatus: getFxTransportInfo("windowName").status,
        staticTransportPrecedence: getFxTransportInfo("static").precedence,
        staticTransportStatus: getFxTransportInfo("static").status,
        userScriptSelectionScope: getFxTransportInfo("userScript").selectionScope,
        userScriptTransportStatus: getFxTransportInfo("userScript").status,
        userScriptRegistrationCount: deps.runtimeState.getKnownUserScriptCount(),
        userScriptSyncSucceeded: deps.runtimeState.getUserScriptSyncOk(),
      },
    });
    return redirectUrl;
  };
  return {
    canRequestUserScripts,
    hasUserScriptsPermission,
    grantUserScripts,
    refreshFxInjectionMode,
    syncPreloadedState,
    injectFxWindowSeed,
    primeFxWindowSeed,
    maybeBuildFxRedirect,
  };
};
