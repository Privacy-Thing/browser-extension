import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupAutoRefresh } from "@/ui/options/components/tabs/containers-auto-refresh";

describe("setupAutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes when the page becomes visible", () => {
    let visibilityState: DocumentVisibilityState = "hidden";
    const listeners = new Map<string, EventListener>();
    const onRefresh = vi.fn();

    const cleanup = setupAutoRefresh({
      onRefresh,
      documentRef: {
        get visibilityState() {
          return visibilityState;
        },
        addEventListener: (
          type: string,
          listener: EventListenerOrEventListenerObject,
        ) => {
          listeners.set(type, listener as EventListener);
        },
        removeEventListener: vi.fn(),
      },
      timerApi: globalThis,
    });

    visibilityState = "visible";
    listeners.get("visibilitychange")?.(new Event("visibilitychange"));

    expect(onRefresh).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("polls every 10 seconds only while the page is visible", () => {
    let visibilityState: DocumentVisibilityState = "hidden";
    const onRefresh = vi.fn();

    const cleanup = setupAutoRefresh({
      onRefresh,
      documentRef: {
        get visibilityState() {
          return visibilityState;
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      timerApi: globalThis,
    });

    vi.advanceTimersByTime(10_000);
    expect(onRefresh).not.toHaveBeenCalled();

    visibilityState = "visible";
    vi.advanceTimersByTime(10_000);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    visibilityState = "hidden";
    vi.advanceTimersByTime(20_000);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("removes the listener and clears the interval on cleanup", () => {
    const removeEventListener = vi.fn();
    const clearInterval = vi.fn();

    const cleanup = setupAutoRefresh({
      onRefresh: vi.fn(),
      documentRef: {
        visibilityState: "visible",
        addEventListener: vi.fn(),
        removeEventListener,
      },
      timerApi: {
        setInterval: vi.fn(
          (_callback: () => void, _intervalMs: number) =>
            123 as unknown as ReturnType<typeof globalThis.setInterval>,
        ),
        clearInterval: clearInterval as (
          intervalId: ReturnType<typeof globalThis.setInterval>,
        ) => void,
      },
    });

    cleanup();

    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(clearInterval).toHaveBeenCalledWith(123);
  });
});
