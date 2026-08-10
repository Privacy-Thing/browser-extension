import { join } from "node:path";

import { describe, it, expect, beforeAll } from "vitest";

import config from "../../api-conformance.config.js";

import { SourceLocator } from "./source-locator.js";

/**
 * Config drift detection: ensures `apiSurfaces` in the conformance config stays
 * in sync with the actual injection source code.
 *
 * Uses SourceLocator to scan all runtime source packages and compares discovered
 * surface names against the config. Fails when:
 *   - A new API surface appears in source but is missing from config
 *   - A config surface has no corresponding patch in source
 *
 * Surfaces that are intentionally excluded (e.g., worker-only contexts that
 * can't be snapshot from a page) are listed in SOURCE_ONLY_SURFACES.
 *
 * When you add a new runtime patch:
 *   1. Run this test → it will tell you which surface is missing from config
 *   2. Add the surface to `apiSurfaces` in `api-conformance.config.ts`
 *   3. OR add it to SOURCE_ONLY_SURFACES if the surface can't be
 *      snapshot from a page context (e.g., WorkerLocation).
 */

// Project root = 4 levels up from this test file
const PROJECT_ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const INJECTION_DIRS = [
  join(PROJECT_ROOT, "src", "injection"),
  join(PROJECT_ROOT, "packages", "refract-core", "src"),
  join(PROJECT_ROOT, "packages", "refract-browser", "src"),
  join(PROJECT_ROOT, "packages", "refract-worker", "src"),
];

/**
 * Surfaces discovered by the locator that are intentionally NOT in the config.
 * Each entry must have a comment explaining why it's excluded.
 */
const SOURCE_ONLY_SURFACES = new Set([
  // date-intl-patch.ts: Object.defineProperty(NativeConstructor.prototype, "resolvedOptions", ...)
  // Generic variable inside patchIntlConstructor() — resolves to "Constructor" after
  // stripping the "Native" prefix. Not a real API surface.
  "Constructor",

  // webrtc-patch.ts: Object.defineProperty(PatchedRTCPeerConnection.prototype, "constructor", ...)
  // Internal variable holding the wrapped RTCPeerConnection constructor — not a separate API surface.
  "PatchedRTCPeerConnection",

  // firefox-date-constructor.ts: Object.defineProperties(SpoofedDate.prototype, ...)
  // Internal `class SpoofedDate extends NativeDate` wrapper. The observable
  // surface is `Date`, which is covered by apiSurfaces separately.
  "SpoofedDate",

  // index.ts + early-runtime.ts: Object.defineProperty(globalThis, "Blob", ...)
  // Not a fingerprinting surface — Blob is intercepted only to capture a worker's
  // JavaScript source at construction so a blob: worker can be inlined (rather than
  // importScripts'd) under a strict CSP. Behavior is otherwise the native Blob.
  "Blob",

  // firefox/early.ts: SharedWorker is only intercepted to announce an
  // identity-preserving response-rewrite candidate before delegating to the
  // native constructor. The spoofed worker globals are validated by worker
  // probes, not page-world constructor conformance.
  "SharedWorker",

  // worker-bootstrap.ts shadows the internal strict-mode SharedWorker name so
  // worker code observes the page-provided name while browser identity remains
  // partitioned by the spoofing profile. This is compatibility bookkeeping, not
  // a fingerprinting surface patch.
  "name",
]);

/**
 * Config surfaces that the regex-based locator can't discover because the
 * target expression uses runtime indirection (e.g., Object.getPrototypeOf(),
 * dynamic variable names, or computed property keys).
 * Each entry must have a comment explaining why the locator misses it.
 */
const CONFIG_ONLY_SURFACES = new Set([
  // battery-status.ts resolves the native manager prototype at runtime from the
  // returned manager; the source scanner cannot infer BatteryManager from it.
  "BatteryManager",

  // client-hints-patch.ts: `const target = Object.getPrototypeOf(userAgentData);`
  // Runtime indirection — regex can't resolve Object.getPrototypeOf() to NavigatorUAData.
  "NavigatorUAData",

  // geo-patch.ts + geo-shim.ts + worker-bootstrap.ts:
  //   `const geolocationTarget = typeof GeolocationConstructor !== "undefined"
  //      ? GeolocationConstructor.prototype : nativeGeolocation;`
  // Variable indirection — regex can't resolve `geolocationTarget`.
  "Geolocation",

  // index.ts + early-runtime.ts + geo-shim.ts:
  //   `const queryTarget = typeof Permissions !== "undefined" ? Permissions.prototype : ...`
  // Variable indirection — regex can't resolve `queryTarget`.
  "Permissions",

  // index.ts: `Object.defineProperty(targetPrototype, "contentWindow", { ... })`
  // Variable `targetPrototype = HTMLIFrameElement.prototype` — regex can't follow
  // variable assignments.
  "HTMLIFrameElement",

  // index.ts: `Object.defineProperties(targetPrototype, { appendChild: ..., insertBefore: ... })`
  // Variable `targetPrototype` reassigned to `Node.prototype` — same limitation.
  "Node",

  // date-intl-patch.ts: `patchIntlConstructor(key, ...)` uses dynamic `key` variable
  // for all 7 non-DateTimeFormat Intl constructors. The regex can't resolve
  // `Object.defineProperty(Intl, key, ...)` when `key` is a variable.
  "Intl.NumberFormat",
  "Intl.Collator",
  "Intl.RelativeTimeFormat",
  "Intl.ListFormat",
  "Intl.DisplayNames",
  "Intl.PluralRules",
  "Intl.Segmenter",

  // webgl-patch.ts: patches `WebGLRenderingContext.prototype` and
  // `WebGL2RenderingContext.prototype` directly inside a helper function —
  // the `proto` parameter indirection prevents the regex from resolving.
  "WebGLRenderingContext",
  "WebGL2RenderingContext",

  // canvas-patch.ts + offscreen-canvas-patch.ts resolve constructors through
  // `targetGlobal` and patch `canvasPrototype` / `contextPrototype` aliases so
  // each iframe uses its own native realm. The locator deliberately does not
  // attempt data-flow analysis through those target-aware aliases.
  "HTMLCanvasElement",
  "CanvasRenderingContext2D",
  "OffscreenCanvas",
  "OffscreenCanvasRenderingContext2D",

  // webrtc-patch.ts: `Object.defineProperty(globalThis, "RTCPeerConnection", ...)`
  // and patches on `NativeRTCPeerConnection.prototype` (aliased variable) —
  // regex can't follow `NativeRTCPeerConnection` variable.
  "RTCPeerConnection",

  // screen-patch.ts: `const screenProto = Object.getPrototypeOf(screen)` —
  // runtime indirection, regex can't resolve.
  "Screen",

  // audio-patch.ts: `const analyserProto = AnalyserNode.prototype` —
  // The locator discovers "AnalyserNode" but the config uses "AnalyserNode.prototype"
  // which normalizes to "AnalyserNode". The locator uses `analyserProto` variable
  // for subsequent defineProperty calls, so the regex can't match those.
  "AnalyserNode",
]);

let discoveredSurfaces: Set<string>;

/**
 * Normalize config surface names to base surface (remove .prototype suffix).
 * e.g., "Date.prototype" → "Date", "Worker" → "Worker"
 */
function normalizeConfigSurfaces(surfaces: string[]): Set<string> {
  const result = new Set<string>();
  for (const s of surfaces) {
    result.add(s.replace(/\.prototype$/, ""));
  }
  return result;
}

beforeAll(() => {
  const locator = new SourceLocator();
  locator.buildIndex(INJECTION_DIRS, PROJECT_ROOT);
  discoveredSurfaces = locator.getDiscoveredSurfaces();
});

describe("config apiSurfaces drift detection", () => {
  it("should discover surfaces from real injection source files", () => {
    // Sanity check: locator must find at least the core surfaces
    expect(discoveredSurfaces.size).toBeGreaterThan(5);
    expect(discoveredSurfaces.has("Date")).toBe(true);
    expect(discoveredSurfaces.has("Navigator")).toBe(true);
    expect(discoveredSurfaces.has("Intl.DateTimeFormat")).toBe(true);
    expect(discoveredSurfaces.has("Function")).toBe(true);
  });

  it("every discovered surface should be in config or known exclusions", () => {
    const configSurfaces = normalizeConfigSurfaces(config.apiSurfaces);
    const uncovered: string[] = [];

    for (const surface of discoveredSurfaces) {
      if (!configSurfaces.has(surface) && !SOURCE_ONLY_SURFACES.has(surface)) {
        uncovered.push(surface);
      }
    }

    expect(
      uncovered,
      `Surfaces found in src/injection/ but missing from apiSurfaces config:\n` +
        `  ${uncovered.join(", ")}\n` +
        `Add them to apiSurfaces in api-conformance.config.ts, or to ` +
        `SOURCE_ONLY_SURFACES in this test if intentionally excluded.`,
    ).toHaveLength(0);
  });

  it("every config surface should be discoverable in source or known gaps", () => {
    const configSurfaces = normalizeConfigSurfaces(config.apiSurfaces);
    const orphaned: string[] = [];

    for (const surface of configSurfaces) {
      if (!discoveredSurfaces.has(surface) && !CONFIG_ONLY_SURFACES.has(surface)) {
        orphaned.push(surface);
      }
    }

    expect(
      orphaned,
      `Surfaces in config but not found in src/injection/ source code:\n` +
        `  ${orphaned.join(", ")}\n` +
        `Either the surface was removed from code (remove from config), ` +
        `or the locator regex doesn't match it (add to CONFIG_ONLY_SURFACES ` +
        `with a comment explaining why).`,
    ).toHaveLength(0);
  });

  it("known exclusion lists should not contain stale entries", () => {
    const configSurfaces = normalizeConfigSurfaces(config.apiSurfaces);

    // SOURCE_ONLY_SURFACES entries must actually be discovered
    for (const surface of SOURCE_ONLY_SURFACES) {
      expect(
        discoveredSurfaces.has(surface),
        `SOURCE_ONLY_SURFACES contains "${surface}" but it was not discovered in source. Remove it.`,
      ).toBe(true);
    }

    // CONFIG_ONLY_SURFACES entries must actually be in config
    for (const surface of CONFIG_ONLY_SURFACES) {
      expect(
        configSurfaces.has(surface),
        `CONFIG_ONLY_SURFACES contains "${surface}" but it's not in config. Remove it.`,
      ).toBe(true);
    }
  });
});
