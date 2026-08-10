import { syncDynamicHeaderRules } from "@/background/dnr";
import {
  clearExtensionLogs,
  getExtensionLogs,
  logExtensionEvent,
} from "@/background/logger";
import { consumeMigrationNotice } from "@/background/migrations";
import type { PreparedRuntimeDecisions } from "@/background/prepared-runtime-decisions";
import type { createRuntimeState } from "@/background/runtime-state";
import { loadContainerAssignments } from "@/background/storage/container-assignments";
import { loadControlState, saveControlState } from "@/background/storage/control-state";
import { loadLocations } from "@/background/storage/locations";
import {
  getGlobalFallbackRule,
  getPreferences,
  getSharedSpoofing,
} from "@/background/storage/preferences";
import { loadRules } from "@/background/storage/rules";
import { loadTrustedSites } from "@/background/storage/trusted-sites";
import { LogCategory } from "@/shared/types";
import type {
  ClearLogsResponse,
  ControlState,
  GetControlStateResponse,
  GetLogsResponse,
  GetSettingsResponse,
  SetPanicModeResponse,
} from "@/shared/types";

type RuntimeState = ReturnType<typeof createRuntimeState<PreparedRuntimeDecisions>>;

type SettingsApiDeps = {
  runtimeState: RuntimeState;
  ensureStorageMigration: () => Promise<void>;
  syncPreloadedState: () => Promise<void>;
  refreshActionState: () => Promise<void>;
};

const setPanicMode = async (
  deps: SettingsApiDeps,
  enabled: boolean,
): Promise<SetPanicModeResponse> => {
  const state: ControlState = { panicMode: enabled };
  await saveControlState(state);
  deps.runtimeState.setLastKnownControlState(state);
  deps.runtimeState.effectiveSnapshotCache.clear();
  await deps.syncPreloadedState();
  try {
    if (enabled) {
      deps.runtimeState.activeTabContexts.clear();
      await syncDynamicHeaderRules([]);
    } else {
      await syncDynamicHeaderRules(deps.runtimeState.getActiveTabContexts());
    }
    await deps.refreshActionState();
  } catch (error) {
    console.error("Failed to finalize panic mode update.", error);
  }
  return { ok: true, state };
};

const getControlState = async (): Promise<GetControlStateResponse> => ({
  ok: true,
  state: await loadControlState(),
});

const getSettings = async (deps: SettingsApiDeps): Promise<GetSettingsResponse> => {
  await deps.ensureStorageMigration();
  const [
    profiles,
    rules,
    trustedSites,
    preferences,
    sharedSpoofing,
    globalFallbackRule,
    containerAssignments,
  ] = await Promise.all([
    loadLocations(),
    loadRules(),
    loadTrustedSites(),
    getPreferences(),
    getSharedSpoofing(),
    getGlobalFallbackRule(),
    loadContainerAssignments(),
  ]);
  const {
    browserFingerprintSpoofingEnabled: fingerprintEnabled,
    sharedWorkerHandlingMode: workerMode,
    randomizeGeneratedLocationByDefault: randomizeDefault,
    generatedLocationRandomizationRadiusKm: randomRadiusKm,
    showBadgeQueryCount: showBadgeCount,
    includeDateCallsInBadgeCount: countDateCalls,
  } = preferences;
  deps.runtimeState.setCachedValues({
    profiles,
    rules,
    trustedSites,
    ...preferences,
    browserFingerprintSpoofingEnabled: fingerprintEnabled,
    sharedWorkerHandlingMode: workerMode,
    sharedWorkerCompatibilityMode: workerMode === "native",
    sharedSpoofing,
    globalFallbackRule,
    randomizeGeneratedLocationByDefault: randomizeDefault,
    generatedLocationRandomizationRadiusKm: randomRadiusKm,
    showBadgeQueryCount: showBadgeCount,
    includeDateCallsInBadgeCount: countDateCalls,
    containerAssignments,
  });
  logExtensionEvent({
    enabled: preferences.debugMode,
    category: LogCategory.System,
    event: "system.settings-loaded",
    payload: { details: { profiles: profiles.length, rules: rules.length } },
  });
  return {
    ok: true,
    locations: profiles,
    rules,
    trustedSites,
    ...preferences,
    browserFingerprintSpoofingEnabled: fingerprintEnabled,
    sharedWorkerHandlingMode: workerMode,
    sharedWorkerCompatibilityMode: workerMode === "native",
    ...(sharedSpoofing ? { sharedSpoofing } : {}),
    ...(globalFallbackRule ? { globalFallbackRule } : {}),
    randomizeGeneratedLocationByDefault: randomizeDefault,
    generatedLocationRandomizationRadiusKm: randomRadiusKm,
    showBadgeQueryCount: showBadgeCount,
    includeDateCallsInBadgeCount: countDateCalls,
    containerAssignments,
    notice: await consumeMigrationNotice(),
  };
};

const getLogs = async (deps: SettingsApiDeps): Promise<GetLogsResponse> => {
  await deps.ensureStorageMigration();
  return getExtensionLogs();
};

const clearLogs = async (deps: SettingsApiDeps): Promise<ClearLogsResponse> => {
  await deps.ensureStorageMigration();
  return clearExtensionLogs();
};

export const createSettingsApi = (deps: SettingsApiDeps) => ({
  setPanicMode: setPanicMode.bind(null, deps),
  getControlState,
  getSettings: getSettings.bind(null, deps),
  getLogs: getLogs.bind(null, deps),
  clearLogs: clearLogs.bind(null, deps),
});
