import { describe, expect, it } from "vitest";

import {
  comparePatternRank,
  compileDomainPattern,
  findMostSpecificRule,
  getDomainRuleSpecificity,
  matchRule,
} from "@/shared/domain-match";

describe("domain matching", () => {
  it("keeps *.example.com as subdomain-only", () => {
    expect(compileDomainPattern("*.example.com").test("api.example.com")).toBe(true);
    expect(compileDomainPattern("*.example.com").test("example.com")).toBe(false);
  });

  it("treats *example.com as apex plus subdomains, not a raw suffix", () => {
    const matcher = compileDomainPattern("*example.com");

    expect(matcher.test("example.com")).toBe(true);
    expect(matcher.test("api.example.com")).toBe(true);
    expect(matcher.test("fooexample.com")).toBe(false);
  });

  it("prefers the most specific hostname match", () => {
    const match = matchRule("shop.example.com", "work", [
      { pattern: "*.example.com", locationId: "default", enabled: true },
      { pattern: "shop.example.com", locationId: "work", enabled: true },
    ]);

    expect(match?.locationId).toBe("work");
  });

  it("ignores disabled rules", () => {
    const match = matchRule("shop.example.com", undefined, [
      { pattern: "shop.example.com", locationId: "work", enabled: false },
      { pattern: "*.example.com", locationId: "fallback", enabled: true },
    ]);

    expect(match?.locationId).toBe("fallback");
  });

  it("can return the most specific disabled rule for popup editing", () => {
    const match = findMostSpecificRule(
      "shop.example.com",
      [
        { pattern: "shop.example.com", locationId: "exact", enabled: false },
        { pattern: "*.example.com", locationId: "fallback", enabled: true },
      ],
      { includeDisabled: true },
    );

    expect(match?.locationId).toBe("exact");
  });

  it("prefers exact apex rules over suffix rules for the same host", () => {
    const match = matchRule("example.com", undefined, [
      { pattern: "*example.com", locationId: "suffix", enabled: true },
      { pattern: "example.com", locationId: "exact", enabled: true },
    ]);

    expect(match?.locationId).toBe("exact");
  });

  it("still applies suffix rules to subdomains when exact apex rule exists", () => {
    const match = matchRule("shop.example.com", undefined, [
      { pattern: "example.com", locationId: "exact", enabled: true },
      { pattern: "*example.com", locationId: "suffix", enabled: true },
    ]);

    expect(match?.locationId).toBe("suffix");
  });

  it("scores exact rules above equally specific suffix rules", () => {
    expect(getDomainRuleSpecificity("example.com")).toEqual({
      nonWildcardLength: 11,
      exactMatchBonus: 1,
      subdomainOnlyBonus: 0,
      wildcardCount: 0,
    });
    expect(getDomainRuleSpecificity("*example.com")).toEqual({
      nonWildcardLength: 11,
      exactMatchBonus: 0,
      subdomainOnlyBonus: 0,
      wildcardCount: 1,
    });
  });

  it("treats *.example.com as more specific than *example.com", () => {
    expect(comparePatternRank("*.example.com", "*example.com")).toBeGreaterThan(0);
  });

  it("keeps mid-pattern wildcards on the broad matching path", () => {
    expect(compileDomainPattern("*a*b.example.com").test("zaab.example.com")).toBe(
      true,
    );
    expect(compileDomainPattern("*a*b.example.com").test("aab.example.com")).toBe(true);
  });
});
