import { describe, expect, it } from "vitest";

import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
} from "@/shared/types";
import { collectPresetUsage } from "@/ui/options/location-usage";

const rule = (pattern: string, locationId: string, enabled = true): DomainRule => ({
  pattern,
  locationId,
  enabled,
  ruleSeedKey: `seed-${pattern}`,
});

const fallback = (locationId: string, enabled = true): GlobalFallbackRule => ({
  locationId,
  enabled,
  ruleSeedKey: "fallback-seed",
});

const container = (
  cookieStoreId: string,
  locationId: string,
  enabled = true,
): ContainerAssignment => ({
  cookieStoreId,
  locationId,
  enabled,
  ruleSeedKey: `seed-${cookieStoreId}`,
});

describe("collectPresetUsage", () => {
  it("returns no dependency for an unused preset", () => {
    expect(collectPresetUsage([], undefined, []).get("warsaw")).toBeUndefined();
  });

  it("includes enabled and disabled Domain Rules", () => {
    const usage = collectPresetUsage(
      [rule("example.com", "warsaw"), rule("off.example.com", "warsaw", false)],
      undefined,
      [],
    ).get("warsaw");

    expect(usage?.sources).toEqual([
      expect.objectContaining({ kind: "domain-rule", enabled: true }),
      expect.objectContaining({ kind: "domain-rule", enabled: false }),
    ]);
  });

  it("includes the Default Rule", () => {
    const usage = collectPresetUsage([], fallback("warsaw", false), []).get("warsaw");

    expect(usage?.sources).toEqual([
      expect.objectContaining({ kind: "default-rule", enabled: false }),
    ]);
  });

  it("includes enabled and disabled Firefox Containers", () => {
    const usage = collectPresetUsage([], undefined, [
      container("firefox-container-1", "warsaw"),
      container("firefox-container-2", "warsaw", false),
    ]).get("warsaw");

    expect(usage?.sources).toEqual([
      expect.objectContaining({ kind: "firefox-container", enabled: true }),
      expect.objectContaining({ kind: "firefox-container", enabled: false }),
    ]);
  });

  it("combines dependencies from every source", () => {
    const usage = collectPresetUsage(
      [rule("example.com", "warsaw")],
      fallback("warsaw"),
      [container("firefox-container-1", "warsaw")],
    ).get("warsaw");

    expect(usage?.sources.map(({ kind }) => kind)).toEqual([
      "domain-rule",
      "default-rule",
      "firefox-container",
    ]);
  });
});
