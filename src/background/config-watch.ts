import { getRegistrableHostname } from "@/background/state-hygiene";
import { compileDomainPattern } from "@/shared/domain-match";
import { stripRuleSeedKey } from "@/shared/rule-seed";
import type { DomainRule, EffectiveTabContext, Location } from "@/shared/types";

const getRuleHostCandidates = (pattern: string): string[] => {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized || normalized === "*") {
    return [];
  }

  return [normalized.replace(/^\*\./, "").replace(/\*/g, "")].filter(Boolean);
};

const indexLocations = (locations: readonly Location[]): Map<string, Location> =>
  new Map(locations.map((location) => [location.id, location]));

const sameLocationShape = (
  left: Location | undefined,
  right: Location | undefined,
): boolean => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

const haveRulesEquivalentShape = (
  left: DomainRule | undefined,
  right: DomainRule | undefined,
): boolean =>
  JSON.stringify(left ? stripRuleSeedKey(left) : null) ===
  JSON.stringify(right ? stripRuleSeedKey(right) : null);

const addPatternHostCandidates = (hostnames: Set<string>, pattern: string): void => {
  for (const hostname of getRuleHostCandidates(pattern)) {
    hostnames.add(hostname);
  }
};

const collectChangedPatterns = (
  previousRuleMap: ReadonlyMap<string, DomainRule>,
  nextRuleMap: ReadonlyMap<string, DomainRule>,
  hostnames: Set<string>,
): Set<string> => {
  const changedPatterns = new Set<string>();

  for (const pattern of new Set([...previousRuleMap.keys(), ...nextRuleMap.keys()])) {
    const previousRule = previousRuleMap.get(pattern);
    const nextRule = nextRuleMap.get(pattern);

    if (haveRulesEquivalentShape(previousRule, nextRule)) {
      continue;
    }

    changedPatterns.add(pattern);
    addPatternHostCandidates(hostnames, pattern);
  }

  return changedPatterns;
};

export const sameRuleShape = (
  previousRules: readonly DomainRule[],
  nextRules: readonly DomainRule[],
): boolean => {
  if (previousRules.length !== nextRules.length) {
    return false;
  }

  const normalizeRules = (rules: readonly DomainRule[]) =>
    [...rules].map((rule) => JSON.stringify(stripRuleSeedKey(rule))).sort();

  const normalizedPreviousRules = normalizeRules(previousRules);
  const normalizedNextRules = normalizeRules(nextRules);

  return normalizedPreviousRules.every(
    (rule, index) => rule === normalizedNextRules[index],
  );
};

type AffectedHostInput = {
  previousRules: readonly DomainRule[];
  nextRules: readonly DomainRule[];
  previousLocations: readonly Location[];
  nextLocations: readonly Location[];
  activeContexts: readonly EffectiveTabContext[];
};

export const collectAffectedHostnames = ({
  previousRules,
  nextRules,
  previousLocations,
  nextLocations,
  activeContexts,
}: AffectedHostInput): string[] => {
  const hostnames = new Set<string>();
  const previousLocationMap = indexLocations(previousLocations);
  const nextLocationMap = indexLocations(nextLocations);
  const activeContextHostnames = new Set<string>();
  const previousRuleMap = new Map(previousRules.map((rule) => [rule.pattern, rule]));
  const nextRuleMap = new Map(nextRules.map((rule) => [rule.pattern, rule]));
  const changedPatterns = collectChangedPatterns(
    previousRuleMap,
    nextRuleMap,
    hostnames,
  );

  for (const rule of previousRules) {
    if (!rule.locationId) {
      continue;
    }

    const before = previousLocationMap.get(rule.locationId);
    const after = nextLocationMap.get(rule.locationId);

    if (!sameLocationShape(before, after)) {
      changedPatterns.add(rule.pattern);
      addPatternHostCandidates(hostnames, rule.pattern);
    }
  }

  for (const context of activeContexts) {
    const normalizedHostname = getRegistrableHostname(context.hostname);
    if (
      [...changedPatterns].some((pattern) =>
        compileDomainPattern(pattern).test(normalizedHostname),
      )
    ) {
      activeContextHostnames.add(normalizedHostname);
    }
  }

  for (const hostname of activeContextHostnames) {
    hostnames.add(hostname);
  }

  return [...hostnames];
};
