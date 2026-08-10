import type { FirefoxTimeLocaleState } from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { createFxDateMethods } from "@privacy-brand/refract-core";
import { getTimeZoneOffsetMinutes } from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

const TEST_EPOCH_MS = Date.parse("2026-01-15T12:00:00.000Z");
const TEST_DATE = new Date(TEST_EPOCH_MS);
const TEST_STATE: FirefoxTimeLocaleState = {
  language: "pl-PL",
  languages: ["pl-PL", "pl"],
  timeZone: "Europe/Warsaw",
  offsetMinutes: getTimeZoneOffsetMinutes("Europe/Warsaw", TEST_EPOCH_MS),
};

describe("createFxDateMethods", () => {
  it("uses Firefox shim timezone state for offset and date strings", () => {
    let syncCalls = 0;
    const methods = createFxDateMethods({
      NativeDate: Date,
      NativeIntlDateTimeFormat: Intl.DateTimeFormat,
      syncBootstrapState: () => {
        syncCalls += 1;
      },
      getTimeLocaleState: () => TEST_STATE,
    });

    expect(methods.getTimezoneOffset.call(TEST_DATE)).toBe(TEST_STATE.offsetMinutes);
    expect(methods.toTimeString.call(TEST_DATE)).toContain("GMT+0100");
    expect(methods.toDateString.call(TEST_DATE)).toContain("2026");
    expect(syncCalls).toBeGreaterThan(0);
  });

  it("falls back to native behavior when Firefox shim state is absent", () => {
    const methods = createFxDateMethods({
      NativeDate: Date,
      NativeIntlDateTimeFormat: Intl.DateTimeFormat,
      syncBootstrapState: () => {},
      getTimeLocaleState: () => null,
    });

    expect(methods.getTimezoneOffset.call(TEST_DATE)).toBe(
      TEST_DATE.getTimezoneOffset(),
    );
    expect(methods.toTimeString.call(TEST_DATE)).toBe(TEST_DATE.toTimeString());
    expect(methods.toDateString.call(TEST_DATE)).toBe(TEST_DATE.toDateString());
    expect(methods.toString.call(TEST_DATE)).toBe(TEST_DATE.toString());
  });

  it("computes offsets from the queried date instead of the bootstrap snapshot", () => {
    const summerDate = new Date("2026-07-15T12:00:00.000Z");
    const methods = createFxDateMethods({
      NativeDate: Date,
      NativeIntlDateTimeFormat: Intl.DateTimeFormat,
      syncBootstrapState: () => {},
      getTimeLocaleState: () => TEST_STATE,
    });

    expect(methods.getTimezoneOffset.call(summerDate)).toBe(
      getTimeZoneOffsetMinutes("Europe/Warsaw", summerDate.getTime()),
    );
  });
});
