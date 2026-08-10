import {
  loadActionContext,
  type ActionContextDeps,
} from "@/background/action-state-context";
import {
  renderActionState,
  type ActionRenderDeps,
} from "@/background/action-state-render";
import { getBadgeQueryCount } from "@/background/surface-access-tracker";
import { fireAndForget } from "@/shared/async";

type ActionStateCommandDeps = ActionContextDeps & ActionRenderDeps;

const updateActionStateForTab = async (
  deps: ActionStateCommandDeps,
  tabId: number,
  tabUrl?: string,
): Promise<void> => {
  const context = await loadActionContext(deps, tabId, tabUrl);
  await renderActionState(deps, context);
};

const refreshActionState = async (
  deps: ActionStateCommandDeps,
  tabId?: number,
): Promise<void> => {
  if (tabId !== undefined) {
    await updateActionStateForTab(deps, tabId);
    return;
  }

  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter(
        (tab): tab is chrome.tabs.Tab & { id: number } => typeof tab.id === "number",
      )
      .map((tab) => updateActionStateForTab(deps, tab.id, tab.url)),
  );
};

const formatQueryCount = (count: number): string =>
  count < 1000 ? String(count) : `>${Math.floor(count / 1000)}k`;

const BADGE_REFRESH_MS = 100;

const refreshBadgeCountForTab = async (
  deps: ActionStateCommandDeps,
  tabId: number,
): Promise<void> => {
  if (!deps.getBadgeCountSetting()) return;
  const count = getBadgeQueryCount(tabId, deps.getDateBadgeSetting() !== false);
  const currentText = await chrome.action.getBadgeText({ tabId }).catch(() => null);
  if (currentText !== "ON" && !/^>?\d+k?$/.test(currentText ?? "")) return;
  if (count === 0) {
    if (currentText !== "ON") {
      await chrome.action.setBadgeText({ tabId, text: "ON" });
    }
    return;
  }
  await chrome.action.setBadgeText({ tabId, text: formatQueryCount(count) });
};

const scheduleBadgeRefresh = (
  deps: ActionStateCommandDeps,
  badgeRefreshTimers: Map<number, ReturnType<typeof setTimeout>>,
  tabId: number,
): void => {
  if (badgeRefreshTimers.has(tabId)) return;
  const timer = setTimeout(() => {
    badgeRefreshTimers.delete(tabId);
    fireAndForget(refreshBadgeCountForTab(deps, tabId));
  }, BADGE_REFRESH_MS);
  badgeRefreshTimers.set(tabId, timer);
};

const clearBadgeRefreshTimer = (
  badgeRefreshTimers: Map<number, ReturnType<typeof setTimeout>>,
  tabId: number,
): void => {
  const timer = badgeRefreshTimers.get(tabId);
  if (!timer) return;
  clearTimeout(timer);
  badgeRefreshTimers.delete(tabId);
};

export const createActionHandlers = (deps: ActionStateCommandDeps) => {
  const badgeRefreshTimers = new Map<number, ReturnType<typeof setTimeout>>();
  return {
    updateActionStateForTab: updateActionStateForTab.bind(null, deps),
    refreshActionState: refreshActionState.bind(null, deps),
    refreshBadgeCountForTab: refreshBadgeCountForTab.bind(null, deps),
    scheduleBadgeRefresh: scheduleBadgeRefresh.bind(null, deps, badgeRefreshTimers),
    clearBadgeRefreshTimer: clearBadgeRefreshTimer.bind(null, badgeRefreshTimers),
  };
};
