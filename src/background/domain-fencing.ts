/**
 * Domain fencing — deterministic per-site variation of generated fingerprint
 * values for the Default Rule and container identities.
 *
 * The model is a pure derivation chain, owned by the background resolver:
 *
 *   fenceBaseKey  = h(ruleSeedKey)                  — background-only, opaque
 *   fencedSeedKey = h(fenceBaseKey, siteKey)        — 6-char base36, same shape
 *                                                     as a regular ruleSeedKey
 *
 * `siteKey` is the registrable domain (eTLD+1) of the frame's hostname, so all
 * subdomains of one site share one fenced identity while unrelated sites get
 * uncorrelated values.
 *
 * Hostname-aware channels rebuild the snapshot from `fencedSeedKey` (noise,
 * hardware selection, and version rotation). Shared multi-domain carriers
 * (`"*"` preload / Firefox catalog) keep the unfenced Default Rule fingerprint
 * as baseline spoofing — they are never mutated to a site's fenced identity.
 * More specific `*<siteKey>` rows reuse the background cache so a later visit
 * can install the per-site variation.
 *
 * This module is background- and test-only. Injected page, worker, and content
 * graphs must not import it.
 */

import { getDomain } from "tldts";

import { fnv1a32 } from "@/shared/fingerprint-seeds";

export const DOMAIN_FENCING_VERSION = "df1";

const FENCE_NAMESPACE = `pt-${DOMAIN_FENCING_VERSION}`;
const RULE_SEED_LENGTH = 6;
const RULE_SEED_SPACE = 36 ** RULE_SEED_LENGTH;

/**
 * URL hostname normalization also canonicalizes IDN and IP literals. This accepts
 * hostnames only: URL syntax, credentials and ports must never create a partition.
 * Invalid input returns an empty key, leaving the shared template unfenced.
 */
const normalizeHostname = (hostname: string): string => {
  const input = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!input || /[\s/@?#\\]/.test(input)) return "";
  if (input.includes(":") && !(input.startsWith("[") && input.endsWith("]"))) {
    return "";
  }
  try {
    const normalized = new URL(`http://${input}/`).hostname;
    return normalized.split(".").some((label) => !label) ? "" : normalized;
  } catch {
    return "";
  }
};

/**
 * Bundled PSL includes ICANN, PRIVATE, wildcard and exception rules. IPs,
 * localhost names and bare suffixes keep their full normalized hostname.
 * Keep df1 derivation: only corrected partition boundaries rotate identities.
 */
export const getSiteKey = (hostname: string): string => {
  const normalized = normalizeHostname(hostname);
  if (!normalized || normalized.endsWith(".localhost")) return normalized;
  return (
    getDomain(normalized, {
      allowPrivateDomains: true,
      extractHostname: false,
    }) ?? normalized
  );
};

/**
 * Apex-and-subdomains pattern for a fenced cache row. More specific than
 * shared `"*"`, so Firefox seed matching prefers it without mutating `"*"`.
 */
export const toFencePattern = (siteKey: string): string => `*${siteKey}`;

/**
 * Derives the opaque per-identity fence key used as the parent of per-site
 * seeds. One-way: never expose the raw `ruleSeedKey`.
 */
export const deriveFenceBaseKey = (ruleSeedKey: string): string => {
  const normalized = ruleSeedKey.trim().toLowerCase();
  const high = fnv1a32(`${FENCE_NAMESPACE}-base-a-${normalized}`);
  const low = fnv1a32(`${FENCE_NAMESPACE}-base-b-${normalized}`);
  return `${high.toString(36)}-${low.toString(36)}`;
};

/**
 * Derives the per-site seed key. The result has the exact shape of a regular
 * `ruleSeedKey` (6 chars, base36) so it flows through the existing snapshot
 * builders — noise seeds, hardware selection, and version rotation — unchanged.
 */
export const deriveFencedSeedKey = (fenceBaseKey: string, siteKey: string): string =>
  (fnv1a32(`${FENCE_NAMESPACE}-${fenceBaseKey}-${siteKey}`) % RULE_SEED_SPACE)
    .toString(36)
    .padStart(RULE_SEED_LENGTH, "0");
