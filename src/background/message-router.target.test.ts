import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/background/logger", () => ({
  logExtensionEvent: vi.fn(),
  waitForExtensionLogQueue: vi.fn(async () => undefined),
}));

vi.mock("@/background/storage/site-suggestions", () => ({
  recordSuggestion: vi.fn(async () => undefined),
}));

import { registerMessageRouter, type RouterDeps } from "@/background/message-router";
import { recordSuggestion } from "@/background/storage/site-suggestions";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import {
  SW_STRICT_BLOCKED_EVENT,
  WORKER_CSP_BLOCKED_EVENT,
} from "@/shared/worker-compatibility";

describe("registerMessageRouter", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("accepts only the current runtime namespace", () => {
    let listener:
      | ((
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean)
      | undefined;
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener: vi.fn((handler) => {
            listener = handler;
          }),
        },
      },
    });
    registerMessageRouter({} as RouterDeps);

    expect(
      listener?.({ type: `${["geo", "warp"].join("")}:get-settings` }, {}, vi.fn()),
    ).toBe(false);
  });

  it("does not create a relaxation suggestion from a strict SharedWorker log event", async () => {
    let listener:
      | ((
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean)
      | undefined;
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener: vi.fn((handler) => {
            listener = handler;
          }),
        },
      },
    });

    registerMessageRouter({
      isSupportedWebUrl: (url: string | undefined): url is string =>
        typeof url === "string",
      getLastKnownDebugMode: () => false,
    } as unknown as RouterDeps);

    listener?.(
      {
        type: EXTENSION_COMMAND_TYPES.logEvent,
        event: SW_STRICT_BLOCKED_EVENT,
        level: "warn",
        details: {
          result: {
            attemptId: "page-controlled-attempt",
            authKey: "page-visible-key",
            guard: "page-visible-guard",
            reason: "strict-blocked",
            workerKind: "SharedWorker",
          },
        },
      },
      {
        frameId: 0,
        tab: { id: 42, url: "https://example.com" } as chrome.tabs.Tab,
        url: "https://example.com",
      },
      vi.fn(),
    );

    await Promise.resolve();

    expect(recordSuggestion).not.toHaveBeenCalled();
  });

  it("keeps CSP worker suggestions on the existing runtime event", async () => {
    let listener:
      | ((
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean)
      | undefined;
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener: vi.fn((handler) => {
            listener = handler;
          }),
        },
      },
    });

    registerMessageRouter({
      isSupportedWebUrl: (url: string | undefined): url is string =>
        typeof url === "string",
      getLastKnownDebugMode: () => false,
    } as unknown as RouterDeps);

    listener?.(
      {
        type: EXTENSION_COMMAND_TYPES.logEvent,
        event: WORKER_CSP_BLOCKED_EVENT,
        level: "warn",
      },
      { tab: { id: 42, url: "https://example.com" } as chrome.tabs.Tab },
      vi.fn(),
    );

    await Promise.resolve();

    expect(recordSuggestion).toHaveBeenCalledWith(
      "example.com",
      "worker-csp-relaxation",
      undefined,
    );
  });

  it("relays surface method counts to the background tracker", () => {
    let listener:
      | ((
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean)
      | undefined;
    const recordSurfaceUsage = vi.fn();
    const refreshBadgeCount = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener: vi.fn((handler) => {
            listener = handler;
          }),
        },
      },
    });

    registerMessageRouter({
      isSupportedWebUrl: (url: string | undefined): url is string =>
        typeof url === "string",
      recordSurfaceUsage,
      refreshBadgeCount,
    } as unknown as RouterDeps);

    const sendResponse = vi.fn();
    const handled = listener?.(
      {
        type: EXTENSION_COMMAND_TYPES.surfaceUsage,
        categories: ["canvas"],
        sourceId: "main",
        counts: { canvas: 1 },
        methodCounts: { "canvas.toDataURL": 1 },
      },
      { tab: { id: 42, url: "https://example.com" } as chrome.tabs.Tab, frameId: 3 },
      sendResponse,
    );

    expect(handled).toBe(true);
    expect(recordSurfaceUsage).toHaveBeenCalledWith({
      tabId: 42,
      categories: ["canvas"],
      sourceKey: "3:main",
      counts: { canvas: 1 },
      methodCounts: { "canvas.toDataURL": 1 },
    });
    expect(refreshBadgeCount).toHaveBeenCalledWith(42);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("keeps subframe snapshot fallback from replacing the main-frame tab context", () => {
    let listener:
      | ((
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean)
      | undefined;
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener: vi.fn((handler) => {
            listener = handler;
          }),
        },
      },
    });

    const readSnapshotCache = vi.fn(() => null);
    const upsertTabContext = vi.fn(async () => undefined);
    registerMessageRouter({
      readSnapshotCache,
      upsertTabContext,
    } as unknown as RouterDeps);

    const sendResolve = (frameId: number, hostname: string): void => {
      const sendResponse = vi.fn();
      const handled = listener?.(
        {
          type: EXTENSION_COMMAND_TYPES.resolveRuntimeSnapshot,
          hostname,
        },
        {
          frameId,
          tab: { id: 42, url: "https://example.com" } as chrome.tabs.Tab,
        },
        sendResponse,
      );

      expect(handled).toBe(false);
      expect(sendResponse).toHaveBeenCalledWith({ ok: true, snapshot: null });
    };

    sendResolve(0, "example.com");
    sendResolve(3, "child.example.com");
    sendResolve(4, "");
    sendResolve(0, "");

    expect(readSnapshotCache).toHaveBeenNthCalledWith(
      1,
      42,
      0,
      "example.com",
      undefined,
    );
    expect(readSnapshotCache).toHaveBeenNthCalledWith(
      2,
      42,
      3,
      "child.example.com",
      undefined,
    );
    expect(readSnapshotCache).toHaveBeenNthCalledWith(3, 42, 4, "", undefined);
    expect(readSnapshotCache).toHaveBeenNthCalledWith(4, 42, 0, "", undefined);
    expect(upsertTabContext).toHaveBeenCalledOnce();
    expect(upsertTabContext).toHaveBeenCalledWith(42, {
      tabId: 42,
      hostname: "example.com",
    });
  });
});
