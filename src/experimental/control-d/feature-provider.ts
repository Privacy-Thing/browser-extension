import { ControlDClient } from "./client";
import { CONTROL_D_PROVIDER_ID, type ControlDConfig } from "./contracts";
import {
  ensureControlDRecognition,
  isRecognitionSweepActive,
  loadRecognitionState,
} from "./recognition-setup";
import { loadControlDApiKey, loadControlDConfig } from "./storage";

import type { FeaturePlugin, FeatureRuleContext } from "@/shared/plugin";
import {
  providerFeatureSchema,
  type ProviderFeature,
  type RuleFeatureBinding,
  type FeatureSyncContext,
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

export class ControlDRecognitionError extends Error {
  readonly code:
    "recognition-preparing" | "recognition-blocked" | "recognition-unavailable";

  constructor(code: ControlDRecognitionError["code"], message: string) {
    super(message);
    this.name = "ControlDRecognitionError";
    this.code = code;
  }
}

const recognitionError = (
  code: ControlDRecognitionError["code"],
): ControlDRecognitionError => {
  if (code === "recognition-preparing") {
    return new ControlDRecognitionError(
      code,
      "Control D is preparing domain matching.",
    );
  }
  if (code === "recognition-blocked") {
    return new ControlDRecognitionError(
      code,
      "Choose a service manually while lookup matching is blocked.",
    );
  }
  return new ControlDRecognitionError(
    code,
    "Connect Control D before recognizing domains.",
  );
};

const contextState = (
  config: ControlDConfig,
  context: FeatureRuleContext | undefined,
): FeatureSyncContext["state"] => {
  if (!context?.locationId) return "no-preset";
  if (!context.enabled) return "disabled";
  const mapping = config.locationMappings[context.locationId];
  if (mapping?.status === "skipped" || mapping?.proxyPk === null) return "excluded";
  if (!config.autoSyncEnabled) return "paused";
  if (!mapping?.confirmed || !mapping.proxyPk) return "pending";
  return "ready";
};

const settingsPath = (
  state: FeatureSyncContext["state"],
  locationId: string | null | undefined,
): string => {
  const base = "src/ui/options/index.html#page-experimental-integration";
  if (state === "paused") return base;
  const preset = locationId ? "&preset=" + encodeURIComponent(locationId) : "";
  return base + "?section=routes" + preset;
};

const syncState = async (
  binding: RuleFeatureBinding | null | undefined,
  context: FeatureRuleContext | undefined,
) => {
  const config = await loadControlDConfig();
  const available = config.enabled && config.connected;
  const mapping = context?.locationId
    ? config.locationMappings[context.locationId]
    : undefined;
  const managed = binding ? config.managedServices?.[binding.featureId] : undefined;
  let syncStatus = "queued";
  if (["conflict", "auth-error", "error"].includes(config.status)) syncStatus = "error";
  else if (config.status === "syncing") syncStatus = "syncing";
  else if (
    available &&
    context?.enabled &&
    mapping?.confirmed &&
    mapping.status !== "skipped" &&
    managed?.rulePattern === binding?.rulePattern &&
    managed?.proxyPk === mapping?.proxyPk
  )
    syncStatus = "synced";
  const state = contextState(config, context);
  return {
    available,
    syncStatus,
    error: config.lastError,
    syncContext: {
      state,
      ...(context?.locationName ? { presetName: context.locationName } : {}),
      settingsPath: settingsPath(state, context?.locationId),
    },
  };
};

const recognitionStatus = async (): Promise<
  "ready" | "preparing" | "blocked" | "unavailable"
> => {
  const config = await loadControlDConfig();
  if (!config.enabled || !config.connected) return "unavailable";
  if (isRecognitionSweepActive()) return "preparing";
  const state = await loadRecognitionState();
  if (state.phase === "blocked") return "blocked";
  if (state.phase === "preparing") return state.lastError ? "unavailable" : "preparing";
  if (state.phase === "ready" && state.resolverDoh) return "ready";
  return "unavailable";
};

export const createControlDProvider = (): FeaturePlugin => {
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
    initials: "CD",
    // Official controld.com palette: greenApple on blue800.
    badgeColors: { background: "#1BE3AD", foreground: "#010818" },
    capabilities: { catalogue: true, domainRecognition: true, ruleSync: true },
    getFeatures,
    getStatus: async (binding, context) => {
      const status = await syncState(binding, context);
      const recognition = await recognitionStatus();
      const blocked =
        recognition === "blocked" || recognition === "unavailable"
          ? await loadRecognitionState()
          : null;
      return Object.assign(
        {
          available: status.available,
          syncStatus: status.syncStatus,
          syncContext: status.syncContext,
          error: status.error ?? catalogueError ?? blocked?.lastError ?? null,
        },
        { recognitionStatus: recognition },
      );
    },
    recognizeDomain: async (hostname) => {
      const config = await loadControlDConfig();
      if (!config.enabled || !config.connected || !(await loadControlDApiKey())) {
        throw recognitionError("recognition-unavailable");
      }
      if (isRecognitionSweepActive()) throw recognitionError("recognition-preparing");
      const outcome = await ensureControlDRecognition();
      if (outcome.phase === "preparing" || isRecognitionSweepActive()) {
        throw recognitionError("recognition-preparing");
      }
      if (outcome.phase === "blocked") throw recognitionError("recognition-blocked");
      if (outcome.phase !== "ready" || !outcome.resolverDoh) {
        throw recognitionError("recognition-unavailable");
      }
      const result = await (
        await client()
      ).queryDomain(resolverIdFrom(outcome.resolverDoh), hostname);
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
