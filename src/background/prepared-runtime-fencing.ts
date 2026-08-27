import type { DomainFencingRequest } from "@/background/rules/resolver-options";
import { getSiteKey, toFencePattern } from "@/shared/domain-fencing";
import type { FeatureFlags } from "@/shared/feature-flags";
import type { ContainerAssignment, RuntimeSnapshot } from "@/shared/types";

type FencingFlagSource = {
  featureFlags: FeatureFlags;
};

export type FencedIdentity =
  { kind: "fallback" } | { kind: "container"; assignment: ContainerAssignment };

/** Per-site fenced snapshot memo cap for one prepared-decisions instance. */
export const FENCE_SNAP_CACHE_CAP = 100;

export type FenceSnapRow = {
  pattern: string;
  snapshot: RuntimeSnapshot;
};

export type StarFenceEntry = {
  pattern: string;
  blockServiceWorkerRegistration: boolean;
  snapshot: RuntimeSnapshot;
};

type StarEntryInput = {
  fallback: RuntimeSnapshot | null;
  fencingOn: boolean;
  cache: Map<string, RuntimeSnapshot | null>;
  cookieStoreId?: string;
  finalize: (snapshot: RuntimeSnapshot) => RuntimeSnapshot | null;
};

/**
 * Fencing request for fallback/container snapshot builds. Templates (no
 * hostname) keep the unfenced identity fingerprint. Per-hostname rebuilds
 * derive the fenced seed in the background on every target. Domain-rule
 * snapshots never pass this.
 */
export const toFencingRequest = (
  inputs: FencingFlagSource,
  hostname?: string,
): DomainFencingRequest | undefined =>
  inputs.featureFlags.domainFencing && hostname
    ? { hostname }
    : undefined;

export const fencesPreparedIdentity = (
  inputs: FencingFlagSource,
  kind: "rule" | "container" | "fallback",
): boolean =>
  Boolean(inputs.featureFlags.domainFencing) &&
  (kind === "container" || kind === "fallback");

type FenceDecisionInput = {
  template: RuntimeSnapshot | null;
  hostname: string;
  identity: FencedIdentity;
  domainFencingEnabled: boolean;
  cache: Map<string, RuntimeSnapshot | null>;
  rebuild: (identity: FencedIdentity, hostname: string) => RuntimeSnapshot | null;
};

/**
 * Lists cached host-fenced snapshots as apex-and-subdomains patterns.
 * Fallback rows use `f|<siteKey>`; container rows use `c|<store>|<siteKey>`.
 */
export const listFenceSnaps = (
  cache: Map<string, RuntimeSnapshot | null>,
  cookieStoreId?: string,
): FenceSnapRow[] => {
  const prefix = cookieStoreId === undefined ? "f|" : `c|${cookieStoreId}|`;
  const rows: FenceSnapRow[] = [];
  for (const [key, snapshot] of cache) {
    if (!snapshot?.fingerprint || !key.startsWith(prefix)) {
      continue;
    }
    const siteKey = key.slice(prefix.length);
    if (!siteKey) {
      continue;
    }
    rows.push({ pattern: toFencePattern(siteKey), snapshot });
  }
  return rows;
};

/**
 * Shared `"*"` template plus cached `*<siteKey>` rows. Container catalogs
 * must pass `cookieStoreId` so they never reuse fallback (`f|`) identities.
 *
 * Cached fence rows are independent of the Default Rule template. A
 * container-only setup has no `"*"` carrier; dropping those rows would leave
 * Firefox on the unfenced `containerState` baseline.
 */
export const buildStarEntries = ({
  fallback,
  fencingOn,
  cache,
  cookieStoreId,
  finalize,
}: StarEntryInput): StarFenceEntry[] => {
  const entries: StarFenceEntry[] = [];
  const seen = new Set<string>();
  if (fallback) {
    const snapshot = finalize(fallback) ?? fallback;
    entries.push({
      pattern: "*",
      blockServiceWorkerRegistration: snapshot.blockServiceWorkerRegistration ?? false,
      snapshot,
    });
    seen.add("*");
  }
  if (!fencingOn) {
    return entries;
  }
  for (const row of listFenceSnaps(cache, cookieStoreId)) {
    if (seen.has(row.pattern)) {
      continue;
    }
    const snap = finalize(row.snapshot) ?? row.snapshot;
    entries.push({
      pattern: row.pattern,
      blockServiceWorkerRegistration: snap.blockServiceWorkerRegistration ?? false,
      snapshot: snap,
    });
    seen.add(row.pattern);
  }
  return entries;
};

/**
 * Hostname-aware fencing for fallback/container decisions: rebuild from the
 * fenced seed (noise, hardware selection, and version rotation) on every
 * target. Shared `"*"` templates keep the unfenced identity and are never
 * mutated to a site's fenced fingerprint.
 */
export const fenceDecisionSnapshot = ({
  template,
  hostname,
  identity,
  domainFencingEnabled,
  cache,
  rebuild,
}: FenceDecisionInput): RuntimeSnapshot | null => {
  if (!template || !domainFencingEnabled) {
    return template;
  }

  const siteKey = getSiteKey(hostname);
  if (!siteKey) {
    return template;
  }

  const cacheKey =
    identity.kind === "fallback"
      ? `f|${siteKey}`
      : `c|${identity.assignment.cookieStoreId}|${siteKey}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey) ?? null;
    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    return cached;
  }

  const snapshot = rebuild(identity, hostname);
  if (cache.size >= FENCE_SNAP_CACHE_CAP) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(cacheKey, snapshot);
  return snapshot;
};
