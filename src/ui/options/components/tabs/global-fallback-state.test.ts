import { describe, expect, it } from "vitest";

import {
  isGlobalFallbackInactive,
  isFallbackIncomplete,
} from "@/ui/options/components/tabs/global-fallback-state";

describe("isGlobalFallbackInactive", () => {
  it("treats a missing Default Rule as not inactive", () => {
    expect(isGlobalFallbackInactive(undefined)).toBe(false);
  });

  it("treats a disabled Default Rule as inactive", () => {
    expect(
      isGlobalFallbackInactive({
        enabled: false,
        locationId: "warsaw",
        ruleSeedKey: "seed123",
      }),
    ).toBe(true);
  });

  it("treats a location-less enabled Default Rule as unconfigured", () => {
    expect(
      isFallbackIncomplete({
        enabled: true,
        ruleSeedKey: "seed123",
      }),
    ).toBe(true);
  });

  it("treats a geolocation-disabled Default Rule as configured without a location", () => {
    expect(
      isFallbackIncomplete({
        enabled: true,
        fingerprintSurfaceOverrides: { geolocation: false },
        ruleSeedKey: "seed123",
      }),
    ).toBe(false);
  });
});
