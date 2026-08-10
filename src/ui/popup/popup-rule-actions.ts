import type { PopupAppState } from "./popup-controller-state";
import { logPopupError } from "./popup-controller-state";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type {
  ApplySuggestionResponse,
  CleanupDomainResponse,
  DeleteRuleResponse,
  FxPermissionResponse,
  PopupSiteSuggestion,
  PopupState,
  SetPanicModeResponse,
  ToggleRuleResponse,
  UpdateRuleResponse,
  WorkerInjectionMode,
} from "@/shared/types";
import { t } from "@/ui/i18n";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

type PopupActionDeps = {
  state: PopupAppState;
  loadPopupState: () => Promise<void>;
  getTargetTabId: () => Promise<number | undefined>;
  closeSheet: () => void;
  syncSheetDraft: (nextState: PopupState) => void;
};

type FirefoxPermissionsApi = {
  request?: (permissions: {
    permissions?: string[];
    origins?: string[];
  }) => Promise<boolean>;
};

const requestUserScripts = async (): Promise<boolean | null> => {
  const permissionsApi = (
    globalThis as typeof globalThis & {
      browser?: { permissions?: FirefoxPermissionsApi };
    }
  ).browser?.permissions;
  if (!permissionsApi?.request) return null;
  return permissionsApi.request({ permissions: ["userScripts"] });
};

export const createCleanupActions = (deps: PopupActionDeps) => {
  const handleNewIdentity = async () => {
    const hostname = deps.state.popupState?.currentTab.hostname;
    if (!hostname || deps.state.mutationState.status === "pending") return;
    deps.state.dispatchMutation({ type: "start", action: "cleanup" });
    try {
      const targetTabId = await deps.getTargetTabId();
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.cleanupDomainState,
        hostname,
        ...(targetTabId !== undefined ? { tabId: targetTabId } : {}),
      })) as CleanupDomainResponse;
      deps.state.setCleanupPlan(response.plan);
      deps.state.setCleanupResult(response.result);
      deps.state.dispatchMutation({ type: "succeed", action: "cleanup" });
      deps.state.setSheetView("cleanup-result");
      await deps.loadPopupState();
    } catch (error) {
      logPopupError("Could not create a new identity.", error);
      deps.state.dispatchMutation({
        type: "fail",
        action: "cleanup",
        message: t.popup.mutationFailed,
      });
    }
  };
  return { handleNewIdentity };
};

export const createSaveActions = (deps: PopupActionDeps) => {
  const handleSave = async (replaceExisting = false) => {
    const state = deps.state;
    if (state.mutationState.status === "pending") return;
    state.dispatchMutation({ type: "start", action: "save-rule" });
    try {
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.updateCurrentRule,
        ...(state.selectedLocationId ? { locationId: state.selectedLocationId } : {}),
        patternMode: state.selectedRuleMode,
        replaceExisting,
        ...(state.creatingExactOverride ? { createExactOverride: true } : {}),
        blockServiceWorkerRegistration: state.serviceWorkerOverride === true,
        serviceWorkerOverride: state.serviceWorkerOverride ?? null,
        workerHandlingOverride: state.workerOverride ?? null,
        ...(state.isRegionalPresetChanged
          ? { regionalPresetEnabled: state.isRegionalPresetOn }
          : {}),
        relaxCspForWorkers: state.shouldRelaxWorkerCsp,
        hostname: state.popupState?.currentTab.hostname ?? undefined,
        tabId: await deps.getTargetTabId(),
      })) as UpdateRuleResponse;
      if (!response.ok && response.conflictPattern) {
        state.setConflictPattern(response.conflictPattern);
        state.dispatchMutation({ type: "reset" });
        state.setSheetView("rule-conflict-confirm");
        return;
      }
      if (!response.ok) throw new Error(response.error);
      state.setPopupState(response.state);
      deps.syncSheetDraft(response.state);
      state.dispatchMutation({ type: "succeed", action: "save-rule" });
      deps.closeSheet();
    } catch (error) {
      logPopupError("Could not save the Domain Rule.", error);
      state.dispatchMutation({
        type: "fail",
        action: "save-rule",
        message: t.popup.mutationFailed,
      });
    }
  };

  const handleRuleDelete = async () => {
    const state = deps.state;
    if (
      !state.popupState?.currentRule.pattern ||
      state.mutationState.status === "pending"
    ) {
      return;
    }
    state.dispatchMutation({ type: "start", action: "delete-rule" });
    try {
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.deleteCurrentRule,
        hostname: state.popupState.currentTab.hostname ?? undefined,
        tabId: await deps.getTargetTabId(),
      })) as DeleteRuleResponse;
      if (!response.ok) throw new Error(response.error);
      state.dispatchMutation({ type: "succeed", action: "delete-rule" });
      await deps.loadPopupState();
      deps.closeSheet();
    } catch (error) {
      logPopupError("Could not delete the Domain Rule.", error);
      state.dispatchMutation({
        type: "fail",
        action: "delete-rule",
        message: t.popup.mutationFailed,
      });
    }
  };
  return { handleSave, handleRuleDelete };
};

export const createToggleActions = (deps: PopupActionDeps) => {
  const setMatchedSiteEnabled = async (enabled: boolean) => {
    const state = deps.state;
    const pattern = state.popupState?.currentTab.matchedTrustedSitePattern;
    if (!pattern || state.mutationState.status === "pending") return;
    const action = enabled ? "enable-trust" : "disable-trust";
    state.dispatchMutation({ type: "start", action });
    try {
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.setTrustedSiteEnabled,
        pattern,
        enabled,
        tabId: await deps.getTargetTabId(),
      })) as ToggleRuleResponse;
      if (!response.ok) throw new Error(response.error);
      state.setPopupState(response.state);
      state.dispatchMutation({ type: "succeed", action });
    } catch (error) {
      logPopupError("Could not change the Trusted Site state.", error);
      state.dispatchMutation({ type: "fail", action, message: t.popup.mutationFailed });
    }
  };

  const handleToggle = async () => {
    const state = deps.state;
    const trustedSitePattern =
      state.popupState?.currentTab.winningSource === "trusted-site"
        ? state.popupState.currentTab.matchedTrustedSitePattern
        : null;
    if (trustedSitePattern) return setMatchedSiteEnabled(false);
    if (
      !state.popupState?.currentRule.canToggle ||
      state.popupState.currentRule.enabled === null ||
      state.popupState.panicMode ||
      state.mutationState.status === "pending"
    ) {
      return;
    }
    const nextEnabled = !state.popupState.currentRule.enabled;
    const previousState = state.popupState;
    state.dispatchMutation({ type: "start", action: "toggle-rule" });
    if (state.popupState.currentRule.pattern) {
      state.setPopupState({
        ...state.popupState,
        currentRule: { ...state.popupState.currentRule, enabled: nextEnabled },
      });
    }
    try {
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.toggleCurrentRule,
        enabled: nextEnabled,
        hostname: state.popupState.currentTab.hostname ?? undefined,
        tabId: await deps.getTargetTabId(),
      })) as ToggleRuleResponse;
      if (!response.ok) throw new Error(response.error);
      state.setPopupState(response.state);
      state.dispatchMutation({ type: "succeed", action: "toggle-rule" });
    } catch (error) {
      state.setPopupState(previousState);
      logPopupError("Could not toggle the active rule.", error);
      state.dispatchMutation({
        type: "fail",
        action: "toggle-rule",
        message: t.popup.mutationFailed,
      });
    }
  };
  return { setMatchedSiteEnabled, handleToggle };
};

export const createSuggestionActions = (deps: PopupActionDeps) => {
  const handleApplySuggestion = async (
    kind: PopupSiteSuggestion["kind"],
    sharedWorkerHandlingMode?: WorkerInjectionMode,
  ) => {
    const state = deps.state;
    if (state.mutationState.status === "pending") return;
    state.dispatchMutation({ type: "start", action: "accept-suggestion" });
    try {
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.acceptPopupSuggestion,
        kind,
        ...(sharedWorkerHandlingMode ? { sharedWorkerHandlingMode } : {}),
        hostname: state.popupState?.currentTab.hostname ?? undefined,
        tabId: await deps.getTargetTabId(),
      })) as ApplySuggestionResponse;
      if (!response.ok) throw new Error(response.error);
      state.setPopupState(response.state);
      state.dispatchMutation({ type: "succeed", action: "accept-suggestion" });
      deps.closeSheet();
    } catch (error) {
      logPopupError("Could not apply the popup suggestion.", error);
      state.dispatchMutation({
        type: "fail",
        action: "accept-suggestion",
        message: t.popup.mutationFailed,
      });
    }
  };
  const handleDismissSuggestion = async (kind: PopupSiteSuggestion["kind"]) => {
    const state = deps.state;
    if (state.mutationState.status === "pending") return;
    state.dispatchMutation({ type: "start", action: "dismiss-suggestion" });
    try {
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.dismissPopupSuggestion,
        kind,
        hostname: state.popupState?.currentTab.hostname ?? undefined,
        tabId: await deps.getTargetTabId(),
      })) as ApplySuggestionResponse;
      if (!response.ok) throw new Error(response.error);
      state.setPopupState(response.state);
      state.dispatchMutation({ type: "succeed", action: "dismiss-suggestion" });
      deps.closeSheet();
    } catch (error) {
      logPopupError("Could not dismiss the popup suggestion.", error);
      state.dispatchMutation({
        type: "fail",
        action: "dismiss-suggestion",
        message: t.popup.mutationFailed,
      });
    }
  };
  return { handleApplySuggestion, handleDismissSuggestion };
};

export const createProductActions = (deps: PopupActionDeps) => {
  const handleEnableExtension = async () => {
    const state = deps.state;
    if (state.mutationState.status === "pending") return;
    state.dispatchMutation({ type: "start", action: "enable-extension" });
    try {
      (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.setPanicMode,
        enabled: false,
      } as const)) as SetPanicModeResponse;
      await deps.loadPopupState();
      state.dispatchMutation({ type: "succeed", action: "enable-extension" });
    } catch (error) {
      logPopupError("Could not turn the product on.", error);
      state.dispatchMutation({
        type: "fail",
        action: "enable-extension",
        message: t.popup.enableExtensionFailed,
      });
    }
  };
  const trustCurrentSite = async () => {
    const state = deps.state;
    const hostname = state.popupState?.currentTab.hostname?.trim().toLowerCase();
    if (!hostname || state.mutationState.status === "pending") return;
    state.dispatchMutation({ type: "start", action: "trust-site" });
    try {
      await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.upsertTrustedSite,
        hostname,
        tabId: await deps.getTargetTabId(),
      });
      await deps.loadPopupState();
      state.dispatchMutation({ type: "succeed", action: "trust-site" });
    } catch (error) {
      logPopupError("Could not add the current site to Trusted Sites.", error);
      state.dispatchMutation({
        type: "fail",
        action: "trust-site",
        message: t.popup.trustSiteFailed,
      });
    }
  };
  const enableFirefoxInline = async () => {
    const state = deps.state;
    if (state.mutationState.status === "pending") return;
    state.dispatchMutation({ type: "start", action: "firefox-permission" });
    try {
      const grantedInPopup = await requestUserScripts();
      if (grantedInPopup === false) {
        state.dispatchMutation({ type: "reset" });
        return;
      }
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.requestFirefoxUserscriptsPermission,
        tabId: await deps.getTargetTabId(),
      })) as FxPermissionResponse;
      if (!response.ok) throw new Error(response.error);
      if (!response.granted) {
        state.dispatchMutation({ type: "reset" });
        return;
      }
      await deps.loadPopupState();
      state.dispatchMutation({ type: "succeed", action: "firefox-permission" });
    } catch (error) {
      logPopupError("Could not grant the Firefox userScripts permission.", error);
      state.dispatchMutation({
        type: "fail",
        action: "firefox-permission",
        message: t.popup.firefoxPermissionFailed,
      });
    }
  };
  return { handleEnableExtension, trustCurrentSite, enableFirefoxInline };
};
