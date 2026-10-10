import { bindingPatterns, type RuleFeatureBinding } from "./provider-feature";
import type { DomainRule } from "./types";

const AUTH_KEY_PATTERN = /^[a-z0-9]{8}$/;

export const ruleSettingsKey = (rule: DomainRule): string =>
  JSON.stringify({
    locationId: rule.locationId ?? null,
    enabled: rule.enabled,
    relaxCspForWorkers: rule.relaxCspForWorkers ?? false,
    fingerprintSurfaceOverrides: Object.entries(
      rule.fingerprintSurfaceOverrides ?? {},
    ).sort(([left], [right]) => left.localeCompare(right)),
  });

export const copyGroupSettings = (
  source: DomainRule,
  target: DomainRule,
): DomainRule => ({
  ...source,
  pattern: target.pattern,
});

const validAuthKey = (value: string | undefined): string | undefined => {
  const normalized = value?.trim().toLowerCase();
  return normalized && AUTH_KEY_PATTERN.test(normalized) ? normalized : undefined;
};

export const RULE_GROUP_ID_MAX = 128;

export const rulePatternKey = (pattern: string): string => pattern.trim().toLowerCase();

const patternKey = rulePatternKey;

const INVALID_RULE_PATTERN = /[\s:/\\?#]/;

/** Trim and lowercase a new pattern. Reject empty values and URL fragments. */
export const normalizeRulePattern = (pattern: string): string => {
  const normalized = rulePatternKey(pattern);
  if (!normalized || INVALID_RULE_PATTERN.test(normalized)) {
    throw new Error("Enter a valid domain pattern.");
  }
  return normalized;
};

/** Canonicalize a save payload and reject two hosts that normalize to one pattern. */
export const normalizeSavedRules = (rules: readonly DomainRule[]): DomainRule[] => {
  const seen = new Set<string>();
  return rules.map((rule) => {
    const pattern = normalizeRulePattern(rule.pattern);
    if (seen.has(pattern)) throw new Error(`Duplicate rule pattern: ${pattern}.`);
    seen.add(pattern);
    return { ...rule, pattern };
  });
};

const GROUP_CLAIM_ERROR =
  "A pattern list cannot claim a host that already belongs to another rule.";

const rulesByPattern = (rules: readonly DomainRule[]): Map<string, DomainRule> =>
  new Map(rules.map((rule) => [patternKey(rule.pattern), rule]));

const groupMembers = (rules: readonly DomainRule[]): Map<string, DomainRule[]> => {
  const groups = new Map<string, DomainRule[]>();
  for (const rule of rules) {
    if (!rule.groupId) continue;
    const members = groups.get(rule.groupId) ?? [];
    members.push(rule);
    groups.set(rule.groupId, members);
  }
  return groups;
};

const assertStablePatternGroup = (
  previousByPattern: ReadonlyMap<string, DomainRule>,
  previousGroupIds: ReadonlySet<string>,
  next: readonly DomainRule[],
): void => {
  for (const rule of next) {
    const prior = previousByPattern.get(patternKey(rule.pattern));
    if (!prior || prior.groupId === rule.groupId) continue;
    if (!prior.groupId && rule.groupId && !previousGroupIds.has(rule.groupId)) continue;
    throw new Error(GROUP_CLAIM_ERROR);
  }
};

const memberContinuity = (
  members: readonly DomainRule[],
  previousByPattern: ReadonlyMap<string, DomainRule>,
  groupId: string,
): { unboundExisting: number; continuing: number } => {
  let unboundExisting = 0;
  let continuing = 0;
  for (const rule of members) {
    const prior = previousByPattern.get(patternKey(rule.pattern));
    if (!prior) continue;
    if (!prior.groupId) unboundExisting += 1;
    else if (prior.groupId === groupId) continuing += 1;
  }
  return { unboundExisting, continuing };
};

const keepsRemovedAuth = (
  members: readonly DomainRule[],
  removed: readonly DomainRule[],
): boolean =>
  members.some((rule) =>
    removed.some((prior) =>
      Boolean(prior.authKey && rule.authKey && prior.authKey === rule.authKey),
    ),
  );

const assertNextGroupClaim = (
  previous: readonly DomainRule[],
  next: readonly DomainRule[],
  previousByPattern: ReadonlyMap<string, DomainRule>,
  previousGroupIds: ReadonlySet<string>,
): void => {
  const nextByPattern = rulesByPattern(next);
  for (const [groupId, members] of groupMembers(next)) {
    const { unboundExisting, continuing } = memberContinuity(
      members,
      previousByPattern,
      groupId,
    );
    if (unboundExisting > 1 || (unboundExisting === 1 && continuing > 0)) {
      throw new Error(GROUP_CLAIM_ERROR);
    }
    if (continuing > 0 || !previousGroupIds.has(groupId)) continue;
    const removed = previous.filter(
      (rule) =>
        rule.groupId === groupId && !nextByPattern.has(patternKey(rule.pattern)),
    );
    if (!keepsRemovedAuth(members, removed)) throw new Error(GROUP_CLAIM_ERROR);
  }
};

/**
 * Reject pattern-list edits that would absorb or retarget another group.
 * A new custom group may start from one unbound rule. Explicit service joins
 * happen after this check and are the only merge.
 */
export const assertRuleGroupEdit = (
  previous: readonly DomainRule[],
  next: readonly DomainRule[],
): void => {
  const previousByPattern = rulesByPattern(previous);
  const previousGroupIds = new Set(
    previous.flatMap((rule) => (rule.groupId ? [rule.groupId] : [])),
  );
  assertStablePatternGroup(previousByPattern, previousGroupIds, next);
  assertNextGroupClaim(previous, next, previousByPattern, previousGroupIds);
};

const findRule = (
  rules: readonly DomainRule[],
  pattern: string,
): DomainRule | undefined => {
  const key = patternKey(pattern);
  return rules.find((rule) => patternKey(rule.pattern) === key);
};

export const readGroupId = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const groupId = value.trim();
  if (!groupId || groupId.length > RULE_GROUP_ID_MAX) return undefined;
  return groupId;
};

const fnv = (value: string, seed: number): number => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

/** Stable id for a legacy binding membership. Repeated loads return the same id. */
export const legacyGroupId = (patterns: readonly string[]): string => {
  const key = patterns.map(patternKey).sort().join("\n");
  const hex = [0x811c_9dc5, 0x0100_0193, 0x9e37_79b9, 0x85eb_ca6b]
    .map((seed) => fnv(key, seed).toString(16).padStart(8, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

export const getRuleGroupPatterns = (
  rules: readonly DomainRule[],
  pattern: string,
): string[] => {
  const rule = findRule(rules, pattern);
  if (!rule) return [];
  if (!rule.groupId) return [rule.pattern];
  return rules
    .filter((entry) => entry.groupId === rule.groupId)
    .map((entry) => entry.pattern);
};

/** Keep an existing canonical host first so later projection does not retarget it. */
export const orderGroupAroundSource = (
  rules: readonly DomainRule[],
  sourcePattern: string,
  patterns: readonly string[],
): DomainRule[] => {
  const members = new Set(patterns);
  const byPattern = new Map(
    rules
      .filter((rule) => members.has(rule.pattern))
      .map((rule) => [rule.pattern, rule]),
  );
  const ordered = [
    sourcePattern,
    ...patterns.filter((pattern) => pattern !== sourcePattern),
  ].flatMap((pattern) => {
    const rule = byPattern.get(pattern);
    return rule ? [rule] : [];
  });
  let inserted = false;
  const result: DomainRule[] = [];
  for (const rule of rules) {
    if (!members.has(rule.pattern)) {
      result.push(rule);
      continue;
    }
    if (!inserted) {
      result.push(...ordered);
      inserted = true;
    }
  }
  return result;
};

/** First stored rule in the group. Hostname resolution still uses the flat match. */
export const getRuleGroupSource = (
  rules: readonly DomainRule[],
  pattern: string,
): DomainRule | undefined => {
  const rule = findRule(rules, pattern);
  if (!rule) return undefined;
  if (!rule.groupId) return rule;
  return rules.find((entry) => entry.groupId === rule.groupId);
};

const previousRule = (
  previous: readonly DomainRule[],
  next: readonly DomainRule[],
  rule: DomainRule,
): DomainRule | undefined =>
  findRule(previous, rule.pattern) ??
  previous.find(
    (entry) =>
      Boolean(entry.authKey && rule.authKey && entry.authKey === rule.authKey) &&
      !next.some((member) => patternKey(member.pattern) === patternKey(entry.pattern)),
  );

const groupSignature = (rule: DomainRule): string =>
  JSON.stringify([
    ruleSettingsKey(rule),
    rule.authKey ?? null,
    rule.ruleSeedKey ?? null,
  ]);

const changedMembers = (
  previous: readonly DomainRule[],
  next: readonly DomainRule[],
  members: readonly DomainRule[],
): DomainRule[] =>
  members.filter((rule) => {
    const old = previousRule(previous, next, rule);
    return Boolean(
      old &&
      (ruleSettingsKey(old) !== ruleSettingsKey(rule) ||
        old.authKey !== rule.authKey ||
        old.ruleSeedKey !== rule.ruleSeedKey),
    );
  });

/** Flatten one product group's settings. Shared authKey alone never creates a group. */
export const synchronizeRuleGroups = (
  previous: readonly DomainRule[],
  next: readonly DomainRule[],
): DomainRule[] => {
  let rules = [...next];
  const groupIds = [
    ...new Set(rules.flatMap((rule) => (rule.groupId ? [rule.groupId] : []))),
  ];
  for (const groupId of groupIds) {
    const members = rules.filter((rule) => rule.groupId === groupId);
    const changed = changedMembers(previous, rules, members);
    if (new Set(changed.map(groupSignature)).size > 1) {
      throw new Error(
        "The linked hosts have conflicting settings or identity. Edit their shared configuration.",
      );
    }
    const source =
      changed[0] ??
      members.find((rule) => previousRule(previous, next, rule)) ??
      members[0];
    if (!source) continue;
    const memberPatterns = new Set(members.map((rule) => rule.pattern));
    rules = rules.map((rule) =>
      memberPatterns.has(rule.pattern) ? copyGroupSettings(source, rule) : rule,
    );
    const priorMembers = previous.filter((rule) => rule.groupId === groupId);
    const priorSource = priorMembers[0];
    const currentSource = priorSource
      ? rules.find(
          (rule) =>
            rule.groupId === groupId &&
            patternKey(rule.pattern) === patternKey(priorSource.pattern),
        )
      : undefined;
    if (!currentSource) continue;
    const currentByKey = new Map(
      rules
        .filter((rule) => rule.groupId === groupId)
        .map((rule) => [patternKey(rule.pattern), rule.pattern]),
    );
    const priorKeys = priorMembers.map((rule) => patternKey(rule.pattern));
    const sourceKey = patternKey(currentSource.pattern);
    const existing = priorKeys.flatMap((key) => {
      if (key === sourceKey || !currentByKey.has(key)) return [];
      const pattern = currentByKey.get(key);
      return pattern ? [pattern] : [];
    });
    const added = [...currentByKey.keys()].flatMap((key) => {
      if (priorKeys.includes(key)) return [];
      const pattern = currentByKey.get(key);
      return pattern ? [pattern] : [];
    });
    rules = orderGroupAroundSource(rules, currentSource.pattern, [
      currentSource.pattern,
      ...existing,
      ...added,
    ]);
  }
  return rules;
};

export const validateRuleGroups = (rules: readonly DomainRule[]): void => {
  const groups = new Map<string, DomainRule[]>();
  for (const rule of rules) {
    if (!rule.groupId) continue;
    const members = groups.get(rule.groupId) ?? [];
    members.push(rule);
    groups.set(rule.groupId, members);
  }
  for (const [groupId, members] of groups) {
    const source = members[0];
    if (!source) continue;
    if (members.some((rule) => groupSignature(rule) !== groupSignature(source))) {
      throw new Error(`Rules in group ${groupId} must share settings and identity.`);
    }
  }
};

const findRoot = (parent: ReadonlyMap<string, string>, pattern: string): string => {
  let root = pattern;
  while (parent.get(root) !== root) {
    const next = parent.get(root);
    if (!next) return root;
    root = next;
  }
  return root;
};

const unionPatterns = (
  parent: Map<string, string>,
  left: string,
  right: string,
): void => {
  const leftRoot = findRoot(parent, left);
  const rightRoot = findRoot(parent, right);
  if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
};

const storedAuthKeys = (
  members: readonly string[],
  byPattern: ReadonlyMap<string, DomainRule>,
): Set<string> =>
  new Set(
    members.flatMap((pattern) => {
      const authKey = validAuthKey(byPattern.get(patternKey(pattern))?.authKey);
      return authKey ? [authKey] : [];
    }),
  );

const linkCompatibleMembers = (
  binding: RuleFeatureBinding,
  byPattern: ReadonlyMap<string, DomainRule>,
  parent: Map<string, string>,
): void => {
  const members = bindingPatterns(binding).filter((pattern) =>
    byPattern.has(patternKey(pattern)),
  );
  if (members.length < 2) return;
  if (members.some((pattern) => byPattern.get(patternKey(pattern))?.groupId)) return;
  if (storedAuthKeys(members, byPattern).size > 1) return;
  for (const pattern of members) {
    const key = patternKey(pattern);
    if (!parent.has(key)) parent.set(key, key);
  }
  const first = members[0];
  if (!first) return;
  for (const pattern of members.slice(1)) {
    unionPatterns(parent, patternKey(first), patternKey(pattern));
  }
};

const groupAssignments = (parent: ReadonlyMap<string, string>): Map<string, string> => {
  const components = new Map<string, string[]>();
  for (const pattern of parent.keys()) {
    const root = findRoot(parent, pattern);
    const list = components.get(root) ?? [];
    list.push(pattern);
    components.set(root, list);
  }
  const assignment = new Map<string, string>();
  for (const members of components.values()) {
    if (members.length < 2) continue;
    const groupId = legacyGroupId(members);
    for (const pattern of members) assignment.set(pattern, groupId);
  }
  return assignment;
};

export const migrateLegacyRuleGroups = (
  rules: readonly DomainRule[],
  bindings: readonly RuleFeatureBinding[],
): { rules: DomainRule[]; changed: boolean } => {
  const byPattern = new Map(rules.map((rule) => [patternKey(rule.pattern), rule]));
  const parent = new Map<string, string>();
  for (const binding of bindings) linkCompatibleMembers(binding, byPattern, parent);
  const assignment = groupAssignments(parent);
  if (assignment.size === 0) return { rules: [...rules], changed: false };
  return {
    changed: true,
    rules: rules.map((rule) => {
      const groupId = assignment.get(patternKey(rule.pattern));
      return groupId ? { ...rule, groupId } : rule;
    }),
  };
};

export type PreservedRuleIdentity = {
  authKey?: string;
  ruleSeedKey?: string;
};

const partitionKey = (
  rule: DomainRule,
  preserved: ReadonlyMap<string, PreservedRuleIdentity>,
): string => {
  const identity = preserved.get(patternKey(rule.pattern));
  return `${identity?.authKey ?? ""}\0${identity?.ruleSeedKey ?? ""}`;
};

const collisionGroupId = (groupId: string, identity: string): string => {
  const next = legacyGroupId([groupId, identity]);
  return next === groupId ? legacyGroupId([groupId, identity, "split"]) : next;
};

const preservedAuthKey = (
  rule: DomainRule,
  preserved: ReadonlyMap<string, PreservedRuleIdentity>,
): string | undefined => preserved.get(patternKey(rule.pattern))?.authKey;

const assertCompatibleAuth = (
  rules: readonly DomainRule[],
  preserved: ReadonlyMap<string, PreservedRuleIdentity>,
): void => {
  const groupIds = [
    ...new Set(rules.flatMap((rule) => (rule.groupId ? [rule.groupId] : []))),
  ];
  for (const groupId of groupIds) {
    const keys = rules.flatMap((rule) => {
      if (rule.groupId !== groupId) return [];
      const authKey = preservedAuthKey(rule, preserved);
      return authKey ? [authKey] : [];
    });
    if (new Set(keys).size > 1) {
      throw new Error(`Rules in group ${groupId} have conflicting auth keys.`);
    }
  }
};

const identitySource = (
  partition: readonly DomainRule[],
  preserved: ReadonlyMap<string, PreservedRuleIdentity>,
): DomainRule | undefined =>
  partition.find((rule) => preservedAuthKey(rule, preserved)) ?? partition[0];

const rewriteGroup = (
  rules: readonly DomainRule[],
  groupId: string,
  preserved: ReadonlyMap<string, PreservedRuleIdentity>,
): DomainRule[] => {
  const members = rules.filter((rule) => rule.groupId === groupId);
  const partitions = new Map<string, DomainRule[]>();
  for (const rule of members) {
    const key = partitionKey(rule, preserved);
    const list = partitions.get(key) ?? [];
    list.push(rule);
    partitions.set(key, list);
  }
  const replacements = new Map<string, DomainRule>();
  let index = 0;
  for (const [identity, partition] of partitions) {
    const source = identitySource(partition, preserved);
    if (!source) continue;
    const nextGroupId = index === 0 ? groupId : collisionGroupId(groupId, identity);
    const canonical = { ...source, groupId: nextGroupId };
    for (const rule of partition) {
      const copied = copyGroupSettings(canonical, rule);
      const authKey = preservedAuthKey(rule, preserved);
      replacements.set(
        rule.pattern,
        authKey && rule.authKey ? { ...copied, authKey: rule.authKey } : copied,
      );
    }
    index += 1;
  }
  return rules.map((rule) => replacements.get(rule.pattern) ?? rule);
};

const copyPreservingAuth = (source: DomainRule, rule: DomainRule): DomainRule => {
  const copied = copyGroupSettings(source, rule);
  return validAuthKey(rule.authKey) && rule.authKey
    ? { ...copied, authKey: rule.authKey }
    : copied;
};

const conflictingAuth = (members: readonly DomainRule[]): boolean =>
  new Set(
    members.flatMap((rule) => {
      const authKey = validAuthKey(rule.authKey);
      return authKey ? [authKey] : [];
    }),
  ).size > 1;

/** Flatten settings inside a group without replacing a different valid auth key. */
export const flattenCompatibleGroups = (rules: readonly DomainRule[]): DomainRule[] => {
  let next = [...rules];
  const groupIds = [
    ...new Set(next.flatMap((rule) => (rule.groupId ? [rule.groupId] : []))),
  ];
  for (const groupId of groupIds) {
    const members = next.filter((rule) => rule.groupId === groupId);
    if (conflictingAuth(members)) continue;
    const source = members.find((rule) => validAuthKey(rule.authKey)) ?? members[0];
    if (!source) continue;
    const memberPatterns = new Set(members.map((rule) => rule.pattern));
    next = next.map((rule) =>
      memberPatterns.has(rule.pattern) ? copyPreservingAuth(source, rule) : rule,
    );
  }
  return next;
};

/**
 * Repair imported groups. Distinct seeds that share a groupId split.
 * A group with two stored auth keys is rejected.
 * Rules without groupId stay independent even when settings and authKey match.
 */
export const sanitizeRuleGroups = (
  rules: readonly DomainRule[],
  preserved: ReadonlyMap<string, PreservedRuleIdentity> = new Map(),
): DomainRule[] => {
  assertCompatibleAuth(rules, preserved);
  const groupIds = [
    ...new Set(rules.flatMap((rule) => (rule.groupId ? [rule.groupId] : []))),
  ];
  return groupIds.reduce(
    (current, groupId) => rewriteGroup(current, groupId, preserved),
    [...rules],
  );
};

const withoutRulePatterns = (binding: RuleFeatureBinding): RuleFeatureBinding => {
  const next = { ...binding };
  delete next.rulePatterns;
  return next;
};

export const projectFeatureBindings = (
  bindings: readonly RuleFeatureBinding[],
  rules: readonly DomainRule[],
  previous: readonly DomainRule[] = rules,
): RuleFeatureBinding[] =>
  bindings.flatMap((binding) => {
    let anchor = findRule(rules, binding.rulePattern);
    if (!anchor) {
      const prior = findRule(previous, binding.rulePattern);
      if (prior?.groupId) anchor = rules.find((rule) => rule.groupId === prior.groupId);
    }
    if (!anchor) {
      anchor = bindingPatterns(binding)
        .map((pattern) => findRule(rules, pattern))
        .find((rule): rule is DomainRule => Boolean(rule));
    }
    if (!anchor) return [];
    const source = getRuleGroupSource(rules, anchor.pattern) ?? anchor;
    const patterns = getRuleGroupPatterns(rules, source.pattern);
    const projected = withoutRulePatterns({ ...binding, rulePattern: source.pattern });
    return patterns.length > 1
      ? [{ ...projected, rulePatterns: patterns }]
      : [projected];
  });

export const prepareProductRuleGroups = (
  rules: readonly DomainRule[],
  bindings: readonly RuleFeatureBinding[],
  preserved: ReadonlyMap<string, PreservedRuleIdentity> = new Map(),
): { rules: DomainRule[]; featureBindings: RuleFeatureBinding[] } => {
  const migrated = migrateLegacyRuleGroups(rules, bindings);
  const sanitized = sanitizeRuleGroups(migrated.rules, preserved);
  return {
    rules: sanitized,
    featureBindings: projectFeatureBindings(bindings, sanitized, rules),
  };
};
