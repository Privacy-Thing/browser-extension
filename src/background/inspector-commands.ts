import {
  CMD_XRAY_GET_INSPECTOR_STATE,
  CMD_XRAY_SET_INSPECTOR,
  XRayInspectorCommandSchema,
  AnalystTrapsSchema,
  type AnalystTraps,
  type XRayInspectorApplyResult,
  type XRayInspectorState,
} from "@privacy-brand/xray-protocol";

import { inspectorState, withInspector } from "@/background/inspector-state";
import type { ResolutionDecision } from "@/background/prepared-runtime-decisions";
import { withConfigurationLock } from "@/background/settings-import-transaction";
import {
  getHostPauseStatus,
  initializeHostPauses,
} from "@/background/storage/host-protection-pauses";
import {
  initializeInspectors,
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

export const createInspectorHandlers = (deps: InspectorDeps) => {
  const resolve = async (tabId: number) => {
    await Promise.all([initializeInspectors(), initializeHostPauses()]);
    const context = await supportedTab(tabId);
    if (!context) return null;
    const decision = await deps.resolveRuntimeDecision(
      context.hostname,
      context.cookieStoreId,
    );
    const pause = getHostPauseStatus(context.hostname, tabId);
    return {
      context,
      decision,
      state: inspectorState(
        tabId,
        context.hostname,
        decision,
        Boolean(pause.pause || pause.reloadRequired || pause.workerTest),
      ),
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

  const applyInspectorState = (
    tabId: number,
    desired: AnalystTraps | null,
    apply: "now" | "next-load",
  ): Promise<XRayInspectorApplyResult> =>
    withConfigurationLock(async () => {
      if (desired) desired = AnalystTrapsSchema.parse(desired);
      if (apply !== "now" && apply !== "next-load")
        throw new Error("Invalid Inspector apply mode.");
      const current = await resolve(tabId);
      if (!current || (desired && !current.state.available))
        throw new Error("Inspector is unavailable for this document.");
      if (
        desired?.methods.some(
          (method) => !current.state.trappableMethodIds.includes(method),
        )
      )
        throw new Error("A selected method is not spoofed in this document.");
      await storeInspector(tabId, current.context.hostname, desired);
      deps.invalidate(tabId);
      const decision = withInspector(tabId, current.context.hostname, current.decision);
      // Seed even for next-load: window.name survives the next unload, while the
      // active runtime keeps its original activation until a new document loads.
      await deps.prepare(current.context, decision);
      if (apply === "now") {
        const live = await supportedTab(tabId);
        if (live?.hostname !== current.context.hostname)
          throw new Error("The tab navigated while applying Inspector.");
        await chrome.tabs.reload(tabId);
      }
      deps.publish(tabId);
      return {
        state: (await resolve(tabId))!.state,
        appliedVia: apply === "now" ? "reload" : "next-load",
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
  return { getInspectorState, applyInspectorState, inspectorCommand };
};
