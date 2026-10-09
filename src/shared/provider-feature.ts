import { z } from "zod";

export const providerFeatureSchema = z.object({
  providerId: z.string().min(1),
  featureId: z.string().min(1),
  type: z.literal("service"),
  name: z.string().min(1),
});

export type ProviderFeature = z.infer<typeof providerFeatureSchema>;

export const featureBindingSchema = z.object({
  rulePattern: z.string().min(1),
  providerId: z.string().min(1),
  featureId: z.string().min(1),
  featureName: z.string().min(1),
  featureType: z.literal("service"),
  matchSource: z.enum(["domain-test", "manual"]).optional(),
  matchedHostname: z.string().min(1).optional(),
  matchCheckedAt: z.string().datetime().optional(),
  confirmedAt: z.string().datetime().optional(),
});

export type RuleFeatureBinding = z.infer<typeof featureBindingSchema>;

export const validateFeatureBindings = (
  value: unknown,
  rules: readonly { pattern: string }[],
): RuleFeatureBinding[] => {
  const bindings = z
    .array(featureBindingSchema)
    .max(4_096)
    .parse(value ?? []);
  const patterns = new Set(rules.map((rule) => rule.pattern));
  const sources = new Set<string>();
  const features = new Set<string>();
  return bindings.map((binding) => {
    const normalized = {
      ...binding,
      rulePattern: binding.rulePattern.trim().toLowerCase(),
    };
    const sourceKey = JSON.stringify([binding.providerId, normalized.rulePattern]);
    const featureKey = JSON.stringify([binding.providerId, binding.featureId]);
    if (!patterns.has(normalized.rulePattern))
      throw new Error(`Unknown rule referenced by feature: ${binding.rulePattern}`);
    if (sources.has(sourceKey) || features.has(featureKey))
      throw new Error("Conflicting provider feature bindings.");
    sources.add(sourceKey);
    features.add(featureKey);
    return normalized;
  });
};

export const featureMatchSchema = z.object({
  hostname: z.string().min(1),
  providerId: z.string().min(1),
  featureId: z.string().min(1).nullable(),
  matchSource: z.enum(["domain-test", "manual"]),
  status: z.enum(["matched", "unresolved", "overridden", "error"]),
  checkedAt: z.string().datetime(),
});

export type ProviderFeatureMatch = z.infer<typeof featureMatchSchema>;

export const featureStateSchema = z.object({
  featureBindings: z.array(featureBindingSchema).default([]),
  featureMatches: z.array(featureMatchSchema).default([]),
  dismissedMatches: z.array(featureMatchSchema).default([]),
});

export type StoredFeatureState = z.infer<typeof featureStateSchema>;

export type ProviderFeatureState = {
  available: boolean;
  providerId: string;
  providerName: string;
  features: ProviderFeature[];
  match: ProviderFeatureMatch | null;
  binding: RuleFeatureBinding | null;
  dismissed: boolean;
  syncStatus: string;
  error: string | null;
};

export const FEATURE_COMMANDS = {
  getState: "pt.provider-feature.get-state",
  recognize: "pt.provider-feature.recognize",
  confirm: "pt.provider-feature.confirm",
  dismiss: "pt.provider-feature.dismiss",
  detach: "pt.provider-feature.detach",
} as const;

export const FEATURE_EVENTS = {
  stateChanged: "pt.provider-feature.state-changed",
} as const;

export type ProviderFeatureCommand = {
  type: (typeof FEATURE_COMMANDS)[keyof typeof FEATURE_COMMANDS];
  providerId?: string | undefined;
  rulePattern: string;
  hostname: string;
  featureId?: string | undefined;
};

export type ProviderFeatureReply =
  | { ok: true; state: ProviderFeatureState }
  | { ok: false; error: string; state?: ProviderFeatureState };
