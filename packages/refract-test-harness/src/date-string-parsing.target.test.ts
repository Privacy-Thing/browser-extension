import {
  DATE_PARSE_SOURCE,
  isValidCalendarDate,
  parseSpoofableDateString,
  getTimeZoneOffsetMinutes,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

describe("date-string-parsing", () => {
  it("validates calendar dates without accepting impossible month-day combinations", () => {
    expect(isValidCalendarDate(Date, 2026, 2, 28)).toBe(true);
    expect(isValidCalendarDate(Date, 2024, 2, 29)).toBe(true);
    expect(isValidCalendarDate(Date, 2025, 2, 29)).toBe(false);
    expect(isValidCalendarDate(Date, 2026, 2, 31)).toBe(false);
    expect(isValidCalendarDate(Date, 2026, 13, 1)).toBe(false);
  });

  it("parses spoofable mm/dd/yyyy strings in the target timezone", () => {
    const utcMidnightMs = Date.UTC(2026, 0, 15, 0, 0, 0, 0);

    expect(
      parseSpoofableDateString("01/15/2026", {
        NativeDate: Date,
        getTimeZoneOffsetMinutes,
        timeZone: "America/Los_Angeles",
      }),
    ).toBe(
      utcMidnightMs +
        getTimeZoneOffsetMinutes("America/Los_Angeles", utcMidnightMs) * 60_000,
    );
  });

  it("rejects non-spoofable inputs and impossible dates", () => {
    const options = {
      NativeDate: Date,
      getTimeZoneOffsetMinutes,
      timeZone: "Europe/Warsaw",
    } as const;

    expect(parseSpoofableDateString("2026-01-15", options)).toBeNull();
    expect(parseSpoofableDateString("02/31/2026", options)).toBeNull();
    expect(parseSpoofableDateString(123, options)).toBeNull();
  });

  it("exports a literal worker inline source for spoofable date parsing", () => {
    expect(DATE_PARSE_SOURCE).toContain(
      "const isValidCalendarDate = (NativeDate, year, month, day) => {",
    );
    expect(DATE_PARSE_SOURCE).toContain(
      "const parseSpoofableDateString = (value, options) => {",
    );
    expect(DATE_PARSE_SOURCE).not.toContain("__vite_ssr_import_");
  });
});
