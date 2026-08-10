import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MIGRATION_NOTICE_KEY,
  clearRulesForTests,
  removeWildcardRules,
  runStorageMigration,
} from "@/background/migrations";
import { CONTAINERS_STORAGE_KEY } from "@/background/storage/container-assignments";
import { CONTROL_STORAGE_KEY } from "@/background/storage/control-state";
import { LEGACY_BEHAVIOR_KEY } from "@/background/storage/legacy-behavior-data";
import { LOCATIONS_STORAGE_KEY } from "@/background/storage/locations";
import { NOTICES_STORAGE_KEY } from "@/background/storage/popup-notifications";
import {
  LEGACY_SPOOFING_KEY,
  FALLBACK_STORAGE_KEY,
  SPOOFING_STORAGE_KEY,
} from "@/background/storage/preferences";
import { RULES_STORAGE_KEY } from "@/background/storage/rules";
import { SEEN_HOSTS_STORAGE_KEY } from "@/background/storage/seen-hosts";
import { SUGGESTIONS_STORAGE_KEY } from "@/background/storage/site-suggestions";
import { TRUSTED_STORAGE_KEY } from "@/background/storage/trusted-sites";
import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";

const PREFERENCES_STORAGE_KEY = EXTENSION_STORAGE_KEYS.preferences;
const FINGERPRINT_SETTING_KEY = "browserFingerprintSpoofingEnabled";
const retiredNamespace = (variant: "current" | "oldest"): string =>
  ["geo", variant === "current" ? "warp" : "wrap"].join("");
const retiredDotKey = (
  suffix: string,
  variant: "current" | "oldest" = "current",
): string => `${retiredNamespace(variant)}.${suffix}`;
const retiredSnakeKey = (
  suffix: string,
  variant: "current" | "oldest" = "current",
): string => `${retiredNamespace(variant)}_${suffix}`;
const retiredSessionKey = (suffix: string): string =>
  `${retiredNamespace("current")}:${suffix}`;

type LocalStorageShape = Record<string, unknown>;

const storageState: LocalStorageShape = {};
const sessionState: LocalStorageShape = {};

const { syncDynamicHeaderRules } = vi.hoisted(() => ({
  syncDynamicHeaderRules: vi.fn(async () => undefined),
}));

vi.mock("@/background/dnr", () => ({
  syncDynamicHeaderRules,
}));

const getStorageApi = (state: LocalStorageShape) => ({
  get: vi.fn(async (keys?: string | string[]) => {
    if (keys === undefined) {
      return { ...state };
    }

    if (typeof keys === "string") {
      return keys in state ? { [keys]: state[keys] } : {};
    }

    return Object.fromEntries(
      keys.filter((key) => key in state).map((key) => [key, state[key]]),
    );
  }),
  set: vi.fn(async (entries: Record<string, unknown>) => {
    Object.assign(state, entries);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      Reflect.deleteProperty(state, key);
    }
  }),
});

beforeEach(async () => {
  for (const key of Object.keys(storageState)) {
    Reflect.deleteProperty(storageState, key);
  }
  for (const key of Object.keys(sessionState)) {
    Reflect.deleteProperty(sessionState, key);
  }

  syncDynamicHeaderRules.mockClear();

  vi.stubGlobal("chrome", {
    storage: {
      local: getStorageApi(storageState),
      session: getStorageApi(sessionState),
    },
  });

  await clearRulesForTests();
});

describe("removeWildcardRules", () => {
  it("removes legacy wildcard rules", () => {
    const result = removeWildcardRules([
      { pattern: "*", locationId: "warsaw", enabled: true },
      { pattern: "example.com", locationId: "warsaw", enabled: true },
      { pattern: "*", locationId: "paris", enabled: true },
    ]);

    expect(result.removedCount).toBe(2);
    expect(result.nextRules).toEqual([
      { pattern: "example.com", locationId: "warsaw", enabled: true },
    ]);
  });

  it("is idempotent when no wildcard rule exists", () => {
    const rules = [{ pattern: "example.com", locationId: "warsaw", enabled: true }];
    const result = removeWildcardRules(rules);

    expect(result.removedCount).toBe(0);
    expect(result.nextRules).toEqual(rules);
  });
});

describe("runStorageMigration", () => {
  it("removes retired diagnostics and QA access state", async () => {
    storageState.developerMode = true;
    storageState.errorReportingEnabled = true;
    storageState[retiredDotKey("errorReports")] = [{ message: "sensitive" }];
    storageState[retiredDotKey("sentryDsn")] = "https://secret.example";
    sessionState[retiredSessionKey("qa-access-state")] = { pending: true };

    await runStorageMigration();

    expect(storageState.developerMode).toBeUndefined();
    expect(storageState.errorReportingEnabled).toBeUndefined();
    expect(storageState[retiredDotKey("errorReports")]).toBeUndefined();
    expect(storageState[retiredDotKey("sentryDsn")]).toBeUndefined();
    expect(sessionState[retiredSessionKey("qa-access-state")]).toBeUndefined();
  });

  it("migrates a complete retired profile to pt keys and removes old entries", async () => {
    const location = {
      id: "warsaw",
      label: "Warsaw",
      latitude: 52.23,
      longitude: 21.01,
      accuracy: 25,
      noiseRadius: 50,
      language: "pl",
      languages: ["pl"],
      timeZone: "Europe/Warsaw",
    };
    const rule = {
      pattern: "example.com",
      locationId: "warsaw",
      enabled: true,
      ruleSeedKey: "abc123",
      authKey: "auth1234",
      relaxCspForWorkers: false,
    };
    const preferences = { ...DEFAULT_PREFERENCES, themeMode: "dark" };
    const sourceEntries = {
      [retiredDotKey("locations")]: [location],
      [retiredDotKey("rules")]: [rule],
      [retiredDotKey("trustedSites")]: ["trusted.example"],
      [retiredDotKey("control-state")]: { panicMode: true },
      [retiredDotKey("migrationNotice")]: "legacy notice",
      [retiredDotKey("siteSuggestions")]: [{ hostname: "shop.example" }],
      [retiredDotKey("popupNotifications")]: { readIds: ["notice-1"] },
      [retiredDotKey("preferences")]: preferences,
      [retiredSnakeKey("seen_hosts")]: ["example.com"],
      [retiredSnakeKey("container_assignments")]: [
        {
          cookieStoreId: "firefox-container-1",
          locationId: "warsaw",
          enabled: true,
          ruleSeedKey: "def456",
          authKey: "auth5678",
        },
      ],
    };
    Object.assign(storageState, sourceEntries);
    sessionState[retiredSessionKey("preloaded-runtime-state")] = { stale: true };

    const result = await runStorageMigration();

    expect(result.removedWildcardRules).toBe(0);
    expect(storageState[LOCATIONS_STORAGE_KEY]).toEqual([location]);
    expect(storageState[RULES_STORAGE_KEY]).toEqual([rule]);
    expect(storageState[TRUSTED_STORAGE_KEY]).toEqual(["trusted.example"]);
    expect(storageState[CONTROL_STORAGE_KEY]).toEqual({ panicMode: true });
    expect(storageState[MIGRATION_NOTICE_KEY]).toBe("legacy notice");
    expect(storageState[SUGGESTIONS_STORAGE_KEY]).toEqual([
      { hostname: "shop.example" },
    ]);
    expect(storageState[NOTICES_STORAGE_KEY]).toEqual({ readIds: ["notice-1"] });
    expect(storageState[PREFERENCES_STORAGE_KEY]).toEqual(preferences);
    expect(storageState[SEEN_HOSTS_STORAGE_KEY]).toEqual(["example.com"]);
    expect(storageState[CONTAINERS_STORAGE_KEY]).toEqual([
      expect.objectContaining({
        cookieStoreId: "firefox-container-1",
        locationId: "warsaw",
        ruleSeedKey: "def456",
        authKey: "auth5678",
      }),
    ]);
    for (const key of Object.keys(sourceEntries)) {
      expect(storageState[key], key).toBeUndefined();
    }
    expect(sessionState[retiredSessionKey("preloaded-runtime-state")]).toBeUndefined();
    expect(syncDynamicHeaderRules).toHaveBeenCalledTimes(1);
  });

  it("keeps new keys as source of truth when they already exist", async () => {
    storageState[LOCATIONS_STORAGE_KEY] = [{ id: "paris", label: "Paris" }];
    storageState[retiredDotKey("locations")] = [{ id: "warsaw", label: "Warsaw" }];
    storageState[RULES_STORAGE_KEY] = [
      { pattern: "example.com", locationId: "paris", enabled: true },
    ];
    storageState[retiredDotKey("rules")] = [{ pattern: "*", locationId: "warsaw" }];

    const result = await runStorageMigration();

    expect(result.removedWildcardRules).toBe(0);
    expect(storageState[LOCATIONS_STORAGE_KEY]).toEqual([
      { id: "paris", label: "Paris" },
    ]);
    expect(storageState[RULES_STORAGE_KEY]).toEqual([
      expect.objectContaining({
        pattern: "example.com",
        locationId: "paris",
        enabled: true,
        ruleSeedKey: expect.stringMatching(/^[a-z0-9]{6}$/),
      }),
    ]);
    expect(storageState[retiredDotKey("locations")]).toBeUndefined();
    expect(storageState[retiredDotKey("rules")]).toBeUndefined();
  });

  it("prefers the latest retired namespace over the oldest one", async () => {
    storageState[retiredDotKey("locations", "current")] = [
      { id: "latest", label: "Latest" },
    ];
    storageState[retiredDotKey("locations", "oldest")] = [
      { id: "oldest", label: "Oldest" },
    ];

    await runStorageMigration();

    expect(storageState[LOCATIONS_STORAGE_KEY]).toEqual([
      { id: "latest", label: "Latest" },
    ]);
  });

  it("consolidates retired namespaced scalar preferences", async () => {
    storageState[retiredDotKey("defaultNoiseRadius")] = 120;
    storageState[retiredDotKey("watchPositionDelay.min")] = 250;
    storageState[retiredDotKey("watchPositionDelay.max")] = 750;
    storageState[retiredDotKey("theme")] = "dark";
    storageState[retiredDotKey("surfaceProtectionsDefaultReset")] = true;

    await runStorageMigration();

    expect(storageState[PREFERENCES_STORAGE_KEY]).toEqual(
      expect.objectContaining({
        defaultNoiseRadius: 120,
        watchPositionDelay: [250, 750],
        themeMode: "dark",
      }),
    );
    expect(storageState[EXTENSION_STORAGE_KEYS.defaultNoiseRadius]).toBeUndefined();
    expect(storageState[EXTENSION_STORAGE_KEYS.watchPositionDelayMin]).toBeUndefined();
    expect(storageState[EXTENSION_STORAGE_KEYS.watchPositionDelayMax]).toBeUndefined();
    expect(storageState[EXTENSION_STORAGE_KEYS.theme]).toBeUndefined();
    expect(
      storageState[EXTENSION_STORAGE_KEYS.surfaceProtectionsDefaultReset],
    ).toBeUndefined();
  });

  it("falls back to the oldest retired namespace", async () => {
    storageState[retiredDotKey("profiles", "oldest")] = [
      { id: "oldest", label: "Oldest" },
    ];

    await runStorageMigration();

    expect(storageState[LOCATIONS_STORAGE_KEY]).toEqual([
      { id: "oldest", label: "Oldest" },
    ]);
  });

  it("does no further storage writes after a completed namespace import", async () => {
    storageState[retiredDotKey("locations")] = [{ id: "warsaw", label: "Warsaw" }];

    await runStorageMigration();
    vi.mocked(chrome.storage.local.set).mockClear();
    vi.mocked(chrome.storage.local.remove).mockClear();
    vi.mocked(chrome.storage.session.remove).mockClear();

    await runStorageMigration();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    expect(chrome.storage.session.remove).not.toHaveBeenCalled();
  });

  it("leaves retired keys intact when the destination write fails", async () => {
    const sourceKey = retiredDotKey("locations");
    storageState[sourceKey] = [{ id: "warsaw", label: "Warsaw" }];
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(
      new Error("write failed"),
    );

    await expect(runStorageMigration()).rejects.toThrow("write failed");

    expect(storageState[sourceKey]).toEqual([{ id: "warsaw", label: "Warsaw" }]);
    expect(storageState[LOCATIONS_STORAGE_KEY]).toBeUndefined();
  });

  it("fills in enabled=true for legacy rules without the flag", async () => {
    storageState[RULES_STORAGE_KEY] = [{ pattern: "example.com", locationId: "paris" }];

    const result = await runStorageMigration();

    expect(result.removedWildcardRules).toBe(0);
    expect(storageState[RULES_STORAGE_KEY]).toEqual([
      {
        pattern: "example.com",
        locationId: "paris",
        enabled: true,
        ruleSeedKey: expect.stringMatching(/^[a-z0-9]{6}$/),
        authKey: expect.stringMatching(/^[a-z0-9]{8}$/),
        relaxCspForWorkers: false,
      },
    ]);
  });

  it("migrates the legacy experimental spoofing key to sharedSpoofing", async () => {
    storageState[LEGACY_SPOOFING_KEY] = {
      enabled: true,
      canvas: false,
      webRTC: true,
    };

    await runStorageMigration();

    expect(storageState[SPOOFING_STORAGE_KEY]).toEqual({
      canvas: false,
      webRTC: true,
    });
    expect(storageState[LEGACY_SPOOFING_KEY]).toBeUndefined();
  });

  it("keeps sharedSpoofing as the source of truth when both keys exist", async () => {
    storageState[SPOOFING_STORAGE_KEY] = {
      canvas: true,
    };
    storageState[LEGACY_SPOOFING_KEY] = {
      canvas: false,
    };

    await runStorageMigration();

    expect(storageState[SPOOFING_STORAGE_KEY]).toEqual({
      canvas: true,
    });
    expect(storageState[LEGACY_SPOOFING_KEY]).toBeUndefined();
  });

  it("fills in ruleSeedKey for legacy rules without the field", async () => {
    storageState[RULES_STORAGE_KEY] = [
      { pattern: "example.com", locationId: "paris", enabled: true },
    ];

    await runStorageMigration();

    expect(storageState[RULES_STORAGE_KEY]).toEqual([
      expect.objectContaining({
        pattern: "example.com",
        locationId: "paris",
        enabled: true,
        ruleSeedKey: expect.stringMatching(/^[a-z0-9]{6}$/),
      }),
    ]);
  });

  it("backfills geolocation surface overrides from legacy geolocationEnabled flags", async () => {
    storageState[RULES_STORAGE_KEY] = [
      {
        pattern: "example.com",
        locationId: "paris",
        enabled: true,
        geolocationEnabled: false,
      },
    ];
    storageState[FALLBACK_STORAGE_KEY] = {
      enabled: true,
      locationId: "paris",
      geolocationEnabled: false,
      ruleSeedKey: "abc123",
    };
    storageState[CONTAINERS_STORAGE_KEY] = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: "paris",
        geolocationEnabled: false,
        ruleSeedKey: "def456",
      },
    ];

    await runStorageMigration();

    expect(storageState[RULES_STORAGE_KEY]).toEqual([
      expect.objectContaining({
        pattern: "example.com",
        locationId: "paris",
        fingerprintSurfaceOverrides: {
          geolocation: false,
        },
      }),
    ]);
    expect(storageState[FALLBACK_STORAGE_KEY]).toEqual(
      expect.objectContaining({
        enabled: true,
        locationId: "paris",
        fingerprintSurfaceOverrides: {
          geolocation: false,
        },
        ruleSeedKey: "abc123",
      }),
    );
    expect(storageState[CONTAINERS_STORAGE_KEY]).toEqual([
      expect.objectContaining({
        cookieStoreId: "firefox-container-1",
        locationId: "paris",
        fingerprintSurfaceOverrides: {
          geolocation: false,
        },
        ruleSeedKey: "def456",
      }),
    ]);
  });

  it("does not rewrite already normalized geolocation surface settings", async () => {
    storageState[PREFERENCES_STORAGE_KEY] = DEFAULT_PREFERENCES;
    storageState[RULES_STORAGE_KEY] = [
      {
        pattern: "example.com",
        locationId: "paris",
        enabled: true,
        ruleSeedKey: "abc123",
        fingerprintSurfaceOverrides: {
          geolocation: false,
        },
      },
    ];
    storageState[FALLBACK_STORAGE_KEY] = {
      enabled: true,
      locationId: "paris",
      ruleSeedKey: "def456",
      fingerprintSurfaceOverrides: {
        geolocation: false,
      },
    };
    storageState[CONTAINERS_STORAGE_KEY] = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: "paris",
        ruleSeedKey: "ghi789",
        fingerprintSurfaceOverrides: {
          geolocation: false,
        },
      },
    ];

    await runStorageMigration();

    expect(syncDynamicHeaderRules).not.toHaveBeenCalled();
  });

  it("leaves retired profile payloads unchanged", async () => {
    const retiredProfiles = [{ id: "legacy-profile", opaque: { value: 42 } }];
    storageState[LEGACY_BEHAVIOR_KEY] = retiredProfiles;

    await runStorageMigration();

    expect(storageState[LEGACY_BEHAVIOR_KEY]).toEqual(retiredProfiles);
  });

  it("consolidates legacy flat preference keys into the preferences object", async () => {
    storageState[FINGERPRINT_SETTING_KEY] = true;
    storageState.debugMode = true;
    storageState.watchPositionDelay = [10, 20];
    storageState.osmConsent = "granted";
    storageState.themeMode = "dark";
    storageState.themeAccentPreset = "blue";

    await runStorageMigration();

    expect(storageState[PREFERENCES_STORAGE_KEY]).toEqual(
      expect.objectContaining({
        browserFingerprintSpoofingEnabled: true,
        debugMode: true,
        watchPositionDelay: [10, 20],
        osmConsent: "granted",
        themeMode: "dark",
        themeAccentPreset: "blue",
        defaultNoiseRadius: 50,
        randomizeGeneratedLocationByDefault: true,
        generatedLocationRandomizationRadiusKm: 10,
      }),
    );
    // Legacy flat keys are removed.
    expect(storageState[FINGERPRINT_SETTING_KEY]).toBeUndefined();
    expect(storageState.debugMode).toBeUndefined();
    expect(storageState.osmConsent).toBeUndefined();
    expect(storageState.themeMode).toBeUndefined();
  });

  it("backfills theme fields into an existing partial preferences object", async () => {
    storageState[PREFERENCES_STORAGE_KEY] = { debugMode: true };
    storageState.themeMode = "dark";
    storageState.highContrastMode = true;

    await runStorageMigration();

    expect(storageState[PREFERENCES_STORAGE_KEY]).toEqual(
      expect.objectContaining({
        debugMode: true,
        themeMode: "dark",
        highContrastMode: true,
        defaultNoiseRadius: 50,
        randomizeGeneratedLocationByDefault: true,
        generatedLocationRandomizationRadiusKm: 10,
      }),
    );
    expect(storageState.themeMode).toBeUndefined();
    expect(storageState.highContrastMode).toBeUndefined();
  });

  it("clears a stale disabled surface-protections flag while consolidating", async () => {
    storageState[FINGERPRINT_SETTING_KEY] = false;

    await runStorageMigration();

    // The stale explicit false normalizes back to the enabled-by-default value.
    expect(
      (
        storageState[PREFERENCES_STORAGE_KEY] as {
          browserFingerprintSpoofingEnabled: boolean;
        }
      ).browserFingerprintSpoofingEnabled,
    ).toBe(true);
    expect(storageState[FINGERPRINT_SETTING_KEY]).toBeUndefined();
  });

  it("uses strict SharedWorker handling for fresh preferences", async () => {
    await runStorageMigration();

    expect(storageState[PREFERENCES_STORAGE_KEY]).toEqual(
      expect.objectContaining({
        sharedWorkerHandlingMode: "strict",
        sharedWorkerCompatibilityMode: false,
      }),
    );
  });

  it("preserves a deliberate opt-out made after consolidation", async () => {
    await runStorageMigration();

    // User turns protections off afterwards (written into the object).
    storageState[PREFERENCES_STORAGE_KEY] = {
      ...(storageState[PREFERENCES_STORAGE_KEY] as Record<string, unknown>),
      browserFingerprintSpoofingEnabled: false,
    };
    await runStorageMigration();

    expect(
      (
        storageState[PREFERENCES_STORAGE_KEY] as {
          browserFingerprintSpoofingEnabled: boolean;
        }
      ).browserFingerprintSpoofingEnabled,
    ).toBe(false);
  });

  it("is idempotent once the preferences object exists", async () => {
    await runStorageMigration();
    const first = storageState[PREFERENCES_STORAGE_KEY];

    storageState[FINGERPRINT_SETTING_KEY] = false;
    await runStorageMigration();

    // A stray legacy key written after consolidation is ignored, not re-merged.
    expect(storageState[PREFERENCES_STORAGE_KEY]).toBe(first);
  });
});
