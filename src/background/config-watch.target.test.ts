import { describe, expect, it } from "vitest";

import { collectAffectedHostnames, sameRuleShape } from "@/background/config-watch";
import type { DomainRule, EffectiveTabContext, Location } from "@/shared/types";

describe("collectAffectedHostnames", () => {
  it("collects hostnames from changed rules and only matching active contexts", () => {
    const previousRules: DomainRule[] = [
      {
        pattern: "*.example.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "abc123",
      },
    ];
    const nextRules: DomainRule[] = [
      {
        pattern: "shop.example.com",
        locationId: "paris",
        enabled: true,
        ruleSeedKey: "def456",
      },
    ];
    const previousProfiles: Location[] = [
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 1,
        longitude: 2,
        accuracy: 3,
        noiseRadius: 50,
        language: "pl-PL",
        languages: ["pl-PL"],
        timeZone: "Europe/Warsaw",
      },
    ];
    const nextProfiles: Location[] = [
      {
        id: "paris",
        label: "Paris",
        latitude: 4,
        longitude: 5,
        accuracy: 6,
        noiseRadius: 50,
        language: "fr-FR",
        languages: ["fr-FR"],
        timeZone: "Europe/Paris",
      },
    ];
    const activeContexts: EffectiveTabContext[] = [
      { tabId: 7, hostname: "api.example.com" },
      { tabId: 8, hostname: "google.com" },
    ];

    const affected = collectAffectedHostnames({
      previousRules,
      nextRules,
      previousLocations: previousProfiles,
      nextLocations: nextProfiles,
      activeContexts,
    });

    expect(affected).toContain("example.com");
    expect(affected).toContain("shop.example.com");
    expect(affected).toContain("api.example.com");
    expect(affected).not.toContain("google.com");
  });

  it("treats ruleSeedKey-only diffs as equivalent rule collections", () => {
    const previousRules: DomainRule[] = [
      {
        pattern: "example.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "abc123",
      },
    ];
    const nextRules: DomainRule[] = [
      {
        pattern: "example.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "def456",
      },
    ];

    expect(sameRuleShape(previousRules, nextRules)).toBe(true);
  });

  it("treats reordered rules with the same shape as equivalent", () => {
    const previousRules: DomainRule[] = [
      {
        pattern: "example.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "abc123",
      },
      {
        pattern: "*.example.com",
        locationId: "paris",
        enabled: true,
        ruleSeedKey: "def456",
      },
    ];
    const nextRules: DomainRule[] = [
      {
        pattern: "*.example.com",
        locationId: "paris",
        enabled: true,
        ruleSeedKey: "uvw000",
      },
      {
        pattern: "example.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "xyz999",
      },
    ];

    expect(sameRuleShape(previousRules, nextRules)).toBe(true);
  });

  it("excludes tabs matched by unchanged rules from a rule parameter change", () => {
    const previousRules: DomainRule[] = [
      {
        pattern: "changed.example.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "abc123",
        authKey: "keep0001",
      },
      {
        pattern: "unrelated.example.net",
        locationId: "paris",
        enabled: true,
        ruleSeedKey: "def456",
        authKey: "keep0002",
      },
    ];
    const nextRules: DomainRule[] = previousRules.map((rule) =>
      rule.pattern === "changed.example.com" ? { ...rule, enabled: false } : rule,
    );
    const activeContexts: EffectiveTabContext[] = [
      { tabId: 7, hostname: "changed.example.com" },
      { tabId: 8, hostname: "unrelated.example.net" },
    ];

    const affected = collectAffectedHostnames({
      previousRules,
      nextRules,
      previousLocations: [],
      nextLocations: [],
      activeContexts,
    });

    expect(affected).toContain("changed.example.com");
    expect(affected).not.toContain("unrelated.example.net");
  });
});
