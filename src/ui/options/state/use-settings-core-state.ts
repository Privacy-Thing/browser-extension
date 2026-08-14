import { useRef, useState } from "react";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import type {
  GlobalFallbackRule,
  SetPanicModeResponse,
  SharedSpoofingConfig,
  ThemeAccentPreset,
  ThemeMode,
} from "@/shared/types";
import { t } from "@/ui/i18n";
import { useLatestRef } from "@/ui/options/state/use-latest-ref";
import type { StatusTone } from "@/ui/options/utils";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

export const usePreferenceState = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_PREFERENCES.themeMode);
  const [themeAccentPreset, setThemeAccentPreset] = useState<ThemeAccentPreset>(
    DEFAULT_PREFERENCES.themeAccentPreset,
  );
  const [watchPositionDelay, setWatchPositionDelay] = useState<[number, number]>(
    DEFAULT_PREFERENCES.watchPositionDelay,
  );
  const [debugMode, setDebugMode] = useState(DEFAULT_PREFERENCES.debugMode);
  const [featureFlags, setFeatureFlags] = useState(DEFAULT_PREFERENCES.featureFlags);
  const [osmConsent, setOsmConsent] = useState(DEFAULT_PREFERENCES.osmConsent);
  // Canonical defaults prevent a slow load from briefly presenting spoofing as off.
  const [isFingerprintSpoofingOn, setFingerprintSpoofing] = useState(
    DEFAULT_PREFERENCES.browserFingerprintSpoofingEnabled,
  );
  const [workerMode, setWorkerMode] = useState(
    DEFAULT_PREFERENCES.sharedWorkerHandlingMode,
  );
  const [workerCompat, setWorkerCompat] = useState(
    DEFAULT_PREFERENCES.sharedWorkerCompatibilityMode,
  );
  const [sharedSpoofing, setSharedSpoofing] = useState<
    SharedSpoofingConfig | undefined
  >(undefined);
  const [globalFallbackRule, setGlobalFallbackRule] = useState<
    GlobalFallbackRule | undefined
  >(undefined);
  const [highContrastMode, setHighContrastMode] = useState(
    DEFAULT_PREFERENCES.highContrastMode,
  );
  const [showBadgeQueryCount, setShowBadgeQueryCount] = useState(
    DEFAULT_PREFERENCES.showBadgeQueryCount,
  );
  const [countDateCalls, setCountDateCalls] = useState(
    DEFAULT_PREFERENCES.includeDateCallsInBadgeCount,
  );
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  return {
    browserFingerprintSpoofingEnabled: isFingerprintSpoofingOn,
    debugMode,
    featureFlags,
    globalFallbackRule,
    highContrastMode,
    includeDateCallsInBadgeCount: countDateCalls,
    onboardingCompleted,
    osmConsent,
    setFingerprintSpoofing,
    setDebugMode,
    setFeatureFlags,
    setGlobalFallbackRule,
    setHighContrastMode,
    setCountDateCalls,
    setOnboardingCompleted,
    setOsmConsent,
    setSharedSpoofing,
    setWorkerCompat,
    setWorkerMode,
    setShowBadgeQueryCount,
    setThemeAccentPreset,
    setThemeMode,
    setWatchPositionDelay,
    sharedSpoofing,
    sharedWorkerCompatibilityMode: workerCompat,
    sharedWorkerHandlingMode: workerMode,
    showBadgeQueryCount,
    themeAccentPreset,
    themeMode,
    watchPositionDelay,
  };
};

export type SettingsPreferenceState = ReturnType<typeof usePreferenceState>;

export const usePreferenceRefs = (state: SettingsPreferenceState) => ({
  browserFingerprintSpoofingEnabledRef: useLatestRef(
    state.browserFingerprintSpoofingEnabled,
  ),
  debugModeRef: useLatestRef(state.debugMode),
  featureFlagsRef: useLatestRef(state.featureFlags),
  globalFallbackRuleRef: useLatestRef(state.globalFallbackRule),
  highContrastModeRef: useLatestRef(state.highContrastMode),
  includeDateCallsInBadgeCountRef: useLatestRef(state.includeDateCallsInBadgeCount),
  osmConsentRef: useLatestRef(state.osmConsent),
  sharedSpoofingRef: useLatestRef(state.sharedSpoofing),
  sharedWorkerHandlingModeRef: useLatestRef(state.sharedWorkerHandlingMode),
  showBadgeQueryCountRef: useLatestRef(state.showBadgeQueryCount),
  watchPositionDelayRef: useLatestRef(state.watchPositionDelay),
});

export const useSettingsRuntimeState = () => {
  const [panicMode, setPanicMode] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const importSettingsRef = useRef<HTMLInputElement | null>(null);

  return {
    importSettingsRef,
    panicMode,
    setPanicMode,
    setSettingsLoaded,
    settingsLoaded,
    settingsLoadedRef: useLatestRef(settingsLoaded),
  };
};

export const handleSetPanicMode = async (options: {
  enabled: boolean;
  setPanicMode: (value: boolean) => void;
  showToast: (
    message: string,
    tone: Exclude<StatusTone, "neutral"> | "neutral",
  ) => void;
}): Promise<void> => {
  const response = (await sendMessageOrThrow({
    type: EXTENSION_COMMAND_TYPES.setPanicMode,
    enabled: options.enabled,
  })) as SetPanicModeResponse;

  options.setPanicMode(response.state.panicMode);
  options.showToast(
    response.state.panicMode
      ? t.options.spoofingTurnedOffToast
      : t.options.spoofingTurnedOnToast,
    response.state.panicMode ? "warning" : "success",
  );
};
