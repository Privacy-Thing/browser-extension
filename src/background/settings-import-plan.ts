import { z } from "zod";

import { validateImportedSettings } from "@/background/settings";
import { canonical } from "@/background/settings-import-storage";
import { bindingPatterns, type RuleFeatureBinding } from "@/shared/provider-feature";
import type {
  SettingsImportChange,
  SettingsImportSelection,
} from "@/shared/settings-import";
import type { DomainRule, ExportedSettings, Location } from "@/shared/types";

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

const diffCollection = (input: {
  collection: SettingsImportChange["collection"];
  before: Array<{ id?: string; pattern?: string; cookieStoreId?: string }>;
  after: Array<{ id?: string; pattern?: string; cookieStoreId?: string }>;
}): SettingsImportChange[] => {
  const keyOf = (item: { id?: string; pattern?: string; cookieStoreId?: string }) =>
    item.id ?? item.pattern ?? item.cookieStoreId ?? "";
  const previous = new Map(input.before.map((item) => [keyOf(item), item]));
  const next = new Map(input.after.map((item) => [keyOf(item), item]));
  const changes: SettingsImportChange[] = [];
  for (const key of new Set([...previous.keys(), ...next.keys()])) {
    const before = previous.get(key);
    const after = next.get(key);
    if (same(before, after)) continue;
    let kind: SettingsImportChange["kind"] = "changed";
    if (!before) kind = "added";
    if (!after) kind = "removed";
    changes.push({ collection: input.collection, key, kind, before, after });
  }
  return changes;
};
export const diffImportedSettings = (
  before: ExportedSettings,
  after: ExportedSettings,
): SettingsImportChange[] => {
  const collections = [
    "locations",
    "rules",
    "trustedSites",
    "containerAssignments",
  ] as const;
  const changes = collections.flatMap((collection) =>
    diffCollection({
      collection,
      before: before[collection] ?? [],
      after: after[collection] ?? [],
    }),
  );
  const ignored = new Set<string>([...collections, "version", "exportedAt"]);
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (ignored.has(key)) continue;
    const oldValue = Reflect.get(before, key);
    const newValue = Reflect.get(after, key);
    if (!same(oldValue, newValue))
      changes.push({
        collection: "settings",
        key,
        kind: "changed",
        before: oldValue,
        after: newValue,
      });
  }
  return changes;
};

const copyLocationId = (id: string, reserved: ReadonlySet<string>): string => {
  let copy = `${id}-import`;
  let suffix = 2;
  while (reserved.has(copy)) copy = `${id}-import-${suffix++}`;
  return copy;
};
const resolveLocation = (input: {
  location: Location;
  choice: SettingsImportSelection["locations"][string] | undefined;
  index: number;
  reserved: ReadonlySet<string>;
  problems: string[];
}): Location | null => {
  const { location, choice, index, reserved, problems } = input;
  if (!choice) {
    problems.push(`Choose how to resolve preset ID: ${location.id}`);
    return null;
  }
  if (choice === "skip") return null;
  if (choice === "keep" && index < 0) {
    problems.push(`No local preset to keep: ${location.id}`);
    return null;
  }
  return {
    ...location,
    id: choice === "copy" ? copyLocationId(location.id, reserved) : location.id,
  };
};
const mergeLocations = (
  current: Location[],
  incoming: Location[],
  choices: SettingsImportSelection["locations"],
) => {
  const locations = [...current];
  const reserved = new Set([...current, ...incoming].map((item) => item.id));
  const remap = new Map<string, string>();
  const problems: string[] = [];
  for (const location of incoming) {
    const index = locations.findIndex((item) => item.id === location.id);
    const selected = Object.hasOwn(choices, location.id)
      ? choices[location.id]
      : undefined;
    const choice = selected ?? (index < 0 ? "import" : undefined);
    const next = resolveLocation({ location, choice, index, reserved, problems });
    if (!next) continue;
    reserved.add(next.id);
    remap.set(location.id, next.id);
    if (choice === "keep") continue;
    if (choice === "import" && index >= 0) locations[index] = next;
    else locations.push(next);
  }
  return { locations, remap, problems };
};

const remapRule = (
  rule: DomainRule,
  remap: ReadonlyMap<string, string>,
  problems: string[],
): DomainRule | null => {
  if (!rule.locationId) return rule;
  const locationId = remap.get(rule.locationId);
  if (!locationId) {
    problems.push(`Select the preset ${rule.locationId} used by ${rule.pattern}.`);
    return null;
  }
  return { ...rule, locationId };
};
const mergeRules = (input: {
  current: DomainRule[];
  incoming: DomainRule[];
  choices: SettingsImportSelection["rules"];
  remap: Map<string, string>;
  problems: string[];
}): DomainRule[] => {
  const rules = [...input.current];
  for (const rule of input.incoming) {
    const index = rules.findIndex((item) => item.pattern === rule.pattern);
    const choice =
      (Object.hasOwn(input.choices, rule.pattern)
        ? input.choices[rule.pattern]
        : undefined) ?? (index < 0 ? "import" : undefined);
    if (!choice) {
      input.problems.push(`Choose how to resolve rule pattern: ${rule.pattern}`);
      continue;
    }
    if (choice === "skip" || choice === "keep") continue;
    const next = remapRule(rule, input.remap, input.problems);
    if (!next) continue;
    if (index < 0) rules.push(next);
    else rules[index] = next;
  }
  return rules;
};

type AssignmentPlan = {
  source: ExportedSettings;
  selection: SettingsImportSelection;
  localContainerIds: ReadonlySet<string>;
  remap: ReadonlyMap<string, string>;
  problems: string[];
};
const mapAssignment = (
  input: AssignmentPlan,
  assignment: NonNullable<ExportedSettings["containerAssignments"]>[number],
) => {
  const { selection, localContainerIds, remap, problems } = input;
  if (!Object.hasOwn(selection.containers, assignment.cookieStoreId)) {
    problems.push(`Map or skip foreign container: ${assignment.cookieStoreId}`);
    return null;
  }
  const cookieStoreId = selection.containers[assignment.cookieStoreId];
  if (cookieStoreId === null) return null;
  if (!cookieStoreId || !localContainerIds.has(cookieStoreId)) {
    problems.push(
      `Local container is unavailable: ${cookieStoreId ?? assignment.cookieStoreId}`,
    );
    return null;
  }
  if (!assignment.locationId) return { ...assignment, cookieStoreId };
  const locationId = remap.get(assignment.locationId);
  if (!locationId) {
    problems.push(
      `Select the preset ${assignment.locationId} used by container ${assignment.cookieStoreId}.`,
    );
    return null;
  }
  return { ...assignment, cookieStoreId, locationId };
};
const mergeAssignments = (
  input: AssignmentPlan,
  current: NonNullable<ExportedSettings["containerAssignments"]>,
) => {
  const assignments = [...current];
  const mappedTargets = new Set<string>();
  for (const assignment of input.source.containerAssignments ?? []) {
    const next = mapAssignment(input, assignment);
    if (!next) continue;
    if (mappedTargets.has(next.cookieStoreId)) {
      input.problems.push(
        `Multiple assignments mapped to container: ${next.cookieStoreId}`,
      );
      continue;
    }
    mappedTargets.add(next.cookieStoreId);
    const index = assignments.findIndex(
      (item) => item.cookieStoreId === next.cookieStoreId,
    );
    if (index < 0) assignments.push(next);
    else assignments[index] = next;
  }
  return assignments;
};

const localAssignments = (input: {
  current: ExportedSettings;
  merge: boolean;
  ids: ReadonlySet<string>;
  locations: Location[];
}) => {
  const current = input.current.containerAssignments ?? [];
  if (input.merge) return current;
  const locationIds = new Set(input.locations.map((location) => location.id));
  // Unmapped local container identities stay local. Removed preset links are
  // visible in the diff; imported assignments only replace explicitly mapped IDs.
  return current
    .filter((assignment) => input.ids.has(assignment.cookieStoreId))
    .map((assignment) => {
      if (!assignment.locationId || locationIds.has(assignment.locationId))
        return assignment;
      const withoutPreset = { ...assignment };
      delete withoutPreset.locationId;
      return withoutPreset;
    });
};

const retainBindingPatterns = (
  bindings: readonly RuleFeatureBinding[],
  keep: (pattern: string) => boolean,
): RuleFeatureBinding[] =>
  bindings.flatMap((binding) => {
    const members = bindingPatterns(binding).filter(keep);
    const primary = members.includes(binding.rulePattern)
      ? binding.rulePattern
      : members[0];
    return primary
      ? [
          {
            ...binding,
            rulePattern: primary,
            ...(binding.rulePatterns ? { rulePatterns: members } : {}),
          },
        ]
      : [];
  });

export const planSettingsImport = (input: {
  current: ExportedSettings;
  source: ExportedSettings;
  selection: SettingsImportSelection;
  localContainerIds: ReadonlySet<string>;
}): { settings: ExportedSettings; problems: string[] } => {
  const { current, source, localContainerIds } = input;
  const selection = z
    .object({
      mode: z.enum(["replace", "merge"]),
      locations: z.record(z.enum(["import", "keep", "copy", "skip"])),
      rules: z.record(z.enum(["import", "keep", "skip"])),
      containers: z.record(z.string().nullable()),
    })
    .parse(input.selection);
  const merge = selection.mode === "merge";
  const locations = mergeLocations(
    merge ? current.locations : [],
    source.locations,
    merge ? selection.locations : {},
  );
  const rules = merge
    ? mergeRules({
        current: current.rules,
        incoming: source.rules,
        choices: selection.rules,
        remap: locations.remap,
        problems: locations.problems,
      })
    : source.rules;
  const assignments = mergeAssignments(
    {
      source,
      selection,
      localContainerIds,
      remap: locations.remap,
      problems: locations.problems,
    },
    localAssignments({
      current,
      merge,
      ids: localContainerIds,
      locations: locations.locations,
    }),
  );
  const settings: ExportedSettings = {
    ...(merge ? current : source),
    locations: locations.locations,
    rules,
    containerAssignments: assignments,
    featureBindings: merge
      ? [
          ...retainBindingPatterns(
            current.featureBindings ?? [],
            (pattern) =>
              !source.rules.some(
                (rule) =>
                  rule.pattern === pattern &&
                  selection.rules[pattern] !== "keep" &&
                  selection.rules[pattern] !== "skip",
              ),
          ),
          ...retainBindingPatterns(source.featureBindings ?? [], (pattern) =>
            source.rules.some(
              (rule) =>
                rule.pattern === pattern &&
                selection.rules[pattern] !== "keep" &&
                selection.rules[pattern] !== "skip",
            ),
          ),
        ]
      : (source.featureBindings ?? []),
  };
  if (locations.problems.length === 0) validateImportedSettings(settings);
  return { settings, problems: locations.problems };
};
