import type { Dispatch, SetStateAction } from "react";

import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
  SharedSpoofingConfig,
  SharedWorkerHandlingMode,
  Location,
  OsmConsentState,
  TrustedSite,
} from "@/shared/types";
import type { ThemeAccentPreset, ThemeMode } from "@/shared/types";
import { dedupeRules } from "@/ui/options/utils";

type SettingsStatePayload = {
  locations: Location[];
  rules: DomainRule[];
  trustedSites: TrustedSite[];
  themeMode: ThemeMode;
  themeAccentPreset: ThemeAccentPreset;
  debugMode: boolean;
  watchPositionDelay: [number, number];
  osmConsent: OsmConsentState;
  browserFingerprintSpoofingEnabled: boolean;
  sharedWorkerHandlingMode: SharedWorkerHandlingMode;
  sharedWorkerCompatibilityMode: boolean;
  sharedSpoofing?: SharedSpoofingConfig | undefined;
  globalFallbackRule?: GlobalFallbackRule | undefined;
  highContrastMode: boolean;
  defaultNoiseRadius: number;
  randomizeGeneratedLocationByDefault: boolean;
  generatedLocationRandomizationRadiusKm: number;
  showBadgeQueryCount: boolean;
  includeDateCallsInBadgeCount: boolean;
  onboardingCompleted?: boolean;
  containerAssignments?: ContainerAssignment[] | undefined;
};

type StateSetter<T> = Dispatch<SetStateAction<T>>;

export type SettingsStateSetters = {
  setProfiles: StateSetter<Location[]>;
  setRules: StateSetter<DomainRule[]>;
  setTrustedSites: StateSetter<TrustedSite[]>;
  setThemeMode: StateSetter<ThemeMode>;
  setThemeAccentPreset: StateSetter<ThemeAccentPreset>;
  setDebugMode: StateSetter<boolean>;
  setWatchPositionDelay: StateSetter<[number, number]>;
  setOsmConsent: StateSetter<OsmConsentState>;
  setFingerprintSpoofing: StateSetter<boolean>;
  setWorkerMode: StateSetter<SharedWorkerHandlingMode>;
  setWorkerCompat: StateSetter<boolean>;
  setSharedSpoofing: StateSetter<SharedSpoofingConfig | undefined>;
  setGlobalFallbackRule: StateSetter<GlobalFallbackRule | undefined>;
  setHighContrastMode: StateSetter<boolean>;
  setDefaultNoiseRadius: StateSetter<number>;
  setRandomizeDefault: StateSetter<boolean>;
  setRadiusKm: StateSetter<number>;
  setShowBadgeQueryCount: StateSetter<boolean>;
  setCountDateCalls: StateSetter<boolean>;
  setOnboardingCompleted?: StateSetter<boolean>;
  setContainerAssignments: StateSetter<ContainerAssignment[]>;
  setSelectedRulePatterns: StateSetter<Set<string>>;
};

export const applySettingsPayload = (
  payload: SettingsStatePayload,
  setters: SettingsStateSetters,
): void => {
  setters.setProfiles(payload.locations);
  setters.setRules(dedupeRules(payload.rules));
  setters.setTrustedSites(payload.trustedSites);
  setters.setThemeMode(payload.themeMode);
  setters.setThemeAccentPreset(payload.themeAccentPreset);
  setters.setDebugMode(payload.debugMode);
  setters.setWatchPositionDelay(payload.watchPositionDelay);
  setters.setOsmConsent(payload.osmConsent);
  setters.setFingerprintSpoofing(payload.browserFingerprintSpoofingEnabled);
  setters.setWorkerMode(payload.sharedWorkerHandlingMode);
  setters.setWorkerCompat(payload.sharedWorkerCompatibilityMode);
  setters.setSharedSpoofing(payload.sharedSpoofing);
  setters.setGlobalFallbackRule(payload.globalFallbackRule);
  setters.setHighContrastMode(payload.highContrastMode);
  setters.setDefaultNoiseRadius(payload.defaultNoiseRadius);
  setters.setRandomizeDefault(payload.randomizeGeneratedLocationByDefault);
  setters.setRadiusKm(payload.generatedLocationRandomizationRadiusKm);
  setters.setShowBadgeQueryCount(payload.showBadgeQueryCount);
  setters.setCountDateCalls(payload.includeDateCallsInBadgeCount);
  if (payload.onboardingCompleted !== undefined) {
    setters.setOnboardingCompleted?.(payload.onboardingCompleted);
  }
  setters.setContainerAssignments(payload.containerAssignments ?? []);
  setters.setSelectedRulePatterns(new Set());
};
