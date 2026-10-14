import type {
  ProviderBadgeColors,
  ProviderFeature,
  ProviderFeatureMatch,
  RuleFeatureBinding,
  FeatureSyncContext,
} from "./provider-feature";

export type FeatureRuleContext = {
  rulePattern: string;
  locationId: string | null;
  locationName?: string;
  enabled: boolean;
};

/** The feature interface implemented by a PT plugin, independent of its vendor. */
export type FeaturePlugin = {
  id: string;
  name: string;
  initials?: string;
  badgeColors?: ProviderBadgeColors;
  capabilities: { catalogue: boolean; domainRecognition: boolean; ruleSync: boolean };
  getStatus: (
    binding?: RuleFeatureBinding | null,
    context?: FeatureRuleContext,
  ) => Promise<{
    available: boolean;
    syncStatus: string;
    syncContext?: FeatureSyncContext;
    error: string | null;
    recognitionStatus?: "ready" | "preparing" | "blocked" | "unavailable";
  }>;
  getFeatures: () => Promise<ProviderFeature[]>;
  recognizeDomain: (hostname: string) => Promise<ProviderFeatureMatch>;
};

export type { PluginHooks, PluginConfigurationScope } from "./plugin-hooks";
