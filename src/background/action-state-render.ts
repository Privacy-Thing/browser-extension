import type { ActionContext } from "@/background/action-state-context";
import type { logExtensionEvent } from "@/background/logger";
import { showInactiveRule } from "@/background/popup-state";
import { markNoticePulseShown as markNoticePulseShownStore } from "@/background/storage/popup-notifications";
import { getBadgeQueryCount } from "@/background/surface-access-tracker";
import { runToolbarAttentionPulse } from "@/background/toolbar-attention-pulse";
import {
  NOTICE_BADGE_COLORS,
  PROTECTION_BADGE_COLORS,
} from "@/background/toolbar-notification-state";
import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { LogCategory } from "@/shared/types";

type ActionIconState =
  | "neutral"
  | "unsupported"
  | "active"
  | "attention-1"
  | "attention-2"
  | "attention"
  | "off";
type ActionIconPaths = Record<ActionIconState, Record<number, string>>;

export type ActionRenderDeps = {
  actionIconPaths: ActionIconPaths;
  getDateBadgeSetting: () => boolean | null;
  getBadgeCountSetting: () => boolean | null;
  logExtensionEvent: typeof logExtensionEvent;
  toExtensionIconPaths: (paths: Record<number, string>) => Record<number, string>;
};

type ActionOps = {
  setIcon: (state: ActionIconState, reason: string) => Promise<void>;
  clearBadge: () => Promise<void>;
  logBadge: (reason: string) => Promise<void>;
};

const createActionOps = (deps: ActionRenderDeps, context: ActionContext): ActionOps => {
  const { tabId, debugMode, hostname } = context;
  const setIcon = async (iconState: ActionIconState, reason: string): Promise<void> => {
    try {
      await chrome.action.setIcon({
        tabId,
        path: deps.toExtensionIconPaths(deps.actionIconPaths[iconState]),
      });
    } catch (error) {
      deps.logExtensionEvent({
        enabled: debugMode,
        category: LogCategory.System,
        event: "popup.action-icon-error",
        payload: {
          tabId,
          hostname: hostname ?? "unknown",
          details: {
            reason,
            iconState,
            path: deps.actionIconPaths[iconState],
            error: error instanceof Error ? error.message : String(error),
          },
        },
      });
      throw error;
    }
  };
  const clearBadge = async (): Promise<void> => {
    // Chrome uses null to remove the tab override, but @types/chrome omits it.
    await chrome.action.setBadgeText({ tabId, text: null as unknown as string });
  };
  const logBadge = async (reason: string): Promise<void> => {
    const [tabBadgeText, globalBadgeText, userSettings] = await Promise.all([
      chrome.action.getBadgeText({ tabId }).catch(() => null),
      chrome.action.getBadgeText({}).catch(() => null),
      chrome.action.getUserSettings().catch(() => null),
    ]);
    deps.logExtensionEvent({
      enabled: debugMode,
      category: LogCategory.System,
      event: "popup.action-badge-state",
      payload: {
        tabId,
        hostname: hostname ?? "unknown",
        details: {
          reason,
          supported: context.supported,
          displayedRule: context.displayedRule?.pattern ?? null,
          displayedRuleEnabled: context.displayedRule?.enabled ?? null,
          matchedRule: context.matchedRule?.pattern ?? null,
          containerAssignment: context.containerAssignment?.locationId ?? null,
          winningSource: context.winningSource,
          effectiveSnapshot: Boolean(context.effectiveSnapshot),
          hasActionableSuggestion: context.hasActionableSuggestion,
          hasSuggestionWarning: context.filteredSuggestions.hasWarning,
          activeUrl: context.activeUrl ?? null,
          tabBadgeText,
          globalBadgeText,
          isOnToolbar: userSettings?.isOnToolbar ?? null,
        },
      },
    });
  };
  return { setIcon, clearBadge, logBadge };
};

const renderPanic = async (
  deps: ActionRenderDeps,
  context: ActionContext,
  ops: ActionOps,
): Promise<boolean> => {
  if (!context.controlState.panicMode) return false;
  await ops.setIcon("off", "panic-off");
  await ops.clearBadge();
  await chrome.action.setTitle({
    tabId: context.tabId,
    title: `${BRAND_DISPLAY_NAME} is turned off`,
  });
  await ops.logBadge("panic-off");
  deps.logExtensionEvent({
    enabled: context.debugMode,
    category: LogCategory.System,
    event: "popup.action-state-off",
    payload: { tabId: context.tabId },
  });
  return true;
};

const renderUnsupported = async (
  deps: ActionRenderDeps,
  context: ActionContext,
  ops: ActionOps,
): Promise<boolean> => {
  if (context.supported) return false;
  await ops.setIcon("unsupported", "unsupported-tab");
  await ops.clearBadge();
  await chrome.action.setTitle({
    tabId: context.tabId,
    title: BRAND_DISPLAY_NAME,
  });
  await ops.logBadge("unsupported-tab");
  deps.logExtensionEvent({
    enabled: context.debugMode,
    category: LogCategory.System,
    event: "popup.action-state-neutral",
    payload: { tabId: context.tabId, hostname: context.hostname ?? "unknown" },
  });
  return true;
};

const renderInactive = async (
  deps: ActionRenderDeps,
  context: ActionContext,
  ops: ActionOps,
): Promise<boolean> => {
  if (!context.popupResolution || !showInactiveRule(context.popupResolution)) {
    return false;
  }
  const inactiveRule = context.popupResolution.displayedRule;
  if (!inactiveRule) {
    throw new Error("Inactive displayed rule state requires a displayed rule.");
  }
  await chrome.action.setBadgeText({ tabId: context.tabId, text: "OFF" });
  await chrome.action.setBadgeBackgroundColor({
    tabId: context.tabId,
    color: "#f59e0b",
  });
  await chrome.action.setBadgeTextColor({
    tabId: context.tabId,
    color: "#111827",
  });
  await chrome.action.setTitle({
    tabId: context.tabId,
    title: `${BRAND_DISPLAY_NAME} inactive: ${inactiveRule.pattern}`,
  });
  await ops.logBadge("disabled-rule");
  deps.logExtensionEvent({
    enabled: context.debugMode,
    category: LogCategory.System,
    event: "popup.action-state-inactive",
    payload: {
      tabId: context.tabId,
      hostname: context.hostname ?? "unknown",
      details: { pattern: inactiveRule.pattern },
    },
  });
  return true;
};

const renderTrusted = async (
  deps: ActionRenderDeps,
  context: ActionContext,
  ops: ActionOps,
): Promise<boolean> => {
  if (context.winningSource !== "trusted-site") return false;
  await chrome.action.setBadgeText({ tabId: context.tabId, text: "" });
  await chrome.action.setBadgeBackgroundColor({
    tabId: context.tabId,
    color: "#1f883d",
  });
  await chrome.action.setBadgeTextColor({
    tabId: context.tabId,
    color: "#ffffff",
  });
  await chrome.action.setTitle({
    tabId: context.tabId,
    title: `${BRAND_DISPLAY_NAME} off: trusted site`,
  });
  await ops.logBadge("trusted-site");
  deps.logExtensionEvent({
    enabled: context.debugMode,
    category: LogCategory.System,
    event: "popup.action-state-trusted-site",
    payload: {
      tabId: context.tabId,
      hostname: context.hostname ?? "unknown",
      details: { winningSource: context.winningSource },
    },
  });
  return true;
};

const renderProtection = async (
  context: ActionContext,
  ops: ActionOps,
): Promise<boolean> => {
  const failure = context.protectionFailure;
  if (!failure) return false;
  const badgeColors = PROTECTION_BADGE_COLORS[failure];
  await chrome.action.setBadgeText({ tabId: context.tabId, text: "!" });
  await chrome.action.setBadgeBackgroundColor({
    tabId: context.tabId,
    color: badgeColors.background,
  });
  await chrome.action.setBadgeTextColor({
    tabId: context.tabId,
    color: badgeColors.text,
  });
  await ops.setIcon("active", `protection-${failure}`);
  await chrome.action.setTitle({
    tabId: context.tabId,
    title:
      failure === "unrecoverable"
        ? `${BRAND_DISPLAY_NAME} protection is compromised`
        : `${BRAND_DISPLAY_NAME} protection is degraded`,
  });
  await ops.logBadge(`protection-${failure}`);
  return true;
};

const renderNotice = async (
  context: ActionContext,
  ops: ActionOps,
): Promise<boolean> => {
  const notification = context.priorityNotification;
  if (!notification) return false;
  const needsAction = notification.severity === "needs-action";
  const badgeColors = NOTICE_BADGE_COLORS[needsAction ? "warning" : "info"];
  await chrome.action.setBadgeText({
    tabId: context.tabId,
    text: needsAction ? "!" : "NEW",
  });
  await chrome.action.setBadgeBackgroundColor({
    tabId: context.tabId,
    color: badgeColors.background,
  });
  await chrome.action.setBadgeTextColor({
    tabId: context.tabId,
    color: badgeColors.text,
  });
  await chrome.action.setTitle({
    tabId: context.tabId,
    title: needsAction
      ? `${BRAND_DISPLAY_NAME} needs attention`
      : `${BRAND_DISPLAY_NAME} has an unread update`,
  });
  await runToolbarAttentionPulse({
    notification,
    tabActive: context.tab?.active === true,
    reducedMotion: !context.attentionMotionEnabled,
    setFrame: (frame) => ops.setIcon(frame, `notification-${frame}`),
    markShown: async () => {
      await markNoticePulseShownStore(notification.id);
    },
  });
  await ops.logBadge(needsAction ? "notification-needs-action" : "notification-update");
  return true;
};

const renderNoSnapshot = async (
  deps: ActionRenderDeps,
  context: ActionContext,
  ops: ActionOps,
): Promise<boolean> => {
  if (context.effectiveSnapshot) return false;
  await ops.clearBadge();
  await chrome.action.setTitle({
    tabId: context.tabId,
    title: BRAND_DISPLAY_NAME,
  });
  await ops.logBadge("no-active-profile");
  deps.logExtensionEvent({
    enabled: context.debugMode,
    category: LogCategory.System,
    event: "popup.action-state-neutral",
    payload: { tabId: context.tabId, hostname: context.hostname ?? "unknown" },
  });
  return true;
};

const getActiveTitle = (context: ActionContext): string => {
  const suffix = context.hasActionableSuggestion
    ? " (compatibility suggestion available)"
    : "";
  if (context.winningSource === "container") {
    return `${BRAND_DISPLAY_NAME} active: Firefox container assignment${suffix}`;
  }
  if (context.winningSource === "fallback") {
    return `${BRAND_DISPLAY_NAME} active: default rule${suffix}`;
  }
  return `${BRAND_DISPLAY_NAME} active: ${context.matchedRule?.pattern ?? "site rule"}${suffix}`;
};

const getActiveReason = (context: ActionContext): string => {
  if (context.hasActionableSuggestion) return "active-with-suggestion";
  if (context.winningSource === "container") return "container-assignment";
  if (context.winningSource === "fallback") return "global-fallback";
  return "matched-rule";
};

const formatQueryCount = (count: number): string =>
  count < 1000 ? String(count) : `>${Math.floor(count / 1000)}k`;

const renderActive = async (
  deps: ActionRenderDeps,
  context: ActionContext,
  ops: ActionOps,
): Promise<void> => {
  const storedCount = getBadgeQueryCount(
    context.tabId,
    deps.getDateBadgeSetting() !== false,
  );
  await chrome.action.setBadgeText({
    tabId: context.tabId,
    text:
      deps.getBadgeCountSetting() && storedCount > 0
        ? formatQueryCount(storedCount)
        : "ON",
  });
  await chrome.action.setBadgeBackgroundColor({
    tabId: context.tabId,
    color: context.hasActionableSuggestion ? "#f59e0b" : "#1f883d",
  });
  await chrome.action.setBadgeTextColor({
    tabId: context.tabId,
    color: context.hasActionableSuggestion ? "#111827" : "#ffffff",
  });
  await ops.setIcon("active", "matched-rule");
  await chrome.action.setTitle({
    tabId: context.tabId,
    title: getActiveTitle(context),
  });
  await ops.logBadge(getActiveReason(context));
  deps.logExtensionEvent({
    enabled: context.debugMode,
    category: LogCategory.System,
    event: "popup.action-state-active",
    payload: {
      hostname: context.hostname ?? "unknown",
      tabId: context.tabId,
      details: {
        pattern: context.matchedRule?.pattern ?? null,
        winningSource: context.winningSource,
        containerLocationId: context.containerAssignment?.locationId ?? null,
        hasActionableSuggestion: context.hasActionableSuggestion,
        hasSuggestionWarning: context.filteredSuggestions.hasWarning,
      },
    },
  });
};

export const renderActionState = async (
  deps: ActionRenderDeps,
  context: ActionContext,
): Promise<void> => {
  const ops = createActionOps(deps, context);
  if (await renderPanic(deps, context, ops)) return;
  if (await renderUnsupported(deps, context, ops)) return;
  await ops.setIcon("neutral", "pre-neutral");
  if (await renderInactive(deps, context, ops)) return;
  if (await renderTrusted(deps, context, ops)) return;
  if (await renderProtection(context, ops)) return;
  if (await renderNotice(context, ops)) return;
  if (await renderNoSnapshot(deps, context, ops)) return;
  await renderActive(deps, context, ops);
};
