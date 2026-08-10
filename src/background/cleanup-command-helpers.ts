import { resolveActiveIdentity } from "@/background/rules/resolver";
import { getRegistrableHostname } from "@/background/state-hygiene";
import { loadContainerAssignments } from "@/background/storage/container-assignments";
import type { loadLocations } from "@/background/storage/locations";
import { loadRules } from "@/background/storage/rules";
import {
  findIdentityHosts,
  findIdentityOrigins,
  loadSeenHosts,
} from "@/background/storage/seen-hosts";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { EffectiveTabContext, GlobalFallbackRule } from "@/shared/types";

export type LoadedLocations = Awaited<ReturnType<typeof loadLocations>>;
export type ResolvedActiveIdentity = NonNullable<
  ReturnType<typeof resolveActiveIdentity>
>;
export type TrackedIdentity =
  | ResolvedActiveIdentity
  | {
      kind: "fallback";
      ruleSeedKey: string;
    };
export type SeenHostsIdentity = Parameters<typeof findIdentityHosts>[1];
export type CleanupTarget =
  | {
      kind: "rule";
      pattern: string;
    }
  | {
      kind: "container";
      cookieStoreId: string;
    };

export type CleanupCommandHelperDeps = {
  getActiveTabContexts: () => EffectiveTabContext[];
  isSupportedWebUrl: (url: string | undefined) => url is string;
  removeActiveTabContext: (tabId: number) => void;
  resolveTrackedIdentity: (
    activeIdentity: ResolvedActiveIdentity | null,
    profiles: LoadedLocations,
    globalFallbackRule: GlobalFallbackRule | undefined,
    allowFallback: boolean,
  ) => TrackedIdentity | null;
};

export const toSeenHostsIdentity = (identity: TrackedIdentity): SeenHostsIdentity => {
  if (identity.kind === "rule") {
    return {
      kind: "rule",
      pattern: identity.pattern,
      ruleSeedKey: identity.ruleSeedKey,
    };
  }

  if (identity.kind === "container") {
    return {
      kind: "container",
      cookieStoreId: identity.cookieStoreId,
      ruleSeedKey: identity.ruleSeedKey,
    };
  }

  return {
    kind: "fallback",
    ruleSeedKey: identity.ruleSeedKey,
  };
};

const matchesCleanupTarget = (
  identity: ResolvedActiveIdentity | null,
  target: CleanupTarget,
): boolean => {
  if (!identity) {
    return false;
  }

  if (identity.kind === "rule") {
    if (target.kind !== "rule") {
      return false;
    }
    return identity.pattern === target.pattern;
  }

  if (target.kind !== "container") {
    return false;
  }
  return identity.cookieStoreId === target.cookieStoreId;
};

export const collectCleanupHosts = (
  deps: CleanupCommandHelperDeps,
  target: CleanupTarget,
  rules: Awaited<ReturnType<typeof loadRules>>,
  containerAssignments: Awaited<ReturnType<typeof loadContainerAssignments>>,
): string[] => {
  const hostnames = new Set<string>();

  for (const context of deps.getActiveTabContexts()) {
    const identity = resolveActiveIdentity(
      context.hostname,
      context.cookieStoreId,
      rules,
      containerAssignments,
    );
    if (matchesCleanupTarget(identity, target)) {
      hostnames.add(context.hostname);
    }
  }

  return [...hostnames];
};

export const removeCleanupContexts = (
  deps: CleanupCommandHelperDeps,
  hostnames: readonly string[],
  cookieStoreId?: string,
): number[] => {
  const normalizedHostnames = new Set(
    hostnames.map((hostname) => getRegistrableHostname(hostname)),
  );
  const affectedTabIds: number[] = [];

  for (const context of deps.getActiveTabContexts()) {
    const { tabId } = context;
    if (!normalizedHostnames.has(getRegistrableHostname(context.hostname))) {
      continue;
    }

    if (cookieStoreId && context.cookieStoreId !== cookieStoreId) {
      continue;
    }

    affectedTabIds.push(tabId);
    deps.removeActiveTabContext(tabId);
  }

  return affectedTabIds;
};

export const shouldReloadCleanupTab = (
  deps: CleanupCommandHelperDeps,
  {
    cleanupHostnames,
    cookieStoreId,
    existingTabIds,
    pageUrl,
    tab,
  }: {
    cleanupHostnames: readonly string[];
    cookieStoreId: string | undefined;
    existingTabIds: readonly number[];
    pageUrl: string | undefined;
    tab: chrome.tabs.Tab | undefined;
  },
): number | null => {
  if (
    tab?.id === undefined ||
    existingTabIds.includes(tab.id) ||
    !deps.isSupportedWebUrl(pageUrl)
  ) {
    return null;
  }

  if (
    cookieStoreId &&
    (tab as chrome.tabs.Tab & { cookieStoreId?: string }).cookieStoreId !==
      cookieStoreId
  ) {
    return null;
  }

  const pageHostname = getRegistrableHostname(pageUrl);
  return cleanupHostnames.some(
    (hostname) => getRegistrableHostname(hostname) === pageHostname,
  )
    ? tab.id
    : null;
};

export const resolveRotateCleanup = async (
  deps: CleanupCommandHelperDeps,
  target: CleanupTarget,
): Promise<{
  cleanupHostnames: string[];
  cleanupCookieStoreId: string | undefined;
  exactOrigins: string[];
  rules: Awaited<ReturnType<typeof loadRules>>;
  containerAssignments: Awaited<ReturnType<typeof loadContainerAssignments>>;
} | null> => {
  const [rules, containerAssignments, seenHosts] = await Promise.all([
    loadRules(),
    loadContainerAssignments(),
    loadSeenHosts(),
  ]);

  const seenHostsIdentity =
    target.kind === "rule"
      ? (() => {
          const trackedRule = rules.find((rule) => rule.pattern === target.pattern);
          if (!trackedRule?.ruleSeedKey) {
            return null;
          }
          return {
            kind: "rule",
            pattern: trackedRule.pattern,
            ruleSeedKey: trackedRule.ruleSeedKey,
          } satisfies SeenHostsIdentity;
        })()
      : (() => {
          const trackedAssignment = containerAssignments.find(
            (assignment) => assignment.cookieStoreId === target.cookieStoreId,
          );
          if (!trackedAssignment?.ruleSeedKey) {
            return null;
          }
          return {
            kind: "container",
            cookieStoreId: trackedAssignment.cookieStoreId,
            ruleSeedKey: trackedAssignment.ruleSeedKey,
          } satisfies SeenHostsIdentity;
        })();
  if (!seenHostsIdentity) {
    return null;
  }

  return {
    cleanupHostnames: [
      ...new Set([
        ...findIdentityHosts(seenHosts, seenHostsIdentity),
        ...collectCleanupHosts(deps, target, rules, containerAssignments),
      ]),
    ],
    cleanupCookieStoreId:
      target.kind === "container" && BUILD_BROWSER_TARGET === "firefox"
        ? target.cookieStoreId
        : undefined,
    exactOrigins: findIdentityOrigins(seenHosts, seenHostsIdentity),
    rules,
    containerAssignments,
  };
};
