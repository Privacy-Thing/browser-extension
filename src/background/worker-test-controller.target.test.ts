import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { buildSurfaceAssessments } from "@/background/surface-assessments";
import {
  EXTENSION_COMMAND_TYPES as commands,
  EXTENSION_STORAGE_KEYS as keys,
} from "@/shared/extension-contract";
import { applyHostOverride } from "@/shared/host-protection-pause";
import type { RuntimeSnapshot } from "@/shared/types";
import type { WorkerTestResponse } from "@/shared/worker-test";

vi.mock("@/background/settings-import-transaction", () => {
  let queue = Promise.resolve<unknown>(undefined);
  const lock = (operation: () => Promise<unknown>) => {
    const next = queue.then(operation, operation);
    queue = next.catch(() => undefined);
    return next;
  };
  return { withConfigurationLock: lock, withConfigMutation: lock };
});
const baseline: RuntimeSnapshot = {
  geo: { latitude: 52, longitude: 21, accuracy: 50, noiseRadius: 100 },
  locale: {
    language: "pl",
    languages: ["pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl",
  },
  date: { baseEpochMs: 1000, offsetMs: 0, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500],
  blockServiceWorkerRegistration: true,
  sharedWorkerHandlingMode: "strict",
  fingerprint: { canvasNoiseSeed: 123 },
};
let local: Record<string, unknown>;
let sessionStorage: Record<string, unknown>;
let tab: { id: number; url: string };
const area = (read: () => Record<string, unknown>) => ({
  get: vi.fn(async (input: string | string[]) =>
    Object.fromEntries(
      (typeof input === "string" ? [input] : input).map((key) => [key, read()[key]]),
    ),
  ),
  set: vi.fn(async (values: Record<string, unknown>) =>
    Object.assign(read(), structuredClone(values)),
  ),
});
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  local = {
    [keys.rules]: [
      {
        pattern: "*.example.test",
        enabled: true,
        locationId: "war",
        ruleSeedKey: "seed01",
        authKey: "auth0001",
        relaxCspForWorkers: false,
        fingerprintSurfaceOverrides: { canvas: false, serviceWorker: true },
      },
    ],
    [keys.preferences]: {},
  };
  sessionStorage = {};
  tab = { id: 1, url: "https://h.example.test/path" };
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Chrome/140.0.0.0" });
  vi.stubGlobal("chrome", {
    storage: { local: area(() => local), session: area(() => sessionStorage) },
    runtime: { getManifest: () => ({ version: "0.9.3.8" }) },
    tabs: { query: vi.fn(async () => [tab]), get: vi.fn(async () => tab) },
    alarms: { create: vi.fn(), clear: vi.fn() },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const ready = (response: WorkerTestResponse) => {
  expect(response.ok).toBe(true);
  if (!response.ok) throw new Error(response.error);
  return response;
};
const setup = async () => {
  const storage = await import("@/background/storage/host-protection-pauses");
  const { createWorkerTestCtl } = await import("@/background/worker-test-controller");
  const activate = vi.fn(async (hostname: string) => {
    await storage.recordPausedDocument(1, hostname, storage.getHostPause(hostname)?.id);
  });
  const getXRayState = vi.fn(async (): Promise<GetXRayStateResponse> => {
    const pause = storage.getHostPause("h.example.test");
    const snapshot = pause ? applyHostOverride(baseline, pause) : baseline;
    return {
      ok: true,
      hostname: "h.example.test",
      rulePattern: "*.example.test",
      locationId: "war",
      displayedProfileLabel: "PRIVATE preset",
      snapshot,
      assessments: buildSurfaceAssessments({
        source: "site-rule",
        snapshot,
        runtimeExpected: true,
      }),
      accessedCategories: {},
      failedCategories: {},
      explanation: { winningSource: "rule", effectiveLocationId: "war", steps: [] },
    };
  });
  return {
    storage,
    activate,
    getXRayState,
    run: createWorkerTestCtl(getXRayState, activate),
  };
};
const start = (kind: "service-worker" | "shared-worker" = "service-worker") => ({
  type: commands.startWorkerTest,
  hostname: "h.example.test",
  tabId: 1,
  kind,
});
const finish = (id: string, action: "helped" | "failed" | "cancel" | "save") => ({
  type: commands.finishWorkerTest,
  hostname: "h.example.test",
  tabId: 1,
  id,
  action,
});

it.each(["service-worker", "shared-worker"] as const)(
  "%s changes only its policy and restores on failure without editing rules or preferences",
  async (kind) => {
    const { run, storage } = await setup();
    const config = structuredClone(local[keys.rules]);
    const response = ready(await run(start(kind)));
    const pause = storage.getHostPause("h.example.test")!;
    const adjusted = applyHostOverride(baseline, pause)!;
    const expected =
      kind === "service-worker"
        ? {
            ...baseline,
            hostOverrideExpiresAt: 601000,
            blockServiceWorkerRegistration: false,
          }
        : {
            ...baseline,
            hostOverrideExpiresAt: 601000,
            sharedWorkerHandlingMode: "native",
            sharedWorkerCompatibilityMode: true,
          };
    expect(adjusted).toEqual(expected);
    expect(JSON.stringify(response.session?.before)).not.toMatch(
      /h\.example|PRIVATE|identity|latitude|authKey/,
    );
    expect(
      ready(await run(finish(response.session!.id, "failed"))).session?.phase,
    ).toBe("failed");
    expect(storage.getHostPause("h.example.test")).toBeUndefined();
    expect(local[keys.rules]).toEqual(config);
    expect(local[keys.preferences]).toEqual({});
  },
);
it("keeps a helped test temporary until a second explicit decision saves only an exact-host policy", async () => {
  const { run, storage } = await setup();
  const original = structuredClone(local[keys.rules]);
  const response = ready(await run(start()));
  const id = response.session!.id;
  expect(await run(finish(id, "save"))).toEqual({
    ok: false,
    error: "configuration-changed",
  });
  expect(ready(await run(finish(id, "helped"))).session?.phase).toBe("helped");
  expect(local[keys.rules]).toEqual(original);
  expect(storage.getHostPause("h.example.test")).toBeDefined();
  const saved = ready(await run(finish(id, "save")));
  expect(saved.session?.phase).toBe("saved");
  expect(local[keys.rules]).toEqual(original);
  expect(local[keys.preferences]).toMatchObject({
    workerPolicyExceptions: { "h.example.test": { serviceWorker: false } },
  });
  expect(storage.getHostPause("h.example.test")).toBeUndefined();
});
it("refuses a stale save after configuration changes, while cancellation still restores the current settings", async () => {
  const { run, storage } = await setup();
  const id = ready(await run(start())).session!.id;
  await run(finish(id, "helped"));
  local[keys.preferences] = { uiLocale: "uk" };
  expect(await run(finish(id, "save"))).toEqual({
    ok: false,
    error: "configuration-changed",
  });
  expect(ready(await run(finish(id, "cancel"))).session?.phase).toBe("cancelled");
  expect(storage.getHostPause("h.example.test")).toBeUndefined();
  expect(local[keys.preferences]).toEqual({ uiLocale: "uk" });
});
it("serializes competing starts and never cancels a replacement pause with an old test ID", async () => {
  const { run, storage } = await setup();
  const results = await Promise.all([run(start()), run(start("shared-worker"))]);
  expect(results.filter((value) => value.ok)).toHaveLength(1);
  const id = ready(results[0]!).session!.id;
  await storage.setHostPause("h.example.test", "session");
  const replacement = storage.getHostPause("h.example.test");
  expect(await run(finish(id, "cancel"))).toEqual({ ok: false, error: "test-expired" });
  expect(storage.getHostPause("h.example.test")).toEqual(replacement);
});
it("cancels the pinned host after its tab navigates away", async () => {
  const { run, storage } = await setup();
  const id = ready(await run(start())).session!.id;
  tab.url = "https://independent.test";
  expect(ready(await run(finish(id, "cancel"))).session?.phase).toBe("cancelled");
  expect(storage.getHostPause("h.example.test")).toBeUndefined();
});
it("survives a worker restart, rejects the exact deadline and drops orphan tests on browser restart", async () => {
  let setupResult = await setup();
  const id = ready(await setupResult.run(start())).session!.id;
  vi.resetModules();
  setupResult = await setup();
  expect(setupResult.storage.getHostPause("h.example.test")).toBeUndefined();
  const restored = ready(
    await setupResult.run({
      type: commands.getWorkerTest,
      hostname: "h.example.test",
      tabId: 1,
    }),
  );
  expect(restored.session?.id).toBe(id);
  expect(setupResult.storage.getHostPause("h.example.test")?.id).toBe(id);
  vi.setSystemTime(601000);
  expect(setupResult.storage.getHostPause("h.example.test")).toBeUndefined();
  expect(
    ready(
      await setupResult.run({
        type: commands.getWorkerTest,
        hostname: "h.example.test",
        tabId: 1,
      }),
    ).session?.phase,
  ).toBe("expired");
  vi.setSystemTime(1000);
  sessionStorage = {};
  vi.resetModules();
  setupResult = await setup();
  await setupResult.storage.initializeHostPauses();
  expect(setupResult.storage.getHostPause("h.example.test")).toBeUndefined();
});
it.each(["trusted", "pause", "reload"])(
  "does not test through a %s conflict",
  async (conflict) => {
    const { run, storage, getXRayState } = await setup();
    if (conflict === "pause") await storage.setHostPause("h.example.test", "session");
    if (conflict === "reload")
      await storage.recordPausedDocument(1, "h.example.test", "old");
    if (conflict === "trusted") {
      const state = await getXRayState();
      if (state.ok)
        getXRayState.mockResolvedValue({
          ...state,
          explanation: {
            winningSource: "trusted-site",
            effectiveLocationId: null,
            steps: [],
          },
        });
    }
    expect(await run(start())).toEqual({ ok: false, error: "test-unavailable" });
  },
);

it("rolls back an override when activation fails", async () => {
  const { run, storage, activate } = await setup();
  activate.mockRejectedValueOnce(new Error("seed failed"));
  expect(await run(start())).toEqual({ ok: false, error: "test-failed" });
  expect(storage.getHostPause("h.example.test")).toBeUndefined();
  expect(activate).toHaveBeenCalledTimes(2);
  expect(
    ready(
      await run({ type: commands.getWorkerTest, hostname: "h.example.test", tabId: 1 }),
    ).session?.phase,
  ).toBe("failed");
});
it("saves policy without copying a Firefox container location or identity into global rules", async () => {
  const { run } = await setup();
  local[keys.rules] = [];
  local[keys.containerAssignments] = [
    {
      cookieStoreId: "firefox-container-1",
      enabled: true,
      locationId: "war",
      ruleSeedKey: "seed01",
      authKey: "auth0001",
    },
    {
      cookieStoreId: "firefox-container-2",
      enabled: true,
      locationId: "tok",
      ruleSeedKey: "seed02",
      authKey: "auth0002",
    },
  ];
  Object.assign(tab, { cookieStoreId: "firefox-container-1" });
  const before = structuredClone(local[keys.containerAssignments]);
  const id = ready(await run(start("shared-worker"))).session!.id;
  await run(finish(id, "helped"));
  ready(await run(finish(id, "save")));
  expect(local[keys.rules]).toEqual([]);
  expect(local[keys.containerAssignments]).toEqual(before);
  expect(local[keys.preferences]).toMatchObject({
    workerPolicyExceptions: { "h.example.test": { sharedWorker: "native" } },
  });
});
