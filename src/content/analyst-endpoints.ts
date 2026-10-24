import type { XRayLiveReason } from "@privacy-brand/xray-protocol";

import {
  isInspectorLiveMessage,
  type InspectorLiveCommand,
  type InspectorLiveFrameResult,
} from "@/shared/inspector-live-contract";

/**
 * Isolated half of the X-Ray Inspector trap channel. It must be installed by the
 * first module of the static isolated bootstrap: each MAIN bundle hands over its
 * detached endpoint element with one handshake on `document` while the document
 * is still loading, and this listener has to be the first to see it.
 *
 * The handshake listeners live only while no page code can: they are removed
 * once both bundles have handed over, when the document_start task ends, or at
 * the first handshake that arrives later. Only a handshake accepted before any
 * page script exists is hidden from other listeners. Commands are dispatched on
 * the endpoint element only; nothing is dispatched on `document` or `window`.
 */
const HANDOFF_TYPES = [__PT_ANALYST_HANDOFF_EARLY__, __PT_ANALYST_HANDOFF_RUNTIME__];
const endpoints = new Map<string, Element>();
const refused = new Set<string>();
let acknowledgement = "";
let blocked: XRayLiveReason | null = null;

const pageScriptsMayHaveRun = (): boolean => {
  if (document.readyState !== "loading") return true;
  for (const script of Array.from(document.scripts)) {
    // The runtime's own DOM handoff is inert JSON, never page code.
    if (script.type.trim().toLowerCase() !== "application/json") return true;
  }
  return false;
};

const closeRegistry = (): void => {
  for (const type of HANDOFF_TYPES)
    document.removeEventListener(type, acceptEndpoint, true);
};

function acceptEndpoint(event: Event): void {
  // A bundle evaluated twice keeps its first endpoint.
  if (endpoints.has(event.type)) return;
  const node = (event as MouseEvent).relatedTarget;
  if (
    pageScriptsMayHaveRun() ||
    !(node instanceof Element) ||
    node.isConnected ||
    node.ownerDocument !== document
  ) {
    // Page code may exist: leave the event alone and stop listening.
    refused.add(event.type);
    closeRegistry();
    return;
  }
  // No page script exists yet, so no page listener can miss this event.
  event.stopImmediatePropagation();
  endpoints.set(event.type, node);
  node.addEventListener(__PT_ANALYST_ACK__, (ack) => {
    acknowledgement = String((ack as CustomEvent<unknown>).detail);
  });
  if (endpoints.size === HANDOFF_TYPES.length) closeRegistry();
}

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

/** The opener of this tab's top document can reach it before its runtime. */
const hasOpener = (): boolean => {
  try {
    return window.top?.opener != null;
  } catch {
    return true;
  }
};

/** The early bundle the bootstrap injects after page scripts cannot hand over in time. */
export const markLateEarlyBundle = (): void => {
  if (!endpoints.has(__PT_ANALYST_HANDOFF_EARLY__))
    refused.add(__PT_ANALYST_HANDOFF_EARLY__);
};

const blockedReason = (): XRayLiveReason | null => {
  if (blocked) return blocked;
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
  const reason = blockedReason();
  if (reason) return { appliedVia: "not-live", reason, endpoints: endpoints.size };
  if (message.command && !sendCommand(message.command))
    return { appliedVia: "not-live", reason: "no-channel", endpoints: endpoints.size };
  return { appliedVia: "live", endpoints: endpoints.size };
};

/**
 * Opens the endpoint registry for this document. Documents that another page can
 * reach before their runtime never take live updates, so they get no listener.
 */
export const installAnalystEndpoints = (): void => {
  if (hasOpener()) blocked = "opened-window";
  else if (hasSameOriginAncestor()) blocked = "same-origin-frame";
  else {
    for (const type of HANDOFF_TYPES)
      document.addEventListener(type, acceptEndpoint, true);
    setTimeout(closeRegistry, 0);
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = applyLiveMessage(message, sender);
    if (result) sendResponse(result);
    return false;
  });
};
