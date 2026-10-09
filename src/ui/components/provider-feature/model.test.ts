import { describe, expect, it } from "vitest";

import {
  resolveFeatureView,
  type ProviderFeature,
  type ProviderFeatureMatch,
  type RuleFeatureBinding,
} from "./model";

const youtube: ProviderFeature = {
  providerId: "provider",
  featureId: "youtube",
  type: "service",
  name: "YouTube",
};

const match = (
  overrides: Partial<ProviderFeatureMatch> = {},
): ProviderFeatureMatch => ({
  hostname: "www.youtube.com",
  providerId: "provider",
  featureId: "youtube",
  matchSource: "domain-test",
  status: "matched",
  checkedAt: "2026-10-09T12:00:00.000Z",
  ...overrides,
});

const binding: RuleFeatureBinding = {
  rulePattern: "*.youtube.com",
  providerId: "provider",
  featureId: "youtube",
  featureName: "YouTube",
  featureType: "service",
};

const base = { binding: null, busy: false, dismissed: false, features: [youtube] };

describe("resolveFeatureView", () => {
  it("suggests a matched feature without binding it", () => {
    expect(resolveFeatureView({ ...base, match: match() })).toEqual({
      view: "suggested",
      suggestion: youtube,
    });
  });

  it("treats a matched id missing from the catalogue as unresolved", () => {
    expect(
      resolveFeatureView({ ...base, match: match({ featureId: "gone" }) }).view,
    ).toBe("unresolved");
  });

  it.each([
    [{ match: null }, "idle"],
    [{ match: null, busy: true }, "checking"],
    [{ match: match({ status: "unresolved", featureId: null }) }, "unresolved"],
    [{ match: match({ status: "error", featureId: null }) }, "error"],
    [{ match: match(), dismissed: true }, "dismissed"],
  ] as const)("resolves %o to %s", (overrides, view) => {
    expect(resolveFeatureView({ ...base, ...overrides }).view).toBe(view);
  });

  it("keeps an explicit binding authoritative over dismissal and errors", () => {
    expect(
      resolveFeatureView({
        ...base,
        binding,
        dismissed: true,
        busy: true,
        match: match({ status: "error" }),
      }).view,
    ).toBe("bound");
  });
});
