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
  it("uses a private namespace disjoint from production settings", () => {
    expect(CONTROL_D_STORE_KEYS).toEqual([
      "pt.experimental.control-d.v2.config",
      "pt.experimental.control-d.v2.api-key",
    ]);
    expect(
      CONTROL_D_STORE_KEYS.some((key) =>
        Object.values(EXTENSION_STORAGE_KEYS).includes(key as never),
      ),
    ).toBe(false);
  });

  it("creates v2 without reading or changing old experimental keys", async () => {
    const oldValue = { version: 1, instanceId: "old-instance" };
    state["pt.experimental.control-d.config.v1"] = oldValue;
    const config = await loadControlDConfig();
    expect(config).toMatchObject({
      version: 2,
      enabled: false,
      connected: false,
      resourceIdentity: null,
      profileId: null,
      endpointId: null,
    });
    expect(state["pt.experimental.control-d.config.v1"]).toBe(oldValue);
  });

  it("replaces only malformed v2 config", async () => {
    state[CONTROL_D_STORE_KEYS[0]] = { version: 2, profileId: "foreign" };
    state["unrelated.production.key"] = { keep: true };
    expect((await loadControlDConfig()).resourceIdentity).toBeNull();
    expect(state["unrelated.production.key"]).toEqual({ keep: true });
  });

  it("stores and forgets only the private API key", async () => {
    await saveControlDApiKey(" secret ");
    expect(await loadControlDApiKey()).toBe("secret");
    await forgetControlDApiKey();
    expect(await loadControlDApiKey()).toBeNull();
  });
});
