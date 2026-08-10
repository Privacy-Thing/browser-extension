/**
 * URL hash transport — encodes a JSON payload as base64URL in the fragment.
 *
 * Protocol: `<prefix><base64url(JSON.stringify(payload))>`
 * All build-specific values (prefix) are caller-provided.
 */

import { decodeBase64Url, encodeBase64Url } from "./_base64url";

/**
 * Parses a base64URL-encoded JSON payload from a URL hash string.
 * Returns the raw parsed value, or `null` if the hash does not start with
 * `prefix` or decoding/parsing fails.
 *
 * Does NOT validate the payload shape — the caller is responsible.
 */
export const parseHashTransport = (hash: string, prefix: string): unknown | null => {
  if (!hash.startsWith(prefix)) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(hash.slice(prefix.length))) as unknown;
  } catch {
    return null;
  }
};

/**
 * Serializes a payload to base64URL and prepends the prefix.
 * Returns the full hash string (including the `#` character from the prefix).
 */
export const buildHashTransport = (payload: unknown, prefix: string): string =>
  `${prefix}${encodeBase64Url(JSON.stringify(payload))}`;

/**
 * Restores the URL fragment to the original (pre-transport) hash.
 * Uses `history.replaceState` when available to avoid a navigation entry.
 */
export const restoreOriginalHash = (
  originalHash: string,
  historyRef: Pick<History, "replaceState"> | null | undefined,
): void => {
  if (typeof location === "undefined") {
    return;
  }

  const target =
    originalHash === "" ? location.pathname + location.search : originalHash;
  try {
    historyRef?.replaceState(null, "", target);
  } catch {
    // Cross-origin or sandboxed frame — silent fail.
  }
};
