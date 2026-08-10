/**
 * Clears browser state tied to a hostname so profile changes do not keep stale
 * cookies, storage, or service-worker state alive.
 */

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { CleanupResult, CleanupSurfaceKey } from "@/shared/types";

const toCandidateOrigins = (hostname: string): string[] => {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname) {
    return [];
  }

  return [`https://${normalizedHostname}`, `http://${normalizedHostname}`];
};

const toExactOrigin = (urlOrOrigin: string): string | null => {
  const trimmed = urlOrOrigin.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
};

const normalizeHostnames = (hostnames: readonly string[]): string[] => [
  ...new Set(
    hostnames.map((hostname) => hostname.trim().toLowerCase()).filter(Boolean),
  ),
];

const hasOrigins = (origins: string[]): origins is [string, ...string[]] =>
  origins.length > 0;

type PageCleanupResult = {
  pageStorage: boolean;
  serviceWorkers: boolean;
  cacheStorage: boolean;
};

const cleanupPageRegistrations = async (): Promise<PageCleanupResult> => {
  let pageStorage = true;
  try {
    localStorage.clear();
  } catch {
    pageStorage = false;
  }

  try {
    sessionStorage.clear();
  } catch {
    pageStorage = false;
  }

  let serviceWorkers = true;
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const results = await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );
    serviceWorkers = results.every(Boolean);
  }

  let cacheStorage = true;
  if ("caches" in globalThis) {
    const cacheNames = await caches.keys();
    const results = await Promise.all(
      cacheNames.map(async (cacheName) => caches.delete(cacheName)),
    );
    cacheStorage = results.every(Boolean);
  }

  return { pageStorage, serviceWorkers, cacheStorage };
};

const shouldCleanupExactSet = (
  hostnames: ReadonlySet<string>,
  url: string | undefined,
): boolean => {
  if (!url) {
    return false;
  }

  try {
    const tabHostname = new URL(url).hostname.toLowerCase();
    return hostnames.has(tabHostname);
  } catch {
    return false;
  }
};

/** Checks whether a tab URL belongs to one of the exact hostnames being cleaned up. */
export const shouldCleanupExactHosts = (
  hostnames: readonly string[],
  url: string | undefined,
): boolean => shouldCleanupExactSet(new Set(normalizeHostnames(hostnames)), url);

/** @deprecated Prefer `shouldCleanupExactHosts` to make exact-host semantics explicit. */
export const shouldCleanupTabForHosts = (
  hostnames: readonly string[],
  url: string | undefined,
): boolean => shouldCleanupExactHosts(hostnames, url);

const cleanupOpenTabsForHosts = async (
  hostnames: readonly string[],
  cookieStoreId?: string,
): Promise<PageCleanupResult | null> => {
  const normalizedHostnames = normalizeHostnames(hostnames);
  if (normalizedHostnames.length === 0) {
    return null;
  }
  const normalizedHostnameSet = new Set(normalizedHostnames);

  const tabs = await chrome.tabs.query({});
  const matchingTabIds = tabs
    .filter((tab) => shouldCleanupExactSet(normalizedHostnameSet, tab.url))
    .filter((tab) =>
      cookieStoreId
        ? (tab as chrome.tabs.Tab & { cookieStoreId?: string }).cookieStoreId ===
          cookieStoreId
        : true,
    )
    .map((tab) => tab.id)
    .filter((tabId): tabId is number => tabId !== undefined);

  const results = await Promise.all(
    matchingTabIds.map(async (tabId) => {
      try {
        const executionResults = await chrome.scripting.executeScript({
          target: { tabId },
          func: cleanupPageRegistrations,
        });
        return (
          executionResults[0]?.result ?? {
            pageStorage: false,
            serviceWorkers: false,
            cacheStorage: false,
          }
        );
      } catch {
        return {
          pageStorage: false,
          serviceWorkers: false,
          cacheStorage: false,
        };
      }
    }),
  );

  if (results.length === 0) return null;
  return {
    pageStorage: results.every((result) => result.pageStorage),
    serviceWorkers: results.every((result) => result.serviceWorkers),
    cacheStorage: results.every((result) => result.cacheStorage),
  };
};

export type CleanupExecutionReport = {
  cleanedOrigins: string[];
  surfaces: CleanupResult["surfaces"];
};

const createSurfaceStatus = (): Record<
  CleanupSurfaceKey,
  CleanupResult["surfaces"][number]["status"]
> => ({
  cookies: "skipped",
  "local-storage": "skipped",
  "indexed-db": "skipped",
  "cache-storage": "skipped",
  "service-workers": "skipped",
  "page-storage": "skipped",
});

/* eslint-disable sonarjs/cognitive-complexity -- explicit branches preserve per-surface partial-failure reporting across browser APIs */
export const cleanupHostsWithReport = async (
  hostnames: readonly string[],
  options: {
    cookieStoreId?: string;
    exactOrigins?: readonly string[];
  } = {},
): Promise<CleanupExecutionReport> => {
  const normalizedHostnames = normalizeHostnames(hostnames);
  const exactOrigins = (options.exactOrigins ?? [])
    .map((origin) => toExactOrigin(origin))
    .filter((origin): origin is string => origin !== null);
  const origins = [
    ...new Set([
      ...normalizedHostnames.flatMap((hostname) => toCandidateOrigins(hostname)),
      ...exactOrigins,
    ]),
  ];
  const statuses = createSurfaceStatus();
  if (!hasOrigins(origins)) {
    return {
      cleanedOrigins: [],
      surfaces: Object.entries(statuses).map(([key, status]) => ({
        key: key as CleanupSurfaceKey,
        status,
      })),
    };
  }

  const firefoxContainer =
    BUILD_BROWSER_TARGET === "firefox" && Boolean(options.cookieStoreId);
  try {
    if (BUILD_BROWSER_TARGET === "firefox") {
      await chrome.browsingData.remove(
        options.cookieStoreId
          ? ({
              hostnames: normalizedHostnames,
              cookieStoreId: options.cookieStoreId,
            } as any)
          : ({ hostnames: normalizedHostnames } as any),
        options.cookieStoreId
          ? { cookies: true, indexedDB: true, localStorage: true }
          : {
              cookies: true,
              indexedDB: true,
              localStorage: true,
              serviceWorkers: true,
            },
      );
    } else {
      await chrome.browsingData.remove(
        { origins },
        {
          cacheStorage: true,
          cookies: true,
          indexedDB: true,
          localStorage: true,
          serviceWorkers: true,
        },
      );
    }
    statuses.cookies = "cleaned";
    statuses["local-storage"] = "cleaned";
    statuses["indexed-db"] = "cleaned";
    if (!firefoxContainer) statuses["service-workers"] = "cleaned";
    if (BUILD_BROWSER_TARGET === "chromium") statuses["cache-storage"] = "cleaned";
  } catch {
    statuses.cookies = "failed";
    statuses["local-storage"] = "failed";
    statuses["indexed-db"] = "failed";
    if (!firefoxContainer) statuses["service-workers"] = "failed";
    if (BUILD_BROWSER_TARGET === "chromium") statuses["cache-storage"] = "failed";
  }

  try {
    for (const hostname of normalizedHostnames) {
      const cookies = await chrome.cookies.getAll({
        domain: hostname,
        ...(options.cookieStoreId ? { storeId: options.cookieStoreId } : {}),
      });
      const removed = await Promise.all(
        cookies.map((cookie) => {
          const protocol = cookie.secure ? "https" : "http";
          const domain = cookie.domain.startsWith(".")
            ? cookie.domain.slice(1)
            : cookie.domain;
          return chrome.cookies.remove({
            url: `${protocol}://${domain}${cookie.path || "/"}`,
            name: cookie.name,
            storeId: cookie.storeId,
          });
        }),
      );
      if (removed.some((result) => result === null)) statuses.cookies = "failed";
    }
  } catch {
    statuses.cookies = "failed";
  }

  const pageResult = await cleanupOpenTabsForHosts(
    normalizedHostnames,
    options.cookieStoreId,
  );
  if (pageResult) {
    statuses["page-storage"] = pageResult.pageStorage ? "cleaned" : "failed";
    if (firefoxContainer) {
      statuses["service-workers"] = pageResult.serviceWorkers ? "cleaned" : "failed";
      statuses["cache-storage"] = pageResult.cacheStorage ? "cleaned" : "failed";
    }
  }

  return {
    cleanedOrigins: origins,
    surfaces: Object.entries(statuses).map(([key, status]) => ({
      key: key as CleanupSurfaceKey,
      status,
      ...(status === "failed" ? { reasonKey: "cleanup-failed" } : {}),
    })),
  };
};
/* eslint-enable sonarjs/cognitive-complexity */

/**
 * Removes browsing data, cookies, and page-registered workers/cache state for
 * a set of hostnames after a rule or profile transition.
 */
export const cleanupHostnamesState = async (
  hostnames: readonly string[],
  options: {
    cookieStoreId?: string;
    exactOrigins?: readonly string[];
  } = {},
): Promise<string[]> => {
  return (await cleanupHostsWithReport(hostnames, options)).cleanedOrigins;
};

/** Removes state for one exact hostname. */
export const cleanupHostnameState = async (hostname: string): Promise<string[]> =>
  cleanupHostnamesState([hostname]);

/** @deprecated Prefer `cleanupHostnameState` to make exact-host semantics explicit. */
export const cleanupDomainState = async (hostname: string): Promise<string[]> =>
  cleanupHostnameState(hostname);

/** Normalizes a URL or hostname-like input into its registrable hostname form. */
export const getRegistrableHostname = (input: string): string => {
  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    return url.hostname;
  } catch {
    return input.trim().toLowerCase();
  }
};
