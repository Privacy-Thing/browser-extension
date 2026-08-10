import { attachWorkerLogRelay } from "@privacy-brand/refract-browser/common/worker-runtime-log-relay";
import { describe, expect, it, vi } from "vitest";

import { LOG_EVENT_TYPE } from "@/shared/build-id-test-values";

describe("worker-runtime-log-relay", () => {
  it("forwards matching worker runtime log payloads", () => {
    let handler: ((event: Event) => void) | undefined;
    const addEventListener = vi.fn((_: string, nextHandler: (event: Event) => void) => {
      handler = nextHandler;
    });
    const postMessage = vi.fn();
    const stopImmediatePropagation = vi.fn();

    attachWorkerLogRelay(
      { debugMode: true, logEventName: "evt123" },
      { addEventListener },
      { postMessage },
    );

    expect(handler).toBeTypeOf("function");
    handler?.({
      data: {
        type: LOG_EVENT_TYPE,
        eventName: "evt123",
        detail: '{"component":"Worker","method":"install"}',
      },
      stopImmediatePropagation,
    } as unknown as Event);

    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: LOG_EVENT_TYPE,
        eventName: "evt123",
      }),
      "*",
    );
  });

  it("starts message ports and ignores non-matching payloads", () => {
    let handler: ((event: Event) => void) | undefined;
    const start = vi.fn();
    const addEventListener = vi.fn((_: string, nextHandler: (event: Event) => void) => {
      handler = nextHandler;
    });
    const postMessage = vi.fn();

    attachWorkerLogRelay(
      { debugMode: true, logEventName: "evt123" },
      { addEventListener, start },
      { postMessage },
    );

    expect(handler).toBeTypeOf("function");
    handler?.({
      data: {
        type: LOG_EVENT_TYPE,
        eventName: "other",
        detail: '{"component":"Worker","method":"install"}',
      },
      stopImmediatePropagation: vi.fn(),
    } as unknown as Event);

    expect(start).toHaveBeenCalledOnce();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("does not attach when debug mode is disabled", () => {
    const addEventListener = vi.fn();

    attachWorkerLogRelay(
      { debugMode: false, logEventName: "evt123" },
      { addEventListener },
    );

    expect(addEventListener).not.toHaveBeenCalled();
  });
});
