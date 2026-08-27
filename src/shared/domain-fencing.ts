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
 * (`"*"` preload / Firefox catalog) omit generated fingerprint fields instead
 * of carrying a page-visible marker. More specific `*<siteKey>` rows reuse the
 * background cache so a later visit can still install a finished snapshot.
 *
 * This module is background- and test-only. Injected page, worker, and content
 * graphs must not import it.
 */

import { fnv1a32 } from "@/shared/fingerprint-seeds";

export const DOMAIN_FENCING_VERSION = "df1";

const FENCE_NAMESPACE = `pt-${DOMAIN_FENCING_VERSION}`;
const RULE_SEED_LENGTH = 6;
const RULE_SEED_SPACE = 36 ** RULE_SEED_LENGTH;

/**
 * Second-level tokens that, under a two-letter TLD, form a multi-label
 * registrable suffix (`co.uk`, `com.au`). Not a full PSL; unknown combos
 * degrade to a two-label site key.
 */
const CC_TLD_SLD = new Set(
  "ac|ad|asn|biz|co|com|ed|edu|firm|gen|geek|go|gob|gov|govt|gr|gv|id|idv|in|ind|info|lg|ltd|me|med|muni|my|ne|net|nic|nom|or|org|pe|plc|re|res|sch|school|web".split(
    "|",
  ),
);

/**
 * Private / CentralNic suffixes whose tenants are distinct sites. These are
 * not ccTLD+SLD pairs, so the two-letter TLD heuristic cannot recover them.
 */
const PRIVATE_SUFFIXES = new Set(
  "uk.com|uk.net|us.com|eu.com|github.io|gitlab.io|blogspot.com|appspot.com|herokuapp.com|netlify.app|vercel.app|web.app|firebaseapp.com|azurewebsites.net|cloudfunctions.net|pages.dev|workers.dev|wordpress.com|neocities.org|readthedocs.io|onrender.com|fly.dev|glitch.me|codesandbox.io".split(
    "|",
  ),
);

const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Returns the registrable domain (eTLD+1) used as the fencing partition key.
 * IP literals, single-label hosts, and empty hostnames are returned as-is.
 */
export const getSiteKey = (hostname: string): string => {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (normalized === "" || normalized.includes(":") || IPV4_PATTERN.test(normalized)) {
    return normalized;
  }

  const labels = normalized.split(".");
  if (labels.length <= 2) {
    return normalized;
  }

  const lastTwo = labels.slice(-2).join(".");
  const sld = labels[labels.length - 2];
  const tld = labels[labels.length - 1];
  const ccTldSld =
    typeof sld === "string" &&
    typeof tld === "string" &&
    tld.length === 2 &&
    CC_TLD_SLD.has(sld);
  return labels.slice(PRIVATE_SUFFIXES.has(lastTwo) || ccTldSld ? -3 : -2).join(".");
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
