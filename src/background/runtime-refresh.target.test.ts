import { describe, expect, it } from "vitest";

import {
  shouldReloadRuntimeTabs,
  shouldSyncHeaderRules,
  shouldSyncPreload,
} from "@/background/runtime-refresh";

describe("shouldSyncPreload", () => {
  it("refreshes preloaded runtime snapshots for watchPositionDelay changes", () => {
    expect(
      shouldSyncPreload({
        watchPositionDelay: [120, 600],
      }),
    ).toBe(true);
  });

  it("refreshes preloaded runtime snapshots for fingerprint flag changes", () => {
    expect(
      shouldSyncPreload({
        browserFingerprintSpoofingEnabled: true,
      }),
    ).toBe(true);

    expect(
      shouldSyncPreload({
        sharedSpoofing: {
          canvas: false,
        },
      }),
    ).toBe(true);

    expect(
      shouldSyncPreload({
        globalFallbackRule: {
          enabled: true,
          locationId: "warsaw",
          ruleSeedKey: "glb123",
        },
      }),
    ).toBe(true);
  });

  it("refreshes preloaded runtime snapshots for debugMode changes", () => {
    expect(
      shouldSyncPreload({
        debugMode: true,
      }),
    ).toBe(true);
  });

  it("ignores simple settings that do not change runtime snapshots", () => {
    expect(
      shouldSyncPreload({
        themeMode: "dark",
        themeAccentPreset: "purple",
        highContrastMode: true,
      }),
    ).toBe(false);
  });
});

describe("shouldReloadRuntimeTabs", () => {
  it("reloads active runtime tabs for SharedWorker compatibility mode changes", () => {
    expect(
      shouldReloadRuntimeTabs({
        sharedWorkerCompatibilityMode: false,
      }),
    ).toBe(true);
  });

  it("does not reload active runtime tabs for display-only settings", () => {
    expect(
      shouldReloadRuntimeTabs({
        themeMode: "dark",
        themeAccentPreset: "purple",
      }),
    ).toBe(false);
  });
});

describe("shouldSyncHeaderRules", () => {
  it("resyncs header rules only for fingerprint-related writes", () => {
    expect(
      shouldSyncHeaderRules({
        browserFingerprintSpoofingEnabled: false,
      }),
    ).toBe(true);

    expect(
      shouldSyncHeaderRules({
        sharedSpoofing: {
          webGL: false,
        },
      }),
    ).toBe(true);

    expect(
      shouldSyncHeaderRules({
        globalFallbackRule: {
          enabled: true,
          locationId: "warsaw",
          ruleSeedKey: "glb123",
        },
      }),
    ).toBe(true);
  });

  it("does not resync header rules for watchPositionDelay-only writes", () => {
    expect(
      shouldSyncHeaderRules({
        watchPositionDelay: [120, 600],
      }),
    ).toBe(false);
  });
});
