/**
 * Statistically realistic hardware profiles for the simple spoofing engine.
 *
 * Instead of picking screen / CPU / RAM uniformly from small hand-written lists,
 * the engine samples from weighted distributions derived from public datasets and
 * shipped locally as generated data:
 *
 *  - Windows / Linux: Steam Hardware & Software Survey marginal distributions
 *    (`hardware-profiles.steam.generated.ts`).
 *  - Apple Silicon Macs: synthetic coherent bundles from Steam Hardware &
 *    Software Survey macOS marginals constrained by display/scaling rules
 *    (`hardware-profiles.apple.generated.ts`).
 *
 * Hard invariant: selection NEVER changes the host OS platform. The catalog is
 * partitioned by host platform; Mac bundles are returned for macOS hosts. When the
 * host platform cannot be matched, the caller falls back to the legacy generic shapes.
 *
 * This module is a leaf: it owns only types, the pure weighted picker, and the
 * data-driven selection. The PRNG / seed derivation lives in `fingerprint-spoofing.ts`,
 * which feeds pre-derived rolls in to keep this module free of import cycles.
 */

import { appleHardwareCatalog } from "./hardware-profiles.apple.generated";
import { steamHardwareCatalog } from "./hardware-profiles.steam.generated";

export type Weighted<T> = { value: T; weight: number };

export type ScreenResolution = { width: number; height: number };

/** Browser-reported screen configuration (CSS pixels, not native panel pixels). */
export type ScreenConfig = {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  devicePixelRatio: number;
};

export type SteamPlatformProfile = {
  resolutions: readonly Weighted<ScreenResolution>[];
  cpuCores: readonly Weighted<number>[];
  ram: readonly Weighted<number>[];
};

export type SteamHardwareKey = "windows" | "linux";

export type SteamHardwareCatalog = Readonly<
  Record<SteamHardwareKey, SteamPlatformProfile>
>;

export type AppleDisplayClass =
  | "air-13"
  | "air-15"
  | "pro-14"
  | "pro-16"
  | "legacy-retina-13"
  | "external-display-mac";

export type AppleScalingMode = "default" | "more-space" | "larger-text" | "external";

export type AppleDeviceBundle = {
  screen: ScreenConfig;
  hardwareConcurrency: number;
  physicalMemoryGb: number;
  maxTouchPoints: number;
  displayClass: AppleDisplayClass;
  scalingMode: AppleScalingMode;
  nativeWidth: number;
  nativeHeight: number;
};

export type AppleHardwareCatalog = {
  devices: readonly Weighted<AppleDeviceBundle>[];
  marginals: SteamPlatformProfile;
};

export type HardwarePlatformKey = "windows" | "linux" | "mac";

/** CPU architecture as surfaced by Client Hints; retained for future catalog splits. */
export type HardwareArch = "arm" | "x86" | undefined;

/** Maps `navigator.platform` / Client-Hints platform strings to a catalog partition. */
export const normalizePlatformKey = (
  platform: string | undefined,
): HardwarePlatformKey | undefined => {
  if (!platform) return undefined;
  const lower = platform.toLowerCase();
  if (lower === "windows" || lower.startsWith("win")) return "windows";
  if (lower === "macos" || lower === "mac os x" || lower.startsWith("mac"))
    return "mac";
  if (lower.startsWith("linux") || lower.includes("x11")) return "linux";
  return undefined;
};

/** Maps a Client-Hints `architecture` value ("arm"/"x86"/…) to a coarse arch class. */
export const normalizeHardwareArch = (
  architecture: string | undefined,
): HardwareArch => {
  if (!architecture) return undefined;
  const lower = architecture.toLowerCase();
  if (lower.includes("arm")) return "arm";
  if (lower.includes("x86") || lower.includes("amd64") || lower.includes("intel"))
    return "x86";
  return undefined;
};

export type HardwareProfile = {
  screen: ScreenConfig;
  hardwareConcurrency: number;
  deviceMemory?: number;
  maxTouchPoints: number;
};

/**
 * Privacy Thing's current desktop Chromium-compatible device-memory bucket.
 *
 * Chromium computes `navigator.deviceMemory` in `ApproximatedDeviceMemory`: it
 * rounds physical RAM to the nearest power-of-two GiB bucket and clamps the result.
 * `kUpdatedDeviceMemoryLimitsFor2026` is enabled by default, so non-Android
 * Chromium exposes 2/4/8/16/32 GB. Android remains capped at 8 GB, but extension
 * runtime support is desktop-only here.
 *
 * @see https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/frame/navigator_device_memory.cc
 * @see https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/common/device_memory/approximated_device_memory.cc
 * @see https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/common/features.cc
 */
export const DEVICE_MEMORY_CAP_GB = 32;
export const DEVICE_MEMORY_MIN_GB = 2;
const DEVICE_MEMORY_STEPS = [2, 4, 8, 16, 32] as const;

export const capDeviceMemory = (ramGb: number): number => {
  const clamped = Math.min(Math.max(ramGb, DEVICE_MEMORY_MIN_GB), DEVICE_MEMORY_CAP_GB);
  let result: number = DEVICE_MEMORY_STEPS[0];
  let bestDistance = Math.abs(clamped - result);
  for (const step of DEVICE_MEMORY_STEPS) {
    const distance = Math.abs(clamped - step);
    if (distance < bestDistance) {
      result = step;
      bestDistance = distance;
    }
  }
  return result;
};

/**
 * Deterministic weighted choice. `roll` must be in [0, 1) (e.g. from a seeded PRNG).
 * Weights are expected to sum to ~1; the final entry catches any rounding remainder.
 */
export const pickWeighted = <T>(entries: readonly Weighted<T>[], roll: number): T => {
  if (entries.length === 0) {
    throw new Error("pickWeighted: empty distribution");
  }
  let cumulative = 0;
  for (const entry of entries) {
    cumulative += entry.weight;
    if (roll < cumulative) return entry.value;
  }
  return entries[entries.length - 1]!.value;
};

const OS_RESERVED_AVAIL_HEIGHT: Record<"windows" | "linux", number> = {
  windows: 48, // taskbar
  linux: 32, // top panel
};

const deriveDesktopScreen = (
  resolution: ScreenResolution,
  platformKey: "windows" | "linux",
): ScreenConfig => ({
  width: resolution.width,
  height: resolution.height,
  availWidth: resolution.width,
  availHeight: Math.max(resolution.height - OS_RESERVED_AVAIL_HEIGHT[platformKey], 0),
  colorDepth: 24,
  devicePixelRatio: 1,
});

export type HardwareProfileRolls = {
  /** Resolution selection roll, [0, 1). */
  resolution: number;
  /** CPU core selection roll, [0, 1). */
  cores: number;
  /** System RAM selection roll, [0, 1). */
  ram: number;
  /** Reserved Apple selection roll, [0, 1), retained for seed-shape stability. */
  device: number;
};

export type HardwareProfileArgs = {
  platformKey: HardwarePlatformKey | undefined;
  arch: HardwareArch;
  supportsDeviceMemory: boolean;
  rolls: HardwareProfileRolls;
};

/**
 * Selects a statistically realistic hardware profile for the host platform, or
 * `undefined` when no partition matches (caller falls back to legacy shapes).
 *
 * - windows / linux: independent weighted draws of resolution, cores and RAM
 *   (Steam publishes marginals — independence is faithful to the source).
 * - mac: one generated coherent bundle for any matched macOS host.
 */
export const resolveHardwareProfile = ({
  platformKey,
  supportsDeviceMemory,
  rolls,
}: HardwareProfileArgs): HardwareProfile | undefined => {
  if (platformKey === "mac") {
    const devices = appleHardwareCatalog.devices;
    if (devices.length === 0) return undefined;
    const bundle = pickWeighted(devices, rolls.device);
    return {
      screen: bundle.screen,
      hardwareConcurrency: bundle.hardwareConcurrency,
      maxTouchPoints: bundle.maxTouchPoints,
      ...(supportsDeviceMemory
        ? { deviceMemory: capDeviceMemory(bundle.physicalMemoryGb) }
        : {}),
    };
  }

  if (platformKey === "windows" || platformKey === "linux") {
    const profile = steamHardwareCatalog[platformKey];
    const resolution = pickWeighted(profile.resolutions, rolls.resolution);
    const cores = pickWeighted(profile.cpuCores, rolls.cores);
    const ramGb = pickWeighted(profile.ram, rolls.ram);
    return {
      screen: deriveDesktopScreen(resolution, platformKey),
      hardwareConcurrency: cores,
      maxTouchPoints: 0,
      ...(supportsDeviceMemory ? { deviceMemory: capDeviceMemory(ramGb) } : {}),
    };
  }

  return undefined;
};
