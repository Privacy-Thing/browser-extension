import { getTimeZoneOffsetMinutes } from "@privacy-brand/refract-core/time/timezone-offset";

import { serializeAcceptLanguage } from "@/shared/accept-language";
import type { RuntimeSnapshot } from "@/shared/types";

export type FirefoxMainHandoff = {
  protocol: 1;
  revision: number;
  state: FirefoxShimState;
};

export type FirefoxTimeLocaleState = {
  language: string;
  languages: readonly string[];
  formattingLanguage?: string;
  formattingLanguages?: readonly string[];
  timeZone: string;
  temporalApiEnabled?: boolean | undefined;
  offsetMinutes: number;
};

export type FirefoxFingerprintState = NonNullable<RuntimeSnapshot["fingerprint"]>;
export type FxSharedWorkerMode = NonNullable<
  RuntimeSnapshot["sharedWorkerHandlingMode"]
>;

export type FirefoxShimDebugState = {
  enabled: boolean;
  logEventName: string | null;
};

export type FirefoxBootstrapRevision = {
  revision: number;
};

export type FirefoxGeoState = {
  latitude: number;
  longitude: number;
  accuracy: number;
  noiseRadius?: number | undefined;
  watchPositionDelay?: [number, number] | undefined;
};

export type FirefoxShimState = {
  bootstrap: FirefoxBootstrapRevision;
  geolocationEnabled?: boolean | undefined;
  geoStatus: "ready" | "absent" | null;
  geo: FirefoxGeoState | null;
  timeLocaleStatus: "ready" | "absent" | null;
  timeLocale: FirefoxTimeLocaleState | null;
  fingerprintStatus: "ready" | "absent" | null;
  fingerprint: FirefoxFingerprintState | null;
  debug: FirefoxShimDebugState | null;
  sharedWorkerHandlingMode?: FxSharedWorkerMode | undefined;
  sharedWorkerCompatibilityMode?: boolean | undefined;
  blockServiceWorkerRegistration?: boolean | undefined;
  /** Opaque diagnostic registration nonce propagated from the active rule. */
  authKey?: string | undefined;
};

type SharedWorkerModeCarrier = {
  sharedWorkerHandlingMode?: FxSharedWorkerMode | undefined;
  sharedWorkerCompatibilityMode?: boolean | undefined;
};

const getTransportWorkerMode = (
  value: SharedWorkerModeCarrier,
): FxSharedWorkerMode | undefined => {
  if (value.sharedWorkerHandlingMode && value.sharedWorkerHandlingMode !== "native") {
    return value.sharedWorkerHandlingMode;
  }
  return value.sharedWorkerCompatibilityMode === false ? "spoof" : undefined;
};

export type FxBootstrapSource =
  "static" | "hash" | "windowName" | "userScript" | "ephemeral";

export type FxBootstrapRole = "authoritative-early-seed" | "late-convergence";
export type FxTransportStatus = "main" | "backup" | "late-closure";

export type FxBootstrapInfo = {
  source: FxBootstrapSource;
  role: FxBootstrapRole;
  status: FxTransportStatus;
  visibility: "visible" | "hidden";
  needsOptionalPermission: boolean;
};

const resolveNativeTimeLocale = (baseEpochMs: number): FirefoxTimeLocaleState => {
  const fallbackLanguage =
    typeof navigator?.language === "string" && navigator.language
      ? navigator.language
      : "en-US";
  const fallbackLanguages =
    Array.isArray(navigator?.languages) && navigator.languages.length > 0
      ? [...navigator.languages]
      : [fallbackLanguage];
  const fallbackTimeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  })();
  return {
    language: fallbackLanguage,
    languages: fallbackLanguages,
    formattingLanguage: fallbackLanguage,
    formattingLanguages: fallbackLanguages,
    timeZone: fallbackTimeZone,
    offsetMinutes: getTimeZoneOffsetMinutes(fallbackTimeZone, baseEpochMs),
  };
};

const buildTimeLocaleState = (
  snapshot: RuntimeSnapshot,
  ready: boolean,
): FirefoxTimeLocaleState | null => {
  if (!ready || !snapshot.locale || !snapshot.date) return null;
  return {
    language: snapshot.locale.language,
    languages: snapshot.locale.languages,
    formattingLanguage: snapshot.locale.formattingLanguage ?? snapshot.locale.language,
    formattingLanguages:
      snapshot.locale.formattingLanguages ?? snapshot.locale.languages,
    timeZone: snapshot.locale.timeZone,
    ...(snapshot.temporalApiEnabled === true ? { temporalApiEnabled: true } : {}),
    offsetMinutes: getTimeZoneOffsetMinutes(
      snapshot.locale.timeZone,
      snapshot.date.baseEpochMs,
    ),
  };
};

export const buildFirefoxShimState = (
  snapshot: RuntimeSnapshot | null,
  { revision = Date.now() }: { revision?: number } = {},
): FirefoxShimState => {
  if (!snapshot) {
    return {
      bootstrap: { revision },
      geoStatus: "absent",
      geo: null,
      timeLocaleStatus: "absent",
      timeLocale: null,
      fingerprintStatus: "absent",
      fingerprint: null,
      debug: null,
      blockServiceWorkerRegistration: false,
    };
  }
  const geoReady = snapshot.geolocationEnabled !== false && Boolean(snapshot.geo);
  const timeLocaleReady =
    snapshot.timeLocaleEnabled !== false &&
    Boolean(snapshot.locale) &&
    Boolean(snapshot.date);
  const geo =
    snapshot.geo && geoReady
      ? {
          latitude: snapshot.geo.latitude,
          longitude: snapshot.geo.longitude,
          accuracy: snapshot.geo.accuracy,
          noiseRadius: snapshot.geo.noiseRadius,
          watchPositionDelay: snapshot.watchPositionDelay,
        }
      : null;
  const sharedWorkerHandlingMode = getTransportWorkerMode(snapshot);
  return {
    bootstrap: { revision },
    ...(snapshot.geolocationEnabled === false ? { geolocationEnabled: false } : {}),
    geoStatus: geoReady ? "ready" : "absent",
    geo,
    timeLocaleStatus: timeLocaleReady ? "ready" : "absent",
    timeLocale: buildTimeLocaleState(snapshot, timeLocaleReady),
    fingerprintStatus: snapshot.fingerprint ? "ready" : "absent",
    fingerprint: snapshot.fingerprint ?? null,
    ...(sharedWorkerHandlingMode ? { sharedWorkerHandlingMode } : {}),
    ...(snapshot.sharedWorkerCompatibilityMode === false
      ? { sharedWorkerCompatibilityMode: false }
      : {}),
    debug:
      snapshot.debugMode || snapshot.logEventName
        ? {
            enabled: snapshot.debugMode,
            logEventName: snapshot.logEventName ?? null,
          }
        : null,
    blockServiceWorkerRegistration: snapshot.blockServiceWorkerRegistration ?? false,
    ...(snapshot.authKey ? { authKey: snapshot.authKey } : {}),
  };
};

export const isFxRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeFxRevision = (
  value: unknown,
  legacyRevision = 0,
): FirefoxBootstrapRevision | null => {
  if (value === undefined) return { revision: legacyRevision };
  if (
    !isFxRecord(value) ||
    typeof value.revision !== "number" ||
    !Number.isFinite(value.revision)
  ) {
    return null;
  }
  return { revision: value.revision };
};

export const isFirefoxGeoState = (value: unknown): value is FirefoxGeoState => {
  if (!isFxRecord(value)) return false;
  return (
    typeof value.latitude === "number" &&
    typeof value.longitude === "number" &&
    typeof value.accuracy === "number" &&
    (value.noiseRadius === undefined || typeof value.noiseRadius === "number") &&
    (value.watchPositionDelay === undefined ||
      (Array.isArray(value.watchPositionDelay) &&
        value.watchPositionDelay.length === 2 &&
        value.watchPositionDelay.every((entry) => typeof entry === "number")))
  );
};

export const isFirefoxTimeLocaleState = (
  value: unknown,
): value is FirefoxTimeLocaleState => {
  if (!isFxRecord(value)) return false;
  return (
    typeof value.language === "string" &&
    Array.isArray(value.languages) &&
    value.languages.every((entry) => typeof entry === "string") &&
    (value.formattingLanguage === undefined ||
      typeof value.formattingLanguage === "string") &&
    (value.formattingLanguages === undefined ||
      (Array.isArray(value.formattingLanguages) &&
        value.formattingLanguages.every((entry) => typeof entry === "string"))) &&
    typeof value.timeZone === "string" &&
    (value.temporalApiEnabled === undefined ||
      typeof value.temporalApiEnabled === "boolean") &&
    typeof value.offsetMinutes === "number" &&
    Number.isFinite(value.offsetMinutes)
  );
};

const isNullableReadyStatus = (value: unknown): value is "ready" | "absent" | null =>
  value === "ready" || value === "absent" || value === null;

const normalizeFxDebug = (value: unknown): FirefoxShimDebugState | null => {
  if (value === null) return null;
  if (
    !isFxRecord(value) ||
    typeof value.enabled !== "boolean" ||
    (value.logEventName !== null && typeof value.logEventName !== "string")
  ) {
    return null;
  }
  return { enabled: value.enabled, logEventName: value.logEventName as string | null };
};

const pickAuthKey = (source: { authKey?: unknown }): { authKey?: string } => {
  const { authKey } = source;
  return typeof authKey === "string" ? { authKey } : {};
};

type FirefoxShimSections = Pick<
  FirefoxShimState,
  | "geoStatus"
  | "geo"
  | "timeLocaleStatus"
  | "timeLocale"
  | "fingerprintStatus"
  | "fingerprint"
>;

const normalizeFxSections = (
  value: Record<string, unknown>,
): FirefoxShimSections | null => {
  const { geoStatus, geo, timeLocaleStatus, timeLocale } = value;
  const { fingerprintStatus, fingerprint } = value;
  if (!isNullableReadyStatus(geoStatus) || (geo !== null && !isFirefoxGeoState(geo))) {
    return null;
  }
  if (
    !isNullableReadyStatus(timeLocaleStatus) ||
    (timeLocale !== null && !isFirefoxTimeLocaleState(timeLocale))
  ) {
    return null;
  }
  if (
    !isNullableReadyStatus(fingerprintStatus) ||
    (fingerprint !== null && !isFxRecord(fingerprint))
  ) {
    return null;
  }
  return {
    geoStatus,
    geo,
    timeLocaleStatus,
    timeLocale,
    fingerprintStatus,
    fingerprint,
  };
};

const isOptionalBoolean = (value: unknown): value is boolean | undefined =>
  value === undefined || typeof value === "boolean";

const getRuntimeOffsetMs = (
  timeLocaleState: FirefoxTimeLocaleState | null,
  baseEpochMs: number,
): number => {
  if (timeLocaleState === null) return 0;
  const targetOffsetMinutes = getTimeZoneOffsetMinutes(
    timeLocaleState.timeZone,
    baseEpochMs,
  );
  const localOffsetMinutes = new Date(baseEpochMs).getTimezoneOffset();
  return (localOffsetMinutes - targetOffsetMinutes) * 60_000;
};

export const normalizeFxState = (
  value: unknown,
  { legacyRevision = 0 }: { legacyRevision?: number } = {},
): FirefoxShimState | null => {
  if (!isFxRecord(value)) return null;
  const debug = value.debug;
  const sharedWorkerHandlingMode = value.sharedWorkerHandlingMode;
  const workerCompat = value.sharedWorkerCompatibilityMode;
  const blockServiceWorkers = value.blockServiceWorkerRegistration;
  const bootstrap = normalizeFxRevision(value.bootstrap, legacyRevision);
  const sections = normalizeFxSections(value);
  if (!bootstrap || !sections) return null;
  const normalizedDebug = normalizeFxDebug(debug);
  if (debug !== null && normalizedDebug === null) return null;
  if (
    sharedWorkerHandlingMode !== undefined &&
    sharedWorkerHandlingMode !== "native" &&
    sharedWorkerHandlingMode !== "spoof" &&
    sharedWorkerHandlingMode !== "strict"
  ) {
    return null;
  }
  if (!isOptionalBoolean(workerCompat) || !isOptionalBoolean(blockServiceWorkers)) {
    return null;
  }
  let parsedWorkerMode: FxSharedWorkerMode | undefined;
  if (
    sharedWorkerHandlingMode === "native" ||
    sharedWorkerHandlingMode === "spoof" ||
    sharedWorkerHandlingMode === "strict"
  ) {
    parsedWorkerMode = sharedWorkerHandlingMode;
  }
  const normalizedWorkerMode = getTransportWorkerMode({
    sharedWorkerHandlingMode: parsedWorkerMode,
    ...(workerCompat === false ? { sharedWorkerCompatibilityMode: false } : {}),
  });
  return {
    bootstrap,
    ...sections,
    debug: normalizedDebug,
    ...(normalizedWorkerMode ? { sharedWorkerHandlingMode: normalizedWorkerMode } : {}),
    ...(workerCompat === false ? { sharedWorkerCompatibilityMode: false } : {}),
    blockServiceWorkerRegistration: blockServiceWorkers === true,
    ...pickAuthKey(value),
  };
};

export const toSnapshotFromFxState = (
  state: FirefoxShimState,
  { baseEpochMs = Date.now() }: { baseEpochMs?: number } = {},
): RuntimeSnapshot | null => {
  if (state.geoStatus === "ready" && !state.geo) return null;
  if (state.timeLocaleStatus === "ready" && !state.timeLocale) return null;
  const geolocationEnabled = state.geoStatus === "ready" && Boolean(state.geo);
  const timeLocaleEnabled =
    state.timeLocaleStatus === "ready" && Boolean(state.timeLocale);
  const geoState = state.geo ?? null;
  const timeLocaleState = state.timeLocale ?? null;
  const effectiveTimeLocaleState =
    timeLocaleState ?? resolveNativeTimeLocale(baseEpochMs);
  const sharedWorkerHandlingMode = getTransportWorkerMode(state);
  return {
    geo: {
      latitude: geoState?.latitude ?? 0,
      longitude: geoState?.longitude ?? 0,
      accuracy: geoState?.accuracy ?? 0,
      noiseRadius: geoState?.noiseRadius ?? 50,
    },
    locale: {
      language: effectiveTimeLocaleState.language,
      languages: effectiveTimeLocaleState.languages,
      timeZone: effectiveTimeLocaleState.timeZone,
      acceptLanguage: serializeAcceptLanguage(
        effectiveTimeLocaleState.languages,
        "firefox",
      ),
      formattingLanguage:
        effectiveTimeLocaleState.formattingLanguage ??
        effectiveTimeLocaleState.language,
      formattingLanguages:
        effectiveTimeLocaleState.formattingLanguages ??
        effectiveTimeLocaleState.languages,
    },
    date: {
      baseEpochMs,
      offsetMs: getRuntimeOffsetMs(timeLocaleState, baseEpochMs),
      timeZone: effectiveTimeLocaleState.timeZone,
    },
    debugMode: state.debug?.enabled ?? false,
    watchPositionDelay: geoState?.watchPositionDelay ?? [60, 500],
    ...(geolocationEnabled === false ? { geolocationEnabled: false } : {}),
    ...(timeLocaleEnabled === false ? { timeLocaleEnabled: false } : {}),
    ...(timeLocaleState?.temporalApiEnabled === true
      ? { temporalApiEnabled: true }
      : {}),
    ...(state.fingerprintStatus === "ready" && state.fingerprint
      ? { fingerprint: state.fingerprint }
      : {}),
    ...(state.debug?.logEventName ? { logEventName: state.debug.logEventName } : {}),
    ...(sharedWorkerHandlingMode ? { sharedWorkerHandlingMode } : {}),
    ...(state.sharedWorkerCompatibilityMode === false
      ? { sharedWorkerCompatibilityMode: false }
      : {}),
    blockServiceWorkerRegistration: state.blockServiceWorkerRegistration === true,
    ...pickAuthKey(state),
  };
};

export const isFirefoxShimState = (value: unknown): value is FirefoxShimState =>
  normalizeFxState(value) !== null;
