import { describe, expect, it, vi } from "vitest";

import {
  createSelectDismissGuard,
  lockSelectHostDismiss,
} from "./popup-select-dismiss-guard";

type Listener = EventListener;

const createClock = () => {
  const listeners = new Map<string, Set<Listener>>();
  const timeouts = new Map<number, { callback: () => void; delay: number }>();
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 1;

  const add = (type: string, listener: Listener) => {
    const bucket = listeners.get(type) ?? new Set();
    bucket.add(listener);
    listeners.set(type, bucket);
  };

  const remove = (type: string, listener: Listener) => {
    listeners.get(type)?.delete(listener);
  };

  const dispatch = (type: string) => {
    for (const listener of [...(listeners.get(type) ?? [])]) {
      listener(new Event(type));
    }
  };

  const flushTimeouts = (maxDelay = 50) => {
    const pending = [...timeouts.entries()].filter(
      ([, item]) => item.delay <= maxDelay,
    );
    for (const [id] of pending) timeouts.delete(id);
    for (const [, item] of pending) item.callback();
  };

  const flushFrame = () => {
    const pending = [...frames.entries()];
    frames.clear();
    for (const [, callback] of pending) callback(0);
  };

  return {
    clock: {
      addEventListener: (type: string, listener: Listener) => add(type, listener),
      removeEventListener: (type: string, listener: Listener) => remove(type, listener),
      setTimeout: (callback: () => void, delay = 0) => {
        const id = nextId;
        nextId += 1;
        timeouts.set(id, { callback, delay });
        return id;
      },
      clearTimeout: (id: number) => {
        timeouts.delete(id);
      },
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        const id = nextId;
        nextId += 1;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (id: number) => {
        frames.delete(id);
      },
    },
    dispatch,
    flushTimeouts,
    flushFrame,
  };
};

describe("lockSelectHostDismiss", () => {
  it("swallows window resize and blur at capture before later listeners", () => {
    const added: Array<{
      type: string;
      listener: EventListener;
      capture: boolean | AddEventListenerOptions | undefined;
    }> = [];
    const removed: Array<{
      type: string;
      capture: boolean | EventListenerOptions | undefined;
    }> = [];
    const host = {
      addEventListener(
        type: string,
        listener: EventListener,
        capture?: boolean | AddEventListenerOptions,
      ) {
        added.push({ type, listener, capture });
      },
      removeEventListener(
        type: string,
        _listener: EventListener,
        capture?: boolean | EventListenerOptions,
      ) {
        removed.push({ type, capture });
      },
    };

    const unlock = lockSelectHostDismiss(host);
    expect(added.map((entry) => [entry.type, entry.capture])).toEqual([
      ["resize", true],
      ["blur", true],
    ]);

    const resize = new Event("resize");
    const stopResize = vi.spyOn(resize, "stopImmediatePropagation");
    added[0]?.listener(resize);
    expect(stopResize).toHaveBeenCalledOnce();

    const blur = new Event("blur");
    const stopBlur = vi.spyOn(blur, "stopImmediatePropagation");
    added[1]?.listener(blur);
    expect(stopBlur).toHaveBeenCalledOnce();

    unlock();
    expect(removed.map((entry) => [entry.type, entry.capture])).toEqual([
      ["resize", true],
      ["blur", true],
    ]);
  });
});

describe("createSelectDismissGuard", () => {
  it("keeps ignoring the leftover opening pointer until paint after settle", () => {
    const { clock, dispatch, flushTimeouts, flushFrame } = createClock();
    const guard = createSelectDismissGuard(clock);

    guard.arm();
    expect(guard.shouldIgnoreClose()).toBe(true);

    dispatch("pointerup");
    dispatch("click");
    flushFrame();
    flushFrame();
    expect(guard.shouldIgnoreClose()).toBe(true);

    flushTimeouts();
    expect(guard.shouldIgnoreClose()).toBe(true);
    flushFrame();
    flushFrame();
    expect(guard.shouldIgnoreClose()).toBe(false);
  });

  it("releases on a later pointerdown so outside dismissal can close", () => {
    const { clock, dispatch } = createClock();
    const guard = createSelectDismissGuard(clock);

    guard.arm();
    dispatch("pointerup");
    dispatch("click");
    expect(guard.shouldIgnoreClose()).toBe(true);

    dispatch("pointerdown");
    expect(guard.shouldIgnoreClose()).toBe(false);
  });

  it("releases after keyboard open when no pointer gesture is observed", () => {
    const { clock, flushTimeouts, flushFrame } = createClock();
    const guard = createSelectDismissGuard(clock);

    guard.arm();
    expect(guard.shouldIgnoreClose()).toBe(true);

    flushTimeouts();
    expect(guard.shouldIgnoreClose()).toBe(true);
    flushFrame();
    flushFrame();
    expect(guard.shouldIgnoreClose()).toBe(false);
  });

  it("ignores host resize and blur closes after the opening has settled", () => {
    const { clock, dispatch, flushTimeouts, flushFrame } = createClock();
    const guard = createSelectDismissGuard(clock);

    guard.arm();
    flushTimeouts();
    flushFrame();
    flushFrame();
    expect(guard.shouldIgnoreClose()).toBe(false);

    dispatch("resize");
    expect(guard.shouldIgnoreClose()).toBe(true);
    flushTimeouts(0);
    expect(guard.shouldIgnoreClose()).toBe(false);

    dispatch("blur");
    expect(guard.shouldIgnoreClose()).toBe(true);
    flushTimeouts(0);
    expect(guard.shouldIgnoreClose()).toBe(false);
  });

  it("stops ignoring immediately when a value is chosen", () => {
    const { clock, dispatch } = createClock();
    const guard = createSelectDismissGuard(clock);

    guard.arm();
    dispatch("pointerup");
    guard.disarm();
    expect(guard.shouldIgnoreClose()).toBe(false);
  });
});
