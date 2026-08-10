import { afterEach, describe, expect, it, vi } from "vitest";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";

type FakeScript = {
  async: boolean;
  onerror: (() => void) | null;
  onload: (() => void) | null;
  remove: () => void;
  src: string;
};

type FakeRoot = {
  appendChild: (node: FakeScript) => void;
};

type FakeObserver = {
  callback: () => void;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
};

const createFakeScript = (): FakeScript => ({
  async: true,
  onerror: null,
  onload: null,
  remove: vi.fn(),
  src: "",
});

const installCommonGlobals = () => {
  vi.stubGlobal("chrome", {
    runtime: {
      getURL: (path: string) => `moz-extension://test/${path}`,
    },
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("injectMainWorldScript", () => {
  it("injects the Firefox main-world script only once when called repeatedly", async () => {
    installCommonGlobals();

    const prepended: FakeScript[] = [];
    const root: FakeRoot = {
      appendChild: (node) => {
        prepended.push(node);
      },
    };

    vi.stubGlobal("document", {
      documentElement: {},
      head: root,
      body: null,
      createElement: () => createFakeScript(),
    });

    vi.stubGlobal(
      "MutationObserver",
      class {
        disconnect = vi.fn();
        observe = vi.fn();
      },
    );

    const { injectMainWorldScript } = await import("@/content/sync-config");

    injectMainWorldScript("main-world-runtime.js");
    injectMainWorldScript("main-world-runtime.js");

    expect(prepended).toHaveLength(1);
    expect(prepended[0]?.src).toBe("moz-extension://test/main-world-runtime.js");
  });

  it("injects different Firefox page-world scripts once each", async () => {
    installCommonGlobals();

    const prepended: FakeScript[] = [];
    const root: FakeRoot = {
      appendChild: (node) => {
        prepended.push(node);
      },
    };

    vi.stubGlobal("document", {
      documentElement: {},
      head: root,
      body: null,
      createElement: () => createFakeScript(),
    });

    vi.stubGlobal(
      "MutationObserver",
      class {
        disconnect = vi.fn();
        observe = vi.fn();
      },
    );

    const { injectMainWorldScript } = await import("@/content/sync-config");

    injectMainWorldScript("main-world-early.js");
    injectMainWorldScript("main-world-runtime.js");
    injectMainWorldScript("main-world-early.js");

    expect(prepended).toHaveLength(2);
    expect(prepended.map((script) => script.src)).toEqual([
      "moz-extension://test/main-world-early.js",
      "moz-extension://test/main-world-runtime.js",
    ]);
  });

  it("reports a heartbeat when a Firefox page-world script fails to load", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("chrome", {
      runtime: {
        id: "abc",
        getURL: (path: string) => `moz-extension://test/${path}`,
        sendMessage,
      },
    });

    const prepended: FakeScript[] = [];
    const root: FakeRoot = {
      appendChild: (node) => {
        prepended.push(node);
      },
    };

    vi.stubGlobal("document", {
      documentElement: {},
      head: root,
      body: null,
      createElement: () => createFakeScript(),
    });

    vi.stubGlobal(
      "MutationObserver",
      class {
        disconnect = vi.fn();
        observe = vi.fn();
      },
    );

    const { injectMainWorldScript } = await import("@/content/sync-config");

    injectMainWorldScript("main-world-early.js");
    prepended[0]?.onerror?.();
    await Promise.resolve();

    expect(sendMessage).toHaveBeenCalledWith({
      type: EXTENSION_COMMAND_TYPES.logEvent,
      heartbeat: true,
      event: "FirefoxBootstrap.page-world-script-load-failed",
      details: {
        result: {
          scriptPath: "main-world-early.js",
        },
      },
    });
  });

  it("creates only one pending observer and injects only once after the root appears", async () => {
    installCommonGlobals();

    const prepended: FakeScript[] = [];
    const root: FakeRoot = {
      appendChild: (node) => {
        prepended.push(node);
      },
    };

    let mutationObserverInstance: FakeObserver | null = null;

    vi.stubGlobal("document", {
      documentElement: null,
      head: null,
      body: null,
      createElement: () => createFakeScript(),
    });

    vi.stubGlobal(
      "MutationObserver",
      class {
        callback: () => void;
        disconnect = vi.fn();
        observe = vi.fn();
        constructor(callback: () => void) {
          this.callback = callback;
          mutationObserverInstance = this;
        }
      },
    );

    const { injectMainWorldScript } = await import("@/content/sync-config");

    injectMainWorldScript("main-world-runtime.js");
    injectMainWorldScript("main-world-runtime.js");

    if (mutationObserverInstance === null) {
      throw new Error("Expected a MutationObserver instance");
    }

    const observer: FakeObserver = mutationObserverInstance;

    expect(observer.observe).toHaveBeenCalledTimes(1);
    expect(prepended).toHaveLength(0);

    (
      globalThis.document as unknown as {
        body: FakeRoot | null;
      }
    ).body = root;
    observer.callback();

    expect(prepended).toHaveLength(1);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it("injects all queued Firefox page-world scripts after the root appears", async () => {
    installCommonGlobals();

    const prepended: FakeScript[] = [];
    const root: FakeRoot = {
      appendChild: (node) => {
        prepended.push(node);
      },
    };

    let mutationObserverInstance: FakeObserver | null = null;

    vi.stubGlobal("document", {
      documentElement: null,
      head: null,
      body: null,
      createElement: () => createFakeScript(),
    });

    vi.stubGlobal(
      "MutationObserver",
      class {
        callback: () => void;
        disconnect = vi.fn();
        observe = vi.fn();
        constructor(callback: () => void) {
          this.callback = callback;
          mutationObserverInstance = this;
        }
      },
    );

    const { injectMainWorldScript } = await import("@/content/sync-config");

    injectMainWorldScript("main-world-early.js");
    injectMainWorldScript("main-world-runtime.js");
    injectMainWorldScript("main-world-early.js");

    if (mutationObserverInstance === null) {
      throw new Error("Expected a MutationObserver instance");
    }

    const observer: FakeObserver = mutationObserverInstance;

    expect(observer.observe).toHaveBeenCalledTimes(1);
    expect(prepended).toHaveLength(0);

    (
      globalThis.document as unknown as {
        body: FakeRoot | null;
      }
    ).body = root;
    observer.callback();

    expect(prepended).toHaveLength(2);
    expect(prepended.map((script) => script.src)).toEqual([
      "moz-extension://test/main-world-early.js",
      "moz-extension://test/main-world-runtime.js",
    ]);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });
});
