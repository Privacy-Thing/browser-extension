import { bindingPatterns, type RuleFeatureBinding } from "./provider-feature";
import { copyGroupSettings, ruleSettingsKey } from "./rule-groups";
import type { DomainRule } from "./types";

export { copyGroupSettings, ruleSettingsKey };

export const findFeatureBinding = (
  bindings: readonly RuleFeatureBinding[],
  pattern: string,
): RuleFeatureBinding | undefined =>
  bindings.find((binding) => bindingPatterns(binding).includes(pattern));

/** Group edits are flattened at storage, before any runtime resolver sees them. */
export const synchronizeFeatureGroups = (
  previous: readonly DomainRule[],
  next: readonly DomainRule[],
  bindings: readonly RuleFeatureBinding[],
): DomainRule[] => {
  let rules = [...next];
  for (const binding of bindings) {
    const members = rules.filter((rule) =>
      bindingPatterns(binding).includes(rule.pattern),
    );
    const changed = members.filter((rule) => {
      const old =
        previous.find((entry) => entry.pattern === rule.pattern) ??
        previous.find(
          (entry) =>
            entry.authKey === rule.authKey &&
            !next.some((member) => member.pattern === entry.pattern),
        );
      return (
        old &&
        (ruleSettingsKey(old) !== ruleSettingsKey(rule) ||
          old.authKey !== rule.authKey ||
          old.ruleSeedKey !== rule.ruleSeedKey)
      );
    });
    if (
      new Set(
        changed.map((rule) =>
          JSON.stringify([ruleSettingsKey(rule), rule.authKey, rule.ruleSeedKey]),
        ),
      ).size > 1
    )
      throw new Error(
        "The linked hosts have conflicting settings or identity. Edit their shared configuration.",
      );
    const source =
      changed[0] ??
      members.find((rule) => rule.pattern === binding.rulePattern) ??
      members[0];
    if (!source) continue;
    rules = rules.map((rule) =>
      members.includes(rule) ? copyGroupSettings(source, rule) : rule,
    );
  }
  return rules;
};

export const validateGroupRules = (
  bindings: readonly RuleFeatureBinding[],
  rules: readonly DomainRule[],
): void => {
  for (const binding of bindings) {
    const members = rules.filter((rule) =>
      bindingPatterns(binding).includes(rule.pattern),
    );
    const source = members[0];
    if (!source) continue;
    if (
      members.some(
        (rule) =>
          ruleSettingsKey(rule) !== ruleSettingsKey(source) ||
          rule.authKey !== source.authKey ||
          rule.ruleSeedKey !== source.ruleSeedKey,
      )
    )
      throw new Error(
        `The linked hosts for ${binding.featureName} must share settings and identity.`,
      );
  }
};
