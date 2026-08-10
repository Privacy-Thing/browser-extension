import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_LOCATIONS,
  EXAMPLE_LOCATIONS,
  LOCATIONS_STORAGE_KEY,
  loadLocations,
  randomizeLocation,
} from "@/background/storage/locations";

const storageState: Record<string, unknown> = {};

const getStorageApi = () => ({
  get: vi.fn(async (key?: string | string[]) => {
    if (key === undefined) {
      return { ...storageState };
    }

    if (typeof key === "string") {
      return key in storageState ? { [key]: storageState[key] } : {};
    }

    return Object.fromEntries(
      key
        .filter((entry) => entry in storageState)
        .map((entry) => [entry, storageState[entry]]),
    );
  }),
  set: vi.fn(async (entries: Record<string, unknown>) => {
    Object.assign(storageState, entries);
  }),
});

beforeEach(() => {
  for (const key of Object.keys(storageState)) {
    Reflect.deleteProperty(storageState, key);
  }

  vi.stubGlobal("chrome", {
    storage: {
      local: getStorageApi(),
    },
  });
});

describe("loadLocations", () => {
  it("returns no locations when storage is empty", async () => {
    const profiles = await loadLocations();

    expect(profiles).toEqual(DEFAULT_LOCATIONS);
    expect(profiles).toHaveLength(0);
  });

  it("keeps the example location library separate from persisted defaults", () => {
    expect(EXAMPLE_LOCATIONS).toHaveLength(22);
    expect(EXAMPLE_LOCATIONS.map((profile) => profile.id)).toEqual([
      "spf-warsaw",
      "spf-paris",
      "spf-london",
      "spf-ottawa",
      "spf-new-york",
      "spf-las-vegas",
      "spf-san-francisco",
      "spf-sydney",
      "spf-beijing",
      "spf-hong-kong",
      "spf-new-delhi",
      "spf-cairo",
      "spf-lagos",
      "spf-kyiv",
      "spf-kinshasa",
      "spf-sao-paulo",
      "spf-buenos-aires",
      "spf-lima",
      "spf-rio-de-janeiro",
      "spf-caracas",
      "spf-berlin",
      "spf-madrid",
    ]);
  });

  it("randomizes preset coordinates inside the requested radius without changing privacy radius", () => {
    const source = EXAMPLE_LOCATIONS[0]!;
    const randomized = randomizeLocation(source, 99000);
    const latitudeMeters = (randomized.latitude - source.latitude) * 111_320;
    const longitudeMeters =
      (randomized.longitude - source.longitude) *
      111_320 *
      Math.cos((source.latitude * Math.PI) / 180);
    const distanceMeters = Math.hypot(latitudeMeters, longitudeMeters);

    expect(distanceMeters).toBeLessThanOrEqual(99000.0001);
    expect(randomized.noiseRadius).toBe(source.noiseRadius);
  });

  it("preserves draft-only fields while randomizing generated coordinates", () => {
    const source = {
      ...EXAMPLE_LOCATIONS[0]!,
      sourceLabel: "Warsaw, Masovian Voivodeship, Poland",
      languageSelection: {
        options: [
          {
            value: "pl-PL",
            label: "Polish [pl-PL]",
            language: "pl-PL",
            languages: ["pl-PL", "pl"],
          },
        ],
        selectedValue: "pl-PL",
        required: false,
      },
    };

    const randomized = randomizeLocation(source, 3000);

    expect(randomized.sourceLabel).toBe(source.sourceLabel);
    expect(randomized.languageSelection).toBe(source.languageSelection);
    expect(randomized.latitude).not.toBe(source.latitude);
    expect(randomized.longitude).not.toBe(source.longitude);
  });

  it("returns stored locations when they exist", async () => {
    storageState[LOCATIONS_STORAGE_KEY] = [
      {
        id: "custom",
        label: "Custom",
        latitude: 1,
        longitude: 2,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl-PL",
        languages: ["EN_us", "pl-PL"],
        timeZone: "UTC",
      },
    ];

    const profiles = await loadLocations();

    expect(profiles).toEqual([
      {
        id: "custom",
        label: "Custom",
        latitude: 1,
        longitude: 2,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl",
        languages: ["pl", "en-US"],
        preferEnglishContent: false,
        timeZone: "UTC",
      },
    ]);
  });

  it("does not read a retired namespace outside the startup migrator", async () => {
    const retiredProfilesKey = `${["geo", "warp"].join("")}.profiles`;
    storageState[retiredProfilesKey] = [
      {
        id: "legacy",
        label: "Legacy",
        latitude: 1,
        longitude: 2,
        accuracy: 25,
        noiseRadius: 50,
        language: "fr-FR",
        languages: ["fr-FR", "fr"],
        preferEnglishContent: false,
        timeZone: "Europe/Paris",
      },
    ];

    const locations = await loadLocations();

    expect(locations).toEqual(DEFAULT_LOCATIONS);
  });
});
