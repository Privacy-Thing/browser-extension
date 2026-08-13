export type FeatureFlags = {
  temporalApi: boolean;
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  temporalApi: false,
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

export const normalizeFeatureFlags = (value: unknown): FeatureFlags => {
  const source = asRecord(value);
  return {
    temporalApi:
      typeof source.temporalApi === "boolean"
        ? source.temporalApi
        : DEFAULT_FEATURE_FLAGS.temporalApi,
  };
};

export const hasNativeTemporalApi = (target: unknown = globalThis): boolean => {
  if (typeof target !== "object" || target === null) return false;
  const temporal = (target as { Temporal?: unknown }).Temporal;
  return typeof temporal === "object" && temporal !== null;
};
