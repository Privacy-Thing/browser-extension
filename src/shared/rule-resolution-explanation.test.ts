import { describe, expect, it } from "vitest";

import type { ResolvedRuleSources } from "@/shared/rule-resolution";
import {
  explainRuleResolution,
  type ExplainResolutionParams,
} from "@/shared/rule-resolution-explanation";
import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
} from "@/shared/types";

const base: ResolvedRuleSources = {
  trustedSite: null,
  matchingTrustedSite: null,
  activeRule: null,
  displayedRule: null,
  matchedContainer: null,
  activeContainer: null,
  usableContainer: null,
  runtimeFallbackRule: null,
  previewFallbackRule: null,
  inheritedLocationId: null,
  effectiveLocationId: null,
  winningSource: "none",
};

const mergeResolved = (partial?: Partial<ResolvedRuleSources>): ResolvedRuleSources =>
  ({ ...base, ...(partial ?? {}) }) as unknown as ResolvedRuleSources;

const params = (
  overrides: Partial<Omit<ExplainResolutionParams, "resolved">> & {
    resolved?: Partial<ResolvedRuleSources>;
  },
): ExplainResolutionParams => {
  const { resolved: resolvedOverride, ...rest } = overrides;
  return {
    hostname: "example.com",
    resolved: mergeResolved(resolvedOverride),
    rules: [],
    ...rest,
  };
};

const rule = (pattern: string, locationId: string, enabled = true): DomainRule => ({
  pattern,
  enabled,
  locationId,
});

const fallback = (locationId: string, enabled = true): GlobalFallbackRule => ({
  locationId,
  enabled,
  ruleSeedKey: "seed-fallback",
});

const container = (cookieStoreId: string, locationId: string): ContainerAssignment => ({
  cookieStoreId,
  locationId,
  enabled: true,
});

describe("explainRuleResolution", () => {
  it("trusted site wins — first step is won, others are no-match", () => {
    const result = explainRuleResolution(
      params({
        resolved: {
          trustedSite: { pattern: "example.com", enabled: true },
          winningSource: "trusted-site",
        },
      }),
    );

    expect(result.winningSource).toBe("trusted-site");
    expect(result.steps[0]).toMatchObject({
      source: "trusted-site",
      status: "won",
      pattern: "example.com",
    });
    expect(result.steps.filter((s) => s.status === "won").length).toBe(1);
  });

  it("exact rule wins", () => {
    const r = rule("example.com", "loc-1");
    const result = explainRuleResolution(
      params({
        hostname: "example.com",
        resolved: {
          activeRule: r,
          winningSource: "rule",
          effectiveLocationId: "loc-1",
        },
      }),
    );

    expect(result.winningSource).toBe("rule");
    const ruleStep = result.steps.find((s) => s.source === "exact-rule");
    expect(ruleStep).toMatchObject({
      status: "won",
      pattern: "example.com",
      locationId: "loc-1",
    });
    expect(result.effectiveLocationId).toBe("loc-1");
  });

  it("suffix rule wins", () => {
    const r = rule("example.com", "loc-2");
    const result = explainRuleResolution(
      params({
        hostname: "sub.example.com",
        resolved: {
          activeRule: r,
          winningSource: "rule",
          effectiveLocationId: "loc-2",
        },
      }),
    );

    const ruleStep = result.steps.find((s) => s.source === "suffix-rule");
    expect(ruleStep).toMatchObject({ status: "won", pattern: "example.com" });
  });

  it("exact rule present but disabled", () => {
    const r = rule("example.com", "loc-3", false);
    const result = explainRuleResolution(
      params({
        hostname: "example.com",
        resolved: {
          displayedRule: r,
          winningSource: "none",
        },
      }),
    );

    const ruleStep = result.steps.find((s) => s.source === "exact-rule");
    expect(ruleStep).toMatchObject({ status: "disabled", pattern: "example.com" });
    const suffixStep = result.steps.find((s) => s.source === "suffix-rule");
    expect(suffixStep?.status).toBe("no-match");
  });

  it("container wins", () => {
    const ca = container("store-1", "loc-4");
    const result = explainRuleResolution(
      params({
        resolved: {
          matchedContainer: ca,
          usableContainer: ca,
          winningSource: "container",
          effectiveLocationId: "loc-4",
        },
      }),
    );

    const containerStep = result.steps.find((s) => s.source === "container");
    expect(containerStep).toMatchObject({ status: "won", locationId: "loc-4" });
  });

  it("fallback wins", () => {
    const fb = fallback("loc-5");
    const result = explainRuleResolution(
      params({
        globalFallbackRule: fb,
        fallbackLocationId: "loc-5",
        resolved: {
          winningSource: "fallback",
          effectiveLocationId: "loc-5",
        },
      }),
    );

    const fallbackStep = result.steps.find((s) => s.source === "fallback");
    expect(fallbackStep).toMatchObject({ status: "won", locationId: "loc-5" });
  });

  it("none wins — no-match on all sources, none step present", () => {
    const result = explainRuleResolution(params({}));

    expect(result.winningSource).toBe("none");
    expect(result.steps.find((s) => s.source === "none")).toMatchObject({
      status: "won",
    });
    expect(result.steps.filter((s) => s.status === "won").length).toBe(1);
  });

  it("fingerprint-only fallback wins when fingerprintEnabled is true", () => {
    // Default Rule enabled, no locationId, but global fingerprint spoofing is on.
    // resolveRuleSources returns winningSource:"none" (no locationId on fallback),
    // but explainRuleResolution must promote it to "fallback" to match popup behaviour.
    const fb: GlobalFallbackRule = { enabled: true, ruleSeedKey: "seed-fp" };
    const result = explainRuleResolution(
      params({
        globalFallbackRule: fb,
        fingerprintEnabled: true,
        resolved: { winningSource: "none" },
      }),
    );

    expect(result.winningSource).toBe("fallback");
    const fallbackStep = result.steps.find((s) => s.source === "fallback");
    expect(fallbackStep).toMatchObject({ status: "won" });
    expect(result.steps.find((s) => s.source === "none")).toBeUndefined();
  });

  it("fingerprint-only fallback stays none when fingerprintEnabled is false", () => {
    const fb: GlobalFallbackRule = { enabled: true, ruleSeedKey: "seed-fp" };
    const result = explainRuleResolution(
      params({
        globalFallbackRule: fb,
        fingerprintEnabled: false,
        resolved: { winningSource: "none" },
      }),
    );

    expect(result.winningSource).toBe("none");
    expect(result.steps.find((s) => s.source === "none")).toMatchObject({
      status: "won",
    });
  });

  it("fallback disabled — fallback step is no-match", () => {
    const fb = fallback("loc-6", false);
    const result = explainRuleResolution(
      params({
        globalFallbackRule: fb,
        fallbackLocationId: "loc-6",
        resolved: { winningSource: "none" },
      }),
    );

    const fallbackStep = result.steps.find((s) => s.source === "fallback");
    expect(fallbackStep?.status).toBe("no-match");
  });

  it("steps always cover all 5 non-none sources when no rule matches", () => {
    const result = explainRuleResolution(params({}));
    const sources = result.steps.map((s) => s.source);

    expect(sources).toContain("trusted-site");
    expect(sources).toContain("exact-rule");
    expect(sources).toContain("suffix-rule");
    expect(sources).toContain("container");
    expect(sources).toContain("fallback");
    expect(sources).toContain("none");
  });
});
