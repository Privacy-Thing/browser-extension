import { createAccessHandlers } from "@/background/popup-command-access";
import type { PopupCommandDeps } from "@/background/popup-command-types";
import { createCompatHandlers } from "@/background/popup-compat-command";
import { createRuleSaveHandlers } from "@/background/popup-rule-save-command";
import { createRuleToggleHandlers } from "@/background/popup-rule-toggle-command";
import { createPopupStateHandler } from "@/background/popup-state-command";

export const createPopupHandlers = (deps: PopupCommandDeps) => {
  const getPopupState = createPopupStateHandler(deps);
  const { requestUserScriptsAccess } = createAccessHandlers(deps);
  const { assignDomainLocation, updateCurrentRule } = createRuleSaveHandlers(
    deps,
    getPopupState,
  );
  const { applyPopupSuggestion, applyPopupPolicyAction, dismissPopupSuggestion } =
    createCompatHandlers(deps, getPopupState);
  const { toggleCurrentRule, deleteCurrentRule } = createRuleToggleHandlers(
    deps,
    getPopupState,
  );
  return {
    getPopupState,
    requestUserScriptsAccess,
    assignDomainLocation,
    updateCurrentRule,
    applyPopupSuggestion,
    applyPopupPolicyAction,
    dismissPopupSuggestion,
    toggleCurrentRule,
    deleteCurrentRule,
  };
};
