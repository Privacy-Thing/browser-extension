const timeZoneFormatterCache = new Map<string, Intl.DateTimeFormat>();
const timeZoneOffsetCache = new Map<string, number>();
const MAX_OFFSET_CACHE_SIZE = 512;

const getTimeZoneFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = timeZoneFormatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  /**
   * This formatter is not a user-facing locale choice and it does not mean
   * "pretend the profile is Canadian". We use Intl here as a timezone/DST
   * oracle: formatToParts() asks the engine for the wall-clock year, month,
   * day, hour, minute, and second in the requested IANA time zone.
   *
   * The code below then converts those numeric parts back into a UTC timestamp
   * so we can derive the offset at this exact instant. "en-CA" is kept only as
   * a stable machine-readable base locale, while calendar: "iso8601",
   * numberingSystem: "latn", and hour12: false make the emitted parts safe for
   * numeric parsing and free from AM/PM or locale-digit ambiguity.
   */
  const formatter = new Intl.DateTimeFormat("en-CA", {
    calendar: "iso8601",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    numberingSystem: "latn",
    second: "2-digit",
    timeZone,
    year: "numeric",
    day: "2-digit",
  });

  timeZoneFormatterCache.set(timeZone, formatter);
  return formatter;
};

const getNumericDateTimePart = (
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number => {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) {
    throw new Error(`Missing Intl.DateTimeFormat part: ${type}`);
  }

  return Number(value);
};

const getOffsetCacheKey = (timeZone: string, epochMs: number): string =>
  `${timeZone}:${Math.floor(epochMs / 60_000)}`;

const cacheTimeZoneOffset = (cacheKey: string, offsetMinutes: number): number => {
  if (timeZoneOffsetCache.size >= MAX_OFFSET_CACHE_SIZE) {
    timeZoneOffsetCache.clear();
  }

  timeZoneOffsetCache.set(cacheKey, offsetMinutes);
  return offsetMinutes;
};

export const getTimeZoneOffsetMinutes = (timeZone: string, epochMs: number): number => {
  const cacheKey = getOffsetCacheKey(timeZone, epochMs);
  const cachedOffset = timeZoneOffsetCache.get(cacheKey);
  if (cachedOffset !== undefined) {
    return cachedOffset;
  }

  const instant = new Date(epochMs);
  const parts = getTimeZoneFormatter(timeZone).formatToParts(instant);
  const year = getNumericDateTimePart(parts, "year");
  const month = getNumericDateTimePart(parts, "month");
  const day = getNumericDateTimePart(parts, "day");
  const hour = getNumericDateTimePart(parts, "hour");
  const minute = getNumericDateTimePart(parts, "minute");
  const second = getNumericDateTimePart(parts, "second");
  const utcForZonedParts = Date.UTC(year, month - 1, day, hour, minute, second);
  const truncatedEpochMs = epochMs - (epochMs % 1000);

  return cacheTimeZoneOffset(cacheKey, (truncatedEpochMs - utcForZonedParts) / 60_000);
};
