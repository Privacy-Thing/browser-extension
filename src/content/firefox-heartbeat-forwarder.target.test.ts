// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { forwardHeartbeatPayload } from "@/content/firefox-heartbeat-forwarder";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import { queuePagePayload } from "@/shared/firefox-page-world-buffer";
import { ExtensionLogLevel } from "@/shared/logging-types";

const loadHeartbeatRelay = async () => {
  vi.resetModules();
  return (await import("@/content/firefox-heartbeat-forwarder")).registerHeartbeatRelay;
};

const LOG_EVENT_TYPE = "tLogEvt";

const makeHeartbeatPayload = (
  method: string,
  result: Record<string, unknown> | null = null,
) => ({
  type: LOG_EVENT_TYPE,
  heartbeat: true,
  detail: JSON.stringify({ component: "FirefoxBootstrap", method, args: [], result }),
});

const createFakeDocument = () => {
  const scripts: Array<{
    type: string;
    textContent: string;
    attrs: Set<string>;
    remove: () => void;
  }> = [];

  const documentElement = {
    attrs: new Set<string>(),
    hasAttribute(name: string) {
      return this.attrs.has(name);
    },
    setAttribute(name: string) {
      this.attrs.add(name);
    },
    removeAttribute(name: string) {
      this.attrs.delete(name);
    },
  };

  const host = {
    appendChild(node: {
      type: string;
      textContent: string;
      attrs: Set<string>;
      remove: () => void;
    }) {
      scripts.push(node);
    },
  };

  return {
    body: host,
    head: {
      innerHTML: "",
      appendChild: host.appendChild,
    },
    documentElement,
    createElement(_tagName?: string) {
      const node = {
        type: "",
        textContent: "",
        attrs: new Set<string>(),
        setAttribute(name: string, _value?: string) {
          this.attrs.add(name);
        },
        remove() {
          const index = scripts.indexOf(node);
          if (index >= 0) {
            scripts.splice(index, 1);
          }
        },
      };

      return node;
    },
    querySelectorAll(selector: string) {
      const match = selector.match(/\[(data-[a-z0-9-]+)\]/i);
      const attr = match?.[1];
      if (!attr) {
        return [];
      }

      return scripts.filter(
        (node) => node.type === "application/json" && node.attrs.has(attr),
      );
    },
    querySelector(selector: string) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
  };
};

describe("forwardHeartbeatPayload", () => {
  let sendMessageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMessageMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("chrome", {
      runtime: { id: "abc", sendMessage: sendMessageMock },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ignores null payload", () => {
    forwardHeartbeatPayload(null);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("ignores payloads with wrong type", () => {
    forwardHeartbeatPayload({ type: "other-type", heartbeat: true, detail: "{}" });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("ignores non-heartbeat payloads", () => {
    forwardHeartbeatPayload({
      type: LOG_EVENT_TYPE,
      eventName: "some-log-event",
      detail: JSON.stringify({
        component: "Geo",
        method: "getCurrentPosition",
        args: [],
      }),
    } as Parameters<typeof forwardHeartbeatPayload>[0]);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("ignores heartbeat payloads with non-string detail", () => {
    forwardHeartbeatPayload({ type: LOG_EVENT_TYPE, heartbeat: true, detail: 42 });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("forwards shim-installed heartbeat to chrome.runtime.sendMessage", () => {
    forwardHeartbeatPayload(makeHeartbeatPayload("shim-installed"));

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: EXTENSION_COMMAND_TYPES.logEvent,
      heartbeat: true,
      event: "FirefoxBootstrap.shim-installed",
      level: ExtensionLogLevel.Info,
      details: {
        component: "FirefoxBootstrap",
        method: "shim-installed",
        args: [],
        result: null,
      },
    });
  });

  it("forwards state-applied heartbeat with result", () => {
    forwardHeartbeatPayload(
      makeHeartbeatPayload("state-applied", {
        geoStatus: "ready",
        timeLocaleStatus: "ready",
        fingerprintStatus: "absent",
      }),
    );

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "FirefoxBootstrap.state-applied",
        details: expect.objectContaining({
          result: expect.objectContaining({ geoStatus: "ready" }),
        }),
      }),
    );
  });

  it("forwards early-source-present heartbeat", () => {
    forwardHeartbeatPayload(
      makeHeartbeatPayload("early-source-present", { source: "windowName" }),
    );

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "FirefoxBootstrap.early-source-present" }),
    );
  });

  it("forwards no-early-source heartbeat", () => {
    forwardHeartbeatPayload(makeHeartbeatPayload("no-early-source"));

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "FirefoxBootstrap.no-early-source" }),
    );
  });
});

describe("registerHeartbeatRelay", () => {
  let sendMessageMock: ReturnType<typeof vi.fn>;
  let addEventListenerSpy: ReturnType<typeof vi.fn>;
  let mutationObserverCallback: (() => void) | null;
  let observeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMessageMock = vi.fn().mockResolvedValue({ ok: true });
    addEventListenerSpy = vi.fn();
    mutationObserverCallback = null;
    observeSpy = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: { id: "abc", sendMessage: sendMessageMock },
    });
    vi.stubGlobal("__PT_BROWSER_TARGET__", "firefox");
    vi.stubGlobal("addEventListener", addEventListenerSpy);
    vi.stubGlobal("document", createFakeDocument());
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal(
      "MutationObserver",
      class {
        constructor(callback: () => void) {
          mutationObserverCallback = callback;
        }
        observe = observeSpy;
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does nothing on non-Firefox target", async () => {
    vi.stubGlobal("__PT_BROWSER_TARGET__", "chromium");
    const registerHeartbeatRelay = await loadHeartbeatRelay();
    registerHeartbeatRelay();
    expect(addEventListenerSpy).not.toHaveBeenCalled();
  });

  it("registers a message listener", async () => {
    const registerHeartbeatRelay = await loadHeartbeatRelay();
    registerHeartbeatRelay();
    expect(addEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function));
  });

  it("sets the ready symbol on globalThis", async () => {
    const registerHeartbeatRelay = await loadHeartbeatRelay();
    registerHeartbeatRelay();
    expect(
      document.documentElement.hasAttribute("data-tportid-bootstrap-heartbeat-ready"),
    ).toBe(true);
  });

  it("drains queued heartbeats on registration", async () => {
    queuePagePayload("bootstrap-heartbeat", makeHeartbeatPayload("shim-installed"));

    const registerHeartbeatRelay = await loadHeartbeatRelay();
    registerHeartbeatRelay();

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "FirefoxBootstrap.shim-installed" }),
    );
    expect(document.querySelector("[data-tportid-bootstrap-heartbeat]")).toBeNull();
  });

  it("deletes the queue after draining", async () => {
    queuePagePayload("bootstrap-heartbeat", makeHeartbeatPayload("shim-installed"));

    const registerHeartbeatRelay = await loadHeartbeatRelay();
    registerHeartbeatRelay();

    expect(document.querySelector("[data-tportid-bootstrap-heartbeat]")).toBeNull();
  });

  it("observes the document for future queued heartbeats", async () => {
    const registerHeartbeatRelay = await loadHeartbeatRelay();
    registerHeartbeatRelay();

    expect(observeSpy).toHaveBeenCalledWith(document.head, {
      childList: true,
    });
  });

  it("drains heartbeats queued after registration", async () => {
    const registerHeartbeatRelay = await loadHeartbeatRelay();
    registerHeartbeatRelay();
    queuePagePayload("bootstrap-heartbeat", makeHeartbeatPayload("state-applied"));

    mutationObserverCallback?.();

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "FirefoxBootstrap.state-applied" }),
    );
    expect(document.querySelector("[data-tportid-bootstrap-heartbeat]")).toBeNull();
  });

  it("deduplicates the same heartbeat seen from queue and postMessage", async () => {
    const registerHeartbeatRelay = await loadHeartbeatRelay();
    registerHeartbeatRelay();
    const heartbeatPayload = makeHeartbeatPayload("state-applied");
    const messageListener = addEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === "message",
    )?.[1] as ((event: MessageEvent) => void) | undefined;

    queuePagePayload("bootstrap-heartbeat", heartbeatPayload);
    mutationObserverCallback?.();
    messageListener?.({
      source: globalThis,
      data: heartbeatPayload,
    } as unknown as MessageEvent);

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "FirefoxBootstrap.state-applied" }),
    );
  });
});
