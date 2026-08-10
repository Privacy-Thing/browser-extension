import type { RuntimeSnapshot } from "@/shared/types";

export const SNAPSHOT_CACHE_TTL_MS = 5 * 60 * 1_000;

export type ResolutionDecision = {
  snapshot: RuntimeSnapshot | null;
  trustedSiteMatched: boolean;
};

export type SnapshotCacheEntry = {
  hostname: string;
  cookieStoreId?: string;
  decision: ResolutionDecision;
  cachedAt: number;
};

export type SnapshotCacheInput = {
  tabId: number;
  frameId: number;
  hostname: string;
  cookieStoreId?: string;
  now?: number;
};

export type SnapshotCacheWrite = SnapshotCacheInput & {
  decision: ResolutionDecision;
};

const getSnapshotCacheKey = (tabId: number, frameId: number): string =>
  `${tabId}:${frameId}`;

export const createSnapshotCache = (ttlMs = SNAPSHOT_CACHE_TTL_MS) => {
  const entries = new Map<string, SnapshotCacheEntry>();

  const clear = (): void => {
    entries.clear();
  };

  const set = ({
    tabId,
    frameId,
    hostname,
    decision,
    cookieStoreId,
    now = Date.now(),
  }: SnapshotCacheWrite): void => {
    entries.set(getSnapshotCacheKey(tabId, frameId), {
      hostname,
      ...(cookieStoreId ? { cookieStoreId } : {}),
      decision,
      cachedAt: now,
    });
  };

  const readDecision = ({
    tabId,
    frameId,
    hostname,
    cookieStoreId,
    now = Date.now(),
  }: SnapshotCacheInput): ResolutionDecision | undefined => {
    const key = getSnapshotCacheKey(tabId, frameId);
    const entry = entries.get(key);
    if (!entry) {
      return undefined;
    }

    const expired = now - entry.cachedAt > ttlMs;
    const hostnameMismatch = entry.hostname !== hostname;
    const cookieStoreMismatch = entry.cookieStoreId !== cookieStoreId;

    if (expired || hostnameMismatch || cookieStoreMismatch) {
      entries.delete(key);
      return undefined;
    }

    return entry.decision;
  };

  const read = (input: SnapshotCacheInput): RuntimeSnapshot | null | undefined =>
    readDecision(input)?.snapshot;

  const readEntry = (tabId: number, frameId: number): SnapshotCacheEntry | undefined =>
    entries.get(getSnapshotCacheKey(tabId, frameId));

  const removeTab = (tabId: number): void => {
    for (const key of entries.keys()) {
      if (key.startsWith(`${tabId}:`)) {
        entries.delete(key);
      }
    }
  };

  return {
    clear,
    read,
    readDecision,
    readEntry,
    removeTab,
    set,
  };
};
