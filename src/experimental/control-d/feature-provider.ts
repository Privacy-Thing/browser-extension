import { ControlDClient } from "./client";
import { CONTROL_D_PROVIDER_ID } from "./contracts";
import { loadRecognitionState } from "./recognition-setup";
import { loadControlDApiKey, loadControlDConfig } from "./storage";

import type { FeatureProvider } from "@/background/provider-features";
import { loadRules } from "@/background/storage/rules";
import {
  providerFeatureSchema,
  type ProviderFeature,
  type RuleFeatureBinding,
} from "@/shared/provider-feature";

const CATALOGUE_TTL = 24 * 60 * 60 * 1_000;
const CATALOGUE_KEY = "pt.experimental.control-d.v2.feature-catalogue";

export const resolverIdFrom = (input: string): string => {
  if (/^[A-Za-z0-9_-]{1,128}$/.test(input)) return input;
  const url = new URL(input);
  const resolverId = url.pathname.slice(1);
  if (
    url.origin !== "https://dns.controld.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(resolverId)
  )
    throw new Error("Control D resolver URL was rejected.");
  return resolverId;
};

const syncState = async (binding: RuleFeatureBinding | null | undefined) => {
  const config = await loadControlDConfig();
  const available = config.enabled && config.connected;
  const rule = binding
    ? (await loadRules()).find((item) => item.pattern === binding.rulePattern)
    : undefined;
  const mapping = rule?.locationId
    ? config.locationMappings[rule.locationId]
    : undefined;
  const managed = binding ? config.managedServices?.[binding.featureId] : undefined;
  let syncStatus = "queued";
  if (["conflict", "auth-error", "error"].includes(config.status)) syncStatus = "error";
  else if (config.status === "syncing") syncStatus = "syncing";
  else if (
    available &&
    rule?.enabled !== false &&
    rule &&
    mapping?.confirmed &&
    mapping.status !== "skipped" &&
    managed?.rulePattern === binding?.rulePattern &&
    managed?.proxyPk === mapping?.proxyPk
  )
    syncStatus = "synced";
  return { available, syncStatus, error: config.lastError };
};

export const createControlDProvider = (): FeatureProvider => {
  let catalogue: ProviderFeature[] | null = null;
  let catalogueAt = 0;
  let catalogueError: string | null = null;
  let pending: Promise<ProviderFeature[]> | null = null;

  const client = async (): Promise<ControlDClient> => {
    const key = await loadControlDApiKey();
    if (!key) throw new Error("Connect Control D before recognizing domains.");
    return new ControlDClient(key);
  };

  const refreshCatalogue = async (): Promise<ProviderFeature[]> => {
    try {
      const features = (await (await client()).listServices()).map((service) => ({
        providerId: CONTROL_D_PROVIDER_ID,
        featureId: service.pk,
        type: "service" as const,
        name: service.name,
      }));
      catalogueAt = Date.now();
      catalogue = features;
      catalogueError = null;
      await chrome.storage.local.set({
        [CATALOGUE_KEY]: { features, checkedAt: catalogueAt },
      });
      return features;
    } catch (error) {
      if (!catalogue) throw error;
      catalogueError =
        "Control D service names are cached; refreshing the catalogue failed.";
      return catalogue;
    }
  };

  const getFeatures = async (): Promise<ProviderFeature[]> => {
    if (!catalogue) {
      const stored = (await chrome.storage.local.get(CATALOGUE_KEY))[CATALOGUE_KEY] as
        { features?: unknown; checkedAt?: unknown } | undefined;
      const parsed = providerFeatureSchema.array().safeParse(stored?.features);
      if (
        parsed.success &&
        typeof stored?.checkedAt === "number" &&
        parsed.data.every((feature) => feature.providerId === CONTROL_D_PROVIDER_ID)
      ) {
        catalogue = parsed.data;
        catalogueAt = stored.checkedAt;
      }
    }
    if (catalogue && Date.now() - catalogueAt < CATALOGUE_TTL) return catalogue;
    pending ??= refreshCatalogue();
    try {
      return await pending;
    } finally {
      pending = null;
    }
  };

  return {
    id: CONTROL_D_PROVIDER_ID,
    name: "Control D",
    capabilities: { catalogue: true, domainRecognition: true, ruleSync: true },
    getFeatures,
    getStatus: async (binding) => {
      const status = await syncState(binding);
      return { ...status, error: status.error ?? catalogueError };
    },
    recognizeDomain: async (hostname) => {
      const config = await loadRecognitionState();
      if (config.phase !== "ready" || !config.resolverDoh)
        throw new Error(
          "Preview and apply the Control D lookup setup before recognizing domains. You can still choose a service manually.",
        );
      const result = await (
        await client()
      ).queryDomain(resolverIdFrom(config.resolverDoh), hostname);
      const features = await getFeatures();
      const known = features.some((feature) => feature.featureId === result.serviceId);
      return {
        hostname,
        providerId: CONTROL_D_PROVIDER_ID,
        featureId: result.status === "matched" && known ? result.serviceId : null,
        matchSource: "domain-test",
        status: result.status === "matched" && !known ? "unresolved" : result.status,
        checkedAt: new Date().toISOString(),
      };
    },
  };
};
