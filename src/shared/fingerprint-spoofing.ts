/**
 * Deterministic fingerprint spoofing primitives for the "simple" engine.
 *
 * The simple engine does NOT try to replicate another device — it adds subtle,
 * deterministic noise to canvas, WebGL, and audio outputs so that repeated
 * fingerprints from the same session look slightly different from each other
 * and from other browser sessions. This degrades the usefulness of fingerprint
 * hashes without making the page appear overtly patched.
 *
 * Fingerprint spoofing is independent from the geolocation movement runtime.
 */

import type { BrowserFamily } from "@/shared/browser-fingerprint";
import {
  capDeviceMemory,
  resolveHardwareProfile,
  type HardwareArch,
  type HardwarePlatformKey,
} from "@/shared/hardware-profiles";
import {
  BOOLEAN_SURFACE_KEYS,
  FINGERPRINT_SURFACE_KEYS,
  type BooleanSurfaceKey,
  type FingerprintSurfaceKey,
} from "@/shared/spoofing-surfaces";
import type {
  BrowserFingerprint,
  SharedSpoofingConfig,
  FingerprintToggles,
  SurfaceOverrides,
  SharedWorkerHandlingMode,
} from "@/shared/types";

export type SimpleEngineSeedParts = {
  ruleSeedKey: string;
};

// ---------------------------------------------------------------------------
// Deterministic hash (FNV-1a 32-bit)
// ---------------------------------------------------------------------------

export const fnv1a32 = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

// ---------------------------------------------------------------------------
// Seeded PRNG (xorshift32) — lightweight, fast, deterministic
// ---------------------------------------------------------------------------

export const xorshift32 = (seed: number): (() => number) => {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
};

// ---------------------------------------------------------------------------
// Simple-engine noise generation
// ---------------------------------------------------------------------------

/**
 * XOR offset used to derive audio noise seed from canvas noise seed.
 * Arbitrary odd constant ensures canvas and audio PRNG sequences diverge
 * while both remain deterministic from the same base seed.
 */
const SURFACE_SEED_NAMES = {
  audio: "audio",
  canvas: "canvas",
  device: "device",
  screen: "screen",
  webgl: "webgl",
} as const;

type DeviceShape = {
  hardwareConcurrency: number;
  deviceMemory?: number;
};

const CHROMIUM_DEVICE_SHAPES: ReadonlyArray<DeviceShape> = [
  { hardwareConcurrency: 2, deviceMemory: 2 },
  { hardwareConcurrency: 2, deviceMemory: 4 },
  { hardwareConcurrency: 4, deviceMemory: 8 },
  { hardwareConcurrency: 4, deviceMemory: 16 },
  { hardwareConcurrency: 8, deviceMemory: 16 },
  { hardwareConcurrency: 8, deviceMemory: 32 },
  { hardwareConcurrency: 12, deviceMemory: 16 },
  { hardwareConcurrency: 12, deviceMemory: 32 },
  { hardwareConcurrency: 16, deviceMemory: 32 },
];

const FIREFOX_DEVICE_SHAPES: ReadonlyArray<DeviceShape> = [
  { hardwareConcurrency: 4 },
  { hardwareConcurrency: 8 },
  { hardwareConcurrency: 16 },
];

const FALLBACK_DEVICE_SHAPES: ReadonlyArray<DeviceShape> = FIREFOX_DEVICE_SHAPES;

/**
 * Browser families for which Privacy Thing has a verified `navigator.deviceMemory`
 * value pool.
 *
 * Chromium exposes the API through Blink's `NavigatorDeviceMemory` and clamps
 * the approximation in `ApproximatedDeviceMemory`. `kUpdatedDeviceMemoryLimitsFor2026`
 * is enabled by default, so desktop Chromium can expose 16/32 GB; Android remains
 * capped at 8 GB.
 *
 * Firefox does not define `deviceMemory` on `Navigator` or `WorkerNavigator` in
 * WebIDL; adding it there would be a fingerprinting signal.
 *
 * @see https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/frame/navigator_device_memory.cc
 * @see https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/common/device_memory/approximated_device_memory.cc
 * @see https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/webidl/Navigator.webidl
 * @see https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/webidl/WorkerNavigator.webidl
 */
const VERIFIED_MEMORY_VALUES: Partial<Record<BrowserFamily, readonly number[]>> = {
  chromium: [2, 4, 8, 16, 32],
};

export const FINGERPRINT_SEED_VERSION = "fp-v1";
const FP_V1_NAMESPACE = ["geo", "warp"].join("");
const FP_SEED_NAMESPACES = {
  noise: `${FP_V1_NAMESPACE}-fp`,
  surface: `${FP_V1_NAMESPACE}-fp-surface`,
} as const;

export const canSpoofDeviceMemory = (
  browserFamily: BrowserFamily | undefined,
): boolean =>
  browserFamily !== undefined && VERIFIED_MEMORY_VALUES[browserFamily] !== undefined;

/**
 * Creates a deterministic base seed from the explicit rule identity only.
 */
export const createIdentitySeed = (parts: SimpleEngineSeedParts): string =>
  parts.ruleSeedKey.trim().toLowerCase();

/**
 * Creates a deterministic base seed from the explicit rule identity only.
 */
export const createNoiseSeed = (parts: SimpleEngineSeedParts): number =>
  fnv1a32(`${FP_SEED_NAMESPACES.noise}-${createIdentitySeed(parts)}`);

export const deriveSurfaceNoiseSeed = (
  baseSeed: number,
  surface: keyof typeof SURFACE_SEED_NAMES,
): number =>
  fnv1a32(`${FP_SEED_NAMESPACES.surface}-${baseSeed}-${SURFACE_SEED_NAMES[surface]}`);

export const chooseDeviceShape = (
  seed: number,
  browserFamily: BrowserFamily | undefined,
  supportsDeviceMemory: boolean,
): DeviceShape => {
  let shapes = FALLBACK_DEVICE_SHAPES;
  if (browserFamily === "chromium") {
    shapes = CHROMIUM_DEVICE_SHAPES;
  } else if (browserFamily === "firefox") {
    shapes = FIREFOX_DEVICE_SHAPES;
  }
  const shape = shapes[Math.floor(xorshift32(seed)() * shapes.length)] ?? shapes[0]!;
  const verifiedMemoryValues =
    browserFamily === undefined ? undefined : VERIFIED_MEMORY_VALUES[browserFamily];
  const cappedDeviceMemory =
    shape.deviceMemory === undefined ? undefined : capDeviceMemory(shape.deviceMemory);

  if (
    !supportsDeviceMemory ||
    verifiedMemoryValues === undefined ||
    cappedDeviceMemory === undefined ||
    !verifiedMemoryValues.includes(cappedDeviceMemory)
  ) {
    return {
      hardwareConcurrency: shape.hardwareConcurrency,
    };
  }

  return {
    hardwareConcurrency: shape.hardwareConcurrency,
    deviceMemory: cappedDeviceMemory,
  };
};

/**
 * Standard screen dimension sets that look realistic and common.
 * Used by the simple engine when no captured fingerprint is available.
 */
const COMMON_SCREENS: ReadonlyArray<{
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  devicePixelRatio: number;
}> = [
  {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    colorDepth: 24,
    devicePixelRatio: 1,
  },
  {
    width: 2560,
    height: 1440,
    availWidth: 2560,
    availHeight: 1400,
    colorDepth: 24,
    devicePixelRatio: 1,
  },
  {
    width: 1366,
    height: 768,
    availWidth: 1366,
    availHeight: 728,
    colorDepth: 24,
    devicePixelRatio: 1,
  },
  {
    width: 1536,
    height: 864,
    availWidth: 1536,
    availHeight: 824,
    colorDepth: 24,
    devicePixelRatio: 1.25,
  },
  {
    width: 1440,
    height: 900,
    availWidth: 1440,
    availHeight: 875,
    colorDepth: 24,
    devicePixelRatio: 2,
  },
  {
    width: 1680,
    height: 1050,
    availWidth: 1680,
    availHeight: 1010,
    colorDepth: 24,
    devicePixelRatio: 1,
  },
  {
    width: 1920,
    height: 1200,
    availWidth: 1920,
    availHeight: 1160,
    colorDepth: 24,
    devicePixelRatio: 1,
  },
  {
    width: 3840,
    height: 2160,
    availWidth: 3840,
    availHeight: 2120,
    colorDepth: 24,
    devicePixelRatio: 2,
  },
];

/**
 * Common WebGL renderer strings for the simple engine. These represent
 * widely-deployed GPU models that are plausible across many users.
 */
/** @internal Retained for potential capture fallback paths. */
const _COMMON_WEBGL_RENDERERS: ReadonlyArray<{
  renderer: string;
  vendor: string;
}> = [
  {
    renderer: "ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.5)",
    vendor: "Google Inc. (Intel)",
  },
  {
    renderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB, OpenGL 4.5)",
    vendor: "Google Inc. (NVIDIA)",
  },
  {
    renderer: "ANGLE (AMD, AMD Radeon RX 580, OpenGL 4.5)",
    vendor: "Google Inc. (AMD)",
  },
  {
    renderer: "ANGLE (Intel, Intel(R) UHD Graphics 620, OpenGL 4.5)",
    vendor: "Google Inc. (Intel)",
  },
  {
    renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 2060, OpenGL 4.5)",
    vendor: "Google Inc. (NVIDIA)",
  },
  {
    renderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, OpenGL 4.5)",
    vendor: "Google Inc. (Intel)",
  },
];

/**
 * Builds the extended fingerprint fields for the simple engine.
 * Adds canvas/audio noise seeds, a screen profile, and WebGL suppression/readback data.
 */
export type SimpleFpExtrasOptions = {
  baseSeed: number;
  browserFamily: BrowserFamily | undefined;
  supportsDeviceMemory: boolean;
  hostPlatformKey?: HardwarePlatformKey;
  hostArch?: HardwareArch;
};

export const buildSimpleFpExtras = ({
  baseSeed,
  browserFamily,
  supportsDeviceMemory,
  hostPlatformKey,
  hostArch,
}: SimpleFpExtrasOptions): Pick<
  BrowserFingerprint,
  | "audioNoiseSeed"
  | "canvasNoiseSeed"
  | "deviceMemory"
  | "hardwareConcurrency"
  | "maxTouchPoints"
  | "webGL"
  | "screen"
> => {
  const canvasNoiseSeed = deriveSurfaceNoiseSeed(baseSeed, "canvas");
  const audioNoiseSeed = deriveSurfaceNoiseSeed(baseSeed, "audio");
  const screenSeed = deriveSurfaceNoiseSeed(baseSeed, "screen");
  const deviceSeed = deriveSurfaceNoiseSeed(baseSeed, "device");
  const webGLSeed = deriveSurfaceNoiseSeed(baseSeed, "webgl");
  const webGL = {
    suppressDebugInfo: true,
    readPixelsNoiseSeed: webGLSeed,
  } as const;

  // Statistically realistic profile for the host platform/arch. Resolution, CPU and
  // RAM are drawn from local weighted catalogs built from public survey data.
  const screenRng = xorshift32(screenSeed);
  const deviceRng = xorshift32(deviceSeed);
  const hardwareProfile = resolveHardwareProfile({
    platformKey: hostPlatformKey,
    arch: hostArch,
    supportsDeviceMemory,
    rolls: {
      resolution: screenRng(),
      cores: deviceRng(),
      ram: deviceRng(),
      device: screenRng(),
    },
  });

  if (hardwareProfile) {
    return {
      canvasNoiseSeed,
      audioNoiseSeed,
      screen: hardwareProfile.screen,
      webGL,
      hardwareConcurrency: hardwareProfile.hardwareConcurrency,
      maxTouchPoints: hardwareProfile.maxTouchPoints,
      ...(hardwareProfile.deviceMemory !== undefined
        ? { deviceMemory: hardwareProfile.deviceMemory }
        : {}),
    };
  }

  // Fallback for unknown / unmatched hosts: legacy generic shapes. Conservative —
  // never claims a mismatched platform.
  const screenIndex = Math.floor(screenRng() * COMMON_SCREENS.length);
  const chosenScreen = COMMON_SCREENS[screenIndex] ?? COMMON_SCREENS[0]!;
  const deviceShape = chooseDeviceShape(
    deviceSeed,
    browserFamily,
    supportsDeviceMemory,
  );

  return {
    canvasNoiseSeed,
    audioNoiseSeed,
    screen: chosenScreen,
    webGL,
    hardwareConcurrency: deviceShape.hardwareConcurrency,
    ...(deviceShape.deviceMemory !== undefined
      ? { deviceMemory: deviceShape.deviceMemory }
      : {}),
  };
};

/**
 * Merges per-surface spoofing toggles — if `toggles` is absent all surfaces
 * are treated as enabled.
 */
export const resolveSpoofingToggles = (
  toggles: FingerprintToggles | undefined,
): Required<FingerprintToggles> =>
  Object.fromEntries(
    FINGERPRINT_SURFACE_KEYS.map((surface) => [surface, toggles?.[surface] !== false]),
  ) as Required<FingerprintToggles>;

/**
 * Returns the default spoofing toggles (all enabled).
 */
export const defaultSpoofingToggles: Required<FingerprintToggles> = Object.fromEntries(
  FINGERPRINT_SURFACE_KEYS.map((surface) => [surface, true]),
) as Required<FingerprintToggles>;

/**
 * Factory default for the shared spoofing surface switches. Each surface uses
 * its own `defaultEnabled` — every spoofing surface defaults ON, while the
 * Service Worker block surface defaults OFF (its protection has a real cost).
 */
export const defaultSharedSpoofing: SharedSpoofingConfig = {
  ...Object.fromEntries(
    BOOLEAN_SURFACE_KEYS.map((surface) => [surface, surface !== "serviceWorker"]),
  ),
  clientHintsVersionRotation: true,
};

/**
 * Resolves whether Service Worker registration is blocked for a context.
 *
 * Unlike the default-ON spoofing surfaces (where a global `false` is a hard
 * floor — see {@link resolveSurfaceCascade}), the `serviceWorker`
 * protection is a *block* whose default is OFF, and a per-rule override must be
 * able to act as an allow-exception even when the global default blocks.
 * Precedence is therefore override-wins: `override ?? global ?? false`.
 */
export const resolveSwBlocking = (
  sharedSpoofing: SharedSpoofingConfig | undefined,
  ruleOverrides: SurfaceOverrides | undefined,
): boolean => ruleOverrides?.serviceWorker ?? sharedSpoofing?.serviceWorker ?? false;

export const resolveSharedWorkerMode = (
  _sharedSpoofing: SharedSpoofingConfig | undefined,
  ruleOverrides: SurfaceOverrides | undefined,
  preferenceMode: SharedWorkerHandlingMode,
): SharedWorkerHandlingMode => ruleOverrides?.sharedWorker ?? preferenceMode;

/**
 * Surfaces shared between SharedSpoofingConfig and
 * SurfaceOverrides. Used to drive the hierarchical cascade.
 */
const resolveSurfaceCascade = (
  sharedSpoofing: SharedSpoofingConfig | undefined,
  ruleOverrides: SurfaceOverrides | undefined,
  surface: BooleanSurfaceKey,
): boolean => {
  if (sharedSpoofing?.[surface] === false) {
    return false;
  }
  if (ruleOverrides?.[surface] !== undefined) {
    return ruleOverrides[surface];
  }
  return true;
};

/**
 * Resolves per-surface spoofing toggles using shared global controls plus
 * optional rule overrides:
 *
 *  1. **Global surface control** — if `sharedSpoofing[surface]` is `false`,
 *     the surface is disabled globally.
 *  2. **Rule-level override** — if `ruleOverrides[surface]` is explicitly
 *     `true` or `false`, that value wins.
 *  3. **Default** — `true` (surface enabled).
 */
export const resolveRuleToggles = (
  sharedSpoofing: SharedSpoofingConfig | undefined,
  ruleOverrides: SurfaceOverrides | undefined,
): Required<FingerprintToggles> => {
  return Object.fromEntries(
    FINGERPRINT_SURFACE_KEYS.map((surface: FingerprintSurfaceKey) => [
      surface,
      resolveSurfaceCascade(sharedSpoofing, ruleOverrides, surface),
    ]),
  ) as Required<FingerprintToggles>;
};

export const resolveGeoSurface = (
  sharedSpoofing: SharedSpoofingConfig | undefined,
  ruleOverrides: SurfaceOverrides | undefined,
): boolean => {
  if (sharedSpoofing?.geolocation === false) {
    return false;
  }
  if (ruleOverrides?.geolocation !== undefined) {
    return ruleOverrides.geolocation;
  }
  return true;
};

export const resolveTimeLocaleSurface = (
  sharedSpoofing: SharedSpoofingConfig | undefined,
  ruleOverrides: SurfaceOverrides | undefined,
): boolean => resolveSurfaceCascade(sharedSpoofing, ruleOverrides, "timeLocale");
