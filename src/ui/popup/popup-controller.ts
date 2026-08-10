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
