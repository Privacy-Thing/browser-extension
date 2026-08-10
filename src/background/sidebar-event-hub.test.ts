import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SIDEBAR_PORT_NAME } from "@/shared/sidebar-events";
import type { SidebarPushEvent } from "@/shared/sidebar-events";

// Re-import the module fresh for each test so the module-scope Set is empty.
const loadModule = async () => {
  const mod = await import("@/background/sidebar-event-hub");
  return mod;
};

const makePort = (
  name = SIDEBAR_PORT_NAME,
): {
  name: string;
  postMessage: ReturnType<typeof vi.fn>;
  onMessage: { addListener: ReturnType<typeof vi.fn> };
  onDisconnect: { addListener: ReturnType<typeof vi.fn>; fire: () => void };
  disconnect: ReturnType<typeof vi.fn>;
} => {
  let disconnectCb: (() => void) | null = null;
  return {
    name,
    postMessage: vi.fn(),
    onMessage: { addListener: vi.fn() },
    onDisconnect: {
      addListener: vi.fn((cb: () => void) => {
        disconnectCb = cb;
      }),
      fire: () => disconnectCb?.(),
    },
    disconnect: vi.fn(),
  };
};

describe("sidebar-event-hub", () => {
  let connectListeners: ((port: any) => void)[] = [];

  beforeEach(() => {
    connectListeners = [];
    vi.stubGlobal("chrome", {
      runtime: {
        onConnect: {
          addListener: vi.fn((cb) => connectListeners.push(cb)),
        },
      },
    });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const connect = (port: ReturnType<typeof makePort>): void => {
    for (const listener of connectListeners)
      listener(port as unknown as chrome.runtime.Port);
  };

  it("ignores ports with a different name", async () => {
    const { registerSidebarEventHub, publishSidebarEvent } = await loadModule();
    registerSidebarEventHub();
    const port = makePort("other-port");
    connect(port);
    publishSidebarEvent({ type: "doctor-state-invalidated", tabId: 1 });
    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it("delivers events to connected sidebar ports", async () => {
    const { registerSidebarEventHub, publishSidebarEvent } = await loadModule();
    registerSidebarEventHub();
    const port = makePort();
    connect(port);
    const event: SidebarPushEvent = {
      type: "surface-usage-updated",
      tabId: 5,
      categories: ["canvas"],
    };
    publishSidebarEvent(event);
    expect(port.postMessage).toHaveBeenCalledWith(event);
  });

  it("removes disconnected ports from the set", async () => {
    const { registerSidebarEventHub, publishSidebarEvent } = await loadModule();
    registerSidebarEventHub();
    const port = makePort();
    connect(port);
    port.onDisconnect.fire();
    publishSidebarEvent({ type: "doctor-state-invalidated", tabId: 1 });
    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it("broadcasts to multiple connected sidebars", async () => {
    const { registerSidebarEventHub, publishSidebarEvent } = await loadModule();
    registerSidebarEventHub();
    const portA = makePort();
    const portB = makePort();
    connect(portA);
    connect(portB);
    publishSidebarEvent({ type: "doctor-state-invalidated", tabId: 2 });
    expect(portA.postMessage).toHaveBeenCalledTimes(1);
    expect(portB.postMessage).toHaveBeenCalledTimes(1);
  });

  it("handles a port that throws on postMessage", async () => {
    const { registerSidebarEventHub, publishSidebarEvent } = await loadModule();
    registerSidebarEventHub();
    const port = makePort();
    port.postMessage.mockImplementation(() => {
      throw new Error("disconnected");
    });
    connect(port);
    expect(() =>
      publishSidebarEvent({ type: "doctor-state-invalidated", tabId: 1 }),
    ).not.toThrow();
  });
});
