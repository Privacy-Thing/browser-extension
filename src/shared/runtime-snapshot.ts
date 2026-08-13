import { privateArrayIsArray } from "@privacy-brand/refract-core/runtime/primordials";

import { isSharedWorkerMode } from "@/shared/fingerprint-types";
import type { RuntimeSnapshot } from "@/shared/types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] => {
  if (!privateArrayIsArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (typeof value[index] !== "string") return false;
  }
  return true;
};

const isRuntimeGeo = (value: unknown): value is RuntimeSnapshot["geo"] =>
  isRecord(value) &&
  isFiniteNumber(value.latitude) &&
  isFiniteNumber(value.longitude) &&
  isFiniteNumber(value.accuracy) &&
  isFiniteNumber(value.noiseRadius);

const isRuntimeLocale = (value: unknown): value is RuntimeSnapshot["locale"] =>
  isRecord(value) &&
  typeof value.language === "string" &&
  isStringArray(value.languages) &&
  typeof value.timeZone === "string" &&
  typeof value.acceptLanguage === "string" &&
  (value.formattingLanguage === undefined ||
    typeof value.formattingLanguage === "string") &&
  (value.formattingLanguages === undefined || isStringArray(value.formattingLanguages));

const isRuntimeDate = (value: unknown): value is RuntimeSnapshot["date"] =>
  isRecord(value) &&
  isFiniteNumber(value.baseEpochMs) &&
  isFiniteNumber(value.offsetMs) &&
  typeof value.timeZone === "string";

export const hasRuntimeLocationData = (
  snapshot: RuntimeSnapshot,
): snapshot is RuntimeSnapshot &
  Required<Pick<RuntimeSnapshot, "geo" | "locale" | "date">> =>
  isRuntimeGeo(snapshot.geo) &&
  isRuntimeLocale(snapshot.locale) &&
  isRuntimeDate(snapshot.date);

const hasActiveSurface = (snapshot: RuntimeSnapshot): boolean => {
  const toggles = snapshot.fingerprint?.spoofingToggles;
  if (!toggles) {
    return Boolean(snapshot.fingerprint);
  }

  // Keep this bootstrap predicate independent of the diagnostic surface catalog:
  // importing that metadata adds several KB to every injected entrypoint.
  return (
    toggles.canvas !== false ||
    toggles.webGL !== false ||
    toggles.audio !== false ||
    toggles.navigator !== false ||
    toggles.screen !== false ||
    toggles.clientHints !== false ||
    toggles.webRTC !== false
  );
};

export const hasRuntimePayload = (snapshot: RuntimeSnapshot): boolean =>
  hasActiveSurface(snapshot) ||
  snapshot.blockServiceWorkerRegistration === true ||
  snapshot.geolocationEnabled !== false ||
  snapshot.timeLocaleEnabled !== false ||
  (snapshot.sharedWorkerHandlingMode !== undefined &&
    snapshot.sharedWorkerHandlingMode !== "native");

export const isRuntimeSnapshot = (value: unknown): value is RuntimeSnapshot => {
  if (!isRecord(value)) {
    return false;
  }

  const { geo, locale, date, watchPositionDelay } = value;
  return (
    isRuntimeGeo(geo) &&
    isRuntimeLocale(locale) &&
    isRuntimeDate(date) &&
    typeof value.debugMode === "boolean" &&
    privateArrayIsArray(watchPositionDelay) &&
    watchPositionDelay.length === 2 &&
    isFiniteNumber(watchPositionDelay[0]) &&
    isFiniteNumber(watchPositionDelay[1]) &&
    (value.sharedWorkerHandlingMode === undefined ||
      isSharedWorkerMode(value.sharedWorkerHandlingMode)) &&
    (value.sharedWorkerCompatibilityMode === undefined ||
      typeof value.sharedWorkerCompatibilityMode === "boolean") &&
    (value.geolocationEnabled === undefined ||
      typeof value.geolocationEnabled === "boolean") &&
    (value.timeLocaleEnabled === undefined ||
      typeof value.timeLocaleEnabled === "boolean") &&
    (value.temporalApiEnabled === undefined ||
      typeof value.temporalApiEnabled === "boolean") &&
    (value.fingerprint === undefined || isRecord(value.fingerprint)) &&
    (value.logEventName === undefined || typeof value.logEventName === "string") &&
    (value.blockServiceWorkerRegistration === undefined ||
      typeof value.blockServiceWorkerRegistration === "boolean")
  );
};
