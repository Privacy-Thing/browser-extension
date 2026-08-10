import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isExtensionContextValid,
  safeSendMessage,
  safeSendForResponse,
} from "@/content/safe-messaging";

const setChrome = (value: unknown): void => {
  vi.stubGlobal("chrome", value);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("safeSendMessage", () => {
  it("dispatches and reports success when the context is valid", () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    setChrome({ runtime: { id: "abc", sendMessage } });

    const delivered = safeSendMessage({ type: "ping" });

    expect(delivered).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({ type: "ping" });
  });

  it("does not call sendMessage and reports failure when runtime.id is absent", () => {
    const sendMessage = vi.fn();
    setChrome({ runtime: { id: undefined, sendMessage } });

    const delivered = safeSendMessage({ type: "ping" });

    expect(delivered).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("swallows the synchronous throw from an invalidated context", () => {
    const sendMessage = vi.fn(() => {
      throw new Error("Extension context invalidated.");
    });
    setChrome({ runtime: { id: "abc", sendMessage } });

    expect(() => safeSendMessage({ type: "ping" })).not.toThrow();
    expect(safeSendMessage({ type: "ping" })).toBe(false);
  });

  it("swallows when runtime becomes unreadable during the guarded send", () => {
    const runtime = { id: "abc", sendMessage: vi.fn().mockResolvedValue(undefined) };
    let reads = 0;
    setChrome({
      get runtime() {
        reads += 1;
        if (reads > 1) {
          throw new Error("Extension context invalidated.");
        }
        return runtime;
      },
    });

    expect(isExtensionContextValid()).toBe(true);
    expect(() => safeSendMessage({ type: "ping" })).not.toThrow();
    expect(safeSendMessage({ type: "ping" })).toBe(false);
  });

  it("reports failure when chrome is undefined", () => {
    setChrome(undefined);
    expect(safeSendMessage({ type: "ping" })).toBe(false);
  });
});

describe("safeSendForResponse", () => {
  it("returns the response when the context is valid", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    setChrome({ runtime: { id: "abc", sendMessage } });

    await expect(
      safeSendForResponse<{ ok: boolean }>({ type: "ping" }),
    ).resolves.toEqual({
      ok: true,
    });
  });

  it("returns null when the context is invalidated", async () => {
    const sendMessage = vi.fn(() => {
      throw new Error("Extension context invalidated.");
    });
    setChrome({ runtime: { id: "abc", sendMessage } });

    await expect(safeSendForResponse({ type: "ping" })).resolves.toBeNull();
  });
});

describe("isExtensionContextValid", () => {
  it("is true only when chrome.runtime.id is present", () => {
    setChrome({ runtime: { id: "abc" } });
    expect(isExtensionContextValid()).toBe(true);

    setChrome({ runtime: { id: undefined } });
    expect(isExtensionContextValid()).toBe(false);

    setChrome(undefined);
    expect(isExtensionContextValid()).toBe(false);
  });

  it("returns false when reading runtime.id throws", () => {
    setChrome({
      get runtime(): never {
        throw new Error("Extension context invalidated.");
      },
    });
    expect(isExtensionContextValid()).toBe(false);
  });
});
