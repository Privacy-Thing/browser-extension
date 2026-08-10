import {
  cleanupRuntimeWindowSeed,
  consumeRuntimeWindowSeed,
  isRuntimeApplied,
  installPostInitCleanup,
  observeConfigInsertion,
  getWindowSeedPrefix,
  readConfigElement,
  readWindowSeedSnapshot,
  writeRuntimeWindowSeed,
  writeConfigElement,
} from "@privacy-brand/refract-browser/common/runtime-config";
import type { RuntimeSnapshot } from "@privacy-brand/refract-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RUNTIME_APPLIED_ATTR } from "@/shared/build-id-test-values";

const APPLIED_MARKER_ATTR = `data-${RUNTIME_APPLIED_ATTR}`;

const createSnapshot = (): RuntimeSnapshot => ({
  geo: { latitude: 52.23, longitude: 21.01, accuracy: 25, noiseRadius: 100 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl;q=0.9",
  },
  date: {
    baseEpochMs: 0,
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [60, 500],
});

const runtimeConfigSelector = 'script[type="application/json"][data-truntimeconfig]';

const createFakeScript = (): HTMLScriptElement => {
  const attrs = new Map<string, string>();
  return {
    type: "",
    textContent: "",
    isConnected: false,
    setAttribute: vi.fn((name: string, value: string) => attrs.set(name, value)),
    getAttribute: vi.fn((name: string) => attrs.get(name) ?? null),
  } as unknown as HTMLScriptElement;
};

const createCleanupWindow = (): Window & { name: string } => {
  const target = new EventTarget() as Window & { name: string };
  target.name = "";
  Object.defineProperty(target, "document", {
    configurable: true,
    value: { readyState: "complete" },
  });
  return target;
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("runtime-config", () => {
  it("revalidates a DOM runtime element before returning it", () => {
    const validSnapshot = JSON.stringify(createSnapshot());
    let reads = 0;
    const element = {
      get textContent() {
        reads += 1;
        return reads === 1 ? validSnapshot : '{"snapshot":"tampered"}';
      },
    } as HTMLScriptElement;
    const targetDocument = {
      querySelector: vi.fn(() => element),
    } as unknown as Document;

    expect(readConfigElement(targetDocument)).toBeNull();
  });

  it("does not scan or parse unmarked JSON script tags", () => {
    const targetDocument = {
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => {
        throw new Error("unexpected broad JSON scan");
      }),
    } as unknown as Document;

    expect(readConfigElement(targetDocument)).toBeNull();
    expect(targetDocument.querySelector).toHaveBeenCalledWith(runtimeConfigSelector);
    expect(targetDocument.querySelectorAll).not.toHaveBeenCalled();
  });

  it("writes and reads only the marked DOM runtime element", () => {
    const created = createFakeScript();
    let stored: HTMLScriptElement | null = null;
    const head = {
      prepend: vi.fn((element: HTMLScriptElement) => {
        stored = element;
        Object.defineProperty(element, "isConnected", {
          configurable: true,
          value: true,
        });
      }),
    };
    const targetDocument = {
      head,
      querySelector: vi.fn(() => stored),
      createElement: vi.fn(() => created),
    } as unknown as Document;
    const snapshot = createSnapshot();

    expect(writeConfigElement(targetDocument, snapshot)).toBe(true);

    expect(targetDocument.querySelector).toHaveBeenCalledWith(runtimeConfigSelector);
    expect(created.type).toBe("application/json");
    expect(created.setAttribute).toHaveBeenCalledWith("data-truntimeconfig", "");
    expect(head.prepend).toHaveBeenCalledWith(created);
    expect(readConfigElement(targetDocument)).toEqual(snapshot);
  });

  it("does not expose a window seed envelope to page-owned JSON hooks", () => {
    const snapshot = { ...createSnapshot(), authKey: "window-seed-private-key" };
    const targetWindow = { name: "page-name" };
    const nativeStringify = JSON.stringify;
    let leakedEnvelope: unknown;
    let leakedToJsonReceiver: unknown;
    JSON.stringify = function (
      this: JSON,
      value: unknown,
      ...args: unknown[]
    ): string | undefined {
      if ((value as { snapshot?: unknown } | null)?.snapshot === snapshot) {
        leakedEnvelope = value;
      }
      return Reflect.apply(nativeStringify, this, [value, ...args]) as
        string | undefined;
    } as typeof JSON.stringify;
    Object.defineProperty(Object.prototype, "toJSON", {
      configurable: true,
      value(this: { snapshot?: unknown }) {
        if (this.snapshot === snapshot) leakedToJsonReceiver = this;
        return this;
      },
    });

    try {
      writeRuntimeWindowSeed(snapshot, targetWindow);
    } finally {
      JSON.stringify = nativeStringify;
      delete (Object.prototype as { toJSON?: unknown }).toJSON;
    }

    expect(targetWindow.name).toContain(getWindowSeedPrefix());
    expect(leakedEnvelope).toBeUndefined();
    expect(leakedToJsonReceiver).toBeUndefined();
  });

  it("reports runtime-applied state from the documentElement marker", () => {
    const withMarker = (present: boolean): Document =>
      ({
        documentElement: {
          hasAttribute: vi.fn(
            (name: string) => present && name === APPLIED_MARKER_ATTR,
          ),
        },
      }) as unknown as Document;

    expect(isRuntimeApplied(withMarker(true))).toBe(true);
    expect(isRuntimeApplied(withMarker(false))).toBe(false);
    expect(isRuntimeApplied({} as Document)).toBe(false);
    expect(isRuntimeApplied(null)).toBe(false);
  });

  it("rejects and clears a window.name seed with an invalid runtime snapshot", () => {
    const prefix = getWindowSeedPrefix();
    const encoded = btoa(
      JSON.stringify({
        previousName: "existing-name",
        snapshot: { invalid: true },
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    vi.stubGlobal("name", `${prefix}${encoded}`);

    expect(readWindowSeedSnapshot()).toBeNull();
    expect((globalThis as typeof globalThis & { name?: string }).name).toBe("");
  });

  it("restores the page-owned name while preserving a consumed snapshot", () => {
    const snapshot = { ...createSnapshot(), authKey: "runtime-auth-key" };
    const targetWindow = { name: "page-owned-window-name" };
    writeRuntimeWindowSeed(snapshot, targetWindow);

    expect(consumeRuntimeWindowSeed(targetWindow)).toEqual({
      kind: "snapshot",
      previousName: "page-owned-window-name",
      snapshot,
    });
    expect(targetWindow.name).toBe("page-owned-window-name");
  });

  it("rejects a persisted same-host seed after a cross-host navigation", () => {
    const snapshot = { ...createSnapshot(), authKey: "runtime-auth-key" };
    const targetWindow = { name: "page-owned-window-name" };
    writeRuntimeWindowSeed(snapshot, targetWindow, {
      sourceHostname: "first.example",
    });
    vi.stubGlobal("name", targetWindow.name);
    vi.stubGlobal("location", { hostname: "second.example" });

    expect(readWindowSeedSnapshot()).toBeNull();
    expect((globalThis as typeof globalThis & { name?: string }).name).toBe(
      "page-owned-window-name",
    );
  });

  it("cleans a late seed without changing a page-owned name", () => {
    vi.useFakeTimers();
    const targetWindow = createCleanupWindow();
    targetWindow.name = "page-owned-window-name";
    const cleanup = installPostInitCleanup(
      () => cleanupRuntimeWindowSeed(targetWindow),
      targetWindow,
    );

    writeRuntimeWindowSeed(createSnapshot(), targetWindow);
    vi.advanceTimersByTime(25);

    expect(targetWindow.name).toBe("page-owned-window-name");
    cleanup.stop();
  });

  it("stops before pagehide preserves the outbound seed", () => {
    vi.useFakeTimers();
    const targetWindow = createCleanupWindow();
    targetWindow.name = "page-owned-window-name";
    const cleanup = installPostInitCleanup(
      () => cleanupRuntimeWindowSeed(targetWindow),
      targetWindow,
    );

    targetWindow.dispatchEvent(new Event("pagehide"));
    cleanup.stop();
    writeRuntimeWindowSeed(createSnapshot(), targetWindow);
    vi.runAllTimers();

    expect(targetWindow.name.startsWith(getWindowSeedPrefix())).toBe(true);
  });

  it("stops observing after the runtime config appears at the root", () => {
    const callback = vi.fn();
    const disconnect = vi.fn();
    const observe = vi.fn();
    let observerCallback: (() => void) | undefined;

    vi.stubGlobal(
      "MutationObserver",
      class {
        constructor(nextCallback: () => void) {
          observerCallback = nextCallback;
        }
        disconnect = disconnect;
        observe = observe;
      },
    );

    const targetDocument = {
      head: {},
      querySelector: vi.fn<() => HTMLScriptElement | null>().mockReturnValue({
        textContent: JSON.stringify(createSnapshot()),
      } as HTMLScriptElement),
    } as unknown as Document;

    observeConfigInsertion(callback, {
      targetDocument,
      timeoutMs: 5_000,
    });
    const nextObserverCallback = observerCallback;
    if (!nextObserverCallback) {
      throw new Error("Expected runtime-config observer callback");
    }
    nextObserverCallback();

    expect(observe).toHaveBeenCalledWith(targetDocument.head, { childList: true });
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("observes documentElement without subtree when head is absent", () => {
    const observe = vi.fn();

    vi.stubGlobal(
      "MutationObserver",
      class {
        disconnect = vi.fn();
        observe = observe;
      },
    );

    const documentElement = {};
    const targetDocument = {
      head: null,
      documentElement,
      querySelector: vi.fn<() => HTMLScriptElement | null>().mockReturnValue(null),
    } as unknown as Document;

    observeConfigInsertion(vi.fn(), { targetDocument, timeoutMs: 5_000 });

    expect(observe).toHaveBeenCalledWith(documentElement, { childList: true });
  });

  it("disconnects the runtime config observer after the bootstrap timeout", () => {
    vi.useFakeTimers();

    const callback = vi.fn();
    const onTimeout = vi.fn();
    const disconnect = vi.fn();

    vi.stubGlobal(
      "MutationObserver",
      class {
        disconnect = disconnect;
        observe = vi.fn();
      },
    );

    observeConfigInsertion(callback, {
      targetDocument: {
        head: {},
        querySelector: () => null,
      } as unknown as Document,
      timeoutMs: 25,
      onTimeout,
    });

    vi.advanceTimersByTime(25);

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
