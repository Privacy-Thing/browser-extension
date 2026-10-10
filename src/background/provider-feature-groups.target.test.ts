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
});
