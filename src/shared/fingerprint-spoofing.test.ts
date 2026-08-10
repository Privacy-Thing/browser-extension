import { describe, it, expect } from "vitest";

import {
  createIdentitySeed,
  FINGERPRINT_SEED_VERSION,
  fnv1a32,
  xorshift32,
  createNoiseSeed,
  buildSimpleFpExtras,
  chooseDeviceShape,
  deriveSurfaceNoiseSeed,
  resolveSpoofingToggles,
  defaultSpoofingToggles,
  resolveRuleToggles,
  resolveGeoSurface,
  resolveSwBlocking,
  resolveTimeLocaleSurface,
} from "@/shared/fingerprint-spoofing";
import {
  BOOLEAN_SURFACE_KEYS,
  FINGERPRINT_SURFACE_KEYS,
  type BooleanSurfaceKey,
  type FingerprintSurfaceKey,
} from "@/shared/spoofing-surfaces";
import type { SharedSpoofingConfig, SurfaceOverrides } from "@/shared/types";

const CHROMIUM_DEVICE_SHAPES = [
  { hardwareConcurrency: 2, deviceMemory: 2 },
  { hardwareConcurrency: 2, deviceMemory: 4 },
  { hardwareConcurrency: 4, deviceMemory: 8 },
  { hardwareConcurrency: 4, deviceMemory: 16 },
  { hardwareConcurrency: 8, deviceMemory: 16 },
  { hardwareConcurrency: 8, deviceMemory: 32 },
  { hardwareConcurrency: 12, deviceMemory: 16 },
  { hardwareConcurrency: 12, deviceMemory: 32 },
  { hardwareConcurrency: 16, deviceMemory: 32 },
] as const;

const resolveCatalogSurface = (
  surface: BooleanSurfaceKey,
  sharedSpoofing?: SharedSpoofingConfig,
  overrides?: SurfaceOverrides,
): boolean => {
  if (surface === "geolocation") {
    return resolveGeoSurface(sharedSpoofing, overrides);
  }
  if (surface === "timeLocale") {
    return resolveTimeLocaleSurface(sharedSpoofing, overrides);
  }
  return (
    resolveRuleToggles(sharedSpoofing, overrides)[surface as FingerprintSurfaceKey] ??
    false
  );
};

describe("fnv1a32", () => {
  it("produces deterministic hash for the same input", () => {
    const a = fnv1a32("hello");
    const b = fnv1a32("hello");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", () => {
    const a = fnv1a32("hello");
    const b = fnv1a32("world");
    expect(a).not.toBe(b);
  });

  it("returns a positive 32-bit integer", () => {
    const result = fnv1a32("test");
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(2 ** 32);
  });
});

describe("xorshift32", () => {
  it("produces deterministic sequence from same seed", () => {
    const rng1 = xorshift32(42);
    const rng2 = xorshift32(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it("produces values in [0, 1) range", () => {
    const rng = xorshift32(12345);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("produces different sequences from different seeds", () => {
    const rng1 = xorshift32(42);
    const rng2 = xorshift32(43);
    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });
});

describe("createNoiseSeed", () => {
  const baseParts = {
    ruleSeedKey: "abc123",
  } as const;

  it("is deterministic for the same seed parts", () => {
    const seed1 = createNoiseSeed(baseParts);
    const seed2 = createNoiseSeed(baseParts);
    expect(seed1).toBe(seed2);
  });

  it("differs for different rule keys", () => {
    const seed1 = createNoiseSeed(baseParts);
    const seed2 = createNoiseSeed({ ...baseParts, ruleSeedKey: "def456" });
    expect(seed1).not.toBe(seed2);
  });

  it("canonicalizes identity seed keys before hashing", () => {
    const seed1 = createIdentitySeed(baseParts);
    const seed2 = createIdentitySeed({
      ...baseParts,
      ruleSeedKey: "ABC123",
    });

    expect(seed1).toBe(seed2);
  });

  it("preserves the fp-v1 snapshot for example.com on Chromium and Firefox", () => {
    const ruleSeedKey = "abc123";
    const baseSeed = createNoiseSeed({ ruleSeedKey });
    const chromium = buildSimpleFpExtras({
      baseSeed,
      browserFamily: "chromium",
      supportsDeviceMemory: true,
    });
    const firefox = buildSimpleFpExtras({
      baseSeed,
      browserFamily: "firefox",
      supportsDeviceMemory: false,
    });

    expect({
      version: FINGERPRINT_SEED_VERSION,
      hostname: "example.com",
      ruleSeedKey,
      baseSeed,
      surfaces: {
        canvas: deriveSurfaceNoiseSeed(baseSeed, "canvas"),
        audio: deriveSurfaceNoiseSeed(baseSeed, "audio"),
        screen: deriveSurfaceNoiseSeed(baseSeed, "screen"),
        device: deriveSurfaceNoiseSeed(baseSeed, "device"),
        webgl: deriveSurfaceNoiseSeed(baseSeed, "webgl"),
      },
      chromium,
      firefox,
    }).toEqual({
      version: "fp-v1",
      hostname: "example.com",
      ruleSeedKey: "abc123",
      baseSeed: 129_291_396,
      surfaces: {
        canvas: 337_596_233,
        audio: 4_014_897_681,
        screen: 2_766_906_569,
        device: 4_265_490_315,
        webgl: 1_971_102_514,
      },
      chromium: {
        canvasNoiseSeed: 337_596_233,
        audioNoiseSeed: 4_014_897_681,
        screen: {
          width: 1680,
          height: 1050,
          availWidth: 1680,
          availHeight: 1010,
          colorDepth: 24,
          devicePixelRatio: 1,
        },
        webGL: {
          suppressDebugInfo: true,
          readPixelsNoiseSeed: 1_971_102_514,
        },
        hardwareConcurrency: 2,
        deviceMemory: 4,
      },
      firefox: {
        canvasNoiseSeed: 337_596_233,
        audioNoiseSeed: 4_014_897_681,
        screen: {
          width: 1680,
          height: 1050,
          availWidth: 1680,
          availHeight: 1010,
          colorDepth: 24,
          devicePixelRatio: 1,
        },
        webGL: {
          suppressDebugInfo: true,
          readPixelsNoiseSeed: 1_971_102_514,
        },
        hardwareConcurrency: 4,
      },
    });
  });
});

describe("deriveSurfaceNoiseSeed", () => {
  it("derives distinct deterministic per-surface seeds", () => {
    const canvasSeed = deriveSurfaceNoiseSeed(42, "canvas");
    const audioSeed = deriveSurfaceNoiseSeed(42, "audio");

    expect(canvasSeed).not.toBe(audioSeed);
    expect(deriveSurfaceNoiseSeed(42, "canvas")).toBe(canvasSeed);
  });
});

describe("chooseDeviceShape", () => {
  it("returns realistic Chromium hardware/device memory pairs", () => {
    const shape = chooseDeviceShape(42, "chromium", true);

    expect(CHROMIUM_DEVICE_SHAPES).toContainEqual(shape);
  });

  it("omits deviceMemory for Chromium runtimes that do not support it", () => {
    const shape = chooseDeviceShape(42, "chromium", false);

    expect(shape.deviceMemory).toBeUndefined();
  });

  it("keeps Firefox on hardware-only shaping even when deviceMemory exists", () => {
    const shape = chooseDeviceShape(42, "firefox", true);

    expect([4, 8, 16]).toContain(shape.hardwareConcurrency);
    expect(shape.deviceMemory).toBeUndefined();
  });
});

describe("buildSimpleFpExtras", () => {
  it("returns all expected fields", () => {
    const extras = buildSimpleFpExtras({
      baseSeed: 42,
      browserFamily: "chromium",
      supportsDeviceMemory: true,
    });
    expect(extras.canvasNoiseSeed).toBe(deriveSurfaceNoiseSeed(42, "canvas"));
    expect(extras.audioNoiseSeed).toBe(deriveSurfaceNoiseSeed(42, "audio"));
    expect(extras.webGL?.readPixelsNoiseSeed).toBe(deriveSurfaceNoiseSeed(42, "webgl"));
    expect(extras.screen).toBeDefined();
    expect(extras.screen?.width).toBeGreaterThan(0);
    expect(extras.screen?.height).toBeGreaterThan(0);
    expect(extras.screen?.colorDepth).toBe(24);
    expect(extras.webGL).toBeDefined();
    expect(extras.webGL?.suppressDebugInfo).toBe(true);
    expect(extras.webGL?.readPixelsNoiseSeed).toBeTypeOf("number");
    expect(extras.webGL?.renderer).toBeUndefined();
    expect(extras.webGL?.vendor).toBeUndefined();
    expect(CHROMIUM_DEVICE_SHAPES).toContainEqual({
      hardwareConcurrency: extras.hardwareConcurrency,
      deviceMemory: extras.deviceMemory,
    });
  });

  it("is deterministic from same seed", () => {
    const a = buildSimpleFpExtras({
      baseSeed: 42,
      browserFamily: "chromium",
      supportsDeviceMemory: true,
    });
    const b = buildSimpleFpExtras({
      baseSeed: 42,
      browserFamily: "chromium",
      supportsDeviceMemory: true,
    });
    expect(a).toEqual(b);
  });

  it("may select different screen profiles from different seeds", () => {
    const a = buildSimpleFpExtras({
      baseSeed: 1,
      browserFamily: "chromium",
      supportsDeviceMemory: true,
    });
    const b = buildSimpleFpExtras({
      baseSeed: 999999,
      browserFamily: "chromium",
      supportsDeviceMemory: true,
    });
    // At least screen should differ with very different seeds
    const sameScreen =
      a.screen?.width === b.screen?.width && a.screen?.height === b.screen?.height;
    // With vastly different seeds, it's very unlikely both are identical
    expect(sameScreen).toBe(false);
  });

  it("keeps Firefox deviceMemory absent until a verified value pool exists", () => {
    const extras = buildSimpleFpExtras({
      baseSeed: 42,
      browserFamily: "firefox",
      supportsDeviceMemory: true,
    });

    expect([4, 8, 16]).toContain(extras.hardwareConcurrency);
    expect(extras.deviceMemory).toBeUndefined();
  });
});

describe("resolveSpoofingToggles", () => {
  it("returns all-true when toggles are undefined", () => {
    const resolved = resolveSpoofingToggles(undefined);
    expect(resolved).toEqual({
      canvas: true,
      webGL: true,
      audio: true,
      navigator: true,
      screen: true,
      clientHints: true,
      battery: true,
      webRTC: true,
    });
  });

  it("respects explicit false values", () => {
    const resolved = resolveSpoofingToggles({
      canvas: false,
      audio: false,
    });
    expect(resolved.canvas).toBe(false);
    expect(resolved.audio).toBe(false);
    expect(resolved.webGL).toBe(true);
    expect(resolved.navigator).toBe(true);
    expect(resolved.screen).toBe(true);
    expect(resolved.clientHints).toBe(true);
    expect(resolved.battery).toBe(true);
    expect(resolved.webRTC).toBe(true);
  });

  it("treats undefined individual fields as enabled", () => {
    const resolved = resolveSpoofingToggles({});
    expect(resolved.canvas).toBe(true);
    expect(resolved.webGL).toBe(true);
    expect(resolved.webRTC).toBe(true);
  });
});

describe("defaultSpoofingToggles", () => {
  it("has all surfaces enabled", () => {
    for (const surface of FINGERPRINT_SURFACE_KEYS) {
      expect(defaultSpoofingToggles[surface]).toBe(true);
    }
  });
});

describe("resolveSpoofingToggles", () => {
  it("defaults all surfaces to true when no shared override exists", () => {
    const result = resolveRuleToggles(undefined, undefined);
    for (const surface of FINGERPRINT_SURFACE_KEYS) {
      expect(result[surface]).toBe(true);
    }
  });

  // `serviceWorker` is excluded from these generic cascade loops: it is a
  // default-OFF protection with inverted, override-wins semantics covered by the
  // dedicated `resolveSwBlocking` suite below. `sharedWorker`
  // is also excluded because it uses a mode selector instead of a boolean.
  const CASCADE_SURFACE_KEYS = BOOLEAN_SURFACE_KEYS.filter(
    (surface) => surface !== "serviceWorker",
  );

  it("defaults every cascade surface to enabled", () => {
    for (const surface of CASCADE_SURFACE_KEYS) {
      expect(resolveCatalogSurface(surface, undefined, undefined)).toBe(true);
    }
  });

  it("lets the global surface disable win for every cascade surface", () => {
    for (const surface of CASCADE_SURFACE_KEYS) {
      expect(
        resolveCatalogSurface(surface, { [surface]: false }, { [surface]: true }),
      ).toBe(false);
    }
  });

  it("lets rule overrides disable every cascade surface when global config inherits or stays on", () => {
    for (const surface of CASCADE_SURFACE_KEYS) {
      expect(
        resolveCatalogSurface(surface, { [surface]: true }, { [surface]: false }),
      ).toBe(false);
    }
  });

  it("falls back to shared defaults when all global spoofing surfaces are allowed", () => {
    const experimental: SharedSpoofingConfig = {
      canvas: true,
      webGL: true,
      audio: true,
      navigator: true,
      screen: true,
      clientHints: true,
      battery: true,
      webRTC: true,
    };
    const result = resolveRuleToggles(experimental, undefined);
    expect(result.canvas).toBe(true);
    expect(result.webGL).toBe(true);
    expect(result.audio).toBe(true);
    expect(result.navigator).toBe(true);
    expect(result.screen).toBe(true);
    expect(result.clientHints).toBe(true);
    expect(result.battery).toBe(true);
    expect(result.webRTC).toBe(true);
  });

  describe("resolveGeoSurface", () => {
    it("defaults geolocation to true", () => {
      expect(resolveGeoSurface(undefined, undefined)).toBe(true);
    });

    it("respects an explicit rule override", () => {
      expect(resolveGeoSurface(undefined, { geolocation: false })).toBe(false);
    });

    it("lets the explicit rule override re-enable geolocation", () => {
      expect(resolveGeoSurface(undefined, { geolocation: true })).toBe(true);
    });

    it("lets the global surface disable win", () => {
      expect(resolveGeoSurface({ geolocation: false }, { geolocation: true })).toBe(
        false,
      );
    });
  });

  describe("resolveTimeLocaleSurface", () => {
    it("defaults timeLocale to true", () => {
      expect(resolveTimeLocaleSurface(undefined, undefined)).toBe(true);
    });

    it("respects the rule override when the global surface stays enabled", () => {
      expect(resolveTimeLocaleSurface(undefined, { timeLocale: false })).toBe(false);
      expect(resolveTimeLocaleSurface({ timeLocale: true }, { timeLocale: true })).toBe(
        true,
      );
    });

    it("lets the global surface disable win", () => {
      expect(
        resolveTimeLocaleSurface({ timeLocale: false }, { timeLocale: true }),
      ).toBe(false);
    });
  });

  it("applies rule overrides even when no global spoofing config is stored", () => {
    const ruleOverrides: SurfaceOverrides = {
      canvas: false,
      webGL: false,
      audio: false,
      navigator: false,
      screen: false,
      clientHints: false,
      webRTC: false,
    };
    const result = resolveRuleToggles(undefined, ruleOverrides);
    expect(result.canvas).toBe(false);
    expect(result.webGL).toBe(false);
    expect(result.audio).toBe(false);
    expect(result.navigator).toBe(false);
    expect(result.screen).toBe(false);
    expect(result.clientHints).toBe(false);
    expect(result.webRTC).toBe(false);
  });

  it("kills a surface when the global surface control is false", () => {
    const experimental: SharedSpoofingConfig = {
      canvas: false,
      webGL: true,
      audio: true,
      navigator: true,
      screen: true,
      clientHints: true,
      webRTC: true,
    };
    const result = resolveRuleToggles(experimental, undefined);
    expect(result.canvas).toBe(false);
    expect(result.webGL).toBe(true);
    expect(result.audio).toBe(true);
    expect(result.navigator).toBe(true);
    expect(result.screen).toBe(true);
    expect(result.clientHints).toBe(true);
    expect(result.webRTC).toBe(true);
  });

  it("kills all shared surfaces when explicitly disabled", () => {
    const experimental: SharedSpoofingConfig = {
      canvas: false,
      webGL: false,
      audio: false,
      navigator: false,
      screen: false,
      clientHints: false,
      webRTC: false,
    };
    const result = resolveRuleToggles(experimental, undefined);
    expect(result.canvas).toBe(false);
    expect(result.webGL).toBe(false);
    expect(result.audio).toBe(false);
    expect(result.navigator).toBe(false);
    expect(result.screen).toBe(false);
    expect(result.clientHints).toBe(false);
    expect(result.webRTC).toBe(false);
  });

  it("global surface disable takes precedence over rule override true", () => {
    const experimental: SharedSpoofingConfig = {
      canvas: false,
      webGL: true,
      audio: true,
      navigator: true,
      screen: true,
      clientHints: true,
      webRTC: true,
    };
    const ruleOverrides: SurfaceOverrides = { canvas: true };
    const result = resolveRuleToggles(experimental, ruleOverrides);
    expect(result.canvas).toBe(false);
    expect(result.webGL).toBe(true);
  });

  it("rule override true wins when the global surface stays enabled", () => {
    const experimental: SharedSpoofingConfig = {
      canvas: true,
      webGL: true,
      audio: true,
      navigator: true,
      screen: true,
      clientHints: true,
      webRTC: true,
    };
    const ruleOverrides: SurfaceOverrides = { canvas: true };
    const result = resolveRuleToggles(experimental, ruleOverrides);
    expect(result.canvas).toBe(true);
  });

  it("rule override false disables a surface when the global surface stays enabled", () => {
    const experimental: SharedSpoofingConfig = {
      canvas: true,
      webGL: true,
      audio: true,
      navigator: true,
      screen: true,
      clientHints: true,
      webRTC: true,
    };
    const ruleOverrides: SurfaceOverrides = { canvas: false };
    const result = resolveRuleToggles(experimental, ruleOverrides);
    expect(result.canvas).toBe(false);
    expect(result.webGL).toBe(true);
    expect(result.audio).toBe(true);
    expect(result.navigator).toBe(true);
    expect(result.screen).toBe(true);
    expect(result.clientHints).toBe(true);
    expect(result.webRTC).toBe(true);
  });

  it("applies navigator and client hints overrides like other shared surfaces", () => {
    const experimental: SharedSpoofingConfig = {
      canvas: true,
      webGL: true,
      audio: true,
      navigator: true,
      screen: true,
      clientHints: true,
      webRTC: true,
    };
    const result = resolveRuleToggles(experimental, {
      navigator: false,
      clientHints: false,
    });
    expect(result.navigator).toBe(false);
    expect(result.clientHints).toBe(false);
  });

  it("defaults allowed surfaces to true when no override exists", () => {
    const experimental: SharedSpoofingConfig = {
      canvas: true,
      webGL: true,
      audio: true,
      navigator: true,
      screen: true,
      clientHints: true,
      webRTC: true,
    };
    const result = resolveRuleToggles(experimental, undefined);
    expect(result.canvas).toBe(true);
    expect(result.webGL).toBe(true);
    expect(result.audio).toBe(true);
    expect(result.navigator).toBe(true);
    expect(result.screen).toBe(true);
    expect(result.clientHints).toBe(true);
    expect(result.webRTC).toBe(true);
  });
});

describe("resolveSwBlocking", () => {
  it("defaults to not blocking (allow) when nothing is configured", () => {
    expect(resolveSwBlocking(undefined, undefined)).toBe(false);
  });

  it("follows the global default when the rule inherits", () => {
    expect(resolveSwBlocking({ serviceWorker: true }, undefined)).toBe(true);
    expect(resolveSwBlocking({ serviceWorker: false }, undefined)).toBe(false);
  });

  it("lets a per-rule override win over the global default (block or allow)", () => {
    // Allow-exception even when the global default blocks.
    expect(resolveSwBlocking({ serviceWorker: true }, { serviceWorker: false })).toBe(
      false,
    );
    // Force-block even when the global default allows.
    expect(resolveSwBlocking({ serviceWorker: false }, { serviceWorker: true })).toBe(
      true,
    );
    expect(resolveSwBlocking(undefined, { serviceWorker: true })).toBe(true);
  });
});
