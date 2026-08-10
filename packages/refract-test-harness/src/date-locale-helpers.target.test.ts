import {
  DATE_LOCALE_SOURCE,
  type DateTimeFormatLike,
  formatOffset,
  getDateLocaleTokens,
  getDateParts,
  getTimezoneName,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

describe("date-locale-helpers", () => {
  const nativeGetTime = (date: Date): number => Date.prototype.getTime.call(date);
  const createCountingFormatter = (): {
    DateTimeFormat: DateTimeFormatLike;
    getConstructorCalls: () => number;
    getFormatCalls: () => number;
  } => {
    const NativeDateTimeFormat = Intl.DateTimeFormat;
    let constructorCalls = 0;
    let formatCalls = 0;

    const DateTimeFormat = function DateTimeFormat(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ) {
      constructorCalls += 1;
      const formatter = new NativeDateTimeFormat(locales, options);
      return {
        formatToParts(date: Date) {
          formatCalls += 1;
          return formatter.formatToParts(date);
        },
      };
    } as unknown as DateTimeFormatLike;

    return {
      DateTimeFormat,
      getConstructorCalls: () => constructorCalls,
      getFormatCalls: () => formatCalls,
    };
  };

  it("formats GMT offsets with the native sign convention used by Date strings", () => {
    expect(formatOffset(-120)).toBe("GMT+0200");
    expect(formatOffset(330)).toBe("GMT-0530");
    expect(formatOffset(0)).toBe("GMT+0000");
  });

  it("reads stable date string tokens in the requested timezone", () => {
    const date = new Date("2026-07-15T12:00:00.000Z");

    expect(
      getDateLocaleTokens(Intl.DateTimeFormat, date, "America/Los_Angeles"),
    ).toEqual({
      weekday: "Wed",
      month: "Jul",
      day: "15",
      year: "2026",
      time: "05:00:00",
    });
    expect(getDateLocaleTokens(Intl.DateTimeFormat, date, "Asia/Tokyo")).toEqual({
      weekday: "Wed",
      month: "Jul",
      day: "15",
      year: "2026",
      time: "21:00:00",
    });
  });

  it("reads numeric date parts in the requested timezone", () => {
    const date = new Date("2026-12-31T23:30:00.000Z");

    expect(
      getDateParts(Intl.DateTimeFormat, nativeGetTime, date, "Pacific/Auckland"),
    ).toEqual({
      year: 2027,
      month: 0,
      date: 1,
      day: 5,
      hours: 12,
      minutes: 30,
      seconds: 0,
    });
  });

  it("reuses cached formatters for repeated token lookups in the same timezone", () => {
    const counting = createCountingFormatter();
    const date = new Date("2026-07-15T12:00:00.000Z");

    getDateLocaleTokens(counting.DateTimeFormat, date, "America/Los_Angeles");
    getDateLocaleTokens(
      counting.DateTimeFormat,
      new Date("2026-07-15T12:00:30.000Z"),
      "America/Los_Angeles",
    );
    getTimezoneName(counting.DateTimeFormat, date, "America/Los_Angeles");
    getTimezoneName(
      counting.DateTimeFormat,
      new Date("2026-07-15T13:00:00.000Z"),
      "America/Los_Angeles",
    );

    expect(counting.getConstructorCalls()).toBe(2);
  });

  it("reuses parsed date parts for repeated getter-style reads within the same second", () => {
    const counting = createCountingFormatter();
    const firstDate = new Date("2026-12-31T23:30:00.100Z");
    const secondDate = new Date("2026-12-31T23:30:00.900Z");

    expect(
      getDateParts(
        counting.DateTimeFormat,
        nativeGetTime,
        firstDate,
        "Pacific/Auckland",
      ),
    ).toEqual({
      year: 2027,
      month: 0,
      date: 1,
      day: 5,
      hours: 12,
      minutes: 30,
      seconds: 0,
    });
    expect(
      getDateParts(
        counting.DateTimeFormat,
        nativeGetTime,
        secondDate,
        "Pacific/Auckland",
      ),
    ).toEqual({
      year: 2027,
      month: 0,
      date: 1,
      day: 5,
      hours: 12,
      minutes: 30,
      seconds: 0,
    });
    expect(counting.getFormatCalls()).toBe(1);
  });

  it("does not re-run formatToParts across 1000 getter reads within the same second", () => {
    const counting = createCountingFormatter();
    const baseMs = new Date("2026-12-31T23:30:00.000Z").getTime();

    let parts = null;
    for (let call = 0; call < 1000; call += 1) {
      // Vary only the sub-second millisecond so every read maps to one cache key.
      const date = new Date(baseMs + (call % 1000));
      parts = getDateParts(
        counting.DateTimeFormat,
        nativeGetTime,
        date,
        "Pacific/Auckland",
      );
    }

    expect(parts).toEqual({
      year: 2027,
      month: 0,
      date: 1,
      day: 5,
      hours: 12,
      minutes: 30,
      seconds: 0,
    });
    expect(counting.getFormatCalls()).toBe(1);
  });

  it("returns null date parts for invalid dates and falls back to the timezone id when needed", () => {
    const invalidDate = new Date(Number.NaN);

    expect(
      getDateParts(Intl.DateTimeFormat, nativeGetTime, invalidDate, "Europe/Warsaw"),
    ).toBeNull();
    expect(getTimezoneName(Intl.DateTimeFormat, invalidDate, "Europe/Warsaw")).toBe(
      "Europe/Warsaw",
    );
  });

  it("exports a literal worker inline source for date locale helpers", () => {
    expect(DATE_LOCALE_SOURCE).toContain("const formatOffset = (offsetMinutes) => {");
    expect(DATE_LOCALE_SOURCE).toContain(
      "const getDateLocaleTokens = (DateTimeFormat, date, timeZone) => {",
    );
    expect(DATE_LOCALE_SOURCE).toContain(
      "const getDateParts = (DateTimeFormat, getTime, date, timeZone) => {",
    );
    expect(DATE_LOCALE_SOURCE).toContain(
      "const getCachedFormatter = (DateTimeFormat, timeZone, options) => {",
    );
    expect(DATE_LOCALE_SOURCE).not.toContain("__vite_ssr_import_");
  });
});
