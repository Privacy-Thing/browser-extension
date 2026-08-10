import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isExtensionContextValid,
  sendRuntimeMessage,
  sendMessageOrThrow,
} from "@/ui/shared/runtime-messaging";

const setChrome = (value: unknown): void => {
  vi.stubGlobal("chrome", value);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runtime messaging", () => {
  it("returns a response when the extension context is valid", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    setChrome({ runtime: { id: "abc", sendMessage } });

    await expect(
      sendRuntimeMessage<{ ok: boolean }>({ type: "ping" }),
    ).resolves.toEqual({
      ok: true,
    });
    expect(sendMessage).toHaveBeenCalledWith({ type: "ping" });
  });

  it("does not call sendMessage when runtime.id is missing", async () => {
    const sendMessage = vi.fn();
    setChrome({ runtime: { id: undefined, sendMessage } });

    await expect(sendRuntimeMessage({ type: "ping" })).resolves.toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("swallows synchronous invalidated-context throws for best-effort messages", async () => {
    const sendMessage = vi.fn(() => {
      throw new Error("Extension context invalidated.");
    });
    setChrome({ runtime: { id: "abc", sendMessage } });

    await expect(sendRuntimeMessage({ type: "ping" })).resolves.toBeNull();
  });

  it("throws a controlled error for required messages when the context is invalid", async () => {
    setChrome({ runtime: { id: undefined, sendMessage: vi.fn() } });

    await expect(sendMessageOrThrow({ type: "ping" })).rejects.toThrow(
      "Extension context invalidated.",
    );
  });

  it("reports invalid when reading runtime.id throws", () => {
    setChrome({
      get runtime(): never {
        throw new Error("Extension context invalidated.");
      },
    });

    expect(isExtensionContextValid()).toBe(false);
  });
});
