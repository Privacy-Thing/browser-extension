import {
  controlDConfigSchema,
  type ControlDConfig,
  type ControlDPublicState,
} from "@/experimental/control-d/contracts";

const CONFIG_KEY = "pt.experimental.control-d.v2.config";
const API_KEY = "pt.experimental.control-d.v2.api-key";

const createDefaultConfig = (): ControlDConfig => ({
  version: 2,
  enabled: false,
  connected: false,
  autoSyncEnabled: false,
  status: "disconnected",
  resourceIdentity: null,
  profileId: null,
  endpointId: null,
  resolverDoh: null,
  dnsVerification: null,
  managedFolders: {},
  locationMappings: {},
  lastSyncedHash: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
});

export const loadControlDConfig = async (): Promise<ControlDConfig> => {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  const parsed = controlDConfigSchema.safeParse(stored[CONFIG_KEY]);
  if (parsed.success) {
    const locationMappings = Object.fromEntries(
      Object.entries(parsed.data.locationMappings).map(([locationId, mapping]) => [
        locationId,
        {
          locationId: mapping.locationId,
          ...(mapping.locationLabel === undefined
            ? {}
            : { locationLabel: mapping.locationLabel }),
          ...(mapping.ruleCount === undefined ? {} : { ruleCount: mapping.ruleCount }),
          proxyPk: mapping.proxyPk,
          status: mapping.status,
          confirmed: mapping.confirmed,
        },
      ]),
    );
    return { ...parsed.data, locationMappings };
  }
  const config = createDefaultConfig();
  await chrome.storage.local.set({ [CONFIG_KEY]: config });
  return config;
};

export const saveControlDConfig = async (config: ControlDConfig): Promise<void> => {
  await chrome.storage.local.set({ [CONFIG_KEY]: controlDConfigSchema.parse(config) });
};

export const loadControlDApiKey = async (): Promise<string | null> => {
  const stored = await chrome.storage.local.get(API_KEY);
  const value = stored[API_KEY];
  return typeof value === "string" && value.trim() ? value : null;
};

export const saveControlDApiKey = async (apiKey: string): Promise<void> => {
  await chrome.storage.local.set({ [API_KEY]: apiKey.trim() });
};

export const forgetControlDApiKey = async (): Promise<void> => {
  await chrome.storage.local.remove(API_KEY);
};

export const toControlDPublicState = async (
  config: ControlDConfig,
): Promise<ControlDPublicState> => {
  const dnsVerified =
    config.endpointId !== null &&
    config.dnsVerification?.endpointId === config.endpointId;
  let dnsStatus: ControlDPublicState["dnsStatus"] = "unavailable";
  if (config.resolverDoh) dnsStatus = dnsVerified ? "verified" : "pending";
  return {
    enabled: config.enabled,
    connected: config.connected,
    autoSyncEnabled: config.autoSyncEnabled,
    status: config.status,
    hasApiKey: (await loadControlDApiKey()) !== null,
    setupStatus: config.resourceIdentity ? "selected" : "unselected",
    resourceCode: config.resourceIdentity?.code ?? null,
    profileId: config.profileId,
    endpointId: config.endpointId,
    hasResolver: config.resolverDoh !== null,
    resolverDoh: config.resolverDoh,
    dnsStatus,
    dnsVerifiedAt: dnsVerified ? (config.dnsVerification?.verifiedAt ?? null) : null,
    lastAttemptAt: config.lastAttemptAt,
    lastSuccessAt: config.lastSuccessAt,
    lastError: config.lastError,
  };
};

export const CONTROL_D_STORE_KEYS = [CONFIG_KEY, API_KEY] as const;
