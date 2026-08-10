import { isExtensionContextValid } from "./safe-messaging";

import { fireAndForget } from "@/shared/async";
import { FX_RUNTIME_TEST_HOST } from "@/shared/build-flags";
import {
  CMD_ASSIGN_LOCATION,
  CMD_CLEAR_LOGS,
  CMD_TEST_RESPONSE_COOKIE,
  CMD_GET_LOGS,
  CMD_GET_SETTINGS,
  CMD_SAVE_LOCATION,
  CMD_SAVE_SETTINGS,
  FXT_ASSIGN_LOCATION,
  FXT_ASSIGN_LOCATION_DONE,
  FXT_CLEAR_LOGS,
  FXT_CLEAR_LOGS_DONE,
  FXT_SET_RESPONSE_COOKIE,
  FXT_SET_COOKIE_DONE,
  FXT_GET_LOGS,
  FXT_GET_LOGS_DONE,
  FXT_GET_SETTINGS,
  FXT_GET_SETTINGS_DONE,
  FXT_SAVE_LOCATION,
  FXT_SAVE_LOCATION_DONE,
  FXT_SAVE_SETTINGS,
  FXT_SAVE_SETTINGS_DONE,
  FIREFOX_BRIDGE_ATTR,
} from "@/shared/extension-contract";

const markBridgeReady = (): void => {
  if (document.documentElement) {
    document.documentElement.setAttribute(FIREFOX_BRIDGE_ATTR, "ready");
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.documentElement) return;
    observer.disconnect();
    document.documentElement.setAttribute(FIREFOX_BRIDGE_ATTR, "ready");
  });
  observer.observe(document, { childList: true });
};

const dispatchBridgeResult = (eventName: string, detail: unknown): void => {
  const serializedDetail = JSON.stringify(detail);
  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail: JSON.parse(serializedDetail) as unknown,
    }),
  );
  document.documentElement?.setAttribute(`data-${eventName}`, serializedDetail);
};

const relayToBackground = (resultEventName: string, message: unknown): void => {
  const dispatchError = (error: unknown): void => {
    dispatchBridgeResult(resultEventName, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  };

  if (!isExtensionContextValid()) {
    dispatchError(new Error("Extension context invalidated."));
    return;
  }

  try {
    fireAndForget(
      chrome.runtime
        .sendMessage(message)
        .then((result) => {
          dispatchBridgeResult(resultEventName, result);
        })
        .catch(dispatchError),
    );
  } catch (error) {
    dispatchError(error);
  }
};

const readBridgePayload = (
  event: Event,
  resultEventName: string,
  missingMessage: string,
): Record<string, unknown> | null => {
  const detail = event instanceof CustomEvent ? event.detail : null;
  if (!detail || typeof detail !== "object") {
    dispatchBridgeResult(resultEventName, { ok: false, error: missingMessage });
    return null;
  }
  return detail as Record<string, unknown>;
};

const relayPayload = (
  requestEvent: string,
  resultEvent: string,
  commandType: string,
  missingMessage: string,
): void => {
  document.addEventListener(requestEvent, (event) => {
    const detail = readBridgePayload(event, resultEvent, missingMessage);
    if (!detail) return;
    relayToBackground(resultEvent, { type: commandType, ...detail });
  });
};

export const registerFxTestBridge = (): void => {
  if (!FX_RUNTIME_TEST_HOST || window.location.hostname !== FX_RUNTIME_TEST_HOST) {
    return;
  }

  document.addEventListener(FXT_GET_SETTINGS, () => {
    relayToBackground(FXT_GET_SETTINGS_DONE, { type: CMD_GET_SETTINGS });
  });
  relayPayload(
    FXT_SAVE_LOCATION,
    FXT_SAVE_LOCATION_DONE,
    CMD_SAVE_LOCATION,
    "Missing save-location-model payload.",
  );
  relayPayload(
    FXT_SAVE_SETTINGS,
    FXT_SAVE_SETTINGS_DONE,
    CMD_SAVE_SETTINGS,
    "Missing save-simple-settings payload.",
  );
  relayPayload(
    FXT_ASSIGN_LOCATION,
    FXT_ASSIGN_LOCATION_DONE,
    CMD_ASSIGN_LOCATION,
    "Missing assign-current-domain-location payload.",
  );
  document.addEventListener(FXT_GET_LOGS, () => {
    relayToBackground(FXT_GET_LOGS_DONE, { type: CMD_GET_LOGS });
  });
  document.addEventListener(FXT_CLEAR_LOGS, () => {
    relayToBackground(FXT_CLEAR_LOGS_DONE, { type: CMD_CLEAR_LOGS });
  });
  relayPayload(
    FXT_SET_RESPONSE_COOKIE,
    FXT_SET_COOKIE_DONE,
    CMD_TEST_RESPONSE_COOKIE,
    "Missing configure-response-cookie payload.",
  );
  markBridgeReady();
};
