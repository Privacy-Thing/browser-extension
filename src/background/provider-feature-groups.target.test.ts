import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerFeatureProviders } from "./feature-provider-registry";
import { loadFeatureState } from "./storage/provider-features";
import { loadRules, RULES_STORAGE_KEY, saveRules } from "./storage/rules";

import type { DomainRule } from "@/shared/types";

const data: Record<string, unknown> = {};
const primary: DomainRule = {
  pattern: "video.example.com",
  enabled: true,
  locationId: "warsaw",
  ruleSeedKey: "abc123",
  authKey: "abcdefgh",
};
const other: DomainRule = {
  pattern: "media.example.com",
  enabled: true,
  locationId: "lisbon",
  ruleSeedKey: "def456",
  authKey: "ijklmnop",
};
const decision = { providerId: "example", featureId: "video" };

beforeEach(() => {
  Object.keys(data).forEach((key) => Reflect.deleteProperty(data, key));
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[]) =>
          Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys])
              .filter((key) => key in data)
              .map((key) => [key, data[key]]),
          ),
        ),
        set: vi.fn(async (values: Record<string, unknown>) => {
          Object.assign(data, values);
        }),
      },
    },
  });
  registerFeatureProviders([
    {
      id: "example",
      name: "Example",
      capabilities: { catalogue: true, domainRecognition: true, ruleSync: true },
      getStatus: async () => ({ available: true, syncStatus: "ready", error: null }),
      getFeatures: async () => [
        { providerId: "example", featureId: "video", type: "service", name: "Video" },
      ],
      recognizeDomain: vi.fn(),
    },
  ]);
});
afterEach(() => {
  registerFeatureProviders([]);
  vi.unstubAllGlobals();
});

describe("atomic feature rule save", () => {
  it("rejects a stale join instead of overwriting the target configuration", async () => {
    await saveRules([primary], { ...decision, rulePattern: primary.pattern });
    await saveRules([{ ...primary, locationId: "berlin" }]);
    const before = await loadRules();
    const bindings = (await loadFeatureState()).featureBindings;
    await expect(
      saveRules([primary, other], {
        ...decision,
        rulePattern: other.pattern,
        joinExisting: true,
      }),
    ).rejects.toThrow("linked rule changed");
    expect(await loadRules()).toEqual(before);
    expect((await loadFeatureState()).featureBindings).toEqual(bindings);
  });
  it("rejects a stale join after the target binding has been removed", async () => {
    await saveRules([primary], { ...decision, rulePattern: primary.pattern });
    await saveRules([primary], {
      ...decision,
      rulePattern: primary.pattern,
      featureId: null,
    });
    await expect(
      saveRules([primary, other], {
        ...decision,
        rulePattern: other.pattern,
        joinExisting: true,
      }),
    ).rejects.toThrow("linked rule changed");
    expect((await loadRules()).map((rule) => rule.pattern)).toEqual([primary.pattern]);
    expect((await loadFeatureState()).featureBindings).toEqual([]);
  });
  it("links an unsaved domain and preserves ordinary rule identity", async () => {
    await saveRules([primary], { ...decision, rulePattern: primary.pattern });
    expect((await loadRules())[0]).toEqual({ ...primary, relaxCspForWorkers: false });
    expect((await loadFeatureState()).featureBindings[0]).toMatchObject({
      rulePattern: primary.pattern,
      featureId: "video",
    });
  });
  it("requires an explicit merge, then shares the existing configuration", async () => {
    await saveRules([primary], { ...decision, rulePattern: primary.pattern });
    await expect(
      saveRules([primary, other], { ...decision, rulePattern: other.pattern }),
    ).rejects.toThrow("Choose Add");
    expect(data[RULES_STORAGE_KEY]).toEqual([primary]);
    expect((await loadFeatureState()).featureBindings).toEqual([
      expect.objectContaining({ rulePattern: primary.pattern, featureId: "video" }),
    ]);
    const joined = await saveRules([primary, other], {
      ...decision,
      rulePattern: other.pattern,
      joinExisting: true,
    });
    expect(joined[0]?.groupId).toEqual(joined[1]?.groupId);
    expect(joined[1]).toEqual({
      ...primary,
      pattern: other.pattern,
      groupId: joined[0]?.groupId,
    });
    expect((await loadFeatureState()).featureBindings[0]?.rulePatterns).toEqual([
      primary.pattern,
      other.pattern,
    ]);
    expect((await loadFeatureState()).featureBindings).toHaveLength(1);
  });
  it("keeps the existing canonical host first when the new host is stored first", async () => {
    await saveRules([primary], { ...decision, rulePattern: primary.pattern });
    const joined = await saveRules([other, primary], {
      ...decision,
      rulePattern: other.pattern,
      joinExisting: true,
    });
    expect(joined.map((rule) => rule.pattern)).toEqual([
      primary.pattern,
      other.pattern,
    ]);
    expect(joined[0]?.authKey).toBe(primary.authKey);
    expect(joined[1]?.authKey).toBe(primary.authKey);
    expect(joined[0]?.groupId).toEqual(joined[1]?.groupId);
    const binding = (await loadFeatureState()).featureBindings[0];
    expect(binding?.rulePattern).toBe(primary.pattern);
    expect(binding?.rulePatterns).toEqual([primary.pattern, other.pattern]);
  });
  it("renames a member, edits shared settings, promotes a surviving host and detaches to domain rules", async () => {
    await saveRules([primary], { ...decision, rulePattern: primary.pattern });
    let rules = await saveRules([primary, other], {
      ...decision,
      rulePattern: other.pattern,
      joinExisting: true,
    });
    const renamed = {
      ...rules[1]!,
      pattern: "renamed.example.com",
      locationId: "berlin",
    };
    rules = await saveRules([rules[0]!, renamed]);
    expect(rules.every((rule) => rule.locationId === "berlin")).toBe(true);
    expect((await loadFeatureState()).featureBindings[0]?.rulePatterns).toEqual([
      primary.pattern,
      renamed.pattern,
    ]);
    rules = await saveRules([renamed]);
    expect((await loadFeatureState()).featureBindings[0]?.rulePattern).toBe(
      renamed.pattern,
    );
    const groupId = rules[0]?.groupId;
    expect(groupId).toEqual(expect.any(String));
    await saveRules(rules, {
      ...decision,
      featureId: null,
      rulePattern: renamed.pattern,
    });
    expect((await loadFeatureState()).featureBindings).toEqual([]);
    expect((await loadRules())[0]?.authKey).toBe(primary.authKey);
    expect((await loadRules())[0]?.pattern).toBe(renamed.pattern);
    expect((await loadRules())[0]?.groupId).toBe(groupId);
  });

  it("rejects a normalized duplicate, a blank pattern, and a URL without saving", async () => {
    await saveRules([primary], { ...decision, rulePattern: primary.pattern });
    const persisted = data[RULES_STORAGE_KEY];
    const bindings = (await loadFeatureState()).featureBindings;
    await expect(
      saveRules([primary, { ...other, pattern: "VIDEO.example.com" }]),
    ).rejects.toThrow("Duplicate rule pattern: video.example.com");
    await expect(saveRules([{ ...primary, pattern: "   " }])).rejects.toThrow(
      "valid domain pattern",
    );
    await expect(
      saveRules([{ ...primary, pattern: "https://video.example.com" }]),
    ).rejects.toThrow("valid domain pattern");
    expect(data[RULES_STORAGE_KEY]).toEqual(persisted);
    expect((await loadFeatureState()).featureBindings).toEqual(bindings);
  });

  it("stores a wildcard and a case change without minting a new identity", async () => {
    const wildcard = await saveRules([{ ...primary, pattern: "*.Example.COM" }]);
    expect(wildcard[0]?.pattern).toBe("*.example.com");
    await saveRules([primary], { ...decision, rulePattern: primary.pattern });
    const saved = await saveRules([
      { ...primary, pattern: "VIDEO.example.com", locationId: "berlin" },
    ]);
    expect(saved[0]).toMatchObject({
      pattern: "video.example.com",
      locationId: "berlin",
      authKey: primary.authKey,
      ruleSeedKey: primary.ruleSeedKey,
    });
    expect((await loadFeatureState()).featureBindings[0]?.rulePattern).toBe(
      "video.example.com",
    );
  });

  it("keeps an unbound custom group and still allows one unbound rule to replace another", async () => {
    const grouped = await saveRules([
      { ...primary, groupId: "custom-group" },
      { ...other, pattern: "cdn.example.com", groupId: "custom-group" },
    ]);
    expect(grouped.map((rule) => rule.groupId)).toEqual([
      "custom-group",
      "custom-group",
    ]);
    expect(grouped.every((rule) => rule.authKey === primary.authKey)).toBe(true);
    expect(grouped.every((rule) => rule.locationId === primary.locationId)).toBe(true);
    expect((await loadFeatureState()).featureBindings).toEqual([]);
    await saveRules([primary, other]);
    const replaced = await saveRules([
      { ...primary, pattern: other.pattern, locationId: "berlin" },
    ]);
    expect(replaced).toHaveLength(1);
    expect(replaced[0]).toMatchObject({
      pattern: other.pattern,
      locationId: "berlin",
      authKey: primary.authKey,
    });
    expect(replaced[0]?.groupId).toBeUndefined();
  });

  it("lets one unbound rule become a custom group with a new host", async () => {
    await saveRules([primary]);
    const saved = await saveRules([
      { ...primary, groupId: "custom-group" },
      { ...primary, pattern: "cdn.example.com", groupId: "custom-group" },
    ]);
    expect(saved.map((rule) => rule.pattern)).toEqual([
      primary.pattern,
      "cdn.example.com",
    ]);
    expect(saved.every((rule) => rule.groupId === "custom-group")).toBe(true);
    expect(saved.every((rule) => rule.authKey === primary.authKey)).toBe(true);
    expect((await loadFeatureState()).featureBindings).toEqual([]);
  });

  it("rejects merging two unbound rules or claiming another group's host", async () => {
    await saveRules([primary, other]);
    await expect(
      saveRules([
        { ...primary, groupId: "custom-group" },
        { ...other, groupId: "custom-group" },
      ]),
    ).rejects.toThrow("another rule");
    expect((await loadRules()).map((rule) => rule.groupId)).toEqual([
      undefined,
      undefined,
    ]);
    const grouped = await saveRules([
      { ...primary, groupId: "group-a" },
      { ...primary, pattern: "cdn.example.com", groupId: "group-a" },
      { ...other, groupId: "group-b" },
    ]);
    const persisted = data[RULES_STORAGE_KEY];
    await expect(
      saveRules([grouped[0]!, grouped[1]!, { ...grouped[2]!, groupId: "group-a" }]),
    ).rejects.toThrow("another rule");
    await expect(
      saveRules([{ ...other, pattern: "taken.example.com", groupId: "group-a" }]),
    ).rejects.toThrow("another rule");
    expect(data[RULES_STORAGE_KEY]).toEqual(persisted);
    expect((await loadFeatureState()).featureBindings).toEqual([]);
  });

  it("adopts the existing group when a new host is listed first", async () => {
    let rules = await saveRules(
      [
        { ...primary, groupId: "group-a" },
        { ...primary, pattern: "cdn.example.com", groupId: "group-a" },
      ],
      { ...decision, rulePattern: primary.pattern },
    );
    rules = await saveRules([
      { ...other, pattern: "extra.example.com", groupId: "group-a" },
      ...rules,
    ]);
    expect(rules.map((rule) => rule.pattern)).toEqual([
      primary.pattern,
      "cdn.example.com",
      "extra.example.com",
    ]);
    expect(rules.every((rule) => rule.locationId === primary.locationId)).toBe(true);
    expect(rules.every((rule) => rule.authKey === primary.authKey)).toBe(true);
    expect(rules.every((rule) => rule.ruleSeedKey === primary.ruleSeedKey)).toBe(true);
    const binding = (await loadFeatureState()).featureBindings[0];
    expect(binding?.rulePattern).toBe(primary.pattern);
    expect(binding?.rulePatterns).toEqual([
      primary.pattern,
      "cdn.example.com",
      "extra.example.com",
    ]);
  });

  it("keeps one canonical binding when joining a group that uses another preset", async () => {
    const linked = await saveRules(
      [
        { ...primary, groupId: "group-a" },
        { ...primary, pattern: "cdn.example.com", groupId: "group-a" },
      ],
      { ...decision, rulePattern: primary.pattern },
    );
    const separate = await saveRules([
      ...linked,
      { ...other, groupId: "group-b" },
      { ...other, pattern: "static.example.com", groupId: "group-b" },
    ]);
    const persisted = data[RULES_STORAGE_KEY];
    const bindings = (await loadFeatureState()).featureBindings;
    await expect(
      saveRules(separate, { ...decision, rulePattern: other.pattern }),
    ).rejects.toThrow("Choose Add");
    expect(data[RULES_STORAGE_KEY]).toEqual(persisted);
    expect((await loadFeatureState()).featureBindings).toEqual(bindings);
    const joined = await saveRules(separate, {
      ...decision,
      rulePattern: other.pattern,
      joinExisting: true,
    });
    expect(joined.map((rule) => rule.pattern)).toEqual([
      primary.pattern,
      "cdn.example.com",
      other.pattern,
      "static.example.com",
    ]);
    expect(new Set(joined.map((rule) => rule.groupId)).size).toBe(1);
    expect(
      joined.every(
        (rule) =>
          rule.locationId === primary.locationId &&
          rule.authKey === primary.authKey &&
          rule.ruleSeedKey === primary.ruleSeedKey,
      ),
    ).toBe(true);
    const joinedBindings = (await loadFeatureState()).featureBindings;
    expect(joinedBindings).toHaveLength(1);
    expect(joinedBindings[0]?.rulePattern).toBe(primary.pattern);
    expect(joinedBindings[0]?.rulePatterns).toEqual(joined.map((rule) => rule.pattern));
  });
});
