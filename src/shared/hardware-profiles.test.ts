import { describe, expect, it } from "vitest";

import {
  capDeviceMemory,
  normalizeHardwareArch,
  normalizePlatformKey,
  pickWeighted,
  resolveHardwareProfile,
  type Weighted,
} from "./hardware-profiles";
import { appleHardwareCatalog } from "./hardware-profiles.apple.generated";
import { steamHardwareCatalog } from "./hardware-profiles.steam.generated";

const APPLE_CPU_COMPATIBILITY = {
  "air-13": [8, 10],
  "air-15": [8, 10],
  "pro-14": [10, 11, 12, 14, 16],
  "pro-16": [10, 12, 14, 16],
  "legacy-retina-13": [8, 10],
  "external-display-mac": [8, 10, 12, 14, 16],
} as const;

const APPLE_RAM_COMPATIBILITY = {
  "air-13": [8, 16, 24],
  "air-15": [8, 16, 24],
  "pro-14": [16, 24, 32, 36, 48, 64],
  "pro-16": [16, 24, 32, 36, 48, 64],
  "legacy-retina-13": [8, 16, 24],
  "external-display-mac": [8, 16, 24, 32, 36, 48, 64],
} as const;

describe("pickWeighted", () => {
  const entries: Weighted<string>[] = [
    { value: "a", weight: 0.6 },
    { value: "b", weight: 0.3 },
    { value: "c", weight: 0.1 },
  ];

  it("selects by cumulative weight band", () => {
    expect(pickWeighted(entries, 0)).toBe("a");
    expect(pickWeighted(entries, 0.59)).toBe("a");
    expect(pickWeighted(entries, 0.6)).toBe("b");
    expect(pickWeighted(entries, 0.89)).toBe("b");
    expect(pickWeighted(entries, 0.9)).toBe("c");
  });

  it("is deterministic for a given roll", () => {
    expect(pickWeighted(entries, 0.42)).toBe(pickWeighted(entries, 0.42));
  });

  it("returns the last entry for a roll at the top of the range (rounding remainder)", () => {
    expect(pickWeighted(entries, 0.999999)).toBe("c");
  });

  it("roughly matches the weight distribution over many samples", () => {
    const counts = { a: 0, b: 0, c: 0 };
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      counts[pickWeighted(entries, (i + 0.5) / n) as keyof typeof counts] += 1;
    }
    expect(counts.a / n).toBeCloseTo(0.6, 1);
    expect(counts.b / n).toBeCloseTo(0.3, 1);
    expect(counts.c / n).toBeCloseTo(0.1, 1);
  });
});

describe("capDeviceMemory", () => {
  it("caps physical RAM at the 32 GB desktop Chrome ceiling", () => {
    expect(capDeviceMemory(16)).toBe(16);
    expect(capDeviceMemory(32)).toBe(32);
    expect(capDeviceMemory(64)).toBe(32);
  });

  it("rounds to current desktop Chrome power-of-two buckets", () => {
    expect(capDeviceMemory(8)).toBe(8);
    expect(capDeviceMemory(6)).toBe(4);
    expect(capDeviceMemory(7)).toBe(8);
    expect(capDeviceMemory(4)).toBe(4);
    expect(capDeviceMemory(3)).toBe(2);
    expect(capDeviceMemory(1)).toBe(2);
  });
});

describe("normalizePlatformKey", () => {
  it.each([
    ["Win32", "windows"],
    ["Windows", "windows"],
    ["MacIntel", "mac"],
    ["macOS", "mac"],
    ["Linux x86_64", "linux"],
  ] as const)("maps %s -> %s", (input, expected) => {
    expect(normalizePlatformKey(input)).toBe(expected);
  });

  it("returns undefined for unknown platforms", () => {
    expect(normalizePlatformKey(undefined)).toBeUndefined();
    expect(normalizePlatformKey("Android")).toBeUndefined();
  });
});

describe("normalizeHardwareArch", () => {
  it("recognizes Apple Silicon as arm", () => {
    expect(normalizeHardwareArch("arm")).toBe("arm");
  });

  it("recognizes Intel/x86 hosts", () => {
    expect(normalizeHardwareArch("x86")).toBe("x86");
  });

  it("returns undefined when no Client-Hints architecture is available", () => {
    expect(normalizeHardwareArch(undefined)).toBeUndefined();
    expect(normalizeHardwareArch("")).toBeUndefined();
  });
});

const rolls = (
  overrides: Partial<Record<"resolution" | "cores" | "ram" | "device", number>> = {},
) => ({
  resolution: 0,
  cores: 0,
  ram: 0,
  device: 0,
  ...overrides,
});

describe("resolveHardwareProfile partitioning", () => {
  it("never returns Apple Silicon screen characteristics for a Windows host", () => {
    for (let i = 0; i < 50; i++) {
      const profile = resolveHardwareProfile({
        platformKey: "windows",
        arch: "x86",
        supportsDeviceMemory: true,
        rolls: rolls({ resolution: i / 50, device: i / 50 }),
      });
      expect(profile).toBeDefined();
      expect(profile?.maxTouchPoints).toBe(0);
      expect(profile?.screen.devicePixelRatio).toBe(1);
      expect(profile?.screen.colorDepth).toBe(24);
    }
  });

  it("uses the Mac catalog for macOS hosts regardless of Client Hints architecture", () => {
    for (const arch of ["arm", "x86", undefined] as const) {
      const profile = resolveHardwareProfile({
        platformKey: "mac",
        arch,
        supportsDeviceMemory: true,
        rolls: rolls(),
      });
      expect(profile).toBeDefined();
      expect(profile?.screen.colorDepth).toBeGreaterThanOrEqual(24);
    }
  });

  it("returns undefined for unknown platforms (caller falls back)", () => {
    expect(
      resolveHardwareProfile({
        platformKey: undefined,
        arch: undefined,
        supportsDeviceMemory: true,
        rolls: rolls(),
      }),
    ).toBeUndefined();
  });
});

describe("resolveHardwareProfile coherence and caps", () => {
  it("caps deviceMemory at 32 for every Steam/Apple selection", () => {
    const platforms = ["windows", "linux", "mac"] as const;
    for (const platformKey of platforms) {
      for (let i = 0; i < 50; i++) {
        const r = i / 50;
        const profile = resolveHardwareProfile({
          platformKey,
          arch: "arm",
          supportsDeviceMemory: true,
          rolls: rolls({ resolution: r, cores: r, ram: r, device: r }),
        });
        if (!profile?.deviceMemory) continue;
        expect(profile.deviceMemory).toBeGreaterThanOrEqual(2);
        expect(profile.deviceMemory).toBeLessThanOrEqual(32);
      }
    }
  });

  it("omits deviceMemory when the browser does not support it", () => {
    const profile = resolveHardwareProfile({
      platformKey: "windows",
      arch: undefined,
      supportsDeviceMemory: false,
      rolls: rolls(),
    });
    expect(profile?.deviceMemory).toBeUndefined();
  });

  it("returns an Apple Silicon profile drawn from the macOS Steam catalog", () => {
    const profile = resolveHardwareProfile({
      platformKey: "mac",
      arch: "arm",
      supportsDeviceMemory: true,
      rolls: rolls({ device: 0 }),
    });
    const topBundle = appleHardwareCatalog.devices[0]!.value;
    expect(profile?.screen).toEqual(topBundle.screen);
    expect(profile?.hardwareConcurrency).toBe(topBundle.hardwareConcurrency);
    expect(profile?.maxTouchPoints).toBe(topBundle.maxTouchPoints);
    expect(profile?.deviceMemory).toBe(capDeviceMemory(topBundle.physicalMemoryGb));
  });
});

describe("generated catalog sanity", () => {
  it("Steam weights renormalize to 1 per category", () => {
    for (const key of ["windows", "linux"] as const) {
      const profile = steamHardwareCatalog[key];
      for (const category of [profile.resolutions, profile.cpuCores, profile.ram]) {
        const total = category.reduce((sum, entry) => sum + entry.weight, 0);
        expect(total).toBeCloseTo(1, 5);
      }
    }
  });

  it("Apple bundle weights renormalize to 1", () => {
    const total = appleHardwareCatalog.devices.reduce(
      (sum, entry) => sum + entry.weight,
      0,
    );
    expect(total).toBeCloseTo(1, 5);
  });

  it("Apple bundles preserve Retina/external screen coherence", () => {
    for (const { value } of appleHardwareCatalog.devices) {
      expect(value.screen.availWidth).toBe(value.screen.width);
      expect(value.screen.availHeight).toBe(value.screen.height - 25);
      expect(value.maxTouchPoints).toBe(0);

      if (value.displayClass === "external-display-mac") {
        expect(value.scalingMode).toBe("external");
        expect(value.screen.devicePixelRatio).toBe(1);
        expect(value.nativeWidth).toBe(value.screen.width);
        expect(value.nativeHeight).toBe(value.screen.height);
      } else {
        expect(value.screen.devicePixelRatio).toBe(2);
        expect(value.screen.colorDepth).toBe(30);
        expect(value.nativeWidth).toBeGreaterThanOrEqual(value.screen.width);
        expect(value.nativeHeight).toBeGreaterThanOrEqual(value.screen.height);
      }
    }
  });

  it("Apple bundles satisfy display-class CPU and RAM compatibility rules", () => {
    for (const { value } of appleHardwareCatalog.devices) {
      expect(APPLE_CPU_COMPATIBILITY[value.displayClass]).toContain(
        value.hardwareConcurrency,
      );
      expect(APPLE_RAM_COMPATIBILITY[value.displayClass]).toContain(
        value.physicalMemoryGb,
      );
    }
  });

  it("keeps Apple core counts within the Apple-Silicon-plausible range", () => {
    // Relaxed arch gating means any macOS host can draw a Mac bundle, so the catalog
    // must not contain desktop-Xeon/Ultra-tier core counts that read as non-Apple-Silicon.
    for (const { value } of appleHardwareCatalog.devices) {
      expect(value.hardwareConcurrency).toBeLessThanOrEqual(16);
    }
  });
});
