import { getTimeZoneOffsetMinutes } from "@privacy-brand/refract-core";
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
    const nativeFormatToParts = NATIVE_DATE_TIME_FORMAT.prototype.formatToParts;
    const formatToPartsSpy = vi
      .spyOn(NATIVE_DATE_TIME_FORMAT.prototype, "formatToParts")
      .mockImplementation(function (this: Intl.DateTimeFormat, date?: Date | number) {
        return nativeFormatToParts.call(this, date);
      });
    const epochMs = Date.parse("2026-07-15T12:34:10.250Z");

    expect(getTimeZoneOffsetMinutes("Pacific/Chatham", epochMs)).toBe(-765);
    expect(getTimeZoneOffsetMinutes("Pacific/Chatham", epochMs + 20_000)).toBe(-765);
    expect(formatToPartsSpy).toHaveBeenCalledOnce();
  });

  it("keeps offsets correct across DST transitions", async () => {
    expect(
      getTimeZoneOffsetMinutes("Europe/Warsaw", Date.parse("2026-03-29T00:59:00.000Z")),
    ).toBe(-60);
    expect(
      getTimeZoneOffsetMinutes("Europe/Warsaw", Date.parse("2026-03-29T01:01:00.000Z")),
    ).toBe(-120);
  });
});
