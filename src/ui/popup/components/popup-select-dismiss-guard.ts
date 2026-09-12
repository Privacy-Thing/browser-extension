export type SelectDismissGuard = {
  arm: () => void;
  disarm: () => void;
  shouldIgnoreClose: () => boolean;
};

type GuardClock = {
  addEventListener: (type: string, listener: EventListener, capture?: boolean) => void;
  removeEventListener: (
    type: string,
    listener: EventListener,
    capture?: boolean,
  ) => void;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (id: number) => void;
};

type HostEventTarget = {
  addEventListener: (
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListener,
    options?: boolean | EventListenerOptions,
  ) => void;
};

const OPENING_SETTLE_MS = 50;

const defaultClock = (): GuardClock => ({
  addEventListener: (type, listener, capture) =>
    window.addEventListener(type, listener, capture),
  removeEventListener: (type, listener, capture) =>
    window.removeEventListener(type, listener, capture),
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
  clearTimeout: (id) => window.clearTimeout(id),
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
});

const runAfterPaint = (clock: GuardClock, callback: () => void): (() => void) => {
  let first = 0;
  let second = 0;
  const queueSecond = () => {
    second = clock.requestAnimationFrame(callback);
  };
  first = clock.requestAnimationFrame(queueSecond);
  return () => {
    clock.cancelAnimationFrame(first);
    clock.cancelAnimationFrame(second);
  };
};

const releaseAfterSettle = (
  clock: GuardClock,
  shouldRelease: () => boolean,
  release: () => void,
  cleanups: Array<() => void>,
) => {
  const onTimeout = () => {
    const cancelPaint = runAfterPaint(clock, () => {
      if (shouldRelease()) release();
    });
    cleanups.push(cancelPaint);
  };
  const settleId = clock.setTimeout(onTimeout, OPENING_SETTLE_MS);
  cleanups.push(() => clock.clearTimeout(settleId));
};

/**
 * Radix Select always closes on window `resize` and `blur`. In the extension
 * popup those events come from host chrome (sidecar sizing, Helium focus),
 * not from the user dismissing the menu. Swallow them for the whole open
 * lifetime so a delayed host event cannot close the menu after the opening
 * pointer has settled.
 */
export const lockSelectHostDismiss = (host: HostEventTarget = window): (() => void) => {
  const swallow = (event: Event) => {
    event.stopImmediatePropagation();
  };
  host.addEventListener("resize", swallow, true);
  host.addEventListener("blur", swallow, true);
  return () => {
    host.removeEventListener("resize", swallow, true);
    host.removeEventListener("blur", swallow, true);
  };
};

/**
 * Radix Select opens on pointerdown, then closes itself on the leftover
 * opening pointer. Ignore that host-side dismiss until a later pointer
 * begins, or until the opening gesture has settled without one (keyboard).
 */
export const createSelectDismissGuard = (
  clock: GuardClock = defaultClock(),
): SelectDismissGuard => {
  let ignoreClose = false;
  const cleanups: Array<() => void> = [];

  const runCleanups = () => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  };

  const disarm = () => {
    ignoreClose = false;
    runCleanups();
  };

  const release = () => {
    ignoreClose = false;
  };

  const arm = () => {
    disarm();
    ignoreClose = true;

    const onNewPointerDown = () => {
      clock.removeEventListener("pointerdown", onNewPointerDown, true);
      release();
    };
    clock.addEventListener("pointerdown", onNewPointerDown, true);
    cleanups.push(() =>
      clock.removeEventListener("pointerdown", onNewPointerDown, true),
    );

    releaseAfterSettle(clock, () => ignoreClose, release, cleanups);
  };

  return {
    arm,
    disarm,
    shouldIgnoreClose: () => ignoreClose,
  };
};
