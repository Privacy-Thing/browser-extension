import { CMD_XRAY_SET_INSPECTOR } from "@privacy-brand/xray-protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RuntimeSnapshot } from "@/shared/types";

const snapshot: RuntimeSnapshot = {
  geo: { latitude: 0, longitude: 0, accuracy: 20, noiseRadius: 50 },
  locale: { language: "en", languages: ["en"], timeZone: "UTC", acceptLanguage: "en" },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
  debugMode: false,
  watchPositionDelay: [60, 500],
  authKey: "fixed-rule-nonce",
};
const desired = {
  methods: ["geolocation.getCurrentPosition"] as const,
  mode: "first-call" as const,
};
const sender = {
  id: "extension",
  url: "chrome-extension://extension/src/ui/sidebar/index.html",
};
const reload = vi.fn(async () => undefined);
let stored: Record<string, unknown>;
beforeEach(() => {
  vi.resetModules();
  stored = {};
  reload.mockClear();
  vi.stubGlobal("chrome", {
    runtime: {
      id: "extension",
      getURL: (path: string) => `chrome-extension://extension/${path}`,
    },
    tabs: {
      get: vi.fn(async (id: number) => ({
        id,
        url: "https://probe.example/path",
        cookieStoreId: "container-1",
      })),
      reload,
    },
    storage: {
      local: { get: vi.fn(async () => ({})) },
      session: {
        get: vi.fn(async () => structuredClone(stored)),
        set: vi.fn(async (value) => {
          Object.assign(stored, structuredClone(value));
        }),
      },
    },
    alarms: { clear: vi.fn(async () => true), create: vi.fn(async () => undefined) },
  });
});
afterEach(() => vi.unstubAllGlobals());

const setup = async (
  decision = {
    snapshot: snapshot as RuntimeSnapshot | null,
    trustedSiteMatched: false,
  },
) => {
  const { createInspectorHandlers } = await import("./inspector-commands");
  const prepare = vi.fn(async () => undefined);
  const handlers = createInspectorHandlers({
    resolveRuntimeDecision: vi.fn(async () => decision),
    prepare,
    invalidate: vi.fn(),
    publish: vi.fn(),
  });
  const state = await import("./inspector-state");
  const store = await import("./storage/inspector-sessions");
  return { ...handlers, ...state, ...store, prepare, decision };
};

describe("tab Inspector activation", () => {
  it("overlays only the armed tab and host, preserving the original snapshot and authKey", async () => {
    const h = await setup();
    const result = await h.applyInspectorState(3, desired, "next-load");
    expect(result.appliedVia).toBe("next-load");
    expect(result.state).toMatchObject({
      armed: true,
      pendingReload: true,
      appliesLive: false,
    });
    const armed = h.withInspector(3, "probe.example", h.decision);
    expect(armed.snapshot?.analystTraps).toEqual(desired);
    expect(armed.snapshot?.authKey).toBe(snapshot.authKey);
    expect(snapshot).not.toHaveProperty("analystTraps");
    expect(h.withInspector(4, "probe.example", h.decision)).toBe(h.decision);
    expect(h.withInspector(3, "other.example", h.decision)).toBe(h.decision);
    expect(reload).not.toHaveBeenCalled();
    await h.recordInspectorDocument(3, "probe.example", armed.snapshot);
    expect((await h.getInspectorState(3)).pendingReload).toBe(false);
    await h.applyInspectorState(3, null, "next-load");
    expect(h.withInspector(3, "probe.example", armed).snapshot).not.toHaveProperty(
      "analystTraps",
    );
    expect(await h.getInspectorState(3)).toMatchObject({
      armed: false,
      pendingReload: true,
    });
    await h.recordInspectorDocument(3, "probe.example", snapshot);
    expect((await h.getInspectorState(3)).pendingReload).toBe(false);
  });
  it("seeds before reload and survives background suspension until tab/host cleanup", async () => {
    const h = await setup();
    expect((await h.applyInspectorState(3, desired, "now")).appliedVia).toBe("reload");
    expect(h.prepare.mock.invocationCallOrder[0]).toBeLessThan(
      reload.mock.invocationCallOrder[0]!,
    );
    expect(reload).toHaveBeenCalledWith(3);
    vi.resetModules();
    const restored = await import("./storage/inspector-sessions");
    await restored.initializeInspectors();
    expect(restored.readInspector(3, "probe.example")?.desired).toEqual(desired);
    await restored.navigateInspector(3, "other.example");
    expect(restored.readInspector(3, "probe.example")).toBeUndefined();
    await restored.storeInspector(4, "probe.example", desired);
    await restored.removeInspector(4);
    expect(restored.readInspector(4, "probe.example")).toBeUndefined();
  });
  it("reports Trusted Sites unavailable and never adds traps", async () => {
    const h = await setup({ snapshot: null, trustedSiteMatched: true });
    expect(await h.getInspectorState(3)).toMatchObject({
      available: false,
      unavailableReason: "trusted-site",
      trappableMethodIds: [],
    });
    await expect(h.applyInspectorState(3, desired, "now")).rejects.toThrow(
      "unavailable",
    );
    expect(h.withInspector(3, "probe.example", h.decision).snapshot).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
  it("rejects page senders, malformed selections, and native methods", async () => {
    const h = await setup();
    const command = {
      type: CMD_XRAY_SET_INSPECTOR,
      tabId: 3,
      methodIds: ["geolocation.getCurrentPosition"],
      mode: "first-call",
      apply: "next-load",
    };
    await expect(
      h.inspectorCommand(command, { id: "extension", url: "https://probe.example" }),
    ).rejects.toThrow("extension page");
    await expect(
      h.inspectorCommand({ ...command, methodIds: ["unknown"] }, sender),
    ).rejects.toThrow();
    await expect(
      h.inspectorCommand({ ...command, methodIds: ["battery.manager.level"] }, sender),
    ).rejects.toThrow("not spoofed");
    expect(await h.inspectorCommand(command, sender)).toMatchObject({
      appliedVia: "next-load",
    });
  });
});
