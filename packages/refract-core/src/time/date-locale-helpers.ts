export type DateTimeFormatLike = new (
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
) => Pick<Intl.DateTimeFormat, "formatToParts">;

export type DateLocaleTokens = {
  weekday: string;
  month: string;
  day: string;
  year: string;
  time: string;
};

export type DateLocaleParts = {
  year: number;
  month: number;
  date: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const WEEKDAYS = new Map([
  ["Sun", 0],
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
]);

const DATE_LOCALE_CACHE_LIMIT = 24;
const DATE_PARTS_CACHE_LIMIT = 256;
const dateTimeFormatCache = new WeakMap<
  DateTimeFormatLike,
  Map<string, Pick<Intl.DateTimeFormat, "formatToParts">>
>();
const datePartsCache = new WeakMap<DateTimeFormatLike, Map<string, DateLocaleParts>>();

const buildFormatterCacheKey = (
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string => {
  const serializedOptions = Object.entries(options)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join("|");

  return `${timeZone}|${serializedOptions}`;
};

const getFormatterCache = (
  DateTimeFormat: DateTimeFormatLike,
): Map<string, Pick<Intl.DateTimeFormat, "formatToParts">> => {
  const cached = dateTimeFormatCache.get(DateTimeFormat);
  if (cached) {
    return cached;
  }

  const formatterCache = new Map<string, Pick<Intl.DateTimeFormat, "formatToParts">>();
  dateTimeFormatCache.set(DateTimeFormat, formatterCache);
  return formatterCache;
};

const getCachedFormatter = (
  DateTimeFormat: DateTimeFormatLike,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Pick<Intl.DateTimeFormat, "formatToParts"> => {
  const formatterCache = getFormatterCache(DateTimeFormat);
  const cacheKey = buildFormatterCacheKey(timeZone, options);
  const cached = formatterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (formatterCache.size >= DATE_LOCALE_CACHE_LIMIT) {
    formatterCache.clear();
  }

  const formatter = new DateTimeFormat("en-US", {
    ...options,
    timeZone,
  });
  formatterCache.set(cacheKey, formatter);
  return formatter;
};

const getDatePartsCache = (
  DateTimeFormat: DateTimeFormatLike,
): Map<string, DateLocaleParts> => {
  const cached = datePartsCache.get(DateTimeFormat);
  if (cached) {
    return cached;
  }

  const partsCache = new Map<string, DateLocaleParts>();
  datePartsCache.set(DateTimeFormat, partsCache);
  return partsCache;
};

const getPartsMap = (
  DateTimeFormat: DateTimeFormatLike,
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Map<string, string> =>
  new Map(
    getCachedFormatter(DateTimeFormat, timeZone, options)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

/**
 * Shared Date string/getter formatting helpers. Callers pass native primitives
 * and Date instances that retain their absolute epoch.
 */
export const formatOffset = (offsetMinutes: number): string => {
  const min = Math.abs(offsetMinutes);
  const hours = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (min % 60).toString().padStart(2, "0");
  const sign = offsetMinutes > 0 ? "-" : "+";
  return `GMT${sign}${hours}${minutes}`;
};

export const getTimezoneName = (
  DateTimeFormat: DateTimeFormatLike,
  date: Date,
  timeZone: string,
): string => {
  try {
    return (
      getCachedFormatter(DateTimeFormat, timeZone, {
        timeZoneName: "long",
      })
        .formatToParts(date)
        .find((part) => part.type === "timeZoneName")?.value ?? timeZone
    );
  } catch {
    return timeZone;
  }
};

export const getDateLocaleTokens = (
  DateTimeFormat: DateTimeFormatLike,
  date: Date,
  timeZone: string,
): DateLocaleTokens => {
  const parts = getPartsMap(DateTimeFormat, date, timeZone, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const hour = parts.get("hour") === "24" ? "00" : (parts.get("hour") ?? "00");

  return {
    weekday: parts.get("weekday") ?? "",
    month: parts.get("month") ?? "",
    day: parts.get("day") ?? "",
    year: parts.get("year") ?? "",
    time: `${hour}:${parts.get("minute") ?? "00"}:${parts.get("second") ?? "00"}`,
  };
};

export const getDateParts = (
  DateTimeFormat: DateTimeFormatLike,
  getTime: (date: Date) => number,
  date: Date,
  timeZone: string,
): DateLocaleParts | null => {
  const epochMs = getTime(date);
  if (Number.isNaN(epochMs)) {
    return null;
  }

  const partsCache = getDatePartsCache(DateTimeFormat);
  const cacheKey = `${timeZone}:${Math.floor(epochMs / 1000)}`;
  const cached = partsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const parts = getPartsMap(DateTimeFormat, date, timeZone, {
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const hour = parts.get("hour") === "24" ? "0" : parts.get("hour");
  const resolvedParts = {
    year: Number(parts.get("year")),
    month: Number(parts.get("month")) - 1,
    date: Number(parts.get("day")),
    day: WEEKDAYS.get(parts.get("weekday") ?? "") ?? Number.NaN,
    hours: Number(hour),
    minutes: Number(parts.get("minute")),
    seconds: Number(parts.get("second")),
  };

  if (partsCache.size >= DATE_PARTS_CACHE_LIMIT) {
    partsCache.clear();
  }

  partsCache.set(cacheKey, resolvedParts);
  return resolvedParts;
};

export const DATE_LOCALE_SOURCE = `
  const DATE_LOCALE_CACHE_LIMIT = 24;
  const DATE_PARTS_CACHE_LIMIT = 256;
  const dateTimeFormatCache = new WeakMap();
  const datePartsCache = new WeakMap();
  const weekdays = new Map([
    ["Sun", 0],
    ["Mon", 1],
    ["Tue", 2],
    ["Wed", 3],
    ["Thu", 4],
    ["Fri", 5],
    ["Sat", 6]
  ]);
  const buildFormatterCacheKey = (timeZone, options) =>
    timeZone + "|" + Object.entries(options)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => key + ":" + String(value))
      .join("|");
  const getFormatterCache = (DateTimeFormat) => {
    const cached = dateTimeFormatCache.get(DateTimeFormat);
    if (cached) {
      return cached;
    }

    const formatterCache = new Map();
    dateTimeFormatCache.set(DateTimeFormat, formatterCache);
    return formatterCache;
  };
  const getCachedFormatter = (DateTimeFormat, timeZone, options) => {
    const formatterCache = getFormatterCache(DateTimeFormat);
    const cacheKey = buildFormatterCacheKey(timeZone, options);
    const cached = formatterCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (formatterCache.size >= DATE_LOCALE_CACHE_LIMIT) {
      formatterCache.clear();
    }

    const formatter = new DateTimeFormat("en-US", {
      ...options,
      timeZone
    });
    formatterCache.set(cacheKey, formatter);
    return formatter;
  };
  const getDatePartsCache = (DateTimeFormat) => {
    const cached = datePartsCache.get(DateTimeFormat);
    if (cached) {
      return cached;
    }

    const partsCache = new Map();
    datePartsCache.set(DateTimeFormat, partsCache);
    return partsCache;
  };
  const formatOffset = (offsetMinutes) => {
    const min = Math.abs(offsetMinutes);
    const hours = Math.floor(min / 60).toString().padStart(2, "0");
    const minutes = (min % 60).toString().padStart(2, "0");
    const sign = offsetMinutes > 0 ? "-" : "+";
    return "GMT" + sign + hours + minutes;
  };

  const getTimezoneName = (DateTimeFormat, date, timeZone) => {
    try {
      return getCachedFormatter(DateTimeFormat, timeZone, {
        timeZone,
        timeZoneName: "long"
      }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? timeZone;
    } catch {
      return timeZone;
    }
  };

  const getDateLocaleTokens = (DateTimeFormat, date, timeZone) => {
    const parts = new Map(getCachedFormatter(DateTimeFormat, timeZone, {
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone
    }).formatToParts(date).map((part) => [part.type, part.value]));
    const hour = parts.get("hour") === "24" ? "00" : parts.get("hour") ?? "00";

    return {
      weekday: parts.get("weekday") ?? "",
      month: parts.get("month") ?? "",
      day: parts.get("day") ?? "",
      year: parts.get("year") ?? "",
      time: String(hour) + ":" + (parts.get("minute") ?? "00") + ":" + (parts.get("second") ?? "00")
    };
  };

  const getDateParts = (DateTimeFormat, getTime, date, timeZone) => {
    const epochMs = getTime(date);
    if (Number.isNaN(epochMs)) {
      return null;
    }

    const partsCache = getDatePartsCache(DateTimeFormat);
    const cacheKey = timeZone + ":" + Math.floor(epochMs / 1000);
    const cached = partsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const parts = new Map(getCachedFormatter(DateTimeFormat, timeZone, {
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZone
    }).formatToParts(date).map((part) => [part.type, part.value]));
    const hour = parts.get("hour") === "24" ? "0" : parts.get("hour");

    const resolvedParts = {
      year: Number(parts.get("year")),
      month: Number(parts.get("month")) - 1,
      date: Number(parts.get("day")),
      day: weekdays.get(parts.get("weekday") ?? "") ?? Number.NaN,
      hours: Number(hour),
      minutes: Number(parts.get("minute")),
      seconds: Number(parts.get("second"))
    };

    if (partsCache.size >= DATE_PARTS_CACHE_LIMIT) {
      partsCache.clear();
    }

    partsCache.set(cacheKey, resolvedParts);
    return resolvedParts;
  };
`;
