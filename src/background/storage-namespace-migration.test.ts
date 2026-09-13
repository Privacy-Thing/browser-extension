import { beforeEach, describe, expect, it, vi } from "vitest";

import { migrateRetiredNamespace } from "./storage-namespace-migration";

const localState: Record<string, unknown> = {};
const sessionState: Record<string, unknown> = {};

const select = (state: Record<string, unknown>, keys: readonly string[]) =>
  Object.fromEntries(
    keys.filter((key) => key in state).map((key) => [key, state[key]]),
  );

beforeEach(() => {
  for (const key of Object.keys(localState)) Reflect.deleteProperty(localState, key);
  for (const key of Object.keys(sessionState))
    Reflect.deleteProperty(sessionState, key);
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (keys: readonly string[]) => select(localState, keys)),
        set: vi.fn(async (values: Record<string, unknown>) =>
          Object.assign(localState, values),
        ),
        remove: vi.fn(async (keys: readonly string[]) => {
          for (const key of keys) Reflect.deleteProperty(localState, key);
        }),
      },
      session: {
        get: vi.fn(async (keys: readonly string[]) => select(sessionState, keys)),
        remove: vi.fn(async (keys: readonly string[]) => {
          for (const key of keys) Reflect.deleteProperty(sessionState, key);
        }),
      },
    },
  });
});

describe("production storage compatibility", () => {
  it("preserves an unknown experimental namespace byte-for-byte", async () => {
    const experimental = { version: 2, nested: { keep: true } };
    localState["pt.experimental.control-d.v2.config"] = experimental;

    await migrateRetiredNamespace();

    expect(localState["pt.experimental.control-d.v2.config"]).toBe(experimental);
    expect(chrome.storage.local.remove).not.toHaveBeenCalledWith(
      expect.arrayContaining(["pt.experimental.control-d.v2.config"]),
    );
  });
});
