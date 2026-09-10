import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTROL_D_STORE_KEYS,
  forgetControlDApiKey,
  loadControlDApiKey,
  loadControlDConfig,
  saveControlDApiKey,
} from "./storage";

import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";

const state: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(state)) Reflect.deleteProperty(state, key);
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (key: string) => (key in state ? { [key]: state[key] } : {})),
        set: vi.fn(async (value: Record<string, unknown>) =>
          Object.assign(state, value),
        ),
        remove: vi.fn(async (key: string) => Reflect.deleteProperty(state, key)),
      },
    },
  });
});

describe("Control D storage", () => {
  it("keeps its API key outside all ordinary settings keys", async () => {
    expect(
      CONTROL_D_STORE_KEYS.some((key) =>
        Object.values(EXTENSION_STORAGE_KEYS).includes(key as never),
      ),
    ).toBe(false);

    await saveControlDApiKey("secret");
    expect(await loadControlDApiKey()).toBe("secret");
    await forgetControlDApiKey();
    expect(await loadControlDApiKey()).toBeNull();
  });

  it("creates a versioned config without interpreting malformed older data", async () => {
    state[CONTROL_D_STORE_KEYS[0]] = { version: 0, profileId: "foreign" };

    const config = await loadControlDConfig();

    expect(config).toMatchObject({
      version: 1,
      enabled: false,
      connected: false,
      autoSyncEnabled: false,
      profileId: null,
      endpointId: null,
    });
    expect(config.instanceId).toBeTruthy();
  });

  it("keeps an existing connected integration visible after adding the feature switch", async () => {
    state[CONTROL_D_STORE_KEYS[0]] = {
      version: 1,
      instanceId: "existing-instance",
      connected: true,
      autoSyncEnabled: true,
      status: "ready",
      profileId: "profile-id",
      endpointId: "endpoint-id",
      resolverDoh: "https://example.test/private-resolver",
      managedFolders: {},
      locationMappings: {},
      lastSyncedHash: "hash",
      lastAttemptAt: "2026-09-10T10:00:00.000Z",
      lastSuccessAt: "2026-09-10T10:00:00.000Z",
      lastError: null,
    };

    const config = await loadControlDConfig();

    expect(config.enabled).toBe(true);
    expect(config.connected).toBe(true);
    expect(config.profileId).toBe("profile-id");
  });

  it("recovers automatic sync disabled by the obsolete endpoint-name conflict", async () => {
    state[CONTROL_D_STORE_KEYS[0]] = {
      version: 1,
      instanceId: "existing-instance",
      enabled: true,
      connected: true,
      autoSyncEnabled: false,
      status: "conflict",
      profileId: "profile-id",
      endpointId: "endpoint-id",
      resolverDoh: "https://example.test/private-resolver",
      managedFolders: {},
      locationMappings: {},
      lastSyncedHash: "hash",
      lastAttemptAt: "2026-09-10T14:23:54.000Z",
      lastSuccessAt: "2026-09-10T11:09:48.000Z",
      lastError: "The managed Control D endpoint was renamed.",
    };

    const config = await loadControlDConfig();

    expect(config).toMatchObject({
      autoSyncEnabled: true,
      status: "ready",
      lastError: null,
    });
    expect(state[CONTROL_D_STORE_KEYS[0]]).toMatchObject({
      autoSyncEnabled: true,
      status: "ready",
      lastError: null,
    });
  });
});
