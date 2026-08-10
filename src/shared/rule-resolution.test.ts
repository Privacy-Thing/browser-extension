import { describe, expect, it } from "vitest";

import {
  findTrustedSiteMatches,
  matchTrustedSite,
  resolveRuleSources,
} from "@/shared/rule-resolution";

describe("matchTrustedSite", () => {
  it("prefers the most specific enabled trusted-site pattern", () => {
    expect(
      matchTrustedSite("shop.example.com", [
        { pattern: "*.example.com", enabled: true },
        { pattern: "shop.example.com", enabled: true },
        { pattern: "shop.example.com", enabled: false },
      ]),
    ).toEqual({ pattern: "shop.example.com", enabled: true });
  });

  it("keeps the most specific disabled match available for popup actions", () => {
    expect(
      findTrustedSiteMatches("shop.example.com", [
        { pattern: "*.example.com", enabled: false },
        { pattern: "shop.example.com", enabled: false },
      ]),
    ).toEqual({
      enabledSite: null,
      matchingSite: { pattern: "shop.example.com", enabled: false },
    });
  });
});

describe("resolveRuleSources", () => {
  it("keeps active and displayed rules separate when a disabled exact rule shadows a broader enabled rule in UI only", () => {
    const result = resolveRuleSources({
      hostname: "shop.example.com",
      rules: [
        { pattern: "shop.example.com", locationId: "exact", enabled: false },
        { pattern: "*.example.com", locationId: "broad", enabled: true },
      ],
    });

    expect(result.activeRule?.pattern).toBe("*.example.com");
    expect(result.displayedRule?.pattern).toBe("shop.example.com");
    expect(result.winningSource).toBe("rule");
    expect(result.effectiveLocationId).toBe("broad");
  });

  it("lets a location-less rule inherit the effective location from an active container assignment", () => {
    const result = resolveRuleSources({
      hostname: "shop.example.com",
      cookieStoreId: "firefox-container-1",
      rules: [{ pattern: "shop.example.com", locationId: "", enabled: true }],
      containerAssignments: [
        { cookieStoreId: "firefox-container-1", locationId: "berlin", enabled: true },
      ],
    });

    expect(result.activeRule?.pattern).toBe("shop.example.com");
    expect(result.inheritedLocationId).toBe("berlin");
    expect(result.effectiveLocationId).toBe("berlin");
    expect(result.winningSource).toBe("rule");
  });

  it("falls back to the Default Rule for inherited location when the active container has no preset", () => {
    const result = resolveRuleSources({
      hostname: "shop.example.com",
      cookieStoreId: "firefox-container-1",
      rules: [{ pattern: "shop.example.com", locationId: "", enabled: true }],
      containerAssignments: [{ cookieStoreId: "firefox-container-1", enabled: true }],
      globalFallbackRule: {
        enabled: true,
        locationId: "warsaw",
        ruleSeedKey: "glb123",
      },
    });

    expect(result.inheritedLocationId).toBe("warsaw");
    expect(result.effectiveLocationId).toBe("warsaw");
    expect(result.runtimeFallbackRule?.locationId).toBe("warsaw");
  });

  it("keeps preview-only fallback states separate from runtime-usable fallback states", () => {
    const result = resolveRuleSources({
      hostname: "shop.example.com",
      rules: [],
      globalFallbackRule: {
        enabled: true,
        fingerprintSurfaceOverrides: { geolocation: false },
        ruleSeedKey: "glb123",
      },
    });

    expect(result.previewFallbackRule).toMatchObject({
      enabled: true,
      fingerprintSurfaceOverrides: { geolocation: false },
      ruleSeedKey: "glb123",
    });
    expect(result.runtimeFallbackRule).toBeNull();
    expect(result.effectiveLocationId).toBeNull();
    expect(result.winningSource).toBe("none");
  });
});
