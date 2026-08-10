import { createOnceLogger } from "@privacy-brand/refract-browser/common/debug-logger";
import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import {
  DATE_METHOD_KEYS,
  createDateMethodDescs,
  createDateMethods,
} from "@privacy-brand/refract-core/time/date-prototype-methods";
import { createIntlDefaults } from "@privacy-brand/refract-core/time/intl-defaults";
import { getNativeDate } from "@privacy-brand/refract-core/time/native-date";
import {
  constructZonedDate,
  createNativeDateReaders,
  parseZonedDateValue,
} from "@privacy-brand/refract-core/time/zoned-date-semantics";

import {
  registerDescriptor,
  type RuntimeIntegrityContext,
} from "@/injection/main/surface-integrity";
import { hasRuntimeLocationData } from "@/shared/runtime-snapshot";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

export { installIntlPatch } from "./intl-patch-installer";

const NativeDate = getNativeDate();
const NativeDateTimeFormat = Intl.DateTimeFormat;
const TIME_LOCALE_CATEGORY = "timeLocale";
const DATE_METHOD_IDS = {
  getTimezoneOffset: "date.getTimezoneOffset",
  now: "date.now",
  toLocaleString: "date.toLocaleString",
  toString: "date.toString",
} as const satisfies Record<string, SpoofingSurfaceMethodId>;

const getDatePrototypeMethodId = (
  method: string,
): SpoofingSurfaceMethodId | undefined =>
  Object.hasOwn(DATE_METHOD_IDS, method)
    ? DATE_METHOD_IDS[method as keyof typeof DATE_METHOD_IDS]
    : undefined;

const registerDateDescriptors = (
  integrity: RuntimeIntegrityContext | undefined,
  dateReceiver: Date,
): void => {
  registerDescriptor({
    integrity,
    target: globalThis,
    key: "Date",
    anchor: { surfaceId: "timeLocale", methodId: "date.constructor" },
  });
  registerDescriptor({
    integrity,
    target: NativeDate.prototype,
    key: "constructor",
    anchor: {
      surfaceId: "timeLocale",
      methodId: "date.constructor",
      receiver: dateReceiver,
    },
  });
  registerDescriptor({
    integrity,
    target: globalThis.Date,
    key: "parse",
    anchor: { surfaceId: "timeLocale", methodId: "date.parse" },
  });
  for (const key of DATE_METHOD_KEYS) {
    const methodId = getDatePrototypeMethodId(key);
    registerDescriptor({
      integrity,
      target: NativeDate.prototype,
      key,
      anchor: {
        surfaceId: "timeLocale",
        ...(methodId ? { methodId } : {}),
        receiver: dateReceiver,
      },
    });
  }
};

export const installDatePatch = (
  snapshot: RuntimeSnapshot,
  integrity?: RuntimeIntegrityContext,
): void => {
  if (!hasRuntimeLocationData(snapshot) || snapshot.timeLocaleEnabled === false) {
    return;
  }

  // X-Ray remains per call; expensive debug payloads are once per method.
  const baseLogger = createOnceLogger(snapshot, "Date");
  const logger: typeof baseLogger = (method, args, result) => {
    markSurfaceUsed(TIME_LOCALE_CATEGORY, getDatePrototypeMethodId(method));
    baseLogger(method, args, result, { consoleOutput: false });
  };
  const formattingLanguages =
    snapshot.locale.formattingLanguages ?? snapshot.locale.languages;
  const intlDefaults = createIntlDefaults(
    formattingLanguages,
    snapshot.locale.timeZone,
  );
  const zonedDateOptions = {
    NativeDate,
    DateTimeFormat: NativeDateTimeFormat,
    timeZone: snapshot.locale.timeZone,
  } as const;
  const nativeDateReaders = createNativeDateReaders(NativeDate);

  const PatchedDate = function (this: Date, ...args: unknown[]): string | Date {
    markSurfaceUsed(TIME_LOCALE_CATEGORY, "date.constructor");
    if (new.target === undefined) {
      return new NativeDate(NativeDate.now()).toString();
    }
    const date = constructZonedDate(args, zonedDateOptions, nativeDateReaders);
    return new.target === PatchedDate
      ? date
      : Reflect.construct(
          NativeDate,
          [NativeDate.prototype.getTime.call(date)],
          new.target,
        );
  } as unknown as DateConstructor;

  PatchedDate.now = maskAsNative(() => {
    const time = NativeDate.now();
    logger("now", [], time);
    return time;
  }, createNativeSource("now"));
  PatchedDate.parse = maskAsNative(
    ((value: string): number => {
      markSurfaceUsed(TIME_LOCALE_CATEGORY, "date.parse");
      return parseZonedDateValue(value, zonedDateOptions, nativeDateReaders);
    }) as DateConstructor["parse"],
    createNativeSource("parse"),
  );
  PatchedDate.UTC = maskAsNative(
    ((...args: number[]): number =>
      Reflect.apply(NativeDate.UTC, NativeDate, args)) as DateConstructor["UTC"],
    createNativeSource("UTC"),
    7,
  );
  Object.defineProperty(PatchedDate, "prototype", {
    configurable: false,
    enumerable: false,
    value: NativeDate.prototype,
    writable: false,
  });

  const originalGetTime = NativeDate.prototype.getTime;
  const originalSetTime = NativeDate.prototype.setTime;
  const nativeTimezoneOffset = NativeDate.prototype.getTimezoneOffset;
  const originalGetMilliseconds = NativeDate.prototype.getMilliseconds;
  const datePrototypeMethods = createDateMethods({
    NativeDate,
    DateTimeFormat: NativeDateTimeFormat,
    getTime: (date) => originalGetTime.call(date),
    setTime: (date, epochMs) => originalSetTime.call(date, epochMs),
    getNativeTimezoneOffset: (date) => nativeTimezoneOffset.call(date),
    getMilliseconds: (date) => originalGetMilliseconds.call(date),
    localeTimeZone: snapshot.locale.timeZone,
    intlDefaults,
    logger,
  });
  const datePrototypeDescriptors = createDateMethodDescs(
    datePrototypeMethods,
    maskAsNative,
    createNativeSource,
  );
  Object.defineProperties(NativeDate.prototype, datePrototypeDescriptors);

  globalThis.Date = maskAsNative(PatchedDate, createNativeSource("Date"), 7);
  Object.defineProperty(NativeDate.prototype, "constructor", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: globalThis.Date,
  });
  registerDateDescriptors(integrity, new NativeDate(0));
};
