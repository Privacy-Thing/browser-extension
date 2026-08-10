/**
 * Domain-pattern matching utilities used for rules and preload caches.
 */

import type { DomainRule } from "@/shared/types";

const compiledMatchers = new Map<string, RegExp>();

type DomainPatternKind =
  "exact" | "apex-and-subdomains" | "subdomains-only" | "wildcard";

export type DomainRuleSpecificity = {
  nonWildcardLength: number;
  exactMatchBonus: 0 | 1;
  subdomainOnlyBonus: 0 | 1;
  wildcardCount: number;
};

export type RuleMatchSet = {
  enabledRule?: DomainRule;
  matchingRule?: DomainRule;
};

type MatchRuleOptions = {
  includeDisabled?: boolean;
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getDomainPatternKind = (pattern: string): DomainPatternKind => {
  if (pattern === "*") {
    return "wildcard";
  }

  if (!pattern.includes("*")) {
    return "exact";
  }

  if (pattern.startsWith("*.")) {
    return "subdomains-only";
  }

  if (
    pattern.startsWith("*") &&
    pattern.length > 1 &&
    !pattern.slice(1).includes("*")
  ) {
    return "apex-and-subdomains";
  }

  return "wildcard";
};

export const getDomainRuleSpecificity = (pattern: string): DomainRuleSpecificity => ({
  nonWildcardLength: pattern.replace(/\*/g, "").length,
  exactMatchBonus: pattern.includes("*") ? 0 : 1,
  subdomainOnlyBonus: getDomainPatternKind(pattern) === "subdomains-only" ? 1 : 0,
  wildcardCount: pattern.match(/\*/g)?.length ?? 0,
});

export const compareRuleSpecificity = (
  candidate: DomainRuleSpecificity,
  currentBest: DomainRuleSpecificity,
): number => {
  if (candidate.nonWildcardLength !== currentBest.nonWildcardLength) {
    return candidate.nonWildcardLength - currentBest.nonWildcardLength;
  }

  if (candidate.exactMatchBonus !== currentBest.exactMatchBonus) {
    return candidate.exactMatchBonus - currentBest.exactMatchBonus;
  }

  if (candidate.subdomainOnlyBonus !== currentBest.subdomainOnlyBonus) {
    return candidate.subdomainOnlyBonus - currentBest.subdomainOnlyBonus;
  }

  if (candidate.wildcardCount !== currentBest.wildcardCount) {
    return currentBest.wildcardCount - candidate.wildcardCount;
  }

  return 0;
};

export const comparePatternRank = (
  candidatePattern: string,
  currentPattern: string,
): number =>
  compareRuleSpecificity(
    getDomainRuleSpecificity(candidatePattern),
    getDomainRuleSpecificity(currentPattern),
  );

export const buildDomainPatternSource = (
  pattern: string,
  {
    wildcardFragment,
    labelFragment,
  }: {
    wildcardFragment: string;
    labelFragment: string;
  },
): string => {
  const kind = getDomainPatternKind(pattern);

  switch (kind) {
    case "apex-and-subdomains": {
      const hostSource = escapeRegex(pattern.slice(1));
      return `(?:${hostSource}|(?:${labelFragment}\\.)+${hostSource})`;
    }
    case "subdomains-only": {
      const hostSource = escapeRegex(pattern.slice(2)).replace(
        /\\\*/g,
        wildcardFragment,
      );
      return `(?:${labelFragment}\\.)+${hostSource}`;
    }
    case "exact":
    case "wildcard":
    default:
      return escapeRegex(pattern).replace(/\\\*/g, wildcardFragment);
  }
};

export const buildHostnamePattern = (pattern: string): string =>
  buildDomainPatternSource(pattern, {
    wildcardFragment: ".*",
    labelFragment: "[^.]+",
  });

/** Compiles a wildcard domain pattern into a cached case-insensitive matcher. */
export const compileDomainPattern = (pattern: string): RegExp => {
  const cached = compiledMatchers.get(pattern);
  if (cached) {
    return cached;
  }

  const source = `^${buildHostnamePattern(pattern)}$`;
  const compiled = new RegExp(source, "i");
  compiledMatchers.set(pattern, compiled);
  return compiled;
};

/**
 * Returns both the most specific enabled rule and the most specific matching
 * rule regardless of enabled state, so callers that need both views can avoid
 * scanning the same rule list twice.
 */
export const findRuleMatches = (
  hostname: string,
  rules: readonly DomainRule[],
): RuleMatchSet => {
  let bestEnabledRule: DomainRule | undefined;
  let bestEnabledSpecificity: DomainRuleSpecificity | undefined;
  let bestMatchingRule: DomainRule | undefined;
  let bestMatchingSpecificity: DomainRuleSpecificity | undefined;

  for (const rule of rules) {
    if (!compileDomainPattern(rule.pattern).test(hostname)) {
      continue;
    }

    const specificity = getDomainRuleSpecificity(rule.pattern);

    if (
      !bestMatchingSpecificity ||
      compareRuleSpecificity(specificity, bestMatchingSpecificity) > 0
    ) {
      bestMatchingRule = rule;
      bestMatchingSpecificity = specificity;
    }

    if (!rule.enabled) {
      continue;
    }

    if (
      !bestEnabledSpecificity ||
      compareRuleSpecificity(specificity, bestEnabledSpecificity) > 0
    ) {
      bestEnabledRule = rule;
      bestEnabledSpecificity = specificity;
    }
  }

  return {
    ...(bestEnabledRule ? { enabledRule: bestEnabledRule } : {}),
    ...(bestMatchingRule ? { matchingRule: bestMatchingRule } : {}),
  };
};

/**
 * Returns the most specific matching rule for a hostname, optionally including
 * disabled rules for popup/editor flows.
 */
export const findMostSpecificRule = (
  hostname: string,
  rules: readonly DomainRule[],
  { includeDisabled = false }: MatchRuleOptions = {},
): DomainRule | undefined => {
  const matches = findRuleMatches(hostname, rules);
  return includeDisabled ? matches.matchingRule : matches.enabledRule;
};

/**
 * Returns the most specific enabled rule that matches a hostname. Specificity
 * is approximated by the number of non-wildcard characters in the pattern.
 */
export const matchRule = (
  hostname: string,
  _cookieStoreId: string | undefined,
  rules: readonly DomainRule[],
): DomainRule | undefined => findRuleMatches(hostname, rules).enabledRule;
