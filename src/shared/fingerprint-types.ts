import type { BooleanSurfaceKey, FingerprintSurfaceKey } from "./spoofing-surfaces.js";

/**
 * Browser fingerprint- and client-hints-related contracts shared between
 * background resolution, injected runtimes, and diagnostics surfaces.
 */

export type BrowserClientHintBrand = {
  brand: string;
  version: string;
};

export type BrowserClientHints = {
  brands?: BrowserClientHintBrand[];
  fullVersionList?: BrowserClientHintBrand[];
  platform?: string;
  platformVersion?: string;
  mobile?: boolean;
  architecture?: string;
  bitness?: string;
  model?: string;
  formFactors?: string[];
  wow64?: boolean;
  /** Spoofed device memory exposed via `getHighEntropyValues(['deviceMemory'])`. */
  deviceMemory?: number;
};

/**
 * Per-surface spoofing toggle flags. When a field is `false` the corresponding
 * surface is left unpatched even when fingerprint data is present.
 */
export type FingerprintToggles = Partial<
  Record<FingerprintSurfaceKey, boolean | undefined>
>;

export const SHARED_WORKER_MODES = ["native", "spoof", "strict"] as const;

export type SharedWorkerHandlingMode = (typeof SHARED_WORKER_MODES)[number];

export const isSharedWorkerMode = (value: unknown): value is SharedWorkerHandlingMode =>
  typeof value === "string" &&
  (SHARED_WORKER_MODES as readonly string[]).includes(value);

export const normalizeWorkerMode = (
  value: unknown,
  legacyCompatibilityMode?: unknown,
): SharedWorkerHandlingMode => {
  if (isSharedWorkerMode(value)) {
    return value;
  }

  if (legacyCompatibilityMode === false) {
    return "spoof";
  }

  if (legacyCompatibilityMode === true) {
    return "native";
  }

  return "strict";
};

/**
 * Global per-surface spoofing switches.
 * Controls which fingerprint surfaces are eligible for spoofing across
 * the entire extension. Individual surface keys default to `true` when absent.
 */
export type SharedSpoofingConfig = {
  readonly [K in BooleanSurfaceKey]?: boolean | undefined;
} & {
  /** Keeps native Chromium version numbers instead of fuzzing UA/CH versions. */
  readonly clientHintsVersionRotation?: boolean | undefined;
  /** SharedWorker handling policy. Absent means inherit the global preference. */
  readonly sharedWorker?: SharedWorkerHandlingMode | undefined;
};

export type LegacySpoofingInput = SharedSpoofingConfig & {
  readonly enabled?: boolean | undefined;
};

/**
 * Per-rule surface overrides. Each key is tri-state:
 * - `true`  → force-enable this surface for this rule
 * - `false` → force-disable this surface for this rule
 * - absent  → inherit from the shared global spoofing defaults
 */
export type SurfaceOverrides = {
  readonly [K in BooleanSurfaceKey]?: boolean | undefined;
} & {
  /** SharedWorker handling policy override for this rule/container. */
  readonly sharedWorker?: SharedWorkerHandlingMode | undefined;
};

export type BrowserFingerprint = {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  maxTouchPoints?: number;
  platform?: string;
  userAgent?: string;
  vendor?: string;
  appVersion?: string;
  clientHints?: BrowserClientHints;
  /** Deterministic canvas noise seed for simple engine anti-fingerprinting. */
  canvasNoiseSeed?: number;
  /** WebGL renderer/vendor spoof values or extension suppression. */
  webGL?:
    | {
        renderer?: string | undefined;
        vendor?: string | undefined;
        /** Suppress WEBGL_debug_renderer_info extension instead of spoofing strings. */
        suppressDebugInfo?: boolean | undefined;
        /** Deterministic seed for `readPixels()` readback perturbation. */
        readPixelsNoiseSeed?: number | undefined;
      }
    | undefined;
  /** Deterministic audio noise seed for simple engine anti-fingerprinting. */
  audioNoiseSeed?: number | undefined;
  /** Spoofed screen dimensions / properties. */
  screen?:
    | {
        width?: number | undefined;
        height?: number | undefined;
        availWidth?: number | undefined;
        availHeight?: number | undefined;
        colorDepth?: number | undefined;
        pixelDepth?: number | undefined;
        devicePixelRatio?: number | undefined;
      }
    | undefined;
  /** Per-surface on/off switches — absent means all enabled. */
  spoofingToggles?: FingerprintToggles | undefined;
};

/**
 * Browser fingerprint snapshot collected for local inspection. Contains only
 * browser properties — no coordinates, file paths, or user-specific data.
 */
export type CapturedFingerprint = {
  canvasHash: string | null;
  webGL: {
    renderer: string | null;
    vendor: string | null;
    /** Compact hash of a small WebGL `readPixels()` probe used in diagnostics. */
    readPixelsHash?: string | null;
  };
  audioHash: string | null;
  navigator: {
    userAgent: string;
    platform: string;
    hardwareConcurrency: number;
    deviceMemory: number | null;
    languages: readonly string[];
    maxTouchPoints: number;
  };
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelDepth: number;
    devicePixelRatio: number;
  };
  clientHints: {
    platform: string | null;
    platformVersion: string | null;
    architecture: string | null;
    bitness: string | null;
    mobile: boolean | null;
    model: string | null;
    brands: Array<{ brand: string; version: string }>;
    fullVersionList: Array<{ brand: string; version: string }>;
  } | null;
  collectedAt: string;
};
