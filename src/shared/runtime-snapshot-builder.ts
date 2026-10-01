import {
  detectLanguagePolicy,
  serializeAcceptLanguage,
} from "@/shared/accept-language";
import {
  createBrowserFingerprint,
  type BrowserFingerprintSource,
  detectBrowserFamily,
} from "@/shared/browser-fingerprint";
import {
  buildSimpleFpExtras,
  resolveGeoSurface,
  createNoiseSeed,
  resolveRuleToggles,
  resolveSwBlocking,
  resolveSharedWorkerMode,
  resolveTimeLocaleSurface,
  canSpoofDeviceMemory,
} from "@/shared/fingerprint-spoofing";
import {
  normalizeHardwareArch,
  normalizePlatformKey,
  type HardwareArch,
  type HardwarePlatformKey,
} from "@/shared/hardware-profiles";
import { getRuntimeLocale } from "@/shared/locale-catalog";
import { readRuleSeedKey } from "@/shared/rule-seed";
import { getTimeZoneOffsetMinutes } from "@/shared/time-zone-offset";
import {
  getProfileTimeZoneError,
  InvalidTimeZoneError,
} from "@/shared/time-zone-validation";
import type {
  BrowserFingerprint,
  SharedSpoofingConfig,
  SharedWorkerHandlingMode,
  SurfaceOverrides,
  Location,
  RuntimeSnapshot,
} from "@/shared/types";

/** Shared by the background resolver and the unfenced Settings playground. */
export type SnapshotBuildOptions = {
  browserFingerprintSource: BrowserFingerprintSource | undefined;
  fingerprintEnabled: boolean;
  debugMode: boolean;
  sharedSpoofing: SharedSpoofingConfig | undefined;
  sharedWorkerHandlingMode: SharedWorkerHandlingMode;
  watchPositionDelay: [number, number];
  temporalApiEnabled?: boolean;
};

export type SnapshotBuilderOptions = SnapshotBuildOptions & {
  authKey: string | undefined;
  profile: Location | null | undefined;
  ruleOverrides: SurfaceOverrides | undefined;
  ruleSeedKey: string | undefined;
};

const getNavigatorLanguages = ():
  (Navigator & { languages?: readonly string[] }) | undefined =>
  typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { languages?: readonly string[] });

const getNativeLanguages = (
  navigatorLanguageSource: ReturnType<typeof getNavigatorLanguages>,
): string[] => {
  if (navigatorLanguageSource?.languages?.length) {
    return [...navigatorLanguageSource.languages];
  }

  if (navigatorLanguageSource?.language) {
    return [navigatorLanguageSource.language];
  }

  return ["en-US"];
};

type NavigatorWithClientHints = Navigator & {
  deviceMemory?: number;
  userAgentData?: {
    brands?: readonly { brand: string; version: string }[];
    fullVersionList?: readonly { brand: string; version: string }[];
    mobile?: boolean;
    platform?: string;
  };
};

const getClientHintsNavigator = (): NavigatorWithClientHints | undefined =>
  typeof navigator === "undefined"
    ? undefined
    : (navigator as NavigatorWithClientHints);

const resolveNativeFingerprint = (
  browserFingerprintSource: BrowserFingerprintSource | undefined,
  navigatorWithClientHints: NavigatorWithClientHints | undefined,
): BrowserFingerprintSource | undefined => {
  if (browserFingerprintSource) {
    return browserFingerprintSource;
  }

  if (!navigatorWithClientHints) {
    return undefined;
  }

  return {
    userAgent: navigatorWithClientHints.userAgent,
    platform: navigatorWithClientHints.platform,
    vendor: navigatorWithClientHints.vendor,
    hardwareConcurrency: navigatorWithClientHints.hardwareConcurrency,
    ...(typeof navigatorWithClientHints.deviceMemory === "number"
      ? { deviceMemory: navigatorWithClientHints.deviceMemory }
      : {}),
    ...(navigatorWithClientHints.userAgentData
      ? { userAgentData: navigatorWithClientHints.userAgentData }
      : {}),
  };
};

const resolveRuntimeLocale = (
  profile: Location | null | undefined,
  nativeLanguage: string,
  nativeLanguages: readonly string[],
) =>
  profile
    ? getRuntimeLocale(profile)
    : {
        language: nativeLanguage,
        languages: nativeLanguages,
        formattingLanguage: nativeLanguage,
        formattingLanguages: nativeLanguages,
      };

type FingerprintExtOptions = {
  browserFamily: ReturnType<typeof detectBrowserFamily>;
  fingerprintEnabled: boolean;
  fingerprint: BrowserFingerprint | undefined;
  fingerprintSeedKey: string | null | undefined;
  hostArch: HardwareArch;
  hostPlatformKey: HardwarePlatformKey | undefined;
  nativeDeviceMemory: number | undefined;
  ruleOverrides: SurfaceOverrides | undefined;
  sharedSpoofing: SharedSpoofingConfig | undefined;
};

const extendFingerprint = ({
  browserFamily,
  fingerprintEnabled,
  fingerprint,
  fingerprintSeedKey,
  hostArch,
  hostPlatformKey,
  nativeDeviceMemory,
  ruleOverrides,
  sharedSpoofing,
}: FingerprintExtOptions): BrowserFingerprint | undefined => {
  if (!fingerprintEnabled || !fingerprintSeedKey) {
    return fingerprint;
  }

  const noiseSeed = createNoiseSeed({
    ruleSeedKey: fingerprintSeedKey,
  });
  const spoofingToggles = resolveRuleToggles(sharedSpoofing, ruleOverrides);
  const extras = buildSimpleFpExtras({
    baseSeed: noiseSeed,
    browserFamily,
    supportsDeviceMemory:
      typeof nativeDeviceMemory === "number" && canSpoofDeviceMemory(browserFamily),
    ...(hostPlatformKey ? { hostPlatformKey } : {}),
    hostArch,
  });
  const extendedFingerprint: BrowserFingerprint = {
    ...(fingerprint ?? {}),
    ...extras,
    spoofingToggles,
  };

  if (
    !extendedFingerprint.clientHints ||
    typeof extendedFingerprint.deviceMemory !== "number"
  ) {
    return extendedFingerprint;
  }

  return {
    ...extendedFingerprint,
    clientHints: {
      ...extendedFingerprint.clientHints,
      deviceMemory: extendedFingerprint.deviceMemory,
    },
  };
};

/**
 * Converts a saved location profile into the synchronous runtime payload used
 * by page-world patches and worker bootstraps.
 */
/**
 * Reads everything the snapshot needs about the *host* browser, before any
 * spoofing is applied. Split out of {@link buildRuntimeSnapshot} to keep that
 * function inside its length budget; it holds no resolution logic.
 */
const resolveNativeEnvironment = (
  browserFingerprintSource: BrowserFingerprintSource | undefined,
) => {
  const nativeLanguages = getNativeLanguages(getNavigatorLanguages());
  const nativeFingerprint = resolveNativeFingerprint(
    browserFingerprintSource,
    getClientHintsNavigator(),
  );

  return {
    acceptLanguagePolicy: detectLanguagePolicy(nativeFingerprint),
    browserFamily: detectBrowserFamily(nativeFingerprint?.userAgent),
    nativeFingerprint,
    nativeLanguage: nativeLanguages[0] ?? "en-US",
    nativeLanguages,
    nativeTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
};

type SurfaceGateOptions = Pick<
  SnapshotBuilderOptions,
  | "fingerprintEnabled"
  | "profile"
  | "ruleOverrides"
  | "sharedSpoofing"
  | "sharedWorkerHandlingMode"
>;

const resolveSurfaceGates = ({
  fingerprintEnabled,
  profile,
  ruleOverrides,
  sharedSpoofing,
  sharedWorkerHandlingMode,
}: SurfaceGateOptions) => {
  // Preserve individual settings for a later re-enable while the global
  // protection switch gates every page-visible surface.
  if (!fingerprintEnabled) {
    return {
      blockServiceWorkers: false,
      geoEnabled: false,
      workerMode: "native" as const,
      timeLocaleEnabled: false,
    };
  }

  return {
    blockServiceWorkers: resolveSwBlocking(sharedSpoofing, ruleOverrides),
    geoEnabled: profile ? resolveGeoSurface(sharedSpoofing, ruleOverrides) : false,
    workerMode: resolveSharedWorkerMode(
      sharedSpoofing,
      ruleOverrides,
      sharedWorkerHandlingMode,
    ),
    timeLocaleEnabled: profile
      ? resolveTimeLocaleSurface(sharedSpoofing, ruleOverrides)
      : false,
  };
};

export const buildRuntimeSnapshot = ({
  authKey,
  browserFingerprintSource,
  fingerprintEnabled,
  debugMode,
  profile,
  ruleOverrides,
  ruleSeedKey,
  sharedSpoofing,
  sharedWorkerHandlingMode,
  temporalApiEnabled,
  watchPositionDelay,
}: SnapshotBuilderOptions): RuntimeSnapshot => {
  if (profile) {
    const error = getProfileTimeZoneError(profile);
    if (error) throw new InvalidTimeZoneError(error);
  }
  const baseEpochMs = Date.now();
  const {
    acceptLanguagePolicy,
    browserFamily,
    nativeFingerprint,
    nativeLanguage,
    nativeLanguages,
    nativeTimeZone,
  } = resolveNativeEnvironment(browserFingerprintSource);
  const fingerprintSeedKey = readRuleSeedKey(ruleSeedKey);
  const fingerprint = createBrowserFingerprint(
    {
      userAgent: nativeFingerprint?.userAgent,
      platform: nativeFingerprint?.platform,
      vendor: nativeFingerprint?.vendor,
      hardwareConcurrency: nativeFingerprint?.hardwareConcurrency,
      deviceMemory: canSpoofDeviceMemory(browserFamily)
        ? nativeFingerprint?.deviceMemory
        : undefined,
      userAgentData: nativeFingerprint?.userAgentData,
    },
    fingerprintEnabled,
    {
      rotateChromiumVersion: sharedSpoofing?.clientHintsVersionRotation !== false,
      ...(fingerprintSeedKey ? { versionSeedKey: fingerprintSeedKey } : {}),
    },
  );

  const runtimeLocale = resolveRuntimeLocale(profile, nativeLanguage, nativeLanguages);
  const effectiveTimeZone = profile?.timeZone.trim() ?? nativeTimeZone;
  const acceptLanguage = serializeAcceptLanguage(
    runtimeLocale.languages,
    acceptLanguagePolicy,
  );
  const { blockServiceWorkers, geoEnabled, workerMode, timeLocaleEnabled } =
    resolveSurfaceGates({
      fingerprintEnabled,
      profile,
      ruleOverrides,
      sharedSpoofing,
      sharedWorkerHandlingMode,
    });
  const hostPlatformKey = normalizePlatformKey(
    nativeFingerprint?.userAgentData?.platform ?? nativeFingerprint?.platform,
  );
  const hostArch = normalizeHardwareArch(nativeFingerprint?.architecture);
  const extendedFingerprint = extendFingerprint({
    browserFamily,
    fingerprintEnabled,
    fingerprint,
    fingerprintSeedKey,
    hostArch,
    hostPlatformKey,
    nativeDeviceMemory: nativeFingerprint?.deviceMemory,
    ruleOverrides,
    sharedSpoofing,
  });

  return {
    debugMode,
    watchPositionDelay,
    sharedWorkerHandlingMode: workerMode,
    ...(workerMode === "native" ? {} : { sharedWorkerCompatibilityMode: false }),
    ...(geoEnabled ? {} : { geolocationEnabled: false }),
    ...(timeLocaleEnabled ? {} : { timeLocaleEnabled: false }),
    ...(timeLocaleEnabled && temporalApiEnabled ? { temporalApiEnabled: true } : {}),
    ...(blockServiceWorkers ? { blockServiceWorkerRegistration: true } : {}),
    geo: {
      latitude: profile?.latitude ?? 0,
      longitude: profile?.longitude ?? 0,
      accuracy: profile?.accuracy ?? 0,
      noiseRadius: profile?.noiseRadius ?? 50,
    },
    locale: {
      language: runtimeLocale.language,
      languages: runtimeLocale.languages,
      timeZone: effectiveTimeZone,
      acceptLanguage,
      formattingLanguage: runtimeLocale.formattingLanguage ?? runtimeLocale.language,
      formattingLanguages: runtimeLocale.formattingLanguages ?? runtimeLocale.languages,
    },
    date: {
      baseEpochMs,
      offsetMs:
        (new Date(baseEpochMs).getTimezoneOffset() -
          getTimeZoneOffsetMinutes(effectiveTimeZone, baseEpochMs)) *
        60_000,
      timeZone: effectiveTimeZone,
    },
    ...(extendedFingerprint ? { fingerprint: extendedFingerprint } : {}),
    ...(authKey ? { authKey } : {}),
  };
};
