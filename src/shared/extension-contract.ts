const EXTENSION_NAMESPACE = "pt";

const createCommandType = <Name extends string>(name: Name) =>
  `${EXTENSION_NAMESPACE}:${name}` as const;
const createStorageKey = <Name extends string>(name: Name) =>
  `${EXTENSION_NAMESPACE}.${name}` as const;
const createSessionKey = <Name extends string>(name: Name) =>
  `${EXTENSION_NAMESPACE}:${name}` as const;
const createSnakeStorageKey = <Name extends string>(name: Name) =>
  `${EXTENSION_NAMESPACE}_${name}` as const;
const createDataAttribute = <Name extends string>(name: Name) =>
  `data-${EXTENSION_NAMESPACE}-${name}` as const;
const createFxTestEvent = <Name extends string>(name: Name) =>
  `${EXTENSION_NAMESPACE}-firefox-test-${name}` as const;

export const CMD_RESOLVE_SNAPSHOT = createCommandType("resolve-runtime-snapshot");
export const CMD_SAVE_SETTINGS = createCommandType("save-simple-settings");
export const CMD_SAVE_LOCATION = createCommandType("save-location-model");
export const CMD_CLEANUP_DOMAIN = createCommandType("cleanup-domain-state");
export const CMD_GET_CLEANUP = createCommandType("get-cleanup-associations");
export const CMD_GET_SETTINGS = createCommandType("get-settings");
export const CMD_ASSIGN_LOCATION = createCommandType("assign-current-domain-location");
export const CMD_GET_LOGS = createCommandType("get-logs");
export const CMD_CLEAR_LOGS = createCommandType("clear-logs");
export const CMD_TEST_RESPONSE_COOKIE = createCommandType(
  "firefox-test-configure-response-cookie",
);
export const CMD_LOG_EVENT = createCommandType("log-event");
export const CMD_SURFACE_USAGE = createCommandType("surface-usage");
export const CMD_SURFACE_ERROR = createCommandType("surface-error");
export const CMD_GET_SURFACE_USAGE = createCommandType("request-surface-usage");
export const CMD_WORKER_REWRITE = createCommandType("shared-worker-rewrite-candidate");

export const EXTENSION_COMMAND_TYPES = {
  resolveRuntimeSnapshot: CMD_RESOLVE_SNAPSHOT,
  saveSimpleSettings: CMD_SAVE_SETTINGS,
  saveLocationModel: CMD_SAVE_LOCATION,
  cleanupDomainState: CMD_CLEANUP_DOMAIN,
  getCleanupAssociations: CMD_GET_CLEANUP,
  previewIdentityCleanup: createCommandType("preview-identity-cleanup"),
  rotateIdentityTarget: createCommandType("rotate-identity-target"),
  setPanicMode: createCommandType("set-panic-mode"),
  getControlState: createCommandType("get-control-state"),
  getSettings: CMD_GET_SETTINGS,
  resetSettings: createCommandType("reset-settings"),
  exportSettings: createCommandType("export-settings"),
  importSettings: createCommandType("import-settings"),
  loadSampleData: createCommandType("load-sample-data"),
  importPresetLocations: createCommandType("import-preset-locations"),
  getPopupState: createCommandType("get-popup-state"),
  markNoticeRead: createCommandType("mark-popup-notification-read"),
  markNoticesAutoPresented: createCommandType(
    "mark-popup-notifications-auto-presented",
  ),
  resolvePopupNotification: createCommandType("resolve-popup-notification"),
  upsertTrustedSite: createCommandType("upsert-trusted-site"),
  setTrustedSiteEnabled: createCommandType("set-trusted-site-enabled"),
  getUserScriptsStatus: createCommandType("get-firefox-user-scripts-readiness"),
  requestFirefoxUserscriptsPermission: createCommandType(
    "request-firefox-userscripts-permission",
  ),
  assignDomainLocation: CMD_ASSIGN_LOCATION,
  updateCurrentRule: createCommandType("update-current-rule"),
  toggleCurrentRule: createCommandType("toggle-current-rule"),
  deleteCurrentRule: createCommandType("delete-current-rule"),
  acceptPopupSuggestion: createCommandType("accept-popup-suggestion"),
  applyPopupPolicyAction: createCommandType("apply-popup-policy-action"),
  dismissPopupSuggestion: createCommandType("dismiss-popup-suggestion"),
  getLogs: CMD_GET_LOGS,
  clearLogs: CMD_CLEAR_LOGS,
  firefoxTestConfigureResponseCookie: CMD_TEST_RESPONSE_COOKIE,
  logEvent: CMD_LOG_EVENT,
  createLocationDraft: createCommandType("create-location-draft"),
  createDraftFromCandidate: createCommandType("create-location-draft-from-candidate"),
  getXRayState: createCommandType("get-doctor-state"),
  surfaceUsage: CMD_SURFACE_USAGE,
  surfaceError: CMD_SURFACE_ERROR,
  requestSurfaceUsage: CMD_GET_SURFACE_USAGE,
  sharedWorkerRewriteCandidate: CMD_WORKER_REWRITE,
} as const;

export const FXT_GET_SETTINGS = createFxTestEvent("get-settings");
export const FXT_GET_SETTINGS_DONE = createFxTestEvent("get-settings-result");
export const FXT_SAVE_LOCATION = createFxTestEvent("save-location-model");
export const FXT_SAVE_LOCATION_DONE = createFxTestEvent("save-location-model-result");
export const FXT_SAVE_SETTINGS = createFxTestEvent("save-simple-settings");
export const FXT_SAVE_SETTINGS_DONE = createFxTestEvent("save-simple-settings-result");
export const FXT_ASSIGN_LOCATION = createFxTestEvent("assign-current-domain-location");
export const FXT_ASSIGN_LOCATION_DONE = createFxTestEvent(
  "assign-current-domain-location-result",
);
export const FXT_GET_LOGS = createFxTestEvent("get-logs");
export const FXT_GET_LOGS_DONE = createFxTestEvent("get-logs-result");
export const FXT_CLEAR_LOGS = createFxTestEvent("clear-logs");
export const FXT_CLEAR_LOGS_DONE = createFxTestEvent("clear-logs-result");
export const FXT_SET_RESPONSE_COOKIE = createFxTestEvent("configure-response-cookie");
export const FXT_SET_COOKIE_DONE = createFxTestEvent(
  "configure-response-cookie-result",
);

export const FXT_BRIDGE_EVENTS = {
  getSettings: FXT_GET_SETTINGS,
  getSettingsResult: FXT_GET_SETTINGS_DONE,
  saveLocationModel: FXT_SAVE_LOCATION,
  saveLocationModelResult: FXT_SAVE_LOCATION_DONE,
  saveSimpleSettings: FXT_SAVE_SETTINGS,
  saveSimpleSettingsResult: FXT_SAVE_SETTINGS_DONE,
  assignDomainLocation: FXT_ASSIGN_LOCATION,
  assignDomainLocationResult: FXT_ASSIGN_LOCATION_DONE,
  getLogs: FXT_GET_LOGS,
  getLogsResult: FXT_GET_LOGS_DONE,
  clearLogs: FXT_CLEAR_LOGS,
  clearLogsResult: FXT_CLEAR_LOGS_DONE,
  configureResponseCookie: FXT_SET_RESPONSE_COOKIE,
  configureResponseCookieResult: FXT_SET_COOKIE_DONE,
} as const;

export const FIREFOX_SCRIPT_IDS = {
  geoShim: `${EXTENSION_NAMESPACE}-main-world-early`,
  mainWorld: `${EXTENSION_NAMESPACE}-main-world-runtime`,
  timingSpike: `${EXTENSION_NAMESPACE}-timing-spike`,
} as const;

export const REGISTERED_FX_SCRIPT_IDS = [
  FIREFOX_SCRIPT_IDS.geoShim,
  FIREFOX_SCRIPT_IDS.mainWorld,
  FIREFOX_SCRIPT_IDS.timingSpike,
] as const;

export const buildFxSeedScriptId = (index: number): string =>
  `${EXTENSION_NAMESPACE}-firefox-static-state-seed-${index}`;

export const EXTENSION_STORAGE_KEYS = {
  locations: createStorageKey("locations"),
  rules: createStorageKey("rules"),
  trustedSites: createStorageKey("trustedSites"),
  controlState: createStorageKey("control-state"),
  migrationNotice: createStorageKey("migrationNotice"),
  siteSuggestions: createStorageKey("siteSuggestions"),
  popupNotifications: createStorageKey("popupNotifications"),
  seenHosts: createSnakeStorageKey("seen_hosts"),
  containerAssignments: createSnakeStorageKey("container_assignments"),
  preloadedRuntimeState: createSessionKey("preloaded-runtime-state"),
  defaultNoiseRadius: createStorageKey("defaultNoiseRadius"),
  watchPositionDelayMin: createStorageKey("watchPositionDelay.min"),
  watchPositionDelayMax: createStorageKey("watchPositionDelay.max"),
  theme: createStorageKey("theme"),
  surfaceProtectionsDefaultReset: createStorageKey("surfaceProtectionsDefaultReset"),
  preferences: createStorageKey("preferences"),
} as const;

export const STORAGE_PRELOADED_STATE = EXTENSION_STORAGE_KEYS.preloadedRuntimeState;

export const UI_DATA_ATTRIBUTES = {
  firefoxSettingsBridge: createDataAttribute("firefox-settings-bridge"),
  toast: createDataAttribute("toast"),
  toastProgress: createDataAttribute("toast-progress"),
} as const;

export const FIREFOX_BRIDGE_ATTR = UI_DATA_ATTRIBUTES.firefoxSettingsBridge;

export const DIAGNOSTIC_GLOBAL_KEYS = {
  firefoxTimingSpike: "__PT_FIREFOX_TIMING_SPIKE__",
} as const;
