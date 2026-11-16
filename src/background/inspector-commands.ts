import {
  CMD_XRAY_GET_INSPECTOR_STATE,
  CMD_XRAY_SET_INSPECTOR,
  XRayInspectorCommandSchema,
  AnalystTrapsSchema,
  type AnalystTraps,
  type XRayInspectorApplyResult,
  type XRayInspectorState,
} from "@privacy-brand/xray-protocol";

import type { InspectorLiveResult } from "@/background/inspector-live";
import { inspectorState, withInspector } from "@/background/inspector-state";
import type { ResolutionDecision } from "@/background/prepared-runtime-decisions";
import { withConfigurationLock } from "@/background/settings-import-transaction";
import {
  getHostPauseStatus,
  initializeHostPauses,
} from "@/background/storage/host-protection-pauses";
import {
  initializeInspectors,
  recordInspectorDocument,
  recordLiveInspector,
  storeInspector,
} from "@/background/storage/inspector-sessions";
import type { EffectiveTabContext } from "@/shared/types";

type InspectorDeps = {
  resolveRuntimeDecision: (
    hostname: string,
    cookieStoreId?: string,
  ) => Promise<ResolutionDecision>;
  prepare: (
    context: EffectiveTabContext,
    decision: ResolutionDecision,
  ) => Promise<void>;
  invalidate: (tabId: number) => void;
  publish: (tabId: number) => void;
  applyLive: (
    tabId: number,
    traps: AnalystTraps | null,
  ) => Promise<InspectorLiveResult>;
  probeLive: (tabId: number) => Promise<boolean>;
};

const supportedTab = async (tabId: number) => {
  const tab = (await chrome.tabs.get(tabId)) as chrome.tabs.Tab & {
    cookieStoreId?: string;
  };
  if (!tab.url || !/^https?:/.test(tab.url)) return null;
  return {
    tabId,
    hostname: new URL(tab.url).hostname,
    ...(tab.cookieStoreId ? { cookieStoreId: tab.cookieStoreId } : {}),
  };
};

const isPaused = (hostname: string, tabId: number): boolean => {
  const pause = getHostPauseStatus(hostname, tabId);
  return Boolean(pause.pause || pause.reloadRequired || pause.workerTest);
};

/**
 * A document restored from the back/forward cache kept the selection it had
 * when it was hidden; the tab's selection may have changed or ended since.
 * Give the restored documents what a new load of them would get.
 */
const restoreInspector = (
  deps: InspectorDeps,
  sender: chrome.runtime.MessageSender,
): Promise<void> =>
  withConfigurationLock(async () => {
    const tabId = sender.tab?.id;
    if (sender.id !== chrome.runtime.id || tabId === undefined || sender.frameId !== 0)
      throw new Error("A restored top document is required.");
    await Promise.all([initializeInspectors(), initializeHostPauses()]);
    const context = await supportedTab(tabId);
    if (!context || !sender.url || new URL(sender.url).hostname !== context.hostname)
      return;
    const { hostname } = context;
    const decision = await deps.resolveRuntimeDecision(hostname, context.cookieStoreId);
    const traps = isPaused(hostname, tabId)
      ? null
      : (withInspector(tabId, hostname, decision).snapshot?.analystTraps ?? null);
    const live = await deps.applyLive(tabId, traps);
    // Documents the update could not reach keep an unknown selection.
    if (live.coverage.notLive === 0) await recordLiveInspector(tabId, hostname);
    else await recordInspectorDocument(tabId, hostname, null);
    deps.publish(tabId);
  });

export const createInspectorHandlers = (deps: InspectorDeps) => {
  const resolve = async (tabId: number) => {
    await Promise.all([initializeInspectors(), initializeHostPauses()]);
    const context = await supportedTab(tabId);
    if (!context) return null;
    const decision = await deps.resolveRuntimeDecision(
      context.hostname,
      context.cookieStoreId,
    );
    const paused = isPaused(context.hostname, tabId);
    const appliesLive =
      !paused && decision.snapshot !== null && (await deps.probeLive(tabId));
    return {
      context,
      decision,
      state: inspectorState(tabId, context.hostname, decision, { paused, appliesLive }),
    };
  };
  const getInspectorState = async (tabId: number): Promise<XRayInspectorState> =>
    (await resolve(tabId))?.state ?? {
      available: false,
      unavailableReason: "unsupported-url",
      armed: false,
      methodIds: [],
      mode: "first-call",
      pendingReload: false,
      appliesLive: false,
      trappableMethodIds: [],
    };

  const validate = async (tabId: number, desired: AnalystTraps | null) => {
    const current = await resolve(tabId);
    if (!current || (desired && !current.state.available))
      throw new Error("Inspector is unavailable for this document.");
    if (
      desired?.methods.some(
        (method) => !current.state.trappableMethodIds.includes(method),
      )
    )
      throw new Error("A selected method is not spoofed in this document.");
    return current;
  };

  /** Seeds the top document right before the reload, like a host pause. */
  const reloadSeeded = async (
    current: NonNullable<Awaited<ReturnType<typeof resolve>>>,
  ): Promise<void> => {
    const { tabId, hostname } = current.context;
    await deps.prepare(
      current.context,
      withInspector(tabId, hostname, current.decision),
    );
    if ((await supportedTab(tabId))?.hostname !== hostname)
      throw new Error("The tab navigated while applying Inspector.");
    await chrome.tabs.reload(tabId);
  };

  const applyInspectorState = (
    tabId: number,
    desired: AnalystTraps | null,
    apply: "now" | "next-load",
  ): Promise<XRayInspectorApplyResult> =>
    withConfigurationLock(async () => {
      if (desired) desired = AnalystTrapsSchema.parse(desired);
      if (apply !== "now" && apply !== "next-load")
        throw new Error("Invalid Inspector apply mode.");
      const current = await validate(tabId, desired);
      const { hostname } = current.context;
      await storeInspector(tabId, hostname, desired);
      // New frames and documents of this tab now resolve the selection.
      deps.invalidate(tabId);
      // Live first: it writes nothing into the documents. Reload is the fallback.
      // A next-load selection is resolved when the tab next navigates.
      const live = apply === "now" ? await deps.applyLive(tabId, desired) : undefined;
      if (live && !live.top) await reloadSeeded(current);
      else if (live?.coverage.notLive === 0) await recordLiveInspector(tabId, hostname);
      deps.publish(tabId);
      let appliedVia: XRayInspectorApplyResult["appliedVia"] = "next-load";
      if (live) appliedVia = live.top ? "live" : "reload";
      return {
        state: (await resolve(tabId))!.state,
        appliedVia,
        ...(live ? { liveCoverage: live.coverage } : {}),
      };
    });

  const inspectorCommand = async (
    message: unknown,
    sender: chrome.runtime.MessageSender,
  ) => {
    // Inspector commands belong to extension pages, including the sidebar.
    const root = chrome.runtime.getURL("");
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(root))
      throw new Error("An extension page is required.");
    const command = XRayInspectorCommandSchema.parse(message);
    if (command.type === CMD_XRAY_GET_INSPECTOR_STATE)
      return getInspectorState(command.tabId);
    const desired =
      command.type === CMD_XRAY_SET_INSPECTOR
        ? { methods: [...new Set(command.methodIds)], mode: command.mode }
        : null;
    return applyInspectorState(command.tabId, desired, command.apply);
  };
  return {
    getInspectorState,
    applyInspectorState,
    inspectorCommand,
    restoreInspector: (sender: chrome.runtime.MessageSender) =>
      restoreInspector(deps, sender),
  };
};
