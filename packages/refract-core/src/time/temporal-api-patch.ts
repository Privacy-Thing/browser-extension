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
  privateSymbolFor,
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

type TemporalApiPatchState = {
  defaults: TemporalApiPatchOptions["defaults"] | null;
  onAccess: TemporalApiPatchOptions["onAccess"] | undefined;
  ownership: {
    commit: symbol;
    proofKey: string;
    verify: symbol;
  } | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isObjectLike = (value: unknown): value is object =>
  (typeof value === "object" && value !== null) || typeof value === "function";

const resolveDefaults = (state: TemporalApiPatchState): TemporalApiDefaults | null => {
  const defaults = state.defaults;
  return typeof defaults === "function" ? defaults() : defaults;
};

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
  state: TemporalApiPatchState;
};

const installMethod = ({
  target,
  key,
  methodId,
  createCall,
  state,
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
  const ownershipProof = state.ownership
    ? privateSymbolFor(`${state.ownership.proofKey}:${methodId}`)
    : null;
  const holder = {
    [key](this: unknown, ...args: unknown[]) {
      if (state.ownership) {
        if (this === state.ownership.verify) return ownershipProof;
        if (this === state.ownership.commit) {
          state.defaults = args[0] as TemporalApiDefaults | null;
          return ownershipProof;
        }
      }
      if (state.defaults !== null) state.onAccess?.(methodId);
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
  state: TemporalApiPatchState,
  anchors: TemporalApiAnchor[],
): void => {
  const now = temporal.Now;
  if (!isRecord(now)) return;

  const instantAnchor = installMethod({
    target: now,
    key: "instant",
    methodId: "temporal.Now.instant",
    createCall: (nativeMethod, args) => privateReflectApply(nativeMethod, now, args),
    state,
  });
  if (instantAnchor) anchors.push(instantAnchor);

  const timeZoneAnchor = installMethod({
    target: now,
    key: "timeZoneId",
    methodId: "temporal.Now.timeZoneId",
    createCall: (nativeMethod, args) => {
      const nativeResult = privateReflectApply(nativeMethod, now, args);
      return resolveDefaults(state)?.timeZone ?? nativeResult;
    },
    state,
  });
  if (timeZoneAnchor) anchors.push(timeZoneAnchor);

  for (const key of NOW_TIME_ZONE_METHODS) {
    const anchor = installMethod({
      target: now,
      key,
      methodId: `temporal.Now.${key}`,
      createCall: (nativeMethod, args) => {
        const defaults = resolveDefaults(state);
        return privateReflectApply(
          nativeMethod,
          now,
          defaults && (args.length === 0 || args[0] === undefined)
            ? [defaults.timeZone, ...args.slice(1)]
            : args,
        );
      },
      state,
    });
    if (anchor) anchors.push(anchor);
  }
};

const installLocaleMethods = (
  temporal: TemporalNamespaceLike,
  state: TemporalApiPatchState,
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
        const defaults = resolveDefaults(state);
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
      state,
    });
    if (anchor) anchors.push(anchor);
  }
};

const addAvailableAnchor = (
  anchors: TemporalApiAnchor[],
  target: object,
  key: string,
  methodId: TemporalApiMethodId,
): void => {
  if (typeof privateOwnDescriptor(target, key)?.value === "function") {
    anchors.push({ target, key, methodId });
  }
};

/** Returns the currently available Temporal method descriptors without wrapping them. */
export const getTemporalApiAnchors = (
  targetGlobal: TemporalApiGlobal,
): TemporalApiAnchor[] => {
  const temporalValue = (targetGlobal as { Temporal?: unknown }).Temporal;
  if (!isRecord(temporalValue)) return [];
  const temporal = temporalValue as TemporalNamespaceLike;
  const anchors: TemporalApiAnchor[] = [];
  const now = temporal.Now;
  if (isRecord(now)) {
    addAvailableAnchor(anchors, now, "instant", "temporal.Now.instant");
    addAvailableAnchor(anchors, now, "timeZoneId", "temporal.Now.timeZoneId");
    for (const key of NOW_TIME_ZONE_METHODS) {
      addAvailableAnchor(anchors, now, key, `temporal.Now.${key}`);
    }
  }
  for (const typeName of LOCALE_TYPES) {
    const constructor = temporal[typeName] as TemporalConstructorLike | undefined;
    if (!isRecord(constructor?.prototype)) continue;
    addAvailableAnchor(
      anchors,
      constructor.prototype,
      "toLocaleString",
      `temporal.${typeName}.toLocaleString`,
    );
  }
  return anchors;
};

type VerifiedTemporalAnchor = {
  anchor: TemporalApiAnchor;
  method: TemporalMethod;
  proof: symbol;
};

const verifyTemporalApiAnchors = (
  anchors: readonly TemporalApiAnchor[],
  ownershipKey: string,
  verify: symbol,
): { complete: boolean; verified: VerifiedTemporalAnchor[] } => {
  const verified: VerifiedTemporalAnchor[] = [];
  let complete = true;
  for (const anchor of anchors) {
    const method = privateOwnDescriptor(anchor.target, anchor.key)?.value;
    const proof = privateSymbolFor(`${ownershipKey}:${anchor.methodId}`);
    if (typeof method !== "function") {
      complete = false;
      continue;
    }
    try {
      if (
        privateReflectApply(method as TemporalMethod, verify, []) === proof &&
        privateOwnDescriptor(anchor.target, anchor.key)?.value === method
      ) {
        verified.push({ anchor, method: method as TemporalMethod, proof });
      } else {
        complete = false;
      }
    } catch {
      complete = false;
    }
  }
  return { complete, verified };
};

const commitTemporalDefaults = (
  verified: readonly VerifiedTemporalAnchor[],
  commit: symbol,
  defaults: TemporalApiDefaults | null,
): boolean => {
  for (const { method, proof } of verified) {
    try {
      if (privateReflectApply(method, commit, [defaults]) !== proof) return false;
    } catch {
      return false;
    }
  }
  return true;
};

const disableTemporalAnchors = (
  verified: readonly VerifiedTemporalAnchor[],
  commit: symbol,
): void => {
  for (const { method } of verified) {
    try {
      privateReflectApply(method, commit, [null]);
    } catch {
      // A conflicting page function must not prevent the remaining cleanup.
    }
  }
};

/**
 * Verifies every available wrapper installed by an earlier bundle before
 * updating its defaults. The handoff key belongs only to the two injected
 * bundles and is not reused by a page-visible marker or transport channel.
 */
export const adoptTemporalApiPatch = (
  targetGlobal: TemporalApiGlobal,
  defaults: TemporalApiDefaults | null,
  ownershipKey: string,
): TemporalApiAnchor[] => {
  const anchors = getTemporalApiAnchors(targetGlobal);
  if (anchors.length === 0) return [];
  const verify = privateSymbolFor(`${ownershipKey}:verify`);
  const commit = privateSymbolFor(`${ownershipKey}:commit`);
  const ownership = verifyTemporalApiAnchors(anchors, ownershipKey, verify);
  if (
    ownership.complete &&
    commitTemporalDefaults(ownership.verified, commit, defaults)
  ) {
    return anchors;
  }

  // A mixed set is not safe to adopt. Disable every wrapper that did prove
  // ownership so the full runtime can install one active reporting layer.
  disableTemporalAnchors(ownership.verified, commit);
  return [];
};

export const installTemporalApiPatch = (
  options: TemporalApiPatchOptions,
  ownershipKey?: string,
): TemporalApiAnchor[] => {
  const temporalValue = (options.targetGlobal as { Temporal?: unknown }).Temporal;
  if (!isRecord(temporalValue)) return [];
  const temporal = temporalValue as TemporalNamespaceLike;
  const existing = privateWeakMapGet(installations, temporal);
  if (existing) return existing;
  const state: TemporalApiPatchState = {
    defaults: options.defaults,
    onAccess: options.onAccess,
    ownership: ownershipKey
      ? {
          commit: privateSymbolFor(`${ownershipKey}:commit`),
          proofKey: ownershipKey,
          verify: privateSymbolFor(`${ownershipKey}:verify`),
        }
      : null,
  };
  const anchors: TemporalApiAnchor[] = [];
  installNowMethods(temporal, state, anchors);
  installLocaleMethods(temporal, state, anchors);
  if (anchors.length > 0) {
    privateWeakMapSet(installations, temporal, anchors);
  }
  return anchors;
};
