import { attachWorkerUsageRelay } from "@privacy-brand/refract-browser/common/worker-surface-usage-relay";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SHIM_GUARD_KEY,
  SURFACE_USAGE_TYPE,
  WORKER_ACK_TYPE,
} from "@/shared/build-id-test-values";

describe("worker surface usage relay", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("hides and forwards an absolute worker counter snapshot", () => {
    let handler: ((event: Event) => void) | undefined;
    const start = vi.fn();
    const dispatchEvent = vi.fn();
    vi.stubGlobal("document", { dispatchEvent });

    attachWorkerUsageRelay(
      {
        start,
        addEventListener: vi.fn((_: string, next: (event: Event) => void) => {
          handler = next;
        }),
      },
      { guard: SHIM_GUARD_KEY, sourceId: "worker:7" },
    );

    const stopImmediatePropagation = vi.fn();
    handler?.({
      data: {
        type: WORKER_ACK_TYPE,
        guard: SHIM_GUARD_KEY,
        kind: "surface-usage",
        categories: ["timeLocale"],
        counts: { timeLocale: 3 },
        methodCounts: { "temporal.Now.instant": 3 },
      },
      stopImmediatePropagation,
    } as unknown as Event);

    expect(start).toHaveBeenCalledOnce();
    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0]?.[0] as CustomEvent;
    expect(event.type).toBe(SURFACE_USAGE_TYPE);
    expect(JSON.parse(event.detail as string)).toEqual({
      sourceId: "worker:7",
      categories: ["timeLocale"],
      counts: { timeLocale: 3 },
      methodCounts: { "temporal.Now.instant": 3 },
    });
  });

  it("ignores malformed or foreign messages", () => {
    let handler: ((event: Event) => void) | undefined;
    const dispatchEvent = vi.fn();
    vi.stubGlobal("document", { dispatchEvent });
    attachWorkerUsageRelay(
      {
        addEventListener: vi.fn((_: string, next: (event: Event) => void) => {
          handler = next;
        }),
      },
      { guard: SHIM_GUARD_KEY, sourceId: "worker:1" },
    );

    const stopImmediatePropagation = vi.fn();
    handler?.({
      data: {
        type: WORKER_ACK_TYPE,
        guard: "foreign",
        kind: "surface-usage",
        categories: ["timeLocale"],
        counts: { timeLocale: 1 },
        methodCounts: { "temporal.Now.instant": 1 },
      },
      stopImmediatePropagation,
    } as unknown as Event);

    expect(stopImmediatePropagation).not.toHaveBeenCalled();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
