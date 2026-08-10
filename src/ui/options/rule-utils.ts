import { comparePatternRank, getDomainRuleSpecificity } from "@/shared/domain-match";
import { resolveRuleSources } from "@/shared/rule-resolution";
import type {
  DomainRule,
  GlobalFallbackRule,
  Location,
  TrustedSite,
} from "@/shared/types";
import { t } from "@/ui/i18n";

export type RuleConflictType = "shadowed-by-specific" | "duplicate";

export type RuleConflictAction =
  "remove-duplicate" | "match-related-profile" | "select-related-rule";

export type RuleConflict = {
  type: RuleConflictType;
  message: string;
  relatedRuleIndex: number;
  action: RuleConflictAction;
  actionLabel: string;
};

export type RuleViewModel = {
  conflicts: RuleConflict[];
  index: number;
  locationId: string;
  locationLabel: string;
  profileId: string;
  profileLabel: string;
  rule: DomainRule;
  sortKey: string;
};

export type RuleGroupViewModel = {
  conflictCount: number;
  locationId: string;
  locationLabel: string;
  rules: RuleViewModel[];
};

export type RulePreview = {
  hostname: string;
  winningSource: "rule" | "trusted-site" | "fallback" | "none";
  trustedSite: TrustedSite | null;
  rule: DomainRule | null;
  fallbackRule: GlobalFallbackRule | null;
  location: Location | null;
  profile: Location | null;
  locationProfileActive: boolean;
};

export type RuleConflictActionResult = {
  nextRules: DomainRule[];
  selectedRuleIndex?: number;
};

const normalizePattern = (pattern: string): string => pattern.trim().toLowerCase();

const getSpecificitySortKey = (pattern: string): string => {
  const specificity = getDomainRuleSpecificity(pattern);

  return [
    String(99999 - specificity.nonWildcardLength).padStart(5, "0"),
    String(1 - specificity.exactMatchBonus),
    String(1 - specificity.subdomainOnlyBonus),
    String(specificity.wildcardCount).padStart(5, "0"),
  ].join(":");
};

const getLocationLabelMap = (locations: readonly Location[]): Map<string, string> =>
  new Map(locations.map((location) => [location.id, location.label]));

const patternsMayOverlap = (left: string, right: string): boolean => {
  if (left === right) {
    return true;
  }

  const leftBase = normalizePattern(left).replace(/^\*\./, "").replace(/\*/g, "");
  const rightBase = normalizePattern(right).replace(/^\*\./, "").replace(/\*/g, "");

  if (!leftBase || !rightBase) {
    return false;
  }

  return leftBase.includes(rightBase) || rightBase.includes(leftBase);
};

const createConflict = (
  type: RuleConflictType,
  relatedRuleIndex: number,
  relatedRule: DomainRule,
  relatedLocationLabel: string,
): RuleConflict => {
  switch (type) {
    case "duplicate":
      return {
        type,
        relatedRuleIndex,
        message: `Duplicate rule also exists as ${relatedRule.pattern} → ${relatedLocationLabel}.`,
        action: "remove-duplicate",
        actionLabel: "Remove duplicate",
      };
    case "shadowed-by-specific":
    default:
      return {
        type: "shadowed-by-specific",
        relatedRuleIndex,
        message: `More specific rule wins with a different location: ${relatedRule.pattern} → ${relatedLocationLabel}.`,
        action: "match-related-profile",
        actionLabel: `Use ${relatedLocationLabel}`,
      };
  }
};

const resolveConflicts = (
  rules: readonly DomainRule[],
  locations: readonly Location[],
  index: number,
): RuleConflict[] => {
  const rule = rules[index];
  if (!rule) {
    return [];
  }

  const locationLabels = getLocationLabelMap(locations);
  const normalizedPattern = normalizePattern(rule.pattern);

  for (const [otherIndex, otherRule] of rules.entries()) {
    if (otherIndex === index) {
      continue;
    }

    const normalizedOtherPattern = normalizePattern(otherRule.pattern);
    const relatedLocationLabel = otherRule.locationId
      ? (locationLabels.get(otherRule.locationId) ?? otherRule.locationId)
      : t.rules.globalFallback.noPresetLabel;

    if (
      normalizedPattern === normalizedOtherPattern &&
      otherRule.locationId === rule.locationId &&
      otherIndex < index
    ) {
      return [createConflict("duplicate", otherIndex, otherRule, relatedLocationLabel)];
    }

    if (otherRule.locationId === rule.locationId) {
      continue;
    }

    if (
      patternsMayOverlap(rule.pattern, otherRule.pattern) &&
      comparePatternRank(otherRule.pattern, rule.pattern) > 0
    ) {
      return [
        createConflict(
          "shadowed-by-specific",
          otherIndex,
          otherRule,
          relatedLocationLabel,
        ),
      ];
    }
  }

  return [];
};

export const buildRuleViewModels = (
  rules: readonly DomainRule[],
  locations: readonly Location[],
  filter: string,
  locationIdFilter: string | null = null,
): RuleViewModel[] => {
  const locationLabels = getLocationLabelMap(locations);
  const normalizedFilter = filter.trim().toLowerCase();
  const locationFilter = locationIdFilter?.trim() || null;

  return rules
    .map((rule, index) => {
      const locationId = rule.locationId?.trim();
      const locationLabel = locationId
        ? (locationLabels.get(locationId) ?? locationId)
        : t.rules.globalFallback.noPresetLabel;
      const conflicts = resolveConflicts(rules, locations, index);
      const normalizedPattern = normalizePattern(rule.pattern);

      return {
        conflicts,
        index,
        locationId,
        locationLabel,
        rule,
        sortKey: [
          locationLabel.toLowerCase(),
          conflicts.length > 0 ? "0" : "1",
          getSpecificitySortKey(rule.pattern),
          normalizedPattern,
        ].join(":"),
      };
    })
    .filter((viewModel): viewModel is RuleViewModel => viewModel !== null)
    .filter(({ locationId }) => (locationFilter ? locationId === locationFilter : true))
    .filter(({ rule, locationLabel, conflicts }) => {
      if (!normalizedFilter) {
        return true;
      }

      const haystack = [
        rule.pattern,
        rule.locationId,
        locationLabel,
        ...conflicts.map((conflict) => conflict.message),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedFilter);
    })
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey));
};

export const buildRuleGroupViewModels = (
  rules: readonly DomainRule[],
  locations: readonly Location[],
  filter: string,
): RuleGroupViewModel[] => {
  const grouped = new Map<string, RuleGroupViewModel>();
  const locationLabels = getLocationLabelMap(locations);

  for (const viewModel of buildRuleViewModels(rules, locations, filter)) {
    const groupKey = viewModel.locationId;
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.rules.push(viewModel);
      existing.conflictCount += viewModel.conflicts.length;
      continue;
    }

    grouped.set(groupKey, {
      conflictCount: viewModel.conflicts.length,
      locationId: viewModel.locationId,
      locationLabel: viewModel.locationId
        ? (locationLabels.get(viewModel.locationId) ?? viewModel.locationId)
        : t.rules.globalFallback.noPresetLabel,
      rules: [viewModel],
    });
  }

  return [...grouped.values()].sort((left, right) =>
    left.locationLabel.localeCompare(right.locationLabel),
  );
};

export const resolveRulePreview = ({
  hostname,
  cookieStoreId,
  rules,
  locations,
  trustedSites = [],
  globalFallbackRule,
}: {
  hostname: string;
  cookieStoreId: string | undefined;
  rules: readonly DomainRule[];
  locations: readonly Location[];
  trustedSites?: readonly TrustedSite[];
  globalFallbackRule?: GlobalFallbackRule | undefined;
}): RulePreview => {
  const normalizedHostname = hostname.trim().toLowerCase();

  if (!normalizedHostname) {
    return {
      hostname: "",
      winningSource: "none",
      trustedSite: null,
      rule: null,
      fallbackRule: null,
      location: null,
      profile: null,
      locationProfileActive: false,
    };
  }

  const resolvedSources = resolveRuleSources({
    hostname: normalizedHostname,
    cookieStoreId,
    rules,
    globalFallbackRule,
    trustedSites,
  });
  const trustedSite = resolvedSources.trustedSite;
  const rule = resolvedSources.activeRule;
  const matchedFallbackRule =
    !trustedSite && !rule ? resolvedSources.previewFallbackRule : null;
  let winningSource: "trusted-site" | "rule" | "fallback" | "none" = "none";
  if (trustedSite) {
    winningSource = "trusted-site";
  } else if (rule) {
    winningSource = "rule";
  } else if (matchedFallbackRule) {
    winningSource = "fallback";
  }
  const geolocationOverrides = rule
    ? rule.fingerprintSurfaceOverrides
    : matchedFallbackRule?.fingerprintSurfaceOverrides;
  const location =
    locations.find(
      (entry) => entry.id === (rule?.locationId ?? matchedFallbackRule?.locationId),
    ) ?? null;
  const locationProfileActive = Boolean(
    location && geolocationOverrides?.geolocation !== false,
  );

  return {
    hostname: normalizedHostname,
    winningSource,
    trustedSite,
    rule,
    fallbackRule: matchedFallbackRule,
    location,
    profile: location,
    locationProfileActive,
  };
};

export const reassignRulesToLocation = (
  rules: readonly DomainRule[],
  ruleIndexes: readonly number[],
  locationId: string,
): DomainRule[] => {
  const selectedIndexes = new Set(ruleIndexes);
  return rules.map((rule, index) => {
    if (!selectedIndexes.has(index)) {
      return rule;
    }

    if (rule.locationId === locationId) {
      return rule;
    }

    return {
      ...rule,
      locationId,
    };
  });
};

export const deleteRulesByIndex = (
  rules: readonly DomainRule[],
  ruleIndexes: readonly number[],
): DomainRule[] => {
  const selectedIndexes = new Set(ruleIndexes);
  return rules.filter((_, index) => !selectedIndexes.has(index));
};

export const upsertRule = (
  rules: readonly DomainRule[],
  nextRule: DomainRule,
  editingRulePattern?: string | null,
): DomainRule[] => {
  const normalizedPattern = normalizePattern(nextRule.pattern);
  const normalizedEditingPattern = editingRulePattern
    ? normalizePattern(editingRulePattern)
    : null;
  const replacedRule =
    rules.find((rule) => normalizePattern(rule.pattern) === normalizedEditingPattern) ??
    rules.find((rule) => normalizePattern(rule.pattern) === normalizedPattern);
  const preservedRuleSeedKey = nextRule.ruleSeedKey ?? replacedRule?.ruleSeedKey;
  const nextRuleWithSeed = preservedRuleSeedKey
    ? {
        ...nextRule,
        ruleSeedKey: preservedRuleSeedKey,
      }
    : nextRule;

  return [
    nextRuleWithSeed,
    ...rules.filter((rule) => {
      const currentPattern = normalizePattern(rule.pattern);
      if (normalizedEditingPattern && currentPattern === normalizedEditingPattern) {
        return false;
      }

      return currentPattern !== normalizedPattern;
    }),
  ];
};

export const applyRuleConflictAction = (
  rules: readonly DomainRule[],
  ruleIndex: number,
  conflict: RuleConflict,
): RuleConflictActionResult => {
  switch (conflict.action) {
    case "remove-duplicate":
      return {
        nextRules: deleteRulesByIndex(rules, [ruleIndex]),
      };
    case "match-related-profile": {
      const relatedRule = rules[conflict.relatedRuleIndex];
      if (!relatedRule?.locationId) {
        return { nextRules: [...rules] };
      }

      return {
        nextRules: reassignRulesToLocation(rules, [ruleIndex], relatedRule.locationId),
      };
    }
    case "select-related-rule":
      return {
        nextRules: [...rules],
        selectedRuleIndex: conflict.relatedRuleIndex,
      };
    default:
      return {
        nextRules: [...rules],
      };
  }
};
