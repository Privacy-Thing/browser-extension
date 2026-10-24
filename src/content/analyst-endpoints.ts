import type { XRayLiveReason } from "@privacy-brand/xray-protocol";

import {
  isInspectorLiveMessage,
  type InspectorLiveCommand,
  type InspectorLiveFrameResult,
} from "@/shared/inspector-live-contract";

/**
 * Isolated half of the X-Ray Inspector trap channel. It must be the first
 * module of the static isolated bootstrap: each MAIN bundle hands over its
 * detached endpoint element with one handshake on `document` while the
 * document is still loading, and this listener has to be the first to see it.
 *
 * At most one endpoint per bundle is accepted, and only before any executable
 * page script exists. Commands are dispatched on the endpoint element only;
 * nothing is dispatched on `document` or `window`.
 */
const HANDOFF_TYPES = [__PT_ANALYST_HANDOFF_EARLY__, __PT_ANALYST_HANDOFF_RUNTIME__];
const endpoints = new Map<string, Element>();
const refused = new Set<string>();
let acknowledgement = "";

const pageScriptsMayHaveRun = (): boolean => {
  if (document.readyState !== "loading") return true;
  for (const script of Array.from(document.scripts)) {
    // The runtime's own DOM handoff is inert JSON, never page code.
    if (script.type.trim().toLowerCase() !== "application/json") return true;
  }
  return false;
};

const acceptEndpoint = (event: Event): void => {
  event.stopImmediatePropagation();
  if (endpoints.has(event.type)) return;
  const node = (event as MouseEvent).relatedTarget;
  if (
    pageScriptsMayHaveRun() ||
    !(node instanceof Element) ||
    node.isConnected ||
    node.ownerDocument !== document
  ) {
    refused.add(event.type);
    return;
  }
  endpoints.set(event.type, node);
  node.addEventListener(__PT_ANALYST_ACK__, (ack) => {
    acknowledgement = String((ack as CustomEvent<unknown>).detail);
  });
};

for (const type of HANDOFF_TYPES) document.addEventListener(type, acceptEndpoint, true);

/** A same-origin ancestor can reach this document's window before its runtime. */
const hasSameOriginAncestor = (): boolean => {
  let current: Window = window;
  while (current !== current.top) {
    const parent: Window = current.parent;
    try {
      return typeof parent.location.origin === "string";
    } catch {
      current = parent;
    }
  }
  return false;
};

const blockedReason = (opened: boolean): XRayLiveReason | null => {
  if (opened) return "opened-window";
  if (hasSameOriginAncestor()) return "same-origin-frame";
  if (refused.size > 0) return "late-runtime";
  return endpoints.size === 0 ? "no-channel" : null;
};

const sendCommand = (command: InspectorLiveCommand): boolean => {
  const detail = JSON.stringify({ r: command.r, m: command.m, e: command.e });
  for (const node of endpoints.values()) {
    acknowledgement = "";
    node.dispatchEvent(new CustomEvent(__PT_ANALYST_CMD__, { detail }));
    if (acknowledgement !== String(command.r)) return false;
  }
  return true;
};

export const applyLiveMessage = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
): InspectorLiveFrameResult | null => {
  // Only the background sends these; content scripts of other frames carry a tab.
  if (sender.id !== chrome.runtime.id || sender.tab || !isInspectorLiveMessage(message))
    return null;
  const reason = blockedReason(message.opened);
  if (reason) return { appliedVia: "not-live", reason, endpoints: endpoints.size };
  if (message.command && !sendCommand(message.command))
    return { appliedVia: "not-live", reason: "no-channel", endpoints: endpoints.size };
  return { appliedVia: "live", endpoints: endpoints.size };
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const result = applyLiveMessage(message, sender);
  if (result) sendResponse(result);
  return false;
});
