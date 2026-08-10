import {
  type XRaySurfaceCategory,
  XRayStateCommandSchema,
  UsageCommandSchema,
  SurfaceErrorSchema,
  type SurfaceErrorCommand,
} from "@privacy-brand/xray-protocol";

import { logExtensionEvent, waitForExtensionLogQueue } from "@/background/logger";
import {
  getUpdateRuleInput,
  type ImportLocationsCommand,
} from "@/background/message-router-inputs";
import type { RouterDeps } from "@/background/message-router-types";
import { resolveLogCategory } from "@/background/runtime-log-routing";
import {
  EXAMPLE_LOCATION_IDS,
  EXAMPLE_LOCATIONS,
  loadLocations,
  randomizeLocation,
  saveLocations,
} from "@/background/storage/locations";
import { recordSuggestion } from "@/background/storage/site-suggestions";
import { fireAndForget } from "@/shared/async";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import { normalizeLocations } from "@/shared/locale-catalog";
import { normalizeLogLevel } from "@/shared/logging-types";
import { DEFAULT_RANDOM_RADIUS_KM } from "@/shared/settings-defaults";
import type {
  ExtensionCommand,
  ImportLocationsResponse,
  LoadSampleDataResponse,
  ResolveSnapshotResponse,
} from "@/shared/types";
import { WORKER_CSP_BLOCKED_EVENT } from "@/shared/worker-compatibility";

type TabWithCookieStore = chrome.tabs.Tab & { cookieStoreId?: string };

export type { RouterDeps } from "@/background/message-router-types";

const respondUnexpectedError = (
  sendResponse: (response?: unknown) => void,
  error: unknown,
): void => {
  sendResponse({
    ok: false,
    error: error instanceof Error ? error.message : "Unexpected error",
  });
};

const fireAndRespond = <T>(
  sendResponse: (response?: unknown) => void,
  promise: Promise<T>,
  onError?: (error: unknown) => void,
): void => {
  fireAndForget(
    promise.then((response) => {
      sendResponse(response);
    }),
    onError,
  );
};

const getSenderTabId = (
  deps: Pick<RouterDeps, "isSupportedWebUrl">,
  sender: chrome.runtime.MessageSender,
  commandTabId?: number,
): number | undefined =>
  commandTabId ??
  (deps.isSupportedWebUrl(sender.tab?.url) ? sender.tab?.id : undefined);

const handleCoreCommand = (
  command: ExtensionCommand,
  deps: RouterDeps,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean => {
  switch (command.type) {
    case EXTENSION_COMMAND_TYPES.getControlState:
      fireAndRespond(sendResponse, deps.getControlState());
      return true;
    case EXTENSION_COMMAND_TYPES.getSettings:
      fireAndRespond(sendResponse, deps.getSettings());
      return true;
    case EXTENSION_COMMAND_TYPES.getPopupState:
      fireAndRespond(sendResponse, deps.getPopupState(command.tabId), (error) =>
        respondUnexpectedError(sendResponse, error),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.markNoticeRead:
      fireAndRespond(sendResponse, deps.markNoticeRead(command.id));
      return true;
    case EXTENSION_COMMAND_TYPES.markNoticesAutoPresented:
      fireAndRespond(sendResponse, deps.markNoticesAutoPresented(command.ids));
      return true;
    case EXTENSION_COMMAND_TYPES.resolvePopupNotification:
      fireAndRespond(sendResponse, deps.resolvePopupNotification(command.id));
      return true;
    case EXTENSION_COMMAND_TYPES.upsertTrustedSite:
      fireAndRespond(
        sendResponse,
        deps.upsertTrustedSite(command.hostname, command.tabId),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.setTrustedSiteEnabled:
      fireAndRespond(
        sendResponse,
        deps.setTrustedSiteEnabled(command.pattern, command.enabled, command.tabId),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.getUserScriptsStatus:
      fireAndRespond(sendResponse, deps.getUserScriptsStatus());
      return true;
    case EXTENSION_COMMAND_TYPES.requestFirefoxUserscriptsPermission:
      fireAndRespond(sendResponse, deps.requestUserScriptsAccess(command.tabId));
      return true;
    case EXTENSION_COMMAND_TYPES.assignDomainLocation:
      fireAndRespond(
        sendResponse,
        deps.assignDomainLocation(
          command.locationId,
          command.patternMode,
          getSenderTabId(deps, sender, command.tabId),
        ),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.updateCurrentRule:
      fireAndRespond(sendResponse, deps.updateCurrentRule(getUpdateRuleInput(command)));
      return true;
    case EXTENSION_COMMAND_TYPES.toggleCurrentRule:
      fireAndRespond(
        sendResponse,
        deps.toggleCurrentRule(command.enabled, command.tabId, command.hostname),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.deleteCurrentRule:
      fireAndRespond(
        sendResponse,
        deps.deleteCurrentRule(command.tabId, command.hostname),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.acceptPopupSuggestion:
      fireAndRespond(
        sendResponse,
        deps.applyPopupSuggestion(
          command.kind,
          command.tabId,
          command.hostname,
          command.sharedWorkerHandlingMode,
        ),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.applyPopupPolicyAction:
      fireAndRespond(
        sendResponse,
        deps.applyPopupPolicyAction(
          command.kind,
          command.tabId,
          command.hostname,
          command.sharedWorkerHandlingMode,
        ),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.dismissPopupSuggestion:
      fireAndRespond(
        sendResponse,
        deps.dismissPopupSuggestion(command.kind, command.tabId, command.hostname),
      );
      return true;
    default:
      return false;
  }
};

const handleSettingsCommand = (
  command: ExtensionCommand,
  deps: RouterDeps,
  sendResponse: (response?: unknown) => void,
): boolean => {
  switch (command.type) {
    case EXTENSION_COMMAND_TYPES.createLocationDraft:
      fireAndRespond(
        sendResponse,
        deps.createLocationDraft(command.query, command.randomizeWithinMeters),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.createDraftFromCandidate:
      fireAndRespond(
        sendResponse,
        deps.createDraftFromCandidate(command.candidate, command.randomizeWithinMeters),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.saveSimpleSettings:
      fireAndRespond(
        sendResponse,
        deps.saveSimpleSettings(command),
        (error: unknown) => {
          respondUnexpectedError(sendResponse, error);
        },
      );
      return true;
    case EXTENSION_COMMAND_TYPES.saveLocationModel:
      fireAndRespond(
        sendResponse,
        deps.saveLocationModel(command),
        (error: unknown) => {
          respondUnexpectedError(sendResponse, error);
        },
      );
      return true;
    case EXTENSION_COMMAND_TYPES.resetSettings:
      fireAndRespond(sendResponse, deps.resetSettings());
      return true;
    case EXTENSION_COMMAND_TYPES.exportSettings:
      fireAndRespond(sendResponse, deps.exportSettings());
      return true;
    case EXTENSION_COMMAND_TYPES.importSettings:
      fireAndRespond(sendResponse, deps.importSettings(command));
      return true;
    case EXTENSION_COMMAND_TYPES.setPanicMode:
      fireAndRespond(sendResponse, deps.setPanicMode(command.enabled));
      return true;
    default:
      return false;
  }
};

const handleXRayStateCommand = (
  command: ExtensionCommand,
  deps: RouterDeps,
  sendResponse: (response?: unknown) => void,
): boolean => {
  const parsed = XRayStateCommandSchema.safeParse(command);
  if (!parsed.success) {
    sendResponse({ ok: false, error: parsed.error.message });
    return true;
  }

  const tabId = parsed.data.tabId;
  if (tabId !== undefined) {
    fireAndForget(
      chrome.tabs
        .sendMessage(tabId, {
          type: EXTENSION_COMMAND_TYPES.requestSurfaceUsage,
        })
        .catch(() => undefined),
    );
  }

  fireAndRespond(sendResponse, deps.getXRayState(tabId));
  return true;
};

const handleSurfaceUsage = (
  command: ExtensionCommand,
  deps: RouterDeps,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean => {
  const parsed = UsageCommandSchema.safeParse(command);
  if (!parsed.success) {
    sendResponse({ ok: false, error: parsed.error.message });
    return true;
  }

  const tabId = sender.tab?.id;
  if (tabId !== undefined && parsed.data.categories.length > 0) {
    const frameId = typeof sender.frameId === "number" ? sender.frameId : 0;
    const sourceId = parsed.data.sourceId ?? "runtime";
    const sourceKey = `${frameId}:${sourceId}`;
    deps.recordSurfaceUsage({
      tabId,
      categories: parsed.data.categories,
      sourceKey,
      ...(parsed.data.counts ? { counts: parsed.data.counts } : {}),
      ...(parsed.data.methodCounts ? { methodCounts: parsed.data.methodCounts } : {}),
    });
    deps.refreshBadgeCount(tabId);
  }

  sendResponse({ ok: true });
  return true;
};

const recordErrorEvidence = ({
  deps,
  tabId,
  frameId,
  categories,
  evidence,
}: {
  deps: RouterDeps;
  tabId: number;
  frameId: number | undefined;
  categories: readonly XRaySurfaceCategory[];
  evidence: SurfaceErrorCommand["evidence"];
}): void => {
  if (!evidence) {
    // Legacy coarse boolean path (markSurfaceFailed) — no realm/axis detail.
    deps.recordSurfaceError(tabId, categories);
    return;
  }
  const observedAt = Date.now();
  for (const category of categories) {
    deps.recordSurfaceEvidence(tabId, category, {
      realmId: evidence.realmId,
      // frameId is taken from the trusted message sender, not the page payload.
      ...(frameId !== undefined ? { frameId: String(frameId) } : {}),
      ...(evidence.attemptId ? { attemptId: evidence.attemptId } : {}),
      ...(evidence.installation ? { installation: evidence.installation } : {}),
      ...(evidence.integrity ? { integrity: evidence.integrity } : {}),
      ...(evidence.reasonCode ? { reasonCode: evidence.reasonCode } : {}),
      observedAt,
    });
  }
};

const handleSurfaceError = (
  command: ExtensionCommand,
  deps: RouterDeps,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean => {
  const parsed = SurfaceErrorSchema.safeParse(command);
  if (!parsed.success) {
    sendResponse({ ok: false, error: parsed.error.message });
    return true;
  }

  const tabId = sender.tab?.id;
  if (tabId !== undefined && parsed.data.categories.length > 0) {
    recordErrorEvidence({
      deps,
      tabId,
      frameId: sender.frameId,
      categories: parsed.data.categories,
      evidence: parsed.data.evidence,
    });
  }

  sendResponse({ ok: true });
  return true;
};

const importPresetLocations = async (
  command: ImportLocationsCommand,
  deps: RouterDeps,
): Promise<ImportLocationsResponse> => {
  try {
    await deps.ensureStorageMigration();
    const requestedIds = new Set(command.locationIds);
    let radiusMeters = 0;
    if (command.randomizeWithinMeters !== false) {
      const requestedRadius =
        typeof command.randomizeWithinMeters === "number"
          ? command.randomizeWithinMeters
          : DEFAULT_RANDOM_RADIUS_KM * 1000;
      radiusMeters = Math.min(Math.max(requestedRadius, 1000), 99000);
    }
    const selectedLocations = EXAMPLE_LOCATIONS.filter((location) =>
      requestedIds.has(location.id),
    ).map((location) =>
      radiusMeters > 0 ? randomizeLocation(location, radiusMeters) : { ...location },
    );
    const currentLocations = await loadLocations();
    const nextById = new Map(
      currentLocations.map((location) => [location.id, location]),
    );

    for (const location of selectedLocations) {
      nextById.set(location.id, location);
    }

    const nextLocations = normalizeLocations([...nextById.values()]);
    await saveLocations(nextLocations);
    deps.setLastKnownProfiles(nextLocations);
    await deps.syncPreloadedState();
    await deps.resyncActiveHeaderRules();

    return {
      ok: true,
      locations: nextLocations,
      importedLocationIds: selectedLocations.map((location) => location.id),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Importing preset locations failed.",
    };
  }
};

const handleUtilityCommand = (
  command: ExtensionCommand,
  deps: RouterDeps,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean => {
  switch (command.type) {
    case EXTENSION_COMMAND_TYPES.loadSampleData:
      fireAndRespond(
        sendResponse,
        (async (): Promise<LoadSampleDataResponse> => {
          return importPresetLocations(
            {
              type: EXTENSION_COMMAND_TYPES.importPresetLocations,
              locationIds: [...EXAMPLE_LOCATION_IDS],
              randomizeWithinMeters: false,
            },
            deps,
          );
        })(),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.importPresetLocations:
      fireAndRespond(sendResponse, importPresetLocations(command, deps));
      return true;
    case EXTENSION_COMMAND_TYPES.cleanupDomainState:
      fireAndRespond(
        sendResponse,
        deps.handleCleanupDomainState(
          command.hostname,
          getSenderTabId(deps, sender, command.tabId),
          sender.tab?.url,
        ),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.getCleanupAssociations:
      fireAndRespond(
        sendResponse,
        deps.getCleanupAssociations(
          command.hostname,
          getSenderTabId(deps, sender, command.tabId),
          sender.tab?.url,
        ),
      );
      return true;
    case EXTENSION_COMMAND_TYPES.previewIdentityCleanup:
      fireAndRespond(sendResponse, deps.previewIdentityCleanup(command));
      return true;
    case EXTENSION_COMMAND_TYPES.rotateIdentityTarget:
      fireAndRespond(sendResponse, deps.rotateIdentity(command));
      return true;
    case EXTENSION_COMMAND_TYPES.getLogs:
      fireAndRespond(sendResponse, deps.getLogs());
      return true;
    case EXTENSION_COMMAND_TYPES.clearLogs:
      fireAndRespond(sendResponse, deps.clearLogs());
      return true;
    case EXTENSION_COMMAND_TYPES.firefoxTestConfigureResponseCookie:
      fireAndRespond(sendResponse, deps.configureFxTestCookie(command));
      return true;
    case EXTENSION_COMMAND_TYPES.getXRayState:
      return handleXRayStateCommand(command, deps, sendResponse);
    case EXTENSION_COMMAND_TYPES.surfaceUsage:
      return handleSurfaceUsage(command, deps, sender, sendResponse);
    case EXTENSION_COMMAND_TYPES.surfaceError:
      return handleSurfaceError(command, deps, sender, sendResponse);
    case EXTENSION_COMMAND_TYPES.sharedWorkerRewriteCandidate:
      if (sender.tab?.id !== undefined) {
        deps.recordRewriteCandidate({
          tabId: sender.tab.id,
          frameId: sender.frameId ?? 0,
          ...((sender.tab as TabWithCookieStore).cookieStoreId
            ? { cookieStoreId: (sender.tab as TabWithCookieStore).cookieStoreId }
            : {}),
          url: command.url,
          name: command.name,
          workerType: command.workerType,
          origin: command.origin,
        });
      }
      sendResponse({ ok: true });
      return true;
    default:
      return false;
  }
};

const recordRuntimeSuggestion = (
  command: Extract<ExtensionCommand, { type: typeof EXTENSION_COMMAND_TYPES.logEvent }>,
  deps: RouterDeps,
  sender: chrome.runtime.MessageSender,
): void => {
  if (command.event !== WORKER_CSP_BLOCKED_EVENT || !sender.tab?.url) {
    return;
  }

  if (!deps.isSupportedWebUrl(sender.tab.url)) {
    return;
  }

  fireAndForget(
    recordSuggestion(
      new URL(sender.tab.url).hostname,
      "worker-csp-relaxation",
      (sender.tab as chrome.tabs.Tab & { cookieStoreId?: string }).cookieStoreId,
    ),
  );
};

const handleLogEventCommand = (
  command: Extract<ExtensionCommand, { type: typeof EXTENSION_COMMAND_TYPES.logEvent }>,
  deps: RouterDeps,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): void => {
  recordRuntimeSuggestion(command, deps, sender);

  const debugMode = deps.getLastKnownDebugMode();
  if (debugMode || command.heartbeat) {
    const category = resolveLogCategory(command.event);

    logExtensionEvent({
      enabled: (debugMode ?? false) || !!command.heartbeat,
      category,
      event: command.event,
      payload: {
        ...(sender.tab?.id !== undefined ? { tabId: sender.tab.id } : {}),
        ...(sender.tab?.url ? { hostname: new URL(sender.tab.url).hostname } : {}),
        ...(command.details
          ? { details: command.details as Record<string, unknown> | unknown[] }
          : {}),
      },
      level: normalizeLogLevel(command.level),
    });
  }

  fireAndRespond(
    sendResponse,
    waitForExtensionLogQueue().then(() => ({ ok: true })),
  );
};

const handleResolveSnapshot = (
  command: Extract<
    ExtensionCommand,
    { type: typeof EXTENSION_COMMAND_TYPES.resolveRuntimeSnapshot }
  >,
  deps: RouterDeps,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean => {
  const tabId = sender.tab?.id;
  const frameId = sender.frameId ?? 0;
  const senderCookieStoreId = (sender.tab as TabWithCookieStore | undefined)
    ?.cookieStoreId;
  const cachedSnapshot =
    tabId !== undefined
      ? deps.readSnapshotCache(tabId, frameId, command.hostname, senderCookieStoreId)
      : undefined;

  if (tabId !== undefined && frameId === 0 && command.hostname !== "") {
    fireAndForget(
      deps.upsertTabContext(tabId, {
        tabId,
        hostname: command.hostname,
        ...(senderCookieStoreId ? { cookieStoreId: senderCookieStoreId } : {}),
      }),
    );
  }

  if (cachedSnapshot !== undefined) {
    sendResponse({
      ok: true,
      snapshot: cachedSnapshot,
    } satisfies ResolveSnapshotResponse);
    return false;
  }

  fireAndRespond(
    sendResponse,
    deps
      .handleResolveSnapshot(
        command,
        senderCookieStoreId,
        sender.tab?.id,
        sender.frameId,
      )
      .then((response) => {
        if (tabId !== undefined) {
          deps.updateSnapshotCache({
            tabId,
            frameId,
            hostname: command.hostname,
            value: response.snapshot,
            ...(senderCookieStoreId ? { cookieStoreId: senderCookieStoreId } : {}),
          });
        }

        return response;
      }),
  );

  return true;
};

export const registerMessageRouter = (deps: RouterDeps): void => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const command = message as ExtensionCommand | undefined;
    if (!command?.type) {
      return false;
    }

    if (handleCoreCommand(command, deps, sender, sendResponse)) {
      return true;
    }

    if (handleSettingsCommand(command, deps, sendResponse)) {
      return true;
    }

    if (handleUtilityCommand(command, deps, sender, sendResponse)) {
      return true;
    }

    if (command.type === EXTENSION_COMMAND_TYPES.logEvent) {
      handleLogEventCommand(command, deps, sender, sendResponse);
      return true;
    }

    if (command.type !== EXTENSION_COMMAND_TYPES.resolveRuntimeSnapshot) {
      return false;
    }

    return handleResolveSnapshot(command, deps, sender, sendResponse);
  });
};
