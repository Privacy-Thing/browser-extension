// @vitest-environment jsdom

import { getWindowSeedPrefix } from "@privacy-brand/refract-browser/common/runtime-config";
import { createIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setMainWorldSnapshot } from "@/background/main-world-injection";
import {
  ANALYST_CMD,
  ANALYST_HANDOFF_RUNTIME,
  RUNTIME_CONFIG_ATTR,
  RUNTIME_DISABLED_ATTR,
  RUNTIME_PAYLOAD_ATTR,
  RUNTIME_READY_EVENT_NAME,
  SURFACE_USAGE_TYPE,
} from "@/shared/build-id-test-values";
import type { RuntimeSnapshot } from "@/shared/types";

type Installer = (state: {
  integrity: ReturnType<typeof createIntegrityRegistry>;
  snapshot?: RuntimeSnapshot;
}) => unknown;

const mocks = vi.hoisted(() => ({
  pause: vi.fn(),
  installers: {} as Record<string, Installer>,
}));

// The debugger statement is the only sink replaced; selection handling is real.
vi.mock("@privacy-brand/refract-core/runtime/analyst-trap", () => ({
  pause: mocks.pause,
}));
// The full runtime runs only its Temporal installer; other surfaces are not under test.
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

const snapshot = (analystTraps?: RuntimeSnapshot["analystTraps"]): RuntimeSnapshot => ({
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
  authKey: "early-temporal",
  temporalApiEnabled: true,
  ...(analystTraps ? { analystTraps } : {}),
});
const everyTimeZone = {
  methods: ["temporal.Now.timeZoneId"],
  mode: "every-call",
} as const;
const firstTimeZone = {
  methods: ["temporal.Now.timeZoneId"],
  mode: "first-call",
} as const;

/** What the previous document's runtime stores in window.name while unloading. */
const unloadSeed = (value: RuntimeSnapshot): string =>
  getWindowSeedPrefix() +
  btoa(
    JSON.stringify({
      kind: "snapshot",
      previousName: "",
      sourceHostname: location.hostname,
      snapshot: value,
    }),
  );

/** The background's tab-aware delivery after the document commits. */
const deliverAfterCommit = (value: RuntimeSnapshot): void =>
  setMainWorldSnapshot({
    snapshot: value,
    readyEvent: RUNTIME_READY_EVENT_NAME,
    markerAttr: RUNTIME_CONFIG_ATTR,
    payloadAttr: RUNTIME_PAYLOAD_ATTR,
    offAttr: RUNTIME_DISABLED_ATTR,
  });

const defineBuiltin = (target: object, key: string, value: Function): void => {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: false,
    writable: true,
    value,
  });
};

/** A Temporal stand-in whose methods have built-in descriptors and echo their inputs. */
const createTemporal = () => {
  const Now = {};
  defineBuiltin(Now, "timeZoneId", function timeZoneId() {
    return "Native/Zone";
  });
  defineBuiltin(Now, "plainDateTimeISO", function plainDateTimeISO(timeZone?: unknown) {
    return timeZone ?? "Native/Zone";
  });
  class PlainDate {
    declare toLocaleString: (locales?: unknown) => unknown;
  }
  defineBuiltin(
    PlainDate.prototype,
    "toLocaleString",
    function toLocaleString(locales?: unknown) {
      return locales ?? "native-locale";
    },
  );
  return {
    Now: Now as { timeZoneId(): string; plainDateTimeISO(timeZone?: string): unknown },
    PlainDate,
  };
};

const nativeToString = (fn: unknown): string =>
  Function.prototype.toString.call(fn as Function);

/** Usage flushes on a microtask captured before page code runs. */
const readUsageSources = async (record: () => void): Promise<string[]> => {
  const sources: string[] = [];
  const listener = (event: Event): void => {
    sources.push(
      (JSON.parse((event as CustomEvent<string>).detail) as { sourceId: string })
        .sourceId,
    );
  };
  document.addEventListener(SURFACE_USAGE_TYPE, listener);
  record();
  await Promise.resolve();
  document.removeEventListener(SURFACE_USAGE_TYPE, listener);
  return sources;
};

/**
 * Starts a top document with the early bundle alone, then loads the full runtime.
 * Each bundle gets its own module graph, as the two injected scripts do in the build.
 */
const startEarly = async (seed: RuntimeSnapshot) => {
  const Temporal = createTemporal();
  const native = {
    timeZoneId: Object.getOwnPropertyDescriptor(Temporal.Now, "timeZoneId")!,
    toLocaleString: Object.getOwnPropertyDescriptor(
      Temporal.PlainDate.prototype,
      "toLocaleString",
    )!,
  };
  vi.stubGlobal("Temporal", Temporal);
  window.name = unloadSeed(seed);
  await import("@/injection/main/early");
  const loadRuntime = async (): Promise<(m: string[] | null, r: number) => void> => {
    vi.resetModules();
    let endpoint: Element | null = null;
    const capture = (event: Event): void => {
      endpoint = (event as MouseEvent).relatedTarget as Element;
    };
    await import("@/injection/main/index");
    mocks.installers.temporal!({
      integrity: createIntegrityRegistry(),
      snapshot: seed,
    });
    // Tests compile as the release channel, so the runtime endpoint is opened here.
    document.addEventListener(ANALYST_HANDOFF_RUNTIME, capture);
    const channel = await import("@/injection/main/analyst-channel");
    channel.openAnalystChannel(ANALYST_HANDOFF_RUNTIME);
    document.removeEventListener(ANALYST_HANDOFF_RUNTIME, capture);
    return (m, r) =>
      endpoint!.dispatchEvent(
        new CustomEvent(ANALYST_CMD, { detail: JSON.stringify({ r, m, e: true }) }),
      );
  };
  return { Temporal, native, loadRuntime };
};

describe("Chromium early-inline Temporal hooks", () => {
  // Each test is a new document: listeners of earlier runtimes must not consume its config.
  const listeners: [EventTarget, Parameters<EventTarget["addEventListener"]>][] = [];
  beforeEach(() => {
    mocks.pause.mockReset();
    for (const target of [window, document]) {
      const add = target.addEventListener;
      vi.spyOn(target, "addEventListener").mockImplementation((...args) => {
        listeners.push([target, args]);
        add.apply(target, args);
      });
    }
  });
  afterEach(() => {
    for (const [target, [type, listener, options]] of listeners.splice(0)) {
      target.removeEventListener(type, listener, options);
    }
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
    window.name = "";
    document.head.innerHTML = "";
  });

  it("spoofs, stays native-looking and reports from the first inline call", async () => {
    const { Temporal, native } = await startEarly(snapshot(firstTimeZone));
    const timeZoneId = Temporal.Now.timeZoneId;

    const sources = await readUsageSources(() => {
      expect(Temporal.Now.timeZoneId()).toBe("Europe/Warsaw");
    });
    expect(Temporal.Now.plainDateTimeISO()).toBe("Europe/Warsaw");
    expect(Temporal.Now.plainDateTimeISO("UTC")).toBe("UTC");
    expect(new Temporal.PlainDate().toLocaleString()).toEqual(["pl-PL"]);
    expect(new Temporal.PlainDate().toLocaleString("en-US")).toBe("en-US");

    expect(sources).toEqual(["runtime:temporal-early"]);
    expect(mocks.pause).toHaveBeenCalledTimes(1);
    Temporal.Now.timeZoneId();
    expect(mocks.pause).toHaveBeenCalledTimes(1);

    expect(timeZoneId).not.toBe(native.timeZoneId.value);
    expect(Object.getOwnPropertyDescriptor(Temporal.Now, "timeZoneId")).toEqual({
      ...native.timeZoneId,
      value: timeZoneId,
    });
    expect(timeZoneId.name).toBe("timeZoneId");
    expect(timeZoneId.length).toBe(0);
    expect(Object.getPrototypeOf(timeZoneId)).toBe(Function.prototype);
    expect(Object.prototype.hasOwnProperty.call(timeZoneId, "prototype")).toBe(false);
    expect(nativeToString(timeZoneId)).toBe("function timeZoneId() { [native code] }");
    const toLocaleString = Temporal.PlainDate.prototype.toLocaleString;
    expect(
      Object.getOwnPropertyDescriptor(Temporal.PlainDate.prototype, "toLocaleString"),
    ).toEqual({ ...native.toLocaleString, value: toLocaleString });
    expect(nativeToString(toLocaleString)).toBe(
      "function toLocaleString() { [native code] }",
    );
  });

  it("keeps the early wrappers when the full runtime adopts them", async () => {
    const { Temporal, loadRuntime } = await startEarly(snapshot());
    const early = Temporal.Now.timeZoneId;

    await loadRuntime();

    expect(Temporal.Now.timeZoneId).toBe(early);
    expect(nativeToString(Temporal.Now.timeZoneId)).toBe(
      "function timeZoneId() { [native code] }",
    );
    const sources = await readUsageSources(() => {
      expect(Temporal.Now.timeZoneId()).toBe("Europe/Warsaw");
    });
    expect(sources).toEqual(["main"]);
  });

  it("stops pausing when the selection settled after commit drops Temporal", async () => {
    const { Temporal, loadRuntime } = await startEarly(snapshot(everyTimeZone));
    Temporal.Now.timeZoneId();
    expect(mocks.pause).toHaveBeenCalledTimes(1);
    await loadRuntime();

    deliverAfterCommit(snapshot());
    mocks.pause.mockReset();

    expect(Temporal.Now.timeZoneId()).toBe("Europe/Warsaw");
    expect(mocks.pause).not.toHaveBeenCalled();
  });

  it("pauses when the selection settled after commit adds Temporal", async () => {
    const { Temporal, loadRuntime } = await startEarly(snapshot());
    await loadRuntime();

    deliverAfterCommit(snapshot(everyTimeZone));
    Temporal.Now.timeZoneId();
    Temporal.Now.timeZoneId();

    expect(mocks.pause).toHaveBeenCalledTimes(2);
  });

  it("applies a live selection sent to the full runtime", async () => {
    const { Temporal, loadRuntime } = await startEarly(snapshot());
    const live = await loadRuntime();

    live(["temporal.Now.timeZoneId"], 2_000);
    Temporal.Now.timeZoneId();
    expect(mocks.pause).toHaveBeenCalledTimes(1);

    live(null, 2_001);
    mocks.pause.mockReset();
    Temporal.Now.timeZoneId();
    expect(mocks.pause).not.toHaveBeenCalled();
  });
});
