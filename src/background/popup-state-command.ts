import {
  buildPopupState,
  defaultPopupCurrentRule,
  getPatternMode,
} from "@/background/popup-command-helpers";
import type { PopupCommandDeps } from "@/background/popup-command-types";
import {
  buildEffectiveSummary,
  getApplicableNotices,
  getPopupPolicyNotices,
} from "@/background/popup-effective-summary";
import type { getPopupCurrentRule } from "@/background/popup-state";
import {
  filterRuleSuggestions,
  isServiceWorkerBlocked,
  resolvePopupResolution,
  resolvePopupSurfaceState,
  resolvePopupWorkerMode,
} from "@/background/popup-state";
import { loadContainerAssignments } from "@/background/storage/container-assignments";
import { loadControlState } from "@/background/storage/control-state";
import { loadLocations } from "@/background/storage/locations";
import {
  loadPopupNotifications,
  selectPopupNotifications,
  syncSiteNotices,
} from "@/background/storage/popup-notifications";
import {
  getDebugMode,
  getFingerprintEnabled,
  getGlobalFallbackRule,
  getSharedSpoofing,
  getWorkerMode,
} from "@/background/storage/preferences";
import { loadRules } from "@/background/storage/rules";
import {
  loadSiteSuggestions,
  selectPopupSuggestions,
} from "@/background/storage/site-suggestions";
import { loadTrustedSites } from "@/background/storage/trusted-sites";
import { getContainer } from "@/shared/container-service";
import { isNoticeAttention } from "@/shared/popup-notification-state";
import {
  LogCategory,
  type ContainerAssignment,
  type GetPopupStateResponse,
  type PopupState,
} from "@/shared/types";

const buildUnsupportedState = (
  url: string | null,
): GetPopupStateResponse["state"]["currentTab"] => ({
  supported: false,
  hostname: null,
  url,
  locationLabel: null,
  locationId: null,
  locationProfileActive: false,
  matchedRulePattern: null,
  hasExactRule: false,
  canCleanDomain: false,
  pendingRulePattern: null,
  hasMatch: false,
});

const findContainerAssignment = (
  assignments: readonly ContainerAssignment[],
  cookieStoreId: string | undefined,
): ContainerAssignment | null =>
  cookieStoreId
    ? (assignments.find((assignment) => assignment.cookieStoreId === cookieStoreId) ??
      null)
    : null;

type PopupRuleStateInput = {
  popupCurrentRule: ReturnType<typeof getPopupCurrentRule>;
  popupSurfaceState: ReturnType<typeof resolvePopupSurfaceState>;
  displayedRulePattern: string | null;
  panicMode: boolean;
  hasGlobalFallbackRule: boolean;
  winningSource: string;
  hasActiveContainer: boolean;
};

const buildPopupRuleState = ({
  popupCurrentRule,
  popupSurfaceState,
  displayedRulePattern,
  panicMode,
  hasGlobalFallbackRule,
  winningSource,
  hasActiveContainer,
}: PopupRuleStateInput): PopupState["currentRule"] => {
  if (popupCurrentRule) {
    return {
      pattern: popupCurrentRule.pattern,
      locationId: popupCurrentRule.locationId ?? null,
      enabled: popupCurrentRule.enabled,
      type: getPatternMode(popupCurrentRule.pattern),
      canToggle: !panicMode,
      canEdit: true,
      isExplicit: popupCurrentRule.pattern === displayedRulePattern,
      blockServiceWorkerRegistration: isServiceWorkerBlocked(
        popupCurrentRule.fingerprintSurfaceOverrides,
      ),
      ...(popupCurrentRule.fingerprintSurfaceOverrides?.serviceWorker !== undefined
        ? {
            serviceWorkerOverride:
              popupCurrentRule.fingerprintSurfaceOverrides.serviceWorker,
          }
        : {}),
      ...(popupCurrentRule.fingerprintSurfaceOverrides?.sharedWorker !== undefined
        ? {
            workerHandlingOverride:
              popupCurrentRule.fingerprintSurfaceOverrides.sharedWorker,
          }
        : {}),
      regionalPresetEnabled:
        popupCurrentRule.fingerprintSurfaceOverrides?.geolocation !== false ||
        popupCurrentRule.fingerprintSurfaceOverrides?.timeLocale !== false,
      relaxCspForWorkers: popupCurrentRule.relaxCspForWorkers ?? false,
    };
  }
  if (
    popupSurfaceState.presentationSource === "container" &&
    popupSurfaceState.currentRuleEnabled !== null
  ) {
    return {
      ...defaultPopupCurrentRule,
      locationId: popupSurfaceState.currentRuleLocationId,
      enabled: popupSurfaceState.currentRuleEnabled,
      canToggle: !panicMode,
      canEdit: true,
    };
  }
  if (
    popupSurfaceState.presentationSource === "fallback" &&
    hasGlobalFallbackRule &&
    popupSurfaceState.currentRuleEnabled !== null
  ) {
    return {
      ...defaultPopupCurrentRule,
      locationId: popupSurfaceState.currentRuleLocationId,
      enabled: popupSurfaceState.currentRuleEnabled,
      canToggle: !panicMode && (winningSource === "fallback" || !hasActiveContainer),
      canEdit: true,
    };
  }
  return defaultPopupCurrentRule;
};

const resolvePopupSource = ({
  winningSource,
  presentationSource,
  rulePattern,
  ruleEnabled,
}: {
  winningSource: string;
  presentationSource: "rule" | "container" | "fallback" | "none";
  rulePattern: string | null;
  ruleEnabled: boolean | null;
}): "site-rule" | "container" | "default-rule" | "trusted-site" | "none" => {
  if (winningSource === "trusted-site") return "trusted-site";
  if (winningSource === "rule" || presentationSource === "rule") return "site-rule";
  if (winningSource === "fallback" || presentationSource === "fallback") {
    return "default-rule";
  }
  if (winningSource === "container" || presentationSource === "container") {
    return "container";
  }
  return rulePattern && ruleEnabled === false ? "site-rule" : "none";
};

type PopupStateInputs = Awaited<ReturnType<typeof loadPopupInputs>>;

const loadPopupInputs = async (deps: PopupCommandDeps, tabId?: number) => {
  await deps.ensureStorageMigration();
  const [
    profiles,
    rules,
    trustedSites,
    controlState,
    debugMode,
    fingerprintEnabled,
    containerAssignments,
    siteSuggestions,
    popupNotifications,
    activeTab,
    globalFallbackRule,
    sharedSpoofing,
    workerMode,
  ] = await Promise.all([
    loadLocations(),
    loadRules(),
    loadTrustedSites(),
    loadControlState(),
    getDebugMode(),
    getFingerprintEnabled(),
    loadContainerAssignments(),
    loadSiteSuggestions(),
    loadPopupNotifications(),
    deps.getPopupTabById(tabId),
    getGlobalFallbackRule(),
    getSharedSpoofing(),
    getWorkerMode(),
  ]);
  deps.setLastKnownProfiles(profiles);
  deps.setLastKnownRules(rules);
  deps.setLastKnownControlState(controlState);
  deps.setLastKnownDebugMode(debugMode);
  deps.setKnownContainers(containerAssignments);
  deps.setKnownFallback(globalFallbackRule);
  return {
    profiles,
    rules,
    trustedSites,
    controlState,
    debugMode,
    fingerprintEnabled,
    containerAssignments,
    siteSuggestions,
    popupNotifications,
    activeTab,
    globalFallbackRule,
    sharedSpoofing,
    workerMode,
  };
};

const buildUnsupportedResponse = (
  inputs: PopupStateInputs,
  generation: number,
  url: string | null,
): GetPopupStateResponse =>
  buildPopupState({
    panicMode: inputs.controlState.panicMode,
    profiles: inputs.profiles,
    currentRule: defaultPopupCurrentRule,
    currentTab: buildUnsupportedState(url),
    effectiveSummary: buildEffectiveSummary({
      generation,
      source: "none",
      pattern: null,
      enabled: null,
      editable: false,
      toggleable: false,
      panicMode: inputs.controlState.panicMode,
      supported: false,
      snapshot: null,
      suggestions: [],
      attentionKinds: [],
    }),
    notifications: selectPopupNotifications(inputs.popupNotifications, null),
  });

const resolvePopupModel = async (deps: PopupCommandDeps, inputs: PopupStateInputs) => {
  const { activeTab } = inputs;
  if (!activeTab?.url) throw new Error("Supported popup tab requires a URL.");
  const hostname = deps.getExactHostname(activeTab.url);
  const containerAssignment = findContainerAssignment(
    inputs.containerAssignments,
    activeTab.cookieStoreId,
  );
  const popupResolution = resolvePopupResolution({
    hostname,
    rules: inputs.rules,
    containerAssignment,
    globalFallbackRule: inputs.globalFallbackRule,
    fallbackLocationId: deps.resolveFallbackId(
      inputs.profiles,
      inputs.globalFallbackRule,
    ),
    trustedSites: inputs.trustedSites,
    fingerprintEnabled: inputs.fingerprintEnabled,
  });
  const activeContainer = activeTab.cookieStoreId
    ? await getContainer(activeTab.cookieStoreId)
    : null;
  const surfaceState = resolvePopupSurfaceState(
    popupResolution,
    containerAssignment,
    inputs.globalFallbackRule,
    Boolean(activeContainer),
  );
  const workerMode = resolvePopupWorkerMode({
    resolution: popupResolution,
    containerAssignment,
    globalFallbackRule: inputs.globalFallbackRule,
    sharedSpoofing: inputs.sharedSpoofing,
    preferenceMode: inputs.workerMode,
  });
  const filteredSuggestions = filterRuleSuggestions(
    selectPopupSuggestions(inputs.siteSuggestions, hostname, activeTab.cookieStoreId),
    popupResolution.activeRule,
    workerMode,
  );
  const displayedLocation = surfaceState.displayedLocationId
    ? (inputs.profiles.find((entry) => entry.id === surfaceState.displayedLocationId) ??
      null)
    : null;
  const firstInlineAvailable = deps.canRequestUserScripts();
  const firstInlineEnabled = await deps.hasUserScriptsPermission();
  deps.logExtensionEvent({
    enabled: inputs.debugMode,
    category: LogCategory.System,
    event: "popup.popup-state-loaded",
    payload: {
      hostname,
      ...(activeTab.id !== undefined ? { tabId: activeTab.id } : {}),
      details: {
        displayedPattern: popupResolution.displayedRule?.pattern ?? null,
        activePattern: popupResolution.activeRule?.pattern ?? null,
        supported: true,
        winningSource: popupResolution.winningSource,
        cookieStoreId: activeTab.cookieStoreId ?? null,
        containerLocationId: containerAssignment?.locationId ?? null,
      },
    },
  });
  const popupRuleState = buildPopupRuleState({
    popupCurrentRule: surfaceState.currentRule,
    popupSurfaceState: surfaceState,
    displayedRulePattern: popupResolution.displayedRule?.pattern ?? null,
    panicMode: inputs.controlState.panicMode,
    hasGlobalFallbackRule: Boolean(inputs.globalFallbackRule),
    winningSource: popupResolution.winningSource,
    hasActiveContainer: Boolean(activeContainer),
  });
  return {
    hostname,
    containerAssignment,
    popupResolution,
    activeContainer,
    surfaceState,
    filteredSuggestions,
    displayedLocation,
    firstInlineAvailable,
    firstInlineEnabled,
    popupRuleState,
    effectiveSource: resolvePopupSource({
      winningSource: popupResolution.winningSource,
      presentationSource: surfaceState.presentationSource,
      rulePattern: popupRuleState.pattern,
      ruleEnabled: popupRuleState.enabled,
    }),
  };
};

type PopupModel = Awaited<ReturnType<typeof resolvePopupModel>>;

const forPopupTab = <T>(
  tabId: number | undefined,
  read: (value: number) => T,
  empty: T,
): T => (typeof tabId === "number" ? read(tabId) : empty);

const buildSummary = async (
  deps: PopupCommandDeps,
  inputs: PopupStateInputs,
  model: PopupModel,
  generation: number,
) => {
  const activeTab = inputs.activeTab!;
  const runtimeSnapshot = await deps
    .resolveCachedSnapshot(
      model.hostname,
      activeTab.cookieStoreId,
      new URL(activeTab.url!).origin,
      { trackSeenHost: false },
    )
    .catch(() => null);
  const accessedCategories = forPopupTab(activeTab.id, deps.getSurfaceAccess, {});
  const failedCategories = forPopupTab(activeTab.id, deps.getSurfaceErrors, {});
  const evidenceByRealm = forPopupTab(activeTab.id, deps.getRealmEvidence, {});
  const queryCounts = forPopupTab(activeTab.id, deps.getSurfaceCounts, {});
  const methodCounts = forPopupTab(activeTab.id, deps.getSurfaceMethodCounts, {});
  const runtimeExpected =
    inputs.fingerprintEnabled &&
    !inputs.controlState.panicMode &&
    model.effectiveSource !== "trusted-site" &&
    model.effectiveSource !== "none" &&
    model.popupRuleState.enabled !== false &&
    (Boolean(runtimeSnapshot) ||
      model.surfaceState.locationProfileActive ||
      inputs.fingerprintEnabled ||
      model.popupResolution.fallbackState === "protections" ||
      Object.values(
        model.surfaceState.currentRule?.fingerprintSurfaceOverrides ?? {},
      ).some((value) => value !== undefined));
  const noticeContext = {
    snapshot: runtimeSnapshot,
    active: runtimeExpected,
    suggestions: model.filteredSuggestions.items,
  } as const;
  const syncedNotices = await syncSiteNotices({
    hostname: model.hostname,
    ...(activeTab.cookieStoreId ? { cookieStoreId: activeTab.cookieStoreId } : {}),
    applicableKinds: getApplicableNotices(noticeContext).map((notice) => notice.kind),
    activeKinds: getPopupPolicyNotices({
      ...noticeContext,
      accessedCategories,
    }).map((notice) => notice.kind),
  });
  const notifications = selectPopupNotifications(
    syncedNotices,
    model.hostname,
    activeTab.cookieStoreId,
  );
  const attentionKinds = notifications
    .filter(isNoticeAttention)
    .map((notification) => notification.kind);
  const contextKinds = notifications
    .filter(
      (notification) =>
        notification.scope === "site" && notification.severity === "needs-action",
    )
    .map((notification) => notification.kind);
  return {
    notifications,
    effectiveSummary: buildEffectiveSummary({
      generation,
      source: model.effectiveSource,
      pattern:
        model.effectiveSource === "trusted-site"
          ? model.popupResolution.matchedTrustedSitePattern
          : model.popupRuleState.pattern,
      enabled: inputs.fingerprintEnabled ? model.popupRuleState.enabled : false,
      editable: model.popupRuleState.canEdit,
      toggleable: model.popupRuleState.canToggle,
      panicMode: inputs.controlState.panicMode,
      supported: true,
      snapshot: runtimeSnapshot,
      suggestions: model.filteredSuggestions.items,
      accessedCategories,
      failedCategories,
      evidenceByRealm,
      queryCounts,
      methodCounts,
      runtimeExpected,
      attentionKinds,
      contextNotificationKinds: contextKinds,
      storedNotificationKinds: contextKinds,
    }),
  };
};

const buildSupportedResponse = (
  inputs: PopupStateInputs,
  model: PopupModel,
  summary: Awaited<ReturnType<typeof buildSummary>>,
): GetPopupStateResponse => {
  const { popupResolution: resolution, surfaceState } = model;
  const activeTab = inputs.activeTab!;
  return buildPopupState({
    panicMode: inputs.controlState.panicMode,
    profiles: inputs.profiles,
    currentRule: model.popupRuleState,
    currentTab: {
      supported: true,
      hostname: model.hostname,
      url: activeTab.url!,
      locationLabel: model.displayedLocation?.label ?? null,
      locationId: model.displayedLocation?.id ?? null,
      locationProfileActive: surfaceState.locationProfileActive,
      fallbackState: resolution.fallbackState,
      containerAssignment: model.containerAssignment,
      containerAssignmentConfigured: resolution.containerAssignmentConfigured,
      displayedRulePattern: resolution.displayedRule?.pattern ?? null,
      matchedRulePattern: resolution.matchedRulePattern,
      matchedTrustedSitePattern: resolution.matchedTrustedSitePattern,
      matchedTrustedSiteEnabled: resolution.matchedTrustedSiteEnabled,
      hasExactRule: resolution.hasExactRule,
      canCleanDomain: true,
      pendingRulePattern: model.hostname,
      hasMatch: resolution.hasMatch,
      activeContainer: model.activeContainer,
      winningSource: resolution.winningSource,
      firefoxFirstInlineEnabled: model.firstInlineEnabled,
      firefoxFirstInlinePermissionRequired:
        model.firstInlineAvailable &&
        resolution.hasMatch &&
        resolution.winningSource !== "trusted-site" &&
        !model.firstInlineEnabled,
    },
    effectiveSummary: summary.effectiveSummary,
    suggestions: model.filteredSuggestions.items,
    hasSuggestionWarning: model.filteredSuggestions.hasWarning,
    notifications: summary.notifications,
  });
};

export const createPopupStateHandler = (deps: PopupCommandDeps) => {
  let generation = 0;
  return async (tabId?: number): Promise<GetPopupStateResponse> => {
    const inputs = await loadPopupInputs(deps, tabId);
    const { activeTab } = inputs;
    if (!activeTab) return buildUnsupportedResponse(inputs, ++generation, null);
    if (!deps.isSupportedWebUrl(activeTab.url)) {
      return buildUnsupportedResponse(inputs, ++generation, activeTab.url ?? null);
    }
    const model = await resolvePopupModel(deps, inputs);
    const summary = await buildSummary(deps, inputs, model, ++generation);
    return buildSupportedResponse(inputs, model, summary);
  };
};
