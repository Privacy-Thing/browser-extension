/**
 * window.name transport — encodes a JSON payload as base64URL in window.name.
 *
 * Protocol: `<prefix><base64url(JSON.stringify(payload))>`
 * The payload structure (including any `buildKey`, `previousName`, or data
 * fields) is entirely caller-defined.
 */

import { decodeBase64Url, encodeBase64Url } from "./_base64url";

/**
 * Parses a base64URL-encoded JSON payload from a window.name string.
 * Returns the raw parsed value, or `null` if the value does not start with
 * `prefix` or decoding/parsing fails.
 *
 * Does NOT validate the payload shape — the caller is responsible.
 */
export const parseWindowNameTransport = (
  value: string,
  prefix: string,
): unknown | null => {
  if (!value.startsWith(prefix)) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(value.slice(prefix.length))) as unknown;
  } catch {
    return null;
  }
};

/**
 * Serializes a payload to base64URL and prepends the prefix.
 */
export const buildWindowNameTransport = (payload: unknown, prefix: string): string =>
  `${prefix}${encodeBase64Url(JSON.stringify(payload))}`;
