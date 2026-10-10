import { afterEach, describe, expect, it, vi } from "vitest";

import { FEATURE_STORAGE_KEY } from "@/background/storage/provider-features";
import { loadRules, RULES_STORAGE_KEY } from "@/background/storage/rules";
import type { RuleFeatureBinding } from "@/shared/provider-feature";
import { legacyGroupId } from "@/shared/rule-groups";
import type { DomainRule } from "@/shared/types";

const data: Record<string, unknown> = {};
const set = vi.fn(async (values: Record<string, unknown>) => {
  Object.assign(data, values);
});
const loopback: DomainRule = {
  pattern: "loopback.example",
  enabled: true,
  locationId: "warsaw",
  ruleSeedKey: "abc123",
  authKey: "abcdefgh",
};
const media: DomainRule = {
  pattern: "media.example",
  enabled: true,
  locationId: "warsaw",
  ruleSeedKey: "abc123",
  authKey: "ijklmnop",
};
const binding = (patterns: readonly string[]): RuleFeatureBinding => ({
  rulePattern: patterns[0] ?? "",
  rulePatterns: [...patterns],
  providerId: "example",
  featureId: "video",
  featureName: "Video",
  featureType: "service",
});

const installStorage = (): void => {
  set.mockClear();
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
        set,
      },
    },
  });
};

describe("product group migration", () => {
  afterEach(() => {
    for (const key of Object.keys(data)) Reflect.deleteProperty(data, key);
    vi.unstubAllGlobals();
  });

  it("persists one legacy group id and leaves it unchanged on the next load", async () => {
    const sibling = { ...loopback, pattern: media.pattern };
    data[RULES_STORAGE_KEY] = [loopback, sibling];
    data[FEATURE_STORAGE_KEY] = {
      featureBindings: [binding([loopback.pattern, sibling.pattern])],
    };
    installStorage();
    const groupId = legacyGroupId([loopback.pattern, sibling.pattern]);
    const first = await loadRules();
    expect(first.map((rule) => rule.groupId)).toEqual([groupId, groupId]);
    expect(first.map((rule) => rule.authKey)).toEqual([
      loopback.authKey,
      loopback.authKey,
    ]);
    expect(set).toHaveBeenCalledTimes(1);
    const second = await loadRules();
    expect(second.map((rule) => rule.groupId)).toEqual([groupId, groupId]);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("does not group or overwrite rules that already have different auth keys", async () => {
    data[RULES_STORAGE_KEY] = [loopback, media];
    data[FEATURE_STORAGE_KEY] = {
      featureBindings: [binding([loopback.pattern, media.pattern])],
    };
    installStorage();
    const loaded = await loadRules();
    expect(loaded.map((rule) => rule.groupId)).toEqual([undefined, undefined]);
    expect(loaded.map((rule) => rule.authKey)).toEqual([
      loopback.authKey,
      media.authKey,
    ]);
    expect(set).not.toHaveBeenCalled();
  });
});
