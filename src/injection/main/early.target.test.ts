// @vitest-environment jsdom

import {
  hasEarlyTemporalOwner,
  writeConfigElement,
} from "@privacy-brand/refract-browser/common/runtime-config";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SURFACE_USAGE_TYPE } from "@/shared/build-id-test-values";
import type { RuntimeSnapshot } from "@/shared/types";

const createSnapshot = (): RuntimeSnapshot => ({
  geo: { latitude: 52.23, longitude: 21.01, accuracy: 25, noiseRadius: 100 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl;q=0.9",
  },
  date: {
    baseEpochMs: 0,
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [60, 500],
  authKey: "auth-test",
});

const errorFactoryMocks = vi.hoisted(() => ({
  installPrototypePatch: vi.fn(),
}));

vi.mock("@privacy-brand/refract-core/geolocation/geolocation-error-factory", () => ({
  installGeoErrorPrototype: errorFactoryMocks.installPrototypePatch,
}));

describe("main-world early bootstrap entrypoint", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    window.name = "";
    vi.unstubAllGlobals();
    errorFactoryMocks.installPrototypePatch.mockReset();
  });

  it("does not retain the full snapshot on the page global", async () => {
    const snapshot = createSnapshot();
    writeConfigElement(document, snapshot);

    await import("@/injection/main/early");

    const exposedSnapshots = Reflect.ownKeys(globalThis)
      .map((key) => {
        try {
          return Reflect.get(globalThis, key) as unknown;
        } catch {
          return undefined;
        }
      })
      .filter(
        (value) =>
          typeof value === "object" &&
          value !== null &&
          (value as { authKey?: unknown }).authKey === snapshot.authKey,
      );
    expect(exposedSnapshots).toEqual([]);
  });

  it("installs and hands off ownership of top-frame Temporal methods", async () => {
    const usageEvents: string[] = [];
    const recordUsage = (event: Event) => {
      usageEvents.push((event as CustomEvent).detail as string);
    };
    document.addEventListener(SURFACE_USAGE_TYPE, recordUsage);
    const Temporal = {
      Now: {
        timeZoneId: () => "UTC",
      },
    };
    vi.stubGlobal("Temporal", Temporal);
    writeConfigElement(document, {
      ...createSnapshot(),
      temporalApiEnabled: true,
    });

    await import("@/injection/main/early");

    expect(Temporal.Now.timeZoneId()).toBe("Europe/Warsaw");
    await Promise.resolve();
    expect(hasEarlyTemporalOwner(document)).toBe(true);
    expect(JSON.parse(usageEvents.at(-1)!) as { sourceId: string }).toMatchObject({
      sourceId: "runtime:temporal-early",
    });
    document.removeEventListener(SURFACE_USAGE_TYPE, recordUsage);
  });
});
