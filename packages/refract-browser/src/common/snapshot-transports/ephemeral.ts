/**
 * Ephemeral CustomEvent transport — delivers a JSON payload via a
 * `CustomEvent` dispatched on `document`.
 *
 * Used for late-convergence state updates after the DOM handoff element has
 * already been consumed. The event name is a per-build randomized identifier
 * so page scripts cannot intercept or forge it.
 */

/**
 * Extracts and parses the JSON detail from a CustomEvent dispatched by the
 * transport. Returns `null` when the event is not a CustomEvent, the detail
 * is not a JSON string, or parsing fails.
 */
export const parseEphemeralTransport = (event: Event): unknown | null => {
  if (!(event instanceof CustomEvent)) {
    return null;
  }

  const detail = event.detail as unknown;
  if (typeof detail !== "string") {
    return null;
  }

  try {
    return JSON.parse(detail) as unknown;
  } catch {
    return null;
  }
};

/**
 * Dispatches a CustomEvent with a JSON-stringified `detail` on the given
 * document. Listeners registered with `addEventListener(eventName, ...)` will
 * receive it; page scripts cannot observe it unless they know the event name.
 */
export const dispatchEphemeral = (
  documentRef: Document,
  eventName: string,
  payload: unknown,
): void => {
  documentRef.dispatchEvent(
    new CustomEvent(eventName, {
      detail: JSON.stringify(payload),
      bubbles: true,
      composed: true,
    }),
  );
};
