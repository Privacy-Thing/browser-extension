import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHIM_GUARD_KEY, SURFACE_USAGE_REG_TYPE } from "@/shared/build-id-test-values";

const stops = vi.hoisted(() => ({ count: 0 }));
vi.mock("@privacy-brand/refract-core/runtime/analyst-trap", () => ({
  pause: () => {
    stops.count++;
  },
}));

// The emitter uses a module-scope Set; re-import fresh per test to avoid
// cross-test state leakage.
describe("markSurfaceUsed", () => {
  const dispatchEvent = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    // Fake only timers — leave queueMicrotask/promises real so `flush()` below
    // drives the microtask-deferred emit, while the cooldown setTimeout stays
    // controllable and never leaks a real 250ms timer between tests.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubGlobal("document", { dispatchEvent, addEventListener: vi.fn() });
    dispatchEvent.mockClear();
    stops.count = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const getEmitter = async () => {
    const mod =
      await import("@privacy-brand/refract-browser/common/surface-usage-emitter");
    return mod.markSurfaceUsed as unknown as (
      category: string,
      methodId?: string,
    ) => void;
  };

  // Runs after the emitter's queued flush microtask, so dispatch is observable.
  const flush = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve));

  it("restores the identical plain binding and ignores stale revisions", async () => {
    const mod =
      await import("@privacy-brand/refract-browser/common/surface-usage-emitter");
    const plain = mod.recordSurfaceUse;
    expect(mod.markSurfaceUsed).toBe(plain);
    mod.setAnalystTraps(null, 0);
    expect(mod.markSurfaceUsed).toBe(plain);
    mod.setAnalystTraps({ methods: ["date.now"], mode: "first-call" }, 2);
    const armed = mod.markSurfaceUsed;
    expect(armed).not.toBe(plain);
    mod.markSurfaceUsed("timeLocale", "date.now");
    mod.setAnalystTraps(null, 1);
    mod.setAnalystTraps({ methods: ["date.now"], mode: "first-call" }, 2);
    expect(mod.markSurfaceUsed).toBe(armed);
    mod.markSurfaceUsed("timeLocale", "date.now");
    expect(stops.count).toBe(1);
    mod.setAnalystTraps(null, 3);
    expect(mod.markSurfaceUsed).toBe(plain);
    mod.setAnalystTraps({ methods: ["date.now"], mode: "first-call" }, 4);
    mod.markSurfaceUsed("timeLocale", "date.now");
    expect(stops.count).toBe(2);
  });

  for (const mode of ["first-call", "every-call"] as const) {
    it(`preserves plain reporter counters and scheduling in the single-function ${mode} copy`, async () => {
      const replay = async (armed: boolean) => {
        vi.resetModules();
        dispatchEvent.mockClear();
        const mod =
          await import("@privacy-brand/refract-browser/common/surface-usage-emitter");
        mod.setAnalystTraps(armed ? { methods: ["date.now"], mode } : null, 0);
        mod.setSurfaceUsageSourceId("test:parity");
        mod.markSurfaceUsed("timeLocale", "date.now");
        mod.markSurfaceUsed("timeLocale", "date.parse");
        mod.markSurfaceUsed("canvas");
        mod.markSurfaceUsed("timeLocale", "date.now");
        await flush();
        mod.markSurfaceUsed("canvas", "canvas.toDataURL");
        await flush();
        expect(dispatchEvent).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(250);
        await flush();
        const payloads = dispatchEvent.mock.calls.map(
          ([event]) => JSON.parse((event as CustomEvent<string>).detail) as unknown,
        );
        expect(dispatchEvent).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(250);
        return payloads;
      };
      const plain = await replay(false);
      const armed = await replay(true);
      expect(armed).toEqual(plain);
      expect(stops.count).toBe(mode === "first-call" ? 1 : 2);
    });
  }

  it("uses captured scheduling, Set and Reflect operations after page hooks change", async () => {
    const mod =
      await import("@privacy-brand/refract-browser/common/surface-usage-emitter");
    const enqueue = globalThis.queueMicrotask;
    const hooks = { queue: 0, timeout: 0, has: 0, apply: 0 };
    const has = Set.prototype.has;
    const apply = Reflect.apply;
    vi.stubGlobal("queueMicrotask", () => {
      hooks.queue++;
    });
    vi.stubGlobal("setTimeout", () => {
      hooks.timeout++;
    });
    const applyHook = vi
      .spyOn(Reflect, "apply")
      .mockImplementation((target, receiver, args) => {
        hooks.apply++;
        return apply(target, receiver, args);
      });
    Set.prototype.has = function (value) {
      hooks.has++;
      return apply(has, this, [value]);
    };
    try {
      mod.setAnalystTraps({ methods: ["date.now"], mode: "first-call" }, 0);
      mod.markSurfaceUsed("timeLocale", "date.parse");
      mod.markSurfaceUsed("timeLocale", "date.now");
      mod.markSurfaceUsed("timeLocale", "date.now");
      mod.setAnalystTraps({ methods: ["date.now"], mode: "every-call" }, 1);
      mod.markSurfaceUsed("timeLocale", "date.parse");
      mod.markSurfaceUsed("timeLocale", "date.now");
      mod.setAnalystTraps(null, 2);
      mod.markSurfaceUsed("canvas");
    } finally {
      Set.prototype.has = has;
      applyHook.mockRestore();
    }
    await new Promise<void>((resolve) => enqueue(resolve));
    vi.unstubAllGlobals();
    expect(hooks).toEqual({ queue: 0, timeout: 0, has: 0, apply: 0 });
    expect(dispatchEvent).toHaveBeenCalledOnce();
  });

  it("dispatches a coalesced CustomEvent after the microtask flush", async () => {
    const markSurfaceUsed = await getEmitter();
    markSurfaceUsed("geolocation");
    // No synchronous dispatch — emission is deferred off the hot path.
    expect(dispatchEvent).not.toHaveBeenCalled();

    await flush();
    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0]?.[0] as CustomEvent;
    const detail = JSON.parse(event.detail as string) as { categories: string[] };
    expect(detail.categories).toContain("geolocation");
  });

  it("collapses a synchronous burst into one event with absolute counters", async () => {
    const markSurfaceUsed = await getEmitter();
    markSurfaceUsed("geolocation");
    markSurfaceUsed("geolocation");
    markSurfaceUsed("geolocation");

    await flush();
    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0]?.[0] as CustomEvent;
    const detail = JSON.parse(event.detail as string) as {
      counts: Record<string, number>;
    };
    expect(detail.counts.geolocation).toBe(3);
  });

  it("increments category and method counters together", async () => {
    const markSurfaceUsed = await getEmitter();
    markSurfaceUsed("canvas", "canvas.toDataURL");

    await flush();
    const event = dispatchEvent.mock.calls[0]?.[0] as CustomEvent;
    const detail = JSON.parse(event.detail as string) as {
      counts: Record<string, number>;
      methodCounts: Record<string, number>;
    };
    expect(detail.counts.canvas).toBe(1);
    expect(detail.methodCounts["canvas.toDataURL"]).toBe(1);
  });

  it("includes the configured source id in usage events", async () => {
    const mod =
      await import("@privacy-brand/refract-browser/common/surface-usage-emitter");
    mod.setSurfaceUsageSourceId("main");
    mod.markSurfaceUsed("canvas", "canvas.toDataURL");

    await flush();
    const event = dispatchEvent.mock.calls[0]?.[0] as CustomEvent;
    const detail = JSON.parse(event.detail as string) as { sourceId: string };
    expect(detail.sourceId).toBe("main");
  });

  it("unions distinct categories from the same burst into one event", async () => {
    const markSurfaceUsed = await getEmitter();
    markSurfaceUsed("geolocation");
    markSurfaceUsed("timeLocale");

    await flush();
    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0]?.[0] as CustomEvent;
    const detail = JSON.parse(event.detail as string) as { categories: string[] };
    expect(detail.categories).toContain("geolocation");
    expect(detail.categories).toContain("timeLocale");
  });

  it("defers a later burst to a single trailing flush after the cooldown window", async () => {
    const markSurfaceUsed = await getEmitter();
    markSurfaceUsed("geolocation");
    await flush();
    expect(dispatchEvent).toHaveBeenCalledOnce();

    // A second burst inside the cooldown window does not dispatch immediately.
    markSurfaceUsed("canvas");
    await flush();
    expect(dispatchEvent).toHaveBeenCalledOnce();

    // The trailing flush fires once the window elapses, carrying the full
    // absolute snapshot (both categories).
    await vi.advanceTimersByTimeAsync(250);
    await flush();
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
    const event = dispatchEvent.mock.calls[1]?.[0] as CustomEvent;
    const detail = JSON.parse(event.detail as string) as { categories: string[] };
    expect(detail.categories).toEqual(
      expect.arrayContaining(["geolocation", "canvas"]),
    );
  });

  it("bounds dispatch volume under async-spread access", async () => {
    const markSurfaceUsed = await getEmitter();

    // 200 reads, each in its own microtask turn (mimics a fingerprinter probing
    // across await boundaries). Without the cooldown this would dispatch ~200
    // background messages; with it, the first flush plus a trailing flush per
    // 250ms window keep the count tiny.
    for (let i = 0; i < 200; i += 1) {
      markSurfaceUsed("timeLocale", "date.now");
      await flush();
    }
    // Leading flush only so far (cooldown swallowed the rest).
    expect(dispatchEvent).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(250);
    await flush();
    expect(dispatchEvent).toHaveBeenCalledTimes(2);

    // Counters are absolute and lossless despite the dropped intermediate flushes.
    const event = dispatchEvent.mock.calls[1]?.[0] as CustomEvent;
    const detail = JSON.parse(event.detail as string) as {
      counts: Record<string, number>;
      methodCounts: Record<string, number>;
    };
    expect(detail.counts.timeLocale).toBe(200);
    expect(detail.methodCounts["date.now"]).toBe(200);
  });

  it("does not throw when dispatchEvent throws", async () => {
    dispatchEvent.mockImplementationOnce(() => {
      throw new Error("denied");
    });
    const markSurfaceUsed = await getEmitter();
    expect(() => markSurfaceUsed("canvas")).not.toThrow();
    await expect(flush()).resolves.toBeUndefined();
  });

  it("does not dispatch when document is undefined", async () => {
    vi.stubGlobal("document", undefined);
    const markSurfaceUsed = await getEmitter();
    expect(() => markSurfaceUsed("webGL")).not.toThrow();
    await flush();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});

describe("installUsageListener", () => {
  const listeners = new Map<string, EventListener>();
  const dispatchEvent = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    listeners.clear();
    dispatchEvent.mockClear();
    vi.stubGlobal("document", {
      dispatchEvent,
      addEventListener: (type: string, handler: EventListener) => {
        listeners.set(type, handler);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const getModule = async () =>
    import("@privacy-brand/refract-browser/common/surface-usage-emitter");

  it("installs a keyed listener for the register event", async () => {
    const mod = await getModule();
    mod.installUsageListener(() => "auth1234");
    expect(listeners.has(SURFACE_USAGE_REG_TYPE)).toBe(true);
  });

  it("responds to matching registration event with accumulated categories dump", async () => {
    const mod = await getModule();
    // First mark some surface usage
    mod.markSurfaceUsed("canvas");
    dispatchEvent.mockClear();
    // Install listener
    mod.installUsageListener(() => "auth1234");
    const handler = listeners.get(SURFACE_USAGE_REG_TYPE);
    expect(handler).toBeDefined();
    // Fire with valid guard and matching authKey detail
    const evt = new CustomEvent(SURFACE_USAGE_REG_TYPE, {
      detail: JSON.stringify({ guard: SHIM_GUARD_KEY, authKey: "auth1234" }),
    });
    handler?.(evt);
    // Should have dispatched a surface usage dump
    expect(dispatchEvent).toHaveBeenCalledOnce();
    const emitted = dispatchEvent.mock.calls[0]?.[0] as CustomEvent;
    const detail = JSON.parse(emitted.detail as string) as {
      categories: string[];
      methodCounts: Record<string, number>;
    };
    expect(detail.categories).toContain("canvas");
    expect(detail.methodCounts).toEqual({});
  });

  it("requires a matching auth key when the runtime snapshot has one", async () => {
    const mod = await getModule();
    mod.markSurfaceUsed("canvas");
    dispatchEvent.mockClear();
    mod.installUsageListener(() => "auth1234");
    const handler = listeners.get(SURFACE_USAGE_REG_TYPE);

    handler?.(
      new CustomEvent(SURFACE_USAGE_REG_TYPE, {
        detail: JSON.stringify({
          guard: SHIM_GUARD_KEY,
          authKey: "wrong-auth",
        }),
      }),
    );
    expect(dispatchEvent).not.toHaveBeenCalled();

    handler?.(
      new CustomEvent(SURFACE_USAGE_REG_TYPE, {
        detail: JSON.stringify({
          guard: SHIM_GUARD_KEY,
          authKey: "auth1234",
        }),
      }),
    );
    expect(dispatchEvent).toHaveBeenCalledOnce();
  });

  it("rejects guard-only registration events", async () => {
    const mod = await getModule();
    mod.markSurfaceUsed("canvas");
    dispatchEvent.mockClear();
    mod.installUsageListener(() => "auth1234");
    const handler = listeners.get(SURFACE_USAGE_REG_TYPE);

    handler?.(new CustomEvent(SURFACE_USAGE_REG_TYPE, { detail: SHIM_GUARD_KEY }));

    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("ignores registration event with wrong guard key", async () => {
    const mod = await getModule();
    mod.markSurfaceUsed("audio");
    dispatchEvent.mockClear();
    mod.installUsageListener(() => "auth1234");
    const handler = listeners.get(SURFACE_USAGE_REG_TYPE);
    // Fire with wrong detail
    const evt = new CustomEvent(SURFACE_USAGE_REG_TYPE, {
      detail: JSON.stringify({ guard: "wrong_key", authKey: "auth1234" }),
    });
    handler?.(evt);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("does not dump when no categories have been accessed", async () => {
    const mod = await getModule();
    mod.installUsageListener(() => "auth1234");
    const handler = listeners.get(SURFACE_USAGE_REG_TYPE);
    const evt = new CustomEvent(SURFACE_USAGE_REG_TYPE, {
      detail: JSON.stringify({ guard: SHIM_GUARD_KEY, authKey: "auth1234" }),
    });
    handler?.(evt);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
