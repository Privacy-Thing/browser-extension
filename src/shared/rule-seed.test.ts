import { describe, expect, it } from "vitest";

import {
  createRuleSeedKey,
  normalizeRuleSeedKey,
  reconcileContainerSeed,
  rotateContainerSeed,
  rotateRuleSeedKey,
  stripRuleSeedKey,
  withContainerSeed,
  withFallbackSeed,
  withRuleSeedKey,
} from "@/shared/rule-seed";

describe("rule seed helpers", () => {
  it("creates six-character lowercase base36 keys", () => {
    expect(createRuleSeedKey()).toMatch(/^[a-z0-9]{6}$/);
  });

  it("normalizes invalid keys by replacing them", () => {
    expect(normalizeRuleSeedKey("ABC123")).toBe("abc123");
    expect(normalizeRuleSeedKey("bad-key")).toMatch(/^[a-z0-9]{6}$/);
  });

  it("adds a normalized key to rules", () => {
    expect(
      withRuleSeedKey({
        pattern: "example.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "ABC123",
      }).ruleSeedKey,
    ).toBe("abc123");
  });

  it("rotates only the targeted rule", () => {
    const rules = [
      {
        pattern: "example.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "abc123",
      },
      {
        pattern: "other.com",
        locationId: "paris",
        enabled: true,
        ruleSeedKey: "def456",
      },
    ];

    const rotated = rotateRuleSeedKey(rules, "example.com");

    expect(rotated[0]?.ruleSeedKey).toMatch(/^[a-z0-9]{6}$/);
    expect(rotated[0]?.ruleSeedKey).not.toBe("abc123");
    expect(rotated[1]?.ruleSeedKey).toBe("def456");
  });

  it("assigns a seed key to a container assignment when missing", () => {
    const assignment = withContainerSeed({
      cookieStoreId: "firefox-container-1",
      locationId: "berlin",
    });

    expect(assignment.ruleSeedKey).toMatch(/^[a-z0-9]{6}$/);
  });

  it("normalizes existing container assignment seed keys", () => {
    const assignment = withContainerSeed({
      cookieStoreId: "firefox-container-1",
      locationId: "berlin",
      ruleSeedKey: "ABC123",
    });

    expect(assignment.ruleSeedKey).toBe("abc123");
  });

  it("assigns a normalized key to the global fallback rule", () => {
    const fallbackRule = withFallbackSeed({
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "ABC123",
    });

    expect(fallbackRule.ruleSeedKey).toBe("abc123");
  });

  it("assigns an auth key to the global fallback rule when missing", () => {
    const fallbackRule = withFallbackSeed({
      enabled: true,
      ruleSeedKey: "abc123",
    });

    expect(fallbackRule.authKey).toMatch(/^[a-z0-9]{8}$/);
  });

  it("keeps the global fallback auth key independent of the seed key", () => {
    const fallbackRule = withFallbackSeed({
      enabled: true,
      ruleSeedKey: "abc123",
      authKey: "a1b2c3d4",
    });

    // Rotating the seed must not disturb the once-minted authKey nonce.
    const rotated = withFallbackSeed({
      ...fallbackRule,
      ruleSeedKey: "zzz999",
    });

    expect(rotated.authKey).toBe("a1b2c3d4");
  });

  it("preserves an existing valid global fallback auth key", () => {
    const fallbackRule = withFallbackSeed({
      enabled: true,
      ruleSeedKey: "abc123",
      authKey: "a1b2c3d4",
    });

    expect(fallbackRule.authKey).toBe("a1b2c3d4");
  });

  it("replaces an invalid global fallback auth key", () => {
    const fallbackRule = withFallbackSeed({
      enabled: true,
      ruleSeedKey: "abc123",
      authKey: "invalid-key",
    });

    expect(fallbackRule.authKey).toMatch(/^[a-z0-9]{8}$/);
    expect(fallbackRule.authKey).not.toBe("invalid-key");
  });

  it("rotates only the targeted container assignment", () => {
    const assignments = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: "warsaw",
        ruleSeedKey: "abc123",
      },
      {
        cookieStoreId: "firefox-container-2",
        locationId: "paris",
        ruleSeedKey: "def456",
      },
    ];

    const rotated = rotateContainerSeed(assignments, "firefox-container-1");

    expect(rotated[0]?.ruleSeedKey).toMatch(/^[a-z0-9]{6}$/);
    expect(rotated[0]?.ruleSeedKey).not.toBe("abc123");
    expect(rotated[1]?.ruleSeedKey).toBe("def456");
  });

  it("reconciles container assignment seed without rotating on locationId change", () => {
    const previous = {
      cookieStoreId: "firefox-container-1",
      locationId: "berlin",
      ruleSeedKey: "abcdef",
    };

    const keepSeed = reconcileContainerSeed(
      { cookieStoreId: "firefox-container-1", locationId: "berlin" },
      previous,
    );
    expect(keepSeed.ruleSeedKey).toBe("abcdef");

    const changedLocation = reconcileContainerSeed(
      { cookieStoreId: "firefox-container-1", locationId: "warsaw" },
      previous,
    );
    expect(changedLocation.ruleSeedKey).toBe("abcdef");
  });

  it("strips ruleSeedKey for shape comparisons", () => {
    expect(
      stripRuleSeedKey({
        pattern: "example.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "abc123",
      }),
    ).toEqual({
      pattern: "example.com",
      locationId: "warsaw",
      enabled: true,
    });
  });
});
