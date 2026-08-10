import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import {
  createDateMethodDescs,
  createDateMethods,
} from "@privacy-brand/refract-core/time/date-prototype-methods";
import { patchDateTimeInstance } from "@privacy-brand/refract-core/time/date-time-format-instance-patch";
import { patchIntlConstructor } from "@privacy-brand/refract-core/time/intl-constructor-patch";
import {
  createIntlDefaults,
  withDefaultTimeZone,
} from "@privacy-brand/refract-core/time/intl-defaults";
import { createResolvedTransform } from "@privacy-brand/refract-core/time/intl-resolved-options";
import {
  constructZonedDate,
  createNativeDateReaders,
  parseZonedDateValue,
} from "@privacy-brand/refract-core/time/zoned-date-semantics";

import type { WorkerRuntimeSupport } from "./worker-runtime-support";

import type { RuntimeSnapshot } from "@/shared/types";

const registerIntl = (key: keyof typeof Intl, support: WorkerRuntimeSupport): void => {
  const constructor = Intl[key] as unknown as { prototype?: object } | undefined;
  if (!constructor) return;
  support.register({
    target: Intl,
    key,
    surfaceId: "timeLocale",
    methodId: "intl.constructor",
  });
  if (constructor.prototype) {
    support.register({
      target: constructor.prototype,
      key: "resolvedOptions",
      surfaceId: "timeLocale",
      methodId: "intl.resolvedOptions",
    });
  }
};

const installWorkerIntl = (
  snapshot: RuntimeSnapshot,
  support: WorkerRuntimeSupport,
): void => {
  if (
    !globalThis.Intl?.DateTimeFormat ||
    snapshot.timeLocaleEnabled === false ||
    !snapshot.locale
  ) {
    return;
  }
  const formattingLanguage =
    snapshot.locale.formattingLanguage ?? snapshot.locale.language;
  const formattingLanguages =
    snapshot.locale.formattingLanguages ?? snapshot.locale.languages;
  const intlInstanceDefaults = new WeakMap<object, any>();
  const intlDefaults = createIntlDefaults(
    formattingLanguages,
    snapshot.locale.timeZone,
  );
  const resolvedOptionsTransform = createResolvedTransform({
    language: formattingLanguage,
    timeZone: snapshot.locale.timeZone,
  });

  patchIntlConstructor({
    intlObject: Intl,
    key: "DateTimeFormat",
    intlDefaults,
    intlInstanceDefaults,
    optionsTransform: (options: any) => withDefaultTimeZone(options, intlDefaults),
    resultTransform: resolvedOptionsTransform,
    maskAsNative,
    createNativeSource,
    hooks: {
      onConstructed: (_key: string, _details: any, instance: Intl.DateTimeFormat) => {
        const formatDescriptor = Object.getOwnPropertyDescriptor(
          Intl.DateTimeFormat.prototype,
          "format",
        );
        patchDateTimeInstance({
          instance,
          nativeFormat: formatDescriptor?.get?.call(instance),
          nativeFormatToParts: instance.formatToParts.bind(instance),
          nativeFormatRange: instance.formatRange?.bind(instance),
          nativeFormatRangeToParts: instance.formatRangeToParts?.bind(instance),
          normalizeValue: (value: any) => value,
          maskAsNative,
        });
      },
    },
  });
  registerIntl("DateTimeFormat", support);
  support.register({
    target: Intl.DateTimeFormat.prototype,
    key: "format",
    surfaceId: "timeLocale",
    methodId: "intl.DateTimeFormat.format",
  });

  for (const key of [
    "NumberFormat",
    "Collator",
    "RelativeTimeFormat",
    "ListFormat",
    "DisplayNames",
    "PluralRules",
    "Segmenter",
  ] as const) {
    patchIntlConstructor({
      intlObject: Intl,
      key,
      intlDefaults,
      intlInstanceDefaults,
      optionsTransform: (options: any) => options,
      resultTransform: resolvedOptionsTransform,
      maskAsNative,
      createNativeSource,
    });
    registerIntl(key, support);
  }
};

const registerDate = (
  PatchedDate: DateConstructor,
  descriptors: PropertyDescriptorMap,
  support: WorkerRuntimeSupport,
): void => {
  const dateReceiver = Object.create(Date.prototype) as object;
  const methodIds = {
    constructor: "date.constructor",
    getTimezoneOffset: "date.getTimezoneOffset",
    parse: "date.parse",
    toLocaleString: "date.toLocaleString",
    toString: "date.toString",
  } as const;
  support.register({
    target: globalThis,
    key: "Date",
    surfaceId: "timeLocale",
    methodId: "date.constructor",
  });
  support.register({
    target: PatchedDate,
    key: "parse",
    surfaceId: "timeLocale",
    methodId: "date.parse",
  });
  support.register({
    target: Date.prototype,
    key: "constructor",
    surfaceId: "timeLocale",
    methodId: "date.constructor",
    receiver: dateReceiver,
  });
  for (const key of Reflect.ownKeys(descriptors)) {
    const methodId =
      typeof key === "string" && Object.hasOwn(methodIds, key)
        ? methodIds[key as keyof typeof methodIds]
        : undefined;
    support.register({
      target: Date.prototype,
      key,
      surfaceId: "timeLocale",
      methodId,
      receiver: dateReceiver,
    });
  }
};

const installWorkerDate = (
  snapshot: RuntimeSnapshot,
  support: WorkerRuntimeSupport,
): void => {
  if (snapshot.timeLocaleEnabled === false || !snapshot.locale) return;
  const NativeDate = Date;
  const NativeDateTimeFormat = Intl.DateTimeFormat;
  const nativeGetTime = NativeDate.prototype.getTime;
  const nativeSetTime = NativeDate.prototype.setTime;
  const nativeGetTimezoneOffset = NativeDate.prototype.getTimezoneOffset;
  const nativeGetMilliseconds = NativeDate.prototype.getMilliseconds;
  const nativeDateReaders = createNativeDateReaders(NativeDate);
  const zonedDateOptions = {
    NativeDate,
    DateTimeFormat: NativeDateTimeFormat,
    timeZone: snapshot.locale.timeZone,
  } as const;
  const formattingLanguages =
    snapshot.locale.formattingLanguages ?? snapshot.locale.languages;
  const intlDefaults = createIntlDefaults(
    formattingLanguages,
    snapshot.locale.timeZone,
  );

  const PatchedDate: DateConstructor = maskAsNative(
    function SpoofedDate(this: Date, ...args: any[]) {
      if (new.target === undefined) {
        return new NativeDate(NativeDate.now()).toString();
      }
      const date = constructZonedDate(args, zonedDateOptions, nativeDateReaders);
      return new.target === PatchedDate
        ? date
        : Reflect.construct(NativeDate, [nativeGetTime.call(date)], new.target);
    } as unknown as DateConstructor,
    createNativeSource("Date"),
    7,
  );
  PatchedDate.now = maskAsNative(() => NativeDate.now(), createNativeSource("now"));
  PatchedDate.parse = maskAsNative(
    (value: string) => parseZonedDateValue(value, zonedDateOptions, nativeDateReaders),
    createNativeSource("parse"),
  );
  PatchedDate.UTC = maskAsNative(
    NativeDate.UTC.bind(NativeDate),
    createNativeSource("UTC"),
  );
  Object.defineProperty(PatchedDate, "prototype", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: NativeDate.prototype,
  });

  const methods = createDateMethods({
    NativeDate,
    DateTimeFormat: NativeDateTimeFormat,
    getTime: (date: Date) => nativeGetTime.call(date),
    setTime: (date: Date, epochMs: number) => nativeSetTime.call(date, epochMs),
    getNativeTimezoneOffset: (date: Date) => nativeGetTimezoneOffset.call(date),
    getMilliseconds: (date: Date) => nativeGetMilliseconds.call(date),
    localeTimeZone: snapshot.locale.timeZone,
    intlDefaults,
  });
  const descriptors = createDateMethodDescs(methods, maskAsNative, createNativeSource);
  Object.defineProperties(NativeDate.prototype, descriptors);
  globalThis.Date = PatchedDate;
  Object.defineProperty(NativeDate.prototype, "constructor", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: PatchedDate,
  });
  registerDate(PatchedDate, descriptors, support);
};

export const installWorkerTime = (
  snapshot: RuntimeSnapshot,
  support: WorkerRuntimeSupport,
): void => {
  if (snapshot.timeLocaleEnabled === false) return;
  installWorkerDate(snapshot, support);
  installWorkerIntl(snapshot, support);
};
