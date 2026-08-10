type MethodRuntimeTarget = "main" | "early" | "firefox" | "worker";

export type SpoofingSurfaceGroup =
  "location-locale" | "browser-identity" | "rendering-media" | "workers";

export type SurfaceCapability = "battery-status" | "client-hints";

export type SpoofingBrowserTarget = "chromium" | "firefox";

export const BROWSER_CAPABILITIES = {
  chromium: ["battery-status", "client-hints"],
  firefox: [],
} as const satisfies Record<SpoofingBrowserTarget, readonly SurfaceCapability[]>;

type MethodCatalogEntry = {
  /**
   * Stable protocol-facing counter key. This is diagnostic API, not UI text,
   * and should not change for ordinary implementation refactors.
   */
  id: string;
  /** i18n anchor used by XRay UI to render a short method label. */
  labelKey: string;
  /**
   * Optional runtime paths that can emit this method. Omitted means the method
   * is not tied to a single documented injection path.
   */
  runtimeTargets?: readonly MethodRuntimeTarget[];
};

/**
 * Stable diagnostic method identifiers used by Privacy Thing XRay.
 *
 * These IDs are protocol-facing keys, not UI labels. Keep them stable across
 * refactors so saved traces, tests, and sidebar diagnostics can compare method
 * activity without depending on localized text or implementation filenames.
 */
const SURFACE_METHODS = {
  geolocation: [
    { id: "geolocation.getCurrentPosition", labelKey: "getCurrentPosition" },
    { id: "geolocation.watchPosition", labelKey: "watchPosition" },
    { id: "geolocation.clearWatch", labelKey: "clearWatch" },
    { id: "geolocation.permissionsQuery", labelKey: "permissionsQuery" },
  ],
  timeLocale: [
    { id: "date.constructor", labelKey: "dateConstructor" },
    { id: "date.now", labelKey: "dateNow" },
    { id: "date.parse", labelKey: "dateParse" },
    { id: "date.getTimezoneOffset", labelKey: "dateGetTimezoneOffset" },
    { id: "date.toString", labelKey: "dateToString" },
    { id: "date.toLocaleString", labelKey: "dateToLocaleString" },
    { id: "intl.constructor", labelKey: "intlConstructor" },
    { id: "intl.resolvedOptions", labelKey: "intlResolvedOptions" },
    { id: "intl.DateTimeFormat.format", labelKey: "intlDateTimeFormatFormat" },
    {
      id: "intl.DateTimeFormat.formatToParts",
      labelKey: "intlDateTimeFormatFormatToParts",
    },
  ],
  canvas: [
    { id: "canvas.getImageData", labelKey: "canvasGetImageData" },
    { id: "canvas.toDataURL", labelKey: "canvasToDataURL" },
    { id: "canvas.toBlob", labelKey: "canvasToBlob" },
  ],
  webGL: [
    { id: "webGL.readPixels", labelKey: "webGLReadPixels" },
    { id: "webGL.getExtension", labelKey: "webGLGetExtension" },
    { id: "webGL.getSupportedExtensions", labelKey: "webGLGetSupportedExtensions" },
    { id: "webGL.getParameter", labelKey: "webGLGetParameter" },
  ],
  audio: [
    { id: "audio.getFloatFrequencyData", labelKey: "audioGetFloatFrequencyData" },
    { id: "audio.getByteFrequencyData", labelKey: "audioGetByteFrequencyData" },
    { id: "audio.getFloatTimeDomainData", labelKey: "audioGetFloatTimeDomainData" },
    { id: "audio.getByteTimeDomainData", labelKey: "audioGetByteTimeDomainData" },
    { id: "audio.getChannelData", labelKey: "audioGetChannelData" },
  ],
  navigator: [
    { id: "navigator.webdriver", labelKey: "navigatorWebdriver" },
    { id: "navigator.hardwareConcurrency", labelKey: "navigatorHardwareConcurrency" },
    { id: "navigator.deviceMemory", labelKey: "navigatorDeviceMemory" },
    { id: "navigator.maxTouchPoints", labelKey: "navigatorMaxTouchPoints" },
    { id: "navigator.platform", labelKey: "navigatorPlatform" },
    { id: "navigator.userAgent", labelKey: "navigatorUserAgent" },
    { id: "navigator.vendor", labelKey: "navigatorVendor" },
    { id: "navigator.appVersion", labelKey: "navigatorAppVersion" },
  ],
  screen: [
    { id: "screen.width", labelKey: "screenWidth" },
    { id: "screen.height", labelKey: "screenHeight" },
    { id: "screen.availWidth", labelKey: "screenAvailWidth" },
    { id: "screen.availHeight", labelKey: "screenAvailHeight" },
    { id: "screen.colorDepth", labelKey: "screenColorDepth" },
    { id: "screen.pixelDepth", labelKey: "screenPixelDepth" },
    { id: "screen.devicePixelRatio", labelKey: "screenDevicePixelRatio" },
  ],
  clientHints: [
    { id: "clientHints.brands", labelKey: "clientHintsBrands" },
    { id: "clientHints.mobile", labelKey: "clientHintsMobile" },
    { id: "clientHints.platform", labelKey: "clientHintsPlatform" },
    { id: "clientHints.toJSON", labelKey: "clientHintsToJSON" },
    {
      id: "clientHints.getHighEntropyValues",
      labelKey: "clientHintsGetHighEntropyValues",
    },
  ],
  battery: [{ id: "battery.getBattery", labelKey: "batteryGetBattery" }],
  webRTC: [
    { id: "webRTC.constructor", labelKey: "webRTCConstructor" },
    { id: "webRTC.createOffer", labelKey: "webRTCCreateOffer" },
    { id: "webRTC.createAnswer", labelKey: "webRTCCreateAnswer" },
  ],
  worker: [
    {
      id: "worker.constructor",
      labelKey: "workerConstructor",
      runtimeTargets: ["main", "early"],
    },
  ],
  serviceWorker: [
    {
      id: "serviceWorker.register",
      labelKey: "serviceWorkerRegister",
      runtimeTargets: ["main", "early", "firefox"],
    },
  ],
  sharedWorker: [
    {
      id: "sharedWorker.constructor",
      labelKey: "sharedWorkerConstructor",
      runtimeTargets: ["main", "early", "firefox"],
    },
  ],
} as const satisfies Record<string, readonly MethodCatalogEntry[]>;

/**
 * Central catalog of spoofing surfaces used by settings, runtime diagnostics,
 * and XRay category reporting. Keep storage-facing keys stable.
 *
 * This is the source of truth for every user-visible protection surface.
 * Do not add ad-hoc surface cards, XRay categories, method labels, or rule
 * override rows without adding the surface here first. Surfaces with special
 * controls still belong in this catalog: for example, `sharedWorker` is a
 * Native/Spoof/Strict mode selector rather than a boolean switch, but it remains
 * a spoofing surface and must be discoverable through `SPOOFING_SURFACES`.
 *
 * `methods` is diagnostic metadata only: method IDs are counted by XRay but
 * must not be used as localized display text.
 */

export const SPOOFING_SURFACES = [
  {
    key: "geolocation",
    group: "location-locale",
    requiredCapabilities: [],
    xRayCategory: "geolocation",
    controlKind: "boolean",
    defaultEnabled: true,
    fingerprintToggle: false,
    enforcementKind: "javascript",
    labelKey: "geolocation",
    anchorKey: "geolocation",
    methods: SURFACE_METHODS.geolocation,
  },
  {
    key: "timeLocale",
    group: "location-locale",
    requiredCapabilities: [],
    xRayCategory: "timeLocale",
    controlKind: "boolean",
    defaultEnabled: true,
    fingerprintToggle: false,
    // Also confirmed via the Accept-Language DNR header (src/background/dnr.ts).
    enforcementKind: "hybrid",
    labelKey: "timeLocale",
    anchorKey: "timeLocale",
    methods: SURFACE_METHODS.timeLocale,
  },
  {
    key: "canvas",
    group: "rendering-media",
    requiredCapabilities: [],
    xRayCategory: "canvas",
    controlKind: "boolean",
    defaultEnabled: true,
    fingerprintToggle: true,
    enforcementKind: "javascript",
    labelKey: "canvas",
    anchorKey: "canvas",
    methods: SURFACE_METHODS.canvas,
  },
  {
    key: "webGL",
    group: "rendering-media",
    requiredCapabilities: [],
    xRayCategory: "webGL",
    controlKind: "boolean",
    defaultEnabled: true,
    fingerprintToggle: true,
    enforcementKind: "javascript",
    labelKey: "webGL",
    anchorKey: "webGL",
    methods: SURFACE_METHODS.webGL,
  },
  {
    key: "audio",
    group: "rendering-media",
    requiredCapabilities: [],
    xRayCategory: "audio",
    controlKind: "boolean",
    defaultEnabled: true,
    fingerprintToggle: true,
    enforcementKind: "javascript",
    labelKey: "audio",
    anchorKey: "audio",
    methods: SURFACE_METHODS.audio,
  },
  {
    key: "navigator",
    group: "browser-identity",
    requiredCapabilities: [],
    xRayCategory: "navigator",
    controlKind: "boolean",
    defaultEnabled: true,
    fingerprintToggle: true,
    // Also confirmed via the User-Agent DNR header (src/background/dnr.ts).
    enforcementKind: "hybrid",
    labelKey: "navigator",
    anchorKey: "navigator",
    methods: SURFACE_METHODS.navigator,
  },
  {
    key: "screen",
    group: "browser-identity",
    requiredCapabilities: [],
    xRayCategory: "screen",
    controlKind: "boolean",
    defaultEnabled: true,
    fingerprintToggle: true,
    enforcementKind: "javascript",
    labelKey: "screen",
    anchorKey: "screen",
    methods: SURFACE_METHODS.screen,
  },
  {
    key: "clientHints",
    group: "browser-identity",
    requiredCapabilities: ["client-hints"],
    xRayCategory: "clientHints",
    controlKind: "boolean",
    defaultEnabled: true,
    fingerprintToggle: true,
    // Also confirmed via the Sec-CH-UA* DNR headers (src/background/dnr.ts).
    enforcementKind: "hybrid",
    labelKey: "clientHints",
    anchorKey: "clientHints",
    methods: SURFACE_METHODS.clientHints,
  },
  {
    key: "battery",
    group: "browser-identity",
    requiredCapabilities: ["battery-status"],
    xRayCategory: "battery",
    controlKind: "boolean",
    defaultEnabled: true,
    fingerprintToggle: true,
    enforcementKind: "javascript",
    labelKey: "battery",
    anchorKey: "battery",
    methods: SURFACE_METHODS.battery,
  },
  {
    key: "webRTC",
    group: "rendering-media",
    requiredCapabilities: [],
    xRayCategory: "webRTC",
    controlKind: "boolean",
    defaultEnabled: true,
    fingerprintToggle: true,
    // Confirmed via the browser-privacy webRTCIPHandlingPolicy readback
    // (src/background/privacy.ts) — unlike the other hybrid surfaces above,
    // this has no descriptor-level SurfaceIntegrityRegistry anchor, so its
    // evidence.integrity is "not-applicable" rather than "intact"/"degraded".
    enforcementKind: "hybrid",
    labelKey: "webRTC",
    anchorKey: "webRTC",
    methods: SURFACE_METHODS.webRTC,
  },
  {
    // Dedicated Workers are always handled by the runtime while protection is
    // active. They are diagnostic state, not a persisted user preference.
    key: "worker",
    group: "workers",
    requiredCapabilities: [],
    xRayCategory: "worker",
    controlKind: "runtime",
    defaultEnabled: true,
    fingerprintToggle: false,
    enforcementKind: "javascript",
    labelKey: "worker",
    methods: SURFACE_METHODS.worker,
  },
  {
    // Service Worker blocking is a protection surface whose *mechanism* is
    // removal (block registration) rather than value spoofing — there is no
    // value to spoof. It is the only surface that is `defaultEnabled: false`
    // because blocking carries a real functionality cost (PWAs, offline, push).
    key: "serviceWorker",
    group: "workers",
    requiredCapabilities: [],
    xRayCategory: "serviceWorker",
    controlKind: "boolean",
    defaultEnabled: false,
    fingerprintToggle: false,
    enforcementKind: "javascript",
    labelKey: "serviceWorker",
    anchorKey: "serviceWorker",
    methods: SURFACE_METHODS.serviceWorker,
  },
  {
    // SharedWorker uses a mode selector instead of a boolean toggle because
    // spoofing can trade off browser-native worker identity/deduplication.
    key: "sharedWorker",
    group: "workers",
    requiredCapabilities: [],
    xRayCategory: "sharedWorker",
    controlKind: "mode",
    defaultEnabled: true,
    fingerprintToggle: false,
    enforcementKind: "javascript",
    labelKey: "sharedWorker",
    anchorKey: "sharedWorkerHandlingMode",
    methods: SURFACE_METHODS.sharedWorker,
  },
] as const;

/** One entry from `SPOOFING_SURFACES`, including settings and XRay metadata. */
export type SurfaceDefinition = (typeof SPOOFING_SURFACES)[number];
/** Stable storage/API key for a spoofing surface. */
export type SpoofingSurfaceKey = SurfaceDefinition["key"];
/** Stable presentation group owned by the central surface catalog. */
export type SpoofingSurfaceGroupKey = SurfaceDefinition["group"];
/** Catalog entries that expose a persisted global or per-rule control. */
export type ConfigurableSurface = Exclude<
  SurfaceDefinition,
  { controlKind: "runtime" }
>;
/** Storage/API keys for configurable surfaces only. */
export type ConfigurableSurfaceKey = ConfigurableSurface["key"];
/** Catalog entries represented by boolean settings/overrides. */
export type BooleanSurface = Extract<SurfaceDefinition, { controlKind: "boolean" }>;
/** Surface keys represented by boolean settings/overrides. */
export type BooleanSurfaceKey = BooleanSurface["key"];
/** Category key reported by Privacy Thing XRay for surface-level counters. */
export type XRaySurfaceCategory = SurfaceDefinition["xRayCategory"];
/** Catalog entry for surfaces backed by `fingerprint.spoofingToggles`. */
export type FingerprintSurface = Extract<
  SurfaceDefinition,
  { fingerprintToggle: true }
>;
/** Storage/API key for fingerprint-backed surfaces only. */
export type FingerprintSurfaceKey = FingerprintSurface["key"];
/** Diagnostic method definition nested under a spoofing surface. */
export type SurfaceMethodDefinition = SurfaceDefinition["methods"][number] & {
  /**
   * Parent spoofing surface key. This links method-level XRay counters
   * back to category-level `queryCounts`.
   */
  surfaceKey: SpoofingSurfaceKey;
  /**
   * Optional injection/runtime paths that can emit this method counter.
   * Method IDs stay stable even if this implementation hint changes.
   */
  runtimeTargets?: readonly MethodRuntimeTarget[];
};
/**
 * Stable protocol-facing method counter key reported by Privacy Thing XRay.
 *
 * Method IDs are diagnostic identifiers, not localized UI text.
 */
export type SpoofingSurfaceMethodId = SurfaceMethodDefinition["id"];
/**
 * Per-method XRay counts keyed by stable method ID.
 *
 * These counts complement category-level `queryCounts`; they do not replace it.
 */
export type SurfaceMethodQueryCounts = Partial<Record<SpoofingSurfaceMethodId, number>>;

export const SPOOFING_SURFACE_KEYS = SPOOFING_SURFACES.map(
  (surface) => surface.key,
) as readonly SpoofingSurfaceKey[];

export const SURFACE_GROUP_ORDER = [
  "location-locale",
  "browser-identity",
  "rendering-media",
  "workers",
] as const satisfies readonly SpoofingSurfaceGroupKey[];

export const isSurfaceSupported = (
  surface: SurfaceDefinition,
  target: SpoofingBrowserTarget,
): boolean => {
  const capabilities = new Set<SurfaceCapability>(BROWSER_CAPABILITIES[target]);
  return surface.requiredCapabilities.every((capability) =>
    capabilities.has(capability),
  );
};

export const CONFIGURABLE_SURFACES = SPOOFING_SURFACES.filter(
  (surface): surface is ConfigurableSurface => surface.controlKind !== "runtime",
);

export const BOOLEAN_SURFACE_KEYS = SPOOFING_SURFACES.filter(
  (surface): surface is BooleanSurface => surface.controlKind === "boolean",
).map((surface) => surface.key);

export const FINGERPRINT_SURFACES = SPOOFING_SURFACES.filter(
  (surface): surface is FingerprintSurface => surface.fingerprintToggle,
);

export const FINGERPRINT_SURFACE_KEYS = FINGERPRINT_SURFACES.map(
  (surface) => surface.key,
) as readonly FingerprintSurfaceKey[];

export const XRAY_SURFACE_CATEGORIES = SPOOFING_SURFACES.map(
  (surface) => surface.xRayCategory,
) as readonly XRaySurfaceCategory[];

/**
 * Flat method catalog with `surfaceKey` attached for quick validation and UI
 * grouping. This is derived from `SPOOFING_SURFACES`; do not maintain a second
 * hand-written method list.
 */
export const SPOOFING_SURFACE_METHODS = SPOOFING_SURFACES.flatMap((surface) =>
  surface.methods.map((method) => ({
    ...method,
    surfaceKey: surface.key,
  })),
) as readonly SurfaceMethodDefinition[];

/** All stable method IDs accepted by XRay diagnostics. */
export const SURFACE_METHOD_IDS = SPOOFING_SURFACE_METHODS.map(
  (method) => method.id,
) as readonly SpoofingSurfaceMethodId[];

export const getSurfaceDefinition = (key: SpoofingSurfaceKey): SurfaceDefinition =>
  SPOOFING_SURFACES.find((surface) => surface.key === key)!;

/** Returns method metadata for a stable XRay method ID. */
export const getSurfaceMethod = (
  id: SpoofingSurfaceMethodId,
): SurfaceMethodDefinition =>
  SPOOFING_SURFACE_METHODS.find((method) => method.id === id)!;

/** Type guard for untrusted method IDs received over diagnostic event payloads. */
export const isSurfaceMethodId = (value: string): value is SpoofingSurfaceMethodId =>
  SURFACE_METHOD_IDS.includes(value as SpoofingSurfaceMethodId);
