export type PopupSelectDismissGuard = {
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
 * Radix Select always closes on window `resize` and `blur`. In the extension
 * popup those events come from host chrome (sidecar sizing, Helium focus),
 * not from the user dismissing the menu. Swallow them for the whole open
 * lifetime so a delayed host event cannot close the menu after the opening
 * pointer has settled.
 */
export const lockPopupSelectHostDismiss = (
  host: HostEventTarget = window,
): (() => void) => {
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
 * opening pointer. Ignore that host-side dismiss until the opening gesture
 * has settled.
 */
export const createPopupSelectDismissGuard = (
  clock: GuardClock = defaultClock(),
): PopupSelectDismissGuard => {
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

  const arm = () => {
    disarm();
    ignoreClose = true;

    let pointerHeld = true;
    let settleFrame = 0;

    const maybeRelease = () => {
      if (pointerHeld) return;
      clock.cancelAnimationFrame(settleFrame);
      settleFrame = clock.requestAnimationFrame(() => {
        settleFrame = clock.requestAnimationFrame(() => {
          if (!pointerHeld) ignoreClose = false;
        });
      });
    };

    const onGestureEnd = () => {
      clock.removeEventListener("pointerup", onGestureEnd, true);
      clock.removeEventListener("pointercancel", onGestureEnd, true);

      const finishPointer = () => {
        pointerHeld = false;
        maybeRelease();
      };
      const onClick = () => {
        clock.removeEventListener("click", onClick, true);
        const settleId = clock.setTimeout(finishPointer, OPENING_SETTLE_MS);
        cleanups.push(() => clock.clearTimeout(settleId));
      };
      clock.addEventListener("click", onClick, true);
      cleanups.push(() => clock.removeEventListener("click", onClick, true));
      const timeoutId = clock.setTimeout(finishPointer, OPENING_SETTLE_MS);
      cleanups.push(() => clock.clearTimeout(timeoutId));
    };

    clock.addEventListener("pointerup", onGestureEnd, true);
    clock.addEventListener("pointercancel", onGestureEnd, true);

    cleanups.push(() => {
      clock.removeEventListener("pointerup", onGestureEnd, true);
      clock.removeEventListener("pointercancel", onGestureEnd, true);
      clock.cancelAnimationFrame(settleFrame);
    });
  };

  return {
    arm,
    disarm,
    shouldIgnoreClose: () => ignoreClose,
  };
};
