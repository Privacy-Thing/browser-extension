import { collectAffectedHostnames } from "@/background/config-watch";
import { syncContextHeaderRule, syncDynamicHeaderRules } from "@/background/dnr";
import type { logExtensionEvent } from "@/background/logger";
import type { PreparedRuntimeDecisions } from "@/background/prepared-runtime-decisions";
import type { resolveProfileSnapshot } from "@/background/rules/resolver";
import type { createRuntimeState } from "@/background/runtime-state";
import { getRegistrableHostname } from "@/background/state-hygiene";
import {
  loadContainerAssignments,
  saveContainerAssignments,
} from "@/background/storage/container-assignments";
import { loadControlState } from "@/background/storage/control-state";
import { loadLocations } from "@/background/storage/locations";
import {
  getDebugMode,
  getFingerprintEnabled,
  getOsmConsent,
  getThemeAccentPreset,
  getThemeMode,
  getWatchPositionDelay,
  getWorkerMode,
} from "@/background/storage/preferences";
import { loadRules } from "@/background/storage/rules";
import { loadTrustedSites } from "@/background/storage/trusted-sites";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { listContainers, reconcileAssignments } from "@/shared/container-service";
import { LogCategory, type EffectiveTabContext } from "@/shared/types";

type RuntimeState = ReturnType<typeof createRuntimeState<PreparedRuntimeDecisions>>;

type RuntimeConfigDeps = {
  runtimeState: RuntimeState;
  ensureStorageMigration: () => Promise<void>;
  syncPreloadedState: () => Promise<void>;
  reloadSupportedWebTabs: (tabIds: readonly number[]) => Promise<void>;
  refreshActionState: () => Promise<void>;
  removeCleanupContexts: (hostnames: readonly string[]) => number[];
  logExtensionEvent: typeof logExtensionEvent;
};

const upsertTabContext = async (
  deps: RuntimeConfigDeps,
  tabId: number,
  context: EffectiveTabContext,
  snapshot?: ReturnType<typeof resolveProfileSnapshot>,
): Promise<void> => {
  deps.runtimeState.activeTabContexts.set(tabId, context);
  if (snapshot === undefined) {
    await syncDynamicHeaderRules(deps.runtimeState.getActiveTabContexts());
  } else {
    await syncContextHeaderRule(context, snapshot);
  }
  deps.logExtensionEvent({
    enabled: deps.runtimeState.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "navigation.tab-context-upserted",
    payload: { hostname: context.hostname, tabId },
  });
};
const removeTabContext = async (
  deps: RuntimeConfigDeps,
  tabId: number,
): Promise<void> => {
  deps.runtimeState.activeTabContexts.delete(tabId);
  await syncDynamicHeaderRules(deps.runtimeState.getActiveTabContexts());
  deps.logExtensionEvent({
    enabled: deps.runtimeState.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "navigation.tab-context-removed",
    payload: { tabId },
  });
};
const refreshCachedConfig = async (deps: RuntimeConfigDeps): Promise<void> => {
  const [
    profiles,
    rules,
    controlState,
    themeMode,
    themeAccentPreset,
    debugMode,
    watchPositionDelay,
    osmConsent,
    fingerprintEnabled,
    workerMode,
    trustedSites,
  ] = await Promise.all([
    loadLocations(),
    loadRules(),
    loadControlState(),
    getThemeMode(),
    getThemeAccentPreset(),
    getDebugMode(),
    getWatchPositionDelay(),
    getOsmConsent(),
    getFingerprintEnabled(),
    getWorkerMode(),
    loadTrustedSites(),
  ]);
  deps.runtimeState.setCachedValues({
    profiles,
    rules,
    trustedSites,
    themeMode,
    themeAccentPreset,
    debugMode,
    watchPositionDelay,
    osmConsent,
    browserFingerprintSpoofingEnabled: fingerprintEnabled,
    sharedWorkerHandlingMode: workerMode,
    sharedWorkerCompatibilityMode: workerMode === "native",
  });
  deps.runtimeState.setLastKnownControlState(controlState);
};
const ensureRuntimeCache = async (deps: RuntimeConfigDeps): Promise<void> => {
  if (
    !deps.runtimeState.getLastKnownProfiles() ||
    !deps.runtimeState.getLastKnownRules() ||
    !deps.runtimeState.getLastKnownControlState() ||
    !deps.runtimeState.getPreparedDecisions()
  ) {
    await deps.ensureStorageMigration();
    await refreshCachedConfig(deps);
    await deps.syncPreloadedState();
  }
};
const provisionContainers = async (_deps: RuntimeConfigDeps): Promise<boolean> => {
  if (BUILD_BROWSER_TARGET !== "firefox") return false;
  const catalog = await listContainers();
  if (!catalog.available) return false;
  const assignments = await loadContainerAssignments();
  const { next, changed } = reconcileAssignments(assignments, catalog.containers);
  if (!changed) return false;
  await saveContainerAssignments(next);
  return true;
};
const reconcileContainers = async (deps: RuntimeConfigDeps): Promise<void> => {
  if (await provisionContainers(deps)) {
    await refreshCachedConfig(deps);
    await deps.syncPreloadedState();
  }
};
const removeHostnameContexts = (deps: RuntimeConfigDeps, hostname: string): void => {
  const normalizedHostname = getRegistrableHostname(hostname);
  for (const [tabId, context] of deps.runtimeState.activeTabContexts.entries()) {
    if (getRegistrableHostname(context.hostname) === normalizedHostname) {
      deps.runtimeState.activeTabContexts.delete(tabId);
    }
  }
};
const handleConfigMutation = async (deps: RuntimeConfigDeps): Promise<void> => {
  const previousRules = deps.runtimeState.getLastKnownRules() ?? (await loadRules());
  const previousProfiles =
    deps.runtimeState.getLastKnownProfiles() ?? (await loadLocations());
  const [nextRules, nextProfiles] = await Promise.all([loadRules(), loadLocations()]);
  const affectedHostnames = collectAffectedHostnames({
    previousRules,
    nextRules,
    previousLocations: previousProfiles,
    nextLocations: nextProfiles,
    activeContexts: deps.runtimeState.getActiveTabContexts(),
  });
  const affectedTabIds = deps.removeCleanupContexts(affectedHostnames);
  deps.runtimeState.setLastKnownRules(nextRules);
  deps.runtimeState.setLastKnownProfiles(nextProfiles);
  deps.runtimeState.setLastKnownControlState(await loadControlState());
  deps.runtimeState.effectiveSnapshotCache.clear();
  await deps.syncPreloadedState();
  await syncDynamicHeaderRules(deps.runtimeState.getActiveTabContexts());
  await deps.reloadSupportedWebTabs(affectedTabIds);
  deps.logExtensionEvent({
    enabled: deps.runtimeState.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "state-hygiene.config-mutation-finalized",
    payload: {
      details: {
        trigger: "config-mutation",
        destructive: false,
        cleanupHostnames: affectedHostnames,
        exactOrigins: [],
        cookieStoreId: null,
      },
    },
  });
  await deps.refreshActionState();
};
export const createRuntimeConfig = (deps: RuntimeConfigDeps) => ({
  upsertTabContext: upsertTabContext.bind(null, deps),
  removeTabContext: removeTabContext.bind(null, deps),
  refreshCachedConfig: refreshCachedConfig.bind(null, deps),
  ensureRuntimeCache: ensureRuntimeCache.bind(null, deps),
  provisionContainers: provisionContainers.bind(null, deps),
  reconcileContainers: reconcileContainers.bind(null, deps),
  removeHostnameContexts: removeHostnameContexts.bind(null, deps),
  handleConfigMutation: handleConfigMutation.bind(null, deps),
});
