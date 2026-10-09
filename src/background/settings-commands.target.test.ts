import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSettingsHandlers } from "@/background/settings-commands";
import { saveContainerAssignments } from "@/background/storage/container-assignments";
import type * as LegacyBehaviorModule from "@/background/storage/legacy-behavior-data";
import { saveLocations } from "@/background/storage/locations";
import { saveRules } from "@/background/storage/rules";
import { clearSiteSuggestions } from "@/background/storage/site-suggestions";
import {
  EXTENSION_COMMAND_TYPES,
  EXTENSION_STORAGE_KEYS,
} from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import type { EffectiveTabContext, TrustedSite } from "@/shared/types";

const {
  saveTrustedSites,
  savePreferences,
  clearLegacyBehavior,
  saveLegacyBehavior,
  loadContainerAssignments,
  loadLocations,
  loadRules,
  loadTrustedSites,
  getThemeMode,
  getThemeAccentPreset,
  getDebugMode,
  getWatchPositionDelay,
  getOsmConsent,
  getPreferences,
  getFingerprintEnabled,
  getSharedSpoofing,
  getGlobalFallbackRule,
  getHighContrastMode,
} = vi.hoisted(() => ({
  saveTrustedSites: vi.fn<(trustedSites: readonly TrustedSite[]) => Promise<void>>(),
  savePreferences: vi.fn<(_: unknown) => Promise<void>>(),
  clearLegacyBehavior: vi.fn<() => Promise<void>>(),
  saveLegacyBehavior: vi.fn<(_: unknown) => Promise<void>>(),
  loadContainerAssignments: vi.fn(async () => []),
  loadLocations: vi.fn(async () => []),
  loadRules: vi.fn(async () => []),
  loadTrustedSites: vi.fn<() => Promise<TrustedSite[]>>(),
  getThemeMode: vi.fn<() => Promise<"system">>(),
  getThemeAccentPreset: vi.fn<() => Promise<"teal">>(),
  getDebugMode: vi.fn<() => Promise<boolean>>(),
  getWatchPositionDelay: vi.fn<() => Promise<[number, number]>>(),
  getOsmConsent: vi.fn<() => Promise<"unknown">>(),
  getPreferences: vi.fn(),
  getFingerprintEnabled: vi.fn<() => Promise<boolean>>(),
  getSharedSpoofing: vi.fn<() => Promise<undefined>>(),
  getGlobalFallbackRule: vi.fn<() => Promise<undefined>>(),
  getHighContrastMode: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("@/background/logger", () => ({
  clearExtensionLogs: vi.fn(),
  logExtensionEvent: vi.fn(),
}));

vi.mock("@/background/storage/legacy-behavior-data", async (importOriginal) => ({
  ...(await importOriginal<typeof LegacyBehaviorModule>()),
  clearLegacyBehavior,
  saveLegacyBehavior,
}));

vi.mock("@/background/storage/container-assignments", () => ({
  loadContainerAssignments,
  saveContainerAssignments: vi.fn(async () => undefined),
}));

vi.mock("@/background/storage/locations", () => ({
  DEFAULT_LOCATIONS: [],
  loadLocations,
  saveLocations: vi.fn(async () => undefined),
}));

vi.mock("@/background/storage/preferences", () => ({
  getFingerprintEnabled,
  getDebugMode,
  getGlobalFallbackRule,
  getHighContrastMode,
  getOsmConsent,
  getPreferences,
  getSharedSpoofing,
  getThemeAccentPreset,
  getThemeMode,
  getWatchPositionDelay,
  saveFingerprintEnabled: vi.fn(async () => undefined),
  saveDebugMode: vi.fn(async () => undefined),
  saveGlobalFallbackRule: vi.fn(async () => undefined),
  saveHighContrastMode: vi.fn(async () => undefined),
  saveOnboardingCompleted: vi.fn(async () => undefined),
  saveOsmConsent: vi.fn(async () => undefined),
  savePreferences,
  saveSharedSpoofing: vi.fn(async () => undefined),
  saveThemeAccentPreset: vi.fn(async () => undefined),
  saveThemeMode: vi.fn(async () => undefined),
  saveWatchPositionDelay: vi.fn(async () => undefined),
}));

vi.mock("@/background/storage/rules", () => ({
  DEFAULT_RULES: [],
  loadRules,
  saveRules: vi.fn(async () => undefined),
}));

vi.mock("@/background/storage/provider-features", () => ({
  loadFeatureBindings: vi.fn(async () => []),
  saveFeatureState: vi.fn(async () => undefined),
}));

vi.mock("@/background/storage/site-suggestions", () => ({
  clearSiteSuggestions: vi.fn(async () => undefined),
}));

vi.mock("@/background/storage/trusted-sites", () => ({
  DEFAULT_TRUSTED_SITES: [],
  loadTrustedSites,
  saveTrustedSites,
}));

const buildCachedValues = (trustedSites: TrustedSite[]) => ({
  profiles: [],
  rules: [],
  trustedSites,
  themeMode: "system" as const,
  themeAccentPreset: "teal" as const,
  reduceMotion: false,
  debugMode: false,
  watchPositionDelay: [60, 500] as [number, number],
  osmConsent: "unknown" as const,
  browserFingerprintSpoofingEnabled: false,
  featureFlags: { temporalApi: false, domainFencing: false },
  sharedWorkerHandlingMode: "native" as const,
  sharedWorkerCompatibilityMode: true,
  sharedSpoofingLoaded: true,
  sharedSpoofing: undefined,
  globalFallbackRuleLoaded: true,
  globalFallbackRule: undefined,
  highContrastMode: false,
  defaultNoiseRadius: 50,
  randomizeGeneratedLocationByDefault: true,
  generatedLocationRandomizationRadiusKm: 10,
  showBadgeQueryCount: true,
  includeDateCallsInBadgeCount: true,
  containerAssignments: [],
});

const createDeps = () => ({
  ensureStorageMigration: vi.fn(async () => undefined),
  syncPreloadedState: vi.fn(async () => undefined),
  resyncActiveHeaderRules: vi.fn(async () => undefined),
  refreshFxInjectionMode: vi.fn(async () => undefined),
  getActiveTabContexts: () => [],
  reloadTabs: vi.fn(async () => undefined),
  getCachedValues: () => buildCachedValues([]),
  setCachedValues: vi.fn(),
});

describe("createSettingsHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    loadTrustedSites.mockResolvedValue([]);
    saveTrustedSites.mockResolvedValue();
    getThemeMode.mockResolvedValue("system");
    getThemeAccentPreset.mockResolvedValue("teal");
    getDebugMode.mockResolvedValue(false);
    getWatchPositionDelay.mockResolvedValue([60, 500]);
    getOsmConsent.mockResolvedValue("unknown");
    getFingerprintEnabled.mockResolvedValue(false);
    getSharedSpoofing.mockResolvedValue(undefined);
    getGlobalFallbackRule.mockResolvedValue(undefined);
    getPreferences.mockResolvedValue(DEFAULT_PREFERENCES);
    getHighContrastMode.mockResolvedValue(false);
  });

  it.each(["Mars/Olympus", "", "   "])(
    "does not mutate storage or caches when timeZone is %j",
    async (timeZone) => {
      const deps = createDeps();
      const handlers = createSettingsHandlers(deps);
      const locations = [
        {
          id: "invalid",
          label: "Invalid preset",
          latitude: 0,
          longitude: 0,
          accuracy: 25,
          noiseRadius: 50,
          language: "en-US",
          languages: ["en-US"],
          timeZone,
        },
      ];
      const saveResult = await handlers.saveLocationModel({
        type: EXTENSION_COMMAND_TYPES.saveLocationModel,
        locations,
        rules: [],
        containerAssignments: [],
      });
      const importResult = await handlers.importSettings({
        type: EXTENSION_COMMAND_TYPES.importSettings,
        settings: {
          version: 3,
          exportedAt: "2026-01-15T12:00:00Z",
          locations,
          rules: [],
        },
      });
      expect(saveResult).toMatchObject({
        ok: false,
        error: expect.stringMatching(/Invalid preset.*invalid.*timeZone/),
      });
      expect(importResult).toMatchObject({
        ok: false,
        error: expect.stringMatching(/Invalid preset.*invalid.*timeZone/),
      });
      for (const mutate of [
        saveLocations,
        saveRules,
        saveContainerAssignments,
        savePreferences,
        saveTrustedSites,
        clearSiteSuggestions,
        saveLegacyBehavior,
        deps.ensureStorageMigration,
        deps.setCachedValues,
        deps.syncPreloadedState,
        deps.resyncActiveHeaderRules,
        deps.refreshFxInjectionMode,
      ]) {
        expect(mutate).not.toHaveBeenCalled();
      }
    },
  );

  it("exports active feature flags but omits retired profile data", async () => {
    const { exportSettings } = createSettingsHandlers(createDeps());

    const response = await exportSettings();
    const exported = response.settings as unknown as Record<string, unknown>;

    expect(exported).not.toHaveProperty("behavioralProfiles");
    expect(exported).not.toHaveProperty("behavioralProfilesEnabled");
    expect(exported.featureFlags).toEqual({ temporalApi: false, domainFencing: false });
    expect(exported.locations).toEqual([]);
  });

  it("preserves retired profile data when importing an old backup", async () => {
    const stored: Record<string, unknown> = {};
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: async (keys: string | string[]) =>
            Object.fromEntries(
              (Array.isArray(keys) ? keys : [keys])
                .filter((key) => Object.hasOwn(stored, key))
                .map((key) => [key, stored[key]]),
            ),
          set: async (patch: Record<string, unknown>) => {
            Object.assign(stored, patch);
          },
          remove: async (keys: string | string[]) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key];
          },
        },
      },
    });
    const { importSettings } = createSettingsHandlers(createDeps());
    const profiles = [{ id: "legacy-profile", opaque: true }];

    const response = await importSettings({
      type: EXTENSION_COMMAND_TYPES.importSettings,
      settings: {
        version: 2,
        exportedAt: "2026-03-22T12:00:00.000Z",
        locations: [
          {
            id: "warsaw",
            label: "Warsaw",
            latitude: 52.2297,
            longitude: 21.0122,
            accuracy: 25,
            noiseRadius: 50,
            language: "pl-PL",
            languages: ["pl-PL", "pl"],
            timeZone: "Europe/Warsaw",
            behaviorProfileId: "legacy-profile",
          },
        ],
        rules: [],
        featureFlags: { behavioralProfiles: true },
        behavioralProfiles: profiles,
      },
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
    expect(stored.behavioralProfiles).toEqual(profiles);
    expect(stored[EXTENSION_STORAGE_KEYS.locations]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "warsaw", behaviorProfileId: "legacy-profile" }),
      ]),
    );
  });

  it("clears retired profile data on an explicit reset", async () => {
    const { resetSettings } = createSettingsHandlers(createDeps());

    await resetSettings();

    expect(clearLegacyBehavior).toHaveBeenCalledOnce();
  });

  it("reloads tabs whose trusted-site status changes", async () => {
    const previousTrustedSites = [{ pattern: "shop.example.com", enabled: true }];
    const nextTrustedSites = [{ pattern: "shop.example.com", enabled: false }];
    const activeTabContexts: EffectiveTabContext[] = [
      { tabId: 7, hostname: "shop.example.com" },
      { tabId: 8, hostname: "news.example.com" },
    ];
    const reloadTabs = vi.fn<(_: readonly number[]) => Promise<void>>(
      async () => undefined,
    );
    const syncPreloadedState = vi.fn<() => Promise<void>>(async () => undefined);
    const resyncActiveHeaderRules = vi.fn<() => Promise<void>>(async () => undefined);

    const { saveSimpleSettings } = createSettingsHandlers({
      ensureStorageMigration: async () => undefined,
      syncPreloadedState,
      resyncActiveHeaderRules,
      refreshFxInjectionMode: async () => undefined,
      getActiveTabContexts: () => activeTabContexts,
      reloadTabs,
      getCachedValues: () => buildCachedValues(previousTrustedSites),
      setCachedValues: vi.fn(),
    });

    const response = await saveSimpleSettings({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      trustedSites: nextTrustedSites,
    });

    expect(response.ok).toBe(true);
    expect(saveTrustedSites).toHaveBeenCalledWith(nextTrustedSites);
    expect(syncPreloadedState).toHaveBeenCalledOnce();
    expect(resyncActiveHeaderRules).toHaveBeenCalledOnce();
    expect(reloadTabs).toHaveBeenCalledWith([7]);
  });

  it("skips reloading tabs when a hostname remains trusted", async () => {
    const previousTrustedSites = [{ pattern: "*.example.com", enabled: true }];
    const nextTrustedSites = [
      { pattern: "*.example.com", enabled: true },
      { pattern: "shop.example.com", enabled: true },
    ];
    const activeTabContexts: EffectiveTabContext[] = [
      { tabId: 7, hostname: "shop.example.com" },
      { tabId: 8, hostname: "news.example.com" },
    ];
    const reloadTabs = vi.fn<(_: readonly number[]) => Promise<void>>(
      async () => undefined,
    );

    const { saveSimpleSettings } = createSettingsHandlers({
      ensureStorageMigration: async () => undefined,
      syncPreloadedState: async () => undefined,
      resyncActiveHeaderRules: async () => undefined,
      refreshFxInjectionMode: async () => undefined,
      getActiveTabContexts: () => activeTabContexts,
      reloadTabs,
      getCachedValues: () => buildCachedValues(previousTrustedSites),
      setCachedValues: vi.fn(),
    });

    const response = await saveSimpleSettings({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      trustedSites: nextTrustedSites,
    });

    expect(response.ok).toBe(true);
    expect(reloadTabs).not.toHaveBeenCalled();
  });

  it("reloads active tabs when SharedWorker compatibility mode changes", async () => {
    const activeTabContexts: EffectiveTabContext[] = [
      { tabId: 7, hostname: "messenger.example.com" },
      { tabId: 8, hostname: "news.example.com" },
    ];
    const reloadTabs = vi.fn<(_: readonly number[]) => Promise<void>>(
      async () => undefined,
    );
    const syncPreloadedState = vi.fn<() => Promise<void>>(async () => undefined);

    const { saveSimpleSettings } = createSettingsHandlers({
      ensureStorageMigration: async () => undefined,
      syncPreloadedState,
      resyncActiveHeaderRules: async () => undefined,
      refreshFxInjectionMode: async () => undefined,
      getActiveTabContexts: () => activeTabContexts,
      reloadTabs,
      getCachedValues: () => buildCachedValues([]),
      setCachedValues: vi.fn(),
    });

    const response = await saveSimpleSettings({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      sharedWorkerCompatibilityMode: false,
    });

    expect(response.ok).toBe(true);
    expect(syncPreloadedState).toHaveBeenCalledOnce();
    expect(reloadTabs).toHaveBeenCalledWith([7, 8]);
  });

  it("merges and applies Temporal feature flag changes", async () => {
    const reloadTabs = vi.fn(async (_tabIds: readonly number[]) => undefined);
    const setCachedValues = vi.fn();
    const { saveSimpleSettings } = createSettingsHandlers({
      ensureStorageMigration: async () => undefined,
      syncPreloadedState: async () => undefined,
      resyncActiveHeaderRules: async () => undefined,
      refreshFxInjectionMode: async () => undefined,
      getActiveTabContexts: () => [{ tabId: 9, hostname: "example.com" }],
      reloadTabs,
      getCachedValues: () => buildCachedValues([]),
      setCachedValues,
    });

    const response = await saveSimpleSettings({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      featureFlags: { temporalApi: true },
    });

    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        featureFlags: { temporalApi: true, domainFencing: false },
      }),
    );
    expect(savePreferences).toHaveBeenCalledWith({
      featureFlags: { temporalApi: true, domainFencing: false },
    });
    expect(setCachedValues).toHaveBeenCalledWith(
      expect.objectContaining({
        featureFlags: { temporalApi: true, domainFencing: false },
      }),
    );
    expect(reloadTabs).toHaveBeenCalledWith([9]);
  });

  it("preserves a newer cached Temporal flag during an unrelated save", async () => {
    const cachedValues = buildCachedValues([]);
    cachedValues.featureFlags = { temporalApi: true, domainFencing: false };
    const setCachedValues = vi.fn();
    const { saveSimpleSettings } = createSettingsHandlers({
      ensureStorageMigration: async () => undefined,
      syncPreloadedState: async () => undefined,
      resyncActiveHeaderRules: async () => undefined,
      refreshFxInjectionMode: async () => undefined,
      getActiveTabContexts: () => [],
      reloadTabs: async () => undefined,
      getCachedValues: () => cachedValues,
      setCachedValues,
    });

    const response = await saveSimpleSettings({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      themeMode: "dark",
    });

    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        featureFlags: { temporalApi: true, domainFencing: false },
      }),
    );
    expect(setCachedValues).toHaveBeenCalledWith(
      expect.objectContaining({
        featureFlags: { temporalApi: true, domainFencing: false },
      }),
    );
  });

  it("preserves shared spoofing when browser surface protections are turned off", async () => {
    const syncPreloadedState = vi.fn<() => Promise<void>>(async () => undefined);
    const resyncActiveHeaderRules = vi.fn<() => Promise<void>>(async () => undefined);
    const setCachedValues = vi.fn();

    const { saveSimpleSettings } = createSettingsHandlers({
      ensureStorageMigration: async () => undefined,
      syncPreloadedState,
      resyncActiveHeaderRules,
      refreshFxInjectionMode: async () => undefined,
      getActiveTabContexts: () => [],
      reloadTabs: async () => undefined,
      getCachedValues: () => buildCachedValues([]),
      setCachedValues,
    });

    const sharedSpoofing = {
      canvas: false,
      navigator: true,
    };
    const response = await saveSimpleSettings({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      browserFingerprintSpoofingEnabled: false,
      sharedSpoofing,
    });

    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        browserFingerprintSpoofingEnabled: false,
        sharedSpoofing,
      }),
    );
    expect(syncPreloadedState).toHaveBeenCalledOnce();
    expect(resyncActiveHeaderRules).toHaveBeenCalledOnce();
    expect(setCachedValues).toHaveBeenCalledWith(
      expect.objectContaining({
        browserFingerprintSpoofingEnabled: false,
        sharedSpoofing,
      }),
    );
  });

  it("writes only preference fields present in the command", async () => {
    const { saveSimpleSettings } = createSettingsHandlers({
      ensureStorageMigration: async () => undefined,
      syncPreloadedState: async () => undefined,
      resyncActiveHeaderRules: async () => undefined,
      refreshFxInjectionMode: async () => undefined,
      getActiveTabContexts: () => [],
      reloadTabs: async () => undefined,
      getCachedValues: () => buildCachedValues([]),
      setCachedValues: vi.fn(),
    });

    await saveSimpleSettings({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      debugMode: true,
    });

    expect(savePreferences).toHaveBeenCalledWith({ debugMode: true });
  });

  it("saves generated preset randomization defaults", async () => {
    const { saveSimpleSettings } = createSettingsHandlers({
      ensureStorageMigration: async () => undefined,
      syncPreloadedState: async () => undefined,
      resyncActiveHeaderRules: async () => undefined,
      refreshFxInjectionMode: async () => undefined,
      getActiveTabContexts: () => [],
      reloadTabs: async () => undefined,
      getCachedValues: () => buildCachedValues([]),
      setCachedValues: vi.fn(),
    });

    const response = await saveSimpleSettings({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      randomizeGeneratedLocationByDefault: false,
      generatedLocationRandomizationRadiusKm: 25,
    });

    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        randomizeGeneratedLocationByDefault: false,
        generatedLocationRandomizationRadiusKm: 25,
      }),
    );
    expect(savePreferences).toHaveBeenCalledWith({
      randomizeGeneratedLocationByDefault: false,
      generatedLocationRandomizationRadiusKm: 25,
    });
  });
});
