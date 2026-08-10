import { fireAndForget } from "@/shared/async";
import { BRAND_DIAGNOSTICS_NAME, BRAND_DISPLAY_NAME } from "@/shared/brand";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";

const MENU_ID_ACTION = "pt-sidebar-action";
const MENU_ID_PAGE = "pt-sidebar-page";
const MENU_ID_LOGS_ACTION = "pt-logs-action";
const MENU_ID_LOGS_PAGE = "pt-logs-page";
const RETIRED_MENU_IDS = ["warp", "wrap"].flatMap((suffix) => {
  const namespace = ["geo", suffix].join("");
  return [
    `${namespace}-sidebar-action`,
    `${namespace}-sidebar-page`,
    `${namespace}-logs-action`,
    `${namespace}-logs-page`,
  ];
});

const MENU_TITLE_SIDEBAR = `${BRAND_DISPLAY_NAME} ${BRAND_DIAGNOSTICS_NAME}`;
const MENU_TITLE_LOGS = "View logs";

const getLogsPageUrl = (hostFilter?: string): string => {
  const base = `${chrome.runtime.getURL("src/ui/options/index.html")}#page-logs`;
  return hostFilter ? `${base}?host=${encodeURIComponent(hostFilter)}` : base;
};

// In Chrome MV3 the service worker can be terminated between removeAll() and
// create(), leaving the menu permanently empty until the next onInstalled /
// onStartup. Avoid that race by never calling removeAll(); instead use
// per-item idempotent helpers that tolerate both "already exists" and "not
// found" conditions.

const safeCreateMenuItem = (properties: chrome.contextMenus.CreateProperties): void => {
  chrome.contextMenus.create(properties, () => {
    // Suppress "Cannot create item with duplicate id" — item persisted from a
    // previous service-worker run; already in the desired state.
    if (chrome.runtime.lastError) {
      /* duplicate — already in desired state */
    }
  });
};

const safeRemoveMenuItem = (id: string): void => {
  // Suppress "Cannot find menu item with id" when the item never existed or
  // was already removed. chrome.contextMenus.remove is Promise-based in
  // Chrome 120+ (our minimum target).
  chrome.contextMenus.remove(id).catch(() => {
    /* not found — ok */
  });
};

export const removeRetiredMenuItems = async (): Promise<void> => {
  if (!chrome.contextMenus) return;

  await Promise.all(
    RETIRED_MENU_IDS.map((id) =>
      chrome.contextMenus.remove(id).catch(() => {
        /* absent — already migrated */
      }),
    ),
  );
};

export const syncSidebarMenus = async (
  getDebugModeSync: () => boolean,
): Promise<void> => {
  if (!chrome.contextMenus) {
    return;
  }

  safeCreateMenuItem({
    id: MENU_ID_ACTION,
    title: MENU_TITLE_SIDEBAR,
    contexts: ["action"],
  });
  safeCreateMenuItem({
    id: MENU_ID_PAGE,
    title: MENU_TITLE_SIDEBAR,
    contexts: ["page"],
  });

  const debugMode = getDebugModeSync();

  if (debugMode) {
    safeCreateMenuItem({
      id: MENU_ID_LOGS_ACTION,
      title: MENU_TITLE_LOGS,
      contexts: ["action"],
    });
    safeCreateMenuItem({
      id: MENU_ID_LOGS_PAGE,
      title: MENU_TITLE_LOGS,
      contexts: ["page"],
    });
  } else {
    safeRemoveMenuItem(MENU_ID_LOGS_ACTION);
    safeRemoveMenuItem(MENU_ID_LOGS_PAGE);
  }
};

export const registerSidebarMenu = (getDebugModeSync: () => boolean): void => {
  if (!chrome.contextMenus) {
    return;
  }

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const id = info.menuItemId;

    if (id === MENU_ID_LOGS_ACTION || id === MENU_ID_LOGS_PAGE) {
      if (!getDebugModeSync()) return;
      const hostname =
        id === MENU_ID_LOGS_PAGE && tab?.url
          ? (() => {
              try {
                return new URL(tab.url).hostname;
              } catch {
                return undefined;
              }
            })()
          : undefined;
      fireAndForget(chrome.tabs.create({ url: getLogsPageUrl(hostname) }));
      return;
    }

    if (id !== MENU_ID_ACTION && id !== MENU_ID_PAGE) {
      return;
    }

    const tabId = tab?.id;
    if (tabId === undefined) return;

    if (BUILD_BROWSER_TARGET === "firefox") {
      const firefoxBrowser = (
        globalThis as typeof globalThis & {
          browser?: { sidebarAction?: { open?: () => void } };
        }
      ).browser;
      firefoxBrowser?.sidebarAction?.open?.();
    } else {
      fireAndForget(
        (
          chrome as typeof chrome & {
            sidePanel?: { open?: (options: { tabId: number }) => Promise<void> };
          }
        ).sidePanel?.open?.({ tabId }) ?? Promise.resolve(),
      );
    }
  });
};

export const shouldResyncSidebarMenus = (changedKey: string): boolean =>
  changedKey === "debugMode";
