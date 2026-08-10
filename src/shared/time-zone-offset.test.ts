import { afterEach, describe, expect, it, vi } from "vitest";

const NATIVE_DATE_TIME_FORMAT = Intl.DateTimeFormat;

describe("getTimeZoneOffsetMinutes", () => {
  afterEach(() => {
    Object.defineProperty(Intl, "DateTimeFormat", {
      configurable: true,
      value: NATIVE_DATE_TIME_FORMAT,
    });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("reuses timezone offset results within the same minute bucket", async () => {
    let formatToPartsCalls = 0;
    const countingDateTimeFormat = vi.fn(function DateTimeFormat(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ) {
      const formatter = new NATIVE_DATE_TIME_FORMAT(locales, options);
      return {
        formatToParts(date: Date) {
          formatToPartsCalls += 1;
          return formatter.formatToParts(date);
        },
      };
    }) as unknown as typeof Intl.DateTimeFormat;

    Object.defineProperty(Intl, "DateTimeFormat", {
      configurable: true,
      value: countingDateTimeFormat,
    });

    const { getTimeZoneOffsetMinutes } = await import("@/shared/time-zone-offset");
    const epochMs = Date.parse("2026-07-15T12:34:10.250Z");

    expect(getTimeZoneOffsetMinutes("Europe/Warsaw", epochMs)).toBe(-120);
    expect(getTimeZoneOffsetMinutes("Europe/Warsaw", epochMs + 20_000)).toBe(-120);
    expect(formatToPartsCalls).toBe(1);
    expect(countingDateTimeFormat).toHaveBeenCalledOnce();
  });

  it("keeps offsets correct across DST transitions", async () => {
    const { getTimeZoneOffsetMinutes } = await import("@/shared/time-zone-offset");

    expect(
      getTimeZoneOffsetMinutes("Europe/Warsaw", Date.parse("2026-03-29T00:59:00.000Z")),
    ).toBe(-60);
    expect(
      getTimeZoneOffsetMinutes("Europe/Warsaw", Date.parse("2026-03-29T01:01:00.000Z")),
    ).toBe(-120);
  });
});
