import type { FeatureProvider } from "@/background/provider-features";
import {
  featureDecisionSchema,
  type FeatureDecision,
  type ProviderFeature,
  type RuleFeatureBinding,
  type ProviderDecorator,
} from "@/shared/provider-feature";

let providers: readonly FeatureProvider[] = [];

export const registerFeatureProviders = (next: readonly FeatureProvider[]): void => {
  providers = next;
};

export const resolveFeatureDecision = async (
  input: FeatureDecision,
): Promise<ProviderFeature | null> => {
  const decision = featureDecisionSchema.parse(input);
  if (decision.featureId === null) return null;
  const provider = providers.find((entry) => entry.id === decision.providerId);
  if (!provider || !(await provider.getStatus()).available)
    throw new Error("Connect this provider before linking a service.");
  const feature = (await provider.getFeatures()).find(
    (entry) => entry.featureId === decision.featureId,
  );
  if (!feature) throw new Error("Choose an available service.");
  return feature;
};

export const decorateFeatureBindings = (
  bindings: readonly RuleFeatureBinding[],
): ProviderDecorator[] =>
  bindings.flatMap((binding) => {
    const provider = providers.find((entry) => entry.id === binding.providerId);
    return provider
      ? [
          {
            providerId: provider.id,
            providerName: provider.name,
            ...(provider.badgeColors ? { badgeColors: provider.badgeColors } : {}),
            initials:
              provider.initials ??
              provider.name
                .split(/\s+/)
                .map((word) => word[0])
                .join("")
                .slice(0, 2),
            featureId: binding.featureId,
            label: binding.featureName,
            type: binding.featureType,
          },
        ]
      : [];
  });
