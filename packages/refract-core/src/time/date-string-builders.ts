import {
  withDefaultLocales,
  withDefaultTimeZone,
  type IntlDefaults,
} from "./intl-defaults";

type DateTimeFormatCtor = {
  new (
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ): Intl.DateTimeFormat;
};

/**
 * Builds the option bag used by `Date#toLocale*String()` so patched Date
 * methods only add their default field set when the page omitted both style and
 * field-level output hints.
 */
export const buildDateLocaleOptions = (
  options: Intl.DateTimeFormatOptions | undefined,
  defaults: Intl.DateTimeFormatOptions,
  intlDefaults: IntlDefaults,
): Intl.DateTimeFormatOptions => {
  const nextOptions = withDefaultTimeZone(options, intlDefaults) ?? {};
  const hasDateStyle = nextOptions.dateStyle !== undefined;
  const hasTimeStyle = nextOptions.timeStyle !== undefined;
  const hasDateFields =
    nextOptions.weekday !== undefined ||
    nextOptions.year !== undefined ||
    nextOptions.month !== undefined ||
    nextOptions.day !== undefined;
  const hasTimeFields =
    nextOptions.dayPeriod !== undefined ||
    nextOptions.hour !== undefined ||
    nextOptions.minute !== undefined ||
    nextOptions.second !== undefined ||
    nextOptions.fractionalSecondDigits !== undefined;

  if (!hasDateStyle && !hasTimeStyle && !hasDateFields && !hasTimeFields) {
    Object.assign(nextOptions, defaults);
  }

  return nextOptions;
};

/**
 * Bounded per-constructor cache of `Intl.DateTimeFormat` instances reused by
 * `Date#toLocale*String()`. Pages that call these methods in tight loops would
 * otherwise construct a fresh formatter on every invocation. Scoped by
 * `DateTimeFormat` constructor (one realm/snapshot owns one constructor) and
 * keyed by the already-normalized locales + options, with a hard size limit and
 * `clear()` on overflow — mirrors the cache discipline in `date-locale-helpers`.
 */
const DATE_STRING_CACHE_LIMIT = 48;
const dateStringFormatterCache = new WeakMap<
  DateTimeFormatCtor,
  Map<string, Intl.DateTimeFormat>
>();

/**
 * Serialize the resolved locales argument into a stable cache key, or return
 * `null` when the value is not safely serializable (e.g. `Intl.Locale` objects
 * or locale objects with observable getters). A `null` key bypasses the cache so
 * native canonicalization/throw behavior is preserved verbatim.
 */
const serializeLocalesCacheKey = (
  locales: Intl.LocalesArgument | undefined,
): string | null => {
  if (locales === undefined) {
    return "u";
  }
  if (typeof locales === "string") {
    return `s:${locales}`;
  }
  if (Array.isArray(locales) && locales.every((entry) => typeof entry === "string")) {
    return `a:${locales.join(",")}`;
  }
  return null;
};

/**
 * Serialize the normalized options bag into a stable cache key, or return `null`
 * when any value is non-primitive (so the cache is skipped and the formatter is
 * built directly). The options object is Privacy Thing-owned and already fully read by
 * `buildDateLocaleOptions`, so reading it here adds no page-observable access.
 */
const serializeOptionsCacheKey = (
  options: Intl.DateTimeFormatOptions,
): string | null => {
  let key = "";
  for (const optionKey of Object.keys(options).sort()) {
    const value = (options as Record<string, unknown>)[optionKey];
    const valueType = typeof value;
    if (
      value !== undefined &&
      valueType !== "string" &&
      valueType !== "number" &&
      valueType !== "boolean"
    ) {
      return null;
    }
    key += `${optionKey}:${String(value)}|`;
  }
  return key;
};

const getDateFormatterCache = (
  DateTimeFormat: DateTimeFormatCtor,
): Map<string, Intl.DateTimeFormat> => {
  const cached = dateStringFormatterCache.get(DateTimeFormat);
  if (cached) {
    return cached;
  }

  const formatterCache = new Map<string, Intl.DateTimeFormat>();
  dateStringFormatterCache.set(DateTimeFormat, formatterCache);
  return formatterCache;
};

export type DateStringFormatterInput = {
  DateTimeFormat: DateTimeFormatCtor;
  locales: Intl.LocalesArgument | undefined;
  options: Intl.DateTimeFormatOptions | undefined;
  defaults: Intl.DateTimeFormatOptions;
  intlDefaults: IntlDefaults;
};

export const buildDateStringFormatter = ({
  DateTimeFormat,
  locales,
  options,
  defaults,
  intlDefaults,
}: DateStringFormatterInput): Intl.DateTimeFormat => {
  const resolvedLocales = withDefaultLocales(locales, intlDefaults);
  const resolvedOptions = buildDateLocaleOptions(options, defaults, intlDefaults);
  const localesKey = serializeLocalesCacheKey(resolvedLocales);
  const optionsKey =
    localesKey === null ? null : serializeOptionsCacheKey(resolvedOptions);

  if (localesKey === null || optionsKey === null) {
    return new DateTimeFormat(resolvedLocales, resolvedOptions);
  }

  const formatterCache = getDateFormatterCache(DateTimeFormat);
  const cacheKey = `${localesKey}##${optionsKey}`;
  const cached = formatterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (formatterCache.size >= DATE_STRING_CACHE_LIMIT) {
    formatterCache.clear();
  }

  // Invalid locales/options throw here and never populate the cache, so the
  // native RangeError surfaces on every call exactly as before.
  const formatter = new DateTimeFormat(resolvedLocales, resolvedOptions);
  formatterCache.set(cacheKey, formatter);
  return formatter;
};

export const DATE_STRING_SOURCE = `
  const buildDateLocaleOptions = (options, defaults, intlDefaults) => {
    const nextOptions = withDefaultTimeZone(options, intlDefaults) ?? {};
    const hasDateStyle = nextOptions.dateStyle !== undefined;
    const hasTimeStyle = nextOptions.timeStyle !== undefined;
    const hasDateFields =
      nextOptions.weekday !== undefined ||
      nextOptions.year !== undefined ||
      nextOptions.month !== undefined ||
      nextOptions.day !== undefined;
    const hasTimeFields =
      nextOptions.dayPeriod !== undefined ||
      nextOptions.hour !== undefined ||
      nextOptions.minute !== undefined ||
      nextOptions.second !== undefined ||
      nextOptions.fractionalSecondDigits !== undefined;

    if (!hasDateStyle && !hasTimeStyle && !hasDateFields && !hasTimeFields) {
      Object.assign(nextOptions, defaults);
    }

    return nextOptions;
  };

  const DATE_STRING_CACHE_LIMIT = 48;
  const dateStringFormatterCache = new WeakMap();
  const serializeLocalesCacheKey = (locales) => {
    if (locales === undefined) {
      return "u";
    }
    if (typeof locales === "string") {
      return "s:" + locales;
    }
    if (Array.isArray(locales) && locales.every((entry) => typeof entry === "string")) {
      return "a:" + locales.join(",");
    }
    return null;
  };
  const serializeOptionsCacheKey = (options) => {
    let key = "";
    for (const optionKey of Object.keys(options).sort()) {
      const value = options[optionKey];
      const valueType = typeof value;
      if (
        value !== undefined &&
        valueType !== "string" &&
        valueType !== "number" &&
        valueType !== "boolean"
      ) {
        return null;
      }
      key += optionKey + ":" + String(value) + "|";
    }
    return key;
  };
  const getDateFormatterCache = (DateTimeFormat) => {
    const cached = dateStringFormatterCache.get(DateTimeFormat);
    if (cached) {
      return cached;
    }

    const formatterCache = new Map();
    dateStringFormatterCache.set(DateTimeFormat, formatterCache);
    return formatterCache;
  };

  const buildDateStringFormatter = (DateTimeFormat, locales, options, defaults, intlDefaults) => {
    const resolvedLocales = withDefaultLocales(locales, intlDefaults);
    const resolvedOptions = buildDateLocaleOptions(options, defaults, intlDefaults);
    const localesKey = serializeLocalesCacheKey(resolvedLocales);
    const optionsKey = localesKey === null ? null : serializeOptionsCacheKey(resolvedOptions);

    if (localesKey === null || optionsKey === null) {
      return new DateTimeFormat(resolvedLocales, resolvedOptions);
    }

    const formatterCache = getDateFormatterCache(DateTimeFormat);
    const cacheKey = localesKey + "##" + optionsKey;
    const cached = formatterCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (formatterCache.size >= DATE_STRING_CACHE_LIMIT) {
      formatterCache.clear();
    }

    const formatter = new DateTimeFormat(resolvedLocales, resolvedOptions);
    formatterCache.set(cacheKey, formatter);
    return formatter;
  };
`;
