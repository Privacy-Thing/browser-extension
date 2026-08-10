// @vitest-environment jsdom

import { writeConfigElement } from "@privacy-brand/refract-browser/common/runtime-config";
import { afterEach, describe, expect, it, vi } from "vitest";

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
});
