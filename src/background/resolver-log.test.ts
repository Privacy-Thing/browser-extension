import { describe, expect, it } from "vitest";

import { buildResolverLogEntry } from "@/background/resolver-log";

describe("resolver-log", () => {
  it("describes a trusted-site bypass", () => {
    expect(
      buildResolverLogEntry({
        matchedTrustedSitePattern: "*.example.com",
        fallbackConfigured: true,
        activeProfileExists: false,
        fallbackProfileExists: true,
        resolved: false,
      }),
    ).toEqual({
      event: "resolver.snapshot-skipped",
      details: expect.objectContaining({
        winningSource: "trusted-site",
        trustedSitePattern: "*.example.com",
        failureReason: "trusted-site",
      }),
    });
  });

  it("describes a resolved rule snapshot", () => {
    expect(
      buildResolverLogEntry({
        cookieStoreId: "firefox-container-1",
        matchedPattern: "shop.example.com",
        activeIdentityKind: "rule",
        activeLocationId: "warsaw",
        fallbackConfigured: true,
        activeProfileExists: true,
        fallbackProfileExists: true,
        geolocationEnabled: true,
        blockServiceWorkerRegistration: true,
        resolved: true,
      }),
    ).toEqual({
      event: "resolver.snapshot-resolved",
      details: expect.objectContaining({
        winningSource: "rule",
        matchedPattern: "shop.example.com",
        activeIdentityKind: "rule",
        activeLocationId: "warsaw",
        failureReason: null,
        blockServiceWorkerRegistration: true,
      }),
    });
  });

  it("reports missing active profiles", () => {
    expect(
      buildResolverLogEntry({
        activeIdentityKind: "container",
        activeLocationId: "berlin",
        fallbackConfigured: false,
        activeProfileExists: false,
        fallbackProfileExists: false,
        resolved: false,
      }),
    ).toEqual({
      event: "resolver.snapshot-skipped",
      details: expect.objectContaining({
        winningSource: "container",
        failureReason: "missing-active-profile",
      }),
    });
  });

  it("reports fallback profile failures", () => {
    expect(
      buildResolverLogEntry({
        fallbackConfigured: true,
        fallbackLocationId: "warsaw",
        activeProfileExists: false,
        fallbackProfileExists: false,
        resolved: false,
      }),
    ).toEqual({
      event: "resolver.snapshot-skipped",
      details: expect.objectContaining({
        winningSource: "none",
        failureReason: "missing-fallback-profile",
        fallbackLocationId: "warsaw",
      }),
    });
  });
});
