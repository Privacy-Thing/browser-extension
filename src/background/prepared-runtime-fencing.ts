import type { DomainFencingRequest } from "@/background/rules/resolver-options";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { getSiteKey } from "@/shared/domain-fencing";
import type { FeatureFlags } from "@/shared/feature-flags";
import type { ContainerAssignment, RuntimeSnapshot } from "@/shared/types";

type FencingFlagSource = {
  featureFlags: FeatureFlags;
};

export type FencedIdentity =
  { kind: "fallback" } | { kind: "container"; assignment: ContainerAssignment };

/** Per-site fenced snapshot memo cap for one prepared-decisions instance. */
export const FENCE_SNAP_CACHE_CAP = 100;

/**
 * Fencing request for fallback/container snapshot builds. Templates (no
 * hostname) carry a realm-finalizable marker; per-hostname rebuilds derive the
 * fenced seed directly on Chromium. Domain-rule snapshots never pass this.
 */
export const toFencingRequest = (
  inputs: FencingFlagSource,
  hostname?: string,
): DomainFencingRequest | undefined =>
  inputs.featureFlags.domainFencing
    ? { ...(hostname === undefined ? {} : { hostname }) }
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
 * Chromium finalization for fallback/container decisions: per-navigation
 * channels are background-resolved per hostname, so the snapshot is rebuilt
 * from the fenced seed (noise, hardware selection, and version rotation all
 * fenced) instead of carrying the marker forward. Firefox keeps the marker
 * template untouched — all of its delivery channels converge in the page
 * realm, where only noise seeds are fenced.
 */
export const fenceDecisionSnapshot = ({
  template,
  hostname,
  identity,
  domainFencingEnabled,
  cache,
  rebuild,
}: FenceDecisionInput): RuntimeSnapshot | null => {
  if (!template || !domainFencingEnabled || BUILD_BROWSER_TARGET !== "chromium") {
    return template;
  }

  const siteKey = getSiteKey(hostname);
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
