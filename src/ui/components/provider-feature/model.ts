import type {
  ProviderFeature,
  ProviderFeatureMatch,
  RuleFeatureBinding,
} from "@/shared/provider-feature";

export type { ProviderFeature, ProviderFeatureMatch, RuleFeatureBinding };

/** State of the provider-side native rule that a binding controls. */
export type FeatureSyncStatus = "queued" | "syncing" | "synced" | "error";

export type ProviderFeatureVariant = "default" | "compact";

export type ProviderFeatureView =
  "idle" | "checking" | "suggested" | "unresolved" | "error" | "dismissed" | "bound";

export type ProviderFeatureViewInput = {
  binding: RuleFeatureBinding | null;
  busy: boolean;
  dismissed: boolean;
  features: readonly ProviderFeature[];
  match: ProviderFeatureMatch | null;
};

export type ProviderFeatureViewState = {
  view: ProviderFeatureView;
  /** Feature proposed by the domain test, resolved against `features`. */
  suggestion: ProviderFeature | null;
};

export const findProviderFeature = (
  features: readonly ProviderFeature[],
  featureId: string | null,
): ProviderFeature | null =>
  featureId === null
    ? null
    : (features.find((feature) => feature.featureId === featureId) ?? null);

const unboundView = (
  match: ProviderFeatureMatch,
  suggestion: ProviderFeature | null,
): ProviderFeatureView => {
  if (match.status === "error") return "error";
  if (match.status === "unresolved" || suggestion === null) return "unresolved";
  return "suggested";
};

export const resolveFeatureView = ({
  binding,
  busy,
  dismissed,
  features,
  match,
}: ProviderFeatureViewInput): ProviderFeatureViewState => {
  const suggestion = findProviderFeature(features, match?.featureId ?? null);
  if (binding !== null) return { view: "bound", suggestion };
  if (busy && match === null) return { view: "checking", suggestion };
  if (match === null) return { view: "idle", suggestion };
  if (dismissed) return { view: "dismissed", suggestion };
  return { view: unboundView(match, suggestion), suggestion };
};
