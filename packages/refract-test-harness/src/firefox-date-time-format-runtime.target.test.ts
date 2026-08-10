import { createFxDateTimeRuntime } from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

const TEST_TIME_ZONE = "Europe/Warsaw";
const TEST_LOCALES = ["pl-PL", "pl"] as const;
const TEST_DATE = new Date("2026-01-15T12:00:00.000Z");
const NATIVE_DATE_TIME_FORMAT = Intl.DateTimeFormat;
const NATIVE_FORMAT_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  NATIVE_DATE_TIME_FORMAT.prototype,
  "format",
);

const createRuntime = () =>
  createFxDateTimeRuntime({
    NativeIntlDateTimeFormat: NATIVE_DATE_TIME_FORMAT,
    nativeFormatGetter: NATIVE_FORMAT_DESCRIPTOR?.get,
    resolveDateTimeArgs: (locales, options) => ({
      locales: locales ?? TEST_LOCALES,
      options: options?.timeZone ? options : { ...options, timeZone: TEST_TIME_ZONE },
    }),
  });

describe("createFxDateTimeRuntime", () => {
  it("tracks requested args and delegates resolvedOptions for tracked instances", () => {
    const runtime = createRuntime();
    const formatter = new NATIVE_DATE_TIME_FORMAT(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    runtime.trackInstance(formatter, undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const resolved = runtime.resolvedOptions(formatter);

    expect(resolved.locale.toLowerCase()).toContain("pl");
    expect(resolved.timeZone).toBe(TEST_TIME_ZONE);
  });

  it("returns the native format getter output for untracked instances", () => {
    const runtime = createRuntime();
    const formatter = new NATIVE_DATE_TIME_FORMAT("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
    });
    const nativeFormat = NATIVE_FORMAT_DESCRIPTOR?.get?.call(formatter);

    expect(nativeFormat).toBeTypeOf("function");
    expect(runtime.getFormat(formatter)).toBe(nativeFormat);
    expect(runtime.getFormat(formatter)(TEST_DATE)).toBe(nativeFormat!(TEST_DATE));
  });

  it("caches tracked format getters and delegates instance methods", () => {
    const runtime = createRuntime();
    const formatter = new NATIVE_DATE_TIME_FORMAT(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    runtime.trackInstance(formatter, undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const delegated = new NATIVE_DATE_TIME_FORMAT(TEST_LOCALES, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TEST_TIME_ZONE,
    });

    const firstFormat = runtime.getFormat(formatter);
    const secondFormat = runtime.getFormat(formatter);

    expect(firstFormat).toBe(secondFormat);
    expect(firstFormat(TEST_DATE)).toBe(delegated.format(TEST_DATE));
    expect(runtime.formatToParts(formatter, TEST_DATE)).toEqual(
      delegated.formatToParts(TEST_DATE),
    );
    expect(
      runtime.formatRange(formatter, TEST_DATE, new Date(TEST_DATE.getTime() + 60_000)),
    ).toBe(delegated.formatRange(TEST_DATE, new Date(TEST_DATE.getTime() + 60_000)));
    expect(
      runtime.formatRangeToParts(
        formatter,
        TEST_DATE,
        new Date(TEST_DATE.getTime() + 60_000),
      ),
    ).toEqual(
      delegated.formatRangeToParts(TEST_DATE, new Date(TEST_DATE.getTime() + 60_000)),
    );
  });
});
