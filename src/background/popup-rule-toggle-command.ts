import { resolvePopupHostname } from "@/background/popup-command-helpers";
import {
  persistContainerMutation,
  persistFallbackMutation,
  persistPopupRuleMutation,
} from "@/background/popup-command-persist";
import type { PopupCommandDeps } from "@/background/popup-command-types";
import {
  buildPopupSuccess,
  findContainerAssignment,
  shouldToggleContainer,
  type CurrentPopupRule,
  type PopupMutationContext,
  type PopupStateGetter,
} from "@/background/popup-rule-command-helpers";
import { getPopupCurrentRule, resolvePopupResolution } from "@/background/popup-state";
import { loadContainerAssignments } from "@/background/storage/container-assignments";
import { loadLocations } from "@/background/storage/locations";
import {
  getFingerprintEnabled,
  getGlobalFallbackRule,
} from "@/background/storage/preferences";
import { loadRules } from "@/background/storage/rules";
import { loadTrustedSites } from "@/background/storage/trusted-sites";
import { getContainer } from "@/shared/container-service";
import {
  LogCategory,
  type ContainerAssignment,
  type DeleteRuleResponse,
  type GlobalFallbackRule,
  type ToggleRuleResponse,
} from "@/shared/types";

type ActiveTab = Awaited<ReturnType<PopupCommandDeps["getPopupTabById"]>>;

const persistContainerToggle = async (
  context: PopupMutationContext,
  input: {
    loadedContainers: Awaited<ReturnType<typeof loadContainerAssignments>>;
    containerAssignment: ContainerAssignment;
    enabled: boolean;
    hostname: string;
    activeTab: ActiveTab;
  },
): Promise<ToggleRuleResponse> => {
  const nextAssignments = input.loadedContainers.map((assignment) =>
    assignment.cookieStoreId === input.containerAssignment.cookieStoreId
      ? { ...assignment, enabled: input.enabled }
      : assignment,
  );
  await persistContainerMutation(
    context.deps,
    nextAssignments,
    input.hostname,
    input.activeTab,
  );
  context.deps.logExtensionEvent({
    enabled: context.deps.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "popup.rule-toggled",
    payload: {
      hostname: input.hostname,
      ...(input.activeTab?.id !== undefined ? { tabId: input.activeTab.id } : {}),
      details: { pattern: null, source: "container", enabled: input.enabled },
    },
  });
  return {
    ok: true,
    ...(await buildPopupSuccess(context.getPopupState, input.activeTab?.id)),
  };
};

const persistFallbackToggle = async (
  context: PopupMutationContext,
  input: {
    globalFallbackRule: GlobalFallbackRule;
    enabled: boolean;
    hostname: string;
    activeTab: ActiveTab;
    source: "fallback" | "global-rule";
  },
): Promise<ToggleRuleResponse> => {
  const nextFallbackRule = { ...input.globalFallbackRule, enabled: input.enabled };
  await persistFallbackMutation(
    context.deps,
    nextFallbackRule,
    input.hostname,
    input.activeTab,
  );
  context.deps.logExtensionEvent({
    enabled: context.deps.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "popup.rule-toggled",
    payload: {
      hostname: input.hostname,
      ...(input.activeTab?.id !== undefined ? { tabId: input.activeTab.id } : {}),
      details: { pattern: null, source: input.source, enabled: input.enabled },
    },
  });
  return {
    ok: true,
    ...(await buildPopupSuccess(context.getPopupState, input.activeTab?.id)),
  };
};

const persistRuleToggle = async (
  context: PopupMutationContext,
  input: {
    rules: Awaited<ReturnType<typeof loadRules>>;
    currentRule: CurrentPopupRule;
    enabled: boolean;
    hostname: string;
    activeTab: ActiveTab;
  },
): Promise<ToggleRuleResponse> => {
  const nextRules = input.rules.map((rule) =>
    rule.pattern === input.currentRule.pattern
      ? { ...rule, enabled: input.enabled }
      : rule,
  );
  await persistPopupRuleMutation(
    context.deps,
    nextRules,
    input.hostname,
    input.activeTab,
  );
  context.deps.logExtensionEvent({
    enabled: context.deps.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "popup.rule-toggled",
    payload: {
      hostname: input.hostname,
      ...(input.activeTab?.id !== undefined ? { tabId: input.activeTab.id } : {}),
      details: { pattern: input.currentRule.pattern, enabled: input.enabled },
    },
  });
  return {
    ok: true,
    ...(await buildPopupSuccess(context.getPopupState, input.activeTab?.id)),
  };
};

type ToggleInputs = Awaited<ReturnType<typeof loadToggleInputs>>;

const loadToggleInputs = async (deps: PopupCommandDeps, tabId?: number) => {
  const [profiles, rules, trustedSites, activeTab, globalFallbackRule, enabled] =
    await Promise.all([
      loadLocations(),
      loadRules(),
      loadTrustedSites(),
      deps.getPopupTabById(tabId),
      getGlobalFallbackRule(),
      getFingerprintEnabled(),
    ]);
  deps.setLastKnownProfiles(profiles);
  return { profiles, rules, trustedSites, activeTab, globalFallbackRule, enabled };
};

const resolveToggleTarget = async (
  deps: PopupCommandDeps,
  loaded: ToggleInputs,
  hostname: string,
) => {
  const loadedContainers = await loadContainerAssignments();
  const containerAssignment = findContainerAssignment(
    loadedContainers,
    loaded.activeTab?.cookieStoreId,
  );
  const activeContainer = loaded.activeTab?.cookieStoreId
    ? await getContainer(loaded.activeTab.cookieStoreId)
    : null;
  const resolution = resolvePopupResolution({
    hostname,
    rules: loaded.rules,
    containerAssignment,
    globalFallbackRule: loaded.globalFallbackRule,
    fallbackLocationId: deps.resolveFallbackId(
      loaded.profiles,
      loaded.globalFallbackRule,
    ),
    trustedSites: loaded.trustedSites,
    fingerprintEnabled: loaded.enabled,
  });
  return { loadedContainers, containerAssignment, activeContainer, resolution };
};

const toggleCurrentRule = async (
  context: PopupMutationContext,
  enabled: boolean,
  tabId?: number,
  hostnameOverride?: string,
): Promise<ToggleRuleResponse> => {
  const { deps } = context;
  await deps.ensureStorageMigration();
  const loaded = await loadToggleInputs(deps, tabId);
  const hostname = resolvePopupHostname(
    hostnameOverride,
    loaded.activeTab,
    deps.isSupportedWebUrl,
    deps.getExactHostname,
  );
  if (!hostname) {
    return { ok: false, error: "Open a regular web page before toggling a rule." };
  }
  const target = await resolveToggleTarget(deps, loaded, hostname);
  if (
    shouldToggleContainer(
      target.containerAssignment,
      target.resolution.winningSource,
      target.activeContainer,
    )
  ) {
    return persistContainerToggle(context, {
      loadedContainers: target.loadedContainers,
      containerAssignment: target.containerAssignment,
      enabled,
      hostname,
      activeTab: loaded.activeTab,
    });
  }
  if (target.resolution.winningSource === "fallback" && loaded.globalFallbackRule) {
    return persistFallbackToggle(context, {
      globalFallbackRule: loaded.globalFallbackRule,
      enabled,
      hostname,
      activeTab: loaded.activeTab,
      source: "fallback",
    });
  }
  const currentRule = getPopupCurrentRule(target.resolution);
  if (currentRule) {
    return persistRuleToggle(context, {
      rules: loaded.rules,
      currentRule,
      enabled,
      hostname,
      activeTab: loaded.activeTab,
    });
  }
  if (!target.activeContainer && loaded.globalFallbackRule) {
    return persistFallbackToggle(context, {
      globalFallbackRule: loaded.globalFallbackRule,
      enabled,
      hostname,
      activeTab: loaded.activeTab,
      source:
        target.resolution.winningSource === "fallback" ? "fallback" : "global-rule",
    });
  }
  return { ok: false, error: "No current rule to toggle." };
};

const deleteCurrentRule = async (
  context: PopupMutationContext,
  tabId?: number,
  hostnameOverride?: string,
): Promise<DeleteRuleResponse> => {
  const { deps, getPopupState } = context;
  await deps.ensureStorageMigration();
  const loaded = await loadToggleInputs(deps, tabId);
  const hostname = resolvePopupHostname(
    hostnameOverride,
    loaded.activeTab,
    deps.isSupportedWebUrl,
    deps.getExactHostname,
  );
  if (!hostname) {
    return { ok: false, error: "Open a regular web page before deleting a rule." };
  }
  const containerAssignment = findContainerAssignment(
    await loadContainerAssignments(),
    loaded.activeTab?.cookieStoreId,
  );
  const currentRule = getPopupCurrentRule(
    resolvePopupResolution({
      hostname,
      rules: loaded.rules,
      containerAssignment,
      globalFallbackRule: loaded.globalFallbackRule,
      fallbackLocationId: deps.resolveFallbackId(
        loaded.profiles,
        loaded.globalFallbackRule,
      ),
      trustedSites: loaded.trustedSites,
      fingerprintEnabled: loaded.enabled,
    }),
  );
  if (!currentRule) return { ok: false, error: "No current rule to delete." };
  const nextRules = loaded.rules.filter((rule) => rule.pattern !== currentRule.pattern);
  await persistPopupRuleMutation(deps, nextRules, hostname, loaded.activeTab);
  deps.logExtensionEvent({
    enabled: deps.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "popup.rule-deleted",
    payload: {
      hostname,
      ...(loaded.activeTab?.id !== undefined ? { tabId: loaded.activeTab.id } : {}),
      details: { pattern: currentRule.pattern },
    },
  });
  return { ok: true, state: (await getPopupState(loaded.activeTab?.id)).state };
};

export const createRuleToggleHandlers = (
  deps: PopupCommandDeps,
  getPopupState: PopupStateGetter,
) => {
  const context = { deps, getPopupState };
  return {
    toggleCurrentRule: toggleCurrentRule.bind(null, context),
    deleteCurrentRule: deleteCurrentRule.bind(null, context),
  };
};
