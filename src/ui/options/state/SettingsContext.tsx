import React, { createContext, useContext } from "react";

import type { ContainerAssignment } from "@/shared/types";
import { collectPresetUsage } from "@/ui/options/location-usage";
import {
  getLocationAnchor,
  getRuleAnchor,
  getTabAnchor,
} from "@/ui/options/navigation";
import { useSettingsAnchorEffects } from "@/ui/options/state/use-settings-anchor-effects";
import { useSettingsAnchors } from "@/ui/options/state/use-settings-anchors";
import { useSettingsConfirmDialog } from "@/ui/options/state/use-settings-confirm-dialog";
import {
  handleSetPanicMode,
  usePreferenceRefs,
  usePreferenceState,
  useSettingsRuntimeState,
} from "@/ui/options/state/use-settings-core-state";
import { createIdentityHandlers } from "@/ui/options/state/use-settings-identity";
import { useSettingsLoadEffects } from "@/ui/options/state/use-settings-load-effects";
import {
  createGeneratorHandlers,
  useGeneratorState,
} from "@/ui/options/state/use-settings-location-generator";
import {
  createLocationHandlers,
  useLocationState,
} from "@/ui/options/state/use-settings-locations";
import {
  createManagementHandlers,
  useManagementState,
} from "@/ui/options/state/use-settings-management";
import { usePersistenceRuntime } from "@/ui/options/state/use-settings-persistence-runtime";
import {
  createRuleHandlers,
  useRuleDerivedState,
  useRuleState,
} from "@/ui/options/state/use-settings-rules";
import {
  createTrustedHandlers,
  useTrustedSitesState,
} from "@/ui/options/state/use-settings-trusted-sites";

export const resolveReleaseChannel = (
  manifest: chrome.runtime.Manifest,
): "local" | "beta" | "stable" => {
  const versionName = String(manifest.version_name ?? "")
    .trim()
    .toLowerCase();
  const manifestName = String(manifest.name ?? "")
    .trim()
    .toLowerCase();

  if (versionName.endsWith("-local")) {
    return "local";
  }
  if (versionName.endsWith("-beta") || manifestName.endsWith(" beta")) {
    return "beta";
  }
  return "stable";
};

const useSettingsState = () => {
  const anchors = useSettingsAnchors();
  const trustedSites = useTrustedSitesState();
  const management = useManagementState();
  const preferences = usePreferenceState();
  const preferenceRefs = usePreferenceRefs(preferences);
  const runtime = useSettingsRuntimeState();
  const locations = useLocationState();
  const rules = useRuleState(locations.profiles, preferenceRefs.globalFallbackRuleRef);
  const generator = useGeneratorState();
  const confirmation = useSettingsConfirmDialog();

  return {
    anchors,
    confirmation,
    generator,
    locations,
    management,
    preferenceRefs,
    preferences,
    rules,
    runtime,
    trustedSites,
  };
};

type SettingsStateComposition = ReturnType<typeof useSettingsState>;

const useSettingsPersistence = (state: SettingsStateComposition) =>
  usePersistenceRuntime({
    refs: {
      browserFingerprintSpoofingEnabled:
        state.preferenceRefs.browserFingerprintSpoofingEnabledRef,
      containerAssignments: state.locations.containerAssignmentsRef,
      debugMode: state.preferenceRefs.debugModeRef,
      generatedLocationRandomizationRadiusKm: state.locations.radiusKmRef,
      globalFallbackRule: state.preferenceRefs.globalFallbackRuleRef,
      highContrastMode: state.preferenceRefs.highContrastModeRef,
      includeDateCallsInBadgeCount:
        state.preferenceRefs.includeDateCallsInBadgeCountRef,
      osmConsent: state.preferenceRefs.osmConsentRef,
      profiles: state.locations.profilesRef,
      randomizeGeneratedLocationByDefault: state.locations.randomizeByDefaultRef,
      rules: state.rules.rulesRef,
      settingsLoaded: state.runtime.settingsLoadedRef,
      sharedSpoofing: state.preferenceRefs.sharedSpoofingRef,
      sharedWorkerHandlingMode: state.preferenceRefs.sharedWorkerHandlingModeRef,
      showBadgeQueryCount: state.preferenceRefs.showBadgeQueryCountRef,
      watchPositionDelay: state.preferenceRefs.watchPositionDelayRef,
    },
    setRadiusKm: state.generator.setRadiusKm,
    setShouldRandomize: state.generator.setShouldRandomize,
    setters: {
      setFingerprintSpoofing: state.preferences.setFingerprintSpoofing,
      setContainerAssignments: state.locations.setContainerAssignments,
      setDebugMode: state.preferences.setDebugMode,
      setDefaultNoiseRadius: state.locations.setDefaultNoiseRadius,
      setRadiusKm: state.locations.setRadiusKm,
      setGlobalFallbackRule: state.preferences.setGlobalFallbackRule,
      setHighContrastMode: state.preferences.setHighContrastMode,
      setCountDateCalls: state.preferences.setCountDateCalls,
      setOnboardingCompleted: state.preferences.setOnboardingCompleted,
      setOsmConsent: state.preferences.setOsmConsent,
      setProfiles: state.locations.setProfiles,
      setRandomizeDefault: state.locations.setRandomizeDefault,
      setRules: state.rules.setRules,
      setSelectedRulePatterns: state.rules.setSelectedRulePatterns,
      setSharedSpoofing: state.preferences.setSharedSpoofing,
      setWorkerCompat: state.preferences.setWorkerCompat,
      setWorkerMode: state.preferences.setWorkerMode,
      setShowBadgeQueryCount: state.preferences.setShowBadgeQueryCount,
      setThemeAccentPreset: state.preferences.setThemeAccentPreset,
      setThemeMode: state.preferences.setThemeMode,
      setTrustedSites: state.trustedSites.setTrustedSites,
      setWatchPositionDelay: state.preferences.setWatchPositionDelay,
    },
  });

type SettingsPersistence = ReturnType<typeof useSettingsPersistence>;

const useRuleRuntime = (
  state: SettingsStateComposition,
  persistence: SettingsPersistence,
) => {
  const derived = useRuleDerivedState({
    globalFallbackRule: state.preferences.globalFallbackRule,
    linkedRuleLocationId: state.anchors.linkedRuleLocationId,
    profiles: state.locations.profiles,
    state: state.rules,
    trustedSites: state.trustedSites.trustedSites,
  });
  const handlers = createRuleHandlers({
    globalFallbackRule: state.preferences.globalFallbackRule,
    globalFallbackRuleRef: state.preferenceRefs.globalFallbackRuleRef,
    navigateToAnchor: state.anchors.navigateToAnchor,
    persistSettings: persistence.persistSettings,
    profiles: state.locations.profiles,
    requestConfirmation: state.confirmation.requestConfirmation,
    setGlobalFallbackRule: state.preferences.setGlobalFallbackRule,
    state: state.rules,
  });
  const identityHandlers = createIdentityHandlers({
    containerAssignmentsRef: state.locations.containerAssignmentsRef,
    requestConfirmation: state.confirmation.requestConfirmation,
    rulesRef: state.rules.rulesRef,
    setContainerAssignments: state.locations.setContainerAssignments,
    setRules: state.rules.setRules,
    setSaveInFlight: persistence.setSaveInFlight,
  });

  return { derived, handlers, identityHandlers };
};

type RuleRuntime = ReturnType<typeof useRuleRuntime>;

const useLocationRuntime = (
  state: SettingsStateComposition,
  persistence: SettingsPersistence,
) => {
  const regionalPresetUsage = collectPresetUsage(
    state.rules.rules,
    state.preferences.globalFallbackRule,
    state.locations.containerAssignments,
  );
  const handlers = createLocationHandlers({
    containerAssignmentsRef: state.locations.containerAssignmentsRef,
    globalFallbackRuleRef: state.preferenceRefs.globalFallbackRuleRef,
    navigateToAnchor: state.anchors.navigateToAnchor,
    persistSettings: persistence.persistSettings,
    requestConfirmation: state.confirmation.requestConfirmation,
    rules: state.rules.rules,
    rulesRef: state.rules.rulesRef,
    state: state.locations,
  });
  const generatorHandlers = createGeneratorHandlers({
    ...state.generator,
    commitGeneratedLocation: handlers.commitGeneratedLocation,
    radiusKmRef: state.locations.radiusKmRef,
    openProfileEditor: state.locations.openProfileEditor,
    osmConsent: state.preferences.osmConsent,
    persistSettings: persistence.persistSettings,
    randomizeByDefaultRef: state.locations.randomizeByDefaultRef,
    setOsmConsent: state.preferences.setOsmConsent,
  });

  return { generatorHandlers, handlers, regionalPresetUsage };
};

type LocationRuntime = ReturnType<typeof useLocationRuntime>;

const useRuntimeEffects = (
  state: SettingsStateComposition,
  persistence: SettingsPersistence,
  ruleRuntime: RuleRuntime,
): void => {
  useSettingsLoadEffects({
    applyLoadedSettingsState: persistence.applyLoadedSettingsState,
    autosaveTimerRef: persistence.autosaveTimerRef,
    setPanicMode: state.runtime.setPanicMode,
    setSettingsLoaded: state.runtime.setSettingsLoaded,
  });
  useSettingsAnchorEffects({
    activeTab: state.anchors.activeTab,
    anchorRequest: state.anchors.anchorRequest,
    editingProfileIndex: state.locations.editingProfileIndex,
    isFallbackDialogOpen: state.rules.isFallbackDialogOpen,
    highlightedAnchorId: state.anchors.highlightedAnchorId,
    openFallbackDialog: ruleRuntime.handlers.openFallbackDialog,
    openProfileEditor: state.locations.openProfileEditor,
    openRuleDialog: ruleRuntime.handlers.openRuleDialog,
    profileDialogOpened: state.locations.profileDialogOpened,
    profiles: state.locations.profiles,
    ruleDialogMode: state.rules.ruleDialogMode,
    ruleDialogOpened: state.rules.ruleDialogOpened,
    rulePattern: state.rules.rulePattern,
    rules: state.rules.rules,
    setAnchorRequest: state.anchors.setAnchorRequest,
    settingsLoaded: state.runtime.settingsLoaded,
    suppressedRuleDialogRef: state.rules.suppressedRuleDialogRef,
    tabContentReadyVersion: state.locations.tabContentReadyVersion,
    triggerAnchorHighlight: state.anchors.triggerAnchorHighlight,
  });
};

const buildAnchorContext = (state: SettingsStateComposition) => ({
  activeTab: state.anchors.activeTab,
  anchorRequest: state.anchors.anchorRequest,
  getLocationAnchor,
  getRuleAnchor,
  getTabAnchor,
  highlightedAnchorId: state.anchors.highlightedAnchorId,
  linkedRuleLocationId: state.anchors.linkedRuleLocationId,
  logsHostFilter: state.anchors.logsHostFilter,
  navigateToAnchor: state.anchors.navigateToAnchor,
  setAnchorRequest: state.anchors.setAnchorRequest,
  setRuleLocationFilter: state.anchors.setRuleLocationFilter,
  settingsSubpageView: state.anchors.settingsSubpageView,
  triggerAnchorHighlight: state.anchors.triggerAnchorHighlight,
});

const buildCoreContext = (
  state: SettingsStateComposition,
  persistence: SettingsPersistence,
  managementHandlers: ReturnType<typeof createManagementHandlers>,
) => {
  const manifest = chrome.runtime.getManifest();
  return {
    browserFingerprintSpoofingEnabled:
      state.preferences.browserFingerprintSpoofingEnabled,
    confirmDialogConfig: state.confirmation.confirmDialogConfig,
    confirmDialogOpen: state.confirmation.confirmDialogOpen,
    debugMode: state.preferences.debugMode,
    handleExportSettings: managementHandlers.handleExportSettings,
    handleImportSettings: managementHandlers.handleImportSettings,
    handleReloadSettings: managementHandlers.handleReloadSettings,
    handleSetPanicMode: (enabled: boolean) =>
      handleSetPanicMode({
        enabled,
        setPanicMode: state.runtime.setPanicMode,
        showToast: persistence.showToast,
      }),
    highContrastMode: state.preferences.highContrastMode,
    importSettingsRef: state.runtime.importSettingsRef,
    includeDateCallsInBadgeCount: state.preferences.includeDateCallsInBadgeCount,
    onboardingCompleted: state.preferences.onboardingCompleted,
    osmConsent: state.preferences.osmConsent,
    panicMode: state.runtime.panicMode,
    releaseChannel: resolveReleaseChannel(manifest),
    requestConfirmation: state.confirmation.requestConfirmation,
    requestResetSettings: managementHandlers.requestResetSettings,
    resetRunOnboarding: state.management.resetRunOnboarding,
    resolveConfirmDialog: state.confirmation.resolveConfirmDialog,
    saveInFlight: persistence.saveInFlight,
    scheduleAutosave: persistence.scheduleAutosave,
    setFingerprintSpoofing: state.preferences.setFingerprintSpoofing,
    setDebugMode: state.preferences.setDebugMode,
    setHighContrastMode: state.preferences.setHighContrastMode,
    setCountDateCalls: state.preferences.setCountDateCalls,
    setOnboardingCompleted: state.preferences.setOnboardingCompleted,
    setOsmConsent: state.preferences.setOsmConsent,
    setPanicMode: state.runtime.setPanicMode,
    setResetRunOnboarding: state.management.setResetRunOnboarding,
    setSharedSpoofing: state.preferences.setSharedSpoofing,
    setWorkerMode: state.preferences.setWorkerMode,
    setShowBadgeQueryCount: state.preferences.setShowBadgeQueryCount,
    setThemeAccentPreset: state.preferences.setThemeAccentPreset,
    setThemeMode: state.preferences.setThemeMode,
    setWatchPositionDelay: state.preferences.setWatchPositionDelay,
    settingsLoaded: state.runtime.settingsLoaded,
    sharedSpoofing: state.preferences.sharedSpoofing,
    sharedWorkerCompatibilityMode: state.preferences.sharedWorkerCompatibilityMode,
    sharedWorkerHandlingMode: state.preferences.sharedWorkerHandlingMode,
    showBadgeQueryCount: state.preferences.showBadgeQueryCount,
    themeAccentPreset: state.preferences.themeAccentPreset,
    themeMode: state.preferences.themeMode,
    version: manifest.version_name ?? manifest.version,
    watchPositionDelay: state.preferences.watchPositionDelay,
  };
};

const buildLocationContext = (
  state: SettingsStateComposition,
  runtime: LocationRuntime,
) => ({
  defaultNoiseRadius: state.locations.defaultNoiseRadius,
  editingProfileIndex: state.locations.editingProfileIndex,
  generatedLocationRandomizationRadiusKm:
    state.locations.generatedLocationRandomizationRadiusKm,
  handleAddProfile: runtime.handlers.handleAddProfile,
  handleDuplicateProfile: runtime.handlers.handleDuplicateProfile,
  handleOpenProfileEditor: runtime.generatorHandlers.handleOpenProfileEditor,
  handlePersistProfile: runtime.handlers.handlePersistProfile,
  handleRemoveProfile: runtime.handlers.handleRemoveProfile,
  notifyTabContentReady: state.locations.notifyTabContentReady,
  pendingEditorDraft: state.locations.pendingEditorDraft,
  profileDialogOpened: state.locations.profileDialogOpened,
  profileEditorSessionId: state.locations.profileEditorSessionId,
  profiles: state.locations.profiles,
  profilesSearch: state.locations.profilesSearch,
  regionalPresetUsage: runtime.regionalPresetUsage,
  randomizeGeneratedLocationByDefault:
    state.locations.randomizeGeneratedLocationByDefault,
  setDefaultNoiseRadius: state.locations.setDefaultNoiseRadius,
  setRadiusKm: state.locations.setRadiusKm,
  setProfileDialogOpened: state.locations.setProfileDialogOpened,
  setProfiles: state.locations.setProfiles,
  setProfilesSearch: state.locations.setProfilesSearch,
  setRandomizeDefault: state.locations.setRandomizeDefault,
});

const buildRuleContext = (state: SettingsStateComposition, runtime: RuleRuntime) => ({
  allRuleKeys: runtime.derived.allRuleKeys,
  bulkSelectionState: runtime.derived.bulkSelectionState,
  closeFallbackDialog: runtime.handlers.closeFallbackDialog,
  closeRuleDialog: runtime.handlers.closeRuleDialog,
  editingRulePattern: state.rules.editingRulePattern,
  editingRuleSeedKey: runtime.derived.editingRuleSeedKey,
  globalFallbackRule: state.preferences.globalFallbackRule,
  isFallbackDialogOpen: state.rules.isFallbackDialogOpen,
  isFallbackEnabled: state.rules.isFallbackEnabled,
  fallbackSurfaceOverrides: state.rules.fallbackSurfaceOverrides,
  fallbackLocationId: state.rules.fallbackLocationId,
  fallbackSeedKey:
    state.preferenceRefs.globalFallbackRuleRef.current?.ruleSeedKey ?? null,
  assignBulkLocation: runtime.handlers.assignBulkLocation,
  handleBulkDelete: runtime.handlers.handleBulkDelete,
  handleDeleteRule: runtime.handlers.handleDeleteRule,
  submitFallbackRule: runtime.handlers.submitFallbackRule,
  submitOnboardingFallback: runtime.handlers.submitOnboardingFallback,
  rotateContainerIdentity: runtime.identityHandlers.rotateContainerIdentity,
  rotateRuleIdentity: runtime.identityHandlers.rotateRuleIdentity,
  handleRuleSubmit: runtime.handlers.handleRuleSubmit,
  onboardingOptions: state.rules.onboardingOptions,
  openFallbackDialog: runtime.handlers.openFallbackDialog,
  openRuleDialog: runtime.handlers.openRuleDialog,
  preview: runtime.derived.preview,
  previewHostname: state.rules.previewHostname,
  profileUsage: runtime.derived.profileUsage,
  ruleDialogMode: state.rules.ruleDialogMode,
  ruleDialogOpened: state.rules.ruleDialogOpened,
  ruleEnabled: state.rules.ruleEnabled,
  ruleSurfaceOverrides: state.rules.ruleSurfaceOverrides,
  rulePattern: state.rules.rulePattern,
  ruleProfileId: state.rules.ruleProfileId,
  ruleProfileOptions: runtime.derived.ruleProfileOptions,
  ruleRelaxCsp: state.rules.ruleRelaxCsp,
  rules: state.rules.rules,
  rulesFilter: state.rules.rulesFilter,
  selectedRulePatterns: state.rules.selectedRulePatterns,
  setGlobalFallbackRule: state.preferences.setGlobalFallbackRule,
  setFallbackEnabled: state.rules.setFallbackEnabled,
  setFallbackSurfaces: state.rules.setFallbackSurfaces,
  setFallbackLocationId: state.rules.setFallbackLocationId,
  setOnboardingOptions: state.rules.setOnboardingOptions,
  setPreviewHostname: state.rules.setPreviewHostname,
  setRuleDialogOpened: state.rules.setRuleDialogOpened,
  setRuleEnabled: state.rules.setRuleEnabled,
  setRuleSurfaceOverrides: state.rules.setRuleSurfaceOverrides,
  setRulePattern: state.rules.setRulePattern,
  setRuleProfileId: state.rules.setRuleProfileId,
  setRuleRelaxCsp: state.rules.setRuleRelaxCsp,
  // Kept only for the real-provider regression test.
  setRules: state.rules.setRules,
  setRulesFilter: state.rules.setRulesFilter,
  setSelectedRulePatterns: state.rules.setSelectedRulePatterns,
  viewModels: runtime.derived.viewModels,
  visibleRuleKeys: runtime.derived.visibleRuleKeys,
});

const buildGeneratorContext = (
  state: SettingsStateComposition,
  runtime: LocationRuntime,
) => ({
  closeOsmDialog: runtime.generatorHandlers.closeOsmDialog,
  closeGenerator: runtime.generatorHandlers.closeGenerator,
  denyOsmConsent: runtime.generatorHandlers.denyOsmConsent,
  grantOsmConsent: runtime.generatorHandlers.grantOsmConsent,
  radiusKm: state.generator.radiusKm,
  openGenerator: runtime.generatorHandlers.openGenerator,
  runGenerator: runtime.generatorHandlers.runGenerator,
  saveGenerator: runtime.generatorHandlers.saveGenerator,
  selectCandidate: runtime.generatorHandlers.selectCandidate,
  openOsmDialog: runtime.generatorHandlers.openOsmDialog,
  isOsmDialogOpen: state.generator.isOsmDialogOpen,
  pendingDraft: state.generator.pendingDraft,
  isDraftPending: state.generator.isDraftPending,
  searchQuery: state.generator.searchQuery,
  isGeneratorOpen: state.generator.isGeneratorOpen,
  generatorStep: state.generator.generatorStep,
  searchCandidates: state.generator.searchCandidates,
  shouldRandomize: state.generator.shouldRandomize,
  selectedCandidateId: state.generator.selectedCandidateId,
  setRadiusKm: state.generator.setRadiusKm,
  // Kept only for the real-provider regression test.
  setPendingDraft: state.generator.setPendingDraft,
  setSearchQuery: state.generator.setSearchQuery,
  setGeneratorStep: state.generator.setGeneratorStep,
  setShouldRandomize: state.generator.setShouldRandomize,
  setSelectedCandidateId: state.generator.setSelectedCandidateId,
  updatePendingDraft: runtime.generatorHandlers.updatePendingDraft,
});

const buildTrustedSitesContext = (
  state: SettingsStateComposition,
  handlers: ReturnType<typeof createTrustedHandlers>,
) => ({
  closeTrustedSiteDialog: handlers.closeTrustedSiteDialog,
  filteredTrustedSites: state.trustedSites.filteredTrustedSites,
  handleDeleteTrustedSite: handlers.handleDeleteTrustedSite,
  handleToggleTrustedSite: handlers.handleToggleTrustedSite,
  handleTrustedSiteSubmit: handlers.handleTrustedSiteSubmit,
  openTrustedSiteDialog: handlers.openTrustedSiteDialog,
  setTrustedSitePattern: state.trustedSites.setTrustedSitePattern,
  setTrustedSites: state.trustedSites.setTrustedSites,
  setTrustedSitesFilter: state.trustedSites.setTrustedSitesFilter,
  trustedSiteDialogOpened: state.trustedSites.trustedSiteDialogOpened,
  trustedSitePattern: state.trustedSites.trustedSitePattern,
  trustedSites: state.trustedSites.trustedSites,
  trustedSitesFilter: state.trustedSites.trustedSitesFilter,
});

export const useSettingsBase = () => {
  const state = useSettingsState();
  const persistence = useSettingsPersistence(state);
  const ruleRuntime = useRuleRuntime(state, persistence);
  const locationRuntime = useLocationRuntime(state, persistence);
  const trustedSiteHandlers = createTrustedHandlers({
    persistTrustedSites: persistence.persistTrustedSites,
    setTrustedDialogOpen: state.trustedSites.setTrustedDialogOpen,
    setTrustedSitePattern: state.trustedSites.setTrustedSitePattern,
    setTrustedSites: state.trustedSites.setTrustedSites,
    trustedSitePattern: state.trustedSites.trustedSitePattern,
    trustedSitesRef: state.trustedSites.trustedSitesRef,
  });
  const managementHandlers = createManagementHandlers({
    applyLoadedSettingsState: persistence.applyLoadedSettingsState,
    autosaveTimerRef: persistence.autosaveTimerRef,
    requestConfirmation: state.confirmation.requestConfirmation,
    resetRunOnboardingRef: state.management.resetRunOnboardingRef,
    setOnboardingCompleted: state.preferences.setOnboardingCompleted,
    setResetRunOnboarding: state.management.setResetRunOnboarding,
  });
  useRuntimeEffects(state, persistence, ruleRuntime);

  return {
    ...buildAnchorContext(state),
    ...buildCoreContext(state, persistence, managementHandlers),
    ...buildLocationContext(state, locationRuntime),
    ...buildRuleContext(state, ruleRuntime),
    ...buildGeneratorContext(state, locationRuntime),
    containerAssignments: state.locations.containerAssignments,
    saveContainerAssignments: async (
      assignments: ContainerAssignment[],
    ): Promise<void> => {
      state.locations.setContainerAssignments(assignments);
      await persistence.persistSettings({
        containerAssignments: assignments,
        scopes: ["location-model"],
      });
    },
    ...buildTrustedSitesContext(state, trustedSiteHandlers),
  };
};

export type SettingsContextValue = ReturnType<typeof useSettingsBase>;
export const SettingsContext = createContext<SettingsContextValue | null>(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }
  return context;
};

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const value = useSettingsBase();
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
