// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ANALYST_CMD, ANALYST_HANDOFF_RUNTIME } from "@/shared/build-id-test-values";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";

const pauses = vi.hoisted(() => ({ count: 0 }));
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

const message = (command: unknown, opened = false) => ({
  type: EXTENSION_COMMAND_TYPES.applyXRayInspectorLive,
  opened,
  command,
});

const loadEndpoints = async () => {
  const endpoints = await import("@/content/analyst-endpoints");
  return (value: unknown, sender: chrome.runtime.MessageSender = background) =>
    endpoints.applyLiveMessage(value, sender);
};

// Each MAIN bundle carries its own emitter copy, so each gets its own module graph.
const loadBundles = async () => {
  await import("@/injection/main/analyst-channel-early");
  vi.resetModules();
  await import("@/injection/main/analyst-channel-runtime");
  return import("@privacy-brand/refract-browser/common/surface-usage-emitter");
};

beforeEach(() => {
  vi.resetModules();
  pauses.count = 0;
  loadDocument();
});
afterEach(() => {
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
    await import("@/injection/main/analyst-channel-early");
    const script = document.createElement("script");
    document.head.append(script);
    vi.resetModules();
    await import("@/injection/main/analyst-channel-runtime");
    expect(apply(message(null))).toEqual({
      appliedVia: "not-live",
      reason: "late-runtime",
      endpoints: 1,
    });
  });

  it("keeps the first endpoint per bundle and hides every handshake", async () => {
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
    expect(later).not.toHaveBeenCalled();
    expect(apply(message({ r: 30, m: ["date.now"], e: false }))).toEqual({
      appliedVia: "live",
      endpoints: 2,
    });
    expect(forgedCommands).not.toHaveBeenCalled();
    usage.markSurfaceUsed("timeLocale", "date.now");
    expect(pauses.count).toBe(1);
  });

  it("accepts only shaped background messages and blocks reachable documents", async () => {
    const apply = await loadEndpoints();
    await loadBundles();
    const command = { r: 40, m: ["date.now"], e: false };
    expect(
      apply(message(command), { id: "extension", tab: { id: 1 } as chrome.tabs.Tab }),
    ).toBeNull();
    expect(apply(message(command), { id: "other" })).toBeNull();
    expect(apply({ ...message(command), extra: true })).toBeNull();
    expect(apply(message({ ...command, m: ["date.now", 1] }))).toBeNull();
    expect(apply(message(command, true))).toMatchObject({ reason: "opened-window" });

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
    const sameOrigin = { top, parent: { top, location: { origin: "https://a.test" } } };
    vi.stubGlobal("window", sameOrigin);
    expect(apply(message(command))).toMatchObject({ reason: "same-origin-frame" });
    // A same-origin grandparent reaches this document through the window tree too.
    const middle = crossOriginWindow({ top, location: { origin: "https://a.test" } });
    middle.top = top;
    vi.stubGlobal("window", { top, parent: middle });
    expect(apply(message(command))).toMatchObject({ reason: "same-origin-frame" });
    const crossParent = crossOriginWindow(top);
    crossParent.top = top;
    vi.stubGlobal("window", { top, parent: crossParent });
    expect(apply(message(null))).toEqual({ appliedVia: "live", endpoints: 2 });
  });
});
