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

/**
 * The popup host can emit resize and blur while a Select is opening. They are
 * host chrome events, not user dismissals, so keep them away from Radix until
 * the standard Select has closed again.
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
