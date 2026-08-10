// @vitest-environment jsdom

import { createIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RUNTIME_APPLIED_ATTR,
  SHIM_GUARD_KEY,
  WORKER_PATCH_GUARD_KEY,
} from "@/shared/build-id-test-values";
import type { RuntimeSnapshot } from "@/shared/types";

type RuntimeInstaller = (state: {
  integrity: ReturnType<typeof createIntegrityRegistry>;
  snapshot?: RuntimeSnapshot;
}) => unknown;

const mocks = vi.hoisted(() => ({
  snapshot: null as RuntimeSnapshot | null,
  workersInstaller: undefined as RuntimeInstaller | undefined,
  xrayBridgeInstaller: undefined as RuntimeInstaller | undefined,
  markSurfaceFailed: vi.fn(),
  markSurfaceEvidence: vi.fn(),
  markSurfaceUsed: vi.fn(),
  runtimeSymbolKey: null as string | null,
}));

vi.mock("@privacy-brand/refract-browser/common/debug-logger", () => ({
  createLogger: vi.fn(() => vi.fn()),
  createOnceLogger: vi.fn(() => vi.fn()),
}));

vi.mock("@privacy-brand/refract-browser/common/runtime-config", () => ({
  cleanupRuntimeWindowSeed: vi.fn(),
  finalizeRuntimeEnabled: vi.fn(),
  getRuntimeReadyEvent: vi.fn(() => "gw:runtime-ready"),
  installPostInitCleanup: vi.fn(() => ({ stop: vi.fn() })),
  isRuntimeDisabled: vi.fn(() => false),
  observeConfigInsertion: vi.fn(() => () => undefined),
  readInitialSnapshot: vi.fn(() => mocks.snapshot),
  removeConfigElement: vi.fn(),
}));

vi.mock("@privacy-brand/refract-browser/common/surface-error-emitter", () => ({
  markSurfaceFailed: mocks.markSurfaceFailed,
  markSurfaceEvidence: mocks.markSurfaceEvidence,
}));

vi.mock("@privacy-brand/refract-browser/common/surface-usage-emitter", () => ({
  installUsageListener: vi.fn(),
  markSurfaceUsed: mocks.markSurfaceUsed,
  setSurfaceUsageSourceId: vi.fn(),
}));

vi.mock("@privacy-brand/refract-browser/common/worker-bootstrap", () => ({
  createWorkerSource: vi.fn(() => "self.close();"),
}));

vi.mock("@privacy-brand/refract-browser/common/worker-runtime-log-relay", () => ({
  attachWorkerLogRelay: vi.fn(),
}));

vi.mock("@privacy-brand/refract-core/native/native-mask", () => ({
  createNativeSource: vi.fn((name: string) => `function ${name}() { [native code] }`),
  maskAsNative: vi.fn((value: unknown) => value),
  mirrorNativeToStringInto: vi.fn(),
}));

vi.mock("@privacy-brand/refract-core/runtime/install", () => ({
  getRefractRuntimeState: vi.fn(() => undefined),
  installRuntimeOnce: vi.fn(
    (
      _global: unknown,
      _snapshot: unknown,
      options: { symbolKey: string },
      installers: Record<string, RuntimeInstaller>,
    ) => {
      mocks.runtimeSymbolKey = options.symbolKey;
      mocks.workersInstaller =
        installers["dedicated-workers"] ?? installers["worker-runtime"];
      mocks.xrayBridgeInstaller = installers["xray-bridge"];
      return {};
    },
  ),
  updateRefractSnapshot: vi.fn(),
}));

const createSnapshot = (): RuntimeSnapshot => ({
  geo: { latitude: 52.23, longitude: 21.01, accuracy: 25, noiseRadius: 100 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl;q=0.9",
  },
  date: {
    baseEpochMs: 0,
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [60, 500],
  authKey: "worker-test-auth",
  sharedWorkerHandlingMode: "spoof",
});

const originalDescriptors = {
  Blob: Object.getOwnPropertyDescriptor(globalThis, "Blob"),
  Worker: Object.getOwnPropertyDescriptor(globalThis, "Worker"),
  createObjectURL: Object.getOwnPropertyDescriptor(URL, "createObjectURL"),
  revokeObjectURL: Object.getOwnPropertyDescriptor(URL, "revokeObjectURL"),
};

const restoreDescriptor = (
  target: object,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void => {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
  } else {
    Reflect.deleteProperty(target, property);
  }
};

const loadMainWorkerInstaller = async (): Promise<RuntimeInstaller> => {
  await import("@/injection/main/index");
  if (!mocks.workersInstaller) {
    throw new Error("Main runtime did not register the workers installer.");
  }
  return mocks.workersInstaller;
};

const loadXrayBridgeInstaller = async (): Promise<RuntimeInstaller> => {
  await import("@/injection/main/index");
  if (!mocks.xrayBridgeInstaller) {
    throw new Error("Main runtime did not register the xray-bridge installer.");
  }
  return mocks.xrayBridgeInstaller;
};

const getSnapshot = (): RuntimeSnapshot => {
  if (!mocks.snapshot) {
    throw new Error("Missing Worker test snapshot.");
  }
  return mocks.snapshot;
};

const createInstallerState = () => ({
  integrity: createIntegrityRegistry(),
  snapshot: getSnapshot(),
});

describe("main runtime Dedicated Worker surface usage", () => {
  beforeEach(() => {
    mocks.snapshot = createSnapshot();
    mocks.workersInstaller = undefined;
    mocks.markSurfaceFailed.mockReset();
    mocks.markSurfaceUsed.mockReset();
    mocks.runtimeSymbolKey = null;
    let blobSequence = 0;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => `blob:https://example.test/bootstrap-${++blobSequence}`),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    restoreDescriptor(globalThis, "Blob", originalDescriptors.Blob);
    restoreDescriptor(globalThis, "Worker", originalDescriptors.Worker);
    restoreDescriptor(URL, "createObjectURL", originalDescriptors.createObjectURL);
    restoreDescriptor(URL, "revokeObjectURL", originalDescriptors.revokeObjectURL);
    Reflect.deleteProperty(
      globalThis as Record<string | symbol, unknown>,
      Symbol.for(WORKER_PATCH_GUARD_KEY),
    );
    document.documentElement.removeAttribute(`data-${RUNTIME_APPLIED_ATTR}`);
    vi.resetModules();
  });

  it("emits the worker category and constructor method when the patched constructor runs", async () => {
    const constructedUrls: string[] = [];
    class NativeWorker {
      addEventListener = vi.fn();
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor(url: string | URL) {
        constructedUrls.push(String(url));
      }
    }
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      writable: true,
      value: NativeWorker,
    });

    const installWorkers = await loadMainWorkerInstaller();
    installWorkers(createInstallerState());
    mocks.markSurfaceUsed.mockClear();

    const worker = new Worker("https://example.test/page-worker.js");
    worker.terminate();

    expect(constructedUrls).toEqual(["blob:https://example.test/bootstrap-1"]);
    expect(mocks.markSurfaceUsed).toHaveBeenCalledOnce();
    expect(mocks.markSurfaceUsed).toHaveBeenCalledWith("worker", "worker.constructor");
  });

  it("leaves Dedicated Worker and Blob native in Native worker mode", async () => {
    class NativeWorker {}
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      writable: true,
      value: NativeWorker,
    });
    const NativeBlob = globalThis.Blob;
    mocks.snapshot = {
      ...createSnapshot(),
      sharedWorkerHandlingMode: "native",
    };

    const installWorkers = await loadMainWorkerInstaller();
    installWorkers(createInstallerState());

    expect(globalThis.Worker).toBe(NativeWorker);
    expect(globalThis.Blob).toBe(NativeBlob);
    expect(mocks.markSurfaceUsed).not.toHaveBeenCalled();
  });

  it("marks the worker surface failed when a successfully constructed worker never acknowledges bootstrap", async () => {
    class NativeWorker {
      addEventListener = vi.fn();
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor(_url: string | URL) {}
    }
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      writable: true,
      value: NativeWorker,
    });

    const installWorkers = await loadMainWorkerInstaller();
    installWorkers(createInstallerState());
    mocks.markSurfaceFailed.mockClear();

    vi.useFakeTimers();
    try {
      const worker = new Worker("https://example.test/page-worker.js");
      // No ack message is ever posted back — the constructed worker never
      // confirms its own bootstrap, e.g. a crash right after installation.
      vi.runAllTimers();
      worker.terminate();

      expect(mocks.markSurfaceFailed).toHaveBeenCalledWith("worker");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps runtime state separate from the native-source registry", async () => {
    await loadMainWorkerInstaller();

    expect(mocks.runtimeSymbolKey).toBe(SHIM_GUARD_KEY);
  });

  it("preserves new-only and subclass semantics for Blob and Worker", async () => {
    class NativeWorker {
      addEventListener = vi.fn();
      terminate = vi.fn();
    }
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      writable: true,
      value: NativeWorker,
    });

    const installWorkers = await loadMainWorkerInstaller();
    installWorkers(createInstallerState());

    expect(() => Reflect.apply(Blob as unknown as Function, undefined, [])).toThrow(
      TypeError,
    );
    expect(() =>
      Reflect.apply(Worker as unknown as Function, undefined, ["worker.js"]),
    ).toThrow(TypeError);

    class DerivedBlob extends Blob {}
    class DerivedWorker extends Worker {}

    const blob = new DerivedBlob(["self.close()"], { type: "text/javascript" });
    const worker = new DerivedWorker("blob:https://example.test/page-worker");

    expect(blob).toBeInstanceOf(DerivedBlob);
    expect(worker).toBeInstanceOf(DerivedWorker);
    worker.terminate();
  });

  it("attributes a Worker patch installation failure to the worker category", async () => {
    const installWorkers = await loadMainWorkerInstaller();
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      get(): never {
        throw new Error("Worker descriptor unavailable");
      },
    });

    expect(() => installWorkers(createInstallerState())).toThrow(
      "Worker descriptor unavailable",
    );
    expect(mocks.markSurfaceFailed).toHaveBeenCalledOnce();
    expect(mocks.markSurfaceFailed).toHaveBeenCalledWith("worker");
  });

  // A blob: worker-src CSP block is simulated by a NativeWorker that throws a
  // SecurityError only when constructed with the (blob:) bootstrap URL — the
  // original https: page URL, used by the native fallback path, still
  // succeeds, matching real worker-src behavior (#110).
  class CspBlockingNativeWorker {
    addEventListener = vi.fn();
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor(public url: string | URL) {
      if (String(url).startsWith("blob:")) {
        // Plain Error with a DOMException-shaped `name`, not `new
        // DOMException(...)`: jsdom's DOMException does not extend Error, so
        // `isCspBlockedError`'s `error instanceof Error` check (matching real
        // browser SecurityError instances) would not see it as CSP-blocked.
        const error = new Error("blocked by worker-src");
        error.name = "SecurityError";
        throw error;
      }
    }
  }

  const readPostedAttemptSignals = (
    postMessageSpy: ReturnType<typeof vi.spyOn>,
  ): Array<{ method: string; result: Record<string, unknown> }> =>
    (postMessageSpy.mock.calls as Array<[{ detail: string }]>)
      .map(([message]: [{ detail: string }]) => message.detail)
      .map(
        (detail: string) =>
          JSON.parse(detail) as {
            method: string;
            result: Record<string, unknown>;
          },
      );

  it("reports native-fallback on every degraded attempt instead of silently falling back", async () => {
    mocks.snapshot = {
      ...createSnapshot(),
      logEventName: "gw:test-log",
    };
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      writable: true,
      value: CspBlockingNativeWorker,
    });
    const postMessageSpy = vi
      .spyOn(globalThis, "postMessage")
      .mockImplementation(() => undefined);

    const installWorkers = await loadMainWorkerInstaller();
    installWorkers(createInstallerState());
    mocks.markSurfaceFailed.mockClear();

    const first = new Worker("https://example.test/page-worker.js");
    const second = new Worker("https://example.test/page-worker.js");
    first.terminate();
    second.terminate();

    // Every native-fallback attempt also feeds the existing surface-failure
    // channel, so X-Ray/popup stop showing `Protected` for this page (#111).
    expect(mocks.markSurfaceFailed).toHaveBeenCalledTimes(2);
    expect(mocks.markSurfaceFailed).toHaveBeenCalledWith("worker");

    const attemptSignals = readPostedAttemptSignals(postMessageSpy).filter(
      (signal) => signal.method === "dedicated-worker-attempt",
    );
    expect(attemptSignals).toEqual([
      expect.objectContaining({
        result: expect.objectContaining({
          outcome: "native-fallback",
          reason: "csp-wrapper-blocked",
          phase: "constructor",
        }),
      }),
      expect.objectContaining({
        result: expect.objectContaining({
          outcome: "native-fallback",
          reason: "csp-wrapper-blocked",
          phase: "constructor-latch",
        }),
      }),
    ]);
    postMessageSpy.mockRestore();
  });

  it("fails closed in Strict mode instead of returning an unspoofed Worker", async () => {
    mocks.snapshot = {
      ...createSnapshot(),
      sharedWorkerHandlingMode: "strict",
      logEventName: "gw:test-log",
    };
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      writable: true,
      value: CspBlockingNativeWorker,
    });
    const postMessageSpy = vi
      .spyOn(globalThis, "postMessage")
      .mockImplementation(() => undefined);

    const installWorkers = await loadMainWorkerInstaller();
    installWorkers(createInstallerState());
    mocks.markSurfaceFailed.mockClear();

    expect(() => new Worker("https://example.test/page-worker.js")).toThrow(
      /strict mode/i,
    );
    // The latch is already set from the first attempt; a second attempt must
    // also fail closed without re-probing CSP.
    expect(() => new Worker("https://example.test/page-worker.js")).toThrow(
      /strict mode/i,
    );

    // Strict fail-closed is the extension working as designed, not a
    // degradation — it must not mark the surface as failed.
    expect(mocks.markSurfaceFailed).not.toHaveBeenCalled();

    const strictBlockedSignals = readPostedAttemptSignals(postMessageSpy).filter(
      (signal) => signal.method === "dedicated-worker-strict-blocked",
    );
    expect(strictBlockedSignals).toEqual([
      expect.objectContaining({
        result: expect.objectContaining({
          reason: "csp-wrapper-blocked",
          phase: "constructor",
        }),
      }),
      expect.objectContaining({
        result: expect.objectContaining({
          reason: "csp-wrapper-blocked",
          phase: "constructor-latch",
        }),
      }),
    ]);
    postMessageSpy.mockRestore();
  });

  it("treats data: worker URLs as native-by-policy, even in Strict mode", async () => {
    mocks.snapshot = {
      ...createSnapshot(),
      sharedWorkerHandlingMode: "strict",
      logEventName: "gw:test-log",
    };
    class NativeWorker {
      addEventListener = vi.fn();
      terminate = vi.fn();
      constructor(public url: string | URL) {}
    }
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      writable: true,
      value: NativeWorker,
    });
    const postMessageSpy = vi
      .spyOn(globalThis, "postMessage")
      .mockImplementation(() => undefined);

    const installWorkers = await loadMainWorkerInstaller();
    installWorkers(createInstallerState());

    const worker = new Worker("data:text/javascript,self.close()");
    worker.terminate();

    const attemptSignals = readPostedAttemptSignals(postMessageSpy).filter(
      (signal) => signal.method === "dedicated-worker-attempt",
    );
    expect(attemptSignals).toEqual([
      expect.objectContaining({
        result: expect.objectContaining({
          outcome: "native-by-policy",
          reason: "data-url",
        }),
      }),
    ]);
    postMessageSpy.mockRestore();
  });
});

describe("main runtime integrity evidence bridge", () => {
  beforeEach(() => {
    mocks.snapshot = createSnapshot();
    mocks.xrayBridgeInstaller = undefined;
    mocks.markSurfaceFailed.mockReset();
    mocks.markSurfaceEvidence.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("forwards the full per-realm integrity status (unrecoverable and repaired), never the coarse boolean", async () => {
    const installXrayBridge = await loadXrayBridgeInstaller();
    const state = createInstallerState();
    installXrayBridge(state);
    mocks.markSurfaceEvidence.mockClear();

    // Hostile non-configurable replacement -> unrecoverable, no safe repair.
    const hostileTarget: Record<string, unknown> = {};
    Object.defineProperty(hostileTarget, "value", {
      configurable: false,
      value: "attacker",
    });
    const hostileRegistered = state.integrity.register({
      surfaceId: "canvas",
      realmId: "document",
      resolveTarget: () => hostileTarget,
      key: "value",
      createExpectedDescriptor: () => ({ configurable: true, value: "expected" }),
      repairPolicy: "repair",
      criticality: "preview-critical",
    });
    state.integrity.ensure(hostileRegistered);

    expect(mocks.markSurfaceEvidence).toHaveBeenCalledExactlyOnceWith("canvas", {
      realmId: "document",
      integrity: "unrecoverable",
      reasonCode: "hostile-non-configurable",
    });
    mocks.markSurfaceEvidence.mockClear();

    // Configurable drift -> repaired. A successfully self-healed descriptor is
    // now surfaced as its own `repaired` state (not discarded, not a failure).
    const repairableTarget: Record<string, unknown> = {};
    Object.defineProperty(repairableTarget, "value", {
      configurable: true,
      value: "expected",
    });
    const repairableRegistered = state.integrity.register({
      surfaceId: "webGL",
      realmId: "document",
      resolveTarget: () => repairableTarget,
      key: "value",
      createExpectedDescriptor: () => ({ configurable: true, value: "expected" }),
      repairPolicy: "repair",
      criticality: "preview-critical",
    });
    state.integrity.ensure(repairableRegistered);
    Object.defineProperty(repairableTarget, "value", {
      configurable: true,
      value: "attacker-replacement",
    });
    state.integrity.ensure(repairableRegistered);

    expect(mocks.markSurfaceEvidence).toHaveBeenCalledWith(
      "webGL",
      expect.objectContaining({ realmId: "document", integrity: "repaired" }),
    );
    // The coarse boolean channel is never used by the integrity bridge.
    expect(mocks.markSurfaceFailed).not.toHaveBeenCalled();
  });
});
