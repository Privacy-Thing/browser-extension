/**
 * Chromium bootstrap adapter for Refract Runtime.
 *
 * Implements the target priority order for MAIN world bootstrap:
 *
 * Early path (synchronous reads — used by early-inline runtime):
 *   1. Hash transport  (window.name seed)
 *   2. DOM Handoff     (script[type="application/json"] element)
 *
 * Regular path (asynchronous — used by content bootstrap after onCommitted):
 *   1. DOM Handoff     (priority on regular path)
 *   2. Hash transport  (synchronous fallback)
 *   3. Runtime message (chrome.runtime.sendMessage, bounded by timeout)
 *
 * Spec references:
 *   §1.7 DOM Handoff: minimal trace, cleanup after install, no persistent markers.
 *   §1.8 Runtime message: must have timeout + failure fallback, must not block.
 *   §1.13 Target priority order: MAIN world early path / regular path.
 *
 * The adapter is intentionally snapshot-type-agnostic: callers inject readers
 * that return whatever snapshot type the calling layer uses.  This avoids
 * coupling the adapter to a specific schema version.
 */

export type ChromiumSnapshotChannel =
  "hash" | "dom-handoff" | "runtime-message" | "miss";

export type ChromiumResolution<S> = {
  snapshot: S | null;
  channel: ChromiumSnapshotChannel;
};

export type ChromiumEarlyReaders<S> = {
  /** Reads the window.name seed (hash transport). */
  readHashSnapshot: () => S | null;
  /** Reads the DOM handoff element without removing it. */
  readDomHandoffSnapshot: () => S | null;
};

export type ChromiumAdapterDeps<S> = ChromiumEarlyReaders<S> & {
  /** Removes the DOM handoff element after it has been consumed. */
  cleanupDomHandoff: () => void;
  /** Sends a background message to resolve the snapshot; must reject/resolve within timeoutMs. */
  resolveBgSnapshot: (hostname: string) => Promise<S | null>;
  /** Timeout in milliseconds for the runtime message fallback. Default: 1000. */
  runtimeMessageTimeoutMs?: number;
};

/**
 * Reads the synchronously available snapshot using the early-path priority:
 *   1. Hash transport
 *   2. DOM Handoff
 *
 * Does NOT remove the DOM element — the content bootstrap regular path also
 * needs to consume it.
 */
export const readEarlySnapshot = <S>(
  readers: ChromiumEarlyReaders<S>,
): ChromiumResolution<S> => {
  const hashSnapshot = readers.readHashSnapshot();
  if (hashSnapshot) {
    return { snapshot: hashSnapshot, channel: "hash" };
  }

  const domSnapshot = readers.readDomHandoffSnapshot();
  if (domSnapshot) {
    return { snapshot: domSnapshot, channel: "dom-handoff" };
  }

  return { snapshot: null, channel: "miss" };
};

/**
 * Resolves the bootstrap snapshot for the regular (async content) path.
 *
 * Priority order:
 *   1. DOM Handoff — synchronous, preferred on regular path; element is
 *      removed after consumption (spec §1.7: cleanup-after-install).
 *   2. Hash transport — synchronous fallback.
 *   3. Runtime message — async background fallback, bounded by timeout
 *      (spec §1.8: must have timeout + must not block without limit).
 */
export const resolveChromiumSnapshot = async <S>(
  hostname: string,
  deps: ChromiumAdapterDeps<S>,
): Promise<ChromiumResolution<S>> => {
  const { runtimeMessageTimeoutMs = 1_000 } = deps;

  // 1. DOM Handoff
  const domSnapshot = deps.readDomHandoffSnapshot();
  if (domSnapshot) {
    deps.cleanupDomHandoff();
    return { snapshot: domSnapshot, channel: "dom-handoff" };
  }

  // 2. Hash transport
  const hashSnapshot = deps.readHashSnapshot();
  if (hashSnapshot) {
    return { snapshot: hashSnapshot, channel: "hash" };
  }

  // 3. Runtime message — mandatory timeout, rejection treated as miss
  const backgroundSnapshot = await withTimeout(
    deps.resolveBgSnapshot(hostname),
    runtimeMessageTimeoutMs,
  ).catch(() => null);

  if (backgroundSnapshot) {
    return { snapshot: backgroundSnapshot, channel: "runtime-message" };
  }

  return { snapshot: null, channel: "miss" };
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | null> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race<T | null>([
      promise,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};
