import type {
  LoadedLocations,
  ResolvedActiveIdentity,
  TrackedIdentity,
} from "@/background/cleanup-command-helpers";
import { logExtensionEvent } from "@/background/logger";
import type { loadLocations } from "@/background/storage/locations";
import type { loadRules } from "@/background/storage/rules";
import { findMostSpecificRule } from "@/shared/domain-match";
import { LogCategory, type GlobalFallbackRule } from "@/shared/types";

export type PopupTab = chrome.tabs.Tab & { cookieStoreId?: string };

export const getExactHostname = (url: string): string => new URL(url).hostname;

export const isSupportedWebUrl = (url: string | undefined): url is string =>
  typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));

export const resolveFallbackId = (
  profiles: Awaited<ReturnType<typeof loadLocations>>,
  fallbackRule: GlobalFallbackRule | undefined,
): string | null => {
  if (!fallbackRule?.enabled || !fallbackRule.locationId) return null;
  return profiles.some((profile) => profile.id === fallbackRule.locationId)
    ? fallbackRule.locationId
    : null;
};

export const resolveTrackedIdentity = (
  activeIdentity: ResolvedActiveIdentity | null,
  profiles: LoadedLocations,
  fallbackRule: GlobalFallbackRule | undefined,
  allowFallback: boolean,
): TrackedIdentity | null => {
  if (activeIdentity) return activeIdentity;
  if (!allowFallback || !fallbackRule || !resolveFallbackId(profiles, fallbackRule)) {
    return null;
  }
  return { kind: "fallback", ruleSeedKey: fallbackRule.ruleSeedKey };
};

export const findDisplayedRule = (
  hostname: string,
  rules: Awaited<ReturnType<typeof loadRules>>,
): (typeof rules)[number] | null =>
  findMostSpecificRule(hostname, rules, { includeDisabled: true }) ?? null;

export const getPopupTabById = async (
  tabId: number | undefined,
): Promise<PopupTab | undefined> => {
  if (tabId === undefined) {
    const activeTabs = (await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })) as PopupTab[];
    return activeTabs[0];
  }
  try {
    return (await chrome.tabs.get(tabId)) as PopupTab;
  } catch {
    return undefined;
  }
};

export const createBackgroundLogs = (getDebugMode: () => boolean | null) => ({
  logFirefoxBootstrapEvent: (
    event: string,
    input: {
      hostname?: string;
      tabId?: number;
      details: Record<string, unknown>;
    },
  ): void => {
    logExtensionEvent({
      enabled: getDebugMode() ?? false,
      category: LogCategory.System,
      event,
      payload: {
        ...(input.hostname ? { hostname: input.hostname } : {}),
        ...(input.tabId !== undefined ? { tabId: input.tabId } : {}),
        details: input.details,
      },
    });
  },
  logResolverEvent: (
    enabled: boolean,
    event: string,
    input: {
      hostname: string;
      tabId?: number;
      details: Record<string, unknown>;
    },
  ): void => {
    logExtensionEvent({
      enabled,
      category: LogCategory.System,
      event,
      payload: {
        hostname: input.hostname,
        ...(input.tabId !== undefined ? { tabId: input.tabId } : {}),
        details: input.details,
      },
    });
  },
});
