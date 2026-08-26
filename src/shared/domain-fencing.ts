/**
 * Domain fencing — deterministic per-site variation of generated fingerprint
 * values for the Default Rule and container identities.
 *
 * The model is a pure derivation chain:
 *
 *   fenceBaseKey  = h(ruleSeedKey)                  — background-only, opaque
 *   fencedSeedKey = h(fenceBaseKey, siteKey)        — 6-char base36, same shape
 *                                                     as a regular ruleSeedKey
 *
 * `siteKey` is the registrable domain (eTLD+1) of the frame's hostname, so all
 * subdomains of one site share one fenced identity while unrelated sites get
 * uncorrelated values.
 *
 * Delivery channels that are resolved per hostname in the background build the
 * snapshot directly from `fencedSeedKey`. Shared multi-domain carriers
 * (Chromium session preload `"*"`, Firefox `window.name` catalog and static
 * payload) instead carry a `fencing: { key: fenceBaseKey }` marker inside the
 * fingerprint; the consuming realm finalizes the noise seeds for its own
 * hostname via {@link applyFencedNoiseSeeds} and strips the marker. The raw
 * `ruleSeedKey` never travels in page-visible carriers.
 *
 * This module must stay importable from injected page-world code: it depends
 * only on the `fingerprint-seeds` leaf module (FNV-1a hashing), never on the
 * generated hardware/version catalogs.
 */

import {
  createNoiseSeed,
  deriveSurfaceNoiseSeed,
  fnv1a32,
} from "@/shared/fingerprint-seeds";
import type { BrowserFingerprint } from "@/shared/fingerprint-types";
import type { RuntimeSnapshot } from "@/shared/types";

/** Marker carried by shared multi-domain snapshot carriers. */
export type FingerprintFencing = {
  /** Opaque per-identity fence key derived from (never equal to) the rule seed. */
  key: string;
};

export const DOMAIN_FENCING_VERSION = "df1";

const FENCE_NAMESPACE = `pt-${DOMAIN_FENCING_VERSION}`;
const RULE_SEED_LENGTH = 6;
const RULE_SEED_SPACE = 36 ** RULE_SEED_LENGTH;

/**
 * Compact list of common multi-label registrable suffixes ("public suffixes").
 * Not a full PSL (payload cost); exotic suffixes degrade gracefully to a
 * slightly coarser site key, which is an accepted experiment trade-off.
 */
const MULTI_LABEL_SUFFIXES = new Set<string>([
  // ccTLD second-level registrations
  ...["co", "org", "ac", "gov", "me", "net", "ltd", "plc", "sch"].map(
    (label) => `${label}.uk`,
  ),
  ...["com", "net", "org", "edu", "gov", "id", "asn"].map((label) => `${label}.au`),
  ...["co", "net", "org", "govt", "ac", "gen", "geek", "school"].map(
    (label) => `${label}.nz`,
  ),
  ...["co", "ne", "or", "ac", "ad", "ed", "go", "gr", "lg"].map(
    (label) => `${label}.jp`,
  ),
  ...["co", "ne", "or", "re", "go", "ac", "pe"].map((label) => `${label}.kr`),
  ...["com", "net", "org", "gov", "edu", "ac"].map((label) => `${label}.cn`),
  ...["com", "net", "org", "edu", "gov", "idv"].map((label) => `${label}.hk`),
  ...["com", "net", "org", "edu", "gov", "idv"].map((label) => `${label}.tw`),
  ...["com", "net", "org", "gov", "edu"].map((label) => `${label}.br`),
  ...["com", "org", "net", "gob", "edu"].map((label) => `${label}.mx`),
  ...["com", "net", "org", "gob", "edu"].map((label) => `${label}.ar`),
  ...["co", "net", "org", "firm", "gen", "ind", "nic", "ac", "edu", "res", "gov"].map(
    (label) => `${label}.in`,
  ),
  ...["com", "net", "org", "gov", "edu"].map((label) => `${label}.tr`),
  ...["co", "net", "org", "gov", "edu", "ac", "web"].map((label) => `${label}.za`),
  ...["com", "net", "org", "edu", "gov"].map((label) => `${label}.sg`),
  ...["com", "net", "org", "edu", "gov"].map((label) => `${label}.my`),
  ...["com", "net", "org", "edu", "gov"].map((label) => `${label}.ph`),
  ...["com", "net", "org", "edu", "gov"].map((label) => `${label}.vn`),
  ...["co", "or", "ac", "go", "web", "my"].map((label) => `${label}.id`),
  ...["co", "in", "or", "ac", "go", "net"].map((label) => `${label}.th`),
  ...["com", "net", "org", "edu", "gov", "info", "biz"].map((label) => `${label}.pl`),
  ...["com", "net", "org", "edu", "gov", "in"].map((label) => `${label}.ua`),
  ...["co", "org", "net", "ac", "gov", "muni"].map((label) => `${label}.il`),
  ...["com", "net", "org", "edu", "gov", "med", "sch"].map((label) => `${label}.sa`),
  ...["com", "net", "org", "edu", "gov"].map((label) => `${label}.eg`),
  ...["com", "net", "org", "edu", "gov"].map((label) => `${label}.ng`),
  ...["co", "or", "ne", "go", "ac"].map((label) => `${label}.ke`),
  ...["com", "net", "org", "edu", "gov"].map((label) => `${label}.bd`),
  ...["com", "net", "org", "edu", "gov"].map((label) => `${label}.pk`),
  ...["com", "net", "org", "edu", "gob"].map((label) => `${label}.pe`),
  ...["com", "net", "org", "edu", "gov"].map((label) => `${label}.co`),
  ...["co", "or", "gv", "ac"].map((label) => `${label}.at`),
  ...["com", "nom", "org", "gob", "edu"].map((label) => `${label}.es`),
  ...["com", "net", "org", "edu", "gov"].map((label) => `${label}.gr`),
  ...["com", "edu", "gov", "org", "net"].map((label) => `${label}.pt`),
  // CentralNic-style commercial suffixes
  "uk.com",
  "uk.net",
  "us.com",
  "eu.com",
  // Popular hosting platforms (private suffixes): distinct tenants are
  // distinct parties, so they must not share one fenced identity.
  "github.io",
  "gitlab.io",
  "blogspot.com",
  "appspot.com",
  "herokuapp.com",
  "netlify.app",
  "vercel.app",
  "web.app",
  "firebaseapp.com",
  "azurewebsites.net",
  "cloudfunctions.net",
  "pages.dev",
  "workers.dev",
  "wordpress.com",
  "neocities.org",
  "readthedocs.io",
  "onrender.com",
  "fly.dev",
  "glitch.me",
  "codesandbox.io",
]);

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
  const registrableLabelCount = MULTI_LABEL_SUFFIXES.has(lastTwo) ? 3 : 2;
  return labels.slice(-registrableLabelCount).join(".");
};

/**
 * Derives the opaque per-identity fence key carried by shared snapshot
 * carriers. One-way: carriers must never expose the raw `ruleSeedKey`.
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

/**
 * Finalizes a fencing marker for one site: recomputes the canvas / audio /
 * WebGL-readback noise seeds from the fenced seed key and strips the marker.
 *
 * The derivation intentionally matches the background rebuild path
 * (`createNoiseSeed(fencedSeedKey)` → `deriveSurfaceNoiseSeed`), so every
 * delivery channel converges on identical per-site noise values.
 * Catalog-driven fields (screen, hardware, version rotation) are left at the
 * carried values — realms cannot re-run catalog selection.
 */
export const applyFencedNoiseSeeds = (
  fingerprint: BrowserFingerprint,
  siteKey: string,
): BrowserFingerprint => {
  const { fencing, ...rest } = fingerprint;
  if (!fencing) {
    return fingerprint;
  }

  const fencedSeedKey = deriveFencedSeedKey(fencing.key, siteKey);
  const baseSeed = createNoiseSeed({ ruleSeedKey: fencedSeedKey });
  return {
    ...rest,
    ...(typeof rest.canvasNoiseSeed === "number"
      ? { canvasNoiseSeed: deriveSurfaceNoiseSeed(baseSeed, "canvas") }
      : {}),
    ...(typeof rest.audioNoiseSeed === "number"
      ? { audioNoiseSeed: deriveSurfaceNoiseSeed(baseSeed, "audio") }
      : {}),
    ...(rest.webGL && typeof rest.webGL.readPixelsNoiseSeed === "number"
      ? {
          webGL: {
            ...rest.webGL,
            readPixelsNoiseSeed: deriveSurfaceNoiseSeed(baseSeed, "webgl"),
          },
        }
      : {}),
  };
};

/**
 * Snapshot-level convenience wrapper around {@link applyFencedNoiseSeeds}.
 * No-op for snapshots without a fencing marker.
 */
export const applySnapshotFencing = (
  snapshot: RuntimeSnapshot,
  hostname: string,
): RuntimeSnapshot =>
  snapshot.fingerprint?.fencing
    ? {
        ...snapshot,
        fingerprint: applyFencedNoiseSeeds(snapshot.fingerprint, getSiteKey(hostname)),
      }
    : snapshot;
