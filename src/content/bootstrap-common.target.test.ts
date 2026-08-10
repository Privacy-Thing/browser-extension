// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { safeSendMessageMock } = vi.hoisted(() => ({
  safeSendMessageMock: vi.fn(),
}));

vi.mock("@/content/safe-messaging", () => ({
  safeSendMessage: safeSendMessageMock,
}));

import { registerErrorRelay, registerUsageRelay } from "@/content/bootstrap-common";
import { SURFACE_ERROR_TYPE, SURFACE_USAGE_TYPE } from "@/shared/build-id-test-values";
import { CMD_SURFACE_ERROR, CMD_SURFACE_USAGE } from "@/shared/extension-contract";

describe("XRay surface relays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("document", new EventTarget());
  });

  it("forwards synthetic surface usage events from the MAIN world", () => {
    registerUsageRelay();
    const event = new CustomEvent(SURFACE_USAGE_TYPE, {
      detail: JSON.stringify({
        sourceId: "runtime",
        categories: ["canvas"],
        counts: { canvas: 3 },
        methodCounts: { "canvas.getImageData": 2 },
      }),
    });

    expect(event.isTrusted).toBe(false);
    document.dispatchEvent(event);

    expect(safeSendMessageMock).toHaveBeenCalledWith({
      type: CMD_SURFACE_USAGE,
      sourceId: "runtime",
      categories: ["canvas"],
      counts: { canvas: 3 },
      methodCounts: { "canvas.getImageData": 2 },
    });
  });

  it("forwards synthetic surface error events from the MAIN world", () => {
    registerErrorRelay();
    const event = new CustomEvent(SURFACE_ERROR_TYPE, {
      detail: JSON.stringify({ categories: ["webGL"] }),
    });

    expect(event.isTrusted).toBe(false);
    document.dispatchEvent(event);

    expect(safeSendMessageMock).toHaveBeenCalledWith({
      type: CMD_SURFACE_ERROR,
      categories: ["webGL"],
    });
  });
});
