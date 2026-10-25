/**
 * Size ceilings for injected bundles. Tests import these constants.
 *
 * Comment the current contract (what the bundle is, what must stay out of
 * it). Do not append a raise-by-raise history — git already has that.
 */

/**
 * Slack on top of each ceiling so identifier hashing and CI toolchain
 * jitter (tens of bytes) do not fail the gate. Keep this well below a
 * feature-sized change. Tests assert `BUDGET + BUNDLE_SIZE_TOLERANCE`.
 */
export const BUNDLE_SIZE_TOLERANCE = 256;

/**
 * Chromium isolated-world content bootstrap (uncompressed).
 *
 * Must not pull profile resolution, generated catalogs, or domain-fencing
 * suffix tables. Fencing is finished in the background; injected graphs
 * only install the snapshot they receive. The Inspector allocation covers its
 * optional snapshot shape, the session check for the tab-aware resolver and the
 * isolated endpoint registry that receives live trap bindings.
 */
export const CHROME_BOOT_MAX_BYTES = 17 * 1024 + 256;

/** Gzip companion of {@link CHROME_BOOT_MAX_BYTES}. */
export const CHROME_BOOT_GZIP_BYTES = Math.round(6.3 * 1024);

/**
 * Firefox first-inline page runtime (`main-world-early.js`).
 *
 * This is the full early runtime, not a geo-only shim: it embeds the
 * compressed worker payload so a Worker constructed during the
 * pre-bootstrap race is patched. Put new spoofing in `refract-core`
 * instead of adding a second copy of adapters here.
 *
 * Includes the selective Inspector binding, its private live endpoint, retained
 * pause, and neutral debug map.
 */
export const FX_GEO_SHIM_MAX_BYTES = 135 * 1024;

/**
 * Firefox main-world runtime (`main-world-runtime.js`), including the
 * inlined worker source and exact-host pause/deadline transport. Preserve
 * a hard ceiling while allowing
 * per-build obfuscated identifier variance via
 * {@link BUNDLE_SIZE_TOLERANCE}.
 */
export const FX_MAIN_WORLD_MAX_BYTES = 169 * 1024 + 512;

/**
 * Inspector bundles retain debugger statements and neutral inline ignore maps
 * with fixed DevTools text for the stop frame (about 320 B per bundle).
 * Their ceilings include that bounded diagnostic payload; the disabled emitter
 * still executes the original function without a trap check.
 *
 * Chromium first-inline script. It blocks the first page-JS read, so keep
 * it to config handoff, the Temporal early installer and its Inspector
 * endpoint with the parent-owned realm check — not the full fingerprint runtime.
 */
export const CHROME_EARLY_MAX_BYTES = 14 * 1024 + 768;

/**
 * Chromium main-world runtime, including the inlined worker source and the
 * Inspector selection taken from the commit-time delivery. Per-build identifiers
 * vary the size of the same graph by about 200 B.
 */
export const CHROME_RUNTIME_MAX_BYTES = 192 * 1024 + 768;
