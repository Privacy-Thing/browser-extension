import { getDomainPatternKind } from "@/shared/domain-match";
import {
  bindingPatterns,
  type FeatureDecision,
  type ProviderBadgeColors,
  type ProviderDecorator,
  type ProviderFeature,
  type ProviderFeatureMatch,
  type ProviderFeatureState,
  type RuleFeatureBinding,
} from "@/shared/provider-feature";

export type { ProviderFeature, ProviderFeatureMatch, RuleFeatureBinding };
export type { FeatureDecision, ProviderDecorator };

/** State of the provider-side native rule that a binding controls. */
export type FeatureSyncStatus = "queued" | "syncing" | "synced" | "error";

export type ProviderFeatureVariant = "default" | "compact";

export type SlotView =
  "hidden" | "checking" | "suggest" | "join" | "staged" | "linked" | "manual";

export type JoinInfo = {
  pattern: string;
  extra: number;
};

export type SlotModel = {
  view: SlotView;
  feature: ProviderFeature | null;
  decorator: ProviderDecorator | null;
  groupSize: number;
  join: JoinInfo | null;
};

export type SlotInput = {
  available: boolean;
  providerId: string;
  providerName: string;
  initials: string;
  badgeColors?: ProviderBadgeColors;
  features: readonly ProviderFeature[];
  bindings: readonly RuleFeatureBinding[];
  binding: RuleFeatureBinding | null;
  match: ProviderFeatureMatch | null;
  dismissed: boolean;
  recognizing: boolean;
  identityPattern: string;
  decision: FeatureDecision | undefined;
  declinedId: string | null;
};

export type FeatureNotice =
  "blocked" | "connect" | "paused" | "catalogue" | "sync" | "generic";

export type FeatureNoticeInput = {
  errorCode: string | null;
  failed: boolean;
  recognitionStatus: ProviderFeatureState["recognitionStatus"];
  syncStatus: string;
  hasBinding: boolean;
  featureCount: number;
  hasStateError: boolean;
};

const HOST = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

export const normalizeHost = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "");

/**
 * Exact host, the apex of `*host`, or `www.` plus the suffix of `*.host`.
 * `*.host` does not cover that apex, so the representative is `www.host`.
 * Other wildcards yield "".
 */
const representativeHost = (pattern: string): string => {
  const kind = getDomainPatternKind(pattern);
  if (kind === "exact") return pattern;
  if (kind === "apex-and-subdomains") return pattern.slice(1);
  if (kind === "subdomains-only") return `www.${pattern.slice(2)}`;
  return "";
};

export const recognitionHost = (pattern: string, fixed?: string | null): string => {
  if (fixed) {
    const host = normalizeHost(fixed);
    return HOST.test(host) ? host : "";
  }
  const host = representativeHost(normalizeHost(pattern));
  return HOST.test(host) ? host : "";
};

/** Initials from a display name. Callers must not substitute a provider mark. */
export const genericInitials = (name: string): string => {
  const words = name.split(/[^0-9A-Za-z]+/).filter((word) => word.length > 0);
  const letters = words.map((word) => word[0] ?? "").join("");
  return (letters || name).slice(0, 2).toUpperCase();
};

export const initialsFromState = (state: ProviderFeatureState): string => {
  if (state.decorator?.initials) return state.decorator.initials.slice(0, 2);
  if (state.providerInitials) return state.providerInitials.slice(0, 2);
  return genericInitials(state.providerName);
};

export const findProviderFeature = (
  features: readonly ProviderFeature[],
  featureId: string | null,
): ProviderFeature | null =>
  featureId === null
    ? null
    : (features.find((feature) => feature.featureId === featureId) ?? null);

/** A group that already uses this feature and does not include the rule being edited. */
export const otherGroup = (
  bindings: readonly RuleFeatureBinding[],
  providerId: string,
  featureId: string,
  identityPattern: string,
): RuleFeatureBinding | null =>
  bindings.find(
    (binding) =>
      binding.providerId === providerId &&
      binding.featureId === featureId &&
      !bindingPatterns(binding).includes(identityPattern),
  ) ?? null;

export const joinInfo = (binding: RuleFeatureBinding): JoinInfo => {
  const patterns = bindingPatterns(binding);
  return {
    pattern: patterns[0] ?? binding.rulePattern,
    extra: Math.max(0, patterns.length - 1),
  };
};

const none = (view: SlotView): SlotModel => ({
  view,
  feature: null,
  decorator: null,
  groupSize: 0,
  join: null,
});

type Mark = {
  view: SlotView;
  featureId: string;
  label: string;
  feature: ProviderFeature | null;
  groupSize?: number;
  join?: JoinInfo | null;
};

const marked = (input: SlotInput, mark: Mark): SlotModel => ({
  view: mark.view,
  feature: mark.feature,
  groupSize: mark.groupSize ?? 0,
  join: mark.join ?? null,
  decorator: {
    providerId: input.providerId,
    providerName: input.providerName,
    initials: input.initials,
    ...(input.badgeColors ? { badgeColors: input.badgeColors } : {}),
    featureId: mark.featureId,
    label: mark.label,
    type: "service",
  },
});

const plain = (input: SlotInput, view: SlotView): SlotModel =>
  marked(input, { view, featureId: "", label: input.providerName, feature: null });

const fromDecision = (input: SlotInput): SlotModel => {
  const decision = input.decision;
  const featureId = decision?.featureId;
  if (!decision || featureId === null || featureId === undefined)
    return plain(input, "manual");
  const feature = findProviderFeature(input.features, featureId);
  const label = feature?.name ?? input.binding?.featureName ?? featureId;
  if (!decision.joinExisting) {
    return marked(input, { view: "staged", featureId, label, feature });
  }
  const group = otherGroup(
    input.bindings,
    input.providerId,
    featureId,
    input.identityPattern,
  );
  return marked(input, {
    view: "staged",
    featureId,
    label,
    feature,
    join: group ? joinInfo(group) : { pattern: "", extra: 0 },
  });
};

/** Maps provider status to one slot line. Raw backend text stays out. */
export const featureNotice = (input: FeatureNoticeInput): FeatureNotice | null => {
  const status = input.recognitionStatus;
  if (input.errorCode === "recognition-blocked" || status === "blocked")
    return "blocked";
  if (input.errorCode === "recognition-unavailable") return "connect";
  if (status === "unavailable" && input.hasStateError) return "paused";
  if (status === "preparing" || input.errorCode === "recognition-preparing")
    return null;
  if (input.syncStatus === "error" && input.hasBinding) return "sync";
  if (input.failed) return "generic";
  if (input.featureCount === 0 && input.hasStateError) return "catalogue";
  return null;
};

const fromBinding = (input: SlotInput): SlotModel | null => {
  const binding = input.binding;
  if (!binding) return null;
  const feature = findProviderFeature(input.features, binding.featureId);
  return marked(input, {
    view: "linked",
    featureId: binding.featureId,
    label: binding.featureName,
    feature,
    groupSize: bindingPatterns(binding).length,
  });
};

const suggestionOf = (input: SlotInput): ProviderFeature | null => {
  if (input.match?.status !== "matched") return null;
  return findProviderFeature(input.features, input.match.featureId);
};

const fromMatch = (input: SlotInput): SlotModel => {
  const suggestion = suggestionOf(input);
  const declined =
    input.dismissed ||
    (suggestion !== null && suggestion.featureId === input.declinedId);
  if (input.recognizing && suggestion === null) return plain(input, "checking");
  if (!suggestion || declined) return plain(input, "manual");
  const group = otherGroup(
    input.bindings,
    input.providerId,
    suggestion.featureId,
    input.identityPattern,
  );
  if (group) {
    return marked(input, {
      view: "join",
      featureId: suggestion.featureId,
      label: suggestion.name,
      feature: suggestion,
      groupSize: bindingPatterns(group).length,
      join: joinInfo(group),
    });
  }
  return marked(input, {
    view: "suggest",
    featureId: suggestion.featureId,
    label: suggestion.name,
    feature: suggestion,
  });
};

export const resolveSlot = (input: SlotInput): SlotModel => {
  if (!input.available || input.providerId === "") return none("hidden");
  if (input.decision) return fromDecision(input);
  return fromBinding(input) ?? fromMatch(input);
};
