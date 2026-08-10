import { ACTION_ICON_PATHS, toExtensionIconPaths } from "@/background/action-icons";
import { createActionHandlers } from "@/background/action-state-commands";
import {
  createBackgroundLogs,
  findDisplayedRule,
  getExactHostname,
  getPopupTabById,
  isSupportedWebUrl,
  resolveFallbackId,
  resolveTrackedIdentity,
} from "@/background/background-composition-helpers";
import { createSettingsApi } from "@/background/background-settings-api";
import { createCachedStateLoader } from "@/background/cached-settings-loader";
import { createCleanupHandlers } from "@/background/cleanup-commands";
import { syncDynamicHeaderRules } from "@/background/dnr";
import { createFxBootstrap } from "@/background/firefox-bootstrap-controller";
import { firefoxBrowserApi } from "@/background/firefox-browser-api";
import { configureFxTestCookie } from "@/background/firefox-test-cookie";
import { registerLifecycle } from "@/background/lifecycle-listeners";
import { createLocationDrafts } from "@/background/location-draft-commands";
import { logExtensionEvent } from "@/background/logger";
import { seedWindowSnapshot } from "@/background/main-world-injection";
import { registerMessageRouter } from "@/background/message-router";
import { runStorageMigration } from "@/background/migrations";
import { registerNavListeners } from "@/background/navigation-listeners";
import { createPopupHandlers } from "@/background/popup-commands";
import type { PreparedRuntimeDecisions } from "@/background/prepared-runtime-decisions";
import { applyPrivacyDefaults } from "@/background/privacy";
import { createRuntimeConfig } from "@/background/runtime-config-controller";
import { registerRuntimeObservers } from "@/background/runtime-observers";
import { createRuntimeResolverCtl } from "@/background/runtime-resolution-controller";
import { createRuntimeState } from "@/background/runtime-state";
import { createSettingsHandlers } from "@/background/settings-commands";
import {
  publishSidebarEvent,
  registerSidebarEventHub,
} from "@/background/sidebar-event-hub";
import { registerSidebarMenu, syncSidebarMenus } from "@/background/sidebar-menus";
import {
  markNoticeRead as markNoticeReadStore,
  markNoticesAutoPresented as markNoticesAutoPresentedStore,
  resolvePopupNotification as resolvePopupNotificationStore,
  syncUpdateNotices,
} from "@/background/storage/popup-notifications";
import { getOnboardingCompleted } from "@/background/storage/preferences";
import {
  setTrustedSiteEnabled,
  upsertTrustedSite,
} from "@/background/storage/trusted-sites";
import {
  clearSurfaceAccess,
  clearSurfaceErrors,
  getSurfaceAccess,
  getSurfaceCounts,
  getSurfaceErrors,
  getSurfaceMethodCounts,
  recordMethodCounts,
  recordSurfaceAccess,
  recordSurfaceCounts,
  recordSurfaceError,
} from "@/background/surface-access-tracker";
import {
  clearSurfaceEvidence,
  getRealmEvidence,
  recordSurfaceEvidence,
} from "@/background/surface-evidence-tracker";
import { createXRayHandlers } from "@/background/xray-commands";
import { fireAndForget } from "@/shared/async";
import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { BUILD_BROWSER_TARGET, BUILD_CHANNEL } from "@/shared/build-flags";
import { CMD_GET_SURFACE_USAGE } from "@/shared/extension-contract";
import { getAllReleaseNotices } from "@/shared/release-notification";

const runtimeState = createRuntimeState<PreparedRuntimeDecisions>();
const { activeTabContexts, effectiveSnapshotCache, rewriteTracker } = runtimeState;
let storageMigrationPromise: Promise<void> | null = null;

const { logFirefoxBootstrapEvent, logResolverEvent } = createBackgroundLogs(
  runtimeState.getLastKnownDebugMode,
);

const WINDOW_SEED_PREFIX = "\u001f\u001e";
const MAIN_WORLD = "MAIN" satisfies `${chrome.scripting.ExecutionWorld}`;
const ensureStorageMigration = async (): Promise<void> => {
  if (!storageMigrationPromise) {
    storageMigrationPromise = runStorageMigration().then(() => undefined);
  }

  await storageMigrationPromise;
};

const enableSessionStorage = async (): Promise<void> => {
  await chrome.storage.session
    .setAccessLevel?.({
      accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" as chrome.storage.AccessLevel,
    })
    .catch(() => undefined);
};

const {
  canRequestUserScripts,
  hasUserScriptsPermission,
  grantUserScripts,
  refreshFxInjectionMode,
  syncPreloadedState,
  injectFxWindowSeed,
  primeFxWindowSeed,
  maybeBuildFxRedirect,
} = createFxBootstrap({
  runtimeState,
  getPopupTabById,
  getExactHostname,
  isSupportedWebUrl,
  logBootstrapEvent: logFirefoxBootstrapEvent,
});

const reloadSupportedWebTabs = async (tabIds: readonly number[]): Promise<void> => {
  const uniqueTabIds = [...new Set(tabIds)];
  let prunedStaleContext = false;

  await Promise.all(
    uniqueTabIds.map(async (tabId) => {
      const tab = await chrome.tabs.get(tabId).catch(() => undefined);
      if (!isSupportedWebUrl(tab?.url)) {
        prunedStaleContext = activeTabContexts.delete(tabId) || prunedStaleContext;
        return;
      }

      await chrome.tabs.reload(tabId).catch(() => undefined);
    }),
  );

  if (prunedStaleContext) {
    await syncDynamicHeaderRules([...activeTabContexts.values()]);
  }
};

const getCachedState = createCachedStateLoader(runtimeState);

const {
  refreshActionState,
  refreshBadgeCountForTab,
  scheduleBadgeRefresh,
  clearBadgeRefreshTimer,
} = createActionHandlers({
  actionIconPaths: ACTION_ICON_PATHS,
  findDisplayedRule,
  getCachedState,
  getExactHostname,
  getDateBadgeSetting: runtimeState.getDateBadgeSetting,
  getBadgeCountSetting: runtimeState.getBadgeCountSetting,
  getSurfaceAccess,
  getSurfaceErrors,
  getRealmEvidence,
  isSupportedWebUrl,
  logExtensionEvent,
  resolveFallbackId,
  toExtensionIconPaths,
});

const {
  resolveRuntimeDecision,
  resolveCachedSnapshot,
  updateSnapshotCache,
  resyncActiveHeaderRules,
  readSnapshotCache,
  readDecisionCache,
  recordRewriteCandidate,
  getSharedWorkerStatus,
  registerRewriteListeners,
  removeTabSnapshots,
  injectFrameSnapshot,
  seedChromiumWindow,
  injectFxEarlyState,
  cleanupFxHashUrl,
  handleResolveSnapshot,
} = createRuntimeResolverCtl({
  runtimeState,
  getCachedState,
  syncPreloadedState,
  ensureStorageMigration,
  resolveFallbackId,
  logResolverEvent,
  clearBadgeRefreshTimer,
});

const { setPanicMode, getControlState, getSettings, getLogs, clearLogs } =
  createSettingsApi({
    runtimeState,
    ensureStorageMigration,
    syncPreloadedState,
    refreshActionState,
  });

const {
  getCleanupAssociations,
  handleCleanupDomainState,
  rotateIdentity,
  previewIdentityCleanup,
  removeCleanupContexts,
} = createCleanupHandlers({
  clearSnapshotCache: effectiveSnapshotCache.clear,
  ensureStorageMigration,
  getActiveTabContexts: runtimeState.getActiveTabContexts,
  getLastKnownDebugMode: runtimeState.getLastKnownDebugMode,
  getPopupTabById,
  isSupportedWebUrl,
  logExtensionEvent,
  refreshActionState,
  reloadSupportedWebTabs,
  removeActiveTabContext: (tabId) => {
    activeTabContexts.delete(tabId);
  },
  resolveTrackedIdentity,
  setKnownContainers: runtimeState.setKnownContainers,
  setLastKnownRules: runtimeState.setLastKnownRules,
  syncPreloadedState,
});

const { createLocationDraft, createDraftFromCandidate } = createLocationDrafts({
  ensureStorageMigration,
  setLastKnownProfiles: runtimeState.setLastKnownProfiles,
});

const {
  upsertTabContext,
  removeTabContext,
  refreshCachedConfig,
  ensureRuntimeCache,
  provisionContainers,
  reconcileContainers,
  removeHostnameContexts,
  handleConfigMutation,
} = createRuntimeConfig({
  runtimeState,
  ensureStorageMigration,
  syncPreloadedState,
  reloadSupportedWebTabs,
  refreshActionState,
  removeCleanupContexts,
  logExtensionEvent,
});

const { getXRayState } = createXRayHandlers({
  isSupportedWebUrl,
  getExactHostname,
  getPopupTabById,
  readSnapshotCache,
  resolveSnapshot: async (hostname, cookieStoreId) => {
    const decision = await resolveRuntimeDecision(hostname, cookieStoreId);
    return decision.snapshot ?? null;
  },
  getLastKnownProfiles: () => runtimeState.getLastKnownProfiles() ?? [],
  getLastKnownRules: () => runtimeState.getLastKnownRules() ?? [],
  getKnownContainers: () => runtimeState.getKnownContainers() ?? [],
  getKnownFallback: () => runtimeState.getKnownFallback(),
  getLastKnownTrustedSites: () => runtimeState.getLastKnownTrustedSites() ?? [],
  getSurfaceAccess,
  getSurfaceErrors,
  getRealmEvidence,
  getSurfaceCounts,
  getSurfaceMethodCounts,
  getSharedWorkerStatus,
  getFingerprintEnabled: () => runtimeState.getKnownFingerprintEnabled() ?? false,
  resolveFallbackId,
});

const {
  getPopupState,
  requestUserScriptsAccess,
  assignDomainLocation,
  updateCurrentRule,
  applyPopupSuggestion,
  applyPopupPolicyAction,
  dismissPopupSuggestion,
  toggleCurrentRule,
  deleteCurrentRule,
} = createPopupHandlers({
  ensureStorageMigration,
  getPopupTabById,
  isSupportedWebUrl,
  getExactHostname,
  getSurfaceAccess,
  getSurfaceErrors,
  getRealmEvidence,
  getSurfaceCounts,
  getSurfaceMethodCounts,
  resolveFallbackId,
  canRequestUserScripts,
  hasUserScriptsPermission,
  setLastKnownProfiles: runtimeState.setLastKnownProfiles,
  setLastKnownRules: runtimeState.setLastKnownRules,
  setLastKnownControlState: runtimeState.setLastKnownControlState,
  setLastKnownDebugMode: runtimeState.setLastKnownDebugMode,
  setKnownContainers: runtimeState.setKnownContainers,
  setKnownFallback: runtimeState.setKnownFallback,
  getLastKnownDebugMode: runtimeState.getLastKnownDebugMode,
  refreshActionState,
  grantUserScripts,
  refreshCachedConfig,
  syncPreloadedState,
  refreshFxInjectionMode,
  removeHostnameContexts,
  getActiveTabContexts: runtimeState.getActiveTabContexts,
  resolveCachedSnapshot,
  updateSnapshotCache,
  injectFxWindowSeed,
  seedWindowSnapshot,
  mainWorld: MAIN_WORLD,
  runtimeWindowSeedPrefix: WINDOW_SEED_PREFIX,
  logExtensionEvent: logExtensionEvent,
});

const {
  exportSettings,
  saveSimpleSettings,
  saveLocationModel,
  resetSettings,
  importSettings,
} = createSettingsHandlers({
  ensureStorageMigration,
  syncPreloadedState,
  resyncActiveHeaderRules,
  refreshFxInjectionMode,
  getActiveTabContexts: runtimeState.getActiveTabContexts,
  reloadTabs: reloadSupportedWebTabs,
  getCachedValues: runtimeState.getCachedValues,
  setCachedValues: (values) => {
    runtimeState.setCachedValues(values);
    if (Object.hasOwn(values, "debugMode")) {
      void syncSidebarMenus(() => runtimeState.getLastKnownDebugMode() ?? false);
    }
  },
});

// Blocking Firefox webRequest listeners must exist before content-script
// messages can reach the background router.
registerRewriteListeners();

registerMessageRouter({
  isSupportedWebUrl,
  getControlState,
  getSettings,
  getPopupState,
  markNoticeRead: async (id) => {
    const notification = await markNoticeReadStore(id);
    await refreshActionState();
    return { ok: true, notification };
  },
  markNoticesAutoPresented: async (ids) => {
    const notifications = await markNoticesAutoPresentedStore(ids);
    return { ok: true, notifications };
  },
  resolvePopupNotification: async (id) => {
    const notification = await resolvePopupNotificationStore(id);
    await refreshActionState();
    return { ok: true, notification };
  },
  upsertTrustedSite: async (hostname, tabId) => {
    const trustedSites = await upsertTrustedSite(hostname);
    runtimeState.setLastKnownTrustedSites(trustedSites);
    await refreshCachedConfig();
    await syncPreloadedState();
    await resyncActiveHeaderRules();
    removeHostnameContexts(hostname);
    if (tabId !== undefined) await chrome.tabs.reload(tabId);
    await refreshActionState(tabId);
    return { ok: true };
  },
  setTrustedSiteEnabled: async (pattern, enabled, tabId) => {
    const trustedSites = await setTrustedSiteEnabled(pattern, enabled);
    runtimeState.setLastKnownTrustedSites(trustedSites);
    await refreshCachedConfig();
    await syncPreloadedState();
    await resyncActiveHeaderRules();
    const targetTab = tabId === undefined ? undefined : await chrome.tabs.get(tabId);
    if (targetTab?.url && isSupportedWebUrl(targetTab.url)) {
      removeHostnameContexts(getExactHostname(targetTab.url));
    }
    if (tabId !== undefined) await chrome.tabs.reload(tabId);
    await refreshActionState(tabId);
    return {
      ok: true,
      state: (await getPopupState(tabId)).state,
    };
  },
  getUserScriptsStatus: async () => ({
    ok: true,
    readiness: {
      hasPermission: await hasUserScriptsPermission(),
      registrationCount: runtimeState.getKnownUserScriptCount(),
      lastSyncSucceeded: runtimeState.getUserScriptSyncOk(),
      ready:
        runtimeState.getKnownUserScriptCount() > 0 &&
        runtimeState.getUserScriptSyncOk(),
    },
  }),
  requestUserScriptsAccess,
  assignDomainLocation,
  updateCurrentRule,
  toggleCurrentRule,
  deleteCurrentRule,
  applyPopupSuggestion,
  applyPopupPolicyAction,
  dismissPopupSuggestion,
  createLocationDraft,
  createDraftFromCandidate,
  saveSimpleSettings: async (command) => {
    const response = await saveSimpleSettings(command);
    if (
      response.ok &&
      (Object.hasOwn(command, "showBadgeQueryCount") ||
        Object.hasOwn(command, "includeDateCallsInBadgeCount"))
    ) {
      fireAndForget(refreshActionState());
    }
    return response;
  },
  saveLocationModel,
  resetSettings,
  exportSettings,
  importSettings,
  ensureStorageMigration,
  setLastKnownProfiles: runtimeState.setLastKnownProfiles,
  syncPreloadedState,
  resyncActiveHeaderRules,
  setPanicMode,
  handleCleanupDomainState,
  getCleanupAssociations,
  previewIdentityCleanup,
  rotateIdentity,
  getLogs,
  clearLogs,
  configureFxTestCookie,
  getLastKnownDebugMode: () => runtimeState.getLastKnownDebugMode(),
  getXRayState,
  recordRewriteCandidate: (input) => {
    recordRewriteCandidate(input);
    publishSidebarEvent({
      type: "doctor-state-invalidated",
      tabId: input.tabId,
    });
  },
  recordSurfaceUsage: ({ tabId, categories, sourceKey, counts, methodCounts }) => {
    const previousCategories = getSurfaceAccess(tabId);
    const foundWorkerSurface = categories.some(
      (category) =>
        (category === "serviceWorker" || category === "sharedWorker") &&
        previousCategories[category] !== true,
    );
    recordSurfaceAccess(tabId, categories);
    if (counts) recordSurfaceCounts(tabId, counts, sourceKey);
    if (methodCounts) recordMethodCounts(tabId, methodCounts, sourceKey);
    const queryCounts = getSurfaceCounts(tabId);
    const aggregatedMethodCounts = getSurfaceMethodCounts(tabId);
    const hasQueryCounts = Object.keys(queryCounts).length > 0;
    const hasMethodCounts = Object.keys(aggregatedMethodCounts).length > 0;
    publishSidebarEvent({
      type: "surface-usage-updated",
      tabId,
      categories: [...categories],
      ...(hasQueryCounts ? { queryCounts } : {}),
      ...(hasMethodCounts ? { methodCounts: aggregatedMethodCounts } : {}),
    });
    if (foundWorkerSurface) {
      fireAndForget(refreshActionState(tabId));
    }
  },
  recordSurfaceError: (tabId, categories) => {
    recordSurfaceError(tabId, categories);
    publishSidebarEvent({ type: "doctor-state-invalidated", tabId });
    fireAndForget(refreshActionState(tabId));
  },
  recordSurfaceEvidence: (tabId, category, evidence) => {
    recordSurfaceEvidence(tabId, category, evidence);
    publishSidebarEvent({ type: "doctor-state-invalidated", tabId });
    fireAndForget(refreshActionState(tabId));
  },
  recordSurfaceCounts,
  refreshBadgeCount: scheduleBadgeRefresh,
  upsertTabContext,
  readSnapshotCache,
  updateSnapshotCache,
  handleResolveSnapshot,
});

registerLifecycle({
  ensureStorageMigration,
  enableSessionStorage,
  syncDynamicHeaderRules,
  getActiveTabContexts: runtimeState.getActiveTabContexts,
  applyPrivacyDefaults,
  refreshCachedConfig,
  syncPreloadedState,
  provisionContainers,
  reconcileContainers,
  refreshActionState,
  refreshFxInjectionMode,
  syncSidebarMenus: () =>
    syncSidebarMenus(() => runtimeState.getLastKnownDebugMode() ?? false),
  registerSidebarHandler: () => {
    registerSidebarMenu(() => runtimeState.getLastKnownDebugMode() ?? false);
    registerSidebarEventHub();
  },
  logInstalled: () => {
    console.info(`${BRAND_DISPLAY_NAME} installed`);
  },
  getOnboardingCompleted,
  openOnboardingPage: () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("src/ui/options/index.html?onboarding=1"),
    });
  },
  syncSignificantUpdates: async (version, includeCurrent) => {
    await syncUpdateNotices({
      notifications: getAllReleaseNotices(),
      buildChannel: BUILD_CHANNEL,
      currentVersion: version,
      includeCurrent,
    });
  },
});

if (BUILD_BROWSER_TARGET === "firefox") {
  fireAndForget(
    refreshFxInjectionMode().catch((error) => {
      console.warn("Failed to register Firefox injection scripts", error);
    }),
  );
}

registerNavListeners({
  clearSurfaceAccess: (tabId) => {
    clearSurfaceAccess(tabId);
    clearSurfaceErrors(tabId);
    clearSurfaceEvidence(tabId);
    rewriteTracker.clearTab(tabId);
    publishSidebarEvent({ type: "doctor-state-invalidated", tabId });
  },
  listenFirefoxRequest: (listener) => {
    firefoxBrowserApi?.webRequest?.onBeforeRequest?.addListener(
      listener,
      {
        // Firefox URL match patterns need explicit protocol coverage here.
        // eslint-disable-next-line sonarjs/no-clear-text-protocols
        urls: ["http://*/*", "https://*/*"],
        types: ["main_frame"],
      },
      ["blocking"],
    );
  },
  loadRuntimeCaches: ensureRuntimeCache,
  getPopupTabById,
  getExactHostname,
  resolveRuntimeDecision,
  readDecisionCache,
  cacheDecision: updateSnapshotCache,
  injectFirefoxState: injectFxEarlyState,
  seedChromiumSnapshot: seedChromiumWindow,
  cleanFirefoxSeedUrl: cleanupFxHashUrl,
  injectSnapshot: injectFrameSnapshot,
  primeFirefoxSeed: primeFxWindowSeed,
  upsertTabContext,
  refreshActionState,
  buildFirefoxSeedRedirect: maybeBuildFxRedirect,
  injectFirefoxSeed: injectFxWindowSeed,
});

registerRuntimeObservers({
  removeTabSnapshots,
  removeTabContext,
  refreshActionState,
  isSupportedWebUrl,
  handleConfigMutation,
  setLastKnownRules: runtimeState.setLastKnownRules,
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return;
  const { tabId } = details;
  fireAndForget(
    chrome.tabs
      .sendMessage(tabId, { type: CMD_GET_SURFACE_USAGE })
      .catch(() => undefined),
  );
  fireAndForget(refreshBadgeCountForTab(tabId));
});
