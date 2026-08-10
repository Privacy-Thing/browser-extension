/**
 * Runtime message transport — type contract for the chrome.runtime.sendMessage
 * request/response used as the async fallback when synchronous channels miss.
 *
 * The actual send/receive logic lives in the content bootstrap layer because
 * it requires chrome.runtime APIs that are not available in this package.
 */

export type RuntimeSnapshotRequest = {
  type: "pt:resolve-runtime-snapshot";
  hostname: string;
};

export type RuntimeSnapshotResponse<S> =
  { found: true; snapshot: S } | { found: false };
