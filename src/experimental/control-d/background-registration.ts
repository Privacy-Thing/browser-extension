import { isControlDCommand, type ControlDCommand } from "./contracts";
import { ensureControlDRecognition } from "./recognition-setup";
import { loadControlDConfig, CONTROL_D_STORE_KEYS } from "./storage";

import { fireAndForget } from "@/shared/async";
import type { PluginHooks } from "@/shared/plugin-hooks";
import { FEATURE_EVENTS } from "@/shared/provider-feature";

export const registerControllers = (
  controller: {
    respond: (command: ControlDCommand) => Promise<unknown>;
    scheduleAutomatic: () => void;
  },
  hooks: PluginHooks,
): (() => void) => {
  const prepareMatching = async () => {
    const config = await loadControlDConfig();
    if (config.enabled && config.connected) await ensureControlDRecognition();
  };
  fireAndForget(prepareMatching());
  fireAndForget(
    loadControlDConfig().then((config) => {
      if (
        config.enabled &&
        config.connected &&
        config.autoSyncEnabled &&
        config.lastSyncedHash
      )
        controller.scheduleAutomatic();
    }),
  );
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
    if (!isControlDCommand(message)) return false;
    fireAndForget(controller.respond(message).then(sendResponse), (error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Plugin operation failed.",
      }),
    );
    return true;
  };
  chrome.runtime.onMessage.addListener(onMessage);
  const onPluginStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName === "local" && CONTROL_D_STORE_KEYS[0] in changes) {
      fireAndForget(prepareMatching());
      fireAndForget(
        chrome.runtime.sendMessage({
          type: FEATURE_EVENTS.stateChanged,
          providerId: "control-d",
        }),
      );
    }
  };
  chrome.storage.onChanged.addListener(onPluginStorageChanged);
  const unsubscribe = hooks.onConfigurationChanged(
    ["rules", "locations", "featureBindings"],
    () => controller.scheduleAutomatic(),
  );
  return () => {
    unsubscribe();
    chrome.runtime.onMessage.removeListener(onMessage);
    chrome.storage.onChanged.removeListener(onPluginStorageChanged);
  };
};
