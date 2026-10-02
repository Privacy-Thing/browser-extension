import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";

let local: Record<string, unknown>;
let session: Record<string, unknown>;
const area = (read: () => Record<string, unknown>) => ({
  get: vi.fn(async () => ({ ...read() })),
  set: vi.fn(async (values: Record<string, unknown>) => Object.assign(read(), values)),
});

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  local = { [EXTENSION_STORAGE_KEYS.rules]: [{ pattern: "h.example", enabled: true }] };
  session = {};
  vi.stubGlobal("chrome", {
    storage: { local: area(() => local), session: area(() => session) },
    alarms: { create: vi.fn(async () => undefined), clear: vi.fn(async () => true) },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("host pause storage", () => {
  it("retains timed exceptions on worker and browser restart, but rejects the exact deadline", async () => {
    let store = await import("./host-protection-pauses");
    await store.setHostPause("h.example", "ten-minutes");
    const pause = store.getHostPause("h.example")!;
    expect(pause.expiresAt).toBe(601000);
    await store.recordPausedDocument(1, "h.example", pause.id);
    expect(store.getHostPauseStatus("h.example", 1)).toEqual({
      pause,
      reloadRequired: false,
    });
    vi.resetModules();
    store = await import("./host-protection-pauses");
    await store.initializeHostPauses();
    expect(store.getHostPause("h.example")).toEqual(pause);
    session = {};
    vi.resetModules();
    store = await import("./host-protection-pauses");
    await store.initializeHostPauses();
    expect(store.getHostPause("h.example")).toEqual(pause);
    expect(store.getHostPauseStatus("h.example", 1).reloadRequired).toBe(true);
    vi.setSystemTime(601000);
    expect(store.getHostPause("h.example")).toBeUndefined();
    expect(await store.expireHostPauses()).toEqual(["h.example"]);
    expect(local[EXTENSION_STORAGE_KEYS.hostProtectionPauses]).toEqual([]);
  });

  it("keeps session pauses across worker restarts and ends them on browser exit or crash", async () => {
    let store = await import("./host-protection-pauses");
    await store.setHostPause("h.example", "session");
    const pause = store.getHostPause("h.example");
    expect(local[EXTENSION_STORAGE_KEYS.hostProtectionPauses]).toEqual([]);
    vi.resetModules();
    store = await import("./host-protection-pauses");
    await store.initializeHostPauses();
    expect(store.getHostPause("h.example")).toEqual(pause);
    session = {};
    vi.resetModules();
    store = await import("./host-protection-pauses");
    await store.initializeHostPauses();
    expect(store.getHostPause("h.example")).toBeUndefined();
  });

  it("serializes replacement and resume without rewriting rules or forgetting a paused document", async () => {
    const store = await import("./host-protection-pauses");
    const rulesBefore = structuredClone(local[EXTENSION_STORAGE_KEYS.rules]);
    await Promise.all([
      store.setHostPause("h.example", "session"),
      store.setHostPause("h.example", "ten-minutes"),
    ]);
    const pause = store.getHostPause("h.example")!;
    expect(store.getHostPauses()).toHaveLength(1);
    expect(pause.expiresAt).toBe(601000);
    await store.recordPausedDocument(1, "h.example", pause.id);
    await store.setHostPause("h.example", "resume");
    expect(store.getHostPauseStatus("h.example", 1)).toEqual({
      pause: null,
      reloadRequired: true,
    });
    expect(store.getHostPauseStatus("k.example", 1)).toEqual({
      pause: null,
      reloadRequired: false,
    });
    await store.recordPausedDocument(1, "h.example");
    expect(store.getHostPauseStatus("h.example", 1).reloadRequired).toBe(false);
    expect(local[EXTENSION_STORAGE_KEYS.rules]).toEqual(rulesBefore);
  });

  it("restores expired deadlines without exposing an active exception before alarm delivery", async () => {
    local[EXTENSION_STORAGE_KEYS.hostProtectionPauses] = [
      { hostname: "h.example", id: "old", expiresAt: 1000 },
    ];
    const store = await import("./host-protection-pauses");
    await store.initializeHostPauses();
    expect(store.getHostPause("h.example")).toBeUndefined();
    expect(await store.expireHostPauses()).toEqual(["h.example"]);
  });
});

it.each(["local", "session", "alarm"] as const)(
  "retries initialization after a transient %s failure",
  async (source) => {
    const failure = new Error("Temporary failure");
    const fail = source === "alarm" ? chrome.alarms.clear : chrome.storage[source].get;
    vi.mocked(fail).mockRejectedValueOnce(failure);
    const store = await import("./host-protection-pauses");
    const first = store.initializeHostPauses();
    const concurrent = store.initializeHostPauses();
    expect(concurrent).toBe(first);
    await expect(first).rejects.toBe(failure);
    await store.setHostPause("h.example", "session");
    expect(store.getHostPause("h.example")?.hostname).toBe("h.example");
  },
);
