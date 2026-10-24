// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANALYST_CMD,
  ANALYST_HANDOFF_EARLY,
  ANALYST_HANDOFF_RUNTIME,
} from "@/shared/build-id-test-values";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";

const pauses = vi.hoisted(() => ({ count: 0 }));
const realm = vi.hoisted(() => ({ parentOwned: false }));
vi.mock("@/injection/main/iframe-realm-ownership", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  isParentOwnedRealm: () => realm.parentOwned,
}));
vi.mock("@privacy-brand/refract-core/runtime/analyst-trap", () => ({
  pause: () => {
    pauses.count += 1;
  },
}));

const background = { id: "extension" };
const original = document;
let readyState: string;

// A fresh document per test: endpoint listeners are installed at module load.
const loadDocument = () => {
  const fresh = original.implementation.createHTMLDocument("");
  readyState = "loading";
  Object.defineProperty(fresh, "readyState", {
    configurable: true,
    get: () => readyState,
  });
  vi.stubGlobal("document", fresh);
  vi.stubGlobal("chrome", {
    runtime: { id: "extension", onMessage: { addListener: vi.fn() } },
  });
};

const message = (command: unknown) => ({
  type: EXTENSION_COMMAND_TYPES.applyXRayInspectorLive,
  command,
});

const loadEndpoints = async () => {
  const endpoints = await import("@/content/analyst-endpoints");
  endpoints.installAnalystEndpoints();
  return (value: unknown, sender: chrome.runtime.MessageSender = background) =>
    endpoints.applyLiveMessage(value, sender);
};

// Each MAIN bundle carries its own emitter copy, so each gets its own module graph.
const openBundle = async (type: string) => {
  vi.resetModules();
  (await import("@/injection/main/analyst-channel")).openAnalystChannel(type);
  return import("@privacy-brand/refract-browser/common/surface-usage-emitter");
};
const loadBundles = async () => {
  await openBundle(ANALYST_HANDOFF_EARLY);
  return openBundle(ANALYST_HANDOFF_RUNTIME);
};

/** What a page can learn by dispatching a fixed handshake name itself. */
const pageProbe = (target: EventTarget = document) =>
  [ANALYST_HANDOFF_EARLY, ANALYST_HANDOFF_RUNTIME].map((type) => {
    const listener = vi.fn();
    target.addEventListener(type, listener);
    target.dispatchEvent(
      new MouseEvent(type, { relatedTarget: document.createElement("div") }),
    );
    target.removeEventListener(type, listener);
    return listener.mock.calls.length;
  });

beforeEach(() => {
  vi.resetModules();
  // The registry also closes when the document_start task ends.
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  pauses.count = 0;
  loadDocument();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Inspector live channel", () => {
  it("arms and disarms both MAIN bundles through their private endpoints only", async () => {
    const apply = await loadEndpoints();
    const pageListener = vi.fn();
    const usage = await loadBundles();
    document.addEventListener(ANALYST_HANDOFF_RUNTIME, pageListener, true);
    window.addEventListener(ANALYST_HANDOFF_RUNTIME, pageListener, true);
    const plain = usage.recordSurfaceUse;
    expect(usage.markSurfaceUsed).toBe(plain);

    const documentDispatch = vi.spyOn(document, "dispatchEvent");
    const windowDispatch = vi.spyOn(window, "dispatchEvent");
    expect(apply(message({ r: 10, m: ["date.now"], e: false }))).toEqual({
      appliedVia: "live",
      endpoints: 2,
    });
    usage.markSurfaceUsed("timeLocale", "date.parse");
    usage.markSurfaceUsed("timeLocale", "date.now");
    usage.markSurfaceUsed("timeLocale", "date.now");
    expect(pauses.count).toBe(1);

    expect(apply(message({ r: 11, m: null, e: false }))).toMatchObject({
      appliedVia: "live",
    });
    expect(usage.markSurfaceUsed).toBe(plain);
    // A snapshot activation older than the live revision cannot re-arm.
    expect(
      usage.setAnalystTraps({ methods: ["date.now"], mode: "every-call" }, 0),
    ).toBe(false);
    expect(usage.markSurfaceUsed).toBe(plain);
    expect(documentDispatch).not.toHaveBeenCalled();
    expect(windowDispatch).not.toHaveBeenCalled();
    expect(pageListener).not.toHaveBeenCalled();
  });

  it("does not acknowledge a stale revision, so the frame is not reported live", async () => {
    const apply = await loadEndpoints();
    await loadBundles();
    expect(apply(message({ r: 5, m: ["date.now"], e: true }))).toMatchObject({
      appliedVia: "live",
    });
    expect(apply(message({ r: 4, m: null, e: false }))).toEqual({
      appliedVia: "not-live",
      reason: "no-channel",
      endpoints: 2,
    });
  });

  it("reads commands with intrinsics captured before page code", async () => {
    const apply = await loadEndpoints();
    const usage = await loadBundles();
    const hooks = { detail: 0, parse: 0, queue: 0, timeout: 0 };
    const detail = Object.getOwnPropertyDescriptor(CustomEvent.prototype, "detail")!;
    // Both worlds share one realm here, so count reads of the command event only.
    Object.defineProperty(CustomEvent.prototype, "detail", {
      configurable: true,
      get(this: CustomEvent) {
        if (this.type === ANALYST_CMD) hooks.detail += 1;
        return detail.get!.call(this);
      },
    });
    const parse = JSON.parse;
    vi.spyOn(JSON, "parse").mockImplementation((...args) => {
      hooks.parse += 1;
      return parse(...args);
    });
    vi.stubGlobal("queueMicrotask", () => {
      hooks.queue += 1;
    });
    vi.stubGlobal("setTimeout", () => {
      hooks.timeout += 1;
    });
    const result = apply(message({ r: 20, m: ["canvas.toDataURL"], e: true }));
    usage.markSurfaceUsed("canvas", "canvas.toDataURL");
    vi.restoreAllMocks();
    Object.defineProperty(CustomEvent.prototype, "detail", detail);
    expect(result).toMatchObject({ appliedVia: "live" });
    expect(pauses.count).toBe(1);
    expect(hooks).toEqual({ detail: 0, parse: 0, queue: 0, timeout: 0 });
  });

  it("refuses endpoints handed over after page scripts may have run", async () => {
    const apply = await loadEndpoints();
    readyState = "interactive";
    await loadBundles();
    expect(apply(message(null))).toEqual({
      appliedVia: "not-live",
      reason: "late-runtime",
      endpoints: 0,
    });
  });

  it("refuses a handshake once an executable script exists, but not the JSON handoff", async () => {
    const apply = await loadEndpoints();
    const json = document.createElement("script");
    json.type = "application/json";
    document.head.append(json);
    await openBundle(ANALYST_HANDOFF_EARLY);
    const script = document.createElement("script");
    document.head.append(script);
    await openBundle(ANALYST_HANDOFF_RUNTIME);
    expect(apply(message(null))).toEqual({
      appliedVia: "not-live",
      reason: "late-runtime",
      endpoints: 1,
    });
  });

  it("keeps the first endpoint per bundle and stops listening once both handed over", async () => {
    const apply = await loadEndpoints();
    const usage = await loadBundles();
    const later = vi.fn();
    document.addEventListener(ANALYST_HANDOFF_RUNTIME, later, true);
    const forged = document.createElement("div");
    const forgedCommands = vi.fn();
    forged.addEventListener(ANALYST_CMD, forgedCommands);
    document.dispatchEvent(
      new MouseEvent(ANALYST_HANDOFF_RUNTIME, { relatedTarget: forged }),
    );
    // A later dispatch reaches every listener; nothing was there to stop it.
    expect(later).toHaveBeenCalledOnce();
    expect(pageProbe()).toEqual([1, 1]);
    expect(apply(message({ r: 30, m: ["date.now"], e: false }))).toEqual({
      appliedVia: "live",
      endpoints: 2,
    });
    expect(forgedCommands).not.toHaveBeenCalled();
    usage.markSurfaceUsed("timeLocale", "date.now");
    expect(pauses.count).toBe(1);
  });

  it("accepts only shaped background messages", async () => {
    const apply = await loadEndpoints();
    await loadBundles();
    const command = { r: 40, m: ["date.now"], e: false };
    expect(
      apply(message(command), { id: "extension", tab: { id: 1 } as chrome.tabs.Tab }),
    ).toBeNull();
    expect(apply(message(command), { id: "other" })).toBeNull();
    expect(apply({ ...message(command), extra: true })).toBeNull();
    expect(apply({ ...message(command), opened: false })).toBeNull();
    expect(apply(message({ ...command, m: ["date.now", 1] }))).toBeNull();
    expect(apply(message(command))).toMatchObject({ appliedVia: "live" });
  });

  it("gives documents another page can reach first no listener and no live updates", async () => {
    const crossOriginWindow = (parent?: object): Record<string, unknown> => {
      const frame: Record<string, unknown> = {
        get location(): never {
          throw new Error("SecurityError");
        },
      };
      frame.parent = parent ?? frame;
      return frame;
    };
    const top = crossOriginWindow();
    top.top = top;
    top.opener = null;
    const check = async (current: object, reason: string | null) => {
      vi.resetModules();
      loadDocument();
      vi.stubGlobal("window", current);
      const apply = await loadEndpoints();
      if (reason) {
        // No listener exists, so even a probe before any page script is untouched.
        expect(pageProbe()).toEqual([1, 1]);
        expect(apply(message(null))).toMatchObject({ appliedVia: "not-live", reason });
      } else {
        await loadBundles();
        expect(apply(message(null))).toEqual({ appliedVia: "live", endpoints: 2 });
      }
    };
    await check(
      { top, parent: { top, location: { origin: "https://a.test" } } },
      "same-origin-frame",
    );
    // A same-origin grandparent reaches this document through the window tree too.
    const middle = crossOriginWindow({ top, location: { origin: "https://a.test" } });
    middle.top = top;
    await check({ top, parent: middle }, "same-origin-frame");
    const openedTop = crossOriginWindow();
    openedTop.top = openedTop;
    openedTop.opener = {};
    await check(openedTop, "opened-window");
    const crossParent = crossOriginWindow(top);
    crossParent.top = top;
    await check({ top, parent: crossParent }, null);
  });

  it("never hides a handshake from page listeners once page code may exist", async () => {
    const apply = await loadEndpoints();
    // Before any bundle hands over, a page script dispatches the fixed names.
    document.head.append(document.createElement("script"));
    expect(pageProbe()).toEqual([1, 1]);
    expect(pageProbe(window)).toEqual([1, 1]);
    await loadBundles();
    expect(apply(message(null))).toMatchObject({ reason: "late-runtime" });
  });

  it("closes the registry when the document_start task ends", async () => {
    const apply = await loadEndpoints();
    await openBundle(ANALYST_HANDOFF_RUNTIME);
    vi.runAllTimers();
    // Still loading and scriptless, yet nothing listens any more.
    expect(pageProbe()).toEqual([1, 1]);
    expect(apply(message(null))).toEqual({ appliedVia: "live", endpoints: 1 });
  });

  it("refuses live updates only when the bootstrap injects a missing early bundle", async () => {
    const endpoints = await import("@/content/analyst-endpoints");
    endpoints.installAnalystEndpoints();
    await loadBundles();
    // The registered early bundle already handed over; the injected copy is redundant.
    endpoints.markLateEarlyBundle();
    expect(endpoints.applyLiveMessage(message(null), background)).toMatchObject({
      appliedVia: "live",
    });
    vi.resetModules();
    loadDocument();
    const late = await import("@/content/analyst-endpoints");
    late.installAnalystEndpoints();
    await openBundle(ANALYST_HANDOFF_RUNTIME);
    late.markLateEarlyBundle();
    expect(late.applyLiveMessage(message(null), background)).toMatchObject({
      reason: "late-runtime",
    });
  });

  it("opens no endpoint in a realm its parent's runtime owns", async () => {
    const apply = await loadEndpoints();
    realm.parentOwned = true;
    await loadBundles();
    realm.parentOwned = false;
    expect(apply(message(null))).toMatchObject({ reason: "no-channel", endpoints: 0 });
  });

  it("leaves release builds without a listener, a handshake or a message handler", async () => {
    // Unit tests compile with the release channel, like the store packages.
    expect(__PT_BUILD_CHANNEL__).toBe("release");
    const handshakes = vi.fn();
    for (const type of [ANALYST_HANDOFF_EARLY, ANALYST_HANDOFF_RUNTIME])
      document.addEventListener(type, handshakes, true);
    await import("@/content/analyst-endpoints-install");
    await import("@/injection/main/analyst-channel-early");
    await import("@/injection/main/analyst-channel-runtime");
    expect(handshakes).not.toHaveBeenCalled();
    expect(chrome.runtime.onMessage.addListener).not.toHaveBeenCalled();
    expect(pageProbe()).toEqual([1, 1]);
  });
});
