import { describe, expect, it } from "vitest";

import { createSelectDismissGuard } from "./popup-select-dismiss-guard";

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
