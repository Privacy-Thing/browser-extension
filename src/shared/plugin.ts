import type {
  ProviderBadgeColors,
  ProviderFeature,
  ProviderFeatureMatch,
  RuleFeatureBinding,
} from "./provider-feature";

/** The feature interface implemented by a PT plugin, independent of its vendor. */
export type FeaturePlugin = {
  id: string;
  name: string;
  initials?: string;
  badgeColors?: ProviderBadgeColors;
  capabilities: { catalogue: boolean; domainRecognition: boolean; ruleSync: boolean };
  getStatus: (binding?: RuleFeatureBinding | null) => Promise<{
    available: boolean;
    syncStatus: string;
    error: string | null;
    recognitionStatus?: "ready" | "preparing" | "blocked" | "unavailable";
  }>;
  getFeatures: () => Promise<ProviderFeature[]>;
  recognizeDomain: (hostname: string) => Promise<ProviderFeatureMatch>;
};

export type { PluginHooks, PluginConfigurationScope } from "./plugin-hooks";
