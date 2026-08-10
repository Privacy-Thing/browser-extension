// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePlaygroundState } from "./usePlaygroundState";

import type { Location } from "@/shared/types";

const {
  collectFingerprintMock,
  installGeoPatchMock,
  toRuntimeSnapshotMock,
  useSettingsMock,
} = vi.hoisted(() => ({
  collectFingerprintMock: vi.fn(async () => null),
  installGeoPatchMock: vi.fn(),
  toRuntimeSnapshotMock: vi.fn(() => ({
    watchPositionDelay: [60, 500] as [number, number],
  })),
  useSettingsMock: vi.fn(),
}));

vi.mock("@/background/rules/resolver", () => ({
  toRuntimeSnapshot: toRuntimeSnapshotMock,
}));

vi.mock("@/injection/main/early-runtime", () => ({
  installGeolocationPatch: installGeoPatchMock,
}));

vi.mock("@/ui/options/components/playground/snapshot-sim", () => ({
  createSpoofedRuntime: vi.fn(() => ({})),
  getSystemValues: vi.fn(() => ({})),
}));

vi.mock("@/ui/options/state/SettingsContext", () => ({
  useSettings: useSettingsMock,
}));

vi.mock("@/ui/shared/fingerprint-collector", () => ({
  collectFingerprint: collectFingerprintMock,
}));

const profile: Location = {
  id: "warsaw",
  label: "Warsaw",
  latitude: 52.2297,
  longitude: 21.0122,
  accuracy: 20,
  noiseRadius: 50,
  language: "pl-PL",
  languages: ["pl-PL", "pl"],
  timeZone: "Europe/Warsaw",
};

const createPosition = (
  latitude: number,
  longitude: number,
  accuracy: number,
): GeolocationPosition => ({
  coords: {
    latitude,
    longitude,
    accuracy,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({}),
  },
  timestamp: 1,
  toJSON: () => ({}),
});

describe("usePlaygroundState", () => {
  let root: Root | null = null;
  let watchPositionCallback: PositionCallback | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        clearWatch: vi.fn(),
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn((callback: PositionCallback) => {
          watchPositionCallback = callback;
          return 1;
        }),
      },
    });
    useSettingsMock.mockReturnValue({
      settingsLoaded: true,
      profiles: [profile],
      debugMode: false,
      watchPositionDelay: [60, 500],
      osmConsent: "denied",
      browserFingerprintSpoofingEnabled: true,
      sharedSpoofing: undefined,
      navigateToAnchor: vi.fn(),
      openOsmDialog: vi.fn(),
    });
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    watchPositionCallback = null;
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    vi.clearAllMocks();
  });

  it("retains distinct batched callbacks and deduplicates identical consecutive points", async () => {
    const Harness = () => {
      const state = usePlaygroundState();
      return createElement(
        "button",
        {
          id: "select-location",
          onClick: () => state.handleSelectLocation(profile.id),
        },
        JSON.stringify(state.tracePoints),
      );
    };

    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }
    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(Harness));
    });

    const selectButton = document.getElementById("select-location");
    if (!(selectButton instanceof HTMLButtonElement)) {
      throw new Error("Missing select button.");
    }
    await act(async () => {
      selectButton.click();
    });

    expect(watchPositionCallback).not.toBeNull();
    await act(async () => {
      watchPositionCallback?.(createPosition(52.23, 21.013, 18));
      watchPositionCallback?.(createPosition(52.23, 21.013, 18));
      watchPositionCallback?.(createPosition(52.231, 21.014, 17));
    });

    expect(JSON.parse(selectButton.textContent ?? "[]")).toEqual([
      {
        latitude: profile.latitude,
        longitude: profile.longitude,
        accuracy: profile.accuracy,
      },
      { latitude: 52.23, longitude: 21.013, accuracy: 18 },
      { latitude: 52.231, longitude: 21.014, accuracy: 17 },
    ]);
  });
});
