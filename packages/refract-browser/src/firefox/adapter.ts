/**
 * Firefox bootstrap adapter for Refract Runtime.
 *
 * Implements the target priority order for Firefox content bootstrap:
 *   1. Preloaded state (chrome.storage.session preload cache)
 *   2. Runtime message fallback (chrome.runtime.sendMessage, bounded by timeout)
 *
 * It also handles query of Firefox userScripts readiness.
 */

export type FirefoxSnapshotChannel =
  "preloaded-state" | "background-message" | "background-fallback-miss";

export type FxSnapshotResolution<S> = {
  snapshot: S | null;
  channel: FirefoxSnapshotChannel;
};

export type FxUserScriptsReady = {
  hasPermission: boolean;
  registrationCount: number;
  lastSyncSucceeded: boolean;
  ready: boolean;
};

export type FirefoxAdapterDeps<S> = {
  /** Reads the preseeded runtime snapshot cache from session storage. */
  readPreloadedState: () => Promise<any | null>;
  /** Resolves a hostname against the preloaded cache. */
  resolvePreloadedSnapshot: (hostname: string, state: any | null) => S | null;
  /** Sends a background message to resolve the snapshot. */
  resolveBgSnapshot: (hostname: string) => Promise<S | null>;
  /** Timeout in milliseconds for the runtime message fallback. Default: 1000. */
  runtimeMessageTimeoutMs?: number;
  /** Queries the user script readiness status from the background. */
  queryUserScriptsReady: () => Promise<FxUserScriptsReady>;
};

/**
 * Resolves the bootstrap snapshot for the Firefox content script path.
 *
 * Priority order:
 *   1. Preloaded state — check session storage preloaded state
 *   2. Runtime message — async background fallback, bounded by timeout
 */
export const resolveFirefoxSnapshot = async <S>(
  hostname: string,
  deps: FirefoxAdapterDeps<S>,
): Promise<FxSnapshotResolution<S>> => {
  const { runtimeMessageTimeoutMs = 1_000 } = deps;

  // 1. Preloaded state
  const preloadedState = await deps.readPreloadedState();
  const preloadedSnapshot = deps.resolvePreloadedSnapshot(hostname, preloadedState);
  if (preloadedSnapshot) {
    return {
      snapshot: preloadedSnapshot,
      channel: "preloaded-state",
    };
  }

  // 2. Runtime message fallback
  const backgroundSnapshot = await withTimeout(
    deps.resolveBgSnapshot(hostname),
    runtimeMessageTimeoutMs,
  ).catch(() => null);

  if (backgroundSnapshot) {
    return {
      snapshot: backgroundSnapshot,
      channel: "background-message",
    };
  }

  return {
    snapshot: null,
    channel: "background-fallback-miss",
  };
};

/**
 * Checks the Firefox userScripts launch mechanism readiness status.
 */
export const checkFxUserScriptsReady = async (
  deps: Pick<FirefoxAdapterDeps<any>, "queryUserScriptsReady">,
): Promise<FxUserScriptsReady> => {
  return deps.queryUserScriptsReady();
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
