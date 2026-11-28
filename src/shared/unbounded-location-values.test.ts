import { describe, expect, it } from "vitest";

import type { ExportedSettings, Location } from "@/shared/types";
import { decodeUnbounded, encodeUnbounded } from "@/shared/unbounded-location-values";

const location = (patch: Record<string, unknown> = {}): Location =>
  ({
    id: "far",
    label: "Infinity",
    latitude: 1,
    longitude: 2,
    accuracy: 25,
    noiseRadius: 50,
    language: "pl",
    languages: ["pl"],
    timeZone: "Europe/Warsaw",
    ...patch,
  }) as Location;
const settings = (...locations: Location[]): ExportedSettings => ({
  version: 3,
  exportedAt: "2026-10-02T09:00:00Z",
  locations,
  rules: [],
});

describe("unbounded location values", () => {
  it("survives JSON for accuracy and noiseRadius and leaves other text alone", () => {
    const original = settings(location({ accuracy: Infinity, noiseRadius: Infinity }));
    const file = JSON.parse(
      JSON.stringify(encodeUnbounded(original)),
    ) as ExportedSettings;
    expect(file.locations[0]).toMatchObject({
      accuracy: "Infinity",
      label: "Infinity",
    });
    const decoded = decodeUnbounded(file, { storageKeepsInfinity: true });
    expect(decoded.locations[0]).toEqual(original.locations[0]);
  });

  it("returns the same object when nothing is unbounded", () => {
    const plain = settings(location());
    expect(encodeUnbounded(plain)).toBe(plain);
    expect(decodeUnbounded(plain, { storageKeepsInfinity: false })).toBe(plain);
  });

  it("names the location and field for null and for unstorable Infinity", () => {
    expect(() =>
      decodeUnbounded(settings(location({ noiseRadius: null })), {
        storageKeepsInfinity: true,
      }),
    ).toThrow('"Infinity": noiseRadius is empty in this file');
    expect(() =>
      decodeUnbounded(settings(location({ accuracy: "Infinity" })), {
        storageKeepsInfinity: false,
      }),
    ).toThrow("accuracy is unbounded");
  });
});
