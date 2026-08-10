import {
  getApplicableNotices,
  getPopupPolicyNotices,
} from "@/background/popup-effective-summary";
import {
  filterRuleSuggestions,
  resolvePopupWorkerMode,
  resolvePopupResolution,
} from "@/background/popup-state";
import { resolveProfileSnapshot } from "@/background/rules/resolver";
import {
  loadPopupNotifications,
  selectPopupNotifications,
  syncSiteNotices,
} from "@/background/storage/popup-notifications";
import {
  loadSiteSuggestions,
  selectPopupSuggestions,
} from "@/background/storage/site-suggestions";
import type {
  getSurfaceAccess,
  getSurfaceErrors,
} from "@/background/surface-access-tracker";
import { buildSurfaceAssessments } from "@/background/surface-assessments";
import type { getRealmEvidence } from "@/background/surface-evidence-tracker";
import {
  resolveProtectionFailure,
  selectToolbarNotice,
} from "@/background/toolbar-notification-state";
import { readFingerprintSource } from "@/shared/browser-fingerprint";
import { isSuggestionNotice } from "@/shared/popup-notification-kinds";
import { isNoticeAttention } from "@/shared/popup-notification-state";
import type {
  ContainerAssignment,
  ControlState,
  DomainRule,
  GlobalFallbackRule,
  Location,
  PopupEffectiveSource,
  RuntimeSnapshot,
  SharedSpoofingConfig,
  SharedWorkerHandlingMode,
  TrustedSite,
} from "@/shared/types";

type TabWithCookieStore = chrome.tabs.Tab & { cookieStoreId?: string };

export type ActionCachedState = {
  profiles: Location[];
  rules: DomainRule[];
  trustedSites: TrustedSite[];
  controlState: ControlState;
  debugMode: boolean;
  watchPositionDelay: [number, number];
  browserFingerprintSpoofingEnabled: boolean;
  sharedWorkerHandlingMode: SharedWorkerHandlingMode;
  sharedSpoofing: SharedSpoofingConfig | undefined;
  globalFallbackRule: GlobalFallbackRule | undefined;
  containerAssignments: ContainerAssignment[];
  attentionMotionEnabled: boolean;
};

export type ActionContextDeps = {
  findDisplayedRule: (hostname: string, rules: DomainRule[]) => DomainRule | null;
  getCachedState: () => Promise<ActionCachedState>;
  getExactHostname: (url: string) => string;
  getSurfaceAccess: typeof getSurfaceAccess;
  getSurfaceErrors: typeof getSurfaceErrors;
  getRealmEvidence: typeof getRealmEvidence;
  isSupportedWebUrl: (url: string | undefined) => url is string;
  resolveFallbackId: (
    profiles: Location[],
    globalFallbackRule: GlobalFallbackRule | undefined,
  ) => string | null;
};

export type ActionContext = {
  tabId: number;
  tab: chrome.tabs.Tab | undefined;
  activeUrl: string | undefined;
  supported: boolean;
  hostname: string | null;
  displayedRule: DomainRule | null;
  cookieStoreId: string | undefined;
  containerAssignment: ContainerAssignment | null;
  popupResolution: ReturnType<typeof resolvePopupResolution> | null;
  matchedRule: DomainRule | null;
  effectiveSnapshot: RuntimeSnapshot | null;
  filteredSuggestions: ReturnType<typeof filterRuleSuggestions>;
  winningSource: ReturnType<typeof resolvePopupResolution>["winningSource"] | "none";
  protectionFailure: ReturnType<typeof resolveProtectionFailure>;
  priorityNotification: ReturnType<typeof selectToolbarNotice>;
  hasActionableSuggestion: boolean;
  controlState: ControlState;
  debugMode: boolean;
  attentionMotionEnabled: boolean;
};

type LoadedActionInputs = {
  cached: ActionCachedState;
  siteSuggestions: Awaited<ReturnType<typeof loadSiteSuggestions>>;
  popupNotifications: Awaited<ReturnType<typeof loadPopupNotifications>>;
  tab: chrome.tabs.Tab | undefined;
  fingerprintSource: Awaited<ReturnType<typeof readFingerprintSource>>;
};

const toEffectiveSource = (
  source: ReturnType<typeof resolvePopupResolution>["winningSource"] | "none",
): PopupEffectiveSource => {
  if (source === "rule") return "site-rule";
  if (source === "fallback") return "default-rule";
  return source;
};

const loadActionInputs = async (
  deps: ActionContextDeps,
  tabId: number,
): Promise<LoadedActionInputs> => {
  const [cached, siteSuggestions, popupNotifications, tab, fingerprintSource] =
    await Promise.all([
      deps.getCachedState(),
      loadSiteSuggestions(),
      loadPopupNotifications(),
      chrome.tabs.get(tabId).catch(() => undefined),
      readFingerprintSource(),
    ]);
  return { cached, siteSuggestions, popupNotifications, tab, fingerprintSource };
};

const resolveActionModel = (
  deps: ActionContextDeps,
  inputs: LoadedActionInputs,
  tabId: number,
  tabUrl?: string,
) => {
  const { cached, tab, fingerprintSource } = inputs;
  const activeUrl = tabUrl ?? tab?.url;
  const supported = deps.isSupportedWebUrl(activeUrl);
  const hostname = supported ? deps.getExactHostname(activeUrl) : null;
  const displayedRule = hostname
    ? deps.findDisplayedRule(hostname, cached.rules)
    : null;
  const cookieStoreId = (tab as TabWithCookieStore | undefined)?.cookieStoreId;
  const containerAssignment =
    cookieStoreId && hostname
      ? (cached.containerAssignments.find(
          (assignment) => assignment.cookieStoreId === cookieStoreId,
        ) ?? null)
      : null;
  const fallbackLocationId = deps.resolveFallbackId(
    cached.profiles,
    cached.globalFallbackRule,
  );
  const popupResolution = hostname
    ? resolvePopupResolution({
        hostname,
        rules: cached.rules,
        containerAssignment,
        globalFallbackRule: cached.globalFallbackRule,
        fallbackLocationId,
        trustedSites: cached.trustedSites,
        fingerprintEnabled: cached.browserFingerprintSpoofingEnabled,
      })
    : null;
  const matchedRule = popupResolution?.activeRule ?? null;
  const effectiveSnapshot = hostname
    ? resolveProfileSnapshot({
        browserFingerprintSource: fingerprintSource,
        fingerprintEnabled: cached.browserFingerprintSpoofingEnabled,
        containerAssignments: cached.containerAssignments,
        cookieStoreId,
        debugMode: cached.debugMode,
        globalFallbackRule: cached.globalFallbackRule,
        hostname,
        profiles: cached.profiles,
        rules: cached.rules,
        sharedSpoofing: cached.sharedSpoofing,
        sharedWorkerHandlingMode: cached.sharedWorkerHandlingMode,
        trustedSites: cached.trustedSites,
        watchPositionDelay: cached.watchPositionDelay,
      })
    : null;
  const workerMode = popupResolution
    ? resolvePopupWorkerMode({
        resolution: popupResolution,
        containerAssignment,
        globalFallbackRule: cached.globalFallbackRule,
        sharedSpoofing: cached.sharedSpoofing,
        preferenceMode: cached.sharedWorkerHandlingMode,
      })
    : undefined;
  const filteredSuggestions = filterRuleSuggestions(
    selectPopupSuggestions(inputs.siteSuggestions, hostname, cookieStoreId),
    matchedRule,
    workerMode,
  );
  const winningSource = popupResolution?.winningSource ?? "none";
  const effectiveSource = toEffectiveSource(winningSource);
  const protectionFailure = effectiveSnapshot
    ? resolveProtectionFailure(
        buildSurfaceAssessments({
          source: effectiveSource,
          snapshot: effectiveSnapshot,
          runtimeExpected: true,
          failedCategories: deps.getSurfaceErrors(tabId),
          evidenceByRealm: deps.getRealmEvidence(tabId),
        }),
      )
    : null;
  return {
    activeUrl,
    supported,
    hostname,
    displayedRule,
    cookieStoreId,
    containerAssignment,
    popupResolution,
    matchedRule,
    effectiveSnapshot,
    filteredSuggestions,
    winningSource,
    protectionFailure,
  };
};

export const loadActionContext = async (
  deps: ActionContextDeps,
  tabId: number,
  tabUrl?: string,
): Promise<ActionContext> => {
  const inputs = await loadActionInputs(deps, tabId);
  const model = resolveActionModel(deps, inputs, tabId, tabUrl);
  const active =
    model.supported &&
    !inputs.cached.controlState.panicMode &&
    model.winningSource !== "trusted-site";
  const applicableKinds = getApplicableNotices({
    snapshot: model.effectiveSnapshot,
    active,
    suggestions: model.filteredSuggestions.items,
  }).map((notice) => notice.kind);
  const activeKinds = getPopupPolicyNotices({
    snapshot: model.effectiveSnapshot,
    active,
    suggestions: model.filteredSuggestions.items,
    accessedCategories: deps.getSurfaceAccess(tabId),
  }).map((notice) => notice.kind);
  const syncedNotices = model.hostname
    ? await syncSiteNotices({
        hostname: model.hostname,
        ...(model.cookieStoreId ? { cookieStoreId: model.cookieStoreId } : {}),
        applicableKinds,
        activeKinds,
      })
    : inputs.popupNotifications;
  const selected = selectPopupNotifications(
    syncedNotices,
    model.hostname,
    model.cookieStoreId,
  );
  return {
    tabId,
    tab: inputs.tab,
    ...model,
    priorityNotification: selectToolbarNotice(selected),
    hasActionableSuggestion: selected.some(
      (notice) => isNoticeAttention(notice) && isSuggestionNotice(notice.kind),
    ),
    controlState: inputs.cached.controlState,
    debugMode: inputs.cached.debugMode,
    attentionMotionEnabled: inputs.cached.attentionMotionEnabled,
  };
};
