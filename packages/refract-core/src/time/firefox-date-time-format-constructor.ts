import {
  finalizePatchedCtor,
  maskOwnGetter,
  maskOwnMethod,
  type NativeMasker,
  type NativeSourceFactory,
} from "../native/constructor-wiring";

import {
  createFxDateTimeRuntime,
  type ResolveFxDateTimeArgs,
} from "./firefox-date-time-format-runtime";

type FxDateTimeCtorOptions = {
  NativeIntlDateTimeFormat: typeof Intl.DateTimeFormat;
  resolveDateTimeArgs: ResolveFxDateTimeArgs;
  maskAsNative: NativeMasker;
  createNativeSource: NativeSourceFactory;
};

export const createFxDateTimeFormat = ({
  NativeIntlDateTimeFormat,
  resolveDateTimeArgs,
  maskAsNative,
  createNativeSource,
}: FxDateTimeCtorOptions): typeof Intl.DateTimeFormat => {
  const nativeDateTimeFormat = Object.getOwnPropertyDescriptor(
    NativeIntlDateTimeFormat.prototype,
    "format",
  );
  const dateTimeFormatRuntime = createFxDateTimeRuntime({
    NativeIntlDateTimeFormat,
    nativeFormatGetter: nativeDateTimeFormat?.get,
    resolveDateTimeArgs,
  });

  class SpoofedDateTimeFormat extends NativeIntlDateTimeFormat {
    constructor(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
      super(locales, options);
      dateTimeFormatRuntime.trackInstance(this, locales, options);
    }

    override resolvedOptions(): Intl.ResolvedDateTimeFormatOptions {
      return dateTimeFormatRuntime.resolvedOptions(this);
    }

    override formatToParts(date?: Date | number): Intl.DateTimeFormatPart[] {
      return dateTimeFormatRuntime.formatToParts(this, date);
    }

    override formatRange(startDate: Date | number, endDate: Date | number): string {
      return dateTimeFormatRuntime.formatRange(this, startDate, endDate);
    }

    override formatRangeToParts(
      startDate: Date | number,
      endDate: Date | number,
    ): Intl.DateTimeRangeFormatPart[] {
      return dateTimeFormatRuntime.formatRangeToParts(this, startDate, endDate);
    }
  }

  Object.defineProperty(SpoofedDateTimeFormat.prototype, "format", {
    configurable: true,
    get(this: SpoofedDateTimeFormat): Intl.DateTimeFormat["format"] {
      return dateTimeFormatRuntime.getFormat(this);
    },
  });

  for (const name of [
    "resolvedOptions",
    "formatToParts",
    "formatRange",
    "formatRangeToParts",
  ] as const) {
    maskOwnMethod(SpoofedDateTimeFormat.prototype, name, name, {
      maskAsNative,
      createNativeSource,
    });
  }
  maskOwnGetter(SpoofedDateTimeFormat.prototype, "format", "format", {
    maskAsNative,
    createNativeSource,
  });

  const patchedDateTimeFormat = maskAsNative(
    function DateTimeFormat(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ): Intl.DateTimeFormat {
      return Reflect.construct(
        SpoofedDateTimeFormat,
        [locales, options],
        new.target ?? SpoofedDateTimeFormat,
      ) as Intl.DateTimeFormat;
    } as typeof Intl.DateTimeFormat,
    createNativeSource("DateTimeFormat"),
    0,
  );

  finalizePatchedCtor({
    patchedConstructor: patchedDateTimeFormat,
    patchedPrototype: SpoofedDateTimeFormat.prototype,
    nativeConstructor: NativeIntlDateTimeFormat,
    excludedPrototypeKeys: ["format"],
  });

  return patchedDateTimeFormat;
};
