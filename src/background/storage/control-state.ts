import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import type { ControlState } from "@/shared/types";

export const CONTROL_STORAGE_KEY = EXTENSION_STORAGE_KEYS.controlState;

const DEFAULT_CONTROL_STATE: ControlState = {
  panicMode: false,
};

export const loadControlState = async (): Promise<ControlState> => {
  const stored = await chrome.storage.local.get(CONTROL_STORAGE_KEY);
  const state = stored[CONTROL_STORAGE_KEY];

  if (!state || typeof state !== "object") {
    return DEFAULT_CONTROL_STATE;
  }

  return {
    panicMode:
      "panicMode" in state && typeof state.panicMode === "boolean"
        ? state.panicMode
        : false,
  };
};

export const saveControlState = async (state: ControlState): Promise<void> => {
  await chrome.storage.local.set({
    [CONTROL_STORAGE_KEY]: state,
  });
};
