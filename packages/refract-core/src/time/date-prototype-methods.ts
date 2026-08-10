import {
  formatOffset,
  getDateLocaleTokens,
  getDateParts,
  getTimezoneName,
  type DateLocaleParts,
} from "./date-locale-helpers";
import { buildDateStringFormatter } from "./date-string-builders";
import type { IntlDefaults } from "./intl-defaults";
import { getTimeZoneOffsetMinutes } from "./timezone-offset";
import {
  createZonedSetters,
  type ZonedDateSetterMethods,
} from "./zoned-date-semantics";

export type DateMethodLogger = (
  method: string,
  args: unknown[],
  result?: unknown,
) => void;

type DateMethodOptions = {
  NativeDate: typeof Date;
  DateTimeFormat: typeof Intl.DateTimeFormat;
  getTime: (date: Date) => number;
  setTime: (date: Date, epochMs: number) => number;
  getNativeTimezoneOffset: (date: Date) => number;
  getMilliseconds: (date: Date) => number;
  localeTimeZone: string;
  intlDefaults: IntlDefaults;
  logger?: DateMethodLogger;
};

export type DatePrototypeMethods = ZonedDateSetterMethods & {
  getTimezoneOffset(this: Date): number;
  toString(this: Date): string;
  toDateString(this: Date): string;
  toTimeString(this: Date): string;
  toLocaleString(
    this: Date,
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ): string;
  toLocaleDateString(
    this: Date,
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ): string;
  toLocaleTimeString(
    this: Date,
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ): string;
  getFullYear(this: Date): number;
  getYear(this: Date): number;
  getMonth(this: Date): number;
  getDate(this: Date): number;
  getDay(this: Date): number;
  getHours(this: Date): number;
  getMinutes(this: Date): number;
  getSeconds(this: Date): number;
  getMilliseconds(this: Date): number;
};

type MaskAsNative = <TFunction extends Function>(
  fn: TFunction,
  source?: string,
  length?: number,
) => TFunction;

export const DATE_METHOD_KEYS = [
  "getTimezoneOffset",
  "toString",
  "toDateString",
  "toTimeString",
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
  "getFullYear",
  "getYear",
  "getMonth",
  "getDate",
  "getDay",
  "getHours",
  "getMinutes",
  "getSeconds",
  "getMilliseconds",
  "setFullYear",
  "setMonth",
  "setDate",
  "setHours",
  "setMinutes",
  "setSeconds",
  "setMilliseconds",
  "setYear",
] as const satisfies readonly (keyof DatePrototypeMethods)[];

const TIME_STRING_DEFAULTS = {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
} as const;

const DATE_STRING_DEFAULTS = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
} as const;

const DATE_LOCALE_DEFAULTS = {
  ...DATE_STRING_DEFAULTS,
  ...TIME_STRING_DEFAULTS,
} as const;

type DateStringContext = {
  DateTimeFormat: typeof Intl.DateTimeFormat;
  getTime: (date: Date) => number;
  getNativeTimezoneOffset: (date: Date) => number;
  localeTimeZone: string;
  intlDefaults: IntlDefaults;
  isInvalidDate: (date: Date) => boolean;
  log: DateMethodLogger;
};

type DateStringMethods = Pick<
  DatePrototypeMethods,
  | "getTimezoneOffset"
  | "toString"
  | "toDateString"
  | "toTimeString"
  | "toLocaleString"
  | "toLocaleDateString"
  | "toLocaleTimeString"
>;

const createDateStringMethods = ({
  DateTimeFormat,
  getTime,
  getNativeTimezoneOffset,
  localeTimeZone,
  intlDefaults,
  isInvalidDate,
  log,
}: DateStringContext): DateStringMethods => {
  const getTokens = (date: Date) =>
    getDateLocaleTokens(DateTimeFormat, date, localeTimeZone);
  const getOffset = (date: Date) =>
    getTimeZoneOffsetMinutes(localeTimeZone, getTime(date));
  const formatLocale = (
    date: Date,
    locales: Intl.LocalesArgument | undefined,
    options: Intl.DateTimeFormatOptions | undefined,
    defaults: Intl.DateTimeFormatOptions,
  ): string =>
    isInvalidDate(date)
      ? "Invalid Date"
      : buildDateStringFormatter({
          DateTimeFormat,
          locales,
          options,
          defaults,
          intlDefaults,
        }).format(date);
  return {
    getTimezoneOffset(this: Date): number {
      const epochMs = getTime(this);
      const offset = Number.isNaN(epochMs)
        ? getNativeTimezoneOffset(this)
        : getTimeZoneOffsetMinutes(localeTimeZone, epochMs);
      log("getTimezoneOffset", [], offset);
      return offset;
    },
    toString(this: Date): string {
      let result = "Invalid Date";
      if (!isInvalidDate(this)) {
        const tokens = getTokens(this);
        result = `${tokens.weekday} ${tokens.month} ${tokens.day} ${tokens.year} ${tokens.time} ${formatOffset(getOffset(this))} (${getTimezoneName(DateTimeFormat, this, localeTimeZone)})`;
      }
      log("toString", [], result);
      return result;
    },
    toDateString(this: Date): string {
      const tokens = isInvalidDate(this) ? null : getTokens(this);
      const result = tokens
        ? `${tokens.weekday} ${tokens.month} ${tokens.day} ${tokens.year}`
        : "Invalid Date";
      log("toDateString", [], result);
      return result;
    },
    toTimeString(this: Date): string {
      const tokens = isInvalidDate(this) ? null : getTokens(this);
      const result = tokens
        ? `${tokens.time} ${formatOffset(getOffset(this))} (${getTimezoneName(DateTimeFormat, this, localeTimeZone)})`
        : "Invalid Date";
      log("toTimeString", [], result);
      return result;
    },
    toLocaleString(this: Date, locales, options): string {
      const result = formatLocale(this, locales, options, DATE_LOCALE_DEFAULTS);
      log("toLocaleString", [locales, options], result);
      return result;
    },
    toLocaleDateString(this: Date, locales, options): string {
      const result = formatLocale(this, locales, options, DATE_STRING_DEFAULTS);
      log("toLocaleDateString", [locales, options], result);
      return result;
    },
    toLocaleTimeString(this: Date, locales, options): string {
      const result = formatLocale(this, locales, options, TIME_STRING_DEFAULTS);
      log("toLocaleTimeString", [locales, options], result);
      return result;
    },
  };
};

export const createDateMethods = ({
  NativeDate,
  DateTimeFormat,
  getTime,
  setTime,
  getNativeTimezoneOffset,
  getMilliseconds,
  localeTimeZone,
  intlDefaults,
  logger,
}: DateMethodOptions): DatePrototypeMethods => {
  const isInvalidDate = (date: Date): boolean => Number.isNaN(getTime(date));
  const getParts = (date: Date): DateLocaleParts | null =>
    getDateParts(DateTimeFormat, getTime, date, localeTimeZone);
  const log = (method: string, args: unknown[], result?: unknown): void => {
    logger?.(method, args, result);
  };

  const createNumericGetter = <TKey extends keyof DateLocaleParts>(part: TKey) =>
    function getNumericDatePart(this: Date): number {
      return getParts(this)?.[part] ?? Number.NaN;
    };

  const setterMethods = createZonedSetters({
    NativeDate,
    DateTimeFormat,
    timeZone: localeTimeZone,
    getTime,
    setTime,
    ...(logger ? { logger } : {}),
  });

  return {
    ...createDateStringMethods({
      DateTimeFormat,
      getTime,
      getNativeTimezoneOffset,
      localeTimeZone,
      intlDefaults,
      isInvalidDate,
      log,
    }),
    getFullYear: createNumericGetter("year"),
    getYear(this: Date): number {
      const year = getParts(this)?.year;
      return year === undefined ? Number.NaN : year - 1900;
    },
    getMonth: createNumericGetter("month"),
    getDate: createNumericGetter("date"),
    getDay: createNumericGetter("day"),
    getHours: createNumericGetter("hours"),
    getMinutes: createNumericGetter("minutes"),
    getSeconds: createNumericGetter("seconds"),
    getMilliseconds(this: Date): number {
      return getMilliseconds(this);
    },
    ...setterMethods,
  };
};

const getDateMethodLength = (
  key: (typeof DATE_METHOD_KEYS)[number],
): number | undefined => {
  if (
    key === "toLocaleString" ||
    key === "toLocaleDateString" ||
    key === "toLocaleTimeString"
  ) {
    return 0;
  }
  if (key === "setFullYear" || key === "setMinutes") return 3;
  if (key === "setMonth" || key === "setSeconds") return 2;
  if (key === "setHours") return 4;
  if (key === "setDate" || key === "setMilliseconds" || key === "setYear") {
    return 1;
  }
  return undefined;
};

export const createDateMethodDescs = (
  methods: DatePrototypeMethods,
  maskAsNative: MaskAsNative,
  createNativeSource: (name: string) => string,
): PropertyDescriptorMap => {
  const descriptors: Record<string, PropertyDescriptor> = {};
  for (const key of DATE_METHOD_KEYS) {
    const method = methods[key] as Function;
    const nativeSource = createNativeSource(key);
    const length = getDateMethodLength(key);
    descriptors[key] = {
      configurable: true,
      enumerable: false,
      writable: true,
      value:
        length === undefined
          ? maskAsNative(method, nativeSource)
          : maskAsNative(method, nativeSource, length),
    };
  }
  return descriptors;
};
