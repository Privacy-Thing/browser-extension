export type ParseDateStringOptions = {
  NativeDate: typeof Date;
  getTimeZoneOffsetMinutes: (timeZone: string, epochMs: number) => number;
  timeZone: string;
};

export const isValidCalendarDate = (
  NativeDate: typeof Date,
  year: number,
  month: number,
  day: number,
): boolean => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (month < 1 || month > 12 || day < 1) {
    return false;
  }

  const candidate = new NativeDate(NativeDate.UTC(year, month - 1, day, 0, 0, 0, 0));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
};

export const parseSpoofableDateString = (
  value: unknown,
  options: ParseDateStringOptions,
): number | null => {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, monthText, dayText, yearText] = match;
  const month = Number(monthText);
  const day = Number(dayText);
  const year = Number(yearText);
  if (!isValidCalendarDate(options.NativeDate, year, month, day)) {
    return null;
  }

  const utcMidnightMs = options.NativeDate.UTC(year, month - 1, day, 0, 0, 0, 0);
  const targetOffsetMinutes = options.getTimeZoneOffsetMinutes(
    options.timeZone,
    utcMidnightMs,
  );
  return utcMidnightMs + targetOffsetMinutes * 60_000;
};

export const DATE_PARSE_SOURCE = `
  const isValidCalendarDate = (NativeDate, year, month, day) => {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return false;
    }

    if (month < 1 || month > 12 || day < 1) {
      return false;
    }

    const candidate = new NativeDate(NativeDate.UTC(year, month - 1, day, 0, 0, 0, 0));
    return candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day;
  };

  const parseSpoofableDateString = (value, options) => {
    if (typeof value !== "string") {
      return null;
    }

    const match = value.trim().match(new RegExp("^(\\\\d{1,2})/(\\\\d{1,2})/(\\\\d{4})$"));
    if (!match) {
      return null;
    }

    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    if (!isValidCalendarDate(options.NativeDate, year, month, day)) {
      return null;
    }

    const utcMidnightMs = options.NativeDate.UTC(year, month - 1, day, 0, 0, 0, 0);
    const targetOffsetMinutes = options.getTimeZoneOffsetMinutes(options.timeZone, utcMidnightMs);
    return utcMidnightMs + targetOffsetMinutes * 60000;
  };
`;
