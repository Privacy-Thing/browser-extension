import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWorkerSupport } from "./worker-runtime-support";

import { WORKER_ACK_TYPE } from "@/shared/build-id-test-values";
import type { RuntimeSnapshot } from "@/shared/types";

const snapshot = {
  geo: { latitude: 0, longitude: 0, accuracy: 0, noiseRadius: 0 },
  locale: {
    language: "en-US",
    languages: ["en-US"],
    timeZone: "UTC",
    acceptLanguage: "en-US",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
  debugMode: false,
  watchPositionDelay: [60, 500],
} satisfies RuntimeSnapshot;

describe("worker runtime surface usage", () => {
  const postMessage = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubGlobal("postMessage", postMessage);
    postMessage.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const flush = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve));

  it("coalesces Temporal calls into absolute worker X-Ray counters", async () => {
    const support = createWorkerSupport(snapshot, {
      guard: "test-guard",
      messageType: WORKER_ACK_TYPE,
      runtimeLogType: "test-log",
    });

    support.markSurfaceUsed("timeLocale", "temporal.Now.instant");
    support.markSurfaceUsed("timeLocale", "temporal.Now.instant");
    expect(postMessage).not.toHaveBeenCalled();

    await flush();

    expect(postMessage).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith({
      type: WORKER_ACK_TYPE,
      guard: "test-guard",
      kind: "surface-usage",
      categories: ["timeLocale"],
      counts: { timeLocale: 2 },
      methodCounts: { "temporal.Now.instant": 2 },
    });
  });
});
