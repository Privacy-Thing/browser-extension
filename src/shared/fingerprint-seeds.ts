/**
 * Deterministic seed primitives for the simple fingerprint engine.
 *
 * This is a dependency-light leaf module: it must stay importable from
 * injected page-world code (Chromium main runtime, Firefox early shim)
 * without dragging the generated hardware/version catalogs into those
 * bundles. Catalog-dependent selection stays in `fingerprint-spoofing.ts`.
 */

export type SimpleEngineSeedParts = {
  ruleSeedKey: string;
};

export const fnv1a32 = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const xorshift32 = (seed: number): (() => number) => {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
};

export const SURFACE_SEED_NAMES = {
  audio: "audio",
  canvas: "canvas",
  device: "device",
  screen: "screen",
  webgl: "webgl",
} as const;

export type SurfaceSeedName = keyof typeof SURFACE_SEED_NAMES;

export const FINGERPRINT_SEED_VERSION = "fp-v1";
const FP_V1_NAMESPACE = ["geo", "warp"].join("");
export const FP_SEED_NAMESPACES = {
  noise: `${FP_V1_NAMESPACE}-fp`,
  surface: `${FP_V1_NAMESPACE}-fp-surface`,
} as const;

/**
 * Normalized rule identity used as the input to noise hashing.
 */
export const createIdentitySeed = (parts: SimpleEngineSeedParts): string =>
  parts.ruleSeedKey.trim().toLowerCase();

export const createNoiseSeed = (parts: SimpleEngineSeedParts): number =>
  fnv1a32(`${FP_SEED_NAMESPACES.noise}-${createIdentitySeed(parts)}`);

export const deriveSurfaceNoiseSeed = (
  baseSeed: number,
  surface: SurfaceSeedName,
): number =>
  fnv1a32(`${FP_SEED_NAMESPACES.surface}-${baseSeed}-${SURFACE_SEED_NAMES[surface]}`);
