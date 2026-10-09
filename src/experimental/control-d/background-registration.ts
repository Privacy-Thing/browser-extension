import { isControlDCommand, type ControlDCommand } from "./contracts";
import { createControlDProvider } from "./feature-provider";
import { ensureControlDRecognition } from "./recognition-setup";
import { loadControlDConfig, CONTROL_D_STORE_KEYS } from "./storage";

import {
  createFeatureController,
  isFeatureCommand,
} from "@/background/provider-features";
import { LOCATIONS_STORAGE_KEY } from "@/background/storage/locations";
import { FEATURE_STORAGE_KEY } from "@/background/storage/provider-features";
import { RULES_STORAGE_KEY } from "@/background/storage/rules";
import { fireAndForget } from "@/shared/async";
import { FEATURE_EVENTS } from "@/shared/provider-feature";

export const registerControllers = (controller: {
  respond: (command: ControlDCommand) => Promise<unknown>;
  scheduleAutomatic: () => void;
}): void => {
  const prepareMatching = async () => {
    const config = await loadControlDConfig();
    if (config.enabled && config.connected) await ensureControlDRecognition();
  };
  const features = createFeatureController([createControlDProvider()]);
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
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      sender.id !== chrome.runtime.id ||
      !sender.url?.startsWith(chrome.runtime.getURL("/"))
    )
      return false;
    let result: Promise<unknown> | null = null;
    if (isFeatureCommand(message)) result = features.respond(message);
    else if (isControlDCommand(message)) result = controller.respond(message);
    if (!result) return false;
    fireAndForget(result.then(sendResponse), (error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Provider operation failed.",
      }),
    );
    return true;
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && CONTROL_D_STORE_KEYS[0] in changes) {
      fireAndForget(prepareMatching());
      fireAndForget(
        chrome.runtime.sendMessage({
          type: FEATURE_EVENTS.stateChanged,
          providerId: "control-d",
        }),
      );
    }
    if (
      areaName === "local" &&
      (RULES_STORAGE_KEY in changes ||
        LOCATIONS_STORAGE_KEY in changes ||
        (FEATURE_STORAGE_KEY in changes &&
          JSON.stringify(changes[FEATURE_STORAGE_KEY]?.oldValue) !==
            JSON.stringify(changes[FEATURE_STORAGE_KEY]?.newValue)))
    )
      controller.scheduleAutomatic();
  });
};
