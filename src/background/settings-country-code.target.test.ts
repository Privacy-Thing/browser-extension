import { beforeEach, describe, expect, it, vi } from "vitest";

import { validateImportedSettings, validateSettings } from "@/background/settings";
import type { SettingsCommandDeps } from "@/background/settings-command-types";
import { createSettingsHandlers } from "@/background/settings-commands";
import { loadLocations, LOCATIONS_STORAGE_KEY } from "@/background/storage/locations";
import { compileControlDState } from "@/experimental/control-d/compiler";
import type { ControlDProxyLocation } from "@/experimental/control-d/contracts";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type { ExportedSettings, Location } from "@/shared/types";

vi.mock("@/background/logger", () => ({
  clearExtensionLogs: vi.fn(),
  logExtensionEvent: vi.fn(),
}));

const profile: Location = {
  id: "custom-border-profile",
  label: "Polish border",
  latitude: 51.15,
  longitude: 15,
  accuracy: 25,
  noiseRadius: 50,
  language: "pl",
  languages: ["pl"],
  timeZone: "Europe/Warsaw",
};

const proxies: ControlDProxyLocation[] = [
  {
    pk: "WAW",
    city: "Warsaw",
    countryCode: "PL",
    countryName: "Poland",
    latitude: 52.23,
    longitude: 21.01,
  },
  {
    pk: "DE-BORDER",
    city: "German border",
    countryCode: "DE",
    countryName: "Germany",
    latitude: 51.15,
    longitude: 14.99,
  },
];

const storageState: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(storageState)) {
    Reflect.deleteProperty(storageState, key);
  }
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (key: string | string[]) => {
          const keys = typeof key === "string" ? [key] : key;
          return structuredClone(
            Object.fromEntries(keys.map((entry) => [entry, storageState[entry]])),
          );
        }),
        set: vi.fn(async (entries: Record<string, unknown>) => {
          Object.assign(storageState, structuredClone(entries));
        }),
        remove: vi.fn(async (key: string) => {
          Reflect.deleteProperty(storageState, key);
        }),
      },
    },
  });
});

const createHandlers = () =>
  createSettingsHandlers({
    ensureStorageMigration: vi.fn(async () => undefined),
    syncPreloadedState: vi.fn(async () => undefined),
    resyncActiveHeaderRules: vi.fn(async () => undefined),
    refreshFxInjectionMode: vi.fn(async () => undefined),
    getActiveTabContexts: () => [],
    reloadTabs: vi.fn(async () => undefined),
    getCachedValues: vi.fn<SettingsCommandDeps["getCachedValues"]>(),
    setCachedValues: vi.fn(),
  });

describe("profile country persistence", () => {
  it.each(["PL", "pl", undefined])(
    "keeps country %s through save, storage, export, import and a later edit",
    async (countryCode) => {
      const handlers = createHandlers();
      const locations = [
        { ...profile, ...(countryCode === undefined ? {} : { countryCode }) },
      ];
      const rules = [{ pattern: "example.com", enabled: true, locationId: profile.id }];
      const saved = await handlers.saveLocationModel({
        type: EXTENSION_COMMAND_TYPES.saveLocationModel,
        locations,
        rules,
        containerAssignments: [],
      });
      expect(saved.ok).toBe(true);
      if (!saved.ok) throw new Error(saved.error);
      const expectedCountry = countryCode?.toUpperCase();
      expect(saved.locations?.[0]?.countryCode).toBe(expectedCountry);
      expect((await loadLocations())[0]?.countryCode).toBe(expectedCountry);
      expect(storageState[LOCATIONS_STORAGE_KEY]).toEqual(saved.locations);

      const exported = await handlers.exportSettings();
      expect(exported.settings.locations[0]?.countryCode).toBe(expectedCountry);
      const backup = JSON.parse(JSON.stringify(exported.settings)) as ExportedSettings;
      for (const key of Object.keys(storageState)) {
        Reflect.deleteProperty(storageState, key);
      }
      const imported = await handlers.importSettings({
        type: EXTENSION_COMMAND_TYPES.importSettings,
        settings: backup,
      });
      expect(imported.ok).toBe(true);
      const restored = await loadLocations();
      expect(restored[0]?.countryCode).toBe(expectedCountry);
      if (countryCode === undefined) {
        expect(restored[0]).not.toHaveProperty("countryCode");
      }

      const compilation = compileControlDState({
        locations: restored,
        rules: backup.rules,
        proxies,
        storedMappings: {},
      });
      expect(compilation.rules[0]?.proxyPk).toBe(
        countryCode === undefined ? "DE-BORDER" : "WAW",
      );
      expect(compilation.mappings[profile.id]).toMatchObject({
        status: countryCode === undefined ? "approximate" : "exact",
        confirmed: countryCode !== undefined,
      });
      expect(compilation.warnings.map((warning) => warning.code)).toEqual(
        countryCode === undefined ? ["missing-country"] : [],
      );

      const edited = await handlers.saveLocationModel({
        type: EXTENSION_COMMAND_TYPES.saveLocationModel,
        locations: restored.map((location) => ({ ...location, label: "Renamed" })),
        rules: backup.rules,
        containerAssignments: [],
      });
      expect(edited.ok).toBe(true);
      const afterEdit = await loadLocations();
      expect(afterEdit[0]?.countryCode).toBe(expectedCountry);
      expect(afterEdit[0]?.label).toBe("Renamed");
      expect(
        compileControlDState({
          locations: afterEdit,
          rules: backup.rules,
          proxies,
          storedMappings: compilation.mappings,
        }).rules,
      ).toEqual(compilation.rules);
    },
  );

  it.each(["PL", "pl", undefined])(
    "normalizes country %s in an imported backup",
    (countryCode) => {
      const result = validateImportedSettings({
        version: 3,
        exportedAt: "2026-10-01T00:00:00.000Z",
        locations: [
          { ...profile, ...(countryCode === undefined ? {} : { countryCode }) },
        ],
        rules: [],
      });
      expect(result.locations[0]?.countryCode).toBe(countryCode?.toUpperCase());
      if (countryCode === undefined) {
        expect(result.locations[0]).not.toHaveProperty("countryCode");
      }
    },
  );

  it.each(["", "P", "POL", "P1", " PL "])(
    "rejects invalid country %s during save and import validation",
    (countryCode) => {
      const locations = [{ ...profile, countryCode }];
      expect(() => validateSettings(locations, [])).toThrow();
      expect(() =>
        validateImportedSettings({
          version: 3,
          exportedAt: "2026-10-01T00:00:00.000Z",
          locations,
          rules: [],
        }),
      ).toThrow();
    },
  );
});
