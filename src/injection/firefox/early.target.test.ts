import { beforeEach, describe, expect, it, vi } from "vitest";

const firefoxShimState = vi.hoisted(() => ({
  current: null as null | {
    bootstrap: { revision: number };
    debug: { enabled: boolean; logEventName: string | null };
    geoStatus: "absent";
    timeLocaleStatus: "absent";
    fingerprintStatus: "absent";
    authKey?: string;
    sharedWorkerHandlingMode?: "native" | "spoof" | "strict";
    sharedWorkerCompatibilityMode?: boolean;
  },
}));

const runtimeState = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

const surfaceUsage = vi.hoisted(() => ({
  markSurfaceUsed: vi.fn(),
}));

const surfaceError = vi.hoisted(() => ({
  markSurfaceFailed: vi.fn(),
}));

const firefoxStateEvents = vi.hoisted(() => ({
  listener: null as EventListener | null,
}));

vi.mock("@privacy-brand/refract-browser/common/firefox-shim-state", () => ({
  getFxStateEvent: () => "firefox-state-change",
  clearFirefoxStaticState: vi.fn(),
  parseFirefoxHashSeed: vi.fn(() => null),
  parseFxStateEvent: vi.fn(
    (event: Event) =>
      (event as Event & { shimState?: typeof firefoxShimState.current }).shimState ??
      null,
  ),
  publishFxMainHandoff: vi.fn(),
  takeFxEphemeralState: vi.fn(() => firefoxShimState.current),
  takeFxStaticState: vi.fn(() => null),
  resolveFxSeedForHost: vi.fn(() => null),
  toSnapshotFromFxState: vi.fn(() => ({
    geo: { latitude: 0, longitude: 0, accuracy: 0, noiseRadius: 50 },
    locale: {
      language: "en",
      languages: ["en"],
      timeZone: "UTC",
      acceptLanguage: "en",
    },
    date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
    debugMode: false,
    watchPositionDelay: [60, 500],
  })),
}));

vi.mock("@privacy-brand/refract-browser/common/surface-error-emitter", () => ({
  markSurfaceFailed: surfaceError.markSurfaceFailed,
}));

vi.mock("@privacy-brand/refract-browser/common/surface-usage-emitter", () => ({
  installUsageListener: vi.fn(),
  markSurfaceUsed: surfaceUsage.markSurfaceUsed,
  setSurfaceUsageSourceId: vi.fn(),
}));

vi.mock("@privacy-brand/refract-core/fingerprint/client-hints-getters", () => ({
  HIGH_ENTROPY_GETTERS: {},
}));

vi.mock(
  "@privacy-brand/refract-core/fingerprint/navigator-fingerprint-readers",
  () => ({
    createNavigatorReaders: vi.fn(() => ({})),
    installNavigatorGetters: vi.fn(),
  }),
);

vi.mock("@privacy-brand/refract-core/geolocation/firefox-geolocation-bridge", () => ({
  createFxGeoBridge: vi.fn(() => ({
    install: vi.fn(),
    isResolved: vi.fn(() => true),
    resolveGeoState: vi.fn(),
  })),
}));

vi.mock("@privacy-brand/refract-core/geolocation/geolocation-permissions", () => ({
  getOrCreateGeoPermState: vi.fn(() => ({})),
  installGeoPermPatch: vi.fn(),
}));

vi.mock("@privacy-brand/refract-core/native/native-getter", () => ({
  defineNativeGetter: vi.fn(),
}));

vi.mock("@privacy-brand/refract-core/native/native-mask", () => ({
  createNativeSource: vi.fn((name: string) => `function ${name}() { [native code] }`),
  maskAsNative: vi.fn((fn: unknown) => fn),
}));

vi.mock("@privacy-brand/refract-core/runtime/install", () => ({
  getRefractRuntimeState: vi.fn(() => runtimeState.current),
  installModuleOnce: vi.fn((_state: unknown, _name: string, step: () => void) => {
    step();
  }),
  installRuntimeOnce: vi.fn(() => {
    runtimeState.current = {};
  }),
  isRefractInstalled: vi.fn(() => false),
}));

vi.mock("@privacy-brand/refract-core/time/firefox-date-intl-patch", () => ({
  installFxDateIntl: vi.fn(),
}));

vi.mock("@privacy-brand/refract-core/time/locale-getters", () => ({
  installLocaleGetters: vi.fn(),
}));

vi.mock("@/injection/firefox/bootstrap-state-order", () => ({
  consumeFxStateSources: vi.fn((consumers: Array<{ consume: () => boolean }>) => {
    const matched = consumers.find((consumer) => consumer.consume());
    return matched ? { source: "ephemeral", role: "primary", status: "ready" } : null;
  }),
}));

vi.mock("@/injection/firefox/bootstrap-transport-manifest", () => ({
  FX_SOURCE_ORDER: ["ephemeral"],
  getFxTransportInfo: vi.fn((source: string) => ({
    source,
    role: "primary",
    status: "ready",
    precedence: 1,
    selectionScope: "document",
    visibility: "page",
    needsOptionalPermission: false,
  })),
}));

vi.mock("@/injection/firefox/xray-surface-reporting", () => ({
  shouldReportFxFp: vi.fn(() => false),
  shouldReportFxGeo: vi.fn(() => false),
  shouldReportFxTimeLocale: vi.fn(() => false),
}));

vi.mock("@/injection/firefox/window-name-seed", () => ({
  buildFxWindowSeed: vi.fn(() => ""),
  canPersistFxWindowSeed: vi.fn(() => false),
  parseFirefoxWindowSeed: vi.fn(() => null),
}));

vi.mock("@/shared/firefox-page-world-buffer", () => ({
  isPageBufferReady: vi.fn(() => true),
  queuePagePayload: vi.fn(),
}));

const createShimState = (
  sharedWorkerHandlingMode: "native" | "spoof" | "strict",
): NonNullable<typeof firefoxShimState.current> => ({
  bootstrap: { revision: 1 },
  debug: { enabled: false, logEventName: null },
  geoStatus: "absent",
  timeLocaleStatus: "absent",
  fingerprintStatus: "absent",
  authKey: "a1b2c3d4",
  sharedWorkerHandlingMode,
  sharedWorkerCompatibilityMode: sharedWorkerHandlingMode === "native",
});

const installFxEarlyRuntime = async (
  sharedWorkerHandlingMode: "native" | "spoof" | "strict",
  sharedWorkerConstructs: string[],
): Promise<ReturnType<typeof vi.fn>> => {
  vi.resetModules();
  runtimeState.current = null;
  firefoxShimState.current = createShimState(sharedWorkerHandlingMode);

  const dispatchEvent = vi.fn(() => true);
  vi.stubGlobal("document", {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === "firefox-state-change") {
        firefoxStateEvents.listener = listener;
      }
    }),
    removeEventListener: vi.fn(),
    dispatchEvent,
    documentElement: null,
  });
  vi.stubGlobal("location", new URL("https://example.test/page"));
  vi.stubGlobal("history", { state: null, replaceState: vi.fn() });
  vi.stubGlobal("navigator", {});
  vi.stubGlobal(
    "CustomEvent",
    class {
      readonly type: string;
      readonly detail: unknown;

      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
  );
  vi.stubGlobal(
    "SharedWorker",
    class {
      constructor(scriptURL: string | URL) {
        sharedWorkerConstructs.push(String(scriptURL));
      }
    },
  );

  await import("@/injection/firefox/early");

  return dispatchEvent;
};

describe("Firefox early SharedWorker strict handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    surfaceUsage.markSurfaceUsed.mockClear();
    firefoxStateEvents.listener = null;
  });

  it("blocks blob SharedWorkers in strict mode before native construction", async () => {
    const sharedWorkerConstructs: string[] = [];
    const dispatchEvent = await installFxEarlyRuntime("strict", sharedWorkerConstructs);

    expect(() => new SharedWorker("blob:https://example.test/worker")).toThrow(
      /Privacy Thing strict mode/,
    );
    expect(surfaceUsage.markSurfaceUsed).toHaveBeenCalledWith(
      "sharedWorker",
      "sharedWorker.constructor",
    );
    expect(sharedWorkerConstructs).toEqual([]);
    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0]?.[0] as { detail?: string };
    expect(JSON.parse(event.detail ?? "{}")).toMatchObject({
      reason: "rewrite-unavailable",
      workerKind: "SharedWorker",
    });
  });

  it("preserves native blob SharedWorkers outside strict mode", async () => {
    const sharedWorkerConstructs: string[] = [];
    const dispatchEvent = await installFxEarlyRuntime("spoof", sharedWorkerConstructs);

    new SharedWorker("blob:https://example.test/worker", "shared-name");

    expect(sharedWorkerConstructs).toEqual(["blob:https://example.test/worker"]);
    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0]?.[0] as { detail?: string };
    expect(JSON.parse(event.detail ?? "{}")).toMatchObject({
      url: "blob:https://example.test/worker",
      name: "shared-name",
      workerType: "classic",
      origin: "https://example.test",
    });
  });

  it("applies newer state revisions to future SharedWorker constructions", async () => {
    const sharedWorkerConstructs: string[] = [];
    await installFxEarlyRuntime("native", sharedWorkerConstructs);

    new SharedWorker("blob:https://example.test/native-worker");
    expect(sharedWorkerConstructs).toEqual(["blob:https://example.test/native-worker"]);

    const revisionTwo = {
      ...createShimState("strict"),
      bootstrap: { revision: 2 },
    };
    firefoxStateEvents.listener?.({ shimState: revisionTwo } as unknown as Event);

    expect(() => new SharedWorker("blob:https://example.test/blocked-worker")).toThrow(
      /Privacy Thing strict mode/,
    );
    expect(sharedWorkerConstructs).toEqual(["blob:https://example.test/native-worker"]);
  });

  it("preserves new-only and subclass semantics for Firefox SharedWorker", async () => {
    const sharedWorkerConstructs: string[] = [];
    await installFxEarlyRuntime("spoof", sharedWorkerConstructs);

    expect(() =>
      Reflect.apply(SharedWorker as unknown as Function, undefined, ["/worker.js"]),
    ).toThrow(TypeError);

    class DerivedSharedWorker extends SharedWorker {}
    const worker = new DerivedSharedWorker("/worker.js");

    expect(worker).toBeInstanceOf(DerivedSharedWorker);
    expect(sharedWorkerConstructs).toEqual(["/worker.js"]);
  });

  it("continues to relay strict http SharedWorker candidates for response rewrite", async () => {
    const sharedWorkerConstructs: string[] = [];
    const dispatchEvent = await installFxEarlyRuntime("strict", sharedWorkerConstructs);

    new SharedWorker("/worker.js");

    expect(sharedWorkerConstructs).toEqual(["/worker.js"]);
    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0]?.[0] as { detail?: string };
    expect(JSON.parse(event.detail ?? "{}")).toMatchObject({
      url: "https://example.test/worker.js",
      name: "",
      workerType: "classic",
      origin: "https://example.test",
    });
  });
});

describe("Firefox early dedicated Worker handling", () => {
  // A blob: worker-src CSP block is simulated by a NativeWorker that throws a
  // plain Error with a SecurityError-shaped `name` (not `new DOMException`,
  // which does not extend Error in jsdom, unlike real browsers) only when
  // constructed with the (blob:) bootstrap URL.
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

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    surfaceUsage.markSurfaceUsed.mockClear();
    surfaceError.markSurfaceFailed.mockClear();
    firefoxStateEvents.listener = null;
  });

  const installFxEarlyWithWorker = async (
    sharedWorkerHandlingMode: "native" | "spoof" | "strict",
    workerCtor: typeof Worker,
  ): Promise<void> => {
    vi.resetModules();
    runtimeState.current = null;
    firefoxShimState.current = createShimState(sharedWorkerHandlingMode);

    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      documentElement: null,
    });
    vi.stubGlobal("location", new URL("https://example.test/page"));
    vi.stubGlobal("history", { state: null, replaceState: vi.fn() });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal(
      "CustomEvent",
      class {
        readonly type: string;
        readonly detail: unknown;
        constructor(type: string, init?: { detail?: unknown }) {
          this.type = type;
          this.detail = init?.detail;
        }
      },
    );
    vi.stubGlobal(
      "SharedWorker",
      class {
        constructor(_scriptURL: string | URL) {}
      },
    );
    vi.stubGlobal("Worker", workerCtor);

    await import("@/injection/firefox/early");
  };

  it("uses the native Worker directly in Native mode", async () => {
    await installFxEarlyWithWorker(
      "native",
      CspBlockingNativeWorker as unknown as typeof Worker,
    );

    const worker = new Worker("https://example.test/page-worker.js");

    expect(worker).toBeInstanceOf(CspBlockingNativeWorker);
    expect((worker as unknown as CspBlockingNativeWorker).url).toBe(
      "https://example.test/page-worker.js",
    );
    expect(surfaceError.markSurfaceFailed).not.toHaveBeenCalled();
  });

  it("fails closed in Strict mode instead of returning an unspoofed Worker", async () => {
    await installFxEarlyWithWorker(
      "strict",
      CspBlockingNativeWorker as unknown as typeof Worker,
    );

    expect(() => new Worker("https://example.test/page-worker.js")).toThrow(
      /strict mode/i,
    );
    expect(surfaceError.markSurfaceFailed).not.toHaveBeenCalled();
  });
});
