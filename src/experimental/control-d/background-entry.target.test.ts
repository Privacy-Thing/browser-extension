import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerControlD } from "./background-entry";
import {
  CONTROL_D_COMMANDS,
  type ControlDConfig,
  type ControlDPreparedSnapshot,
} from "./contracts";
import { applyControlDSync, prepareControlDSync } from "./reconcile";
import { CONTROL_D_STORE_KEYS } from "./storage";

import { logExtensionEvent } from "@/background/logger";
import { LOCATIONS_STORAGE_KEY } from "@/background/storage/locations";
import { RULES_STORAGE_KEY } from "@/background/storage/rules";

vi.mock("@/background/logger", () => ({
  logExtensionEvent: vi.fn(),
}));

type ReconcileModule = {
  applyControlDSync: typeof applyControlDSync;
  prepareControlDSync: typeof prepareControlDSync;
  [key: string]: unknown;
};

vi.mock("./reconcile", async (importOriginal) => {
  const actual = await importOriginal<ReconcileModule>();
  return {
    ...actual,
    applyControlDSync: vi.fn(actual.applyControlDSync),
    prepareControlDSync: vi.fn(actual.prepareControlDSync),
  };
});

type MessageListener = (
  message: unknown,
  sender: { id?: string },
  sendResponse: (response: unknown) => void,
) => boolean;

type StorageListener = (
  changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
  areaName: string,
) => void;

const storageState: Record<string, unknown> = {};
let messageListener: MessageListener;
let storageListener: StorageListener;

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(storageState))
    Reflect.deleteProperty(storageState, key);

  vi.stubGlobal("chrome", {
    runtime: {
      id: "extension-id",
      onMessage: {
        addListener: vi.fn((listener: MessageListener) => {
          messageListener = listener;
        }),
      },
    },
    storage: {
      local: {
        get: vi.fn(async (key: string) =>
          key in storageState ? { [key]: storageState[key] } : {},
        ),
        set: vi.fn(async (values: Record<string, unknown>) => {
          Object.assign(storageState, values);
        }),
        remove: vi.fn(async (key: string) => Reflect.deleteProperty(storageState, key)),
      },
      onChanged: {
        addListener: vi.fn((listener: StorageListener) => {
          storageListener = listener;
        }),
      },
    },
  });
});

describe("Control D background entry", () => {
  const request = (message: unknown) =>
    new Promise<Record<string, unknown>>((resolve) => {
      messageListener(message, { id: "extension-id" }, (response) =>
        resolve(response as Record<string, unknown>),
      );
    });

  it("returns the same prepared snapshot after preview and synchronization", async () => {
    const config: ControlDConfig = {
      version: 2,
      enabled: true,
      connected: true,
      autoSyncEnabled: false,
      status: "ready",
      resourceIdentity: { code: "ABCDE-FGHJK" },
      profileId: "profile-id",
      endpointId: "endpoint-id",
      resolverDoh: "https://example.test/private-resolver",
      dnsVerification: null,
      managedFolders: {},
      locationMappings: {},
      lastSyncedHash: "hash",
      lastAttemptAt: "2026-09-10T10:00:00.000Z",
      lastSuccessAt: "2026-09-10T10:00:00.000Z",
      lastError: null,
    };
    const prepared: Awaited<ReturnType<typeof prepareControlDSync>> = {
      compilation: { rules: [], warnings: [], mappings: {} },
      proxies: [
        {
          pk: "WAW",
          city: "Warsaw",
          countryCode: "PL",
          countryName: "Poland",
          latitude: 52.23,
          longitude: 21.01,
        },
      ],
      diff: {
        createProfile: false,
        createEndpoint: false,
        createFolders: 0,
        addRules: 0,
        updateRules: 0,
        deleteRules: 0,
        unchangedRules: 1,
        warnings: [],
        mappings: [
          {
            locationId: "warsaw",
            locationLabel: "Warsaw",
            ruleCount: 1,
            proxyPk: "WAW",
            status: "exact",
            confirmed: true,
          },
        ],
        requiresApproximationConfirmation: false,
      },
    };
    const expectedSnapshot: ControlDPreparedSnapshot = {
      diff: prepared.diff,
      proxies: prepared.proxies,
    };
    storageState[CONTROL_D_STORE_KEYS[0]] = config;
    storageState[CONTROL_D_STORE_KEYS[1]] = "api-key";
    vi.mocked(prepareControlDSync)
      .mockResolvedValueOnce(prepared)
      .mockResolvedValueOnce(prepared);
    vi.mocked(applyControlDSync).mockResolvedValueOnce(config);
    registerControlD({ getDebugMode: async () => false });

    const previewResponse = await request({ type: CONTROL_D_COMMANDS.preview });
    expect(previewResponse).toMatchObject({ ok: true, snapshot: expectedSnapshot });
    expect(previewResponse).not.toHaveProperty("diff");
    expect(storageState[CONTROL_D_STORE_KEYS[0]]).toMatchObject({
      lastAttemptAt: "2026-09-10T10:00:00.000Z",
      lastError: null,
    });

    const syncResponse = await request({ type: CONTROL_D_COMMANDS.syncNow });

    expect(syncResponse).toMatchObject({ ok: true, snapshot: expectedSnapshot });
    expect(syncResponse).not.toHaveProperty("diff");
  });

  it("creates a new resource identity without running synchronization", async () => {
    storageState[CONTROL_D_STORE_KEYS[1]] = "api-key";
    registerControlD({ getDebugMode: async () => false });

    const response = await request({ type: CONTROL_D_COMMANDS.selectNew });

    expect(response).toMatchObject({
      ok: true,
      state: { setupStatus: "selected", profileId: null, endpointId: null },
    });
    expect(storageState[CONTROL_D_STORE_KEYS[0]]).toMatchObject({
      version: 2,
      resourceIdentity: {
        code: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/),
      },
      profileId: null,
      endpointId: null,
    });
    expect(prepareControlDSync).not.toHaveBeenCalled();
    expect(applyControlDSync).not.toHaveBeenCalled();
  });

  it("binds DNS confirmation to the current endpoint and clears it on disconnect", async () => {
    storageState[CONTROL_D_STORE_KEYS[0]] = {
      version: 2,
      enabled: true,
      connected: true,
      autoSyncEnabled: true,
      status: "ready",
      resourceIdentity: { code: "ABCDE-FGHJK" },
      profileId: "profile-id",
      endpointId: "endpoint-id",
      resolverDoh: "https://dns.controld.com/private",
      dnsVerification: null,
      managedFolders: {},
      locationMappings: {},
      lastSyncedHash: "hash",
      lastAttemptAt: null,
      lastSuccessAt: "2026-09-10T10:00:00.000Z",
      lastError: null,
    };
    storageState[CONTROL_D_STORE_KEYS[1]] = "api-key";
    registerControlD({ getDebugMode: async () => false });

    const confirmed = await request({
      type: CONTROL_D_COMMANDS.confirmDns,
      verified: true,
    });
    expect(confirmed).toMatchObject({ ok: true, state: { dnsStatus: "verified" } });

    const disconnected = await request({ type: CONTROL_D_COMMANDS.disconnect });
    expect(disconnected).toMatchObject({
      ok: true,
      state: { connected: false, dnsStatus: "pending" },
    });
    expect(storageState[CONTROL_D_STORE_KEYS[0]]).toMatchObject({
      profileId: "profile-id",
      endpointId: "endpoint-id",
      dnsVerification: null,
    });
    expect(storageState[CONTROL_D_STORE_KEYS[1]]).toBeUndefined();
  });

  it("persists a toggle action in extension logs when debug mode comes from storage", async () => {
    registerControlD({ getDebugMode: async () => true });

    const response = await new Promise<unknown>((resolve) => {
      expect(
        messageListener(
          { type: CONTROL_D_COMMANDS.setEnabled, enabled: true },
          { id: "extension-id" },
          resolve,
        ),
      ).toBe(true);
    });

    expect(response).toMatchObject({ ok: true, state: { enabled: true } });
    await vi.waitFor(() => {
      expect(logExtensionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          event: "control-d.integration.toggled",
        }),
      );
    });
  });

  it("logs regional mapping changes for View Logs in debug mode", async () => {
    registerControlD({ getDebugMode: async () => true });

    const response = await new Promise<unknown>((resolve) => {
      messageListener(
        {
          type: CONTROL_D_COMMANDS.updateMapping,
          mapping: {
            locationId: "ottawa",
            proxyPk: "YUL",
            status: "approximate",
            confirmed: false,
          },
        },
        { id: "extension-id" },
        resolve,
      );
    });

    expect(response).toMatchObject({ ok: true });
    await vi.waitFor(() => {
      expect(logExtensionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          event: "control-d.mapping.updated",
          payload: {
            details: {
              locationId: "ottawa",
              proxyPk: "YUL",
              status: "approximate",
            },
          },
        }),
      );
    });
  });

  it("schedules automatic reconciliation when an applied integration starts", async () => {
    storageState[CONTROL_D_STORE_KEYS[0]] = {
      version: 2,
      enabled: true,
      connected: true,
      autoSyncEnabled: true,
      status: "ready",
      resourceIdentity: { code: "ABCDE-FGHJK" },
      profileId: "profile-id",
      endpointId: "endpoint-id",
      resolverDoh: "https://example.test/private-resolver",
      dnsVerification: null,
      managedFolders: {},
      locationMappings: {},
      lastSyncedHash: "hash",
      lastAttemptAt: "2026-09-10T10:00:00.000Z",
      lastSuccessAt: "2026-09-10T10:00:00.000Z",
      lastError: null,
    };
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    registerControlD({ getDebugMode: async () => true });

    await vi.waitFor(() => {
      expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1_500);
    });
    timeoutSpy.mockRestore();
  });

  it("debounces every saved rule or location mutation into automatic reconciliation", () => {
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    registerControlD({ getDebugMode: async () => false });

    const ruleSnapshots = [
      [{ pattern: "added.example", enabled: true }],
      [{ pattern: "edited.example", enabled: true }],
      [],
    ];
    for (const rules of ruleSnapshots) {
      storageListener({ [RULES_STORAGE_KEY]: { newValue: rules } }, "local");
    }
    storageListener(
      { [LOCATIONS_STORAGE_KEY]: { newValue: [{ id: "warsaw" }] } },
      "local",
    );

    expect(timeoutSpy).toHaveBeenCalledTimes(4);
    expect(timeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 1_500);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(3);
    timeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });
});
