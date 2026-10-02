import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { createImportHandlers } from "@/background/settings-import-commands";
import {
  diffImportedSettings,
  planSettingsImport,
} from "@/background/settings-import-plan";
import {
  configurationFingerprint,
  importedConfiguration,
  readConfiguration,
  recoverSettingsImport,
  readImportJournal,
  IMPORT_JOURNAL_KEY,
  IMPORT_RETENTION_MS,
} from "@/background/settings-import-storage";
import {
  getImportUndoStatus,
  withConfigurationLock,
  withConfigMutation,
} from "@/background/settings-import-transaction";
import {
  EXTENSION_COMMAND_TYPES as CMD,
  EXTENSION_STORAGE_KEYS as KEY,
} from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import type {
  SettingsImportSelection,
  SettingsImportPreview,
} from "@/shared/settings-import";
import type { ExportedSettings, Location } from "@/shared/types";

const { containers } = vi.hoisted(() => ({
  containers: vi.fn(async () => [] as Array<{ cookieStoreId: string; name: string }>),
}));
vi.mock("@/targets/firefox/containers-api", () => ({
  getBrowserContainers: containers,
}));
const location = (id: string, label = id): Location => ({
  id,
  label,
  latitude: 52.2,
  longitude: 21,
  accuracy: 25,
  noiseRadius: 50,
  language: "pl",
  languages: ["pl"],
  timeZone: "Europe/Warsaw",
});
const backup = (patch: Partial<ExportedSettings> = {}): ExportedSettings => ({
  version: 3,
  exportedAt: "2026-10-02T09:00:00Z",
  locations: [location("imported")],
  rules: [{ pattern: "example.com", locationId: "imported", enabled: true }],
  ...patch,
});
let stored: Record<string, unknown>;
let set: ReturnType<typeof vi.fn<(values: Record<string, unknown>) => Promise<void>>>;
let remove: ReturnType<typeof vi.fn<(keys: string | string[]) => Promise<void>>>;
const deps = () => ({
  ensureStorageMigration: vi.fn(async () => undefined),
  syncPreloadedState: vi.fn(async () => undefined),
  resyncActiveHeaderRules: vi.fn(async () => undefined),
  refreshFxInjectionMode: vi.fn(async () => undefined),
  getCachedValues: vi.fn(),
  setCachedValues: vi.fn(),
  getActiveTabContexts: () => [],
  reloadTabs: vi.fn(async () => undefined),
});
const preview = async (
  handlers: ReturnType<typeof createImportHandlers>,
  settings = backup(),
  selection?: SettingsImportSelection,
): Promise<SettingsImportPreview> => {
  const result = await handlers.previewSettingsImport({
    type: CMD.previewSettingsImport,
    settings,
    ...(selection ? { selection } : {}),
  });
  if (!result.ok) throw new Error(result.error);
  return result.preview;
};
const commit = (
  handlers: ReturnType<typeof createImportHandlers>,
  value: SettingsImportPreview,
) => handlers.importSettings({ type: CMD.importSettings, previewToken: value.token });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T09:00:00Z"));
  containers.mockResolvedValue([]);
  stored = importedConfiguration(
    backup({
      locations: [location("local")],
      rules: [],
      themeMode: "dark",
      highContrastExplicit: true,
      attentionMotionEnabled: true,
    }),
  );
  set = vi.fn(async (values: Record<string, unknown>) => {
    Object.assign(stored, structuredClone(values));
  });
  remove = vi.fn(async (keys: string | string[]) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key];
  });
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[]) =>
          Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys])
              .filter((key) => Object.hasOwn(stored, key))
              .map((key) => [key, structuredClone(stored[key])]),
          ),
        ),
        set,
        remove,
      },
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("configuration import preview and recovery", () => {
  it.each([1, 2, 3] as const)(
    "previews migrated v%s without writes and applies exactly the shown candidate",
    async (version) => {
      const handlers = createImportHandlers(deps());
      const before = await readConfiguration();
      const value = await preview(handlers, backup({ version }));
      expect(set).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
      expect(await readConfiguration()).toEqual(before);
      expect(value.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            collection: "locations",
            key: "local",
            kind: "removed",
          }),
          expect.objectContaining({
            collection: "locations",
            key: "imported",
            kind: "added",
          }),
        ]),
      );
      expect(await commit(handlers, value)).toMatchObject({ ok: true });
      const after = await readConfiguration();
      expect(after[KEY.rules]).toEqual(value.source.rules);
      expect(after).toEqual(importedConfiguration(value.source));
      expect(set.mock.calls[0]?.[0]).toMatchObject({
        [IMPORT_JOURNAL_KEY]: { phase: "pending", before },
      });
      expect(await getImportUndoStatus()).toMatchObject({ available: true });
    },
  );
  it("invalid files and duplicate patterns do not touch storage or migration", async () => {
    const effects = deps();
    const handlers = createImportHandlers(effects);
    for (const settings of [
      backup({ version: 4 as 3 }),
      backup({ locations: [location("same"), location("same")], rules: [] }),
      backup({
        rules: [
          { pattern: "EXAMPLE.com", enabled: true },
          { pattern: "example.com", enabled: true },
        ],
      }),
    ]) {
      expect(
        await handlers.previewSettingsImport({
          type: CMD.previewSettingsImport,
          settings,
        }),
      ).toMatchObject({ ok: false });
    }
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(effects.ensureStorageMigration).not.toHaveBeenCalled();
  });
  it("rejects a changed configuration and even edits that return to the same values", async () => {
    const handlers = createImportHandlers(deps());
    const value = await preview(handlers);
    const original = await readConfiguration();
    await withConfigMutation(async () => {
      await set({ [KEY.preferences]: { ...DEFAULT_PREFERENCES, themeMode: "light" } });
    });
    await withConfigMutation(async () => {
      await set(original);
    });
    const writes = set.mock.calls.length;
    expect(await commit(handlers, value)).toMatchObject({
      ok: false,
      error: expect.stringContaining("changed"),
    });
    expect(set).toHaveBeenCalledTimes(writes);
  });
  it.each([1, 2, 3])(
    "restores exact original data after set failure at step %s",
    async (step) => {
      const effects = deps();
      const handlers = createImportHandlers(effects);
      const original = await readConfiguration();
      const value = await preview(handlers);
      const normalSet = set.getMockImplementation()!;
      let writes = 0;
      set.mockImplementation(async (values) => {
        if (++writes === step) throw new Error("storage offline");
        await normalSet(values);
      });
      expect(await commit(handlers, value)).toMatchObject({ ok: false });
      expect(await readConfiguration()).toEqual(original);
      expect(stored).not.toHaveProperty(IMPORT_JOURNAL_KEY);
      if (step > 1) expect(effects.refreshFxInjectionMode).toHaveBeenCalled();
    },
  );
  it("rolls back a failure removing stale optional keys", async () => {
    stored.behavioralProfiles = [{ id: "opaque", private: "data" }];
    const original = await readConfiguration();
    const handlers = createImportHandlers(deps());
    const value = await preview(handlers);
    remove.mockRejectedValueOnce(new Error("removal failed"));
    expect(await commit(handlers, value)).toMatchObject({ ok: false });
    expect(await readConfiguration()).toEqual(original);
  });
  it("recovers after interruption and retries rollback after an extended storage outage", async () => {
    const original = await readConfiguration();
    const handlers = createImportHandlers(deps());
    const value = await preview(handlers);
    set.mockImplementation(async (values) => {
      if (values[IMPORT_JOURNAL_KEY]) {
        Object.assign(stored, structuredClone(values));
        return;
      }
      // Simulate a backend that applied part of a batch before rejecting.
      stored[KEY.locations] = [location("partial")];
      throw new Error("persistent storage outage");
    });
    expect(await commit(handlers, value)).toMatchObject({ ok: false });
    expect(stored[IMPORT_JOURNAL_KEY]).toMatchObject({
      phase: "pending",
      before: original,
    });
    set.mockImplementation(async (values) => {
      Object.assign(stored, structuredClone(values));
    });
    expect(await recoverSettingsImport()).toBe(true);
    expect(await readConfiguration()).toEqual(original);
    expect(stored).not.toHaveProperty(IMPORT_JOURNAL_KEY);
  });
  it.each([
    "syncPreloadedState",
    "resyncActiveHeaderRules",
    "refreshFxInjectionMode",
    "reloadTabs",
  ] as const)("rolls back if runtime rebuild fails at %s", async (effect) => {
    const effects = deps();
    effects[effect].mockRejectedValueOnce(new Error("runtime failure"));
    const handlers = createImportHandlers(effects);
    const original = await readConfiguration();
    expect(await commit(handlers, await preview(handlers))).toMatchObject({
      ok: false,
    });
    expect(await readConfiguration()).toEqual(original);
    expect(effects[effect]).toHaveBeenCalledTimes(2);
  });
  it("undo after restart restores every original raw field and rebuilds runtime", async () => {
    stored[KEY.preferences] = {
      ...(stored[KEY.preferences] as object),
      featureFlags: {
        behavioralProfiles: true,
        domainFencing: false,
        temporalApi: false,
      },
      customLegacyPreference: "preserve",
    };
    stored.behavioralProfiles = [{ opaque: true }];
    stored[KEY.locations] = [{ ...location("local"), behaviorProfileId: "old" }];
    stored.sharedSpoofing = { old: "opaque" }; // Undo does not normalize archived fields.
    const original = await readConfiguration();
    const handlers = createImportHandlers(deps());
    await commit(handlers, await preview(handlers));
    const effects = deps();
    const restarted = createImportHandlers(effects);
    expect(await recoverSettingsImport()).toBe(false);
    expect(await restarted.undoSettingsImport()).toMatchObject({
      ok: true,
      highContrastExplicit: true,
      attentionMotionEnabled: true,
    });
    expect(await readConfiguration()).toEqual(original);
    expect(effects.syncPreloadedState).toHaveBeenCalledOnce();
    expect(effects.resyncActiveHeaderRules).toHaveBeenCalledOnce();
    expect(effects.refreshFxInjectionMode).toHaveBeenCalledOnce();
    expect(await getImportUndoStatus()).toMatchObject({ available: false });
  });
  it("recovers an interrupted undo even after copy retention expires", async () => {
    const original = await readConfiguration();
    const handlers = createImportHandlers(deps());
    await commit(handlers, await preview(handlers));
    const normalRemove = remove.getMockImplementation()!;
    remove.mockImplementation(async (keys) => {
      if (keys === IMPORT_JOURNAL_KEY) throw new Error("interrupted undo");
      await normalRemove(keys);
    });
    expect(await handlers.undoSettingsImport()).toMatchObject({ ok: false });
    vi.setSystemTime(Date.now() + IMPORT_RETENTION_MS + 1);
    remove.mockImplementation(normalRemove);
    expect(await recoverSettingsImport()).toBe(true);
    expect(await readConfiguration()).toEqual(original);
  });
  it("expires the undo copy and invalidates it after a later successful edit", async () => {
    const handlers = createImportHandlers(deps());
    await commit(handlers, await preview(handlers));
    vi.setSystemTime(Date.now() + IMPORT_RETENTION_MS);
    expect(await getImportUndoStatus()).toMatchObject({ available: false });
    await recoverSettingsImport();
    expect(stored).not.toHaveProperty(IMPORT_JOURNAL_KEY);
    await commit(handlers, await preview(handlers));
    await withConfigMutation(async () => {
      await set({ [KEY.trustedSites]: [{ pattern: "local.example", enabled: true }] });
    });
    expect(await handlers.undoSettingsImport()).toMatchObject({ ok: false });
    expect(stored).not.toHaveProperty(IMPORT_JOURNAL_KEY);
  });
  it("serializes concurrent edits before confirming a preview", async () => {
    const handlers = createImportHandlers(deps());
    const value = await preview(handlers);
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mutation = withConfigMutation(async () => {
      await blocked;
      await set({ [KEY.rules]: [{ pattern: "new.example", enabled: true }] });
    });
    const confirmation = withConfigurationLock(() => commit(handlers, value));
    release?.();
    await mutation;
    expect(await confirmation).toMatchObject({
      ok: false,
      error: expect.stringContaining("changed"),
    });
  });
});

describe("selected import conflicts and dependencies", () => {
  const selection = (
    patch: Partial<SettingsImportSelection> = {},
  ): SettingsImportSelection => ({
    mode: "merge",
    locations: {},
    rules: {},
    containers: {},
    ...patch,
  });
  const plan = (
    choices: SettingsImportSelection,
    patch: Partial<ExportedSettings> = {},
  ) =>
    planSettingsImport({
      current: backup({
        locations: [location("shared", "Local"), location("untouched")],
        rules: [{ pattern: "example.com", locationId: "untouched", enabled: false }],
        themeMode: "dark",
      }),
      source: backup({
        locations: [location("shared", "Incoming"), location("skipped")],
        rules: [{ pattern: "example.com", locationId: "shared", enabled: true }],
        ...patch,
      }),
      selection: choices,
      localContainerIds: new Set(["firefox-container-1"]),
    });
  it("requires explicit conflict choices and blocks references to skipped presets", () => {
    expect(plan(selection()).problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("preset ID"),
        expect.stringContaining("rule pattern"),
      ]),
    );
    expect(
      plan(
        selection({
          locations: { shared: "skip", skipped: "skip" },
          rules: { "example.com": "import" },
        }),
      ).problems,
    ).toEqual([expect.stringContaining("Select the preset shared")]);
  });
  it.each(["keep", "copy", "import"] as const)(
    "remaps the %s resolution and preserves unselected elements and preferences",
    async (choice) => {
      const result = plan(
        selection({
          locations: { shared: choice, skipped: "skip" },
          rules: { "example.com": "import" },
        }),
      );
      expect(result.problems).toEqual([]);
      expect(result.settings.locations).toContainEqual(location("untouched"));
      expect(result.settings.locations.some((item) => item.id === "skipped")).toBe(
        false,
      );
      expect(result.settings.themeMode).toBe("dark");
      const expectedId = choice === "copy" ? "shared-import" : "shared";
      expect(result.settings.rules[0]?.locationId).toBe(expectedId);
      expect(
        result.settings.locations.find((item) => item.id === expectedId)?.label,
      ).toBe(choice === "keep" ? "Local" : "Incoming");
    },
  );
  it("never automatically treats matching foreign container IDs as local", () => {
    const result = plan(
      selection({ locations: { shared: "copy" }, rules: { "example.com": "keep" } }),
      {
        containerAssignments: [
          { cookieStoreId: "firefox-container-1", locationId: "shared" },
        ],
      },
    );
    expect(result.problems).toContain(
      "Map or skip foreign container: firefox-container-1",
    );
  });
  it("maps containers explicitly, remaps profiles, rejects duplicate and missing targets", () => {
    const incoming = {
      containerAssignments: [{ cookieStoreId: "foreign", locationId: "shared" }],
    };
    const choices = selection({
      locations: { shared: "copy" },
      rules: { "example.com": "keep" },
      containers: { foreign: "firefox-container-1" },
    });
    const result = plan(choices, incoming);
    expect(result.problems).toEqual([]);
    expect(result.settings.containerAssignments).toEqual([
      { cookieStoreId: "firefox-container-1", locationId: "shared-import" },
    ]);
    expect(
      plan({ ...choices, containers: { foreign: "missing" } }, incoming).problems,
    ).toContain("Local container is unavailable: missing");
    expect(
      plan({ ...choices, containers: { foreign: null } }, incoming).settings
        .containerAssignments,
    ).toEqual([]);
    expect(
      plan(
        {
          ...choices,
          containers: { foreign: "firefox-container-1", other: "firefox-container-1" },
        },
        {
          containerAssignments: [
            ...incoming.containerAssignments,
            { cookieStoreId: "other" },
          ],
        },
      ).problems,
    ).toContain("Multiple assignments mapped to container: firefox-container-1");
  });
  it("detects a container removed after preview without modifying configuration", async () => {
    containers.mockResolvedValue([
      { cookieStoreId: "firefox-container-1", name: "Work" },
    ]);
    const handlers = createImportHandlers(deps());
    const value = await preview(
      handlers,
      backup({
        containerAssignments: [{ cookieStoreId: "foreign", locationId: "imported" }],
      }),
      {
        mode: "replace",
        locations: {},
        rules: {},
        containers: { foreign: "firefox-container-1" },
      },
    );
    containers.mockResolvedValue([]);
    expect(await commit(handlers, value)).toMatchObject({
      ok: false,
      error: expect.stringContaining("unavailable"),
    });
    expect(set).not.toHaveBeenCalled();
  });
  it("replace preserves unmapped local container identities and removes dangling preset links", () => {
    const result = planSettingsImport({
      current: backup({
        locations: [location("old")],
        rules: [],
        containerAssignments: [
          {
            cookieStoreId: "local",
            locationId: "old",
            ruleSeedKey: "saved-seed",
            enabled: false,
          },
        ],
      }),
      source: backup({
        containerAssignments: [{ cookieStoreId: "foreign", locationId: "imported" }],
      }),
      selection: {
        mode: "replace",
        locations: {},
        rules: {},
        containers: { foreign: null },
      },
      localContainerIds: new Set(["local"]),
    });
    expect(result.problems).toEqual([]);
    expect(result.settings.containerAssignments).toEqual([
      { cookieStoreId: "local", ruleSeedKey: "saved-seed", enabled: false },
    ]);
  });
  it("merge uses the same journal and retains unrelated raw preferences and Trusted Sites", async () => {
    stored[KEY.preferences] = {
      ...(stored[KEY.preferences] as object),
      opaqueField: 123,
    };
    stored[KEY.trustedSites] = [{ pattern: "trusted.example", enabled: true }];
    const original = await readConfiguration();
    const handlers = createImportHandlers(deps());
    const value = await preview(handlers, backup(), selection());
    expect(await commit(handlers, value)).toMatchObject({ ok: true });
    expect(stored[KEY.preferences]).toEqual(original[KEY.preferences]);
    expect(stored[KEY.trustedSites]).toEqual(original[KEY.trustedSites]);
    expect(await handlers.undoSettingsImport()).toMatchObject({ ok: true });
    expect(await readConfiguration()).toEqual(original);
  });
  it("preview diffs ignore object property insertion order", () => {
    const first = backup();
    const second = {
      ...first,
      locations: first.locations.map(
        (item) =>
          Object.fromEntries(Object.entries(item).reverse()) as unknown as Location,
      ),
    };
    expect(diffImportedSettings(first, second)).toEqual([]);
  });
  it.each(["future-version", "bad-snapshot", "bad-fingerprint"])(
    "quarantines %s without blocking configuration reads",
    async (failure) => {
      const original = await readConfiguration();
      const journal = {
        version: failure === "future-version" ? 2 : 1,
        phase: "pending",
        before: failure === "bad-snapshot" ? { unknownKey: 1 } : original,
        afterFingerprint:
          failure === "bad-fingerprint" ? 42 : await configurationFingerprint(original),
        expiresAt: Date.now() + IMPORT_RETENTION_MS,
      };
      stored[IMPORT_JOURNAL_KEY] = journal;
      expect(await recoverSettingsImport()).toBe(true);
      expect(await readConfiguration()).toEqual(original);
      expect(stored[IMPORT_JOURNAL_KEY]).toMatchObject({
        version: 0,
        phase: "quarantined",
        record: journal,
      });
      expect(await readImportJournal()).toBeNull();
      expect(await getImportUndoStatus()).toMatchObject({ available: false });
      vi.advanceTimersByTime(IMPORT_RETENTION_MS);
      expect(await readImportJournal()).toBeNull();
      expect(stored).not.toHaveProperty(IMPORT_JOURNAL_KEY);
    },
  );
  it("canonical fingerprints ignore object key ordering", async () => {
    expect(await configurationFingerprint({ a: 1, b: { c: 2, d: 3 } })).toBe(
      await configurationFingerprint({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });
});
