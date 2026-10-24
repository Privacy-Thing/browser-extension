import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeSnapshot } from "@/shared/types";

const stop = vi.hoisted(() => vi.fn());
vi.mock("@privacy-brand/refract-core/runtime/analyst-trap", () => ({ pause: stop }));
const snapshot: RuntimeSnapshot = {
  geo: { latitude: 0, longitude: 0, accuracy: 10, noiseRadius: 50 },
  locale: { language: "en", languages: ["en"], acceptLanguage: "en", timeZone: "UTC" },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
  debugMode: false,
  watchPositionDelay: [60, 500],
  analystTraps: { methods: ["date.now"], mode: "first-call" },
};
const channel = {
  guard: "test",
  messageType: "test-message",
  runtimeLogType: "test-log",
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  stop.mockClear();
});

it("binds dedicated-worker usage to the snapshot selection exactly once", async () => {
  vi.useFakeTimers();
  vi.resetModules();
  const { createWorkerSupport } =
    await import("../../refract-worker/src/worker-runtime-support");
  const support = createWorkerSupport(snapshot, channel);
  support.markSurfaceUsed("navigator", "navigator.userAgent");
  expect(stop).not.toHaveBeenCalled();
  support.markSurfaceUsed("timeLocale", "date.now");
  support.markSurfaceUsed("timeLocale", "date.now");
  expect(stop).toHaveBeenCalledOnce();
});

it("keeps SharedWorker execution outside the lifetime of a tab selection", async () => {
  vi.useFakeTimers();
  vi.resetModules();
  const { createWorkerSupport } =
    await import("../../refract-worker/src/worker-runtime-support");
  vi.stubGlobal("SharedWorkerGlobalScope", { [Symbol.hasInstance]: () => true });
  vi.stubGlobal("addEventListener", vi.fn());
  const support = createWorkerSupport(snapshot, channel);
  support.markSurfaceUsed("timeLocale", "date.now");
  expect(stop).not.toHaveBeenCalled();
});

for (const mode of ["first-call", "every-call"] as const) {
  it(`preserves worker counters and coalescing in the ${mode} copy`, async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.resetModules();
    const { createWorkerSupport } =
      await import("../../refract-worker/src/worker-runtime-support");
    const plainSnapshot = { ...snapshot };
    delete plainSnapshot.analystTraps;
    const post = vi.fn();
    vi.stubGlobal("postMessage", post);
    const replay = async (state: RuntimeSnapshot) => {
      post.mockClear();
      const support = createWorkerSupport(state, channel);
      support.markSurfaceUsed("timeLocale", "date.now");
      support.markSurfaceUsed("navigator");
      support.markSurfaceUsed("timeLocale", "date.parse");
      support.markSurfaceUsed("timeLocale", "date.now");
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      support.markSurfaceUsed("canvas", "canvas.toDataURL");
      expect(post).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(250);
      expect(post).toHaveBeenCalledTimes(2);
      const result = post.mock.calls.map(([payload]) => payload as unknown);
      await vi.advanceTimersByTimeAsync(250);
      return result;
    };
    const plain = await replay(plainSnapshot);
    const armed = await replay({
      ...snapshot,
      analystTraps: { methods: ["date.now"], mode },
    });
    expect(armed).toEqual(plain);
    expect(stop).toHaveBeenCalledTimes(mode === "first-call" ? 1 : 2);
  });
}

it("keeps worker scheduling and selection on captured primitives", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.resetModules();
  const { createWorkerSupport } =
    await import("../../refract-worker/src/worker-runtime-support");
  const support = createWorkerSupport(snapshot, channel);
  const enqueue = globalThis.queueMicrotask;
  const queue = vi.fn();
  const timer = vi.fn();
  const post = vi.fn();
  vi.stubGlobal("queueMicrotask", queue);
  vi.stubGlobal("setTimeout", timer);
  vi.stubGlobal("postMessage", post);
  const has = vi.spyOn(Set.prototype, "has");
  support.markSurfaceUsed("timeLocale", "date.parse");
  const hasCalls = has.mock.calls.length;
  has.mockRestore();
  await new Promise<void>((resolve) => enqueue(resolve));
  vi.unstubAllGlobals();
  expect(hasCalls).toBe(0);
  expect(queue).not.toHaveBeenCalled();
  expect(timer).not.toHaveBeenCalled();
  expect(post).toHaveBeenCalledOnce();
});
