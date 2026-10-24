import type {
  AnalystTraps,
  XRayLiveCoverage,
  XRayLiveReason,
} from "@privacy-brand/xray-protocol";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { CMD_XRAY_INSPECTOR_LIVE } from "@/shared/extension-contract";
import {
  isLiveFrameResult,
  type InspectorLiveFrameResult,
  type InspectorLiveMessage,
} from "@/shared/inspector-live-contract";

let lastRevision = 0;

const NO_CHANNEL: InspectorLiveFrameResult = {
  appliedVia: "not-live",
  reason: "no-channel",
  endpoints: 0,
};

const sendToFrame = async (
  tabId: number,
  frame: { frameId: number; documentId?: string },
  message: InspectorLiveMessage,
): Promise<InspectorLiveFrameResult> => {
  // A document ID pins the message to the document that was enumerated.
  const target =
    BUILD_BROWSER_TARGET === "chromium" && frame.documentId
      ? { documentId: frame.documentId }
      : { frameId: frame.frameId };
  try {
    const result: unknown = await chrome.tabs.sendMessage(tabId, message, target);
    return isLiveFrameResult(result) ? result : NO_CHANNEL;
  } catch {
    return NO_CHANNEL;
  }
};

/** about:blank and javascript: realms belong to their parent runtime. */
const hasOwnRuntime = (url: string): boolean =>
  !/^about:blank(?:[?#]|$)/.test(url) && !/^javascript:/i.test(url);

export type InspectorLiveResult = {
  top: boolean;
  coverage: XRayLiveCoverage;
};

/** Sends one trap binding to every document of the tab that owns a runtime. */
export const applyInspectorLive = async (
  tabId: number,
  traps: AnalystTraps | null,
): Promise<InspectorLiveResult> => {
  lastRevision = Math.max(Date.now(), lastRevision + 1);
  const message: InspectorLiveMessage = {
    type: CMD_XRAY_INSPECTOR_LIVE,
    command: {
      r: lastRevision,
      m: traps?.methods ?? null,
      e: traps?.mode === "every-call",
    },
  };
  const frames =
    (await chrome.webNavigation.getAllFrames({ tabId }).catch(() => null)) ?? [];
  const results = await Promise.all(
    frames
      .filter((frame) => hasOwnRuntime(frame.url))
      .map(async (frame) => ({
        frameId: frame.frameId,
        result: await sendToFrame(tabId, frame, message),
      })),
  );
  const reasons = new Set<XRayLiveReason>();
  let live = 0;
  for (const { result } of results) {
    if (result.appliedVia === "live") live += 1;
    else reasons.add(result.reason);
  }
  return {
    top: results.some(
      ({ frameId, result }) => frameId === 0 && result.appliedVia === "live",
    ),
    coverage: { live, notLive: results.length - live, reasons: [...reasons].sort() },
  };
};

/** Whether the tab's top document accepts live updates right now. */
export const probeInspectorLive = async (tabId: number): Promise<boolean> => {
  const message: InspectorLiveMessage = {
    type: CMD_XRAY_INSPECTOR_LIVE,
    command: null,
  };
  return (await sendToFrame(tabId, { frameId: 0 }, message)).appliedVia === "live";
};
