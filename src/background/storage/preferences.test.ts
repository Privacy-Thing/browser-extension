import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FALLBACK_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  getFingerprintEnabled,
  getGlobalFallbackRule,
  getPreferences,
  getSharedSpoofing,
  getThemeAccentPreset,
  getThemeMode,
  savePreferences,
} from "@/background/storage/preferences";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getThemeMode", () => {
  const getMock = vi.fn();

  beforeEach(() => {
    getMock.mockReset();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: getMock,
        },
      },
    });
  });

  it("returns system when the setting is missing", async () => {
    getMock.mockResolvedValue({});

    await expect(getThemeMode()).resolves.toBe("system");
  });

  it("returns system when the stored value is invalid", async () => {
    getMock.mockResolvedValue({ themeMode: "sepia" });

    await expect(getThemeMode()).resolves.toBe("system");
  });

  it("returns the stored valid theme mode", async () => {
    getMock.mockResolvedValue({
      [PREFERENCES_STORAGE_KEY]: { themeMode: "dark" },
    });

    await expect(getThemeMode()).resolves.toBe("dark");
  });
});

describe("getThemeAccentPreset", () => {
  const getMock = vi.fn();

  beforeEach(() => {
    getMock.mockReset();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: getMock,
        },
      },
    });
  });

  it("returns teal when the setting is missing", async () => {
    getMock.mockResolvedValue({});

    await expect(getThemeAccentPreset()).resolves.toBe("teal");
  });

  it("returns teal when the stored value is invalid", async () => {
    getMock.mockResolvedValue({ themeAccentPreset: "sepia" });

    await expect(getThemeAccentPreset()).resolves.toBe("teal");
  });

  it("returns the stored valid accent preset", async () => {
    getMock.mockResolvedValue({
      [PREFERENCES_STORAGE_KEY]: { themeAccentPreset: "purple" },
    });

    await expect(getThemeAccentPreset()).resolves.toBe("purple");
  });
});

describe("getSharedSpoofing", () => {
  const getMock = vi.fn();

  beforeEach(() => {
    getMock.mockReset();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: getMock,
        },
      },
    });
  });

  it("returns undefined when the stored value is invalid", async () => {
    getMock.mockResolvedValue({
      sharedSpoofing: {
        enabled: true,
        canvas: "yes",
      },
    });

    await expect(getSharedSpoofing()).resolves.toBeUndefined();
  });

  it("returns the stored value when it matches the schema", async () => {
    getMock.mockResolvedValue({
      sharedSpoofing: {
        enabled: true,
        canvas: false,
        battery: false,
        webRTC: true,
      },
    });

    await expect(getSharedSpoofing()).resolves.toEqual({
      canvas: false,
      battery: false,
      webRTC: true,
    });
  });

  it("does not read the legacy key outside the startup migrator", async () => {
    getMock.mockResolvedValue({
      experimentalActiveSpoofing: {
        enabled: true,
        audio: false,
      },
    });

    await expect(getSharedSpoofing()).resolves.toBeUndefined();
  });

  it("prefers the new key when both new and legacy values exist", async () => {
    getMock.mockResolvedValue({
      sharedSpoofing: {
        canvas: false,
      },
      experimentalActiveSpoofing: {
        audio: false,
      },
    });

    await expect(getSharedSpoofing()).resolves.toEqual({
      canvas: false,
    });
  });
});

describe("getGlobalFallbackRule", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) =>
            key in store ? { [key]: store[key] } : {},
          ),
          set: vi.fn(async (entries: Record<string, unknown>) => {
            Object.assign(store, entries);
          }),
        },
      },
    });
  });

  it("persists a minted auth key once for a legacy rule, then is stable", async () => {
    store[FALLBACK_STORAGE_KEY] = {
      enabled: true,
      ruleSeedKey: "glb123",
    };

    const first = await getGlobalFallbackRule();
    const persisted = store[FALLBACK_STORAGE_KEY] as Record<string, unknown>;

    // Minted once and written back so the nonce survives for the rule's lifetime.
    expect(first?.authKey).toMatch(/^[a-z0-9]{8}$/);
    expect(persisted.authKey).toBe(first?.authKey);
    expect(chrome.storage.local.set).toHaveBeenCalledOnce();

    // Subsequent reads return the persisted key and do not write again.
    const second = await getGlobalFallbackRule();
    expect(second?.authKey).toBe(first?.authKey);
    expect(chrome.storage.local.set).toHaveBeenCalledOnce();
  });

  it("does not rewrite a rule that already carries a valid auth key", async () => {
    store[FALLBACK_STORAGE_KEY] = {
      enabled: true,
      ruleSeedKey: "glb123",
      authKey: "a1b2c3d4",
    };

    const loaded = await getGlobalFallbackRule();

    expect(loaded?.authKey).toBe("a1b2c3d4");
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});

describe("getFingerprintEnabled", () => {
  const getMock = vi.fn();

  beforeEach(() => {
    getMock.mockReset();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: getMock,
        },
      },
    });
  });

  it("returns true when the setting is missing", async () => {
    getMock.mockResolvedValue({});

    await expect(getFingerprintEnabled()).resolves.toBe(true);
  });

  it("returns false when the stored value is explicitly false", async () => {
    getMock.mockResolvedValue({
      [PREFERENCES_STORAGE_KEY]: { browserFingerprintSpoofingEnabled: false },
    });

    await expect(getFingerprintEnabled()).resolves.toBe(false);
  });
});

describe("getPreferences / savePreferences", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) =>
            key in store ? { [key]: store[key] } : {},
          ),
          set: vi.fn(async (entries: Record<string, unknown>) => {
            Object.assign(store, entries);
          }),
        },
      },
    });
  });

  it("round-trips a full preferences object", async () => {
    await savePreferences({
      debugMode: true,
      osmConsent: "granted",
      browserFingerprintSpoofingEnabled: false,
    });

    const stored = store[PREFERENCES_STORAGE_KEY] as Record<string, unknown>;
    expect(stored.debugMode).toBe(true);
    expect(stored.osmConsent).toBe("granted");
    expect(stored.browserFingerprintSpoofingEnabled).toBe(false);
    const loaded = await getPreferences();
    expect(loaded.debugMode).toBe(true);
    expect(loaded.osmConsent).toBe("granted");
    expect(loaded.browserFingerprintSpoofingEnabled).toBe(false);
  });

  it("merges partial updates without losing previously saved fields", async () => {
    await savePreferences({ debugMode: true });
    await savePreferences({ osmConsent: "denied" });

    const loaded = await getPreferences();
    expect(loaded.debugMode).toBe(true);
    expect(loaded.osmConsent).toBe("denied");
  });

  it("merges partial feature-flag updates", async () => {
    await savePreferences({
      featureFlags: { temporalApi: true, domainFencing: false },
    });
    await savePreferences({ debugMode: true });

    expect((await getPreferences()).featureFlags).toEqual({
      temporalApi: true,
      domainFencing: false,
    });
  });

  it("does not lose fields under concurrent partial writes", async () => {
    await Promise.all([
      savePreferences({ debugMode: true }),
      savePreferences({ osmConsent: "granted" }),
      savePreferences({ highContrastMode: true }),
    ]);

    const loaded = await getPreferences();
    expect(loaded.debugMode).toBe(true);
    expect(loaded.osmConsent).toBe("granted");
    expect(loaded.highContrastMode).toBe(true);
  });

  it("continues processing writes after a failed write", async () => {
    const set = vi.mocked(chrome.storage.local.set);
    set.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(savePreferences({ debugMode: true })).rejects.toThrow(
      "storage unavailable",
    );
    await expect(savePreferences({ osmConsent: "granted" })).resolves.toBeUndefined();

    expect((await getPreferences()).osmConsent).toBe("granted");
  });
});
