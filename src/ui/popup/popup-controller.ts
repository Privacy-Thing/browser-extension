import { useCallback } from "react";

import {
  useBrandSheetPose,
  usePopupAppState,
  usePopupAutoOpen,
  usePopupRefresh,
  usePopupSizing,
  useSheetTopOffset,
} from "./popup-controller-state";
import {
  createEditorActions,
  createNewRuleActions,
  createNoticeActions,
  createRuleActionHandlers,
  createSheetActions,
  openXRay,
} from "./popup-navigation";
import {
  createCleanupActions,
  createProductActions,
  createSaveActions,
  createSuggestionActions,
  createToggleActions,
} from "./popup-rule-actions";
import { derivePopupViewModel } from "./popup-view-model";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type { ToggleRuleResponse } from "@/shared/types";

export const usePopupController = () => {
  const state = usePopupAppState();
  const sheets = createSheetActions(state);
  useBrandSheetPose(state);
  useSheetTopOffset();
  const refresh = usePopupRefresh(state, sheets.syncSheetDraft);
  usePopupAutoOpen(state);
  usePopupSizing(state);

  const deps = {
    state,
    ...refresh,
    closeSheet: sheets.closeSheet,
    syncSheetDraft: sheets.syncSheetDraft,
  };
  const setPause = async (duration: "ten-minutes" | "session" | "resume") => {
    state.dispatchMutation({ type: "start", action: "host-pause" });
    try {
      const response = (await chrome.runtime.sendMessage({
        type: EXTENSION_COMMAND_TYPES.setHostProtectionPause,
        duration,
        tabId: await refresh.getTargetTabId(),
      })) as ToggleRuleResponse;
      if (!response.ok) throw new Error(response.error);
      state.setPopupState(response.state);
      state.dispatchMutation({ type: "succeed", action: "host-pause" });
    } catch (error) {
      state.dispatchMutation({
        type: "fail",
        action: "host-pause",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const refreshExpired = useCallback(() => {
    void state.loadPopupStateRef.current();
  }, [state.loadPopupStateRef]);
  const hostPause = { setPause, refreshExpired };
  const cleanup = createCleanupActions(deps);
  const saves = createSaveActions(deps);
  const toggles = createToggleActions(deps);
  const suggestions = createSuggestionActions(deps);
  const products = createProductActions(deps);
  const navDeps = { state, sheets, ...refresh };
  const editors = createEditorActions(navDeps);
  const newRules = createNewRuleActions(navDeps);
  const notices = createNoticeActions({
    deps: { state, ...refresh },
    sheets,
    handleApplySuggestion: suggestions.handleApplySuggestion,
  });
  const ruleActionHandlers = createRuleActionHandlers({
    editors,
    newRules,
    products,
    toggles,
  });
  const selectedNotification =
    state.popupState?.notifications.find(
      (notification) => notification.id === state.selectedNotificationId,
    ) ?? null;

  return {
    state,
    sheets,
    refresh,
    hostPause,
    cleanup,
    saves,
    toggles,
    suggestions,
    products,
    editors,
    newRules,
    notices,
    ruleActionHandlers,
    selectedNotification,
    viewModel: derivePopupViewModel(state.popupState),
    openXRay,
  };
};

export type PopupController = ReturnType<typeof usePopupController>;
