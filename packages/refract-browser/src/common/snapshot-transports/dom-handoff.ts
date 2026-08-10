/**
 * DOM handoff transport — stores a JSON payload in a `<script type="application/json">`
 * element tagged with a per-build marker attribute.
 *
 * The element is meant to be short-lived: the reader removes it after consumption,
 * leaving zero persistent DOM artifacts.
 */

import { setScriptPayload } from "../runtime-config";

/**
 * Reads and removes the first DOM handoff element matching the marker attribute.
 * Returns the raw parsed JSON value, or `null` if the element is absent or malformed.
 * The element is removed only when parsing succeeds.
 */
export const readAndRemoveDomHandoff = (
  documentRef: Document,
  markerAttr: string,
): unknown | null => {
  const element = documentRef.querySelector(
    `script[type="application/json"][data-${markerAttr}]`,
  );

  const content =
    element?.textContent || element?.getAttribute(__PT_RUNTIME_PAYLOAD_ATTR__);
  if (!element || !content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    element.remove();
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Reads the DOM handoff element content without removing it.
 * Returns the raw parsed JSON value, or `null` if the element is absent or malformed.
 */
export const readDomHandoff = (
  documentRef: Document,
  markerAttr: string,
): unknown | null => {
  const element = documentRef.querySelector(
    `script[type="application/json"][data-${markerAttr}]`,
  );

  const content =
    element?.textContent || element?.getAttribute(__PT_RUNTIME_PAYLOAD_ATTR__);
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
};

/** Removes the DOM handoff element if present. */
export const removeDomHandoff = (documentRef: Document, markerAttr: string): void => {
  documentRef
    .querySelector(`script[type="application/json"][data-${markerAttr}]`)
    ?.remove();
};

/**
 * Injects a DOM handoff element into `<head>` (falling back to `<html>`).
 * Removes any existing element with the same marker attribute before writing,
 * so stale seeds from prior navigations do not accumulate.
 */
export const writeDomHandoff = (
  documentRef: Document,
  payload: unknown,
  markerAttr: string,
): void => {
  const root = documentRef.head ?? documentRef.documentElement;
  if (!root) {
    return;
  }

  documentRef
    .querySelector(`script[type="application/json"][data-${markerAttr}]`)
    ?.remove();

  const script = documentRef.createElement("script");
  script.type = "application/json";
  script.setAttribute(`data-${markerAttr}`, "");
  setScriptPayload(script, JSON.stringify(payload));
  root.prepend(script);
};
