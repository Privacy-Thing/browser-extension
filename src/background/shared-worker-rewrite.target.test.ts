import { describe, expect, it } from "vitest";

import {
  createRewriteSource,
  createRewriteTracker,
  forceNoStoreHeaders,
  getRewriteDecision,
  isSharedWorkerRequest,
} from "@/background/shared-worker-rewrite";
import type { RuntimeSnapshot } from "@/shared/types";

const snapshot = {
  geo: {
    latitude: 52.23,
    longitude: 21.01,
    accuracy: 20,
    noiseRadius: 10,
  },
  locale: {
    language: "pl",
    languages: ["pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl",
  },
  date: {
    baseEpochMs: 0,
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [100, 100],
  authKey: "auth-a",
} satisfies RuntimeSnapshot;

describe("shared worker response rewrite helpers", () => {
  it("detects SharedWorker fetch metadata requests", () => {
    expect(
      isSharedWorkerRequest([{ name: "Sec-Fetch-Dest", value: "sharedworker" }]),
    ).toBe(true);
    expect(isSharedWorkerRequest([{ name: "Sec-Fetch-Dest", value: "script" }])).toBe(
      false,
    );
  });

  it("prepends the worker runtime without recursively importing the same URL", () => {
    const rewritten = createRewriteSource(
      snapshot,
      "https://example.test/shared.js",
      "self.postMessage(navigator.language);",
      "messenger",
    );

    expect(rewritten.indexOf("Object.freeze(")).toBeLessThan(
      rewritten.indexOf("self.postMessage"),
    );
    expect(rewritten).not.toContain("globalThis.__pt");
    expect(rewritten).not.toContain('importScripts("https://example.test/shared.js")');
    expect(rewritten).toContain('get: () => "messenger"');
  });

  it("forces rewritten worker responses out of the browser cache", () => {
    expect(
      forceNoStoreHeaders([
        { name: "Content-Type", value: "application/javascript" },
        { name: "Cache-Control", value: "max-age=3600" },
      ]),
    ).toEqual([
      { name: "Content-Type", value: "application/javascript" },
      { name: "Cache-Control", value: "no-store" },
      { name: "Pragma", value: "no-cache" },
      { name: "Expires", value: "0" },
    ]);
  });

  it("isolates worker identities when a matching tuple has another snapshot", () => {
    let now = 1_000;
    const tracker = createRewriteTracker(() => now);
    const candidate = {
      tabId: 1,
      frameId: 0,
      url: "https://example.test/shared.js",
      name: "messenger",
      workerType: "classic" as const,
      origin: "https://example.test",
    };

    const first = tracker.recordCandidate(candidate, snapshot);
    expect(tracker.canActivateIdentity(1, first, snapshot)).toBe(true);

    now += 1;
    const second = tracker.recordCandidate(
      { ...candidate, tabId: 2 },
      { ...snapshot, authKey: "auth-b" },
    );

    expect(
      tracker.canActivateIdentity(2, second, { ...snapshot, authKey: "auth-b" }),
    ).toBe(false);
    expect(tracker.getStatus(2)).toBe("identity-conflict");
  });

  it("keeps identical SharedWorker tuples isolated between Firefox containers", () => {
    const tracker = createRewriteTracker(() => 1_000);
    const baseCandidate = {
      tabId: 1,
      frameId: 0,
      url: "https://example.test/shared.js",
      name: "messenger",
      workerType: "classic" as const,
      origin: "https://example.test",
    };
    const first = tracker.recordCandidate(
      { ...baseCandidate, cookieStoreId: "firefox-container-1" },
      snapshot,
    );
    expect(tracker.canActivateIdentity(1, first, snapshot)).toBe(true);

    const second = tracker.recordCandidate(
      {
        ...baseCandidate,
        tabId: 2,
        cookieStoreId: "firefox-container-2",
      },
      { ...snapshot, authKey: "auth-b" },
    );
    expect(
      tracker.canActivateIdentity(2, second, { ...snapshot, authKey: "auth-b" }),
    ).toBe(true);
    expect(tracker.getStatus(2)).toBeUndefined();

    expect(
      tracker.findCandidate({
        tabId: 2,
        frameId: 0,
        cookieStoreId: "firefox-container-1",
        url: "https://example.test/shared.js",
      }),
    ).toBeUndefined();
  });

  it("matches rewrite candidates by frame and URL", () => {
    const tracker = createRewriteTracker(() => 1_000);
    const topFrame = tracker.recordCandidate(
      {
        tabId: 1,
        frameId: 0,
        url: "https://example.test/shared.js",
        name: "top",
        workerType: "classic",
        origin: "https://example.test",
      },
      snapshot,
    );
    const childFrame = tracker.recordCandidate(
      {
        tabId: 1,
        frameId: 2,
        url: "https://example.test/shared.js",
        name: "child",
        workerType: "classic",
        origin: "https://example.test",
      },
      snapshot,
    );

    expect(
      tracker.findCandidate({
        tabId: 1,
        frameId: 0,
        url: "https://example.test/shared.js",
      }),
    ).toBe(topFrame);
    expect(
      tracker.findCandidate({
        tabId: 1,
        frameId: 2,
        url: "https://example.test/shared.js",
      }),
    ).toBe(childFrame);
  });

  it("refreshes duplicate candidates for the same SharedWorker identity", () => {
    let now = 1_000;
    const tracker = createRewriteTracker(() => now);
    const input = {
      tabId: 1,
      frameId: 0,
      url: "https://example.test/shared.js",
      name: "messenger",
      workerType: "classic" as const,
      origin: "https://example.test",
    };

    const staleCandidate = tracker.recordCandidate(input, snapshot);
    now += 1;
    const freshCandidate = tracker.recordCandidate(input, snapshot);

    expect(
      tracker.findCandidate({
        tabId: 1,
        frameId: 0,
        url: "https://example.test/shared.js",
      }),
    ).toBe(freshCandidate);
    expect(
      tracker.findCandidate({
        tabId: 1,
        frameId: 0,
        url: "https://example.test/shared.js",
      }),
    ).not.toBe(staleCandidate);
  });

  it("installs an early response filter for known classic SharedWorker candidates", () => {
    const tracker = createRewriteTracker(() => 1_000);
    const candidate = tracker.recordCandidate(
      {
        tabId: 1,
        frameId: 0,
        url: "https://example.test/shared.js",
        name: "messenger",
        workerType: "classic",
        origin: "https://example.test",
      },
      snapshot,
    );

    const decision = getRewriteDecision({
      candidate,
      hasFetchMetadata: false,
      phase: "before-request",
      requestAlreadyFiltered: false,
      snapshot: { ...snapshot, sharedWorkerCompatibilityMode: false },
      canActivateIdentity: (rewriteCandidate) =>
        tracker.canActivateIdentity(1, rewriteCandidate, {
          ...snapshot,
          sharedWorkerCompatibilityMode: false,
        }),
    });

    expect(decision).toEqual({
      type: "install-filter",
      successStatus: "response-rewrite-preserved-identity",
    });
  });

  it("marks header-phase SharedWorker rewrite as cache sensitive", () => {
    const decision = getRewriteDecision({
      candidate: undefined,
      hasFetchMetadata: true,
      phase: "before-send-headers",
      requestAlreadyFiltered: false,
      snapshot: { ...snapshot, sharedWorkerCompatibilityMode: false },
      canActivateIdentity: () => true,
    });

    expect(decision).toEqual({
      type: "install-filter",
      successStatus: "response-rewrite-cache-sensitive",
    });
  });

  it("blocks header-phase fallback in strict mode", () => {
    const decision = getRewriteDecision({
      candidate: undefined,
      hasFetchMetadata: true,
      phase: "before-send-headers",
      requestAlreadyFiltered: false,
      snapshot: { ...snapshot, sharedWorkerHandlingMode: "strict" },
      canActivateIdentity: () => true,
    });

    expect(decision).toEqual({
      type: "cancel",
      status: "strict-blocked-cache-sensitive",
    });
  });

  it("ignores request-phase rewrites without a candidate", () => {
    expect(
      getRewriteDecision({
        candidate: undefined,
        hasFetchMetadata: true,
        phase: "before-request",
        requestAlreadyFiltered: false,
        snapshot: { ...snapshot, sharedWorkerCompatibilityMode: false },
        canActivateIdentity: () => true,
      }),
    ).toEqual({ type: "ignore" });
  });

  it("reports module SharedWorker rewrite as unsupported", () => {
    const tracker = createRewriteTracker(() => 1_000);
    const candidate = tracker.recordCandidate(
      {
        tabId: 1,
        frameId: 0,
        url: "https://example.test/shared-module.js",
        name: "module",
        workerType: "module",
        origin: "https://example.test",
      },
      snapshot,
    );

    expect(
      getRewriteDecision({
        candidate,
        hasFetchMetadata: true,
        phase: "before-send-headers",
        requestAlreadyFiltered: false,
        snapshot: { ...snapshot, sharedWorkerCompatibilityMode: false },
        canActivateIdentity: () => true,
      }),
    ).toEqual({ type: "set-status", status: "module-rewrite-unsupported" });
  });

  it("blocks module SharedWorker rewrite in strict mode", () => {
    const tracker = createRewriteTracker(() => 1_000);
    const candidate = tracker.recordCandidate(
      {
        tabId: 1,
        frameId: 0,
        url: "https://example.test/shared-module.js",
        name: "module",
        workerType: "module",
        origin: "https://example.test",
      },
      snapshot,
    );

    expect(
      getRewriteDecision({
        candidate,
        hasFetchMetadata: true,
        phase: "before-send-headers",
        requestAlreadyFiltered: false,
        snapshot: { ...snapshot, sharedWorkerHandlingMode: "strict" },
        canActivateIdentity: () => true,
      }),
    ).toEqual({ type: "cancel", status: "blocked-strict" });
  });

  it("blocks identity conflicts in strict mode", () => {
    const tracker = createRewriteTracker(() => 1_000);
    const candidate = tracker.recordCandidate(
      {
        tabId: 1,
        frameId: 0,
        url: "https://example.test/shared.js",
        name: "shared",
        workerType: "classic",
        origin: "https://example.test",
      },
      snapshot,
    );

    expect(
      getRewriteDecision({
        candidate,
        hasFetchMetadata: false,
        phase: "before-request",
        requestAlreadyFiltered: false,
        snapshot: { ...snapshot, sharedWorkerHandlingMode: "strict" },
        canActivateIdentity: () => false,
      }),
    ).toEqual({ type: "cancel", status: "blocked-strict" });
  });

  it("ignores SharedWorker rewrite when compatibility mode is active", () => {
    const decision = getRewriteDecision({
      candidate: undefined,
      hasFetchMetadata: true,
      phase: "before-send-headers",
      requestAlreadyFiltered: false,
      snapshot,
      canActivateIdentity: () => true,
    });

    expect(decision).toEqual({ type: "ignore" });
  });
});
