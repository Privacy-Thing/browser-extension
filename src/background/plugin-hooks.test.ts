import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPluginHooks } from "./plugin-hooks";

import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";

type StorageListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

const listeners = new Set<StorageListener>();
const removeListener = vi.fn((listener: StorageListener) => listeners.delete(listener));
const dispatch = (changes: Parameters<StorageListener>[0], area = "local") => {
  for (const listener of listeners) listener(changes, area);
};

beforeEach(() => {
  listeners.clear();
  removeListener.mockClear();
  vi.stubGlobal("chrome", {
    storage: {
      onChanged: {
        addListener: (listener: StorageListener) => listeners.add(listener),
        removeListener,
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("PT plugin hooks", () => {
  it("delivers only subscribed configuration scopes, without raw values", async () => {
    const changed = vi.fn();
    createPluginHooks().onConfigurationChanged(
      ["rules", "rules", "locations"],
      changed,
    );
    dispatch({
      [EXTENSION_STORAGE_KEYS.rules]: {
        oldValue: [],
        newValue: [{ pattern: "example.com" }],
      },
      [EXTENSION_STORAGE_KEYS.locations]: {
        oldValue: [],
        newValue: [{ id: "regional" }],
      },
      [EXTENSION_STORAGE_KEYS.preferences]: { newValue: { locale: "en" } },
      "example-plugin.private-key": { newValue: "private-test-value" },
    });
    await Promise.resolve();
    expect(changed).toHaveBeenCalledExactlyOnceWith(["rules", "locations"]);
  });

  it("ignores session state, unchanged bindings and plugin-private storage", async () => {
    const changed = vi.fn();
    createPluginHooks().onConfigurationChanged(["rules", "featureBindings"], changed);
    dispatch({ [EXTENSION_STORAGE_KEYS.rules]: { newValue: [] } }, "session");
    dispatch({
      [EXTENSION_STORAGE_KEYS.providerFeatures]: {
        oldValue: { featureBindings: [] },
        newValue: { featureBindings: [] },
      },
      "example-plugin.config": { newValue: {} },
    });
    await Promise.resolve();
    expect(changed).not.toHaveBeenCalled();
  });

  it("unsubscribes once and cancels a queued delivery", async () => {
    const changed = vi.fn();
    const stop = createPluginHooks().onConfigurationChanged(["rules"], changed);
    dispatch({ [EXTENSION_STORAGE_KEYS.rules]: { newValue: [] } });
    stop();
    stop();
    await Promise.resolve();
    dispatch({ [EXTENSION_STORAGE_KEYS.rules]: { newValue: [{}] } });
    await Promise.resolve();
    expect(changed).not.toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
  });

  it("isolates failing plugins so another subscription still receives its event", async () => {
    const hooks = createPluginHooks();
    hooks.onConfigurationChanged(["rules"], () => {
      throw new Error("Plugin failed");
    });
    const changed = vi.fn();
    hooks.onConfigurationChanged(["rules"], changed);
    expect(() =>
      dispatch({ [EXTENSION_STORAGE_KEYS.rules]: { newValue: [] } }),
    ).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(changed).toHaveBeenCalledExactlyOnceWith(["rules"]);
  });
});
