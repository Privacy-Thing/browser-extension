// @vitest-environment jsdom

import { getWindowSeedPrefix } from "@privacy-brand/refract-browser/common/runtime-config";
import { createIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { afterEach, expect, it, vi } from "vitest";

import {
  ANALYST_CMD,
  ANALYST_HANDOFF_RUNTIME,
  WORKER_PATCH_GUARD_KEY,
} from "@/shared/build-id-test-values";
import type { RuntimeSnapshot } from "@/shared/types";

type Installer = (state: {
  integrity: ReturnType<typeof createIntegrityRegistry>;
  snapshot?: RuntimeSnapshot;
}) => unknown;

const mocks = vi.hoisted(() => ({
  installers: {} as Record<string, Installer>,
  workerSnapshots: [] as RuntimeSnapshot[],
}));

vi.mock("@privacy-brand/refract-core/runtime/install", () => ({
  getRefractRuntimeState: vi.fn(() => undefined),
  installRuntimeOnce: vi.fn(
    (_global: unknown, _snapshot: unknown, _options: unknown, installers) => {
      mocks.installers = installers as Record<string, Installer>;
      return {};
    },
  ),
  updateRefractSnapshot: vi.fn(),
}));
// Captures the snapshot each new worker starts from.
vi.mock("@privacy-brand/refract-browser/common/worker-bootstrap", () => ({
  createWorkerSource: vi.fn(({ snapshot }: { snapshot: RuntimeSnapshot }) => {
    mocks.workerSnapshots.push(snapshot);
    return "self.close();";
  }),
}));

const loaded: RuntimeSnapshot = {
  geo: { latitude: 52.23, longitude: 21.01, accuracy: 25, noiseRadius: 100 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500],
  authKey: "worker-selection",
  sharedWorkerHandlingMode: "spoof",
  analystTraps: { methods: ["date.now"], mode: "every-call" },
};

const createObjectURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
afterEach(() => {
  if (createObjectURL) Object.defineProperty(URL, "createObjectURL", createObjectURL);
  else Reflect.deleteProperty(URL, "createObjectURL");
  vi.resetModules();
  vi.unstubAllGlobals();
  window.name = "";
  Reflect.deleteProperty(globalThis, Symbol.for(WORKER_PATCH_GUARD_KEY));
});

it("starts each dedicated worker from the document's current Inspector selection", async () => {
  window.name =
    getWindowSeedPrefix() +
    btoa(JSON.stringify({ kind: "snapshot", previousName: "", snapshot: loaded }));
  vi.stubGlobal(
    "Worker",
    class {
      addEventListener = vi.fn();
      postMessage = vi.fn();
      terminate = vi.fn();
    },
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: () => "blob:https://example.test/bootstrap",
  });
  await import("@/injection/main/index");
  const usage =
    await import("@privacy-brand/refract-browser/common/surface-usage-emitter");
  const installer =
    mocks.installers["worker-runtime"] ?? mocks.installers["dedicated-workers"];
  installer!({ integrity: createIntegrityRegistry(), snapshot: loaded });
  const start = () => {
    new Worker("https://example.test/worker.js");
    return mocks.workerSnapshots.at(-1);
  };
  usage.setAnalystTraps({ methods: ["battery.manager.level"], mode: "first-call" }, 7);
  expect(start()).toMatchObject({
    authKey: "worker-selection",
    analystTraps: { methods: ["battery.manager.level"], mode: "first-call" },
  });
  usage.setAnalystTraps(null, 8);
  expect(start()).not.toHaveProperty("analystTraps");
});

it("starts workers created after a live disarm without the earlier selection", async () => {
  window.name =
    getWindowSeedPrefix() +
    btoa(JSON.stringify({ kind: "snapshot", previousName: "", snapshot: loaded }));
  vi.stubGlobal(
    "Worker",
    class {
      addEventListener = vi.fn();
      postMessage = vi.fn();
      terminate = vi.fn();
    },
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: () => "blob:https://example.test/bootstrap",
  });
  await import("@/injection/main/index");
  const usage =
    await import("@privacy-brand/refract-browser/common/surface-usage-emitter");
  const installer =
    mocks.installers["worker-runtime"] ?? mocks.installers["dedicated-workers"];
  installer!({ integrity: createIntegrityRegistry(), snapshot: loaded });
  const start = () => {
    new Worker("https://example.test/worker.js");
    return mocks.workerSnapshots.at(-1);
  };
  // The runtime bundle's private endpoint, as the isolated bootstrap receives it.
  let endpoint: Element | null = null;
  document.addEventListener(ANALYST_HANDOFF_RUNTIME, (event) => {
    endpoint = (event as MouseEvent).relatedTarget as Element;
  });
  const channel = await import("@/injection/main/analyst-channel");
  channel.openAnalystChannel(ANALYST_HANDOFF_RUNTIME);
  const live = (m: string[] | null, r: number) =>
    endpoint!.dispatchEvent(
      new CustomEvent(ANALYST_CMD, { detail: JSON.stringify({ r, m, e: true }) }),
    );
  live(["date.now"], 1_999);
  expect(start()).toMatchObject({
    analystTraps: { methods: ["date.now"], mode: "every-call" },
  });
  live(null, 2_000);
  expect(start()).not.toHaveProperty("analystTraps");
  live(["battery.manager.level"], 2_001);
  expect(start()).toMatchObject({
    analystTraps: { methods: ["battery.manager.level"], mode: "every-call" },
  });
  expect(usage.markSurfaceUsed).not.toBe(usage.recordSurfaceUse);
});
