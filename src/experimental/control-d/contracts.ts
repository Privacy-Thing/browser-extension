import { z } from "zod";

export const CONTROL_D_API_ORIGIN = "https://api.controld.com/*";
export const CONTROL_D_GUIDE_URL = "https://docs.controld.com/docs/browsers-platform";
export const CONTROL_D_STATUS_URL = "https://controld.com/status";

export const CONTROL_D_COMMANDS = {
  getState: "pt.control-d.get-state",
  setEnabled: "pt.control-d.set-enabled",
  connect: "pt.control-d.connect",
  preview: "pt.control-d.preview",
  apply: "pt.control-d.apply",
  syncNow: "pt.control-d.sync-now",
  repair: "pt.control-d.repair",
  updateMapping: "pt.control-d.update-mapping",
  dnsAction: "pt.control-d.dns-action",
  disconnect: "pt.control-d.disconnect",
} as const;

export type ControlDStatus =
  "disconnected" | "ready" | "syncing" | "conflict" | "auth-error" | "error";

export type ControlDMapping = {
  locationId: string;
  locationLabel?: string;
  ruleCount?: number;
  proxyPk: string | null;
  status: "exact" | "approximate" | "skipped";
  confirmed: boolean;
};

export type ControlDManagedFolder = {
  proxyPk: string;
  folderId: number;
  remoteHash: string;
};

export type ControlDConfig = {
  version: 1;
  instanceId: string;
  enabled: boolean;
  connected: boolean;
  autoSyncEnabled: boolean;
  status: ControlDStatus;
  profileId: string | null;
  endpointId: string | null;
  resolverDoh: string | null;
  managedFolders: Record<string, ControlDManagedFolder>;
  locationMappings: Record<string, ControlDMapping>;
  lastSyncedHash: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

export type ControlDProxyLocation = {
  pk: string;
  city: string;
  countryCode: string;
  countryName: string;
  latitude: number;
  longitude: number;
};

export type ControlDCompiledRule = {
  sourcePattern: string;
  hostname: string;
  locationId: string;
  proxyPk: string;
};

export type ControlDCompileWarning = {
  code:
    | "exact-pattern-broadened"
    | "unsupported-pattern"
    | "missing-location"
    | "missing-country"
    | "approximate-location"
    | "skipped-location";
  message: string;
  pattern?: string;
  locationId?: string;
};

export type ControlDDiff = {
  createProfile: boolean;
  createEndpoint: boolean;
  createFolders: number;
  addRules: number;
  updateRules: number;
  deleteRules: number;
  unchangedRules: number;
  warnings: ControlDCompileWarning[];
  mappings: ControlDMapping[];
  requiresApproximationConfirmation: boolean;
};

export type ControlDPublicState = {
  enabled: boolean;
  connected: boolean;
  autoSyncEnabled: boolean;
  status: ControlDStatus;
  hasApiKey: boolean;
  profileId: string | null;
  endpointId: string | null;
  hasResolver: boolean;
  resolverDoh: string | null;
  locationMappings: ControlDMapping[];
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

export type ControlDResponse<T = undefined> =
  | ({ ok: true; state: ControlDPublicState } & (T extends undefined ? object : T))
  | { ok: false; error: string; state?: ControlDPublicState };

const mappingSchema = z.object({
  locationId: z.string().min(1),
  locationLabel: z.string().min(1).optional(),
  ruleCount: z.number().int().nonnegative().optional(),
  proxyPk: z.string().min(1).nullable(),
  status: z.enum(["exact", "approximate", "skipped"]),
  confirmed: z.boolean(),
});

const managedFolderSchema = z.object({
  proxyPk: z.string().min(1),
  folderId: z.number().int().nonnegative(),
  remoteHash: z.string(),
});

export const controlDConfigSchema = z.object({
  version: z.literal(1),
  instanceId: z.string().min(1),
  enabled: z.boolean().optional(),
  connected: z.boolean(),
  autoSyncEnabled: z.boolean(),
  status: z.enum([
    "disconnected",
    "ready",
    "syncing",
    "conflict",
    "auth-error",
    "error",
  ]),
  profileId: z.string().min(1).nullable(),
  endpointId: z.string().min(1).nullable(),
  resolverDoh: z.string().min(1).nullable(),
  managedFolders: z.record(z.string(), managedFolderSchema),
  locationMappings: z.record(z.string(), mappingSchema),
  lastSyncedHash: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  lastError: z.string().nullable(),
});

export type ControlDCommand =
  | { type: typeof CONTROL_D_COMMANDS.getState }
  | { type: typeof CONTROL_D_COMMANDS.setEnabled; enabled: boolean }
  | { type: typeof CONTROL_D_COMMANDS.connect; apiKey: string }
  | { type: typeof CONTROL_D_COMMANDS.preview }
  | {
      type: typeof CONTROL_D_COMMANDS.apply;
      confirmApproximate: boolean;
    }
  | { type: typeof CONTROL_D_COMMANDS.syncNow }
  | { type: typeof CONTROL_D_COMMANDS.repair }
  | {
      type: typeof CONTROL_D_COMMANDS.updateMapping;
      mapping: ControlDMapping;
    }
  | {
      type: typeof CONTROL_D_COMMANDS.dnsAction;
      action: "copy-resolver" | "open-settings" | "open-status" | "open-guide";
      outcome: "success" | "fallback" | "failure";
    }
  | { type: typeof CONTROL_D_COMMANDS.disconnect };

export const isControlDCommand = (value: unknown): value is ControlDCommand => {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return (
    typeof type === "string" &&
    Object.values(CONTROL_D_COMMANDS).includes(
      type as (typeof CONTROL_D_COMMANDS)[keyof typeof CONTROL_D_COMMANDS],
    )
  );
};
