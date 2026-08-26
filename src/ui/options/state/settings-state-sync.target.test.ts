import type { SetStateAction } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GetSettingsResponse } from "@/shared/types";
import { applySettingsPayload } from "@/ui/options/state/settings-state-sync";

const createSetter = <T>() => vi.fn<(value: SetStateAction<T>) => void>();

describe("applySettingsPayload", () => {
  it("hydrates settings state, dedupes rules, and resets transient selections", () => {
    const payload: GetSettingsResponse = {
      ok: true,
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
        },
      ],
      rules: [
        {
          pattern: "example.com",
          locationId: "warsaw",
          enabled: true,
        },
        {
          pattern: "EXAMPLE.com",
          locationId: "warsaw",
          enabled: true,
        },
      ],
      trustedSites: [{ pattern: "bank.example.com", enabled: true }],
      themeMode: "dark",
      themeAccentPreset: "blue",
      reduceMotion: true,
      debugMode: true,
      watchPositionDelay: [120, 240],
      osmConsent: "granted",
      browserFingerprintSpoofingEnabled: true,
      featureFlags: { temporalApi: true, domainFencing: false },
      sharedWorkerHandlingMode: "spoof",
      sharedWorkerCompatibilityMode: false,
      sharedSpoofing: undefined,
      highContrastMode: true,
      defaultNoiseRadius: 120,
      randomizeGeneratedLocationByDefault: false,
      generatedLocationRandomizationRadiusKm: 25,
      showBadgeQueryCount: true,
      includeDateCallsInBadgeCount: false,
      notice: null,
    };

    const setters = {
      setProfiles: createSetter<GetSettingsResponse["locations"]>(),
      setRules: createSetter<GetSettingsResponse["rules"]>(),
      setTrustedSites: createSetter<GetSettingsResponse["trustedSites"]>(),
      setThemeMode: createSetter<GetSettingsResponse["themeMode"]>(),
      setThemeAccentPreset: createSetter<GetSettingsResponse["themeAccentPreset"]>(),
      setDebugMode: createSetter<GetSettingsResponse["debugMode"]>(),
      setWatchPositionDelay: createSetter<GetSettingsResponse["watchPositionDelay"]>(),
      setOsmConsent: createSetter<GetSettingsResponse["osmConsent"]>(),
      setFingerprintSpoofing:
        createSetter<GetSettingsResponse["browserFingerprintSpoofingEnabled"]>(),
      setFeatureFlags: createSetter<GetSettingsResponse["featureFlags"]>(),
      setWorkerMode: createSetter<GetSettingsResponse["sharedWorkerHandlingMode"]>(),
      setWorkerCompat:
        createSetter<GetSettingsResponse["sharedWorkerCompatibilityMode"]>(),
      setSharedSpoofing: createSetter<GetSettingsResponse["sharedSpoofing"]>(),
      setGlobalFallbackRule: createSetter<GetSettingsResponse["globalFallbackRule"]>(),
      setHighContrastMode: createSetter<GetSettingsResponse["highContrastMode"]>(),
      setDefaultNoiseRadius: createSetter<GetSettingsResponse["defaultNoiseRadius"]>(),
      setRandomizeDefault:
        createSetter<GetSettingsResponse["randomizeGeneratedLocationByDefault"]>(),
      setRadiusKm:
        createSetter<GetSettingsResponse["generatedLocationRandomizationRadiusKm"]>(),
      setShowBadgeQueryCount:
        createSetter<GetSettingsResponse["showBadgeQueryCount"]>(),
      setCountDateCalls:
        createSetter<GetSettingsResponse["includeDateCallsInBadgeCount"]>(),
      setContainerAssignments:
        createSetter<NonNullable<GetSettingsResponse["containerAssignments"]>>(),
      setSelectedRulePatterns: createSetter<Set<string>>(),
    };

    applySettingsPayload(payload, setters);

    expect(setters.setProfiles).toHaveBeenCalledWith(payload.locations);
    expect(setters.setRules).toHaveBeenCalledWith([
      {
        pattern: "example.com",
        locationId: "warsaw",
        enabled: true,
      },
    ]);
    expect(setters.setTrustedSites).toHaveBeenCalledWith(payload.trustedSites);
    expect(setters.setThemeMode).toHaveBeenCalledWith("dark");
    expect(setters.setWorkerCompat).toHaveBeenCalledWith(false);
    expect(setters.setFeatureFlags).toHaveBeenCalledWith({
      temporalApi: true,
      domainFencing: false,
    });
    expect(setters.setGlobalFallbackRule).toHaveBeenCalledWith(undefined);
    expect(setters.setDefaultNoiseRadius).toHaveBeenCalledWith(120);
    expect(setters.setRandomizeDefault).toHaveBeenCalledWith(false);
    expect(setters.setRadiusKm).toHaveBeenCalledWith(25);
    expect(setters.setCountDateCalls).toHaveBeenCalledWith(false);
    expect(setters.setContainerAssignments).toHaveBeenCalledWith([]);
    expect(setters.setSelectedRulePatterns).toHaveBeenCalledTimes(1);
    expect(setters.setSelectedRulePatterns.mock.calls[0]?.[0]).toEqual(new Set());
  });
});
