import type {
  SurfaceMethodQueryCounts,
  SurfaceQueryCounts,
} from "@privacy-brand/xray-protocol";

import type { WindowSeedTrigger } from "@/background/firefox-window-name-seed-log";
import type { ExtensionLogInput } from "@/background/logger";
import type { loadContainerAssignments } from "@/background/storage/container-assignments";
import type { loadLocations } from "@/background/storage/locations";
import type { loadRules } from "@/background/storage/rules";
import type { SurfaceEvidenceByRealm } from "@/background/surface-evidence-tracker";
import type {
  ControlState,
  XRayAccessedCategories,
  EffectiveTabContext,
  GlobalFallbackRule,
  RuntimeSnapshot,
  SharedWorkerHandlingMode,
} from "@/shared/types";

export type PopupTab = chrome.tabs.Tab & { cookieStoreId?: string };
export type LoadedLocations = Awaited<ReturnType<typeof loadLocations>>;
export type LoadedRules = Awaited<ReturnType<typeof loadRules>>;
export type LoadedContainers = Awaited<ReturnType<typeof loadContainerAssignments>>;

export type UpdateCurrentRuleInput = {
  locationId: string | undefined;
  patternMode: "exact" | "suffix";
  replaceExisting: boolean;
  blockServiceWorkers: boolean;
  relaxCspForWorkers: boolean;
  tabId?: number;
  hostnameOverride?: string;
  createExactOverride?: boolean;
  serviceWorkerOverride?: boolean | null;
  regionalPresetEnabled?: boolean;
  workerHandlingOverride?: SharedWorkerHandlingMode | null;
};

export type PopupCommandDeps = {
  ensureStorageMigration: () => Promise<void>;
  getPopupTabById: (tabId: number | undefined) => Promise<PopupTab | undefined>;
  isSupportedWebUrl: (url: string | undefined) => url is string;
  getExactHostname: (url: string) => string;
  getSurfaceAccess: (tabId: number) => XRayAccessedCategories;
  getSurfaceErrors: (tabId: number) => XRayAccessedCategories;
  getRealmEvidence: (tabId: number) => SurfaceEvidenceByRealm;
  getSurfaceCounts: (tabId: number) => SurfaceQueryCounts;
  getSurfaceMethodCounts: (tabId: number) => SurfaceMethodQueryCounts;
  resolveFallbackId: (
    profiles: LoadedLocations,
    globalFallbackRule: GlobalFallbackRule | undefined,
  ) => string | null;
  canRequestUserScripts: () => boolean;
  hasUserScriptsPermission: () => Promise<boolean>;
  setLastKnownProfiles: (profiles: LoadedLocations) => void;
  setLastKnownRules: (rules: LoadedRules) => void;
  setLastKnownControlState: (controlState: ControlState) => void;
  setLastKnownDebugMode: (debugMode: boolean) => void;
  setKnownContainers: (assignments: LoadedContainers) => void;
  setKnownFallback: (globalFallbackRule: GlobalFallbackRule | undefined) => void;
  getLastKnownDebugMode: () => boolean | null;
  refreshActionState: (tabId?: number) => Promise<void>;
  grantUserScripts: () => Promise<boolean>;
  refreshCachedConfig: () => Promise<void>;
  syncPreloadedState: () => Promise<void>;
  refreshFxInjectionMode: () => Promise<void>;
  removeHostnameContexts: (hostname: string) => void;
  getActiveTabContexts: () => EffectiveTabContext[];
  resolveCachedSnapshot: (
    hostname: string,
    cookieStoreId?: string,
    exactOrigin?: string,
    options?: { trackSeenHost?: boolean },
  ) => Promise<RuntimeSnapshot | null>;
  updateSnapshotCache: (input: {
    tabId: number;
    frameId: number;
    hostname: string;
    value: RuntimeSnapshot | null;
    cookieStoreId?: string;
  }) => void;
  injectFxWindowSeed: (input: {
    tabId: number;
    frameId: number;
    cookieStoreId?: string;
    trigger?: WindowSeedTrigger;
    navigationUrl?: string;
  }) => Promise<void>;
  seedWindowSnapshot: (
    snapshot: RuntimeSnapshot | null,
    windowSeedPrefix: string,
  ) => void;
  mainWorld: `${chrome.scripting.ExecutionWorld}`;
  runtimeWindowSeedPrefix: string;
  logExtensionEvent: (input: ExtensionLogInput) => void;
};
