import type {
  AnalystTraps,
  XRayLiveCoverage,
  XRayLiveReason,
} from "@privacy-brand/xray-protocol";

import { fireAndForget } from "@/shared/async";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  CMD_XRAY_INSPECTOR_LIVE,
  EXTENSION_STORAGE_KEYS,
} from "@/shared/extension-contract";
import {
  isLiveFrameResult,
  type InspectorLiveFrameResult,
  type InspectorLiveMessage,
} from "@/shared/inspector-live-contract";

const OPENED_KEY = EXTENSION_STORAGE_KEYS.inspectorOpenedTabs;
/**
 * Tabs created by `window.open` or `target=_blank`, keyed by tab ID. The value
 * records whether the opened document committed; its opener may reach that
 * first document before the runtime, so it never takes live updates. The mark
 * ends with the next top-level document of the tab.
 */
let opened: Record<string, boolean> = {};
let loading: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();
let lastRevision = 0;

const loadOpened = (): Promise<void> => {
  loading ??= chrome.storage.session
    .get(OPENED_KEY)
    .then((stored) => {
      const value: unknown = stored[OPENED_KEY];
      opened =
        typeof value === "object" && value !== null
          ? { ...(value as Record<string, boolean>) }
          : {};
    })
    .catch(() => {
      loading = undefined;
    });
  return loading;
};

const updateOpened = (tabId: number, update: (seen: boolean | undefined) => void) => {
  const next = queue.then(async () => {
    await loadOpened();
    const before = JSON.stringify(opened);
    update(opened[String(tabId)]);
    if (JSON.stringify(opened) !== before)
      await chrome.storage.session.set({ [OPENED_KEY]: opened });
  });
  queue = next.catch(() => undefined);
  fireAndForget(next);
};

export const trackOpenedTabs = (): void => {
  chrome.webNavigation.onCreatedNavigationTarget.addListener(({ tabId }) =>
    updateOpened(tabId, () => {
      opened[String(tabId)] = false;
    }),
  );
  chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
    if (frameId !== 0) return;
    updateOpened(tabId, (seen) => {
      if (seen === false) opened[String(tabId)] = true;
      else delete opened[String(tabId)];
    });
  });
  chrome.tabs.onRemoved.addListener((tabId) =>
    updateOpened(tabId, () => {
      delete opened[String(tabId)];
    }),
  );
};

const isOpened = async (tabId: number): Promise<boolean> => {
  await queue;
  await loadOpened();
  return Object.hasOwn(opened, String(tabId));
};

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
  /^https?:/.test(url) || url === "about:srcdoc";

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
    opened: await isOpened(tabId),
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
    opened: await isOpened(tabId),
    command: null,
  };
  return (await sendToFrame(tabId, { frameId: 0 }, message)).appliedVia === "live";
};
