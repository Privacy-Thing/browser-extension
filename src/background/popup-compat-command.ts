import { resolvePopupHostname } from "@/background/popup-command-helpers";
import { persistPopupRuleMutation } from "@/background/popup-command-persist";
import type { PopupCommandDeps } from "@/background/popup-command-types";
import type {
  PopupMutationContext,
  PopupStateGetter,
} from "@/background/popup-rule-command-helpers";
import {
  createSuggestionRule,
  getSuggestionTarget,
  resolvePopupResolution,
} from "@/background/popup-state";
import { loadContainerAssignments } from "@/background/storage/container-assignments";
import { loadLocations } from "@/background/storage/locations";
import {
  getFingerprintEnabled,
  getGlobalFallbackRule,
} from "@/background/storage/preferences";
import { loadRules } from "@/background/storage/rules";
import { updateSuggestionStatus } from "@/background/storage/site-suggestions";
import {
  LogCategory,
  type ApplySuggestionResponse,
  type PopupPolicyNoticeKind,
  type SiteSuggestionKind,
  type WorkerInjectionMode,
} from "@/shared/types";

type CompatibilityKind = SiteSuggestionKind | PopupPolicyNoticeKind;

const normalizeSuggestionMode = (
  mode: WorkerInjectionMode | undefined,
): WorkerInjectionMode => (mode === "native" ? "native" : "spoof");

const getSuggestionOptions = (
  kind: CompatibilityKind,
  workerMode: WorkerInjectionMode,
) => {
  if (kind === "worker-csp-relaxation") return { relaxCspForWorkers: true };
  if (kind === "service-worker-block") return { serviceWorkerOverride: false };
  return { sharedWorkerHandlingMode: workerMode };
};

type CompatibilityInput = {
  kind: CompatibilityKind;
  tabId?: number;
  hostnameOverride?: string;
  sharedWorkerHandlingMode?: WorkerInjectionMode;
};

const applyCompatibilityAction = async (
  context: PopupMutationContext,
  input: CompatibilityInput,
): Promise<ApplySuggestionResponse> => {
  const { deps, getPopupState } = context;
  await deps.ensureStorageMigration();
  const [profiles, rules, assignments, activeTab, fallbackRule, enabled] =
    await Promise.all([
      loadLocations(),
      loadRules(),
      loadContainerAssignments(),
      deps.getPopupTabById(input.tabId),
      getGlobalFallbackRule(),
      getFingerprintEnabled(),
    ]);
  const hostname = resolvePopupHostname(
    input.hostnameOverride,
    activeTab,
    deps.isSupportedWebUrl,
    deps.getExactHostname,
  );
  if (!hostname) {
    return {
      ok: false,
      error: "Open a regular web page before applying this compatibility change.",
    };
  }
  const containerAssignment = activeTab?.cookieStoreId
    ? (assignments.find(
        (assignment) => assignment.cookieStoreId === activeTab.cookieStoreId,
      ) ?? null)
    : null;
  const resolution = resolvePopupResolution({
    hostname,
    rules,
    containerAssignment,
    globalFallbackRule: fallbackRule,
    fallbackLocationId: deps.resolveFallbackId(profiles, fallbackRule),
    trustedSites: [],
    fingerprintEnabled: enabled,
  });
  const target = getSuggestionTarget(hostname, resolution, containerAssignment);
  const locationId = target.locationId;
  if (
    (locationId && !profiles.some((location) => location.id === locationId)) ||
    (!locationId && !target.allowsMissingLocationId)
  ) {
    return {
      ok: false,
      error: "No active location is available for this site.",
    };
  }
  const nextRules = rules.filter(
    (rule) => rule.pattern !== target.rulePatternToReplace,
  );
  const nextWorkerMode = normalizeSuggestionMode(input.sharedWorkerHandlingMode);
  nextRules.unshift(
    createSuggestionRule(target, getSuggestionOptions(input.kind, nextWorkerMode)),
  );
  if (
    input.kind === "worker-csp-relaxation" ||
    input.kind === "shared-worker-injection-relaxation"
  ) {
    await updateSuggestionStatus(
      hostname,
      input.kind,
      "accepted",
      activeTab?.cookieStoreId,
    );
  }
  await persistPopupRuleMutation(deps, nextRules, hostname, activeTab);
  deps.logExtensionEvent({
    enabled: deps.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "popup.compatibility-action-applied",
    payload: {
      hostname,
      ...(activeTab?.id !== undefined ? { tabId: activeTab.id } : {}),
      details: {
        kind: input.kind,
        locationId,
        pattern: target.nextPattern,
        ...(input.kind === "shared-worker-injection-relaxation" ||
        input.kind === "shared-worker-strict"
          ? { sharedWorkerHandlingMode: nextWorkerMode }
          : {}),
      },
    },
  });
  return { ok: true, state: (await getPopupState(activeTab?.id)).state };
};

const dismissPopupSuggestion = async (
  context: PopupMutationContext,
  kind: SiteSuggestionKind,
  tabId?: number,
  hostnameOverride?: string,
): Promise<ApplySuggestionResponse> => {
  const { deps, getPopupState } = context;
  await deps.ensureStorageMigration();
  const activeTab = await deps.getPopupTabById(tabId);
  const hostname = resolvePopupHostname(
    hostnameOverride,
    activeTab,
    deps.isSupportedWebUrl,
    deps.getExactHostname,
  );
  if (!hostname) {
    return {
      ok: false,
      error: "Open a regular web page before dismissing a suggestion.",
    };
  }
  await updateSuggestionStatus(hostname, kind, "dismissed", activeTab?.cookieStoreId);
  return { ok: true, state: (await getPopupState(activeTab?.id)).state };
};

export const createCompatHandlers = (
  deps: PopupCommandDeps,
  getPopupState: PopupStateGetter,
) => {
  const context = { deps, getPopupState };
  const createApplyHandler =
    <TKind extends CompatibilityKind>() =>
    (
      kind: TKind,
      tabId?: number,
      hostnameOverride?: string,
      sharedWorkerHandlingMode?: WorkerInjectionMode,
    ) =>
      applyCompatibilityAction(context, {
        kind,
        ...(tabId !== undefined ? { tabId } : {}),
        ...(hostnameOverride !== undefined ? { hostnameOverride } : {}),
        ...(sharedWorkerHandlingMode !== undefined ? { sharedWorkerHandlingMode } : {}),
      });
  const applyPopupSuggestion = createApplyHandler<SiteSuggestionKind>();
  const applyPopupPolicyAction = createApplyHandler<PopupPolicyNoticeKind>();
  return {
    applyPopupSuggestion,
    applyPopupPolicyAction,
    dismissPopupSuggestion: dismissPopupSuggestion.bind(null, context),
  };
};
