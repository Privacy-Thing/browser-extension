import {
  DATE_TIME_PATCH_SOURCE,
  patchDateTimeInstance,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

describe("date-time-format-instance-patch", () => {
  it("normalizes instance format methods through the provided callback", () => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
    const offsetMs = 3_600_000;
    const shiftedDate = new Date(Date.UTC(2026, 0, 15, 13, 0, 0));
    const expectedDate = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
    const nativeFormat = formatter.format.bind(formatter);
    const nativeFormatToParts = formatter.formatToParts.bind(formatter);
    const nativeFormatRange = formatter.formatRange?.bind(formatter);
    const nativeFormatRangeToParts = formatter.formatRangeToParts?.bind(formatter);

    patchDateTimeInstance({
      instance: formatter,
      nativeFormat,
      nativeFormatToParts,
      nativeFormatRange,
      nativeFormatRangeToParts,
      normalizeValue: (value) =>
        value instanceof Date ? new Date(value.getTime() - offsetMs) : value,
      maskAsNative: (fn) => fn,
    });

    expect(formatter.format(shiftedDate)).toBe(nativeFormat(expectedDate));
    expect(formatter.formatToParts(shiftedDate)).toEqual(
      nativeFormatToParts(expectedDate),
    );

    if (nativeFormatRange && nativeFormatRangeToParts) {
      expect(formatter.formatRange(shiftedDate, shiftedDate)).toBe(
        nativeFormatRange(expectedDate, expectedDate),
      );
      expect(formatter.formatRangeToParts(shiftedDate, shiftedDate)).toEqual(
        nativeFormatRangeToParts(expectedDate, expectedDate),
      );
    }
  });

  it("exports a literal worker inline source for DateTimeFormat instance patching", () => {
    expect(DATE_TIME_PATCH_SOURCE).toContain("const patchDateTimeInstance = ({");
    expect(DATE_TIME_PATCH_SOURCE).not.toContain("__vite_ssr_import_");
  });
});
