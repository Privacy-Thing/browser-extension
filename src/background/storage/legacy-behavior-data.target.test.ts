import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEGACY_BEHAVIOR_KEY,
  clearLegacyBehavior,
  saveLegacyBehavior,
} from "@/background/storage/legacy-behavior-data";
import {
  LOCATIONS_STORAGE_KEY,
  loadLocations,
  saveLocations,
} from "@/background/storage/locations";
import {
  PREFERENCES_STORAGE_KEY,
  savePreferences,
} from "@/background/storage/preferences";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import type { Location } from "@/shared/types";

const state: Record<string, unknown> = {};

const storage = {
  get: vi.fn(async (keys?: string | string[]) => {
    if (keys === undefined) {
      return { ...state };
    }
    const list = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      list.filter((key) => key in state).map((key) => [key, state[key]]),
    );
  }),
  set: vi.fn(async (entries: Record<string, unknown>) => {
    Object.assign(state, entries);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      Reflect.deleteProperty(state, key);
    }
  }),
};

const warsaw: Location = {
  id: "warsaw",
  label: "Warsaw",
  latitude: 52.2297,
  longitude: 21.0122,
  accuracy: 25,
  noiseRadius: 50,
  language: "pl-PL",
  languages: ["pl-PL", "pl"],
  timeZone: "Europe/Warsaw",
};

beforeEach(() => {
  for (const key of Object.keys(state)) {
    Reflect.deleteProperty(state, key);
  }
  vi.clearAllMocks();
  vi.stubGlobal("chrome", { storage: { local: storage } });
});

describe("retired profile compatibility data", () => {
  it("survives ordinary location and preference saves but stays hidden", async () => {
    state[LOCATIONS_STORAGE_KEY] = [{ ...warsaw, behaviorProfileId: "legacy-profile" }];
    state[PREFERENCES_STORAGE_KEY] = {
      ...DEFAULT_PREFERENCES,
      featureFlags: { behavioralProfiles: true, futureFlag: true },
      behavioralProfilesEnabled: true,
    };
    state[LEGACY_BEHAVIOR_KEY] = [{ id: "legacy-profile", opaque: true }];

    await saveLocations([{ ...warsaw, label: "Updated Warsaw" }]);
    await savePreferences({ debugMode: true });

    expect(state[LOCATIONS_STORAGE_KEY]).toEqual([
      expect.objectContaining({
        id: "warsaw",
        label: "Updated Warsaw",
        behaviorProfileId: "legacy-profile",
      }),
    ]);
    expect(state[PREFERENCES_STORAGE_KEY]).toEqual(
      expect.objectContaining({
        debugMode: true,
        featureFlags: { behavioralProfiles: true, futureFlag: true },
        behavioralProfilesEnabled: true,
      }),
    );
    expect(state[LEGACY_BEHAVIOR_KEY]).toEqual([
      { id: "legacy-profile", opaque: true },
    ]);
    expect(await loadLocations()).toEqual([
      expect.objectContaining({ id: "warsaw", label: "Updated Warsaw" }),
    ]);
    expect((await loadLocations())[0]).not.toHaveProperty("behaviorProfileId");
  });

  it("stores retired data from an imported backup without activating it", async () => {
    state[LOCATIONS_STORAGE_KEY] = [warsaw];
    state[PREFERENCES_STORAGE_KEY] = { ...DEFAULT_PREFERENCES };
    const profiles = [{ id: "legacy-profile", opaque: { cadence: 5000 } }];

    await saveLegacyBehavior({
      profiles,
      enabled: true,
      refs: [{ id: "warsaw", profileId: "legacy-profile" }],
    });

    expect(state[LEGACY_BEHAVIOR_KEY]).toEqual(profiles);
    expect(state[PREFERENCES_STORAGE_KEY]).toEqual(
      expect.objectContaining({ featureFlags: { behavioralProfiles: true } }),
    );
    expect(state[LOCATIONS_STORAGE_KEY]).toEqual([
      expect.objectContaining({ behaviorProfileId: "legacy-profile" }),
    ]);
    expect((await loadLocations())[0]).not.toHaveProperty("behaviorProfileId");
  });

  it("removes every retired field on explicit reset", async () => {
    state[LOCATIONS_STORAGE_KEY] = [{ ...warsaw, behaviorProfileId: "legacy-profile" }];
    state[PREFERENCES_STORAGE_KEY] = {
      ...DEFAULT_PREFERENCES,
      featureFlags: { behavioralProfiles: true },
      behavioralProfilesEnabled: true,
    };
    state[LEGACY_BEHAVIOR_KEY] = [{ id: "legacy-profile" }];

    await clearLegacyBehavior();

    expect(state).not.toHaveProperty(LEGACY_BEHAVIOR_KEY);
    expect(state[PREFERENCES_STORAGE_KEY]).not.toHaveProperty("featureFlags");
    expect(state[PREFERENCES_STORAGE_KEY]).not.toHaveProperty(
      "behavioralProfilesEnabled",
    );
    expect(state[LOCATIONS_STORAGE_KEY]).toEqual([warsaw]);
  });
});
