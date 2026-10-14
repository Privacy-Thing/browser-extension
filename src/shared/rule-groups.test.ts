import { describe, expect, it } from "vitest";

import type { RuleFeatureBinding } from "./provider-feature";
import {
  flattenCompatibleGroups,
  getRuleGroupPatterns,
  getRuleGroupSource,
  legacyGroupId,
  migrateLegacyRuleGroups,
  orderGroupAroundSource,
  projectFeatureBindings,
  sanitizeRuleGroups,
  synchronizeRuleGroups,
} from "./rule-groups";
import type { DomainRule } from "./types";

const loopback = {
  pattern: "loopback.example",
  enabled: true,
  locationId: "warsaw",
  ruleSeedKey: "abc123",
  authKey: "abcdefgh",
} satisfies DomainRule;
const media = {
  pattern: "media.example",
  enabled: true,
  locationId: "lisbon",
  ruleSeedKey: "def456",
  authKey: "ijklmnop",
} satisfies DomainRule;
const binding = (
  patterns: readonly string[],
  rulePattern = patterns[0] ?? "",
): RuleFeatureBinding => ({
  rulePattern,
  ...(patterns.length > 1 ? { rulePatterns: [...patterns] } : {}),
  providerId: "example",
  featureId: "video",
  featureName: "Video",
  featureType: "service",
});

describe("product rule groups", () => {
  it("returns the matching rule and does not group rules that only share an auth key", () => {
    const copy = { ...loopback, pattern: media.pattern };
    expect(getRuleGroupPatterns([loopback, copy], loopback.pattern)).toEqual([
      loopback.pattern,
    ]);
    expect(getRuleGroupSource([loopback, copy], media.pattern)).toEqual(copy);
    expect(synchronizeRuleGroups([loopback, copy], [loopback, copy])).toEqual([
      loopback,
      copy,
    ]);
  });

  it("keeps the existing canonical host first for projection", () => {
    const grouped = [
      {
        ...media,
        groupId: "group-1",
        authKey: loopback.authKey,
        ruleSeedKey: loopback.ruleSeedKey,
        locationId: loopback.locationId,
      },
      { ...loopback, groupId: "group-1" },
    ];
    const linked = binding([loopback.pattern, media.pattern], loopback.pattern);
    expect(projectFeatureBindings([linked], grouped)[0]?.rulePattern).toBe(
      media.pattern,
    );
    const ordered = orderGroupAroundSource(grouped, loopback.pattern, [
      loopback.pattern,
      media.pattern,
    ]);
    expect(ordered.map((rule) => rule.pattern)).toEqual([
      loopback.pattern,
      media.pattern,
    ]);
    expect(projectFeatureBindings([linked], ordered)[0]).toMatchObject({
      rulePattern: loopback.pattern,
      rulePatterns: [loopback.pattern, media.pattern],
    });
  });

  it("propagates one member's settings and rejects conflicting edits", () => {
    const grouped = [
      { ...loopback, groupId: "group-1" },
      { ...loopback, pattern: media.pattern, groupId: "group-1" },
    ];
    const changed = { ...grouped[1]!, locationId: "berlin" };
    expect(synchronizeRuleGroups(grouped, [grouped[0]!, changed])[0]?.locationId).toBe(
      "berlin",
    );
    expect(() =>
      synchronizeRuleGroups(grouped, [
        { ...grouped[0]!, locationId: "lisbon" },
        { ...grouped[1]!, locationId: "berlin" },
      ]),
    ).toThrow("conflicting settings");
  });

  it("assigns one stable legacy id and skips members with different auth keys", () => {
    const rules = [loopback, { ...loopback, pattern: media.pattern }];
    const migrated = migrateLegacyRuleGroups(rules, [
      binding([loopback.pattern, media.pattern]),
    ]);
    const groupId = legacyGroupId([loopback.pattern, media.pattern]);
    expect(migrated.changed).toBe(true);
    expect(migrated.rules.map((rule) => rule.groupId)).toEqual([groupId, groupId]);
    expect(
      migrateLegacyRuleGroups(migrated.rules, [
        binding([loopback.pattern, media.pattern]),
      ]).changed,
    ).toBe(false);
    const conflict = migrateLegacyRuleGroups(
      [loopback, media],
      [binding([loopback.pattern, media.pattern])],
    );
    expect(conflict.changed).toBe(false);
    expect(conflict.rules.map((rule) => rule.authKey)).toEqual([
      loopback.authKey,
      media.authKey,
    ]);
  });

  it("flattens a compatible group without replacing a different valid auth key", () => {
    const grouped = [
      { ...loopback, groupId: "group-1" },
      {
        ...media,
        groupId: "group-1",
        authKey: loopback.authKey,
        ruleSeedKey: loopback.ruleSeedKey,
      },
    ];
    expect(flattenCompatibleGroups(grouped)[1]?.locationId).toBe(loopback.locationId);
    const conflict = flattenCompatibleGroups([
      { ...loopback, groupId: "group-1" },
      { ...media, groupId: "group-1" },
    ]);
    expect(conflict.map((rule) => rule.authKey)).toEqual([
      loopback.authKey,
      media.authKey,
    ]);
  });

  it("rejects an imported group whose stored auth keys differ", () => {
    const preserved = new Map([
      [
        loopback.pattern,
        { authKey: loopback.authKey, ruleSeedKey: loopback.ruleSeedKey },
      ],
      [media.pattern, { authKey: media.authKey, ruleSeedKey: media.ruleSeedKey }],
    ]);
    expect(() =>
      sanitizeRuleGroups(
        [
          { ...loopback, groupId: "group-1" },
          { ...media, groupId: "group-1" },
        ],
        preserved,
      ),
    ).toThrow("conflicting auth keys");
  });
});
