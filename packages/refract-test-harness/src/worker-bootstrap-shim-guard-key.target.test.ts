import { describe, expect, it, vi } from "vitest";

import { SHIM_GUARD_KEY, WORKER_ACK_TYPE } from "@/shared/build-id-test-values";
import type { RuntimeSnapshot } from "@/shared/types";

// The worker bundle (packages/refract-worker/src/worker-runtime.ts, compiled into
// generated-worker-source.ts) is built separately by esbuild, which never applies
// Vite's per-build `define`s. `worker-runtime.ts` therefore receives the parent's
// identifiers as private installer parameters from createWorkerSource().
// This test proves that wiring end-to-end: the generated worker bundle has its
// own fallback, while createWorkerSource() must pass the parent's
// compile-time guard through the private installer parameter.

const snapshot: RuntimeSnapshot = {
  geo: { latitude: 52.2297, longitude: 21.0122, accuracy: 25, noiseRadius: 50 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl",
  },
  date: { baseEpochMs: 1, offsetMs: 3_600_000, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500],
};

const installWorkerInTest = async (workerSnapshot: RuntimeSnapshot): Promise<void> => {
  const { createWorkerSource } =
    await import("@privacy-brand/refract-browser/common/worker-bootstrap");
  const source = createWorkerSource({
    snapshot: workerSnapshot,
    workerUrl: "https://example.com/worker.js",
    workerType: "classic",
  });
  // Strip the worker-script import trailer (try/catch+XHR fallback or plain
  // importScripts) the same way worker-bootstrap.target.test.ts does — only the
  // spoof-runtime setup block needs to run for this assertion.
  const tryStart = source.lastIndexOf("\n  try {\n  importScripts(");
  const plainStart = source.lastIndexOf(
    '\n  importScripts("https://example.com/worker.js");',
  );
  const cutAt = tryStart >= 0 ? tryStart : plainStart;
  const bootstrapOnlySource =
    cutAt >= 0 ? source.slice(0, cutAt) + "\n})();\n" : source;
  const runner = new Function(bootstrapOnlySource);
  runner();
};

describe("worker bootstrap-ack guard threading", () => {
  it("posts the ack with the parent's SHIM_GUARD_KEY, not the worker bundle's own fallback", async () => {
    const originalPostMessage = (globalThis as { postMessage?: unknown }).postMessage;
    const originalSelf = (globalThis as { self?: unknown }).self;
    const originalNavigator = (globalThis as { navigator?: unknown }).navigator;
    const postMessageSpy = vi.fn();
    Object.defineProperty(globalThis, "postMessage", {
      configurable: true,
      writable: true,
      value: postMessageSpy,
    });
    Object.defineProperty(globalThis, "self", {
      configurable: true,
      value: globalThis,
    });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });

    try {
      await installWorkerInTest(snapshot);
    } finally {
      Object.defineProperty(globalThis, "postMessage", {
        configurable: true,
        writable: true,
        value: originalPostMessage,
      });
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: originalSelf,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: originalNavigator,
      });
    }

    const ackCalls = postMessageSpy.mock.calls
      .map(
        ([message]) => message as { type?: unknown; guard?: unknown; kind?: unknown },
      )
      .filter(
        (message) =>
          message?.type === WORKER_ACK_TYPE && message.kind === "bootstrap-confirmed",
      );

    expect(ackCalls).toEqual([expect.objectContaining({ guard: SHIM_GUARD_KEY })]);
    expect(ackCalls).toHaveLength(1);
  });
});
