import { describe, expect, it } from "vitest";

import { buildComparisonRows } from "./fingerprint-comparison";

import type {
  BrowserFingerprint,
  CapturedFingerprint,
  FingerprintToggles,
} from "@/shared/types";

const pendingLabel = "Collecting…";
const notAvailableLabel = "N/A";
const browserVersionNote =
  "Privacy Thing keeps normalized browser-version tokens and does not randomize placeholder variants like 139.0.0.0.";

const capturedFingerprint: CapturedFingerprint = {
  canvasHash: "0123456789abcdef0123456789abcdef",
  webGL: {
    renderer: "ANGLE (Intel)",
    vendor: "Google Inc.",
    readPixelsHash: "feedfacec001d00d",
  },
  audioHash: "abcdef0123456789abcdef0123456789",
  navigator: {
    userAgent: "Mozilla/5.0 Chrome/139.0.0.0",
    platform: "MacIntel",
    hardwareConcurrency: 8,
    deviceMemory: 8,
    languages: ["en-US", "en"],
    maxTouchPoints: 0,
  },
  screen: {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: 2,
  },
  clientHints: {
    platform: "macOS",
    platformVersion: "15.0.0",
    architecture: "arm",
    bitness: "64",
    mobile: false,
    model: null,
    brands: [{ brand: "Chromium", version: "139" }],
    fullVersionList: [{ brand: "Chromium", version: "139.0.7204.62" }],
  },
  collectedAt: "2026-04-20T12:00:00.000Z",
};

const runtimeFingerprint: BrowserFingerprint = {
  userAgent: "Mozilla/5.0 Chrome/139.0.7203.10",
  appVersion: "5.0 Chrome/139.0.7203.10",
  vendor: "Google Inc.",
  hardwareConcurrency: 12,
  deviceMemory: 16,
  platform: "Win32",
  canvasNoiseSeed: 0x12345678,
  audioNoiseSeed: 0x87654321,
  webGL: {
    suppressDebugInfo: true,
    readPixelsNoiseSeed: 0xdecafbad,
  },
  screen: {
    width: 1536,
    height: 864,
    availWidth: 1536,
    availHeight: 824,
    colorDepth: 24,
    devicePixelRatio: 1.25,
  },
  clientHints: {
    platform: "Windows",
    mobile: false,
    brands: [{ brand: "Chromium", version: "139" }],
    fullVersionList: [{ brand: "Chromium", version: "139.0.7203.10" }],
  },
};

const allSurfacesEnabled: FingerprintToggles = {
  canvas: true,
  webGL: true,
  audio: true,
  navigator: true,
  screen: true,
  clientHints: true,
  webRTC: true,
};

describe("buildComparisonRows", () => {
  it("builds rows for all enabled spoofing surfaces", () => {
    const rows = buildComparisonRows({
      local: {
        userAgent: capturedFingerprint.navigator.userAgent,
        appVersion: "5.0 Chrome/139.0.0.0",
        vendor: "Apple Computer, Inc.",
        platform: capturedFingerprint.navigator.platform,
        hardwareConcurrency: capturedFingerprint.navigator.hardwareConcurrency,
        deviceMemory: capturedFingerprint.navigator.deviceMemory ?? undefined,
        webRTCAvailable: true,
        capturedFingerprint,
      },
      runtimeFingerprint: {
        ...runtimeFingerprint,
        spoofingToggles: allSurfacesEnabled,
      },
      pendingLabel,
      notAvailableLabel,
      matchingLocalNote: "Spoofed value matches the local browser for this seed.",
      browserVersionNote,
    });

    expect(rows.map((row) => row.id)).toEqual([
      "userAgent",
      "appVersion",
      "vendor",
      "hardwareConcurrency",
      "deviceMemory",
      "platform",
      "clientHintBrands",
      "clientHintPlatform",
      "clientHintPlatformVersion",
      "clientHintArchitecture",
      "clientHintBitness",
      "clientHintModel",
      "clientHintMobile",
      "clientHintFullVersionList",
      "canvas2d",
      "webglRenderer",
      "webglDebugExtension",
      "webglReadPixels",
      "screenMetrics",
      "devicePixelRatio",
      "pixelDepth",
      "audioFingerprint",
      "webRTCIcePolicy",
    ]);
    const canvasSpoofedValue = rows.find((row) => row.id === "canvas2d")?.spoofedValue;
    const localCanvasSummary = capturedFingerprint.canvasHash
      ? `${capturedFingerprint.canvasHash.slice(0, 12)}…`
      : notAvailableLabel;
    expect(canvasSpoofedValue).toContain("\nNoise enabled (seed 0x12345678)");
    expect(canvasSpoofedValue?.split("\n")[0]).not.toBe(localCanvasSummary);
    expect(rows.find((row) => row.id === "webglDebugExtension")?.spoofedValue).toBe(
      "Hidden",
    );
    expect(rows.find((row) => row.id === "webglReadPixels")?.localValue).toBe(
      "feedfacec001…",
    );
    expect(rows.find((row) => row.id === "webglReadPixels")?.spoofedValue).toContain(
      "\nNoise enabled (seed 0xdecafbad)",
    );
    expect(rows.find((row) => row.id === "audioFingerprint")?.spoofedValue).toContain(
      "\nNoise enabled (seed 0x87654321)",
    );
    expect(rows.find((row) => row.id === "webRTCIcePolicy")?.spoofedValue).toBe(
      "Relay-only ICE + SDP scrubber",
    );
    expect(rows.find((row) => row.id === "hardwareConcurrency")?.note).toBeUndefined();
    expect(rows.find((row) => row.id === "userAgent")?.note).toBeUndefined();
    expect(rows.find((row) => row.id === "appVersion")?.note).toBeUndefined();
    expect(rows.find((row) => row.id === "clientHintBrands")?.note).toContain(
      "139.0.0.0",
    );
    expect(
      rows.find((row) => row.id === "clientHintFullVersionList")?.note,
    ).toBeUndefined();
  });

  it("omits rows when per-surface toggles disable them", () => {
    const rows = buildComparisonRows({
      local: {
        userAgent: capturedFingerprint.navigator.userAgent,
        appVersion: "5.0 Chrome/139.0.0.0",
        vendor: "Apple Computer, Inc.",
        platform: capturedFingerprint.navigator.platform,
        hardwareConcurrency: capturedFingerprint.navigator.hardwareConcurrency,
        deviceMemory: capturedFingerprint.navigator.deviceMemory ?? undefined,
        webRTCAvailable: true,
        capturedFingerprint,
      },
      runtimeFingerprint: {
        ...runtimeFingerprint,
        spoofingToggles: {
          ...allSurfacesEnabled,
          canvas: false,
          webGL: false,
          clientHints: false,
        },
      },
      pendingLabel,
      notAvailableLabel,
      matchingLocalNote: "Spoofed value matches the local browser for this seed.",
      browserVersionNote,
    });

    expect(rows.some((row) => row.id === "canvas2d")).toBe(false);
    expect(rows.some((row) => row.id === "webglRenderer")).toBe(false);
    expect(rows.some((row) => row.id === "clientHintBrands")).toBe(false);
    expect(rows.some((row) => row.id === "userAgent")).toBe(true);
  });

  it("uses the pending label while local probe collection is still running", () => {
    const rows = buildComparisonRows({
      local: {
        userAgent: capturedFingerprint.navigator.userAgent,
        appVersion: "5.0 Chrome/139.0.0.0",
        vendor: "Apple Computer, Inc.",
        platform: capturedFingerprint.navigator.platform,
        hardwareConcurrency: capturedFingerprint.navigator.hardwareConcurrency,
        deviceMemory: capturedFingerprint.navigator.deviceMemory ?? undefined,
        webRTCAvailable: false,
        capturedFingerprint: null,
      },
      runtimeFingerprint: {
        ...runtimeFingerprint,
        spoofingToggles: {
          ...allSurfacesEnabled,
          canvas: true,
          audio: true,
          screen: true,
        },
      },
      pendingLabel,
      notAvailableLabel,
      matchingLocalNote: "Spoofed value matches the local browser for this seed.",
      browserVersionNote,
    });

    expect(rows.find((row) => row.id === "canvas2d")?.localValue).toBe(pendingLabel);
    expect(rows.find((row) => row.id === "audioFingerprint")?.localValue).toBe(
      pendingLabel,
    );
    expect(rows.find((row) => row.id === "screenMetrics")?.localValue).toBe(
      pendingLabel,
    );
    expect(rows.find((row) => row.id === "devicePixelRatio")?.localValue).toBe(
      pendingLabel,
    );
    expect(rows.find((row) => row.id === "pixelDepth")?.localValue).toBe(pendingLabel);
    expect(rows.find((row) => row.id === "webRTCIcePolicy")?.localValue).toBe(
      notAvailableLabel,
    );
  });

  it("returns no rows when browser fingerprint spoofing is disabled", () => {
    expect(
      buildComparisonRows({
        local: {
          userAgent: capturedFingerprint.navigator.userAgent,
          appVersion: "5.0 Chrome/139.0.0.0",
          vendor: "Apple Computer, Inc.",
          platform: capturedFingerprint.navigator.platform,
          hardwareConcurrency: capturedFingerprint.navigator.hardwareConcurrency,
          deviceMemory: capturedFingerprint.navigator.deviceMemory ?? undefined,
          webRTCAvailable: true,
          capturedFingerprint,
        },
        runtimeFingerprint: undefined,
        pendingLabel,
        notAvailableLabel,
        matchingLocalNote: "Spoofed value matches the local browser for this seed.",
        browserVersionNote,
      }),
    ).toEqual([]);
  });

  it("marks navigator CPU and memory when the spoofed profile matches the host", () => {
    const rows = buildComparisonRows({
      local: {
        userAgent: capturedFingerprint.navigator.userAgent,
        appVersion: "5.0 Chrome/139.0.0.0",
        vendor: "Apple Computer, Inc.",
        platform: capturedFingerprint.navigator.platform,
        hardwareConcurrency: 8,
        deviceMemory: 16,
        webRTCAvailable: true,
        capturedFingerprint,
      },
      runtimeFingerprint: {
        ...runtimeFingerprint,
        hardwareConcurrency: 8,
        deviceMemory: 16,
        spoofingToggles: allSurfacesEnabled,
      },
      pendingLabel,
      notAvailableLabel,
      matchingLocalNote: "Spoofed value matches the local browser for this seed.",
      browserVersionNote,
    });

    expect(rows.find((row) => row.id === "hardwareConcurrency")?.note).toBe(
      "Spoofed value matches the local browser for this seed.",
    );
    expect(rows.find((row) => row.id === "deviceMemory")?.note).toBe(
      "Spoofed value matches the local browser for this seed.",
    );
  });

  it("keeps the browser-version note only on normalized placeholder rows", () => {
    const rows = buildComparisonRows({
      local: {
        userAgent: capturedFingerprint.navigator.userAgent,
        appVersion: "5.0 Chrome/139.0.0.0",
        vendor: "Apple Computer, Inc.",
        platform: capturedFingerprint.navigator.platform,
        hardwareConcurrency: capturedFingerprint.navigator.hardwareConcurrency,
        deviceMemory: capturedFingerprint.navigator.deviceMemory ?? undefined,
        webRTCAvailable: true,
        capturedFingerprint,
      },
      runtimeFingerprint: {
        ...runtimeFingerprint,
        userAgent: "Mozilla/5.0 Chrome/139.0.0.0",
        appVersion: "5.0 Chrome/139.0.0.0",
        clientHints: {
          ...runtimeFingerprint.clientHints,
          fullVersionList: [{ brand: "Chromium", version: "139.0.0.0" }],
        },
        spoofingToggles: allSurfacesEnabled,
      },
      pendingLabel,
      notAvailableLabel,
      matchingLocalNote: "Spoofed value matches the local browser for this seed.",
      browserVersionNote,
    });

    expect(rows.find((row) => row.id === "userAgent")?.note).toContain("139.0.0.0");
    expect(rows.find((row) => row.id === "appVersion")?.note).toContain("139.0.0.0");
    expect(rows.find((row) => row.id === "clientHintFullVersionList")?.note).toContain(
      "139.0.0.0",
    );
  });
});
