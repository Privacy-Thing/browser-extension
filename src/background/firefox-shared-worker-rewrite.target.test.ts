import { describe, expect, it, vi } from "vitest";

import { createFxRewriteHandlers } from "@/background/firefox-shared-worker-rewrite";
import { createRewriteTracker } from "@/background/shared-worker-rewrite";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { RuntimeSnapshot } from "@/shared/types";

type FxWorkerRewriteDeps = Parameters<typeof createFxRewriteHandlers>[0];

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
  sharedWorkerHandlingMode: "strict",
} satisfies RuntimeSnapshot;

const createDeps = (): FxWorkerRewriteDeps => {
  const tracker = createRewriteTracker(() => 1_000);
  return {
    getActiveTabContexts: vi.fn(() => []),
    getPreparedDecisions: vi.fn(() => null),
    getRewriteRequestIds: vi.fn(() => new Set<string>()),
    getRewriteTracker: vi.fn(() => tracker),
    readDecisionCache: vi.fn(() => ({
      snapshot,
      trustedSiteMatched: false,
    })),
  };
};

describe("createFxRewriteHandlers", () => {
  it("records candidates against the current effective snapshot", () => {
    const deps = createDeps();
    const handlers = createFxRewriteHandlers(deps);
    const candidate = {
      tabId: 7,
      frameId: 0,
      url: "https://example.test/shared.js",
      origin: "https://example.test",
      name: "shared",
      workerType: "classic" as const,
    };

    handlers.recordRewriteCandidate(candidate);

    expect(deps.getRewriteTracker().findCandidate(candidate)).toEqual(
      expect.objectContaining(candidate),
    );
    expect(deps.readDecisionCache).toHaveBeenCalledWith(
      7,
      0,
      "example.test",
      undefined,
    );
  });

  it("derives strict status from the active build target when no request was seen", () => {
    const handlers = createFxRewriteHandlers(createDeps());

    expect(handlers.getSharedWorkerStatus(7, snapshot)).toBe(
      BUILD_BROWSER_TARGET === "firefox" ? "strict-rewrite-required" : "blocked-strict",
    );
  });
});
