import { cloneRuntimeSnapshot } from "@privacy-brand/refract-core/runtime/snapshot-clone";
import { describe, expect, it } from "vitest";

import {
  hasRuntimeLocationData,
  hasRuntimePayload,
  isRuntimeSnapshot,
} from "@/shared/runtime-snapshot";
import type { RuntimeSnapshot } from "@/shared/types";

const createRuntimeSnapshot = (
  overrides: Partial<RuntimeSnapshot> = {},
): RuntimeSnapshot => ({
  geo: { latitude: 10, longitude: 20, accuracy: 30, noiseRadius: 40 },
  locale: {
    language: "en-US",
    languages: ["en-US", "en"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "en-US,en;q=0.9",
  },
  date: {
    baseEpochMs: 1_700_000_000_000,
    offsetMs: 3_600_000,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [60, 500],
  ...overrides,
});

describe("isRuntimeSnapshot", () => {
  it("accepts a structurally valid runtime snapshot", () => {
    expect(
      isRuntimeSnapshot({
        geo: {
          latitude: 10,
          longitude: 20,
          accuracy: 30,
          noiseRadius: 40,
        },
        locale: {
          language: "en-US",
          languages: ["en-US", "en"],
          timeZone: "Europe/Warsaw",
          acceptLanguage: "en-US,en;q=0.9",
        },
        date: {
          baseEpochMs: 1_700_000_000_000,
          offsetMs: 3_600_000,
          timeZone: "Europe/Warsaw",
        },
        debugMode: false,
        watchPositionDelay: [60, 500],
        sharedWorkerCompatibilityMode: false,
      }),
    ).toBe(true);
  });

  it("validates and clones the optional Temporal runtime gate", () => {
    const snapshot = createRuntimeSnapshot({ temporalApiEnabled: true });
    expect(isRuntimeSnapshot(snapshot)).toBe(true);
    expect(cloneRuntimeSnapshot(snapshot).temporalApiEnabled).toBe(true);
    expect(isRuntimeSnapshot({ ...snapshot, temporalApiEnabled: "yes" })).toBe(false);
  });

  it("validates private arrays without invoking page-owned array hooks", () => {
    const snapshot = cloneRuntimeSnapshot({
      geo: { latitude: 10, longitude: 20, accuracy: 30, noiseRadius: 40 },
      locale: {
        language: "en-US",
        languages: ["en-US", "en"],
        timeZone: "Europe/Warsaw",
        acceptLanguage: "en-US,en;q=0.9",
      },
      date: {
        baseEpochMs: 1_700_000_000_000,
        offsetMs: 3_600_000,
        timeZone: "Europe/Warsaw",
      },
      debugMode: false,
      watchPositionDelay: [60, 500],
    });
    const nativeIsArray = Array.isArray;
    const nativeEvery = Array.prototype.every;
    let leakedArray: unknown;
    Array.isArray = (value: unknown): value is unknown[] => {
      leakedArray = value;
      return nativeIsArray(value);
    };
    Array.prototype.every = function () {
      throw new Error("page-owned every invoked");
    } as unknown as typeof Array.prototype.every;

    try {
      expect(isRuntimeSnapshot(snapshot)).toBe(true);
    } finally {
      Array.isArray = nativeIsArray;
      Array.prototype.every = nativeEvery;
    }
    expect(leakedArray).toBeUndefined();
  });

  it("rejects malformed runtime snapshots", () => {
    expect(
      isRuntimeSnapshot({
        geo: {
          latitude: "10",
          longitude: 20,
          accuracy: 30,
          noiseRadius: 40,
        },
        locale: {
          language: "en-US",
          languages: ["en-US"],
          timeZone: "Europe/Warsaw",
          acceptLanguage: "en-US",
        },
        date: {
          baseEpochMs: 1_700_000_000_000,
          offsetMs: 3_600_000,
          timeZone: "Europe/Warsaw",
        },
        debugMode: false,
        watchPositionDelay: [60, 500],
      }),
    ).toBe(false);

    expect(
      isRuntimeSnapshot({
        geo: {
          latitude: 10,
          longitude: 20,
          accuracy: 30,
          noiseRadius: 40,
        },
        locale: {
          language: "en-US",
          languages: ["en-US", 10],
          timeZone: "Europe/Warsaw",
          acceptLanguage: "en-US",
        },
        date: {
          baseEpochMs: 1_700_000_000_000,
          offsetMs: 3_600_000,
          timeZone: "Europe/Warsaw",
        },
        debugMode: false,
        watchPositionDelay: [60, 500],
      }),
    ).toBe(false);

    expect(
      isRuntimeSnapshot({
        geo: {
          latitude: 10,
          longitude: 20,
          accuracy: 30,
          noiseRadius: 40,
        },
        locale: {
          language: "en-US",
          languages: ["en-US"],
          timeZone: "Europe/Warsaw",
          acceptLanguage: "en-US",
        },
        date: {
          baseEpochMs: 1_700_000_000_000,
          offsetMs: 3_600_000,
          timeZone: "Europe/Warsaw",
        },
        debugMode: false,
        watchPositionDelay: [60, 500],
        sharedWorkerCompatibilityMode: "no",
      }),
    ).toBe(false);
  });
});

describe("hasRuntimeLocationData", () => {
  it("returns true for snapshots with valid location fields", () => {
    const snapshot = {
      geo: {
        latitude: 10,
        longitude: 20,
        accuracy: 30,
        noiseRadius: 40,
      },
      locale: {
        language: "en-US",
        languages: ["en-US", "en"],
        timeZone: "Europe/Warsaw",
        acceptLanguage: "en-US,en;q=0.9",
      },
      date: {
        baseEpochMs: 1_700_000_000_000,
        offsetMs: 3_600_000,
        timeZone: "Europe/Warsaw",
      },
      debugMode: false,
      watchPositionDelay: [60, 500],
    } satisfies RuntimeSnapshot;

    expect(hasRuntimeLocationData(snapshot)).toBe(true);
  });

  it("returns false when any runtime location field is malformed", () => {
    const snapshot = {
      geo: {
        latitude: 10,
        longitude: 20,
        accuracy: 30,
        noiseRadius: 40,
      },
      locale: {
        language: "en-US",
        languages: ["en-US", "en"],
        timeZone: "Europe/Warsaw",
        acceptLanguage: "en-US,en;q=0.9",
      },
      date: {
        baseEpochMs: "bad",
        offsetMs: 3_600_000,
        timeZone: "Europe/Warsaw",
      },
      debugMode: false,
      watchPositionDelay: [60, 500],
    } as unknown as Parameters<typeof hasRuntimeLocationData>[0];

    expect(hasRuntimeLocationData(snapshot)).toBe(false);
  });
});

describe("hasRuntimePayload", () => {
  it("rejects a fingerprint payload when every fingerprint surface is native", () => {
    expect(
      hasRuntimePayload(
        createRuntimeSnapshot({
          fingerprint: {
            spoofingToggles: {
              canvas: false,
              webGL: false,
              audio: false,
              navigator: false,
              screen: false,
              clientHints: false,
              battery: false,
              webRTC: false,
            },
          },
          geolocationEnabled: false,
          timeLocaleEnabled: false,
          sharedWorkerHandlingMode: "native",
        }),
      ),
    ).toBe(false);
  });

  it("keeps a payload when any fingerprint surface is active", () => {
    expect(
      hasRuntimePayload(
        createRuntimeSnapshot({
          fingerprint: {
            spoofingToggles: {
              canvas: false,
              webGL: false,
              audio: false,
              navigator: true,
              screen: false,
              clientHints: false,
              battery: false,
              webRTC: false,
            },
          },
          geolocationEnabled: false,
          timeLocaleEnabled: false,
          sharedWorkerHandlingMode: "native",
        }),
      ),
    ).toBe(true);
  });

  it("keeps a payload for non-native worker handling", () => {
    expect(
      hasRuntimePayload(
        createRuntimeSnapshot({
          geolocationEnabled: false,
          timeLocaleEnabled: false,
          sharedWorkerHandlingMode: "spoof",
        }),
      ),
    ).toBe(true);
  });
});
