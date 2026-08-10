import { resolvePopupHostname } from "@/background/popup-command-helpers";
import { persistPopupRuleMutation } from "@/background/popup-command-persist";
import type {
  PopupCommandDeps,
  UpdateCurrentRuleInput,
} from "@/background/popup-command-types";
import type {
  PopupMutationContext,
  PopupStateGetter,
} from "@/background/popup-rule-command-helpers";
import {
  buildPopupSuccess,
  resolveSeedKeyPatch,
} from "@/background/popup-rule-command-helpers";
import {
  buildPopupRuleSaveTarget,
  getTransparentRule,
  resolvePopupResolution,
} from "@/background/popup-state";
import { loadContainerAssignments } from "@/background/storage/container-assignments";
import { loadLocations } from "@/background/storage/locations";
import {
  getFingerprintEnabled,
  getGlobalFallbackRule,
} from "@/background/storage/preferences";
import { loadRules } from "@/background/storage/rules";
import { loadTrustedSites } from "@/background/storage/trusted-sites";
import {
  LogCategory,
  type AssignLocationResponse,
  type UpdateRuleResponse,
} from "@/shared/types";

const assignDomainLocation = async (
  context: PopupMutationContext,
  locationId: string,
  patternMode: "exact" | "suffix",
  tabId?: number,
): Promise<AssignLocationResponse> => {
  const { deps, getPopupState } = context;
  await deps.ensureStorageMigration();
  const [profiles, rules, activeTab] = await Promise.all([
    loadLocations(),
    loadRules(),
    deps.getPopupTabById(tabId),
  ]);
  const hostname = deps.isSupportedWebUrl(activeTab?.url)
    ? deps.getExactHostname(activeTab.url)
    : null;
  if (!hostname) {
    return {
      ok: false,
      error: "Open a regular web page before assigning a location.",
    };
  }
  if (!profiles.some((location) => location.id === locationId)) {
    return { ok: false, error: "Unknown location." };
  }
  const pattern = patternMode === "suffix" ? `*${hostname}` : hostname;
  const existingRule = rules.find((rule) => rule.pattern === pattern);
  const nextRules = rules.filter((rule) => rule.pattern !== pattern);
  nextRules.unshift({
    pattern,
    locationId,
    enabled: true,
    ...resolveSeedKeyPatch(existingRule ?? null, locationId),
    relaxCspForWorkers: existingRule?.relaxCspForWorkers ?? false,
    ...(existingRule?.fingerprintSurfaceOverrides
      ? { fingerprintSurfaceOverrides: existingRule.fingerprintSurfaceOverrides }
      : {}),
  });
  deps.setLastKnownProfiles(profiles);
  await persistPopupRuleMutation(deps, nextRules, hostname, activeTab);
  deps.logExtensionEvent({
    enabled: deps.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "popup.rule-assigned",
    payload: {
      hostname,
      ...(activeTab?.id !== undefined ? { tabId: activeTab.id } : {}),
      details: { pattern, locationId },
    },
  });
  return {
    ok: true,
    ...(await buildPopupSuccess(getPopupState, activeTab?.id)),
  };
};

type UpdateInputs = Awaited<ReturnType<typeof loadUpdateInputs>>;

const loadUpdateInputs = async (
  deps: PopupCommandDeps,
  input: UpdateCurrentRuleInput,
) => {
  const [
    profiles,
    rules,
    trustedSites,
    containerAssignments,
    activeTab,
    globalFallbackRule,
    fingerprintEnabled,
  ] = await Promise.all([
    loadLocations(),
    loadRules(),
    loadTrustedSites(),
    loadContainerAssignments(),
    deps.getPopupTabById(input.tabId),
    getGlobalFallbackRule(),
    getFingerprintEnabled(),
  ]);
  deps.setLastKnownProfiles(profiles);
  const hostname = resolvePopupHostname(
    input.hostnameOverride,
    activeTab,
    deps.isSupportedWebUrl,
    deps.getExactHostname,
  );
  return {
    profiles,
    rules,
    trustedSites,
    containerAssignments,
    activeTab,
    globalFallbackRule,
    fingerprintEnabled,
    hostname,
  };
};

const persistRuleUpdate = async (
  context: PopupMutationContext,
  input: UpdateCurrentRuleInput,
  loaded: UpdateInputs & { hostname: string },
): Promise<UpdateRuleResponse> => {
  const { deps, getPopupState } = context;
  const containerAssignment = loaded.activeTab?.cookieStoreId
    ? (loaded.containerAssignments.find(
        (assignment) => assignment.cookieStoreId === loaded.activeTab?.cookieStoreId,
      ) ?? null)
    : null;
  const resolution = resolvePopupResolution({
    hostname: loaded.hostname,
    rules: loaded.rules,
    containerAssignment,
    globalFallbackRule: loaded.globalFallbackRule,
    fallbackLocationId: deps.resolveFallbackId(
      loaded.profiles,
      loaded.globalFallbackRule,
    ),
    trustedSites: loaded.trustedSites,
    fingerprintEnabled: loaded.fingerprintEnabled,
  });
  const { currentRule, nextPattern, nextRule } = buildPopupRuleSaveTarget({
    hostname: loaded.hostname,
    locationId: input.locationId,
    patternMode: input.patternMode,
    resolution,
    blockServiceWorkers: input.blockServiceWorkers,
    relaxCspForWorkers: input.relaxCspForWorkers,
    createExactOverride: input.createExactOverride ?? false,
    ...(input.serviceWorkerOverride !== undefined
      ? { serviceWorkerOverride: input.serviceWorkerOverride }
      : {}),
    ...(input.regionalPresetEnabled !== undefined
      ? { regionalPresetEnabled: input.regionalPresetEnabled }
      : {}),
    ...(input.workerHandlingOverride !== undefined
      ? { workerHandlingOverride: input.workerHandlingOverride }
      : {}),
  });
  const transparentRule = getTransparentRule(loaded.hostname, nextPattern, resolution);
  const conflictingRule = loaded.rules.find(
    (rule) => rule.pattern === nextPattern && rule.pattern !== currentRule?.pattern,
  );
  const replacementRule = transparentRule ?? conflictingRule;
  if (
    conflictingRule &&
    conflictingRule !== transparentRule &&
    !input.replaceExisting
  ) {
    return {
      ok: false,
      error: "A rule with that pattern already exists.",
      conflictPattern: conflictingRule.pattern,
    };
  }
  const nextRules = loaded.rules.filter(
    (rule) =>
      rule.pattern !== currentRule?.pattern &&
      rule.pattern !== replacementRule?.pattern,
  );
  nextRules.unshift(nextRule);
  await persistPopupRuleMutation(deps, nextRules, loaded.hostname, loaded.activeTab);
  deps.logExtensionEvent({
    enabled: deps.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "popup.rule-updated",
    payload: {
      hostname: loaded.hostname,
      ...(loaded.activeTab?.id !== undefined ? { tabId: loaded.activeTab.id } : {}),
      details: {
        previousPattern: currentRule?.pattern ?? null,
        nextPattern,
        locationId: input.locationId ?? null,
        blockServiceWorkerRegistration: input.blockServiceWorkers,
        serviceWorkerOverride: input.serviceWorkerOverride ?? null,
        workerHandlingOverride: input.workerHandlingOverride ?? null,
        regionalPresetEnabled: input.regionalPresetEnabled ?? null,
        relaxCspForWorkers: input.relaxCspForWorkers,
        replacedExisting: Boolean(replacementRule),
      },
    },
  });
  return {
    ok: true,
    state: (await getPopupState(loaded.activeTab?.id)).state,
    replacedExisting: Boolean(replacementRule),
  };
};

const updateCurrentRule = async (
  context: PopupMutationContext,
  input: UpdateCurrentRuleInput,
): Promise<UpdateRuleResponse> => {
  await context.deps.ensureStorageMigration();
  const loaded = await loadUpdateInputs(context.deps, input);
  if (!loaded.hostname) {
    return { ok: false, error: "Open a regular web page before editing a rule." };
  }
  if (
    input.locationId &&
    !loaded.profiles.some((location) => location.id === input.locationId)
  ) {
    return { ok: false, error: "Unknown location." };
  }
  return persistRuleUpdate(context, input, { ...loaded, hostname: loaded.hostname });
};

export const createRuleSaveHandlers = (
  deps: PopupCommandDeps,
  getPopupState: PopupStateGetter,
) => {
  const context = { deps, getPopupState };
  return {
    assignDomainLocation: assignDomainLocation.bind(null, context),
    updateCurrentRule: updateCurrentRule.bind(null, context),
  };
};
