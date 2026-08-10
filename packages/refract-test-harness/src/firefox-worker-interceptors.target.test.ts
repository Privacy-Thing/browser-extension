import { installFxWorkers } from "@privacy-brand/refract-core";
import type { RuntimeSnapshot } from "@privacy-brand/refract-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIM_GUARD_KEY, WORKER_ACK_TYPE } from "@/shared/build-id-test-values";

const buildRuntimeSnapshot = (): RuntimeSnapshot => ({
  geo: { latitude: 52.2297, longitude: 21.0122, accuracy: 25, noiseRadius: 50 },
  locale: {
    language: "pl",
    languages: ["pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500],
});

describe("installFxWorkers", () => {
  it("patches dedicated Worker and serviceWorker while leaving SharedWorker native", async () => {
    const nativeNavigatorDesc = Object.getOwnPropertyDescriptor(
      globalThis,
      "navigator",
    );
    const originalNavigator = globalThis.Navigator;
    const nativeServiceWorker = globalThis.ServiceWorkerContainer;
    const originalWorker = globalThis.Worker;
    const originalSharedWorker = globalThis.SharedWorker;

    const syncBootstrapState = vi.fn();
    const cachedNativeRegister = vi.fn(async () => ({ scope: "/cached/" }));
    const freshNativeRegister = vi.fn(async () => ({ scope: "/fresh/" }));
    const cachedPrototype = {
      register: cachedNativeRegister,
    };
    const freshPrototype = {
      register: freshNativeRegister,
    };
    const cachedContainer = Object.create(
      cachedPrototype,
    ) as Navigator["serviceWorker"];
    const freshContainer = Object.create(freshPrototype) as Navigator["serviceWorker"];
    let currentContainer = cachedContainer;

    class MockNavigator {}
    Object.defineProperty(MockNavigator.prototype, "serviceWorker", {
      configurable: true,
      get() {
        return currentContainer;
      },
    });

    class MockServiceWorker {}
    class NativeWorker {}
    class NativeSharedWorker {}

    try {
      vi.stubGlobal("Worker", NativeWorker);
      vi.stubGlobal("SharedWorker", NativeSharedWorker);
      vi.stubGlobal("Navigator", MockNavigator);
      vi.stubGlobal("ServiceWorkerContainer", MockServiceWorker);
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: Object.create(MockNavigator.prototype) as Navigator,
      });

      const cachedReference = navigator.serviceWorker;

      installFxWorkers({
        buildRuntimeSnapshot: () => null,
        syncBootstrapState,
        shouldBlockServiceWorker: () => true,
        emitWorkerCompatSignal: () => {},
        resolveWorkerMode: () => "native",
        markWorkerSurfaceFailed: () => {},
      });

      expect(globalThis.Worker).not.toBe(NativeWorker);
      expect(globalThis.SharedWorker).toBe(NativeSharedWorker);

      await expect(cachedReference?.register("/cached-sw.js")).rejects.toMatchObject({
        name: "SecurityError",
      });
      expect(syncBootstrapState).toHaveBeenCalledTimes(1);
      expect(cachedNativeRegister).not.toHaveBeenCalled();

      currentContainer = freshContainer;

      await expect(
        navigator.serviceWorker?.register("/fresh-sw.js"),
      ).rejects.toMatchObject({
        name: "SecurityError",
      });
      expect(syncBootstrapState).toHaveBeenCalledTimes(2);
      expect(freshNativeRegister).not.toHaveBeenCalled();
    } finally {
      if (nativeNavigatorDesc) {
        Object.defineProperty(globalThis, "navigator", nativeNavigatorDesc);
      } else {
        delete (globalThis as { navigator?: Navigator }).navigator;
      }
      vi.stubGlobal("Navigator", originalNavigator);
      vi.stubGlobal("ServiceWorkerContainer", nativeServiceWorker);
      vi.stubGlobal("Worker", originalWorker);
      vi.stubGlobal("SharedWorker", originalSharedWorker);
    }
  });

  // A blob: worker-src CSP block is simulated by a NativeWorker that throws a
  // plain Error with a SecurityError-shaped `name` (not `new DOMException`,
  // which does not extend Error in jsdom, unlike real browsers) only when
  // constructed with the (blob:) bootstrap URL — the original https: page URL,
  // used by the native fallback path, still succeeds.
  class CspBlockingNativeWorker {
    constructor(public url: string | URL) {
      if (String(url).startsWith("blob:")) {
        const error = new Error("blocked by worker-src");
        error.name = "SecurityError";
        throw error;
      }
    }
    addEventListener(): void {}
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the native Worker directly in Native mode", () => {
    vi.stubGlobal("Worker", CspBlockingNativeWorker);
    vi.stubGlobal("Blob", class MockBlob {});
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("location", { href: "https://example.test/page" });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:mock"),
    });
    const markWorkerSurfaceFailed = vi.fn();
    const emitWorkerCompatSignal = vi.fn();

    installFxWorkers({
      buildRuntimeSnapshot: () => buildRuntimeSnapshot(),
      syncBootstrapState: () => {},
      shouldBlockServiceWorker: () => false,
      emitWorkerCompatSignal,
      patchServiceWorker: false,
      resolveWorkerMode: () => "native",
      markWorkerSurfaceFailed,
    });

    const worker = new Worker("https://example.test/page-worker.js");
    expect(worker).toBeInstanceOf(CspBlockingNativeWorker);
    expect((worker as unknown as CspBlockingNativeWorker).url).toBe(
      "https://example.test/page-worker.js",
    );
    expect(markWorkerSurfaceFailed).not.toHaveBeenCalled();
    expect(emitWorkerCompatSignal).not.toHaveBeenCalled();
  });

  it("fails closed in Strict mode instead of returning an unspoofed Worker", () => {
    vi.stubGlobal("Worker", CspBlockingNativeWorker);
    vi.stubGlobal("Blob", class MockBlob {});
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("location", { href: "https://example.test/page" });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:mock"),
    });
    const markWorkerSurfaceFailed = vi.fn();

    installFxWorkers({
      buildRuntimeSnapshot: () => buildRuntimeSnapshot(),
      syncBootstrapState: () => {},
      shouldBlockServiceWorker: () => false,
      emitWorkerCompatSignal: () => {},
      patchServiceWorker: false,
      resolveWorkerMode: () => "strict",
      markWorkerSurfaceFailed,
    });

    expect(() => new Worker("https://example.test/page-worker.js")).toThrow(
      /strict mode/i,
    );
    // Strict fail-closed is the extension working as designed, not a
    // degradation — it must not mark the surface as failed.
    expect(markWorkerSurfaceFailed).not.toHaveBeenCalled();
  });

  it("forwards a worker-thread integrity-evidence message to markIntegrityEvidence", () => {
    let messageHandler: ((event: Event) => void) | undefined;
    class SpoofedNativeWorker {
      constructor(public url: string | URL) {}
      addEventListener(type: string, handler: (event: Event) => void): void {
        if (type === "message") {
          messageHandler = handler;
        }
      }
      terminate(): void {}
    }
    vi.stubGlobal("Worker", SpoofedNativeWorker);
    vi.stubGlobal("Blob", class MockBlob {});
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("location", { href: "https://example.test/page" });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:mock"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const markIntegrityEvidence = vi.fn();

    installFxWorkers({
      buildRuntimeSnapshot: () => buildRuntimeSnapshot(),
      syncBootstrapState: () => {},
      shouldBlockServiceWorker: () => false,
      emitWorkerCompatSignal: () => {},
      patchServiceWorker: false,
      resolveWorkerMode: () => "spoof",
      markWorkerSurfaceFailed: () => {},
      markIntegrityEvidence,
    });

    new Worker("https://example.test/page-worker.js");
    expect(messageHandler).toBeTypeOf("function");

    const stopImmediatePropagation = vi.fn();
    messageHandler?.({
      data: {
        type: WORKER_ACK_TYPE,
        guard: SHIM_GUARD_KEY,
        kind: "integrity-evidence",
        surfaceId: "webGL",
        status: "unrecoverable",
        realmId: "worker",
      },
      stopImmediatePropagation,
    } as unknown as Event);

    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
    // The interceptor tags each construction with a per-Worker attempt id (#111).
    expect(markIntegrityEvidence).toHaveBeenCalledExactlyOnceWith({
      surfaceId: "webGL",
      status: "unrecoverable",
      realmId: "worker",
      attemptId: "worker-1",
    });
  });

  it("treats a null snapshot (no data yet) as native-by-policy, not a failure", () => {
    class NativeWorker {
      constructor(public url: string | URL) {}
      addEventListener(): void {}
    }
    vi.stubGlobal("Worker", NativeWorker);
    const markWorkerSurfaceFailed = vi.fn();

    installFxWorkers({
      buildRuntimeSnapshot: () => null,
      syncBootstrapState: () => {},
      shouldBlockServiceWorker: () => false,
      emitWorkerCompatSignal: () => {},
      patchServiceWorker: false,
      resolveWorkerMode: () => "strict",
      markWorkerSurfaceFailed,
    });

    const worker = new Worker("https://example.test/page-worker.js");
    expect(worker).toBeInstanceOf(NativeWorker);
    expect(markWorkerSurfaceFailed).not.toHaveBeenCalled();
  });
});
