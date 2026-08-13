import { createNativeSource, maskAsNative } from "../native/native-mask";
import {
  createPrivateRecord,
  createPrivateWeakMap,
  privateDefineProperty,
  privateGetPrototype,
  privateOwnDescriptor,
  privateReflectApply,
  privateReflectGet,
  privateSetPrototype,
  privateWeakMapGet,
  privateWeakMapSet,
} from "../runtime/primordials";

import { cloneLocaleLanguages } from "./locale-getters";

export type TemporalApiMethodId =
  | "temporal.Now.instant"
  | "temporal.Now.timeZoneId"
  | "temporal.Now.plainDateTimeISO"
  | "temporal.Now.zonedDateTimeISO"
  | "temporal.Now.plainDateISO"
  | "temporal.Now.plainTimeISO"
  | "temporal.Duration.toLocaleString"
  | "temporal.Instant.toLocaleString"
  | "temporal.PlainDate.toLocaleString"
  | "temporal.PlainDateTime.toLocaleString"
  | "temporal.PlainMonthDay.toLocaleString"
  | "temporal.PlainTime.toLocaleString"
  | "temporal.PlainYearMonth.toLocaleString"
  | "temporal.ZonedDateTime.toLocaleString";

type TemporalMethod = (this: unknown, ...args: unknown[]) => unknown;
type TemporalConstructorLike = { prototype?: object };
type TemporalNamespaceLike = Record<string, unknown> & {
  Now?: Record<string, unknown>;
};

export type TemporalApiGlobal = object;

export type TemporalApiAnchor = {
  target: object;
  key: string;
  methodId: TemporalApiMethodId;
};

export type TemporalApiPatchOptions = {
  targetGlobal: TemporalApiGlobal;
  defaults: TemporalApiDefaults | (() => TemporalApiDefaults | null);
  onAccess?: (methodId: TemporalApiMethodId) => void;
};

export type TemporalApiDefaults = {
  languages: readonly string[];
  timeZone: string;
};

const NOW_TIME_ZONE_METHODS = [
  "plainDateTimeISO",
  "zonedDateTimeISO",
  "plainDateISO",
  "plainTimeISO",
] as const;

const LOCALE_TYPES = [
  "Duration",
  "Instant",
  "PlainDate",
  "PlainDateTime",
  "PlainMonthDay",
  "PlainTime",
  "PlainYearMonth",
  "ZonedDateTime",
] as const;

const DATE_TIME_OPTION_KEYS = [
  "localeMatcher",
  "calendar",
  "numberingSystem",
  "hour12",
  "hourCycle",
  "timeZone",
  "weekday",
  "era",
  "year",
  "month",
  "day",
  "dayPeriod",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "timeZoneName",
  "formatMatcher",
  "dateStyle",
  "timeStyle",
] as const;

const installations = createPrivateWeakMap<object, TemporalApiAnchor[]>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isObjectLike = (value: unknown): value is object =>
  (typeof value === "object" && value !== null) || typeof value === "function";

const resolveDefaults = (
  options: TemporalApiPatchOptions,
): TemporalApiDefaults | null =>
  typeof options.defaults === "function" ? options.defaults() : options.defaults;

const createZonedOptions = (options: unknown, timeZone: string): unknown => {
  if (options === undefined) return { timeZone };
  if (!isObjectLike(options)) return options;

  // Use a non-enumerating forwarding view over the fixed DateTimeFormat option
  // catalog. Native Temporal keeps deciding which properties to read and in
  // which order, while Reflect.get preserves the caller object's getter
  // receiver. Only timeZone receives a lazy default.
  const forwarded = createPrivateRecord<object>();
  for (const key of DATE_TIME_OPTION_KEYS) {
    privateDefineProperty(forwarded, key, {
      configurable: true,
      enumerable: false,
      get() {
        const value = privateReflectGet(options, key, options);
        return key === "timeZone" && value === undefined ? timeZone : value;
      },
    });
  }
  return forwarded;
};

type InstallMethodOptions = {
  target: object;
  key: string;
  methodId: TemporalApiMethodId;
  createCall: (
    nativeMethod: TemporalMethod,
    args: unknown[],
    receiver: unknown,
  ) => unknown;
  onAccess: TemporalApiPatchOptions["onAccess"];
};

const installMethod = ({
  target,
  key,
  methodId,
  createCall,
  onAccess,
}: InstallMethodOptions): TemporalApiAnchor | null => {
  const descriptor = privateOwnDescriptor(target, key);
  if (
    !descriptor ||
    descriptor.configurable !== true ||
    typeof descriptor.value !== "function"
  ) {
    return null;
  }

  const nativeMethod = descriptor.value as TemporalMethod;
  const holder = {
    [key](this: unknown, ...args: unknown[]) {
      onAccess?.(methodId);
      return createCall(nativeMethod, args, this);
    },
  };
  const wrapped = holder[key] as TemporalMethod;
  privateSetPrototype(wrapped, privateGetPrototype(nativeMethod));
  maskAsNative(
    wrapped,
    createNativeSource(nativeMethod.name || key),
    nativeMethod.length,
  );
  privateDefineProperty(target, key, { ...descriptor, value: wrapped });
  return { target, key, methodId };
};

const installNowMethods = (
  temporal: TemporalNamespaceLike,
  options: TemporalApiPatchOptions,
  anchors: TemporalApiAnchor[],
): void => {
  const now = temporal.Now;
  if (!isRecord(now)) return;

  const instantAnchor = installMethod({
    target: now,
    key: "instant",
    methodId: "temporal.Now.instant",
    createCall: (nativeMethod, args) => privateReflectApply(nativeMethod, now, args),
    onAccess: options.onAccess,
  });
  if (instantAnchor) anchors.push(instantAnchor);

  const timeZoneAnchor = installMethod({
    target: now,
    key: "timeZoneId",
    methodId: "temporal.Now.timeZoneId",
    createCall: (nativeMethod, args) => {
      const nativeResult = privateReflectApply(nativeMethod, now, args);
      return resolveDefaults(options)?.timeZone ?? nativeResult;
    },
    onAccess: options.onAccess,
  });
  if (timeZoneAnchor) anchors.push(timeZoneAnchor);

  for (const key of NOW_TIME_ZONE_METHODS) {
    const anchor = installMethod({
      target: now,
      key,
      methodId: `temporal.Now.${key}`,
      createCall: (nativeMethod, args) => {
        const defaults = resolveDefaults(options);
        return privateReflectApply(
          nativeMethod,
          now,
          defaults && (args.length === 0 || args[0] === undefined)
            ? [defaults.timeZone, ...args.slice(1)]
            : args,
        );
      },
      onAccess: options.onAccess,
    });
    if (anchor) anchors.push(anchor);
  }
};

const installLocaleMethods = (
  temporal: TemporalNamespaceLike,
  options: TemporalApiPatchOptions,
  anchors: TemporalApiAnchor[],
): void => {
  for (const typeName of LOCALE_TYPES) {
    const constructor = temporal[typeName] as TemporalConstructorLike | undefined;
    if (!isRecord(constructor?.prototype)) continue;
    const prototype = constructor.prototype;
    const methodId = `temporal.${typeName}.toLocaleString` as TemporalApiMethodId;
    const anchor = installMethod({
      target: prototype,
      key: "toLocaleString",
      methodId,
      createCall(nativeMethod, args, receiver) {
        const defaults = resolveDefaults(options);
        if (!defaults) return privateReflectApply(nativeMethod, receiver, args);
        const nextArgs = [...args];
        if (nextArgs.length === 0 || nextArgs[0] === undefined) {
          nextArgs[0] = cloneLocaleLanguages(defaults.languages);
        }
        if (typeName === "Instant") {
          nextArgs[1] = createZonedOptions(nextArgs[1], defaults.timeZone);
        }
        return privateReflectApply(nativeMethod, receiver, nextArgs);
      },
      onAccess: options.onAccess,
    });
    if (anchor) anchors.push(anchor);
  }
};

export const installTemporalApiPatch = (
  options: TemporalApiPatchOptions,
): TemporalApiAnchor[] => {
  const temporalValue = (options.targetGlobal as { Temporal?: unknown }).Temporal;
  if (!isRecord(temporalValue)) return [];
  const temporal = temporalValue as TemporalNamespaceLike;
  const existing = privateWeakMapGet(installations, temporal);
  if (existing) return existing;
  const anchors: TemporalApiAnchor[] = [];
  installNowMethods(temporal, options, anchors);
  installLocaleMethods(temporal, options, anchors);
  if (anchors.length > 0) {
    privateWeakMapSet(installations, temporal, anchors);
  }
  return anchors;
};
