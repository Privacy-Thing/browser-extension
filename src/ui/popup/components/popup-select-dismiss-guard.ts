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

/**
 * Radix Select closes on window `resize` and `blur`. In the extension popup,
 * those events may come from host chrome rather than a user dismissal. Stop
 * them while the menu is open, before Radix receives them.
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

const listenForHostDismiss = (
  clock: GuardClock,
  setHostClose: (value: boolean) => void,
  cleanups: Array<() => void>,
) => {
  const clearHost = () => setHostClose(false);
  const onHostEvent = () => {
    setHostClose(true);
    const clearId = clock.setTimeout(clearHost, 0);
    cleanups.push(() => clock.clearTimeout(clearId));
  };
  clock.addEventListener("resize", onHostEvent, true);
  clock.addEventListener("blur", onHostEvent, true);
  cleanups.push(() => {
    clock.removeEventListener("resize", onHostEvent, true);
    clock.removeEventListener("blur", onHostEvent, true);
  });
};

/**
 * Radix Select opens on pointerdown, then closes itself on the leftover
 * opening pointer. Ignore that host-side dismiss until a later pointer
 * begins, or until the opening gesture has settled without one (keyboard).
 * Window resize/blur still reach later listeners; the guard only ignores
 * the close Radix would issue from those host events.
 */
export const createSelectDismissGuard = (
  clock: GuardClock = defaultClock(),
): SelectDismissGuard => {
  let ignoreClose = false;
  let hostClose = false;
  const cleanups: Array<() => void> = [];

  const runCleanups = () => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  };

  const disarm = () => {
    ignoreClose = false;
    hostClose = false;
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

    listenForHostDismiss(
      clock,
      (value) => {
        hostClose = value;
      },
      cleanups,
    );
    releaseAfterSettle(clock, () => ignoreClose, release, cleanups);
  };

  return {
    arm,
    disarm,
    shouldIgnoreClose: () => ignoreClose || hostClose,
  };
};
