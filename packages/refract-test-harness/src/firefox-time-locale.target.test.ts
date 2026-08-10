import {
  adjustLocalDateCtor,
  getFxOffsetDelta,
  resolveFxDateTimeArgs,
  getTimeZoneOffsetMinutes,
  isLocalDateArgs,
  toAdjustedDate,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

import { getTimeZoneOffsetMinutes as getSharedTimeZoneOffsetMinutes } from "@/shared/time-zone-offset";

describe("firefox-time-locale", () => {
  it("reuses the shared timezone offset helper for DST-aware offsets", () => {
    const winterEpochMs = Date.parse("2026-01-15T12:00:00.000Z");
    const summerEpochMs = Date.parse("2026-07-15T12:00:00.000Z");

    expect(getTimeZoneOffsetMinutes("Europe/Warsaw", winterEpochMs)).toBe(
      getSharedTimeZoneOffsetMinutes("Europe/Warsaw", winterEpochMs),
    );
    expect(getTimeZoneOffsetMinutes("Europe/Warsaw", summerEpochMs)).toBe(
      getSharedTimeZoneOffsetMinutes("Europe/Warsaw", summerEpochMs),
    );
    expect(getTimeZoneOffsetMinutes("America/New_York", summerEpochMs)).toBe(
      getSharedTimeZoneOffsetMinutes("America/New_York", summerEpochMs),
    );
  });

  it("detects local date-style constructor arguments", () => {
    expect(isLocalDateArgs([])).toBe(false);
    expect(isLocalDateArgs([Date.now()])).toBe(false);
    expect(isLocalDateArgs(["2026-01-15"])).toBe(false);
    expect(isLocalDateArgs(["2026-01-15T12:00:00Z"])).toBe(false);
    expect(isLocalDateArgs(["2026-01-15T12:00:00"])).toBe(true);
    expect(isLocalDateArgs(["01/15/2026"])).toBe(true);
    expect(isLocalDateArgs([2026, 0, 15])).toBe(true);
  });

  it("shifts dates by the difference between native and the date-specific spoofed offset", () => {
    const epochMs = Date.parse("2026-07-15T12:00:00.000Z");
    const date = new Date(epochMs);
    const nativeOffset = Date.prototype.getTimezoneOffset.call(date);
    const spoofedOffset = getTimeZoneOffsetMinutes("Europe/Warsaw", epochMs);

    const adjusted = toAdjustedDate(date, Date, {
      language: "pl-PL",
      languages: ["pl-PL", "pl"],
      timeZone: "Europe/Warsaw",
      offsetMinutes: spoofedOffset,
    });

    expect(adjusted.getTime()).toBe(epochMs + (nativeOffset - spoofedOffset) * 60_000);
  });

  it("reuses the same offset delta for local Date constructor adjustment", () => {
    const date = new Date("2026-01-15T12:34:56");
    const nativeEpochMs = date.getTime();
    const timeLocaleState = {
      language: "pl-PL",
      languages: ["pl-PL", "pl"],
      timeZone: "Europe/Warsaw",
      offsetMinutes: getTimeZoneOffsetMinutes("Europe/Warsaw", nativeEpochMs),
    };

    const offsetDeltaMinutes = getFxOffsetDelta(
      date,
      (currentDate) => Date.prototype.getTimezoneOffset.call(currentDate),
      timeLocaleState,
    );

    adjustLocalDateCtor(
      date,
      (currentDate) => Date.prototype.getTimezoneOffset.call(currentDate),
      timeLocaleState,
    );

    expect(date.getTime()).toBe(nativeEpochMs - offsetDeltaMinutes * 60_000);
  });

  it("uses the queried date epoch instead of the bootstrap offset snapshot", () => {
    const winterEpochMs = Date.parse("2026-01-15T12:00:00.000Z");
    const summerDate = new Date("2026-07-15T12:00:00.000Z");
    const nativeOffset = Date.prototype.getTimezoneOffset.call(summerDate);
    const spoofedOffset = getTimeZoneOffsetMinutes(
      "Europe/Warsaw",
      summerDate.getTime(),
    );

    expect(
      getFxOffsetDelta(
        summerDate,
        (date) => Date.prototype.getTimezoneOffset.call(date),
        {
          language: "pl-PL",
          languages: ["pl-PL", "pl"],
          timeZone: "Europe/Warsaw",
          offsetMinutes: getTimeZoneOffsetMinutes("Europe/Warsaw", winterEpochMs),
        },
      ),
    ).toBe(nativeOffset - spoofedOffset);
  });

  it("resolves Firefox DateTimeFormat args from the current shim state", () => {
    const resolved = resolveFxDateTimeArgs(
      undefined,
      { hour: "2-digit" },
      {
        language: "pl-PL",
        languages: ["pl-PL", "pl"],
        timeZone: "Europe/Warsaw",
        offsetMinutes: -60,
      },
    );

    expect(resolved.locales).toEqual(["pl-PL", "pl"]);
    expect(resolved.options).toEqual({
      hour: "2-digit",
      timeZone: "Europe/Warsaw",
    });
  });

  it("prefers formattingLanguages over navigator languages for Firefox Intl defaults", () => {
    const resolved = resolveFxDateTimeArgs(
      undefined,
      { hour: "2-digit" },
      {
        language: "en",
        languages: ["en", "pl"],
        formattingLanguage: "pl",
        formattingLanguages: ["pl", "en-US"],
        timeZone: "Europe/Warsaw",
        offsetMinutes: -60,
      },
    );

    expect(resolved.locales).toEqual(["pl", "en-US"]);
    expect(resolved.options).toEqual({
      hour: "2-digit",
      timeZone: "Europe/Warsaw",
    });
  });

  it("preserves explicit DateTimeFormat args when Firefox shim state is absent", () => {
    const options = {
      hour: "2-digit" as const,
      timeZone: "America/New_York",
    };

    expect(resolveFxDateTimeArgs("en-US", options, null)).toEqual({
      locales: "en-US",
      options,
    });
  });
});
