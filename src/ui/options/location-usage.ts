import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
} from "@/shared/types";

export type PresetUsageSource =
  | {
      kind: "domain-rule";
      key: string;
      label: string;
      enabled: boolean;
    }
  | {
      kind: "default-rule";
      key: "default-rule";
      label: "Default Rule";
      enabled: boolean;
    }
  | {
      kind: "firefox-container";
      key: string;
      label: string;
      enabled: boolean;
    };

export type PresetUsage = {
  locationId: string;
  sources: readonly PresetUsageSource[];
};

const addUsageSource = (
  usage: Map<string, PresetUsageSource[]>,
  locationId: string | undefined,
  source: PresetUsageSource,
): void => {
  if (!locationId) {
    return;
  }

  const current = usage.get(locationId) ?? [];
  current.push(source);
  usage.set(locationId, current);
};

export const collectPresetUsage = (
  rules: readonly DomainRule[],
  globalFallbackRule: GlobalFallbackRule | undefined,
  containerAssignments: readonly ContainerAssignment[],
): ReadonlyMap<string, PresetUsage> => {
  const usage = new Map<string, PresetUsageSource[]>();

  for (const rule of rules) {
    addUsageSource(usage, rule.locationId, {
      kind: "domain-rule",
      key: rule.pattern,
      label: `Domain Rule: ${rule.pattern}`,
      enabled: rule.enabled,
    });
  }

  if (globalFallbackRule) {
    addUsageSource(usage, globalFallbackRule.locationId, {
      kind: "default-rule",
      key: "default-rule",
      label: "Default Rule",
      enabled: globalFallbackRule.enabled,
    });
  }

  for (const assignment of containerAssignments) {
    addUsageSource(usage, assignment.locationId, {
      kind: "firefox-container",
      key: assignment.cookieStoreId,
      label: `Firefox Container: ${assignment.cookieStoreId}`,
      enabled: assignment.enabled !== false,
    });
  }

  return new Map(
    [...usage.entries()].map(([locationId, sources]) => [
      locationId,
      { locationId, sources },
    ]),
  );
};

export const countLocationRuleUsage = (
  rules: readonly DomainRule[],
): Map<string, number> => {
  const counts = new Map<string, number>();

  for (const rule of rules) {
    if (!rule.locationId) {
      continue;
    }

    counts.set(rule.locationId, (counts.get(rule.locationId) ?? 0) + 1);
  }

  return counts;
};
