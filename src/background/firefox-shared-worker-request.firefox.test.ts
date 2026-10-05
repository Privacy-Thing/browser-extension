import { afterEach, expect, it, vi } from "vitest";

import type { createFxRewriteHandlers } from "./firefox-shared-worker-rewrite";

import type { RuntimeSnapshot } from "@/shared/types";

const listeners: Array<
  (details: chrome.webRequest.OnBeforeSendHeadersDetails) => unknown
> = [];
const snapshot = { sharedWorkerHandlingMode: "strict" } as RuntimeSnapshot;
afterEach(() => {
  vi.unstubAllGlobals();
  listeners.length = 0;
});
it("does not cancel native Service Worker script requests without a tab while enforcing unscoped SharedWorker requests", async () => {
  vi.resetModules();
  vi.stubGlobal("browser", {
    webRequest: {
      onBeforeSendHeaders: {
        addListener: (listener: (typeof listeners)[number]) => listeners.push(listener),
      },
    },
  });
  const { createFxRewriteHandlers: createHandlers } =
    await import("./firefox-shared-worker-rewrite");
  const resolveDecision = vi.fn(() => ({ snapshot, trustedSiteMatched: false }));
  const deps: Parameters<typeof createFxRewriteHandlers>[0] = {
    getPreparedDecisions: () => ({ resolveDecision }),
    getActiveTabContexts: () => [],
    getRewriteRequestIds: () => new Set(),
    getRewriteTracker: vi.fn(),
    readDecisionCache: vi.fn(),
  };
  createHandlers(deps).registerRewriteListeners();
  const request = {
    tabId: -1,
    url: "https://example.test/worker.js",
    cookieStoreId: "firefox-default",
    requestHeaders: [{ name: "Sec-Fetch-Dest", value: "serviceworker" }],
  } as unknown as chrome.webRequest.OnBeforeSendHeadersDetails;
  expect(await listeners[0]!(request)).toBeUndefined();
  expect(resolveDecision).not.toHaveBeenCalled();
  expect(
    await listeners[0]!({
      ...request,
      requestHeaders: [{ name: "Sec-Fetch-Dest", value: "sharedworker" }],
    }),
  ).toEqual({ cancel: true });
  expect(resolveDecision).toHaveBeenCalledWith(
    "example.test",
    "firefox-default",
    false,
  );
});

it("allows a worker for proven native owners and denies an ambiguous protected owner", async () => {
  vi.resetModules();
  let ambiguous = false;
  vi.stubGlobal("browser", {
    webRequest: {
      onBeforeSendHeaders: {
        addListener: (listener: (typeof listeners)[number]) => listeners.push(listener),
      },
    },
  });
  vi.stubGlobal("chrome", {
    webNavigation: {
      getAllFrames: vi.fn(async ({ tabId }: { tabId: number }) => [
        {
          url: tabId === 1 || ambiguous ? "https://frame.test/" : "https://other.test/",
        },
      ]),
    },
  });
  const { createFxRewriteHandlers: createHandlers } =
    await import("./firefox-shared-worker-rewrite");
  const resolveDecision = vi.fn((hostname: string) => ({
    snapshot:
      hostname === "h.test"
        ? { ...snapshot, sharedWorkerHandlingMode: "native" as const }
        : snapshot,
    trustedSiteMatched: false,
  }));
  createHandlers({
    getPreparedDecisions: () => ({ resolveDecision }),
    getActiveTabContexts: () => [
      { tabId: 1, hostname: "h.test", cookieStoreId: "firefox-default" },
      { tabId: 2, hostname: "k.test", cookieStoreId: "firefox-default" },
    ],
    getRewriteRequestIds: () => new Set(),
    getRewriteTracker: vi.fn(),
    readDecisionCache: vi.fn(),
  }).registerRewriteListeners();
  const request = {
    tabId: -1,
    url: "https://frame.test/shared.js",
    documentUrl: "https://frame.test/",
    cookieStoreId: "firefox-default",
    requestHeaders: [{ name: "Sec-Fetch-Dest", value: "sharedworker" }],
  } as unknown as chrome.webRequest.OnBeforeSendHeadersDetails;
  expect(await listeners[0]!(request)).toBeUndefined();
  expect(resolveDecision).toHaveBeenCalledWith("h.test", "firefox-default");
  ambiguous = true;
  expect(await listeners[0]!(request)).toEqual({ cancel: true });
});
