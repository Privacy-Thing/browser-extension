import {
  XRayCategorySchema,
  SurfaceGroupSchema,
  SurfaceMethodIdSchema,
} from "@privacy-brand/xray-protocol";
import { describe, expect, it } from "vitest";

import {
  BOOLEAN_SURFACE_KEYS,
  CONFIGURABLE_SURFACES,
  XRAY_SURFACE_CATEGORIES,
  FINGERPRINT_SURFACE_KEYS,
  isSurfaceMethodId,
  isSurfaceSupported,
  BROWSER_CAPABILITIES,
  SURFACE_GROUP_ORDER,
  SURFACE_METHOD_IDS,
  SPOOFING_SURFACE_METHODS,
  SPOOFING_SURFACE_KEYS,
  SPOOFING_SURFACES,
} from "@/shared/spoofing-surfaces";

describe("spoofing surface catalog", () => {
  it("matches the XRay protocol categories exactly", () => {
    expect(XRAY_SURFACE_CATEGORIES).toEqual(XRayCategorySchema.options);
  });

  it("uses stable storage keys as XRay categories", () => {
    expect(XRAY_SURFACE_CATEGORIES).toEqual(SPOOFING_SURFACE_KEYS);
  });

  it("assigns every surface to one catalog-owned group", () => {
    expect(SURFACE_GROUP_ORDER).toEqual(SurfaceGroupSchema.options);
    expect(SURFACE_GROUP_ORDER).toEqual([
      "location-locale",
      "browser-identity",
      "rendering-media",
      "workers",
    ]);
    expect(SPOOFING_SURFACES.map((surface) => surface.group)).toEqual([
      "location-locale",
      "location-locale",
      "rendering-media",
      "rendering-media",
      "rendering-media",
      "browser-identity",
      "browser-identity",
      "browser-identity",
      "browser-identity",
      "rendering-media",
      "workers",
      "workers",
      "workers",
    ]);
  });

  it("declares target capabilities in the catalog", () => {
    expect(BROWSER_CAPABILITIES).toEqual({
      chromium: ["battery-status", "client-hints"],
      firefox: [],
    });
    for (const surface of SPOOFING_SURFACES) {
      expect(isSurfaceSupported(surface, "chromium")).toBe(true);
      expect(isSurfaceSupported(surface, "firefox")).toBe(
        surface.key !== "clientHints" && surface.key !== "battery",
      );
    }
  });

  it("defaults every surface to enabled except the serviceWorker block", () => {
    for (const surface of SPOOFING_SURFACES) {
      expect(surface.defaultEnabled).toBe(surface.key !== "serviceWorker");
    }
  });

  it("marks only fingerprint-backed surfaces as fingerprint toggles", () => {
    expect(FINGERPRINT_SURFACE_KEYS).toEqual([
      "canvas",
      "webGL",
      "audio",
      "navigator",
      "screen",
      "clientHints",
      "battery",
      "webRTC",
    ]);
  });

  it("keeps Dedicated Workers runtime-only and out of persisted controls", () => {
    expect(
      SPOOFING_SURFACES.find((surface) => surface.key === "worker")?.controlKind,
    ).toBe("runtime");
    expect(CONFIGURABLE_SURFACES.map((surface) => surface.key)).not.toContain("worker");
    expect(BOOLEAN_SURFACE_KEYS).not.toContain("worker");
  });

  it("matches the XRay protocol method IDs exactly", () => {
    expect(SURFACE_METHOD_IDS).toEqual(SurfaceMethodIdSchema.options);
  });

  it("defines unique method IDs under known parent surfaces", () => {
    expect(new Set(SURFACE_METHOD_IDS).size).toBe(SURFACE_METHOD_IDS.length);

    const surfaceKeys = new Set(SPOOFING_SURFACE_KEYS);
    for (const method of SPOOFING_SURFACE_METHODS) {
      expect(surfaceKeys.has(method.surfaceKey)).toBe(true);
      expect(isSurfaceMethodId(method.id)).toBe(true);
      expect(
        SPOOFING_SURFACES.find(
          (surface) => surface.key === method.surfaceKey,
        )?.methods.some((candidate) => candidate.id === method.id),
      ).toBe(true);
    }
  });
});
