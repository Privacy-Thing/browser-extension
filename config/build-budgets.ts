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
 * only install the snapshot they receive.
 */
export const CHROME_BOOT_MAX_BYTES = 15 * 1024;

/** Gzip companion of {@link CHROME_BOOT_MAX_BYTES}. */
export const CHROME_BOOT_GZIP_BYTES = Math.round(5.2 * 1024);

/**
 * Firefox first-inline page runtime (`main-world-early.js`).
 *
 * This is the full early runtime, not a geo-only shim: it embeds the
 * compressed worker payload so a Worker constructed during the
 * pre-bootstrap race is patched. Put new spoofing in `refract-core`
 * instead of adding a second copy of adapters here.
 */
export const FX_GEO_SHIM_MAX_BYTES = 133 * 1024;

/**
 * Firefox main-world runtime (`main-world-runtime.js`), including the
 * inlined worker source. Preserve a hard ceiling while allowing
 * per-build obfuscated identifier variance via
 * {@link BUNDLE_SIZE_TOLERANCE}.
 */
export const FX_MAIN_WORLD_MAX_BYTES = 168 * 1024;

/**
 * Chromium first-inline script. It blocks the first page-JS read, so keep
 * it to config handoff and the Temporal early installer — not the full
 * fingerprint runtime.
 */
export const CHROME_EARLY_MAX_BYTES = 12 * 1024;

/**
 * Chromium main-world runtime, including the inlined worker source.
 */
export const CHROME_RUNTIME_MAX_BYTES = 191 * 1024;
