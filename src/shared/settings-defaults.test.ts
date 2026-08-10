import { describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES, normalizePreferences } from "@/shared/settings-defaults";

describe("DEFAULT_PREFERENCES", () => {
  it("keeps browser surface protections on by default", () => {
    expect(DEFAULT_PREFERENCES.browserFingerprintSpoofingEnabled).toBe(true);
  });

  it("keeps SharedWorker handling strict by default", () => {
    expect(DEFAULT_PREFERENCES.sharedWorkerHandlingMode).toBe("strict");
    expect(DEFAULT_PREFERENCES.sharedWorkerCompatibilityMode).toBe(false);
  });

  it("keeps motion enabled by default", () => {
    expect(DEFAULT_PREFERENCES.reduceMotion).toBe(false);
  });
});

describe("normalizePreferences", () => {
  it("returns the canonical defaults for empty/invalid input", () => {
    expect(normalizePreferences({})).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences("nonsense")).toEqual(DEFAULT_PREFERENCES);
  });

  it("preserves a deliberate spoofing opt-out", () => {
    expect(
      normalizePreferences({ browserFingerprintSpoofingEnabled: false })
        .browserFingerprintSpoofingEnabled,
    ).toBe(false);
  });

  it("defaults spoofing to on for missing or non-false values", () => {
    expect(normalizePreferences({}).browserFingerprintSpoofingEnabled).toBe(true);
    expect(
      normalizePreferences({ browserFingerprintSpoofingEnabled: "yes" })
        .browserFingerprintSpoofingEnabled,
    ).toBe(true);
  });

  it("preserves a deliberate SharedWorker compatibility mode opt-out", () => {
    const result = normalizePreferences({ sharedWorkerCompatibilityMode: false });
    expect(result.sharedWorkerHandlingMode).toBe("spoof");
    expect(result.sharedWorkerCompatibilityMode).toBe(false);
  });

  it("preserves explicit SharedWorker handling modes", () => {
    expect(
      normalizePreferences({ sharedWorkerHandlingMode: "strict" })
        .sharedWorkerHandlingMode,
    ).toBe("strict");
  });

  it("defaults Date badge call counting to off", () => {
    expect(normalizePreferences({}).includeDateCallsInBadgeCount).toBe(false);
    expect(
      normalizePreferences({ includeDateCallsInBadgeCount: "no" })
        .includeDateCallsInBadgeCount,
    ).toBe(false);
  });

  it("preserves a deliberate Date badge call counting opt-in", () => {
    expect(
      normalizePreferences({ includeDateCallsInBadgeCount: true })
        .includeDateCallsInBadgeCount,
    ).toBe(true);
  });

  it("falls back to defaults for invalid field types", () => {
    const result = normalizePreferences({
      debugMode: "true",
      watchPositionDelay: [10],
      osmConsent: "maybe",
    });

    expect(result.debugMode).toBe(DEFAULT_PREFERENCES.debugMode);
    expect(result.watchPositionDelay).toEqual(DEFAULT_PREFERENCES.watchPositionDelay);
    expect(result.osmConsent).toBe(DEFAULT_PREFERENCES.osmConsent);
  });

  it("preserves valid values", () => {
    const result = normalizePreferences({
      debugMode: true,
      watchPositionDelay: [100, 200],
      osmConsent: "granted",
      browserFingerprintSpoofingEnabled: true,
      sharedWorkerCompatibilityMode: false,
      sharedWorkerHandlingMode: "strict",
      onboardingCompleted: true,
      themeMode: "dark",
      themeAccentPreset: "blue",
      reduceMotion: true,
      highContrastMode: true,
      highContrastExplicit: true,
      defaultNoiseRadius: 120,
      randomizeGeneratedLocationByDefault: false,
      generatedLocationRandomizationRadiusKm: 25,
      includeDateCallsInBadgeCount: true,
    });

    expect(result).toEqual({
      ...DEFAULT_PREFERENCES,
      debugMode: true,
      watchPositionDelay: [100, 200],
      osmConsent: "granted",
      browserFingerprintSpoofingEnabled: true,
      sharedWorkerHandlingMode: "strict",
      sharedWorkerCompatibilityMode: false,
      onboardingCompleted: true,
      themeMode: "dark",
      themeAccentPreset: "blue",
      reduceMotion: true,
      highContrastMode: true,
      highContrastExplicit: true,
      defaultNoiseRadius: 120,
      randomizeGeneratedLocationByDefault: false,
      generatedLocationRandomizationRadiusKm: 25,
      includeDateCallsInBadgeCount: true,
    });
  });

  it("ignores unrelated keys", () => {
    const result = normalizePreferences({ foo: "bar" });
    expect(result).toEqual(DEFAULT_PREFERENCES);
    expect(result).not.toHaveProperty("foo");
  });

  it("rejects invalid theme and default radius values", () => {
    const result = normalizePreferences({
      themeMode: "sepia",
      themeAccentPreset: "sepia",
      defaultNoiseRadius: 501,
      randomizeGeneratedLocationByDefault: "yes",
      generatedLocationRandomizationRadiusKm: 100,
    });

    expect(result.themeMode).toBe(DEFAULT_PREFERENCES.themeMode);
    expect(result.themeAccentPreset).toBe(DEFAULT_PREFERENCES.themeAccentPreset);
    expect(result.defaultNoiseRadius).toBe(DEFAULT_PREFERENCES.defaultNoiseRadius);
    expect(result.randomizeGeneratedLocationByDefault).toBe(true);
    expect(result.generatedLocationRandomizationRadiusKm).toBe(10);
  });
});
