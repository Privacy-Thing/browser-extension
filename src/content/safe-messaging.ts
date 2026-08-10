import { fireAndForget } from "@/shared/async";

/**
 * Returns whether the extension context is still live for this content script.
 *
 * After the extension is reloaded/updated while a page stays open, the content
 * script is orphaned: `chrome.runtime.id` becomes `undefined` and any
 * `chrome.runtime.*` call throws synchronously with "Extension context
 * invalidated.". Reading `chrome.runtime.id` is itself guarded because property
 * access can throw in the invalidated state on some channels.
 */
export const isExtensionContextValid = (): boolean => {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
};

/**
 * Sends a runtime message, tolerating an invalidated extension context.
 *
 * `chrome.runtime.sendMessage` throws *synchronously* once the context is
 * invalidated — before a promise exists — so `fireAndForget` (which only
 * catches async rejections) cannot absorb it. Page-event-driven relays and the
 * heartbeat interval keep firing on an orphaned content script, so each call
 * would otherwise surface as an uncaught "Extension context invalidated." error
 * on the page. This guards the context first and swallows the synchronous throw.
 *
 * Returns `true` when the message was dispatched, `false` when the context is
 * gone — letting callers tear down listeners/intervals that can no longer reach
 * the background.
 */
export const safeSendMessage = (message: unknown): boolean => {
  try {
    if (typeof chrome === "undefined") {
      return false;
    }
    const runtime = chrome.runtime;
    if (!runtime?.id || !runtime.sendMessage) {
      return false;
    }
    fireAndForget(runtime.sendMessage(message));
    return true;
  } catch {
    // Context invalidated between the guard check and the call.
    return false;
  }
};

export const safeSendForResponse = async <TResponse>(
  message: unknown,
): Promise<TResponse | null> => {
  try {
    if (typeof chrome === "undefined") {
      return null;
    }
    const runtime = chrome.runtime;
    if (!runtime?.id || !runtime.sendMessage) {
      return null;
    }
    return (await runtime.sendMessage(message)) as TResponse;
  } catch {
    return null;
  }
};
