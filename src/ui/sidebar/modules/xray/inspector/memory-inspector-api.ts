import type {
  XRayInspectorApply,
  XRayInspectorAppliedVia,
  XRayInspectorApplyResult,
  XRayInspectorState,
  XRayLiveCoverage,
} from "@privacy-brand/xray-protocol";

import type { InspectorApi } from "./inspector-api";

export type MemoryInspectorCall =
  | { kind: "get"; tabId: number }
  | {
      kind: "set";
      tabId: number;
      methodIds: readonly string[];
      mode: XRayInspectorState["mode"];
      apply: XRayInspectorApply;
    }
  | { kind: "clear"; tabId: number; apply: XRayInspectorApply }
  | { kind: "reload"; tabId: number };

export interface MemoryInspectorApi extends InspectorApi {
  readonly calls: readonly MemoryInspectorCall[];
  readonly state: XRayInspectorState;
}

export interface MemoryInspectorOptions {
  /** Reject every set/clear command with this message. */
  failWith?: string;
  /** Leave set/clear commands pending forever, to show the in-flight state. */
  holdCommands?: boolean;
  /** Coverage reported by live updates; documents it misses stay pending. */
  liveCoverage?: XRayLiveCoverage;
}

const appliedVia = (
  apply: XRayInspectorApply,
  appliesLive: boolean,
): XRayInspectorAppliedVia => {
  if (apply === "next-load") return "next-load";
  return appliesLive ? "live" : "reload";
};

/**
 * In-memory Inspector backend for Storybook and tests. It follows the contract
 * of the background implementation: commands applied "now" take effect
 * immediately (live or through a reload), "next-load" leaves `pendingReload`.
 */
export const createMemoryInspectorApi = (
  initialState: XRayInspectorState,
  options: MemoryInspectorOptions = {},
): MemoryInspectorApi => {
  let state = initialState;
  const calls: MemoryInspectorCall[] = [];

  const commit = (
    next: XRayInspectorState,
    apply: XRayInspectorApply,
  ): Promise<XRayInspectorApplyResult> => {
    if (options.holdCommands) return new Promise(() => undefined);
    if (options.failWith !== undefined) {
      return Promise.reject(new Error(options.failWith));
    }
    const via = appliedVia(apply, state.appliesLive);
    const coverage =
      via === "live"
        ? (options.liveCoverage ?? { live: 1, notLive: 0, reasons: [] })
        : undefined;
    state = {
      ...next,
      pendingReload: apply === "next-load" || (coverage?.notLive ?? 0) > 0,
    };
    return Promise.resolve({
      state,
      appliedVia: via,
      ...(coverage ? { liveCoverage: coverage } : {}),
    });
  };

  return {
    calls,
    get state() {
      return state;
    },
    get: (tabId) => {
      calls.push({ kind: "get", tabId });
      return Promise.resolve(state);
    },
    set: ({ tabId, methodIds, mode, apply }) => {
      calls.push({ kind: "set", tabId, methodIds: [...methodIds], mode, apply });
      return commit({ ...state, armed: true, methodIds: [...methodIds], mode }, apply);
    },
    clear: ({ tabId, apply }) => {
      calls.push({ kind: "clear", tabId, apply });
      return commit({ ...state, armed: false, methodIds: [] }, apply);
    },
    reload: (tabId) => {
      calls.push({ kind: "reload", tabId });
      state = { ...state, pendingReload: false };
      return Promise.resolve();
    },
  };
};
