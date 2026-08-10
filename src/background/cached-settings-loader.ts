import type { PreparedRuntimeDecisions } from "@/background/prepared-runtime-decisions";
import type {
  CachedSettingsState,
  createRuntimeState,
} from "@/background/runtime-state";
import { loadContainerAssignments } from "@/background/storage/container-assignments";
import { loadControlState } from "@/background/storage/control-state";
import { loadLocations } from "@/background/storage/locations";
import {
  getGlobalFallbackRule,
  getPreferences,
  getSharedSpoofing,
} from "@/background/storage/preferences";
import { loadRules } from "@/background/storage/rules";
import { loadTrustedSites } from "@/background/storage/trusted-sites";

type RuntimeState = ReturnType<typeof createRuntimeState<PreparedRuntimeDecisions>>;

export const createCachedStateLoader =
  (runtimeState: RuntimeState) => async (): Promise<CachedSettingsState> => {
    const cachedState = runtimeState.getCachedState();
    if (cachedState) return cachedState;
    const [
      profiles,
      rules,
      trustedSites,
      controlState,
      preferences,
      sharedSpoofing,
      globalFallbackRule,
      containerAssignments,
    ] = await Promise.all([
      loadLocations(),
      loadRules(),
      loadTrustedSites(),
      loadControlState(),
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
      includeDateCallsInBadgeCount: countDateCalls,
    } = preferences;
    runtimeState.setCachedValues({
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
      includeDateCallsInBadgeCount: countDateCalls,
      containerAssignments,
    });
    runtimeState.setLastKnownControlState(controlState);
    runtimeState.setKnownAttentionMotion(preferences.attentionMotionEnabled);
    return {
      profiles,
      rules,
      trustedSites,
      controlState,
      ...preferences,
      browserFingerprintSpoofingEnabled: fingerprintEnabled,
      sharedWorkerHandlingMode: workerMode,
      sharedWorkerCompatibilityMode: workerMode === "native",
      sharedSpoofing,
      globalFallbackRule,
      randomizeGeneratedLocationByDefault: randomizeDefault,
      generatedLocationRandomizationRadiusKm: randomRadiusKm,
      includeDateCallsInBadgeCount: countDateCalls,
      containerAssignments,
    };
  };
