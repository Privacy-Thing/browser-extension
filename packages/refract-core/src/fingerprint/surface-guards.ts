import type { FingerprintToggles, RuntimeSnapshot } from "../types/snapshot";

export type FingerprintSurface = keyof FingerprintToggles;

export function isFpSurfaceEnabled(
  fingerprint: RuntimeSnapshot["fingerprint"] | null | undefined,
  surface: FingerprintSurface,
): boolean {
  return fingerprint?.spoofingToggles?.[surface] !== false;
}

const IS_FP_SURFACE_SOURCE = [
  "function isFpSurfaceEnabled(fingerprint, surface) {",
  "  return fingerprint?.spoofingToggles?.[surface] !== false;",
  "}",
].join("\n");

export const FP_SURFACE_GUARDS_SOURCE = `${IS_FP_SURFACE_SOURCE};`;
