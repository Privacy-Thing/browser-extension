import type {
  GetXRayStateResponse,
  SurfaceInstallationState,
  SurfaceIntegrityState,
  SurfaceMethodQueryCounts,
  SurfaceQueryCounts,
  XRaySurfaceCategory,
} from "@privacy-brand/xray-protocol";

import type { UpdateCurrentRuleInput } from "@/background/popup-command-types";
import type { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type {
  ApplySuggestionResponse,
  AssignLocationResponse,
  CleanupDomainResponse,
  CleanupLinksResponse,
  CleanupPreviewResponse,
  ClearLogsResponse,
  DeleteRuleResponse,
  ExportSettingsResponse,
  ExtensionCommand,
  FxPermissionResponse,
  FxUserScriptsResponse,
  GetControlStateResponse,
  GetLogsResponse,
  GetPopupStateResponse,
  GetSettingsResponse,
  ImportSettingsResponse,
  Location,
  LocationDraftResponse,
  PopupPolicyNoticeKind,
  ResetSettingsResponse,
  ResolveSnapshotResponse,
  RotateIdentityResponse,
  SaveLocationResponse,
  SaveSettingsResponse,
  SetPanicModeResponse,
  SiteSuggestionKind,
  ToggleRuleResponse,
  UpdateRuleResponse,
  WorkerInjectionMode,
} from "@/shared/types";

type SaveSettingsCommand = Extract<
  ExtensionCommand,
  { type: typeof EXTENSION_COMMAND_TYPES.saveSimpleSettings }
>;
type SaveLocationModelCommand = Extract<
  ExtensionCommand,
  { type: typeof EXTENSION_COMMAND_TYPES.saveLocationModel }
>;
type ImportSettingsCommand = Extract<
  ExtensionCommand,
  { type: typeof EXTENSION_COMMAND_TYPES.importSettings }
>;
type FxTestCookieCommand = Extract<
  ExtensionCommand,
  { type: typeof EXTENSION_COMMAND_TYPES.firefoxTestConfigureResponseCookie }
>;

export type RouterDeps = {
  isSupportedWebUrl: (url: string | undefined) => url is string;
  getControlState: () => Promise<GetControlStateResponse>;
  getSettings: () => Promise<GetSettingsResponse>;
  getPopupState: (tabId?: number) => Promise<GetPopupStateResponse>;
  markNoticeRead: (id: string) => Promise<unknown>;
  markNoticesAutoPresented: (ids: string[]) => Promise<unknown>;
  resolvePopupNotification: (id: string) => Promise<unknown>;
  upsertTrustedSite: (hostname: string, tabId?: number) => Promise<unknown>;
  setTrustedSiteEnabled: (
    pattern: string,
    enabled: boolean,
    tabId?: number,
  ) => Promise<ToggleRuleResponse>;
  getUserScriptsStatus: () => Promise<FxUserScriptsResponse>;
  requestUserScriptsAccess: (tabId?: number) => Promise<FxPermissionResponse>;
  assignDomainLocation: (
    locationId: string,
    patternMode: "exact" | "suffix",
    tabId?: number,
  ) => Promise<AssignLocationResponse>;
  updateCurrentRule: (input: UpdateCurrentRuleInput) => Promise<UpdateRuleResponse>;
  toggleCurrentRule: (
    enabled: boolean,
    tabId?: number,
    hostnameOverride?: string,
  ) => Promise<ToggleRuleResponse>;
  deleteCurrentRule: (
    tabId?: number,
    hostnameOverride?: string,
  ) => Promise<DeleteRuleResponse>;
  applyPopupSuggestion: (
    kind: SiteSuggestionKind,
    tabId?: number,
    hostnameOverride?: string,
    sharedWorkerHandlingMode?: WorkerInjectionMode,
  ) => Promise<ApplySuggestionResponse>;
  applyPopupPolicyAction: (
    kind: PopupPolicyNoticeKind,
    tabId?: number,
    hostnameOverride?: string,
    sharedWorkerHandlingMode?: WorkerInjectionMode,
  ) => Promise<ApplySuggestionResponse>;
  dismissPopupSuggestion: (
    kind: SiteSuggestionKind,
    tabId?: number,
    hostnameOverride?: string,
  ) => Promise<ApplySuggestionResponse>;
  createLocationDraft: (
    query: string,
    randomizeWithinMeters?: number | false,
  ) => Promise<LocationDraftResponse>;
  createDraftFromCandidate: (
    candidate: Extract<
      ExtensionCommand,
      { type: typeof EXTENSION_COMMAND_TYPES.createDraftFromCandidate }
    >["candidate"],
    randomizeWithinMeters?: number | false,
  ) => Promise<LocationDraftResponse>;
  saveSimpleSettings: (command: SaveSettingsCommand) => Promise<SaveSettingsResponse>;
  saveLocationModel: (
    command: SaveLocationModelCommand,
  ) => Promise<SaveLocationResponse>;
  resetSettings: () => Promise<ResetSettingsResponse>;
  exportSettings: () => Promise<ExportSettingsResponse>;
  importSettings: (command: ImportSettingsCommand) => Promise<ImportSettingsResponse>;
  ensureStorageMigration: () => Promise<void>;
  setLastKnownProfiles: (profiles: Location[]) => void;
  syncPreloadedState: () => Promise<void>;
  resyncActiveHeaderRules: () => Promise<void>;
  setPanicMode: (enabled: boolean) => Promise<SetPanicModeResponse>;
  handleCleanupDomainState: (
    hostname: string,
    tabId?: number,
    pageUrl?: string,
  ) => Promise<CleanupDomainResponse>;
  getLogs: () => Promise<GetLogsResponse>;
  getCleanupAssociations: (
    hostname: string,
    tabId?: number,
    pageUrl?: string,
  ) => Promise<CleanupLinksResponse>;
  previewIdentityCleanup: (
    command: Extract<
      ExtensionCommand,
      { type: typeof EXTENSION_COMMAND_TYPES.previewIdentityCleanup }
    >,
  ) => Promise<CleanupPreviewResponse>;
  rotateIdentity: (
    command: Extract<
      ExtensionCommand,
      { type: typeof EXTENSION_COMMAND_TYPES.rotateIdentityTarget }
    >,
  ) => Promise<RotateIdentityResponse>;
  clearLogs: () => Promise<ClearLogsResponse>;
  configureFxTestCookie: (
    command: FxTestCookieCommand,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  getLastKnownDebugMode: () => boolean | null;
  getXRayState: (tabId?: number) => Promise<GetXRayStateResponse>;
  recordRewriteCandidate: (input: {
    tabId: number;
    frameId: number;
    url: string;
    name: string;
    workerType: "classic" | "module";
    origin: string;
  }) => void;
  recordSurfaceUsage: (input: {
    tabId: number;
    categories: readonly XRaySurfaceCategory[];
    sourceKey: string;
    counts?: SurfaceQueryCounts;
    methodCounts?: SurfaceMethodQueryCounts;
  }) => void;
  recordSurfaceError: (
    tabId: number,
    categories: readonly XRaySurfaceCategory[],
  ) => void;
  recordSurfaceEvidence: (
    tabId: number,
    category: XRaySurfaceCategory,
    evidence: {
      realmId: string;
      frameId?: string;
      attemptId?: string;
      installation?: SurfaceInstallationState;
      integrity?: SurfaceIntegrityState;
      reasonCode?: string;
      observedAt: number;
    },
  ) => void;
  recordSurfaceCounts: (tabId: number, counts: SurfaceQueryCounts) => void;
  refreshBadgeCount: (tabId: number) => void;
  upsertTabContext: (
    tabId: number,
    context: { tabId: number; hostname: string; cookieStoreId?: string },
  ) => Promise<void>;
  readSnapshotCache: (
    tabId: number,
    frameId: number,
    hostname: string,
    cookieStoreId?: string,
  ) => ResolveSnapshotResponse["snapshot"] | undefined;
  updateSnapshotCache: (input: {
    tabId: number;
    frameId: number;
    hostname: string;
    value: ResolveSnapshotResponse["snapshot"];
    cookieStoreId?: string;
  }) => void;
  handleResolveSnapshot: (
    command: Extract<
      ExtensionCommand,
      { type: typeof EXTENSION_COMMAND_TYPES.resolveRuntimeSnapshot }
    >,
    cookieStoreId?: string,
    tabId?: number,
    frameId?: number,
  ) => Promise<ResolveSnapshotResponse>;
};
