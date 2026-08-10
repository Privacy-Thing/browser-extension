import type { PopupAppState, PopupSheetView } from "./popup-controller-state";
import { logPopupError } from "./popup-controller-state";
import { shouldCloseSheet } from "./popup-sheet-toggle";
import {
  getInitialLocationId,
  getInitialRuleMode,
  getTargetPattern,
  type PopupActionIntent,
} from "./popup-view-model";

import { fireAndForget } from "@/shared/async";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import {
  isPopupPolicyNoticeKind,
  isSuggestionNotice,
} from "@/shared/popup-notification-kinds";
import type {
  ApplySuggestionResponse,
  CleanupLinksResponse,
  PopupNotification,
  PopupSiteSuggestion,
  PopupState,
  WorkerInjectionMode,
} from "@/shared/types";
import { t } from "@/ui/i18n";
import {
  getContainerModalAnchor,
  getFallbackModalAnchor,
  getRuleModalAnchor,
  getTrustedSiteAnchor,
  PAGE_ANCHORS,
} from "@/ui/options/navigation";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

type CoreDeps = {
  state: PopupAppState;
  loadPopupState: () => Promise<void>;
  getTargetTabId: () => Promise<number | undefined>;
};

const openOptionsAnchor = async (anchorId: string): Promise<void> => {
  await chrome.tabs.create({
    url: chrome.runtime.getURL(`src/ui/options/index.html#${anchorId}`),
  });
};

export const getInheritedProfileLabel = (
  popupState: PopupState | null,
): string | undefined => {
  if (!popupState?.currentTab.locationId) return undefined;
  switch (popupState.effectiveSummary.resolutionContext.source) {
    case "default-rule":
      return t.popup.inheritedDefaultRuleProfileLabel;
    case "container":
      return t.popup.inheritedContainerProfileLabel;
    case "site-rule":
      return t.popup.inheritedDomainRuleProfileLabel;
    case "trusted-site":
    case "none":
      return undefined;
  }
};

export const createSheetActions = (state: PopupAppState) => {
  const closeSheet = () => {
    state.setRuleSheetOpen(false);
    state.setActiveSheetTrigger(null);
    state.setSheetView("rule-form");
    state.setNotificationId(null);
    state.dispatchMutation({ type: "reset" });
  };
  const toggleSheet = (
    trigger: string,
    view: PopupSheetView,
    prepare?: () => void,
  ): boolean => {
    if (
      shouldCloseSheet({
        activeTrigger: state.activeSheetTrigger,
        nextTrigger: trigger,
        open: state.isRuleSheetOpen,
      })
    ) {
      closeSheet();
      return false;
    }
    prepare?.();
    state.setActiveSheetTrigger(trigger);
    state.setSheetView(view);
    state.setRuleSheetOpen(true);
    return true;
  };
  const syncSheetDraft = (nextState: PopupState) => {
    state.setAllowInherited(false);
    state.setCreatingExactOverride(false);
    state.setSelectedRuleMode(getInitialRuleMode(nextState));
    state.setSelectedLocationId(getInitialLocationId(nextState));
    state.setRegionalPresetOn(nextState.currentRule.regionalPresetEnabled);
    state.setRegionalPresetChanged(false);
    state.setServiceWorkerOverride(nextState.currentRule.serviceWorkerOverride);
    state.setWorkerOverride(nextState.currentRule.workerHandlingOverride);
    state.setRelaxWorkerCsp(nextState.currentRule.relaxCspForWorkers);
    state.setSheetTargetPattern(getTargetPattern(nextState));
    state.setSheetDraftHostname(nextState.currentTab.hostname);
  };
  const getRuleSheetPatternLabel = () => {
    if (!state.sheetTargetPattern) return t.popup.sheetTitle;
    if (
      state.popupState?.currentRule.pattern &&
      state.popupState.currentRule.type === state.selectedRuleMode
    ) {
      return state.popupState.currentRule.pattern;
    }
    const hostname = state.popupState?.currentTab.hostname;
    if (!hostname) return state.sheetTargetPattern;
    return state.selectedRuleMode === "suffix" ? `*${hostname}` : hostname;
  };
  return { closeSheet, toggleSheet, syncSheetDraft, getRuleSheetPatternLabel };
};

type SheetActions = ReturnType<typeof createSheetActions>;

export const createEditorActions = (deps: CoreDeps & { sheets: SheetActions }) => {
  const state = deps.state;
  const openContainerEditor = () => {
    const container = state.popupState?.currentTab.activeContainer;
    if (container) {
      fireAndForget(
        openOptionsAnchor(getContainerModalAnchor(container.cookieStoreId)),
      );
    }
  };
  const openRuleEditor = () => {
    if (!state.popupState?.currentRule.pattern) return;
    deps.sheets.toggleSheet("rule-action:edit-domain-rule", "rule-form", () => {
      deps.sheets.syncSheetDraft(state.popupState as PopupState);
    });
  };
  const openFullRuleSettings = () => {
    const pattern = state.popupState?.currentRule.pattern;
    fireAndForget(
      openOptionsAnchor(
        pattern && !state.creatingExactOverride
          ? getRuleModalAnchor(pattern)
          : PAGE_ANCHORS.rules,
      ),
    );
  };
  const openGlobalFallbackEditor = () => {
    fireAndForget(openOptionsAnchor(getFallbackModalAnchor()));
  };
  const openTrustedSiteSettings = () => {
    const pattern =
      state.popupState?.currentTab.matchedTrustedSitePattern ??
      state.popupState?.currentTab.hostname;
    if (pattern) fireAndForget(openOptionsAnchor(getTrustedSiteAnchor(pattern)));
  };
  const openDomainRuleSheet = () => {
    if (!state.popupState) return;
    deps.sheets.toggleSheet("context-action:domain-rule", "rule-form", () => {
      deps.sheets.syncSheetDraft(state.popupState as PopupState);
    });
  };
  return {
    openContainerEditor,
    openRuleEditor,
    openFullRuleSettings,
    openGlobalFallbackEditor,
    openTrustedSiteSettings,
    openDomainRuleSheet,
  };
};

export const createNewRuleActions = (deps: CoreDeps & { sheets: SheetActions }) => {
  const state = deps.state;
  const createExactDomainRule = () => {
    if (!state.popupState?.currentTab.hostname) return;
    deps.sheets.toggleSheet("context-action:exact-domain-rule", "rule-form", () => {
      deps.sheets.syncSheetDraft(state.popupState as PopupState);
      state.setCreatingExactOverride(true);
      const inherit = getInheritedProfileLabel(state.popupState) !== undefined;
      state.setAllowInherited(inherit);
      if (inherit) state.setSelectedLocationId(null);
      state.setSelectedRuleMode("suffix");
      state.setSheetTargetPattern((state.popupState as PopupState).currentTab.hostname);
      state.setServiceWorkerOverride(undefined);
      state.setWorkerOverride(undefined);
      state.setRelaxWorkerCsp(false);
    });
  };
  const openNewIdentitySheet = () => {
    const hostname = state.popupState?.currentTab.hostname;
    if (!hostname) return;
    const opened = deps.sheets.toggleSheet(
      "footer:new-identity",
      "cleanup-confirm",
      () => {
        state.setCleanupPlan(null);
        state.setCleanupResult(null);
      },
    );
    if (!opened) return;
    fireAndForget(
      (async () => {
        try {
          const response = (await sendMessageOrThrow({
            type: EXTENSION_COMMAND_TYPES.getCleanupAssociations,
            hostname,
            tabId: await deps.getTargetTabId(),
          })) as CleanupLinksResponse;
          state.setCleanupPlan(response.plan);
        } catch (error) {
          logPopupError("Could not load the new identity cleanup plan.", error);
          state.dispatchMutation({
            type: "fail",
            action: "cleanup-plan",
            message: t.popup.mutationFailed,
          });
        }
      })(),
    );
  };
  const openProtectionDetails = () => {
    deps.sheets.toggleSheet("rule-card:protection-details", "protection-details");
  };
  return { createExactDomainRule, openNewIdentitySheet, openProtectionDetails };
};

export const createNoticeActions = ({
  deps,
  sheets,
  handleApplySuggestion,
}: {
  deps: CoreDeps;
  sheets: SheetActions;
  handleApplySuggestion: (
    kind: PopupSiteSuggestion["kind"],
    mode?: WorkerInjectionMode,
  ) => Promise<void>;
}) => {
  const state = deps.state;
  const openNotificationList = () => {
    sheets.toggleSheet("header:notifications", "notification-list", () => {
      state.setNotificationId(null);
    });
  };
  const openNotificationDetail = (notification: PopupNotification) => {
    state.setNotificationId(notification.id);
    state.setSheetView("notification-detail");
    state.setRuleSheetOpen(true);
    fireAndForget(
      sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.markNoticeRead,
        id: notification.id,
      }).then(() => deps.loadPopupState()),
    );
  };
  const dismissNotification = async (notification: PopupNotification) => {
    await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.resolvePopupNotification,
      id: notification.id,
    });
    await deps.loadPopupState();
    state.setNotificationId(null);
    state.setSheetView("notification-list");
  };
  const activateNotification = async (
    notification: PopupNotification,
    sharedWorkerHandlingMode?: WorkerInjectionMode,
  ) => {
    if (notification.kind === "significant-update") {
      if (!notification.actionTarget) return;
      await chrome.tabs.create({ url: notification.actionTarget });
      await dismissNotification(notification);
      return;
    }
    if (isSuggestionNotice(notification.kind)) {
      await handleApplySuggestion(notification.kind, sharedWorkerHandlingMode);
      return;
    }
    if (!isPopupPolicyNoticeKind(notification.kind)) return;
    if (state.mutationState.status === "pending") return;
    state.dispatchMutation({ type: "start", action: "accept-suggestion" });
    try {
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.applyPopupPolicyAction,
        kind: notification.kind,
        ...(sharedWorkerHandlingMode ? { sharedWorkerHandlingMode } : {}),
        hostname: state.popupState?.currentTab.hostname ?? undefined,
        tabId: await deps.getTargetTabId(),
      })) as ApplySuggestionResponse;
      if (!response.ok) throw new Error(response.error);
      state.setPopupState(response.state);
      state.dispatchMutation({ type: "succeed", action: "accept-suggestion" });
      sheets.closeSheet();
    } catch (error) {
      logPopupError("Could not apply the notification action.", error);
      state.dispatchMutation({
        type: "fail",
        action: "accept-suggestion",
        message: t.popup.mutationFailed,
      });
    }
  };
  return {
    openNotificationList,
    openNotificationDetail,
    dismissNotification,
    activateNotification,
  };
};

export const openXRay = (): void => {
  if (BUILD_BROWSER_TARGET === "firefox") {
    (
      globalThis as typeof globalThis & {
        browser?: { sidebarAction?: { open?: () => void } };
      }
    ).browser?.sidebarAction?.open?.();
    return;
  }
  fireAndForget(
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id === undefined) return;
      return (
        (
          chrome as typeof chrome & {
            sidePanel?: { open?: (opts: { tabId: number }) => Promise<void> };
          }
        ).sidePanel?.open?.({ tabId: tab.id }) ?? Promise.resolve()
      );
    }),
  );
};

export const createRuleActionHandlers = ({
  editors,
  newRules,
  products,
  toggles,
}: {
  editors: ReturnType<typeof createEditorActions>;
  newRules: ReturnType<typeof createNewRuleActions>;
  products: {
    trustCurrentSite: () => Promise<void>;
    enableFirefoxInline: () => Promise<void>;
    handleEnableExtension: () => Promise<void>;
  };
  toggles: { setMatchedSiteEnabled: (enabled: boolean) => Promise<void> };
}): Record<PopupActionIntent, () => void | Promise<void>> => ({
  "open-container-options": editors.openContainerEditor,
  "open-container": editors.openContainerEditor,
  "open-global-fallback-options": editors.openGlobalFallbackEditor,
  "open-domain-rule": editors.openDomainRuleSheet,
  "create-exact-domain-rule": newRules.createExactDomainRule,
  "add-to-trusted-sites": products.trustCurrentSite,
  "enable-matched-trusted-site": () => toggles.setMatchedSiteEnabled(true),
  "open-trusted-site": editors.openTrustedSiteSettings,
  "request-firefox-userscripts": products.enableFirefoxInline,
  "enable-extension": products.handleEnableExtension,
  "open-rule-options": editors.openRuleEditor,
  none: () => undefined,
});
