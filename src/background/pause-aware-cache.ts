import type {
  SnapshotCacheInput,
  SnapshotCacheEntry,
} from "@/background/effective-snapshot-cache";
import type { ResolutionDecision } from "@/background/prepared-runtime-decisions";
import { getHostPause } from "@/background/storage/host-protection-pauses";
import type { HostProtectionPause } from "@/shared/host-protection-pause";
import type { RuntimeSnapshot } from "@/shared/types";

// In-flight navigation work can finish after a pause clears the cache. Apply
// the current top-host exception at both cache boundaries, not just resolution.
export const bindSnapshotCache = (
  cache: {
    removeTab: (tabId: number) => void;
    set: (input: {
      tabId: number;
      frameId: number;
      hostname: string;
      decision: ResolutionDecision;
      cookieStoreId?: string;
    }) => void;
    read: (input: SnapshotCacheInput) => RuntimeSnapshot | null | undefined;
    readDecision: (input: SnapshotCacheInput) => ResolutionDecision | undefined;
    readTopDecision: (tabId: number) => ResolutionDecision | undefined;
    readTopEntry: (tabId: number) => SnapshotCacheEntry | undefined;
  },
  resolvePause: (hostname: string) => HostProtectionPause | undefined = getHostPause,
) => {
  const applyPause = (
    decision: ResolutionDecision,
    hostname: string,
  ): ResolutionDecision | undefined => {
    const pause = resolvePause(hostname);
    if (pause && !decision.trustedSiteMatched)
      return { snapshot: null, trustedSiteMatched: false, hostPause: pause };
    if (decision.hostPause && decision.hostPause.id !== pause?.id) return undefined;
    return decision;
  };
  const updateSnapshotCache = (input: {
    tabId: number;
    frameId: number;
    hostname: string;
    value: ResolutionDecision | RuntimeSnapshot | null;
    cookieStoreId?: string;
  }): void => {
    const { value, ...cacheKey } = input;
    const decision =
      value && typeof value === "object" && "trustedSiteMatched" in value
        ? value
        : { snapshot: value, trustedSiteMatched: false };
    const topHostname =
      input.frameId === 0
        ? input.hostname
        : (cache.readTopEntry(input.tabId)?.hostname ?? decision.hostPause?.hostname);
    const current = topHostname ? applyPause(decision, topHostname) : decision;
    if (current) cache.set({ ...cacheKey, decision: current });
  };
  const readDecisionCache = (
    tabId: number,
    frameId: number,
    hostname: string,
    cookieStoreId?: string,
  ): ResolutionDecision | undefined => {
    const decision = cache.readDecision({
      tabId,
      frameId,
      hostname,
      ...(cookieStoreId ? { cookieStoreId } : {}),
    });
    if (!decision) return undefined;
    const topHostname =
      frameId === 0
        ? hostname
        : (cache.readTopEntry(tabId)?.hostname ?? decision.hostPause?.hostname);
    const current = topHostname ? applyPause(decision, topHostname) : decision;
    if (!current) cache.removeTab(tabId);
    return current;
  };
  const readSnapshotCache = (
    tabId: number,
    frameId: number,
    hostname: string,
    cookieStoreId?: string,
  ) => readDecisionCache(tabId, frameId, hostname, cookieStoreId)?.snapshot;
  const readTopEntry = (tabId: number) => {
    const entry = cache.readTopEntry(tabId);
    if (!entry) {
      return undefined;
    }
    const decision = applyPause(entry.decision, entry.hostname);
    if (!decision) {
      cache.removeTab(tabId);
      return undefined;
    }
    return {
      hostname: entry.hostname,
      decision,
      ...(entry.cookieStoreId ? { cookieStoreId: entry.cookieStoreId } : {}),
    };
  };
  const readTopDecision = (tabId: number) => readTopEntry(tabId)?.decision;
  return {
    updateSnapshotCache,
    readSnapshotCache,
    readDecisionCache,
    readTopDecision,
    readTopEntry,
  };
};
