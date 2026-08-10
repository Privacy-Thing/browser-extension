import { describe, expect, it } from "vitest";

import {
  validateImportedSettings,
  validateSettingsCommand,
  validateSettings,
} from "@/background/settings";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { DomainRule } from "@/shared/types";

describe("validateSettings", () => {
  it("normalizes rules and locations", () => {
    const result = validateSettings(
      [
        {
          id: "warsaw",
          label: "Warsaw",
          latitude: 52.2297,
          longitude: 21.0122,
          accuracy: 25,
          noiseRadius: 50,
          language: "pl-PL ",
          languages: ["pl-PL ", "pl"],
          timeZone: " Europe/Warsaw ",
        },
      ],
      [{ pattern: " EXAMPLE.COM ", locationId: "warsaw", enabled: true }],
    );

    expect(result.locations[0]?.language).toBe("pl");
    expect(result.locations[0]?.languages).toEqual(["pl"]);
    expect(result.rules[0]?.pattern).toBe("example.com");
    expect(result.rules[0]?.ruleSeedKey).toMatch(/^[a-z0-9]{6}$/);
    expect(result.rules[0]?.authKey).toMatch(/^[a-z0-9]{8}$/);
  });

  it("preserves auth keys when saving the complete location model", () => {
    const result = validateSettings(
      [
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
      [
        {
          pattern: "changed.example.com",
          locationId: "warsaw",
          enabled: false,
          ruleSeedKey: "abc123",
          authKey: "keep0001",
        },
        {
          pattern: "unrelated.example.net",
          locationId: "warsaw",
          enabled: true,
          ruleSeedKey: "def456",
          authKey: "keep0002",
        },
      ],
    );

    expect(result.rules.map((rule) => rule.authKey)).toEqual(["keep0001", "keep0002"]);
  });

  it("rejects rules that reference unknown locations", () => {
    expect(() =>
      validateSettings(
        [
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
        [{ pattern: "example.com", locationId: "missing", enabled: true }],
      ),
    ).toThrow(/Unknown locationId/);
  });

  it("rejects duplicate location ids", () => {
    expect(() =>
      validateSettings(
        [
          {
            id: "dup",
            label: "One",
            latitude: 1,
            longitude: 2,
            accuracy: 3,
            noiseRadius: 50,
            language: "en-US",
            languages: ["en-US"],
            timeZone: "UTC",
          },
          {
            id: "dup",
            label: "Two",
            latitude: 4,
            longitude: 5,
            accuracy: 6,
            noiseRadius: 50,
            language: "en-US",
            languages: ["en-US"],
            timeZone: "UTC",
          },
        ],
        [],
      ),
    ).toThrow(/Duplicate location ids/);
  });

  it("normalizes duplicate rule patterns by keeping the first occurrence", () => {
    const result = validateSettings(
      [
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
      [
        { pattern: "example.com", locationId: "warsaw", enabled: true },
        { pattern: "example.com", locationId: "warsaw", enabled: true },
      ],
    );

    expect(result.rules).toEqual([
      {
        pattern: "example.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: expect.stringMatching(/^[a-z0-9]{6}$/),
        authKey: expect.stringMatching(/^[a-z0-9]{8}$/),
        relaxCspForWorkers: false,
      },
    ]);
  });

  it("accepts valid container assignments", () => {
    const result = validateSettings(
      [
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
      [],
      [{ cookieStoreId: "firefox-container-1", locationId: "warsaw" }],
    );

    expect(result.containerAssignments).toHaveLength(1);
    expect(result.containerAssignments?.[0]).toMatchObject({
      cookieStoreId: "firefox-container-1",
      locationId: "warsaw",
    });
    expect(result.containerAssignments?.[0]?.ruleSeedKey).toMatch(/^[a-z0-9]{6}$/);
  });

  it("accepts container assignments without a location profile when they only store container state", () => {
    const result = validateSettings(
      [
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
      [],
      [
        {
          cookieStoreId: "firefox-container-1",
          fingerprintSurfaceOverrides: { geolocation: false },
        },
      ],
    );

    expect(result.containerAssignments).toEqual([
      expect.objectContaining({
        cookieStoreId: "firefox-container-1",
        fingerprintSurfaceOverrides: {
          geolocation: false,
        },
      }),
    ]);
    expect(result.containerAssignments?.[0]?.locationId).toBeUndefined();
  });

  it("rejects container assignments that reference unknown locations", () => {
    expect(() =>
      validateSettings(
        [
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
        [],
        [{ cookieStoreId: "firefox-container-1", locationId: "missing" }],
      ),
    ).toThrow(/Unknown locationId referenced by container assignment/);
  });

  it("rejects duplicate container assignments for the same cookieStoreId", () => {
    expect(() =>
      validateSettings(
        [
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
        [],
        [
          { cookieStoreId: "firefox-container-1", locationId: "warsaw" },
          { cookieStoreId: "firefox-container-1", locationId: "warsaw" },
        ],
      ),
    ).toThrow(/Duplicate container assignment/);
  });
});

describe("validateImportedSettings", () => {
  it("accepts a well-formed exported settings payload", () => {
    const result = validateImportedSettings({
      version: 1,
      exportedAt: "2026-03-22T12:00:00.000Z",
      locations: [
        {
          id: "warsaw",
          label: "Warsaw",
          latitude: 52.2297,
          longitude: 21.0122,
          accuracy: 25,
          noiseRadius: 50,
          language: "pl-PL ",
          languages: ["pl-PL ", "pl"],
          timeZone: " Europe/Warsaw ",
        },
      ],
      rules: [{ pattern: " EXAMPLE.COM ", locationId: "warsaw", enabled: true }],
      themeMode: "dark",
      themeAccentPreset: "purple",
      reduceMotion: true,
      osmConsent: "granted",
      highContrastMode: true,
      randomizeGeneratedLocationByDefault: false,
      generatedLocationRandomizationRadiusKm: 25,
    });

    expect(result.locations[0]?.timeZone).toBe("Europe/Warsaw");
    expect(result.rules[0]?.pattern).toBe("example.com");
    expect(result.rules[0]?.ruleSeedKey).toMatch(/^[a-z0-9]{6}$/);
    expect(result.themeMode).toBe("dark");
    expect(result.themeAccentPreset).toBe("purple");
    expect(result.reduceMotion).toBe(true);
    expect(result.highContrastMode).toBe(true);
    expect(result.randomizeGeneratedLocationByDefault).toBe(false);
    expect(result.generatedLocationRandomizationRadiusKm).toBe(25);
  });

  it("canonicalizes imported locale variants for the active browser target", () => {
    const crossTargetAliasInput = BUILD_BROWSER_TARGET === "chromium" ? "tl" : "fil";
    const crossTargetAliasExpected = BUILD_BROWSER_TARGET === "chromium" ? "fil" : "tl";

    const result = validateImportedSettings({
      version: 2,
      exportedAt: "2026-03-22T12:00:00.000Z",
      locations: [
        {
          id: "portable",
          label: "Portable",
          latitude: 52.2297,
          longitude: 21.0122,
          accuracy: 25,
          noiseRadius: 50,
          language: "pl-PL",
          languages: ["EN_us", crossTargetAliasInput, "zh-Hant-HK"],
          timeZone: "Europe/Warsaw",
        },
      ],
      rules: [],
    });

    expect(result.locations[0]).toMatchObject({
      language: "pl",
      languages: ["pl", "en-US", crossTargetAliasExpected, "zh-HK"],
    });
  });

  it("preserves the English-content preference flag on import", () => {
    const result = validateImportedSettings({
      version: 2,
      exportedAt: "2026-03-22T12:00:00.000Z",
      locations: [
        {
          id: "portable",
          label: "Portable",
          latitude: 52.2297,
          longitude: 21.0122,
          accuracy: 25,
          noiseRadius: 50,
          language: "pl",
          languages: ["pl"],
          preferEnglishContent: true,
          timeZone: "Europe/Warsaw",
        },
      ],
      rules: [],
    });

    expect(result.locations[0]?.preferEnglishContent).toBe(true);
  });

  it("accepts legacy exports without osmConsent", () => {
    const result = validateImportedSettings({
      version: 1,
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
        },
      ],
      rules: [],
    });

    expect(result.locations[0]?.id).toBe("warsaw");
    expect(result.themeMode).toBe("system");
    expect(result.themeAccentPreset).toBe("teal");
  });

  it("normalizes and deduplicates imported trusted sites", () => {
    const result = validateImportedSettings({
      version: 3,
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
        },
      ],
      rules: [],
      trustedSites: [
        { pattern: " BANK.EXAMPLE.COM ", enabled: true },
        { pattern: "bank.example.com", enabled: false },
        { pattern: "*.secure.example.com", enabled: true },
      ],
    });

    expect(result.trustedSites).toEqual([
      { pattern: "bank.example.com", enabled: true },
      { pattern: "*.secure.example.com", enabled: true },
    ]);
  });

  it("preserves retired profile data separately from active settings", () => {
    const profiles = [{ id: "legacy-profile", payload: { cadence: 5000 } }];
    const result = validateImportedSettings({
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
    });

    expect(result.legacyBehavior).toEqual({
      profiles,
      enabled: true,
      refs: [{ id: "warsaw", profileId: "legacy-profile" }],
    });
    expect(result.locations[0]).not.toHaveProperty("behaviorProfileId");
  });

  it("legacy exports without appearance preferences use canonical defaults", () => {
    const result = validateImportedSettings({
      version: 1,
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
        },
      ],
      rules: [],
      themeMode: "light",
    });

    expect(result.highContrastMode).toBe(false);
    expect(result.reduceMotion).toBe(false);
    expect(result.randomizeGeneratedLocationByDefault).toBe(true);
    expect(result.generatedLocationRandomizationRadiusKm).toBe(10);
  });

  it("falls back to system theme when import omits or invalidates themeMode", () => {
    const missingTheme = validateImportedSettings({
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
        },
      ],
      rules: [],
    });

    const invalidTheme = validateImportedSettings({
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
        },
      ],
      rules: [],
      themeMode: "sepia" as unknown as "light",
    });

    expect(missingTheme.themeMode).toBe("system");
    expect(invalidTheme.themeMode).toBe("system");
  });

  it("falls back to teal when import omits or invalidates themeAccentPreset", () => {
    const missingAccent = validateImportedSettings({
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
        },
      ],
      rules: [],
    });

    const invalidAccent = validateImportedSettings({
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
        },
      ],
      rules: [],
      themeAccentPreset: "sepia" as unknown as "teal",
    });

    expect(missingAccent.themeAccentPreset).toBe("teal");
    expect(invalidAccent.themeAccentPreset).toBe("teal");
  });

  it("rejects an unsupported exported settings version", () => {
    const payload = {
      version: 4,
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
        },
      ],
      rules: [],
    } as unknown as Parameters<typeof validateImportedSettings>[0];

    expect(() => validateImportedSettings(payload)).toThrow(
      /Unsupported settings export version/,
    );
  });

  it("accepts v3 exports with the renamed sharedSpoofing key", () => {
    const result = validateImportedSettings({
      version: 3,
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
        },
      ],
      rules: [],
      sharedSpoofing: {
        canvas: false,
        webRTC: true,
      },
    });

    expect(result.sharedSpoofing).toEqual({
      canvas: false,
      webRTC: true,
    });
  });

  it("accepts legacy exported spoofing keys during import", () => {
    const result = validateImportedSettings({
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
        },
      ],
      rules: [],
      experimentalActiveSpoofing: {
        enabled: true,
        audio: false,
      },
    });

    expect(result.sharedSpoofing).toEqual({
      audio: false,
    });
  });

  it("rejects an invalid export timestamp", () => {
    expect(() =>
      validateImportedSettings({
        version: 1,
        exportedAt: "not-a-date",
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
        rules: [],
      }),
    ).toThrow(/Invalid exportedAt timestamp/);
  });
});

describe("validateSettingsCommand", () => {
  it("accepts partial simple settings writes", () => {
    const result = validateSettingsCommand({
      themeAccentPreset: "orange",
      osmConsent: "granted",
      highContrastMode: true,
      highContrastExplicit: true,
    });

    expect(result).toEqual({
      themeAccentPreset: "orange",
      osmConsent: "granted",
      highContrastMode: true,
      highContrastExplicit: true,
    });
  });

  it("accepts trusted-site updates and normalizes their patterns", () => {
    const result = validateSettingsCommand({
      trustedSites: [
        { pattern: " BANK.EXAMPLE.COM ", enabled: true },
        { pattern: "*.secure.example.com", enabled: true },
      ],
    });

    expect(result).toEqual({
      trustedSites: [
        { pattern: "bank.example.com", enabled: true },
        { pattern: "*.secure.example.com", enabled: true },
      ],
    });
  });

  it("normalizes the legacy spoofing key on simple settings writes", () => {
    const result = validateSettingsCommand({
      experimentalActiveSpoofing: {
        enabled: true,
        webGL: false,
      },
    });

    expect(result).toEqual({
      sharedSpoofing: {
        webGL: false,
      },
    });
  });

  it("rejects inverted watchPositionDelay ranges", () => {
    expect(() =>
      validateSettingsCommand({
        watchPositionDelay: [500, 60],
      }),
    ).toThrow(/watchPositionDelay must be ordered/);
  });

  it("rejects non-object runtime inputs at the validation boundary", () => {
    expect(() => validateSettingsCommand("invalid payload")).toThrow();
  });
});

describe("legacy rule normalization", () => {
  it("leaves the serviceWorker override unset for legacy rules without SW block", () => {
    const result = validateSettings(
      [
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
      [{ pattern: "example.com", locationId: "warsaw", enabled: true }],
    );

    expect(result.rules[0]?.fingerprintSurfaceOverrides?.serviceWorker).toBeUndefined();
    expect(result.rules[0]?.ruleSeedKey).toMatch(/^[a-z0-9]{6}$/);
  });

  it("normalizes invalid ruleSeedKey values to six lowercase base36 chars", () => {
    const result = validateSettings(
      [
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
      [
        {
          pattern: "example.com",
          locationId: "warsaw",
          enabled: true,
          ruleSeedKey: "TOO-LONG",
        },
      ],
    );

    expect(result.rules[0]?.ruleSeedKey).toMatch(/^[a-z0-9]{6}$/);
    expect(result.rules[0]?.ruleSeedKey).not.toBe("too-long");
  });

  it("migrates legacy blockServiceWorkerRegistration:true to a serviceWorker override", () => {
    const result = validateSettings(
      [
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
      [
        {
          pattern: "example.com",
          locationId: "warsaw",
          enabled: true,
          // Legacy input field migrated to the serviceWorker surface override.
          blockServiceWorkerRegistration: true,
        } as DomainRule,
      ],
    );

    expect(result.rules[0]?.fingerprintSurfaceOverrides?.serviceWorker).toBe(true);
  });

  it("preserves relaxCspForWorkers when explicitly set", () => {
    const result = validateSettings(
      [
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
      [
        {
          pattern: "example.com",
          locationId: "warsaw",
          enabled: true,
          relaxCspForWorkers: true,
        },
      ],
    );

    expect(result.rules[0]?.relaxCspForWorkers).toBe(true);
  });
});
