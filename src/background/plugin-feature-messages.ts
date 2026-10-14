import {
  createFeatureController,
  isFeatureCommand,
} from "@/background/provider-features";
import { fireAndForget } from "@/shared/async";
import type { FeaturePlugin } from "@/shared/plugin";

/** Route generic feature commands. Plugins keep their own command listeners. */
export const registerFeatureMessages = (
  plugins: readonly FeaturePlugin[],
): (() => void) => {
  const features = createFeatureController(plugins);
  const onMessage: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (
    message,
    sender,
    sendResponse,
  ) => {
    if (
      sender.id !== chrome.runtime.id ||
      !sender.url?.startsWith(chrome.runtime.getURL("/"))
    )
      return false;
    if (!isFeatureCommand(message)) return false;
    fireAndForget(features.respond(message).then(sendResponse), (error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Plugin operation failed.",
      }),
    );
    return true;
  };
  chrome.runtime.onMessage.addListener(onMessage);
  return () => {
    chrome.runtime.onMessage.removeListener(onMessage);
  };
};
