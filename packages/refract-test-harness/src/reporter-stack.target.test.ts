import type * as Primordials from "@privacy-brand/refract-core/runtime/primordials";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const frames = vi.hoisted(() => [] as { page: number; worker: number }[]);
vi.mock("@privacy-brand/refract-core/runtime/analyst-trap", () => ({
  pause: () => undefined,
}));
vi.mock("@privacy-brand/refract-core/runtime/primordials", async (original) => {
  const actual = await original<typeof Primordials>();
  return {
    ...actual,
    privateMapSet: <K, V>(target: Map<K, V>, key: K, value: V): void => {
      // Node-only observation, never bundled into a page or worker.
      const stack = new Error().stack?.split("\n") ?? [];
      frames.push({
        page: stack.filter((line) => line.includes("common/surface-usage-emitter.ts:"))
          .length,
        worker: stack.filter((line) => line.includes("src/worker-runtime-support.ts:"))
          .length,
      });
      actual.privateMapSet(target, key, value);
    },
  };
});
beforeAll(() => {
  // This fixture inspects synchronous reporter frames, not its deferred transport.
  vi.stubGlobal("queueMicrotask", () => undefined);
});
afterAll(() => vi.unstubAllGlobals());

it("uses one page reporter frame for plain, unselected and selected accesses", async () => {
  const usage =
    await import("@privacy-brand/refract-browser/common/surface-usage-emitter");
  frames.length = 0;
  usage.markSurfaceUsed("timeLocale", "date.parse");
  expect(frames.splice(0).map((entry) => entry.page)).toEqual([1, 1]);
  usage.setAnalystTraps({ methods: ["date.now"], mode: "every-call" }, 0);
  usage.markSurfaceUsed("timeLocale", "date.parse");
  expect(frames.splice(0).map((entry) => entry.page)).toEqual([1, 1]);
  usage.markSurfaceUsed("timeLocale", "date.now");
  expect(frames.splice(0).map((entry) => entry.page)).toEqual([1, 1]);
});

it("uses one worker reporter frame for plain, unselected and selected accesses", async () => {
  const { createWorkerSupport } =
    await import("../../refract-worker/src/worker-runtime-support");
  const snapshot = {
    geo: { latitude: 0, longitude: 0, accuracy: 10, noiseRadius: 50 },
    locale: {
      language: "en",
      languages: ["en"],
      acceptLanguage: "en",
      timeZone: "UTC",
    },
    date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
    debugMode: false,
    watchPositionDelay: [60, 500] as [number, number],
  };
  const channel = {
    guard: "test",
    messageType: "test-message",
    runtimeLogType: "test-log",
  };
  const plain = createWorkerSupport(snapshot, channel);
  const armed = createWorkerSupport(
    { ...snapshot, analystTraps: { methods: ["date.now"], mode: "every-call" } },
    channel,
  );
  for (const [reporter, method] of [
    [plain, "date.parse"],
    [armed, "date.parse"],
    [armed, "date.now"],
  ] as const) {
    frames.length = 0;
    reporter.markSurfaceUsed("timeLocale", method);
    expect(frames.map((entry) => entry.worker)).toEqual([1, 1]);
  }
});
