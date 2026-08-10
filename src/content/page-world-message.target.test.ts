// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadCurrentWindowSource = async () => {
  vi.resetModules();
  return (await import("@/content/page-world-message")).isCurrentWindowSource;
};

describe("isCurrentWindowSource", () => {
  beforeEach(() => {
    vi.stubGlobal("__PT_BROWSER_TARGET__", "firefox");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("accepts the current window directly", async () => {
    vi.stubGlobal("window", globalThis);
    const isCurrentWindowSource = await loadCurrentWindowSource();

    expect(isCurrentWindowSource(globalThis as unknown as MessageEventSource)).toBe(
      true,
    );
  });

  it("accepts Firefox wrapped same-window sources", async () => {
    const pageWindow = {};
    const contentWindow = { wrappedJSObject: pageWindow };
    const sourceWindow = { wrappedJSObject: pageWindow };

    vi.stubGlobal("window", contentWindow);
    const isCurrentWindowSource = await loadCurrentWindowSource();

    expect(isCurrentWindowSource(sourceWindow as unknown as MessageEventSource)).toBe(
      true,
    );
  });

  it("rejects different wrapped Firefox windows", async () => {
    const contentWindow = { wrappedJSObject: {} };
    const sourceWindow = { wrappedJSObject: {} };

    vi.stubGlobal("window", contentWindow);
    const isCurrentWindowSource = await loadCurrentWindowSource();

    expect(isCurrentWindowSource(sourceWindow as unknown as MessageEventSource)).toBe(
      false,
    );
  });

  it("rejects non-window sources on Firefox", async () => {
    vi.stubGlobal("window", globalThis);
    const isCurrentWindowSource = await loadCurrentWindowSource();

    expect(isCurrentWindowSource(null)).toBe(false);
    expect(
      isCurrentWindowSource({
        wrappedJSObject: null,
      } as unknown as MessageEventSource),
    ).toBe(false);
  });

  it("does not unwrap on Chromium", async () => {
    const pageWindow = {};
    const contentWindow = { wrappedJSObject: pageWindow };
    const sourceWindow = { wrappedJSObject: pageWindow };

    vi.stubGlobal("__PT_BROWSER_TARGET__", "chromium");
    vi.stubGlobal("window", contentWindow);
    const isCurrentWindowSource = await loadCurrentWindowSource();

    expect(isCurrentWindowSource(sourceWindow as unknown as MessageEventSource)).toBe(
      false,
    );
  });
});
