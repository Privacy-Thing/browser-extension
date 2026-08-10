import {
  removeCleanupContexts,
  resolveRotateCleanup,
  shouldReloadCleanupTab,
  toSeenHostsIdentity,
  type CleanupCommandHelperDeps,
  type ResolvedActiveIdentity,
  type TrackedIdentity,
} from "@/background/cleanup-command-helpers";
import { syncDynamicHeaderRules } from "@/background/dnr";
import type { logExtensionEvent } from "@/background/logger";
import { buildPopupCleanupPlan } from "@/background/popup-cleanup-plan";
import { resolveActiveIdentity } from "@/background/rules/resolver";
import {
  cleanupHostnamesState,
  cleanupHostsWithReport,
  getRegistrableHostname,
} from "@/background/state-hygiene";
import {
  loadContainerAssignments,
  saveContainerAssignments,
} from "@/background/storage/container-assignments";
import { loadLocations } from "@/background/storage/locations";
import { getGlobalFallbackRule } from "@/background/storage/preferences";
import { loadRules, saveRules } from "@/background/storage/rules";
import {
  findIdentityHosts,
  findIdentityOrigins,
  findIdentityHostRecords,
  loadSeenHosts,
} from "@/background/storage/seen-hosts";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import { rotateContainerSeed, rotateRuleSeedKey } from "@/shared/rule-seed";
import { LogCategory } from "@/shared/types";
import type {
  CleanupAssociation,
  CleanupDomainResponse,
  ExtensionCommand,
  CleanupLinksResponse,
  CleanupPreviewResponse,
  RotateIdentityResponse,
} from "@/shared/types";

type CleanupCommandDeps = CleanupCommandHelperDeps & {
  clearSnapshotCache: () => void;
  ensureStorageMigration: () => Promise<void>;
  getLastKnownDebugMode: () => boolean | null;
  getPopupTabById: (
    tabId: number | undefined,
  ) => Promise<(chrome.tabs.Tab & { cookieStoreId?: string }) | undefined>;
  logExtensionEvent: typeof logExtensionEvent;
  refreshActionState: (tabId?: number) => Promise<void>;
  reloadSupportedWebTabs: (tabIds: readonly number[]) => Promise<void>;
  setKnownContainers: (
    assignments: Awaited<ReturnType<typeof loadContainerAssignments>> | null,
  ) => void;
  setLastKnownRules: (rules: Awaited<ReturnType<typeof loadRules>> | null) => void;
  syncPreloadedState: () => Promise<void>;
};

const resolveCleanupLinks = async (
  deps: CleanupCommandDeps,
  hostname: string,
  tabId?: number,
  pageUrl?: string,
): Promise<{
  normalizedHostname: string;
  activeIdentity: ResolvedActiveIdentity | null;
  trackedIdentity: TrackedIdentity | null;
  cleanupHostnames: string[];
  cleanupCookieStoreId: string | undefined;
  exactOrigins: string[];
  associations: CleanupAssociation[];
}> => {
  const normalizedHostname = getRegistrableHostname(hostname);
  const [
    rules,
    containerAssignments,
    activeTab,
    seenHosts,
    globalFallbackRule,
    profiles,
  ] = await Promise.all([
    loadRules(),
    loadContainerAssignments(),
    deps.getPopupTabById(tabId),
    loadSeenHosts(),
    getGlobalFallbackRule(),
    loadLocations(),
  ]);

  const activeIdentity = resolveActiveIdentity(
    normalizedHostname,
    activeTab?.cookieStoreId,
    rules,
    containerAssignments,
  );
  const trackedIdentity = deps.resolveTrackedIdentity(
    activeIdentity,
    profiles,
    globalFallbackRule,
    true,
  );
  const seenHostsIdentity = trackedIdentity
    ? toSeenHostsIdentity(trackedIdentity)
    : null;
  const cleanupHostnames = [
    ...new Set([
      normalizedHostname,
      ...(seenHostsIdentity ? findIdentityHosts(seenHosts, seenHostsIdentity) : []),
    ]),
  ];
  const cleanupCookieStoreId =
    activeIdentity?.kind === "container" && BUILD_BROWSER_TARGET === "firefox"
      ? activeIdentity.cookieStoreId
      : undefined;
  const exactOrigins = [
    deps.isSupportedWebUrl(pageUrl) ? new URL(pageUrl).origin : null,
    deps.isSupportedWebUrl(activeTab?.url) ? new URL(activeTab.url).origin : null,
    ...(seenHostsIdentity ? findIdentityOrigins(seenHosts, seenHostsIdentity) : []),
  ].filter((origin): origin is string => origin !== null);
  const associationRecords = seenHostsIdentity
    ? findIdentityHostRecords(seenHosts, seenHostsIdentity)
    : [];
  const currentOrigin = exactOrigins[0] ?? exactOrigins[1] ?? null;
  const currentCookieStoreId = activeTab?.cookieStoreId ?? cleanupCookieStoreId ?? null;
  const associations = [
    {
      hostname: normalizedHostname,
      exactOrigin: currentOrigin,
      cookieStoreId: currentCookieStoreId,
      identityKind: "current" as const,
      identityPattern: activeIdentity?.kind === "rule" ? activeIdentity.pattern : null,
      identityStoreId:
        activeIdentity?.kind === "container" ? activeIdentity.cookieStoreId : null,
    },
    ...associationRecords.map((record) => ({
      hostname: record.hostname,
      exactOrigin: record.exactOrigin ?? null,
      cookieStoreId: record.cookieStoreId ?? null,
      identityKind: record.identityKind,
      identityPattern: record.identityPattern ?? null,
      identityStoreId: record.identityStoreId ?? null,
    })),
  ].filter(
    (entry, index, entries) =>
      entries.findIndex(
        (candidate) =>
          candidate.hostname === entry.hostname &&
          candidate.exactOrigin === entry.exactOrigin &&
          candidate.cookieStoreId === entry.cookieStoreId &&
          candidate.identityKind === entry.identityKind &&
          candidate.identityPattern === entry.identityPattern &&
          candidate.identityStoreId === entry.identityStoreId,
      ) === index,
  );

  return {
    normalizedHostname,
    activeIdentity,
    trackedIdentity,
    cleanupHostnames,
    cleanupCookieStoreId,
    exactOrigins: [...new Set(exactOrigins)],
    associations,
  };
};

const getCleanupAssociations = async (
  deps: CleanupCommandDeps,
  hostname: string,
  tabId?: number,
  pageUrl?: string,
): Promise<CleanupLinksResponse> => {
  await deps.ensureStorageMigration();

  const {
    normalizedHostname,
    cleanupHostnames,
    cleanupCookieStoreId,
    exactOrigins,
    associations,
  } = await resolveCleanupLinks(deps, hostname, tabId, pageUrl);
  const activeTab = await deps.getPopupTabById(tabId);
  const plan = buildPopupCleanupPlan({
    browserTarget: BUILD_BROWSER_TARGET,
    cookieStoreId: cleanupCookieStoreId,
    hasOpenPage: Boolean(activeTab && deps.isSupportedWebUrl(activeTab.url)),
  });

  return {
    ok: true,
    hostname: normalizedHostname,
    trigger: "new-identity",
    cleanupHostnames,
    exactOrigins,
    cookieStoreId: cleanupCookieStoreId ?? null,
    associations,
    plan,
  };
};

const cleanupResolvedTargets = async (
  deps: CleanupCommandDeps,
  {
    cleanupHostnames,
    cleanupCookieStoreId,
    exactOrigins,
    pageUrl,
    tab,
  }: {
    cleanupHostnames: readonly string[];
    cleanupCookieStoreId: string | undefined;
    exactOrigins: readonly string[];
    pageUrl?: string;
    tab?: chrome.tabs.Tab;
  },
): Promise<string[]> => {
  const cleanedOrigins = await cleanupHostnamesState(cleanupHostnames, {
    ...(exactOrigins.length > 0 ? { exactOrigins: [...exactOrigins] } : {}),
    ...(cleanupCookieStoreId ? { cookieStoreId: cleanupCookieStoreId } : {}),
  });

  const affectedTabIds = removeCleanupContexts(
    deps,
    cleanupHostnames,
    cleanupCookieStoreId,
  );
  const cleanupPageTabId = shouldReloadCleanupTab(deps, {
    cleanupHostnames,
    cookieStoreId: cleanupCookieStoreId,
    existingTabIds: affectedTabIds,
    pageUrl,
    tab,
  });
  if (cleanupPageTabId !== null) {
    affectedTabIds.push(cleanupPageTabId);
  }

  await syncDynamicHeaderRules(deps.getActiveTabContexts());
  await deps.reloadSupportedWebTabs(affectedTabIds);
  await deps.refreshActionState();

  return cleanedOrigins;
};

const cleanupTargets = async (
  deps: CleanupCommandDeps,
  {
    cleanupHostnames,
    cleanupCookieStoreId,
    exactOrigins,
    pageUrl,
    tab,
  }: {
    cleanupHostnames: readonly string[];
    cleanupCookieStoreId: string | undefined;
    exactOrigins: readonly string[];
    pageUrl?: string;
    tab?: chrome.tabs.Tab;
  },
) => {
  const report = await cleanupHostsWithReport(cleanupHostnames, {
    ...(exactOrigins.length > 0 ? { exactOrigins: [...exactOrigins] } : {}),
    ...(cleanupCookieStoreId ? { cookieStoreId: cleanupCookieStoreId } : {}),
  });
  const affectedTabIds = removeCleanupContexts(
    deps,
    cleanupHostnames,
    cleanupCookieStoreId,
  );
  const cleanupPageTabId = shouldReloadCleanupTab(deps, {
    cleanupHostnames,
    cookieStoreId: cleanupCookieStoreId,
    existingTabIds: affectedTabIds,
    pageUrl,
    tab,
  });
  if (cleanupPageTabId !== null) affectedTabIds.push(cleanupPageTabId);
  await syncDynamicHeaderRules(deps.getActiveTabContexts());
  await deps.reloadSupportedWebTabs(affectedTabIds);
  await deps.refreshActionState();
  return report;
};

const buildCleanupResult = (
  plan: ReturnType<typeof buildPopupCleanupPlan>,
  report: Awaited<ReturnType<typeof cleanupTargets>>,
): CleanupDomainResponse["result"] => {
  const cleanedCount = report.surfaces.filter(
    (surface) => surface.status === "cleaned",
  ).length;
  let outcome: CleanupDomainResponse["result"]["outcome"] = "failed";
  if (cleanedCount === report.surfaces.length) outcome = "complete";
  else if (cleanedCount > 0) outcome = "partial";
  return {
    outcome,
    surfaces: plan.surfaces.map(
      (plannedSurface) =>
        report.surfaces.find((surface) => surface.key === plannedSurface.key) ?? {
          key: plannedSurface.key,
          status: "skipped" as const,
          ...(plannedSurface.reasonKey ? { reasonKey: plannedSurface.reasonKey } : {}),
        },
    ),
  };
};

const handleCleanupDomainState = async (
  deps: CleanupCommandDeps,
  hostname: string,
  tabId?: number,
  pageUrl?: string,
): Promise<CleanupDomainResponse> => {
  await deps.ensureStorageMigration();

  const activeTab = await deps.getPopupTabById(tabId);
  const {
    normalizedHostname,
    activeIdentity,
    trackedIdentity,
    cleanupHostnames,
    cleanupCookieStoreId,
    exactOrigins,
  } = await resolveCleanupLinks(deps, hostname, tabId, pageUrl);
  const plan = buildPopupCleanupPlan({
    browserTarget: BUILD_BROWSER_TARGET,
    cookieStoreId: cleanupCookieStoreId,
    hasOpenPage: Boolean(activeTab && deps.isSupportedWebUrl(activeTab.url)),
  });

  if (activeIdentity?.kind === "rule") {
    const rules = await loadRules();
    const nextRules = rotateRuleSeedKey(rules, activeIdentity.pattern);
    const didRotate = nextRules.some(
      (rule, index) => rule.ruleSeedKey !== rules[index]?.ruleSeedKey,
    );

    if (didRotate) {
      await saveRules(nextRules);
      deps.setLastKnownRules(nextRules);
      deps.clearSnapshotCache();
      await deps.syncPreloadedState();
    }
  }

  if (activeIdentity?.kind === "container") {
    const containerAssignments = await loadContainerAssignments();
    const nextAssignments = rotateContainerSeed(
      containerAssignments,
      activeIdentity.cookieStoreId,
    );
    const didRotate = nextAssignments.some(
      (assignment, index) =>
        assignment.ruleSeedKey !== containerAssignments[index]?.ruleSeedKey,
    );

    if (didRotate) {
      await saveContainerAssignments(nextAssignments);
      deps.setKnownContainers(nextAssignments);
      deps.clearSnapshotCache();
      await deps.syncPreloadedState();
    }
  }

  if (trackedIdentity?.kind === "fallback") {
    deps.logExtensionEvent({
      enabled: deps.getLastKnownDebugMode() ?? false,
      category: LogCategory.System,
      event: "cleanup.default-rule-blocked",
      payload: {
        hostname: normalizedHostname,
        details: {
          trigger: "new-identity",
          reason: "default-rule-does-not-rotate",
        },
      },
    });
  }

  const cleanupReport = await cleanupTargets(deps, {
    cleanupHostnames,
    cleanupCookieStoreId,
    exactOrigins,
    ...(pageUrl ? { pageUrl } : {}),
    ...(activeTab ? { tab: activeTab } : {}),
  });
  deps.logExtensionEvent({
    enabled: deps.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "cleanup.domain-cleaned",
    payload: {
      hostname: normalizedHostname,
      details: {
        trigger: "new-identity",
        destructive: true,
        cleanedOrigins: cleanupReport.cleanedOrigins,
        cleanupHostnames,
        exactOrigins,
        cookieStoreId: cleanupCookieStoreId ?? null,
        ...(activeIdentity?.kind === "rule"
          ? { rotatedRulePattern: activeIdentity.pattern }
          : {}),
        ...(activeIdentity?.kind === "container"
          ? { rotatedCookieStoreId: activeIdentity.cookieStoreId }
          : {}),
        ...(trackedIdentity?.kind === "fallback"
          ? { rotatedGlobalFallback: true }
          : {}),
      },
    },
  });

  return {
    ok: true,
    cleanedOrigins: cleanupReport.cleanedOrigins,
    plan,
    result: buildCleanupResult(plan, cleanupReport),
  };
};

const rotateIdentity = async (
  deps: CleanupCommandDeps,
  command: Extract<
    ExtensionCommand,
    { type: typeof EXTENSION_COMMAND_TYPES.rotateIdentityTarget }
  >,
): Promise<RotateIdentityResponse> => {
  await deps.ensureStorageMigration();

  if (command.target === "rule") {
    const cleanupState = await resolveRotateCleanup(deps, {
      kind: "rule",
      pattern: command.pattern,
    });
    if (!cleanupState) {
      return {
        ok: false,
        error: "Rule not found.",
      };
    }

    const nextRules = rotateRuleSeedKey(cleanupState.rules, command.pattern);
    const rotatedRule = nextRules.find((rule) => rule.pattern === command.pattern);
    if (!rotatedRule?.ruleSeedKey) {
      return {
        ok: false,
        error: "Rule not found.",
      };
    }

    await saveRules(nextRules);
    deps.setLastKnownRules(nextRules);
    deps.clearSnapshotCache();
    await deps.syncPreloadedState();

    const cleanedOrigins = await cleanupResolvedTargets(deps, {
      cleanupHostnames: cleanupState.cleanupHostnames,
      cleanupCookieStoreId: cleanupState.cleanupCookieStoreId,
      exactOrigins: cleanupState.exactOrigins,
    });

    deps.logExtensionEvent({
      enabled: deps.getLastKnownDebugMode() ?? false,
      category: LogCategory.System,
      event: "cleanup.rule-identity-rotated",
      payload: {
        hostname: cleanupState.cleanupHostnames[0] ?? command.pattern,
        details: {
          trigger: "settings-new-identity",
          pattern: command.pattern,
          cleanedOrigins,
          cleanupHostnames: cleanupState.cleanupHostnames,
        },
      },
    });

    return {
      ok: true,
      cleanedOrigins,
      target: "rule",
      pattern: command.pattern,
      ruleSeedKey: rotatedRule.ruleSeedKey,
    };
  }

  const cleanupState = await resolveRotateCleanup(deps, {
    kind: "container",
    cookieStoreId: command.cookieStoreId,
  });
  if (!cleanupState) {
    return {
      ok: false,
      error: "Container assignment not found.",
    };
  }

  const nextAssignments = rotateContainerSeed(
    cleanupState.containerAssignments,
    command.cookieStoreId,
  );
  const rotatedAssignment = nextAssignments.find(
    (assignment) => assignment.cookieStoreId === command.cookieStoreId,
  );
  if (!rotatedAssignment?.ruleSeedKey) {
    return {
      ok: false,
      error: "Container assignment not found.",
    };
  }

  await saveContainerAssignments(nextAssignments);
  deps.setKnownContainers(nextAssignments);
  deps.clearSnapshotCache();
  await deps.syncPreloadedState();

  const cleanedOrigins = await cleanupResolvedTargets(deps, {
    cleanupHostnames: cleanupState.cleanupHostnames,
    cleanupCookieStoreId: cleanupState.cleanupCookieStoreId,
    exactOrigins: cleanupState.exactOrigins,
  });

  deps.logExtensionEvent({
    enabled: deps.getLastKnownDebugMode() ?? false,
    category: LogCategory.System,
    event: "cleanup.container-identity-rotated",
    payload: {
      hostname: cleanupState.cleanupHostnames[0] ?? command.cookieStoreId,
      details: {
        trigger: "settings-new-identity",
        cookieStoreId: command.cookieStoreId,
        cleanedOrigins,
        cleanupHostnames: cleanupState.cleanupHostnames,
      },
    },
  });

  return {
    ok: true,
    cleanedOrigins,
    target: "container",
    cookieStoreId: command.cookieStoreId,
    ruleSeedKey: rotatedAssignment.ruleSeedKey,
  };
};

const previewIdentityCleanup = async (
  deps: CleanupCommandDeps,
  command: Extract<
    ExtensionCommand,
    { type: typeof EXTENSION_COMMAND_TYPES.previewIdentityCleanup }
  >,
): Promise<CleanupPreviewResponse> => {
  await deps.ensureStorageMigration();

  const cleanupState =
    command.target === "rule"
      ? await resolveRotateCleanup(deps, {
          kind: "rule",
          pattern: command.pattern,
        })
      : await resolveRotateCleanup(deps, {
          kind: "container",
          cookieStoreId: command.cookieStoreId,
        });
  if (!cleanupState) {
    return {
      ok: false,
      error:
        command.target === "rule"
          ? "Rule not found."
          : "Container assignment not found.",
    };
  }

  return command.target === "rule"
    ? {
        ok: true,
        target: "rule",
        pattern: command.pattern,
        cleanupHostnames: cleanupState.cleanupHostnames,
      }
    : {
        ok: true,
        target: "container",
        cookieStoreId: command.cookieStoreId,
        cleanupHostnames: cleanupState.cleanupHostnames,
      };
};

export const createCleanupHandlers = (deps: CleanupCommandDeps) => ({
  getCleanupAssociations: getCleanupAssociations.bind(null, deps),
  handleCleanupDomainState: handleCleanupDomainState.bind(null, deps),
  rotateIdentity: rotateIdentity.bind(null, deps),
  previewIdentityCleanup: previewIdentityCleanup.bind(null, deps),
  removeCleanupContexts: removeCleanupContexts.bind(null, deps),
});
