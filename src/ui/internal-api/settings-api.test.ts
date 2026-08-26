import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type {
  DomainRule,
  ExportedSettings,
  GetSettingsResponse,
  Location,
  SaveLocationResponse,
  SaveSettingsResponse,
  TrustedSite,
} from "@/shared/types";
import {
  createSettingsAPI,
  installSettingsAPI,
  type SettingsAPI,
} from "@/ui/internal-api/settings-api";

const sendMessage = vi.fn<(_: unknown) => Promise<unknown>>();

const locationWarsaw: Location = {
  id: "warsaw",
  label: "Warsaw",
  latitude: 52.2297,
  longitude: 21.0122,
  accuracy: 25,
  noiseRadius: 50,
  language: "pl-PL",
  languages: ["pl-PL", "pl"],
  timeZone: "Europe/Warsaw",
};

const locationParis: Location = {
  id: "paris",
  label: "Paris",
  latitude: 48.8566,
  longitude: 2.3522,
  accuracy: 25,
  noiseRadius: 50,
  language: "fr-FR",
  languages: ["fr-FR", "fr"],
  timeZone: "Europe/Paris",
};

const ruleExample: DomainRule = {
  pattern: "example.com",
  enabled: true,
  locationId: "warsaw",
};

const trustedSite: TrustedSite = {
  pattern: "bank.example",
  enabled: true,
};

const baseSettings = (
  overrides: Partial<GetSettingsResponse> = {},
): GetSettingsResponse => ({
  ok: true,
  locations: [locationWarsaw],
  rules: [ruleExample],
  trustedSites: [trustedSite],
  themeMode: "system",
  themeAccentPreset: "teal",
  reduceMotion: false,
  debugMode: false,
  watchPositionDelay: [60, 500],
  osmConsent: "unknown",
  browserFingerprintSpoofingEnabled: true,
  featureFlags: { temporalApi: false, domainFencing: false },
  sharedWorkerHandlingMode: "native",
  sharedWorkerCompatibilityMode: true,
  containerAssignments: [],
  highContrastMode: false,
  defaultNoiseRadius: 50,
  randomizeGeneratedLocationByDefault: true,
  generatedLocationRandomizationRadiusKm: 10,
  showBadgeQueryCount: true,
  includeDateCallsInBadgeCount: true,
  onboardingCompleted: true,
  notice: null,
  ...overrides,
});

const saveSimpleOk = (
  overrides: Partial<Extract<SaveSettingsResponse, { ok: true }>> = {},
): SaveSettingsResponse => ({
  ok: true,
  themeMode: "system",
  themeAccentPreset: "teal",
  reduceMotion: false,
  debugMode: false,
  watchPositionDelay: [60, 500],
  osmConsent: "unknown",
  browserFingerprintSpoofingEnabled: true,
  featureFlags: { temporalApi: false, domainFencing: false },
  sharedWorkerHandlingMode: "native",
  sharedWorkerCompatibilityMode: true,
  trustedSites: [trustedSite],
  highContrastMode: false,
  defaultNoiseRadius: 50,
  randomizeGeneratedLocationByDefault: true,
  generatedLocationRandomizationRadiusKm: 10,
  showBadgeQueryCount: true,
  includeDateCallsInBadgeCount: true,
  ...overrides,
});

const saveLocationOk = (
  overrides: Partial<Extract<SaveLocationResponse, { ok: true }>> = {},
): SaveLocationResponse => ({
  ok: true,
  locations: [locationWarsaw],
  rules: [ruleExample],
  containerAssignments: [],
  ...overrides,
});

describe("Privacy Thing internal settings API", () => {
  let api: SettingsAPI;

  beforeEach(() => {
    vi.stubGlobal("chrome", {
      runtime: {
        id: "abc",
        sendMessage,
      },
    });
    sendMessage.mockReset();
    api = createSettingsAPI();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gets, sets, and toggles boolean settings through background commands", async () => {
    sendMessage
      .mockResolvedValueOnce(baseSettings({ browserFingerprintSpoofingEnabled: true }))
      .mockResolvedValueOnce(saveSimpleOk({ browserFingerprintSpoofingEnabled: false }))
      .mockResolvedValueOnce(baseSettings({ browserFingerprintSpoofingEnabled: false }))
      .mockResolvedValueOnce(saveSimpleOk({ browserFingerprintSpoofingEnabled: true }));

    await expect(api.booleans.get("browserFingerprintSpoofingEnabled")).resolves.toBe(
      true,
    );
    await expect(
      api.booleans.set("browserFingerprintSpoofingEnabled", false),
    ).resolves.toMatchObject({ ok: true, browserFingerprintSpoofingEnabled: false });
    await expect(
      api.booleans.toggle("browserFingerprintSpoofingEnabled"),
    ).resolves.toMatchObject({ ok: true, browserFingerprintSpoofingEnabled: true });

    expect(sendMessage).toHaveBeenNthCalledWith(1, {
      type: EXTENSION_COMMAND_TYPES.getSettings,
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      browserFingerprintSpoofingEnabled: false,
    });
    expect(sendMessage).toHaveBeenNthCalledWith(4, {
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      browserFingerprintSpoofingEnabled: true,
    });
  });

  it("exposes generated preset randomization preferences through SettingsAPI", async () => {
    sendMessage
      .mockResolvedValueOnce(
        baseSettings({ randomizeGeneratedLocationByDefault: true }),
      )
      .mockResolvedValueOnce(
        saveSimpleOk({ randomizeGeneratedLocationByDefault: false }),
      )
      .mockResolvedValueOnce(
        saveSimpleOk({
          randomizeGeneratedLocationByDefault: false,
          generatedLocationRandomizationRadiusKm: 25,
        }),
      );

    await expect(api.booleans.get("randomizeGeneratedLocationByDefault")).resolves.toBe(
      true,
    );
    await expect(
      api.booleans.set("randomizeGeneratedLocationByDefault", false),
    ).resolves.toMatchObject({
      ok: true,
      randomizeGeneratedLocationByDefault: false,
    });
    await expect(
      api.preferences.patch({
        randomizeGeneratedLocationByDefault: false,
        generatedLocationRandomizationRadiusKm: 25,
      }),
    ).resolves.toMatchObject({
      ok: true,
      randomizeGeneratedLocationByDefault: false,
      generatedLocationRandomizationRadiusKm: 25,
    });

    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      randomizeGeneratedLocationByDefault: false,
    });
    expect(sendMessage).toHaveBeenNthCalledWith(3, {
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      randomizeGeneratedLocationByDefault: false,
      generatedLocationRandomizationRadiusKm: 25,
    });
  });

  it("exports and imports generated preset randomization preferences", async () => {
    const exportedSettings: ExportedSettings = {
      version: 3,
      exportedAt: new Date("2026-06-19T00:00:00.000Z").toISOString(),
      locations: [locationWarsaw],
      rules: [ruleExample],
      trustedSites: [trustedSite],
      randomizeGeneratedLocationByDefault: false,
      generatedLocationRandomizationRadiusKm: 25,
    };
    sendMessage
      .mockResolvedValueOnce({
        ok: true,
        settings: exportedSettings,
      })
      .mockResolvedValueOnce({
        ...baseSettings({
          randomizeGeneratedLocationByDefault: false,
          generatedLocationRandomizationRadiusKm: 25,
        }),
      });

    await expect(api.export()).resolves.toMatchObject({
      randomizeGeneratedLocationByDefault: false,
      generatedLocationRandomizationRadiusKm: 25,
    });
    await expect(api.import(exportedSettings)).resolves.toMatchObject({
      ok: true,
      randomizeGeneratedLocationByDefault: false,
      generatedLocationRandomizationRadiusKm: 25,
    });

    expect(sendMessage).toHaveBeenNthCalledWith(1, {
      type: EXTENSION_COMMAND_TYPES.exportSettings,
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      type: EXTENSION_COMMAND_TYPES.importSettings,
      settings: exportedSettings,
    });
  });

  it("creates collection items through saveLocationModel while preserving siblings", async () => {
    sendMessage
      .mockResolvedValueOnce(baseSettings())
      .mockResolvedValueOnce(
        saveLocationOk({
          locations: [locationWarsaw, locationParis],
          rules: [ruleExample],
        }),
      )
      .mockResolvedValueOnce(
        baseSettings({ locations: [locationWarsaw, locationParis] }),
      );

    await expect(api.collections.create("locations", locationParis)).resolves.toEqual(
      locationParis,
    );

    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      type: EXTENSION_COMMAND_TYPES.saveLocationModel,
      locations: [locationWarsaw, locationParis],
      rules: [ruleExample],
      containerAssignments: [],
    });
  });

  it("updates rule collections by normalized pattern id", async () => {
    const updatedRule: DomainRule = {
      ...ruleExample,
      enabled: false,
    };
    sendMessage
      .mockResolvedValueOnce(baseSettings())
      .mockResolvedValueOnce(saveLocationOk({ rules: [updatedRule] }))
      .mockResolvedValueOnce(baseSettings({ rules: [updatedRule] }));

    await expect(
      api.collections.update("rules", "Example.COM", { enabled: false }),
    ).resolves.toEqual(updatedRule);

    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      type: EXTENSION_COMMAND_TYPES.saveLocationModel,
      locations: [locationWarsaw],
      rules: [updatedRule],
      containerAssignments: [],
    });
  });

  it("replaces trusted sites through saveSimpleSettings", async () => {
    const nextTrustedSites = [
      trustedSite,
      {
        pattern: "docs.example",
        enabled: true,
      },
    ];
    sendMessage.mockResolvedValueOnce(baseSettings()).mockResolvedValueOnce(
      saveSimpleOk({
        trustedSites: nextTrustedSites,
      }),
    );

    await expect(
      api.collections.replace("trustedSites", nextTrustedSites),
    ).resolves.toMatchObject({ ok: true, trustedSites: nextTrustedSites });

    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      trustedSites: nextTrustedSites,
    });
  });

  it("throws for item-returning collection mutations when background rejects the write", async () => {
    sendMessage.mockResolvedValueOnce(baseSettings()).mockResolvedValueOnce({
      ok: false,
      error: "Unknown locationId referenced by rule: missing",
    });

    await expect(
      api.collections.create("rules", {
        pattern: "bad.example",
        enabled: true,
        locationId: "missing",
      }),
    ).rejects.toThrow("Unknown locationId referenced by rule: missing");
  });

  it("sets and clears nullable settings through simple-setting patches", async () => {
    const fallback = {
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "seed",
    };
    sendMessage
      .mockResolvedValueOnce(saveSimpleOk({ globalFallbackRule: fallback }))
      .mockResolvedValueOnce(saveSimpleOk());

    await api.nullable.set("globalFallbackRule", fallback);
    await api.nullable.clear("globalFallbackRule");

    expect(sendMessage).toHaveBeenNthCalledWith(1, {
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      globalFallbackRule: fallback,
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      globalFallbackRule: undefined,
    });
  });

  it("installs SettingsAPI only once on extension pages", () => {
    const target: {
      SettingsAPI?: SettingsAPI;
      location: Pick<globalThis.Location, "protocol">;
    } = {
      location: { protocol: "chrome-extension:" },
    };

    const firstInstall = installSettingsAPI(target);
    const secondInstall = installSettingsAPI(target);

    expect(firstInstall?.version).toBe(1);
    expect(secondInstall).toBe(firstInstall);
    expect(target.SettingsAPI).toBe(firstInstall);
  });
});
