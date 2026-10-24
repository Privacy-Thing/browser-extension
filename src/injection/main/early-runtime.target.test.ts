// @vitest-environment jsdom

import {
  getWindowSeedPrefix,
  readWindowSeedSnapshot,
} from "@privacy-brand/refract-browser/common/runtime-config";
import { createWorkerSource } from "@privacy-brand/refract-browser/common/worker-bootstrap";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installAudioPatch } from "@/injection/main/audio-patch";
import {
  RUNTIME_APPLIED_ATTR,
  RUNTIME_DISABLED_ATTR,
  SW_PATCH_GUARD_KEY,
  SURFACE_USAGE_TYPE,
  WORKER_PATCH_GUARD_KEY,
} from "@/shared/build-id-test-values";
import type { RuntimeSnapshot } from "@/shared/types";

const surfaceErrorMocks = vi.hoisted(() => ({
  markSurfaceFailed: vi.fn(),
}));
vi.mock("@privacy-brand/refract-browser/common/surface-error-emitter", () => ({
  markSurfaceFailed: surfaceErrorMocks.markSurfaceFailed,
}));

vi.mock("@/injection/main/audio-patch", () => ({
  installAudioPatch: vi.fn(() => ({ analyserNode: false, audioBuffer: false })),
}));
vi.mock("@/injection/main/canvas-patch", () => ({
  installCanvasPatch: vi.fn(() => ({
    htmlCanvas: false,
    context2D: false,
    offscreenCanvas: false,
    offscreenContext2D: false,
  })),
}));
vi.mock("@/injection/main/client-hints-patch", () => ({
  installClientHintsPatch: vi.fn(),
}));
vi.mock("@/injection/main/date-intl-patch", () => ({
  installDatePatch: vi.fn(),
  installIntlPatch: vi.fn(),
}));
vi.mock("@/injection/main/locale-patch", () => ({
  installNavigatorPatch: vi.fn(),
}));
vi.mock("@/injection/main/screen-patch", () => ({
  installScreenPatch: vi.fn(),
}));
vi.mock("@/injection/main/webgl-patch", () => ({
  installWebGLPatch: vi.fn(() => ({
    webGL1Common: false,
    webGL1ReadPixels: false,
    webGL2Common: false,
    webGL2ReadPixels: false,
  })),
}));
vi.mock("@/injection/main/webrtc-patch", () => ({
  installWebRTCPatch: vi.fn(() => ({
    standardConstructor: false,
    webkitConstructor: false,
    createOffer: false,
    createAnswer: false,
    setConfiguration: false,
  })),
}));
vi.mock("@privacy-brand/refract-core", () => ({
  installGeolocationPatch: vi.fn(() => true),
  installGeoPermPatch: vi.fn(),
  installLocaleGetters: vi.fn(),
  getNativeDate: () => Date,
  createNativeSource: vi.fn(() => ""),
  maskAsNative: vi.fn((value) => value),
}));
vi.mock("@privacy-brand/refract-browser/common/worker-bootstrap", () => ({
  createWorkerSource: vi.fn(() => ""),
}));
vi.mock("@privacy-brand/refract-browser/common/worker-runtime-log-relay", () => ({
  attachWorkerLogRelay: vi.fn(),
}));

const createSnapshot = (
  language = "pl-PL",
  languages: string[] = [language],
  timeZone = "Europe/Warsaw",
): RuntimeSnapshot => ({
  geo: { latitude: 52.23, longitude: 21.01, accuracy: 25, noiseRadius: 100 },
  locale: {
    language,
    languages,
    timeZone,
    acceptLanguage: `${language},${language.split("-")[0]};q=0.9`,
  },
  date: {
    baseEpochMs: 0,
    offsetMs: 0,
    timeZone,
  },
  debugMode: false,
  watchPositionDelay: [60, 500],
  authKey: "auth-test",
  sharedWorkerHandlingMode: "spoof",
});

const encodeWindowSeed = (snapshot: RuntimeSnapshot, previousName = ""): string => {
  const json = JSON.stringify({ kind: "snapshot", previousName, snapshot });
  const encoded = btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${getWindowSeedPrefix()}${encoded}`;
};

const encodeDisabledWindowSeed = (previousName = ""): string => {
  const json = JSON.stringify({ kind: "disabled", previousName });
  const encoded = btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${getWindowSeedPrefix()}${encoded}`;
};

describe("installEarlyRuntime", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    document.documentElement?.removeAttribute(`data-${RUNTIME_APPLIED_ATTR}`);
    document.documentElement?.removeAttribute(RUNTIME_DISABLED_ATTR);
    delete (globalThis as Record<string | symbol, unknown>)[
      Symbol.for(WORKER_PATCH_GUARD_KEY)
    ];
    delete (globalThis as Record<string | symbol, unknown>)[
      Symbol.for(SW_PATCH_GUARD_KEY)
    ];
    (globalThis as typeof globalThis & { name?: string }).name = "";
    surfaceErrorMocks.markSurfaceFailed.mockReset();
  });

  it("does not install patches when a disabled window seed is present", async () => {
    class NativeWorker {}
    class NativeSharedWorker {}
    class NativeServiceWorkerBox {
      register = vi.fn();
    }
    const nativeRegister = vi.fn();
    NativeServiceWorkerBox.prototype.register = nativeRegister;
    vi.stubGlobal("Worker", NativeWorker);
    vi.stubGlobal("SharedWorker", NativeSharedWorker);
    vi.stubGlobal("ServiceWorkerContainer", NativeServiceWorkerBox);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: new NativeServiceWorkerBox(),
    });
    (globalThis as typeof globalThis & { name?: string }).name =
      encodeDisabledWindowSeed("trusted-name");

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();

    expect(globalThis.Worker).toBe(NativeWorker);
    expect(
      (globalThis as typeof globalThis & { SharedWorker?: unknown }).SharedWorker,
    ).toBe(NativeSharedWorker);
    expect(ServiceWorkerContainer.prototype.register).toBe(nativeRegister);
    expect(installAudioPatch).not.toHaveBeenCalled();
    expect(createWorkerSource).not.toHaveBeenCalled();
    expect((globalThis as typeof globalThis & { name?: string }).name).toBe(
      "trusted-name",
    );
  });

  it("does not install patches when the disabled DOM marker is present", async () => {
    class NativeWorker {}
    vi.stubGlobal("Worker", NativeWorker);
    document.documentElement.setAttribute(RUNTIME_DISABLED_ATTR, "");

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();

    expect(globalThis.Worker).toBe(NativeWorker);
    expect(installAudioPatch).not.toHaveBeenCalled();
  });

  it("leaves Service Worker registration native when no snapshot exists", async () => {
    class NativeServiceWorkerBox {
      register = vi.fn();
    }
    const nativeRegister = vi.fn();
    NativeServiceWorkerBox.prototype.register = nativeRegister;
    vi.stubGlobal("ServiceWorkerContainer", NativeServiceWorkerBox);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: new NativeServiceWorkerBox(),
    });

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();

    expect(ServiceWorkerContainer.prototype.register).toBe(nativeRegister);
  });

  it("attributes a Worker patch installation failure to the worker category", async () => {
    const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
    (globalThis as typeof globalThis & { name?: string }).name =
      encodeWindowSeed(createSnapshot());
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      get(): never {
        throw new Error("Worker descriptor unavailable");
      },
    });

    try {
      const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
      installEarlyRuntime();

      expect(surfaceErrorMocks.markSurfaceFailed).toHaveBeenCalledWith("worker");
    } finally {
      if (workerDescriptor) {
        Object.defineProperty(globalThis, "Worker", workerDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "Worker");
      }
    }
  });

  it("installs worker patches when Spoof mode is active", async () => {
    class NativeWorker {}
    class NativeSharedWorker {}
    vi.stubGlobal("Worker", NativeWorker);
    vi.stubGlobal("SharedWorker", NativeSharedWorker);
    (globalThis as typeof globalThis & { name?: string }).name =
      encodeWindowSeed(createSnapshot());

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();

    expect(globalThis.Worker).not.toBe(NativeWorker);
    expect(
      (globalThis as typeof globalThis & { SharedWorker?: unknown }).SharedWorker,
    ).not.toBe(NativeSharedWorker);
  });

  it("wraps SharedWorker only when compatibility mode is disabled", async () => {
    class NativeWorker {}
    class NativeSharedWorker {}
    vi.stubGlobal("Worker", NativeWorker);
    vi.stubGlobal("SharedWorker", NativeSharedWorker);
    (globalThis as typeof globalThis & { name?: string }).name = encodeWindowSeed({
      ...createSnapshot(),
      sharedWorkerCompatibilityMode: false,
    });

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();

    expect(globalThis.Worker).not.toBe(NativeWorker);
    expect(
      (globalThis as typeof globalThis & { SharedWorker?: unknown }).SharedWorker,
    ).not.toBe(NativeSharedWorker);
  });

  it("preserves constructor-only calls and subclasses in the early worker runtime", async () => {
    class NativeWorker {
      addEventListener = vi.fn();
      terminate = vi.fn();
    }
    class NativeSharedWorker {
      readonly port = new EventTarget() as MessagePort;
      addEventListener = vi.fn();
    }
    vi.stubGlobal("Worker", NativeWorker);
    vi.stubGlobal("SharedWorker", NativeSharedWorker);
    (globalThis as typeof globalThis & { name?: string }).name = encodeWindowSeed({
      ...createSnapshot(),
      sharedWorkerCompatibilityMode: false,
    });

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();

    expect(() => Reflect.apply(Blob as unknown as Function, undefined, [])).toThrow(
      TypeError,
    );
    expect(() =>
      Reflect.apply(Worker as unknown as Function, undefined, ["worker.js"]),
    ).toThrow(TypeError);
    expect(() =>
      Reflect.apply(SharedWorker as unknown as Function, undefined, ["worker.js"]),
    ).toThrow(TypeError);

    class DerivedBlob extends Blob {}
    class DerivedWorker extends Worker {}
    class DerivedSharedWorker extends SharedWorker {}

    expect(new DerivedBlob(["self.close()"])).toBeInstanceOf(DerivedBlob);
    expect(new DerivedWorker("blob:test/worker")).toBeInstanceOf(DerivedWorker);
    expect(new DerivedSharedWorker("blob:test/shared-worker")).toBeInstanceOf(
      DerivedSharedWorker,
    );
  });

  it("blocks SharedWorker strict fallback in cross-origin frames while preserving native Worker", async () => {
    const sharedWorkerUrls: string[] = [];
    const postMessageSpy = vi
      .spyOn(globalThis, "postMessage")
      .mockImplementation(() => undefined);
    class NativeWorker {}
    class NativeSharedWorker {
      constructor(
        public readonly url: string | URL,
        _opts?: string | WorkerOptions,
      ) {
        sharedWorkerUrls.push(String(url));
      }
    }
    vi.stubGlobal("Worker", NativeWorker);
    vi.stubGlobal("SharedWorker", NativeSharedWorker);
    vi.stubGlobal("parent", {
      location: {
        get origin(): string {
          throw new DOMException("Cross-origin frame", "SecurityError");
        },
      },
    });
    (globalThis as typeof globalThis & { name?: string }).name = encodeWindowSeed({
      ...createSnapshot(),
      sharedWorkerHandlingMode: "strict",
      sharedWorkerCompatibilityMode: false,
      logEventName: "log-test",
    });

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();

    expect(globalThis.Worker).toBe(NativeWorker);
    expect(
      (globalThis as typeof globalThis & { SharedWorker?: unknown }).SharedWorker,
    ).not.toBe(NativeSharedWorker);
    expect(() => new SharedWorker("https://third-party.example/worker.js")).toThrow(
      /strict mode/,
    );
    expect(sharedWorkerUrls).toEqual([]);
    const strictSignal = postMessageSpy.mock.calls
      .map(([payload]) => payload)
      .find((payload) => {
        if (
          typeof payload !== "object" ||
          payload === null ||
          (payload as { eventName?: unknown }).eventName !== "log-test"
        ) {
          return false;
        }

        return (
          JSON.parse((payload as { detail: string }).detail).method ===
          "shared-worker-strict-blocked"
        );
      });
    expect(strictSignal).toBeDefined();
    expect(JSON.parse((strictSignal as { detail: string }).detail)).toMatchObject({
      result: {
        reason: "strict-blocked",
        phase: "cross-origin-frame",
        workerKind: "SharedWorker",
      },
    });
  });

  it("keeps Worker and SharedWorker native in cross-origin frames outside strict mode", async () => {
    const sharedWorkerUrls: string[] = [];
    class NativeWorker {}
    class NativeSharedWorker {
      constructor(
        public readonly url: string | URL,
        _opts?: string | WorkerOptions,
      ) {
        sharedWorkerUrls.push(String(url));
      }
    }
    vi.stubGlobal("Worker", NativeWorker);
    vi.stubGlobal("SharedWorker", NativeSharedWorker);
    vi.stubGlobal("parent", {
      location: {
        get origin(): string {
          throw new DOMException("Cross-origin frame", "SecurityError");
        },
      },
    });
    (globalThis as typeof globalThis & { name?: string }).name = encodeWindowSeed({
      ...createSnapshot(),
      sharedWorkerHandlingMode: "spoof",
      sharedWorkerCompatibilityMode: false,
    });

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();

    expect(globalThis.Worker).toBe(NativeWorker);
    expect(
      (globalThis as typeof globalThis & { SharedWorker?: unknown }).SharedWorker,
    ).toBe(NativeSharedWorker);
    new SharedWorker("https://third-party.example/worker.js");
    expect(sharedWorkerUrls).toEqual(["https://third-party.example/worker.js"]);
  });

  it("blocks native SharedWorker fallback in strict mode", async () => {
    const sharedWorkerUrls: string[] = [];
    class NativeWorker {}
    class NativeSharedWorker {
      constructor(
        public readonly url: string | URL,
        _opts?: string | WorkerOptions,
      ) {
        sharedWorkerUrls.push(String(url));
      }
    }
    vi.stubGlobal("Worker", NativeWorker);
    vi.stubGlobal("SharedWorker", NativeSharedWorker);
    (globalThis as typeof globalThis & { name?: string }).name = encodeWindowSeed({
      ...createSnapshot(),
      sharedWorkerHandlingMode: "strict",
      sharedWorkerCompatibilityMode: false,
    });

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();

    expect(() => new SharedWorker("data:text/javascript,postMessage(1)")).toThrow(
      /strict mode/,
    );
    expect(sharedWorkerUrls).toEqual([]);
  });

  it("constructs a SharedWorker wrapper without executing the original URL as a CSP probe", async () => {
    const workerUrls: string[] = [];
    const sharedWorkerUrls: string[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:test/bootstrap"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    try {
      class NativeWorker {
        terminate = vi.fn();
        constructor(
          public readonly url: string | URL,
          _opts?: WorkerOptions,
        ) {
          workerUrls.push(String(url));
        }
      }
      class NativeSharedWorker {
        port = { close: vi.fn() };
        addEventListener = vi.fn();
        constructor(
          public readonly url: string | URL,
          _opts?: string | WorkerOptions,
        ) {
          sharedWorkerUrls.push(String(url));
        }
      }
      vi.stubGlobal("Worker", NativeWorker);
      vi.stubGlobal("SharedWorker", NativeSharedWorker);
      (globalThis as typeof globalThis & { name?: string }).name = encodeWindowSeed({
        ...createSnapshot(),
        sharedWorkerCompatibilityMode: false,
      });

      const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
      installEarlyRuntime();

      new SharedWorker("https://example.test/worker.js", "shared-name");

      expect(workerUrls).toEqual([]);
      expect(sharedWorkerUrls).toEqual(["blob:test/bootstrap"]);
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: origCreate,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: origRevoke,
      });
    }
  });

  it("constructs one dedicated Worker wrapper without first executing its HTTP URL", async () => {
    const workerUrls: string[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:test/bootstrap"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    class NativeWorker {
      addEventListener = vi.fn();
      terminate = vi.fn();
      constructor(
        public readonly url: string | URL,
        _opts?: WorkerOptions,
      ) {
        workerUrls.push(String(url));
      }
    }
    vi.stubGlobal("Worker", NativeWorker);
    (globalThis as typeof globalThis & { name?: string }).name = encodeWindowSeed({
      ...createSnapshot(),
      sharedWorkerCompatibilityMode: false,
    });

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();

    try {
      new Worker("https://example.test/worker.js");
      expect(workerUrls).toEqual(["blob:test/bootstrap"]);
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: origCreate,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: origRevoke,
      });
    }
  });

  it("inlines the captured worker source so a revoked blob URL never needs re-importing", async () => {
    // Simulate the createObjectURL + new Worker + revokeObjectURL pattern used by
    // CodeMirror, bundlers, and other libraries that create inline blob workers.
    let urlIdx = 0;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: (_obj: Blob | MediaSource) => `blob:test/${urlIdx++}`,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    try {
      (globalThis as typeof globalThis & { name?: string }).name =
        encodeWindowSeed(createSnapshot());

      class MockWorker {
        addEventListener = vi.fn();
        terminate = vi.fn();
        constructor(
          public readonly url: string,
          _opts?: WorkerOptions,
        ) {}
      }
      vi.stubGlobal("Worker", MockWorker);

      const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
      // Import the fresh mock instance created for this module reload cycle.
      const workerBootstrap =
        (await import("@privacy-brand/refract-browser/common/worker-bootstrap")) as {
          createWorkerSource: ReturnType<typeof vi.fn>;
        };
      installEarlyRuntime();
      // The mock persists across tests; count only this test's invocation.
      workerBootstrap.createWorkerSource.mockClear();

      const usageEvents: Array<Record<string, unknown>> = [];
      const usageListener = new AbortController();
      document.addEventListener(
        SURFACE_USAGE_TYPE,
        (event) => {
          usageEvents.push(JSON.parse((event as CustomEvent).detail as string));
        },
        { signal: usageListener.signal },
      );

      // Page: create blob URL, create Worker (Privacy Thing intercepts), then revoke.
      const workerSource = "self.onmessage = () => {}";
      const workerBlob = new Blob([workerSource], { type: "text/javascript" });
      const originalUrl = URL.createObjectURL(workerBlob);
      new Worker(originalUrl);
      URL.revokeObjectURL(originalUrl);
      await Promise.resolve();
      usageListener.abort();

      // The captured source is inlined with its original URL for relative-URL
      // repair, so no importScripts() depends on the revoked URL.
      const bootstrapCalls = workerBootstrap.createWorkerSource.mock.calls;
      expect(bootstrapCalls).toHaveLength(1);
      expect(bootstrapCalls[0]?.[0]).toMatchObject({
        workerUrl: originalUrl,
        inlineSource: workerSource,
      });
      expect(usageEvents.at(-1)).toMatchObject({
        categories: ["worker"],
        counts: { worker: 1 },
        methodCounts: { "worker.constructor": 1 },
      });
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: origCreate,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: origRevoke,
      });
    }
  });

  it("bounds retained blob worker URLs while preserving recent inline sources", async () => {
    let urlIdx = 0;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: () => `blob:test/${urlIdx++}`,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    try {
      (globalThis as typeof globalThis & { name?: string }).name =
        encodeWindowSeed(createSnapshot());

      class MockWorker {
        addEventListener = vi.fn();
        terminate = vi.fn();
        constructor(
          public readonly url: string,
          _opts?: WorkerOptions,
        ) {}
      }
      vi.stubGlobal("Worker", MockWorker);

      const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
      const workerBootstrap =
        (await import("@privacy-brand/refract-browser/common/worker-bootstrap")) as {
          createWorkerSource: ReturnType<typeof vi.fn>;
        };
      installEarlyRuntime();
      workerBootstrap.createWorkerSource.mockClear();

      const urls: string[] = [];
      for (let index = 0; index < 129; index += 1) {
        const url = URL.createObjectURL(
          new Blob([`self.id = ${index}`], { type: "text/javascript" }),
        );
        urls.push(url);
        new Worker(url);
      }

      workerBootstrap.createWorkerSource.mockClear();
      new Worker(urls[0]!);
      new Worker(urls.at(-1)!);

      const [evictedCall, recentCall] = workerBootstrap.createWorkerSource.mock.calls;
      expect(evictedCall?.[0]).toMatchObject({ workerUrl: urls[0] });
      expect(evictedCall?.[0]?.inlineSource).toBeUndefined();
      expect(recentCall?.[0]).toMatchObject({
        workerUrl: urls.at(-1),
        inlineSource: "self.id = 128",
      });
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: origCreate,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: origRevoke,
      });
    }
  });

  it("uses a protected blob URL for non-capturable blob workers", async () => {
    // A blob built from a non-string part cannot be inlined, so the bootstrap
    // falls back to the import path and must protect the URL against revocation.
    let urlIdx = 0;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: (_obj: Blob | MediaSource) => `blob:test/${urlIdx++}`,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    try {
      (globalThis as typeof globalThis & { name?: string }).name =
        encodeWindowSeed(createSnapshot());

      class MockWorker {
        addEventListener = vi.fn();
        terminate = vi.fn();
        constructor(
          public readonly url: string,
          _opts?: WorkerOptions,
        ) {}
      }
      vi.stubGlobal("Worker", MockWorker);

      const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
      const workerBootstrap =
        (await import("@privacy-brand/refract-browser/common/worker-bootstrap")) as {
          createWorkerSource: ReturnType<typeof vi.fn>;
        };
      installEarlyRuntime();
      // The mock persists across tests; count only this test's invocation.
      workerBootstrap.createWorkerSource.mockClear();

      // Non-capturable: parts include a Blob, not just strings.
      const workerBlob = new Blob([new Blob(["self.onmessage = () => {}"])], {
        type: "text/javascript",
      });
      const originalUrl = URL.createObjectURL(workerBlob);
      new Worker(originalUrl);
      URL.revokeObjectURL(originalUrl);

      const bootstrapCalls = workerBootstrap.createWorkerSource.mock.calls;
      expect(bootstrapCalls).toHaveLength(1);
      const calledWorkerUrl = bootstrapCalls[0]?.[0]?.workerUrl as string;
      expect(calledWorkerUrl).toMatch(/^blob:/);
      expect(calledWorkerUrl).not.toBe(originalUrl);
      expect(bootstrapCalls[0]?.[0]?.inlineSource).toBeUndefined();
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: origCreate,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: origRevoke,
      });
    }
  });

  it("revokes Privacy Thing-owned bootstrap blob URLs after worker construction", async () => {
    let urlIdx = 0;
    const nativeRevoke = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn((_obj: Blob | MediaSource) => `blob:test/${urlIdx++}`),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: nativeRevoke,
    });

    try {
      (globalThis as typeof globalThis & { name?: string }).name =
        encodeWindowSeed(createSnapshot());

      class MockWorker {
        addEventListener = vi.fn();
        terminate = vi.fn();
        constructor(
          public readonly url: string,
          _opts?: WorkerOptions,
        ) {}
      }
      vi.stubGlobal("Worker", MockWorker);

      const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
      installEarlyRuntime();

      const workerBlob = new Blob(["self.onmessage = () => {}"], {
        type: "text/javascript",
      });
      const originalUrl = URL.createObjectURL(workerBlob);
      new Worker(originalUrl);

      expect(originalUrl).toBe("blob:test/0");
      expect(nativeRevoke).toHaveBeenCalledWith("blob:test/1");
      expect(nativeRevoke).not.toHaveBeenCalledWith(originalUrl);
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: origCreate,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: origRevoke,
      });
    }
  });

  it("does not overwrite an authoritative next-navigation window seed during unload", async () => {
    const runtimeWindow = globalThis as typeof globalThis & { name?: string };
    const currentSnapshot = createSnapshot();
    const nextSnapshot = createSnapshot("en-US", ["en-US", "en"], "America/New_York");
    runtimeWindow.name = encodeWindowSeed(currentSnapshot);

    const nativeAddEventListener = window.addEventListener.bind(window);
    const persistenceListeners = new Map<string, EventListener[]>();
    vi.spyOn(window, "addEventListener").mockImplementation(
      (type, listener, options) => {
        if (type === "beforeunload" || type === "pagehide") {
          const listeners = persistenceListeners.get(type) ?? [];
          listeners.push(listener as EventListener);
          persistenceListeners.set(type, listeners);
          return;
        }

        nativeAddEventListener(
          type,
          listener as EventListener,
          options as AddEventListenerOptions,
        );
      },
    );

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();

    runtimeWindow.name = encodeWindowSeed(nextSnapshot, "preserved-name");
    const beforeUnloadListeners = persistenceListeners.get("beforeunload") ?? [];
    expect(beforeUnloadListeners).toHaveLength(2);
    for (const listener of beforeUnloadListeners) {
      listener.call(globalThis, new Event("beforeunload"));
    }

    expect(readWindowSeedSnapshot()).toEqual(nextSnapshot);
    expect(runtimeWindow.name).toBe("preserved-name");
  });

  // A blob: worker-src CSP block is simulated by a NativeWorker that throws a
  // SecurityError only when constructed with the (blob:) bootstrap URL — the
  // original https: page URL, used by the native fallback path, still
  // succeeds, matching real worker-src behavior (#110). A plain Error with a
  // DOMException-shaped `name` is used (not `new DOMException(...)`) because
  // jsdom's DOMException does not extend Error, unlike real browsers.
  class CspBlockingNativeWorker {
    addEventListener = vi.fn();
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor(public url: string | URL) {
      if (String(url).startsWith("blob:")) {
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

  it("reports native-fallback on every degraded early-runtime Worker attempt", async () => {
    vi.stubGlobal("Worker", CspBlockingNativeWorker);
    (globalThis as typeof globalThis & { name?: string }).name = encodeWindowSeed({
      ...createSnapshot(),
      logEventName: "gw:test-log",
    });
    const postMessageSpy = vi
      .spyOn(globalThis, "postMessage")
      .mockImplementation(() => undefined);

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();
    surfaceErrorMocks.markSurfaceFailed.mockClear();

    const first = new Worker("https://example.test/page-worker.js");
    const second = new Worker("https://example.test/page-worker.js");
    first.terminate();
    second.terminate();

    // Every native-fallback attempt also feeds the existing surface-failure
    // channel, so X-Ray/popup stop showing `Protected` for this page (#111).
    expect(surfaceErrorMocks.markSurfaceFailed).toHaveBeenCalledTimes(2);
    expect(surfaceErrorMocks.markSurfaceFailed).toHaveBeenCalledWith("worker");

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
  });

  it("marks the worker surface failed when a successfully constructed early Worker never acknowledges bootstrap", async () => {
    class NativeWorker {
      addEventListener = vi.fn();
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor(_url: string | URL) {}
    }
    vi.stubGlobal("Worker", NativeWorker);
    (globalThis as typeof globalThis & { name?: string }).name =
      encodeWindowSeed(createSnapshot());

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();
    surfaceErrorMocks.markSurfaceFailed.mockClear();

    vi.useFakeTimers();
    try {
      const worker = new Worker("https://example.test/page-worker.js");
      // No ack message is ever posted back — the constructed worker never
      // confirms its own bootstrap, e.g. a crash right after installation.
      vi.runAllTimers();
      worker.terminate();

      expect(surfaceErrorMocks.markSurfaceFailed).toHaveBeenCalledWith("worker");
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails closed in Strict mode instead of returning an unspoofed early Worker", async () => {
    vi.stubGlobal("Worker", CspBlockingNativeWorker);
    (globalThis as typeof globalThis & { name?: string }).name = encodeWindowSeed({
      ...createSnapshot(),
      sharedWorkerHandlingMode: "strict",
      logEventName: "gw:test-log",
    });
    const postMessageSpy = vi
      .spyOn(globalThis, "postMessage")
      .mockImplementation(() => undefined);

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();
    surfaceErrorMocks.markSurfaceFailed.mockClear();

    expect(() => new Worker("https://example.test/page-worker.js")).toThrow(
      /strict mode/i,
    );
    expect(() => new Worker("https://example.test/page-worker.js")).toThrow(
      /strict mode/i,
    );

    // Strict fail-closed is the extension working as designed, not a
    // degradation — it must not mark the surface as failed.
    expect(surfaceErrorMocks.markSurfaceFailed).not.toHaveBeenCalled();

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
  });

  it("treats data: worker URLs as native-by-policy in the early runtime, even in Strict mode", async () => {
    class NativeWorker {
      addEventListener = vi.fn();
      terminate = vi.fn();
      constructor(public url: string | URL) {}
    }
    vi.stubGlobal("Worker", NativeWorker);
    (globalThis as typeof globalThis & { name?: string }).name = encodeWindowSeed({
      ...createSnapshot(),
      sharedWorkerHandlingMode: "strict",
      logEventName: "gw:test-log",
    });
    const postMessageSpy = vi
      .spyOn(globalThis, "postMessage")
      .mockImplementation(() => undefined);

    const { installEarlyRuntime } = await import("@/injection/main/early-runtime");
    installEarlyRuntime();

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
  });
});
