import type { RuntimeSnapshot } from "../types/snapshot";

import {
  createPrivateArray,
  createPrivateRecord,
  privateArrayIsArray,
  privateIsSafeInteger,
  privateDefineProperty,
  privateObjectFreeze,
  privateOwnDescriptor,
} from "./primordials";

const canonicalFields = [
  "geo",
  "latitude",
  "longitude",
  "accuracy",
  "noiseRadius",
  "locale",
  "language",
  "languages",
  "timeZone",
  "acceptLanguage",
  "formattingLanguage",
  "formattingLanguages",
  "date",
  "baseEpochMs",
  "offsetMs",
  "debugMode",
  "watchPositionDelay",
  "sharedWorkerHandlingMode",
  "sharedWorkerCompatibilityMode",
  "geolocationEnabled",
  "timeLocaleEnabled",
  "fingerprint",
  "hardwareConcurrency",
  "deviceMemory",
  "maxTouchPoints",
  "platform",
  "userAgent",
  "vendor",
  "appVersion",
  "clientHints",
  "brands",
  "fullVersionList",
  "brand",
  "version",
  "platformVersion",
  "mobile",
  "architecture",
  "bitness",
  "model",
  "formFactors",
  "wow64",
  "canvasNoiseSeed",
  "webGL",
  "renderer",
  "suppressDebugInfo",
  "readPixelsNoiseSeed",
  "audioNoiseSeed",
  "screen",
  "width",
  "height",
  "availWidth",
  "availHeight",
  "colorDepth",
  "pixelDepth",
  "devicePixelRatio",
  "spoofingToggles",
  "canvas",
  "audio",
  "navigator",
  "battery",
  "webRTC",
  "logEventName",
  "blockServiceWorkerRegistration",
  "authKey",
] as const;

const readArrayLength = (input: readonly unknown[]): number => {
  const descriptor = privateOwnDescriptor(input, "length");
  const length = descriptor?.value;
  if (typeof length !== "number" || !privateIsSafeInteger(length)) {
    throw new TypeError("Runtime snapshot array has an invalid length");
  }
  return length;
};

const cloneArray = (input: readonly unknown[]): readonly unknown[] => {
  const length = readArrayLength(input);
  const clone = createPrivateArray<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = privateOwnDescriptor(input, index);
    if (!descriptor) continue;
    if (!("value" in descriptor)) {
      throw new TypeError(`Runtime snapshot array index ${index} must be data-only`);
    }
    privateDefineProperty(clone, index, {
      configurable: false,
      enumerable: true,
      writable: false,
      value: cloneValue(descriptor.value),
    });
  }
  return privateObjectFreeze(clone);
};

const cloneRecord = (input: object): object => {
  const clone = createPrivateRecord<Record<string, unknown>>();
  for (let index = 0; index < canonicalFields.length; index += 1) {
    const property = canonicalFields[index];
    if (!property) continue;
    const descriptor = privateOwnDescriptor(input, property);
    if (!descriptor) continue;
    if (!("value" in descriptor)) {
      throw new TypeError(`Runtime snapshot property ${property} must be data-only`);
    }
    privateDefineProperty(clone, property, {
      configurable: false,
      enumerable: true,
      writable: false,
      value: cloneValue(descriptor.value),
    });
  }
  return privateObjectFreeze(clone);
};

const cloneValue = (input: unknown): unknown => {
  if (privateArrayIsArray(input)) return cloneArray(input);
  return typeof input === "object" && input !== null ? cloneRecord(input) : input;
};

/** Copies canonical own data fields without invoking page-controlled accessors. */
export const cloneRuntimeSnapshot = (snapshot: RuntimeSnapshot): RuntimeSnapshot =>
  cloneRecord(snapshot) as RuntimeSnapshot;
