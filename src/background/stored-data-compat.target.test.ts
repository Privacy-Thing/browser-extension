/**
 * Stored data written by releases that validated with zod 3 must load, migrate,
 * save and export unchanged. These fixtures use legacy shapes and the edge values
 * zod 3 accepted; the expected results were recorded from the zod 3 build.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearRulesForTests, runStorageMigration } from "@/background/migrations";
import { validateImportedSettings, validateSettings } from "@/background/settings";
import {
  configurationToExport,
  readConfiguration,
} from "@/background/settings-import-storage";
import { loadContainerAssignments } from "@/background/storage/container-assignments";
import { loadLocations } from "@/background/storage/locations";
import {
  getGlobalFallbackRule,
  getSharedSpoofing,
} from "@/background/storage/preferences";
import { loadFeatureState } from "@/background/storage/provider-features";
import { loadRules } from "@/background/storage/rules";
import { loadTrustedSites } from "@/background/storage/trusted-sites";
import { readSessions } from "@/background/worker-test-state";
import { loadControlDConfig } from "@/experimental/control-d/storage";
import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";

vi.mock("@/background/dnr", () => ({ syncDynamicHeaderRules: vi.fn(async () => {}) }));

type State = Record<string, unknown>;
const local: State = {};
const session: State = {};
const storageApi = (state: State) => ({
  get: vi.fn(async (keys?: string | string[] | null) => {
    if (keys === undefined || keys === null) return structuredClone(state);
    const list = typeof keys === "string" ? [keys] : keys;
    return structuredClone(
      Object.fromEntries(
        list.filter((key) => key in state).map((key) => [key, state[key]]),
      ),
    );
  }),
  // Firefox storage keeps structured-clone values such as Infinity.
  set: vi.fn(async (entries: State) => {
    Object.assign(state, structuredClone(entries));
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    for (const key of typeof keys === "string" ? [keys] : keys)
      Reflect.deleteProperty(state, key);
  }),
});

const retired = (suffix: string, separator = "."): string =>
  ["geo", "warp"].join("") + separator + suffix;
const KEY = EXTENSION_STORAGE_KEYS;
const CONTROL_D_KEY = "pt.experimental.control-d.v2.config";

const location = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  label: id,
  latitude: 52.2297,
  longitude: 21.0122,
  accuracy: 25,
  language: "pl",
  languages: ["pl"],
  timeZone: "Europe/Warsaw",
  ...extra,
});
const binding = (rulePattern: string, featureId: string, at: string) => ({
  rulePattern,
  providerId: "provider",
  featureId,
  featureName: featureId,
  featureType: "service",
  matchSource: "manual",
  matchCheckedAt: at,
  confirmedAt: at,
});
const match = (hostname: string, checkedAt: string) => ({
  hostname,
  providerId: "provider",
  featureId: null,
  matchSource: "domain-test",
  status: "unresolved",
  checkedAt,
});

/** Minted seeds and export times are random; everything else must be identical. */
const stable = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (key, item: unknown) => {
      if (item === Infinity) return "Infinity";
      if (key === "exportedAt") return "<now>";
      if ((key === "ruleSeedKey" || key === "authKey") && typeof item === "string")
        return /^(seed|auth)\d/.test(item) ? item : "<minted>";
      return item;
    }),
  );

beforeEach(async () => {
  for (const state of [local, session])
    for (const key of Object.keys(state)) Reflect.deleteProperty(state, key);
  vi.stubGlobal("chrome", {
    storage: { local: storageApi(local), session: storageApi(session) },
  });
  await clearRulesForTests();
});

/** zod wording differs between majors; which fields failed must not. */
const outcome = (operation: () => unknown) => {
  try {
    return { ok: operation() };
  } catch (error) {
    const issues = (error as { issues?: Array<{ path: unknown }> }).issues;
    return { rejected: issues ? issues.map((issue) => issue.path) : String(error) };
  }
};

const loadEverything = async () => {
  await runStorageMigration();
  const locations = await loadLocations();
  const rules = await loadRules();
  const containers = await loadContainerAssignments();
  // Inspector sessions are cached per service-worker lifetime.
  vi.resetModules();
  const inspectors = await import("@/background/storage/inspector-sessions");
  await inspectors.initializeInspectors();
  const exported = configurationToExport(await readConfiguration());
  return {
    locations,
    rules,
    containers,
    trustedSites: await loadTrustedSites(),
    sharedSpoofing: (await getSharedSpoofing()) ?? null,
    fallback: (await getGlobalFallbackRule()) ?? null,
    features: await loadFeatureState(),
    controlD: await loadControlDConfig(),
    inspector: inspectors.readInspector(7, "shop.example.com") ?? null,
    workerTests: await readSessions(),
    saved: outcome(() => validateSettings(locations, rules, containers)),
    reimported: outcome(() =>
      validateImportedSettings(JSON.parse(JSON.stringify(exported))),
    ),
  };
};

describe("stored data from zod 3 releases", () => {
  it("migrates and loads retired-namespace data with legacy fields unchanged", async () => {
    local[retired("profiles")] = [
      location("home", { noiseRadius: 50, countryCode: "pl" }),
      location("bare"),
    ];
    local[retired("rules")] = [
      { pattern: "Legacy.Example.com", profileId: "home", geolocationEnabled: false },
      {
        pattern: "shop.example.com",
        locationId: "bare",
        enabled: false,
        ruleSeedKey: "seed01",
        authKey: "auth0001",
        blockServiceWorkerRegistration: true,
        fingerprintSurfaceOverrides: {},
      },
    ];
    local[retired("container_assignments", "_")] = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: null,
        geolocationEnabled: false,
      },
      { cookieStoreId: "firefox-container-2", locationId: "home", enabled: false },
    ];
    local[retired("trustedSites")] = [{ pattern: " Bank.Example.COM " }];
    local.experimentalActiveSpoofing = {
      enabled: true,
      canvas: false,
      sharedWorker: "spoof",
    };
    local.globalFallbackRule = { geolocationEnabled: false, ruleSeedKey: "seed02" };

    expect(stable(await loadEverything())).toMatchSnapshot();
    expect(local[retired("rules")]).toBeUndefined();
  });

  it("keeps plugin, session and edge values that zod 3 accepted", async () => {
    // Imported backups could carry minute-precision timestamps, Firefox keeps
    // Infinity, and remote IDs are integers beyond 2^53.
    local[KEY.locations] = [
      location("far", { accuracy: Infinity, noiseRadius: Infinity }),
    ];
    local[KEY.rules] = [
      {
        pattern: "a.example.com",
        locationId: "far",
        enabled: true,
        ruleSeedKey: "seed03",
        authKey: "auth0003",
        relaxCspForWorkers: false,
      },
      {
        pattern: "b.example.com",
        enabled: true,
        ruleSeedKey: "seed04",
        authKey: "auth0004",
        relaxCspForWorkers: false,
      },
    ];
    local[KEY.trustedSites] = [];
    local[KEY.providerFeatures] = {
      featureBindings: [
        binding("a.example.com", "minute", "2026-10-25T10:00Z"),
        binding("b.example.com", "second", "2026-10-25T10:00:00.000Z"),
      ],
    };
    local[KEY.providerFeatureMatches] = {
      featureMatches: [match("a.example.com", "2026-10-25T10:00Z")],
      dismissedMatches: [],
    };
    local[CONTROL_D_KEY] = {
      version: 2,
      enabled: true,
      connected: true,
      autoSyncEnabled: false,
      status: "ready",
      resourceIdentity: { code: "abc" },
      profileId: "profile",
      endpointId: null,
      resolverDoh: null,
      dnsVerification: null,
      managedFolders: {
        far: { proxyPk: "pk", folderId: 2 ** 53 + 2, remoteHash: "h" },
      },
      locationMappings: {
        far: {
          locationId: "far",
          ruleCount: 2 ** 53 + 2,
          proxyPk: null,
          status: "skipped",
          confirmed: false,
        },
      },
      lastSyncedHash: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
    };
    session[KEY.inspectorSessions] = {
      "7": {
        hostname: "shop.example.com",
        desired: { methods: ["canvas.toDataURL"], mode: "first-call" },
        document: null,
      },
    };
    session[KEY.workerTestSessions] = {};

    const loaded = await loadEverything();
    expect(stable(loaded)).toMatchSnapshot();
    expect(loaded.features.featureBindings).toHaveLength(2);
    expect(loaded.controlD.connected).toBe(true);
    expect(local[CONTROL_D_KEY]).toMatchObject({ connected: true });
  });
});
