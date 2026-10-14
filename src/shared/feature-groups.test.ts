import { describe, expect, it } from "vitest";

import { copyGroupSettings, synchronizeFeatureGroups } from "./feature-groups";
import { validateFeatureBindings, type RuleFeatureBinding } from "./provider-feature";
import { resolveRuleSources } from "./rule-resolution";
import type { DomainRule } from "./types";

const primary: DomainRule = {
  pattern: "video.example",
  enabled: true,
  locationId: "warsaw",
  ruleSeedKey: "abc123",
  authKey: "persisted-primary-nonce",
};
const secondary = copyGroupSettings(primary, { ...primary, pattern: "media.example" });
const group: RuleFeatureBinding = {
  rulePattern: primary.pattern,
  rulePatterns: [primary.pattern, secondary.pattern],
  providerId: "example",
  featureId: "video",
  featureName: "Video",
  featureType: "service",
};

describe("flat feature groups", () => {
  it("propagates one member's location and protection settings before resolution", () => {
    const changed = {
      ...secondary,
      locationId: "lisbon",
      fingerprintSurfaceOverrides: { canvas: false },
    };
    const next = synchronizeFeatureGroups(
      [primary, secondary],
      [primary, changed],
      [group],
    );
    expect(next[0]).toEqual({ ...changed, pattern: primary.pattern });
    expect(next[1]).toEqual(changed);
    expect(
      next.every(
        (rule) =>
          rule.authKey === primary.authKey && rule.ruleSeedKey === primary.ruleSeedKey,
      ),
    ).toBe(true);
  });
  it("propagates disable and preserves unrelated rules", () => {
    const unrelated = {
      ...primary,
      pattern: "unrelated.example",
      authKey: "another-nonce",
    };
    const next = synchronizeFeatureGroups(
      [primary, secondary],
      [{ ...primary, enabled: false }, secondary, unrelated],
      [group],
    );
    expect(next.slice(0, 2).every((rule) => !rule.enabled)).toBe(true);
    expect(next[2]).toBe(unrelated);
  });
  it("rejects contradictory simultaneous edits", () => {
    expect(() =>
      synchronizeFeatureGroups(
        [primary, secondary],
        [
          { ...primary, locationId: "lisbon" },
          { ...secondary, locationId: "berlin" },
        ],
        [group],
      ),
    ).toThrow("conflicting settings");
  });
  it("validates every host and rejects overlapping or duplicate provider groups", () => {
    expect(validateFeatureBindings([group], [primary, secondary])).toEqual([group]);
    expect(() => validateFeatureBindings([group], [primary])).toThrow("Unknown rule");
    expect(() =>
      validateFeatureBindings(
        [
          group,
          {
            ...group,
            rulePattern: secondary.pattern,
            rulePatterns: [secondary.pattern],
            featureId: "other",
          },
        ],
        [primary, secondary],
      ),
    ).toThrow("Conflicting");
  });
  it("rejects contradictory simultaneous identity rotations", () => {
    expect(() =>
      synchronizeFeatureGroups(
        [primary, secondary],
        [
          { ...primary, ruleSeedKey: "def456" },
          { ...secondary, ruleSeedKey: "ghi789" },
        ],
        [group],
      ),
    ).toThrow("conflicting settings or identity");
  });
  it("resolves only configured members with ordinary rule and Trusted Sites precedence", () => {
    const rules = synchronizeFeatureGroups(
      [primary, secondary],
      [primary, secondary],
      [group],
    );
    for (const hostname of [primary.pattern, secondary.pattern]) {
      const resolved = resolveRuleSources({ hostname, rules });
      expect(resolved.activeRule?.authKey).toBe(primary.authKey);
      expect(resolved.activeRule?.ruleSeedKey).toBe(primary.ruleSeedKey);
    }
    expect(resolveRuleSources({ hostname: "other.example", rules }).winningSource).toBe(
      "none",
    );
    expect(
      resolveRuleSources({
        hostname: secondary.pattern,
        rules,
        trustedSites: [{ pattern: secondary.pattern, enabled: true }],
      }).winningSource,
    ).toBe("trusted-site");
    const exact = {
      ...primary,
      pattern: "sub.video.example",
      authKey: "other123",
      locationId: "berlin",
    };
    const broad = rules.map((rule) =>
      rule.pattern === primary.pattern ? { ...rule, pattern: "*.video.example" } : rule,
    );
    expect(
      resolveRuleSources({ hostname: exact.pattern, rules: [...broad, exact] })
        .activeRule,
    ).toBe(exact);
    const container = [
      { cookieStoreId: "firefox-container-1", enabled: true, locationId: "berlin" },
    ];
    expect(
      resolveRuleSources({
        hostname: secondary.pattern,
        cookieStoreId: "firefox-container-1",
        rules,
        containerAssignments: container,
      }).winningSource,
    ).toBe("rule");
    expect(
      resolveRuleSources({
        hostname: "other.example",
        cookieStoreId: "firefox-container-1",
        rules,
        containerAssignments: container,
      }).winningSource,
    ).toBe("container");
  });
});
