import type {
  LoadedContainers,
  LoadedRules,
  PopupCommandDeps,
  PopupTab,
} from "./popup-command-types";

import { syncDynamicHeaderRules } from "@/background/dnr";
import {
  cleanupHostnameState,
  getRegistrableHostname,
} from "@/background/state-hygiene";
import { saveContainerAssignments } from "@/background/storage/container-assignments";
import { saveGlobalFallbackRule } from "@/background/storage/preferences";
import { saveRules } from "@/background/storage/rules";
import { fireAndForget } from "@/shared/async";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { withRuleSeedKey } from "@/shared/rule-seed";
import { LogCategory, type GlobalFallbackRule } from "@/shared/types";

type MutationFinalizeMode = "always" | "firefox-only";
type PopupMutationTrigger = "popup-rule-mutation";

type MutationFinalizeOptions = {
  deps: PopupCommandDeps;
  hostname: string;
  activeTab: PopupTab | undefined;
  refreshCachedConfig: boolean;
  refreshInjectionState: MutationFinalizeMode;
  trigger: PopupMutationTrigger;
  destructive: boolean;
};

const getMutationOrigins = (activeTab: PopupTab | undefined): string[] =>
  activeTab?.url && /^https?:/i.test(activeTab.url)
    ? [new URL(activeTab.url).origin]
    : [];

const refreshMutationConfig = async ({
  deps,
  refreshCachedConfig,
  refreshInjectionState,
}: Pick<
  MutationFinalizeOptions,
  "deps" | "refreshCachedConfig" | "refreshInjectionState"
>): Promise<void> => {
  if (refreshCachedConfig) await deps.refreshCachedConfig();
  const shouldRefreshInjection =
    refreshInjectionState === "always" ||
    (refreshInjectionState === "firefox-only" && BUILD_BROWSER_TARGET === "firefox");
  if (!shouldRefreshInjection) return;
  await deps.syncPreloadedState();
  await deps.refreshFxInjectionMode();
};

const seedMutationTab = async ({
  deps,
  hostname,
  activeTab,
}: Pick<MutationFinalizeOptions, "deps" | "hostname" | "activeTab">): Promise<void> => {
  if (activeTab?.id === undefined) return;
  const snapshot = await deps.resolveCachedSnapshot(
    hostname,
    activeTab.cookieStoreId,
    activeTab.url,
  );
  deps.updateSnapshotCache({
    tabId: activeTab.id,
    frameId: 0,
    hostname,
    value: snapshot,
    ...(activeTab.cookieStoreId ? { cookieStoreId: activeTab.cookieStoreId } : {}),
  });
  if (BUILD_BROWSER_TARGET === "firefox") {
    await deps.injectFxWindowSeed({
      tabId: activeTab.id,
      frameId: 0,
      ...(activeTab.cookieStoreId ? { cookieStoreId: activeTab.cookieStoreId } : {}),
      trigger: "popup-rule-mutation",
      ...(activeTab.url ? { navigationUrl: activeTab.url } : {}),
    });
  } else {
    await chrome.scripting
      .executeScript({
        target: { tabId: activeTab.id },
        world: deps.mainWorld,
        func: deps.seedWindowSnapshot,
        args: [snapshot, deps.runtimeWindowSeedPrefix],
      })
      .catch(() => undefined);
  }
  await chrome.tabs.reload(activeTab.id).catch(() => undefined);
};

const logMutationFinalize = ({
  deps,
  activeTab,
  trigger,
  destructive,
  normalizedHostname,
}: Pick<MutationFinalizeOptions, "deps" | "activeTab" | "trigger" | "destructive"> & {
  normalizedHostname: string;
}): void => {
  deps.logExtensionEvent({
    enabled: deps.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "state-hygiene.popup-mutation-finalized",
    payload: {
      hostname: normalizedHostname,
      ...(activeTab?.id !== undefined ? { tabId: activeTab.id } : {}),
      details: {
        trigger,
        destructive,
        cleanupHostnames: [normalizedHostname],
        exactOrigins: getMutationOrigins(activeTab),
        cookieStoreId: activeTab?.cookieStoreId ?? null,
      },
    },
  });
};

const finalizePopupMutation = async ({
  deps,
  hostname,
  activeTab,
  refreshCachedConfig,
  refreshInjectionState,
  trigger,
  destructive,
}: MutationFinalizeOptions): Promise<void> => {
  const normalizedHostname = getRegistrableHostname(hostname);
  if (destructive) await cleanupHostnameState(normalizedHostname);
  await refreshMutationConfig({
    deps,
    refreshCachedConfig,
    refreshInjectionState,
  });
  await syncDynamicHeaderRules(deps.getActiveTabContexts());
  logMutationFinalize({ deps, activeTab, trigger, destructive, normalizedHostname });
  await seedMutationTab({ deps, hostname, activeTab });
  await deps.refreshActionState(activeTab?.id);
};

type MutationFinalizeRequest = Omit<MutationFinalizeOptions, "destructive"> & {
  errorMessage: string;
  destructive?: boolean;
};

const runPopupMutationFinalize = ({
  errorMessage,
  destructive = false,
  ...options
}: MutationFinalizeRequest): void => {
  fireAndForget(finalizePopupMutation({ ...options, destructive }), (error) => {
    console.error(errorMessage, error);
  });
};

export const persistPopupRuleMutation = async (
  deps: PopupCommandDeps,
  nextRules: LoadedRules,
  hostname: string,
  activeTab: PopupTab | undefined,
): Promise<void> => {
  const normalizedRules = nextRules.map((rule) => withRuleSeedKey(rule));

  await saveRules(normalizedRules);
  deps.setLastKnownRules(normalizedRules);
  deps.removeHostnameContexts(hostname);
  runPopupMutationFinalize({
    deps,
    hostname,
    activeTab,
    refreshCachedConfig: false,
    refreshInjectionState: "firefox-only",
    errorMessage: "Failed to finalize popup rule mutation.",
    trigger: "popup-rule-mutation",
  });
};

export const persistFallbackMutation = async (
  deps: PopupCommandDeps,
  nextGlobalFallbackRule: GlobalFallbackRule,
  hostname: string,
  activeTab: PopupTab | undefined,
): Promise<void> => {
  await saveGlobalFallbackRule(nextGlobalFallbackRule);
  deps.setKnownFallback(nextGlobalFallbackRule);
  deps.removeHostnameContexts(hostname);
  runPopupMutationFinalize({
    deps,
    hostname,
    activeTab,
    refreshCachedConfig: true,
    refreshInjectionState: "always",
    errorMessage: "Failed to finalize popup fallback mutation.",
    trigger: "popup-rule-mutation",
  });
};

export const persistContainerMutation = async (
  deps: PopupCommandDeps,
  nextContainerAssignments: LoadedContainers,
  hostname: string,
  activeTab: PopupTab | undefined,
): Promise<void> => {
  await saveContainerAssignments(nextContainerAssignments);
  deps.setKnownContainers(nextContainerAssignments);
  deps.removeHostnameContexts(hostname);
  runPopupMutationFinalize({
    deps,
    hostname,
    activeTab,
    refreshCachedConfig: true,
    refreshInjectionState: "always",
    errorMessage: "Failed to finalize popup container mutation.",
    trigger: "popup-rule-mutation",
  });
};
