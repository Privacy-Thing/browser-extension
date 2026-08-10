// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EXTENSION_COMMAND_TYPES,
  EXTENSION_STORAGE_KEYS,
} from "@/shared/extension-contract";
import { migrateLegacyPrefs } from "@/ui/shared/preferences-migration";

describe("migrateLegacyPrefs", () => {
  const retiredKey = (suffix: string): string =>
    `${["geo", "warp"].join("")}.${suffix}`;
  const sendMessage = vi.fn();
  const storageLocalGet = vi.fn();
  const values = new Map<string, string>();
  const storage = {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
    sendMessage.mockReset();
    storageLocalGet.mockReset();
    // Default: empty consolidated object → themeMode resolves to the default.
    storageLocalGet.mockResolvedValue({});
    vi.stubGlobal("chrome", {
      runtime: { id: "abc", sendMessage },
      storage: { local: { get: storageLocalGet } },
    });
  });

  it("moves legacy UI preferences through the background writer", async () => {
    storage.setItem(retiredKey("theme"), "dark");
    storage.setItem(retiredKey("defaultNoiseRadius"), "120");
    sendMessage.mockResolvedValue({ ok: true });

    await migrateLegacyPrefs();

    expect(sendMessage).toHaveBeenCalledWith({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      themeMode: "dark",
      defaultNoiseRadius: 120,
    });
    expect(storage.getItem(retiredKey("theme"))).toBeNull();
    expect(storage.getItem(retiredKey("defaultNoiseRadius"))).toBeNull();
  });

  it("keeps legacy values when persistence fails", async () => {
    storage.setItem(retiredKey("theme"), "dark");
    sendMessage.mockResolvedValue({ ok: false, error: "storage unavailable" });

    await expect(migrateLegacyPrefs()).rejects.toThrow("storage unavailable");

    expect(storage.getItem(retiredKey("theme"))).toBe("dark");
  });

  it("does not clobber an existing non-default theme with the legacy value", async () => {
    storage.setItem(retiredKey("theme"), "dark");
    storageLocalGet.mockResolvedValue({
      [EXTENSION_STORAGE_KEYS.preferences]: { themeMode: "light" },
    });

    await migrateLegacyPrefs();

    // No persistence (theme skipped, no radius), but the stale legacy key is cleared.
    expect(sendMessage).not.toHaveBeenCalled();
    expect(storage.getItem(retiredKey("theme"))).toBeNull();
  });

  it("still migrates radius when the legacy theme is skipped", async () => {
    storage.setItem(retiredKey("theme"), "dark");
    storage.setItem(retiredKey("defaultNoiseRadius"), "75");
    storageLocalGet.mockResolvedValue({
      [EXTENSION_STORAGE_KEYS.preferences]: { themeMode: "light" },
    });
    sendMessage.mockResolvedValue({ ok: true });

    await migrateLegacyPrefs();

    expect(sendMessage).toHaveBeenCalledWith({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      defaultNoiseRadius: 75,
    });
    expect(storage.getItem(retiredKey("theme"))).toBeNull();
    expect(storage.getItem(retiredKey("defaultNoiseRadius"))).toBeNull();
  });
});
