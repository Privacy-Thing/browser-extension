import { getNativeDate } from "@privacy-brand/refract-core";
import { createIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { cloneRuntimeSnapshot } from "@privacy-brand/refract-core/runtime/snapshot-clone";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installDatePatch, installIntlPatch } from "@/injection/main/date-intl-patch";
import type { SpoofingSurfaceKey } from "@/shared/spoofing-surfaces";
import { getTimeZoneOffsetMinutes } from "@/shared/time-zone-offset";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

type LocaleCase = {
  language: string;
  languages: readonly string[];
  formattingLanguage?: string;
  formattingLanguages?: readonly string[];
  expectedDecimalSeparator: string;
  expectedMonthSubstring: string;
};

const ORIGINAL_DATE = globalThis.Date;
const NATIVE_INTL_CTORS = {
  DateTimeFormat: Intl.DateTimeFormat,
  NumberFormat: Intl.NumberFormat,
  Collator: Intl.Collator,
  RelativeTimeFormat: Intl.RelativeTimeFormat,
  ListFormat: "ListFormat" in Intl ? Intl.ListFormat : undefined,
  DisplayNames: "DisplayNames" in Intl ? Intl.DisplayNames : undefined,
  PluralRules: "PluralRules" in Intl ? Intl.PluralRules : undefined,
  Segmenter: "Segmenter" in Intl ? Intl.Segmenter : undefined,
} as const;

const LOCALE_CASES: readonly LocaleCase[] = [
  {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    expectedDecimalSeparator: ",",
    expectedMonthSubstring: "stycz",
  },
  {
    language: "fr-FR",
    languages: ["fr-FR", "fr"],
    expectedDecimalSeparator: ",",
    expectedMonthSubstring: "janv",
  },
] as const;

const NATIVE_DATE_DESCRIPTORS = Object.getOwnPropertyDescriptors(
  ORIGINAL_DATE.prototype,
);

const NATIVE_RESOLVED_DESCS = {
  DateTimeFormat: Object.getOwnPropertyDescriptor(
    NATIVE_INTL_CTORS.DateTimeFormat.prototype,
    "resolvedOptions",
  ),
  NumberFormat: Object.getOwnPropertyDescriptor(
    NATIVE_INTL_CTORS.NumberFormat.prototype,
    "resolvedOptions",
  ),
  Collator: Object.getOwnPropertyDescriptor(
    NATIVE_INTL_CTORS.Collator.prototype,
    "resolvedOptions",
  ),
  RelativeTimeFormat: Object.getOwnPropertyDescriptor(
    NATIVE_INTL_CTORS.RelativeTimeFormat.prototype,
    "resolvedOptions",
  ),
  ListFormat: NATIVE_INTL_CTORS.ListFormat
    ? Object.getOwnPropertyDescriptor(
        NATIVE_INTL_CTORS.ListFormat.prototype,
        "resolvedOptions",
      )
    : undefined,
  DisplayNames: NATIVE_INTL_CTORS.DisplayNames
    ? Object.getOwnPropertyDescriptor(
        NATIVE_INTL_CTORS.DisplayNames.prototype,
        "resolvedOptions",
      )
    : undefined,
  PluralRules: NATIVE_INTL_CTORS.PluralRules
    ? Object.getOwnPropertyDescriptor(
        NATIVE_INTL_CTORS.PluralRules.prototype,
        "resolvedOptions",
      )
    : undefined,
  Segmenter: NATIVE_INTL_CTORS.Segmenter
    ? Object.getOwnPropertyDescriptor(
        NATIVE_INTL_CTORS.Segmenter.prototype,
        "resolvedOptions",
      )
    : undefined,
} as const;

const NATIVE_FORMAT_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  NATIVE_INTL_CTORS.DateTimeFormat.prototype,
  "format",
);

const DATE_TIME_CASES = [
  {
    iso: "2026-01-15T12:00:00.000Z",
    timeZone: "Europe/Warsaw",
    expectedOffsetMinutes: -60,
    expectedTime: "13:00:00",
    expectedFixedGmtOffset: "GMT+0100",
    expectedTimeZoneName: "Central European Standard Time",
    expectedLocaleDateTime: "15.01.2026, 13:00:00",
  },
  {
    iso: "2026-07-31T12:00:00.000Z",
    timeZone: "Europe/Warsaw",
    expectedOffsetMinutes: -120,
    expectedTime: "14:00:00",
    expectedFixedGmtOffset: "GMT+0200",
    expectedTimeZoneName: "Central European Summer Time",
    expectedLocaleDateTime: "31.07.2026, 14:00:00",
  },
  {
    iso: "2026-01-15T12:00:00.000Z",
    timeZone: "America/New_York",
    expectedOffsetMinutes: 300,
    expectedTime: "07:00:00",
    expectedFixedGmtOffset: "GMT-0500",
    expectedTimeZoneName: "Eastern Standard Time",
    expectedLocaleDateTime: "15.01.2026, 07:00:00",
  },
  {
    iso: "2026-07-31T12:00:00.000Z",
    timeZone: "America/New_York",
    expectedOffsetMinutes: 240,
    expectedTime: "08:00:00",
    expectedFixedGmtOffset: "GMT-0400",
    expectedTimeZoneName: "Eastern Daylight Time",
    expectedLocaleDateTime: "31.07.2026, 08:00:00",
  },
] as const;

const restoreConstructor = <T extends keyof typeof NATIVE_INTL_CTORS>(key: T): void => {
  const ctor = NATIVE_INTL_CTORS[key];
  if (!ctor) {
    return;
  }

  Object.defineProperty(Intl, key, {
    configurable: true,
    value: ctor,
  });

  const descriptor = NATIVE_RESOLVED_DESCS[key];
  if (descriptor) {
    Object.defineProperty(ctor.prototype, "resolvedOptions", descriptor);
  }

  if (key === "DateTimeFormat" && NATIVE_FORMAT_DESCRIPTOR) {
    Object.defineProperty(ctor.prototype, "format", NATIVE_FORMAT_DESCRIPTOR);
  }
};

const restoreEnvironment = (): void => {
  Object.defineProperty(globalThis, "Date", {
    configurable: true,
    value: ORIGINAL_DATE,
  });

  for (const [key, descriptor] of Object.entries(NATIVE_DATE_DESCRIPTORS)) {
    if (descriptor) {
      Object.defineProperty(ORIGINAL_DATE.prototype, key, descriptor);
    }
  }

  restoreConstructor("DateTimeFormat");
  restoreConstructor("NumberFormat");
  restoreConstructor("Collator");
  restoreConstructor("RelativeTimeFormat");
  restoreConstructor("ListFormat");
  restoreConstructor("DisplayNames");
  restoreConstructor("PluralRules");
  restoreConstructor("Segmenter");
};

const buildSnapshot = (
  timeZone = "Europe/Warsaw",
  iso = "2026-01-15T12:00:00.000Z",
  locale: LocaleCase = LOCALE_CASES[0]!,
): RuntimeSnapshot => {
  const baseEpochMs = ORIGINAL_DATE.parse(iso);
  const localOffsetMinutes = new ORIGINAL_DATE(baseEpochMs).getTimezoneOffset();
  const targetOffsetMinutes = getTimeZoneOffsetMinutes(timeZone, baseEpochMs);

  return {
    geo: {
      latitude: 52.2297,
      longitude: 21.0122,
      accuracy: 25,
      noiseRadius: 50,
    },
    locale: {
      language: locale.language,
      languages: [...locale.languages],
      timeZone,
      acceptLanguage: locale.languages.join(","),
      formattingLanguage: locale.formattingLanguage ?? locale.language,
      formattingLanguages: [...(locale.formattingLanguages ?? locale.languages)],
    },
    date: {
      baseEpochMs,
      offsetMs: (localOffsetMinutes - targetOffsetMinutes) * 60_000,
      timeZone,
    },
    debugMode: false,
    watchPositionDelay: [60, 500],
  };
};

describe("Date and Intl runtime patching", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnvironment();
  });

  it("installs Intl defaults from a private runtime snapshot", () => {
    const snapshot = cloneRuntimeSnapshot(buildSnapshot("Europe/London"));

    installIntlPatch(snapshot);

    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Europe/London");
  });

  it("keeps Date.now on the native monotonic epoch", () => {
    const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
    vi.spyOn(ORIGINAL_DATE, "now")
      .mockReturnValueOnce(snapshot.date.baseEpochMs)
      .mockReturnValueOnce(snapshot.date.baseEpochMs + 1)
      .mockReturnValueOnce(snapshot.date.baseEpochMs + 25);

    installDatePatch(snapshot);

    expect(Date.now()).toBe(snapshot.date.baseEpochMs);
    expect(Date.now()).toBe(snapshot.date.baseEpochMs + 1);
    expect(Date.now()).toBe(snapshot.date.baseEpochMs + 25);
  });

  it("keeps performance time origin aligned with spoofed Date.now", () => {
    const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
    installDatePatch(snapshot);

    const epochFromPerformance = performance.timeOrigin + performance.now();
    expect(Math.abs(Date.now() - epochFromPerformance)).toBeLessThan(50);
  });

  it("preserves server timestamp arithmetic when the target timezone differs from the host", () => {
    const snapshot = buildSnapshot("America/Toronto", "2026-07-15T02:50:59.000Z");
    vi.spyOn(ORIGINAL_DATE, "now").mockReturnValue(snapshot.date.baseEpochMs);
    installDatePatch(snapshot);

    const liveSince = ORIGINAL_DATE.parse("2026-07-15T01:30:23.000Z");
    const elapsedSeconds = Math.floor((Date.now() - liveSince) / 1000);

    expect(Date.now()).toBe(snapshot.date.baseEpochMs);
    expect(new Date().getTime()).toBe(snapshot.date.baseEpochMs);
    expect(elapsedSeconds).toBe(4_836);
    expect(elapsedSeconds).toBeGreaterThanOrEqual(0);
  });

  it("applies compatible DST disambiguation to local constructors and setters", () => {
    const snapshot = buildSnapshot("America/Toronto", "2026-03-08T06:30:00.000Z");
    installDatePatch(snapshot);

    const gapConstructor = new Date(2026, 2, 8, 2, 30);
    expect(gapConstructor.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(gapConstructor.getHours()).toBe(3);
    expect(gapConstructor.getMinutes()).toBe(30);

    const gapSetter = new Date("2026-03-08T06:30:00.000Z");
    gapSetter.setHours(2, 30, 0, 0);
    expect(gapSetter.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(gapSetter.getHours()).toBe(3);

    const overlapConstructor = new Date(2026, 10, 1, 1, 30);
    expect(overlapConstructor.toISOString()).toBe("2026-11-01T05:30:00.000Z");
    expect(overlapConstructor.getTimezoneOffset()).toBe(240);
  });

  it("implements the complete local getter and setter family in the profile timezone", () => {
    const snapshot = buildSnapshot("America/Toronto", "2026-01-15T12:00:00.000Z");
    installDatePatch(snapshot);

    const date = new Date(2026, 0, 31, 12, 34, 56, 789);
    expect(date.toISOString()).toBe("2026-01-31T17:34:56.789Z");
    const legacyDate = date as Date & {
      getYear(): number;
      setYear(year: number): number;
    };
    expect(legacyDate.getYear()).toBe(126);

    expect(date.setMonth(1)).toBe(ORIGINAL_DATE.parse("2026-03-03T17:34:56.789Z"));
    expect(date.setDate(15)).toBe(ORIGINAL_DATE.parse("2026-03-15T16:34:56.789Z"));
    expect(date.setMinutes(5, 6, 7)).toBe(
      ORIGINAL_DATE.parse("2026-03-15T16:05:06.007Z"),
    );
    expect(date.setSeconds(45, 123)).toBe(
      ORIGINAL_DATE.parse("2026-03-15T16:05:45.123Z"),
    );
    expect(date.setMilliseconds(456)).toBe(
      ORIGINAL_DATE.parse("2026-03-15T16:05:45.456Z"),
    );
    expect(date.setFullYear(2027, 6, 4)).toBe(
      ORIGINAL_DATE.parse("2027-07-04T16:05:45.456Z"),
    );
    expect(legacyDate.setYear(99)).toBe(
      ORIGINAL_DATE.parse("1999-07-04T16:05:45.456Z"),
    );
    expect(date.getFullYear()).toBe(1999);
    expect(legacyDate.getYear()).toBe(99);

    const recoverable = new Date(Number.NaN);
    expect(recoverable.setFullYear(2026, 0, 15)).toBe(
      ORIGINAL_DATE.parse("2026-01-15T05:00:00.000Z"),
    );
    const invalid = new Date(Number.NaN);
    expect(invalid.setMonth(1)).toBeNaN();
    expect(invalid.getTime()).toBeNaN();
  });

  it("keeps explicit epochs absolute while local Date.parse follows the profile timezone", () => {
    const snapshot = buildSnapshot("Asia/Kathmandu", "2026-01-15T12:00:00.000Z");
    installDatePatch(snapshot);
    installIntlPatch(snapshot);

    const epoch = ORIGINAL_DATE.parse("2026-01-15T12:00:00.000Z");
    expect(new Date(epoch).getTime()).toBe(epoch);
    expect(new Date("2026-01-15T12:00:00.000Z").getTime()).toBe(epoch);
    expect(Date.parse("2026-01-15T12:00:00")).toBe(
      ORIGINAL_DATE.parse("2026-01-15T06:15:00.000Z"),
    );
    expect(new Intl.DateTimeFormat("en-GB").format(epoch)).toBe(
      new NATIVE_INTL_CTORS.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kathmandu",
      }).format(epoch),
    );
  });

  it("applies the profile timezone after Date constructor and parse coercion", () => {
    const snapshot = buildSnapshot("America/Toronto", "2026-01-15T12:00:00.000Z");
    installDatePatch(snapshot);

    const localStringObject = {
      [Symbol.toPrimitive]: vi.fn(() => "2026-01-15T12:00:00"),
    };
    const numericObject = {
      valueOf: vi.fn(() => snapshot.date.baseEpochMs),
      toString: vi.fn(() => "2026-01-15T12:00:00"),
    };

    expect(new Date(localStringObject as unknown as string).toISOString()).toBe(
      "2026-01-15T17:00:00.000Z",
    );
    expect(localStringObject[Symbol.toPrimitive]).toHaveBeenCalledOnce();
    expect(new Date(numericObject as unknown as number).getTime()).toBe(
      snapshot.date.baseEpochMs,
    );
    expect(numericObject.valueOf).toHaveBeenCalledOnce();
    expect(numericObject.toString).not.toHaveBeenCalled();

    const parseObject = { toString: vi.fn(() => "2026-01-15T12:00:00") };
    expect(Date.parse(parseObject as unknown as string)).toBe(
      ORIGINAL_DATE.parse("2026-01-15T17:00:00.000Z"),
    );
    expect(parseObject.toString).toHaveBeenCalledOnce();
  });

  it("keeps Intl DateTimeFormat timezone and formatting stable across repeated reads", () => {
    const snapshot = buildSnapshot("America/New_York", "2026-07-31T12:00:00.000Z");
    installDatePatch(snapshot);
    installIntlPatch(snapshot);

    const formatter = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    });
    const timestamp = ORIGINAL_DATE.parse("2026-07-31T12:00:00.000Z");
    const results = Array.from({ length: 10 }, () => ({
      timeZone: formatter.resolvedOptions().timeZone,
      formatted: formatter.format(new ORIGINAL_DATE(timestamp)),
    }));

    expect(new Set(results.map((result) => result.timeZone))).toEqual(
      new Set(["America/New_York"]),
    );
    expect(new Set(results.map((result) => result.formatted)).size).toBe(1);
  });

  it.each(DATE_TIME_CASES)(
    "spoofs Date constructor, statics, timezone offset and string methods coherently for $timeZone at $iso",
    ({
      iso,
      timeZone,
      expectedOffsetMinutes,
      expectedTime,
      expectedFixedGmtOffset,
      expectedTimeZoneName,
      expectedLocaleDateTime,
    }) => {
      const snapshot = buildSnapshot(timeZone, iso);
      vi.spyOn(ORIGINAL_DATE, "now").mockReturnValue(snapshot.date.baseEpochMs);

      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const spoofedNow = new Date();
      const explicitUtc = new Date(iso);
      const explicitOffsetMinutes = getTimeZoneOffsetMinutes(
        snapshot.locale.timeZone,
        snapshot.date.baseEpochMs,
      );
      const expectedNowOffsetMinutes = getTimeZoneOffsetMinutes(
        timeZone,
        snapshot.date.baseEpochMs,
      );
      const expectedNow = snapshot.date.baseEpochMs;
      const expectedNowGmtOffset = `GMT${expectedNowOffsetMinutes > 0 ? "-" : "+"}${Math.floor(
        Math.abs(expectedNowOffsetMinutes) / 60,
      )
        .toString()
        .padStart(2, "0")}${(Math.abs(expectedNowOffsetMinutes) % 60)
        .toString()
        .padStart(2, "0")}`;
      const expectedNowTimeZoneName =
        new NATIVE_INTL_CTORS.DateTimeFormat("en-US", {
          timeZone,
          timeZoneName: "long",
        })
          .formatToParts(new ORIGINAL_DATE(snapshot.date.baseEpochMs))
          .find((part) => part.type === "timeZoneName")?.value ?? timeZone;

      expect(Date.now()).toBe(expectedNow);
      expect(+spoofedNow).toBe(expectedNow);
      expect(Date.prototype.constructor).toBe(Date);
      expect(Date.parse(iso)).toBe(ORIGINAL_DATE.parse(iso));
      expect(Date.parse("02/31/2026")).toBe(new Date(2026, 1, 31).getTime());
      expect(Date.UTC(2026, 0, 15, 12, 0, 0)).toBe(
        ORIGINAL_DATE.UTC(2026, 0, 15, 12, 0, 0),
      );
      const dateCallValue = Date();
      expect(typeof dateCallValue).toBe("string");
      expect(dateCallValue).toContain(expectedNowGmtOffset);
      expect(dateCallValue).toContain(expectedNowTimeZoneName);

      expect(spoofedNow.getTimezoneOffset()).toBe(expectedNowOffsetMinutes);
      expect(explicitUtc.getTimezoneOffset()).toBe(explicitOffsetMinutes);
      expect(explicitUtc.toDateString()).toBe(
        new NATIVE_INTL_CTORS.DateTimeFormat("en-US", {
          timeZone,
          weekday: "short",
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
          .formatToParts(new ORIGINAL_DATE(iso))
          .reduce((accumulator, part) => {
            if (part.type === "literal") {
              return accumulator;
            }

            if (part.type === "day") {
              return [...accumulator, part.value];
            }

            return [...accumulator, part.value];
          }, [] as string[])
          .join(" "),
      );
      expect(explicitUtc.toTimeString()).toContain(
        `${expectedTime} ${expectedFixedGmtOffset}`,
      );
      expect(explicitUtc.toString()).toContain(
        `${expectedTime} ${expectedFixedGmtOffset} (${expectedTimeZoneName})`,
      );
      expect(explicitUtc.toLocaleString()).toBe(expectedLocaleDateTime);
      expect(explicitUtc.toLocaleDateString()).toBe(
        expectedLocaleDateTime.split(",")[0],
      );
      expect(explicitUtc.toLocaleTimeString()).toBe(expectedTime);
      expect(new Date(Number.NaN).toString()).toBe("Invalid Date");
      expect(explicitOffsetMinutes).toBe(expectedOffsetMinutes);
    },
  );

  it("keeps the creepjs timezone offset probe coherent for spoofed local date strings", () => {
    const snapshot = buildSnapshot("America/Los_Angeles", "2026-07-15T12:00:00.000Z", {
      language: "en-US",
      languages: ["en-US", "en"],
      expectedDecimalSeparator: ".",
      expectedMonthSubstring: "Jan",
    });

    installDatePatch(snapshot);
    installIntlPatch(snapshot);

    const computeTimezoneOffset = (dateValue: Date): number => {
      const date = dateValue.getDate();
      const month = dateValue.getMonth();
      const year = dateValue.toString().split(" ")[3];
      const format = (value: number): string =>
        `${value}`.length === 1 ? `0${value}` : `${value}`;
      const dateString = `${month + 1}/${format(date)}/${year}`;
      const dateStringUTC = `${year}-${format(month + 1)}-${format(date)}`;
      const utc = Date.parse(String(new Date(dateString)));
      const now = +new Date(dateStringUTC);
      return Number(((utc - now) / 60000).toFixed(0));
    };

    expect(computeTimezoneOffset(new Date("2026-07-15T12:00:00.000Z"))).toBe(420);
  });

  it.each(
    DATE_TIME_CASES.flatMap((dateCase) =>
      LOCALE_CASES.map((localeCase) => ({
        ...dateCase,
        ...localeCase,
      })),
    ),
  )(
    "spoofs Intl.DateTimeFormat defaults while preserving Date epochs for $language in $timeZone at $iso",
    ({
      iso,
      timeZone,
      language,
      languages,
      expectedDecimalSeparator,
      expectedMonthSubstring,
    }) => {
      const snapshot = buildSnapshot(timeZone, iso, {
        language,
        languages,
        expectedDecimalSeparator,
        expectedMonthSubstring,
      });

      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      vi.spyOn(ORIGINAL_DATE, "now").mockReturnValue(snapshot.date.baseEpochMs);
      const currentDate = new Date();
      const formatter = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(currentDate);
      const formatted = formatter.format(currentDate);
      const expected = new NATIVE_INTL_CTORS.DateTimeFormat(language, {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new ORIGINAL_DATE(+currentDate));

      expect(formatter.resolvedOptions().locale).toBe(language);
      expect(formatter.resolvedOptions().timeZone).toBe(timeZone);
      expect(formatted).toBe(expected);
      expect(parts.some((part) => part.type === "hour")).toBe(true);

      const rangeFormatter = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const start = new Date();
      const end = new Date(Date.now() + 3_600_000);
      const renderedRange = rangeFormatter.formatRange(start, end);
      const renderedRangeParts = rangeFormatter.formatRangeToParts(start, end);

      expect(typeof renderedRange).toBe("string");
      expect(renderedRange.length).toBeGreaterThan(0);
      expect(renderedRangeParts.some((part) => part.type === "hour")).toBe(true);

      const explicitZoneFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      expect(explicitZoneFormatter.resolvedOptions().timeZone).toBe("America/New_York");
      expect(explicitZoneFormatter.format(new ORIGINAL_DATE(iso))).toBe(
        new NATIVE_INTL_CTORS.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new ORIGINAL_DATE(iso)),
      );
      expect(
        new Intl.DateTimeFormat(undefined, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date(iso)),
      ).toBe(
        new NATIVE_INTL_CTORS.DateTimeFormat(language, {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new ORIGINAL_DATE(iso)),
      );

      const numberFormat = new Intl.NumberFormat();
      const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
        month: "long",
        timeZoneName: "short",
      });
      const pluralRules = new Intl.PluralRules();

      expect(numberFormat.resolvedOptions().locale).toBe(language);
      expect(pluralRules.resolvedOptions().locale).toBe(language);
      expect(
        numberFormat.formatToParts(1234.5).find((part) => part.type === "decimal")
          ?.value,
      ).toBe(expectedDecimalSeparator);
      expect(
        dateTimeFormat
          .formatToParts(new Date("2026-01-15T12:00:00.000Z"))
          .find((part) => part.type === "month")
          ?.value.toLowerCase(),
      ).toContain(expectedMonthSubstring);
    },
  );

  it.each(LOCALE_CASES)(
    "spoofs locale defaults across the patched Intl constructors for $language",
    ({ language, languages }) => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z", {
        language,
        languages,
        expectedDecimalSeparator: ",",
        expectedMonthSubstring: "stycz",
      });

      installIntlPatch(snapshot);

      expect(new Intl.NumberFormat().resolvedOptions().locale).toBe(language);
      expect(new Intl.Collator().resolvedOptions().locale).toBe(language);
      expect(new Intl.RelativeTimeFormat().resolvedOptions().locale).toBe(language);

      if ("PluralRules" in Intl) {
        expect(new Intl.PluralRules().resolvedOptions().locale).toBe(language);
      }

      if ("ListFormat" in Intl) {
        expect(new Intl.ListFormat().resolvedOptions().locale).toBe(language);
      }

      if ("DisplayNames" in Intl) {
        expect(
          new Intl.DisplayNames(undefined, { type: "region" }).resolvedOptions().locale,
        ).toBe(language);
      }

      if ("Segmenter" in Intl) {
        expect(new Intl.Segmenter().resolvedOptions().locale).toBe(language);
      }
    },
  );

  it("keeps regional Intl defaults when navigator surfaces prefer bare English", () => {
    const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z", {
      language: "en",
      languages: ["en", "pl"],
      formattingLanguage: "pl",
      formattingLanguages: ["pl", "en-US"],
      expectedDecimalSeparator: ",",
      expectedMonthSubstring: "stycz",
    });

    installDatePatch(snapshot);
    installIntlPatch(snapshot);

    const formatter = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    expect(formatter.resolvedOptions().locale).toBe("pl");
    expect(formatter.resolvedOptions().timeZone).toBe("Europe/Warsaw");
    expect(formatter.format(new Date("2026-01-15T12:00:00.000Z"))).toBe(
      new NATIVE_INTL_CTORS.DateTimeFormat("pl", {
        timeZone: "Europe/Warsaw",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new ORIGINAL_DATE("2026-01-15T12:00:00.000Z")),
    );
    expect(new Intl.NumberFormat().resolvedOptions().locale).toBe("pl");
  });

  describe("Date & Intl deterministic leaks", () => {
    it("toLocaleString respects caller-provided locale", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-01-15T12:00:00.000Z");
      const result = date.toLocaleString("en-US");
      const expected = new NATIVE_INTL_CTORS.DateTimeFormat("en-US", {
        timeZone: "Europe/Warsaw",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      }).format(new ORIGINAL_DATE("2026-01-15T12:00:00.000Z"));

      expect(result).toBe(expected);
    });

    it("toLocaleString respects caller-provided options including timeZone", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-01-15T12:00:00.000Z");
      const result = date.toLocaleString("en-US", {
        timeZone: "UTC",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
      const expected = new NATIVE_INTL_CTORS.DateTimeFormat("en-US", {
        timeZone: "UTC",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(new ORIGINAL_DATE("2026-01-15T12:00:00.000Z"));

      expect(result).toBe(expected);
    });

    it("toLocaleDateString respects caller-provided locale", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-01-15T12:00:00.000Z");
      const result = date.toLocaleDateString("de-DE");
      const expected = new NATIVE_INTL_CTORS.DateTimeFormat("de-DE", {
        timeZone: "Europe/Warsaw",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(new ORIGINAL_DATE("2026-01-15T12:00:00.000Z"));

      expect(result).toBe(expected);
    });

    it("toLocaleTimeString respects caller-provided locale and options", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-01-15T12:00:00.000Z");
      const result = date.toLocaleTimeString("en-US", { hour12: true });
      // en-US with hour12:true should produce AM/PM format
      expect(result).toMatch(/AM|PM/);
    });

    it("toLocaleTimeString preserves timeStyle-only options", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-01-15T12:00:00.000Z");
      const result = date.toLocaleTimeString("en-US", { timeStyle: "short" });
      const expected = new ORIGINAL_DATE("2026-01-15T12:00:00.000Z").toLocaleTimeString(
        "en-US",
        {
          timeZone: "Europe/Warsaw",
          timeStyle: "short",
        },
      );

      expect(result).toBe(expected);
    });

    it("toLocaleString with no arguments uses snapshot locale (default behavior)", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-01-15T12:00:00.000Z");
      const result = date.toLocaleString();
      const expected = new NATIVE_INTL_CTORS.DateTimeFormat("pl-PL", {
        timeZone: "Europe/Warsaw",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      }).format(new ORIGINAL_DATE("2026-01-15T12:00:00.000Z"));

      expect(result).toBe(expected);
    });

    it("toLocaleString preserves default date and time fields when options omit components", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-01-15T12:00:00.000Z");
      const result = date.toLocaleString("en-US", {
        timeZone: "UTC",
        hour12: true,
      });
      const expected = new ORIGINAL_DATE("2026-01-15T12:00:00.000Z").toLocaleString(
        "en-US",
        {
          timeZone: "UTC",
          hour12: true,
        },
      );

      expect(result).toBe(expected);
    });

    it("Intl.DateTimeFormat resolvedOptions returns caller-provided locale", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installIntlPatch(snapshot);

      const fmt = new Intl.DateTimeFormat("fr-FR");
      expect(fmt.resolvedOptions().locale).toBe("fr-FR");
    });

    it("Intl.DateTimeFormat resolvedOptions returns snapshot locale when no locale given", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installIntlPatch(snapshot);

      const fmt = new Intl.DateTimeFormat(undefined);
      expect(fmt.resolvedOptions().locale).toBe("pl-PL");
    });

    it("Intl.DateTimeFormat resolvedOptions returns caller-provided timeZone", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installIntlPatch(snapshot);

      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York" });
      expect(fmt.resolvedOptions().timeZone).toBe("America/New_York");
    });

    it("forwards Date.now debug logging without formatting the page console", () => {
      const postMessage = vi.fn();
      vi.stubGlobal("postMessage", postMessage);
      const snapshot = {
        ...buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z"),
        debugMode: true,
        logEventName: "debug-event",
      };
      const expectedNow = snapshot.date.baseEpochMs;
      vi.spyOn(ORIGINAL_DATE, "now").mockReturnValue(snapshot.date.baseEpochMs);
      const info = vi.spyOn(console, "info").mockImplementation(() => {});

      installDatePatch(snapshot);

      expect(Date.now()).toBe(expectedNow);
      expect(info).not.toHaveBeenCalled();
      expect(postMessage).toHaveBeenCalledTimes(1);
    });

    it("emits debug-only helper decision logs for Intl constructors and resolvedOptions", () => {
      const postMessage = vi.fn();
      vi.stubGlobal("postMessage", postMessage);
      vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "trace").mockImplementation(() => {});
      vi.spyOn(console, "groupEnd").mockImplementation(() => {});
      const snapshot = {
        ...buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z"),
        debugMode: true,
        logEventName: "debug-event",
      };

      installIntlPatch(snapshot);

      const fmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit" });
      fmt.resolvedOptions();
      const secondFormatter = new Intl.DateTimeFormat(undefined, {
        minute: "2-digit",
      });
      secondFormatter.resolvedOptions();

      const details = postMessage.mock.calls
        .map((call) => call[0]?.detail)
        .filter((detail): detail is string => typeof detail === "string")
        .map(
          (detail) =>
            JSON.parse(detail) as {
              component: string;
              method: string;
              result: unknown;
            },
        );

      expect(
        details.some(
          (detail) =>
            detail.component === "Intl" &&
            detail.method === "DateTimeFormat.defaults" &&
            typeof detail.result === "object" &&
            detail.result !== null &&
            "localeWasDefaulted" in detail.result &&
            detail.result.localeWasDefaulted === true &&
            "timeZoneWasDefaulted" in detail.result &&
            detail.result.timeZoneWasDefaulted === true,
        ),
      ).toBe(true);
      expect(
        details.filter(
          (detail) => detail.component === "Intl" && detail.method === "DateTimeFormat",
        ),
      ).toHaveLength(1);
      expect(
        details.filter(
          (detail) =>
            detail.component === "Intl" &&
            detail.method === "DateTimeFormat.resolvedOptions",
        ),
      ).toHaveLength(1);
      expect(
        details.some(
          (detail) =>
            detail.component === "Intl" &&
            detail.method === "DateTimeFormat" &&
            detail.result === "Constructor Init",
        ),
      ).toBe(true);
      expect(
        details.some(
          (detail) =>
            detail.component === "Intl" &&
            detail.method === "DateTimeFormat.resolvedOptions" &&
            typeof detail.result === "object" &&
            detail.result !== null &&
            "locale" in detail.result &&
            detail.result.locale === "pl-PL" &&
            "timeZone" in detail.result &&
            detail.result.timeZone === "Europe/Warsaw",
        ),
      ).toBe(true);
    });
  });

  describe("Date native getters in spoofed timezone", () => {
    it("getHours returns the hour in the spoofed timezone", () => {
      // Asia/Tokyo is UTC+9, so noon UTC = 21:00 Tokyo
      const snapshot = buildSnapshot("Asia/Tokyo", "2026-07-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-07-15T12:00:00.000Z");
      const expectedHour = Number(
        new NATIVE_INTL_CTORS.DateTimeFormat("en-US", {
          timeZone: "Asia/Tokyo",
          hour: "numeric",
          hour12: false,
        })
          .formatToParts(new ORIGINAL_DATE("2026-07-15T12:00:00.000Z"))
          .find((p) => p.type === "hour")?.value,
      );

      expect(date.getHours()).toBe(expectedHour);
    });

    it("getFullYear, getMonth, getDate, getDay return values in the spoofed timezone", () => {
      // Pacific/Auckland UTC+13 in NZDT: Dec 31 23:30 UTC = Jan 1 12:30 next day
      const snapshot = buildSnapshot("Pacific/Auckland", "2026-12-31T23:30:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-12-31T23:30:00.000Z");
      const parts = new NATIVE_INTL_CTORS.DateTimeFormat("en-US", {
        timeZone: "Pacific/Auckland",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        weekday: "short",
      }).formatToParts(new ORIGINAL_DATE("2026-12-31T23:30:00.000Z"));

      const expectedYear = Number(parts.find((p) => p.type === "year")?.value);
      const expectedMonth = Number(parts.find((p) => p.type === "month")?.value) - 1; // 0-indexed
      const expectedDate = Number(parts.find((p) => p.type === "day")?.value);

      expect(date.getFullYear()).toBe(expectedYear);
      expect(date.getMonth()).toBe(expectedMonth);
      expect(date.getDate()).toBe(expectedDate);
    });

    it("getMinutes returns correct value in half-hour offset timezone", () => {
      // Asia/Kolkata is UTC+5:30, so noon UTC = 17:30 IST
      const snapshot = buildSnapshot("Asia/Kolkata", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-01-15T12:00:00.000Z");
      const parts = new NATIVE_INTL_CTORS.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).formatToParts(new ORIGINAL_DATE("2026-01-15T12:00:00.000Z"));

      const expectedHour = Number(parts.find((p) => p.type === "hour")?.value);
      const expectedMinute = Number(parts.find((p) => p.type === "minute")?.value);

      expect(date.getHours()).toBe(expectedHour);
      expect(date.getMinutes()).toBe(expectedMinute);
    });

    it("getSeconds and getMilliseconds are unaffected by timezone shift", () => {
      const snapshot = buildSnapshot("Asia/Tokyo", "2026-01-15T12:00:45.123Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-01-15T12:00:45.123Z");
      // Seconds and milliseconds are timezone-independent
      expect(date.getSeconds()).toBe(45);
      expect(date.getMilliseconds()).toBe(123);
    });

    it("getter results are coherent with toString output", () => {
      const snapshot = buildSnapshot("Asia/Tokyo", "2026-07-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-07-15T12:00:00.000Z");
      const str = date.toString();
      // Extract HH:MM from toString (format: "... HH:MM:SS GMT...")
      const timeMatch = str.match(/(\d{2}):(\d{2}):\d{2}/);
      expect(timeMatch).not.toBeNull();

      const toStringHour = Number(timeMatch![1]);
      const toStringMinute = Number(timeMatch![2]);

      expect(date.getHours()).toBe(toStringHour);
      expect(date.getMinutes()).toBe(toStringMinute);
    });
  });

  describe("Date & Intl non-deterministic leaks", () => {
    it("Date.prototype.toString still works after globalThis.Intl.DateTimeFormat is replaced", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      // Simulate a malicious page replacing Intl.DateTimeFormat
      const savedDTF = Intl.DateTimeFormat;
      Object.defineProperty(Intl, "DateTimeFormat", {
        configurable: true,
        value: function () {
          throw new Error("hijacked");
        },
      });

      try {
        const result = new Date().toString();
        expect(result).toContain("GMT");
        expect(result).not.toBe("Invalid Date");
      } finally {
        Object.defineProperty(Intl, "DateTimeFormat", {
          configurable: true,
          value: savedDTF,
        });
      }
    });

    it("Date.prototype.toString survives Intl.DateTimeFormat wrapped in a Proxy", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      // Wrap DTF in a transparent monitoring Proxy (as a detection script might)
      const savedDTF = Intl.DateTimeFormat;
      const ProxiedDTF = new Proxy(savedDTF, {
        construct(target, args) {
          return Reflect.construct(target, args);
        },
        apply(target, thisArg, args) {
          return Reflect.apply(target, thisArg, args);
        },
      });
      Object.defineProperty(Intl, "DateTimeFormat", {
        configurable: true,
        value: ProxiedDTF,
      });

      try {
        const result = new Date().toString();
        expect(result).toContain("GMT");
        expect(result).not.toBe("Invalid Date");
      } finally {
        Object.defineProperty(Intl, "DateTimeFormat", {
          configurable: true,
          value: savedDTF,
        });
      }
    });

    it("prototype format getter does not produce double-shifted times", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const fmt = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });

      const date = new Date("2026-01-15T12:00:00.000Z");

      // Normal instance call
      const instanceResult = fmt.format(date);

      // Bypass via prototype descriptor (as a detection script would)
      const protoDescriptor = Object.getOwnPropertyDescriptor(
        Intl.DateTimeFormat.prototype,
        "format",
      );
      if (protoDescriptor?.get) {
        const nativeFormat = protoDescriptor.get.call(fmt);
        const protoResult = nativeFormat(date);

        // Both paths must produce the same result (no double-shifting)
        expect(protoResult).toBe(instanceResult);
      }
    });

    it("prototype format getter does not double-shift Date instances created without arguments", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const fmt = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const shiftedDate = new Date();
      const instanceResult = fmt.format(shiftedDate);
      const protoDescriptor = Object.getOwnPropertyDescriptor(
        Intl.DateTimeFormat.prototype,
        "format",
      );

      expect(protoDescriptor?.get).toBeTypeOf("function");
      const protoFormat = protoDescriptor!.get!.call(fmt);
      expect(protoFormat(shiftedDate)).toBe(instanceResult);
      expect(protoDescriptor!.get!.call(fmt)).toBe(protoFormat);
    });

    it("instance and prototype format paths do not double-normalize numeric timestamps", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const fmt = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const timestamp = Date.now();
      const expected = new NATIVE_INTL_CTORS.DateTimeFormat("pl-PL", {
        timeZone: "Europe/Warsaw",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).format(new ORIGINAL_DATE(timestamp));
      const protoDescriptor = Object.getOwnPropertyDescriptor(
        Intl.DateTimeFormat.prototype,
        "format",
      );

      expect(fmt.format(timestamp)).toBe(expected);
      expect(protoDescriptor?.get?.call(fmt)(timestamp)).toBe(expected);
    });

    it("instance format and prototype-extracted format produce the same result", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const fmt = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });

      const date = new Date("2026-01-15T12:00:00.000Z");

      // Direct call
      const directResult = fmt.format(date);

      // Extract via own property descriptor on the instance
      const ownDescriptor = Object.getOwnPropertyDescriptor(fmt, "format");
      if (ownDescriptor) {
        const extractedFormat =
          typeof ownDescriptor.get === "function"
            ? ownDescriptor.get.call(fmt)
            : ownDescriptor.value;
        const extractedResult =
          typeof extractedFormat === "function" ? extractedFormat(date) : undefined;

        expect(extractedResult).toBe(directResult);
      }

      // Also verify via prototype
      const protoDescriptor = Object.getOwnPropertyDescriptor(
        Intl.DateTimeFormat.prototype,
        "format",
      );
      if (protoDescriptor?.get) {
        const protoFormat = protoDescriptor.get.call(fmt);
        const protoResult = protoFormat(date);
        expect(protoResult).toBe(directResult);
      }
    });
  });

  describe("Date hot-path high-volume hardening", () => {
    it("forwards Date.now once without console formatting across 1000 hot-loop calls", () => {
      const postMessage = vi.fn();
      vi.stubGlobal("postMessage", postMessage);
      const info = vi.spyOn(console, "info").mockImplementation(() => {});
      const snapshot = {
        ...buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z"),
        debugMode: true,
        logEventName: "debug-event",
      };
      const expectedNow = snapshot.date.baseEpochMs;
      vi.spyOn(ORIGINAL_DATE, "now").mockReturnValue(snapshot.date.baseEpochMs);

      installDatePatch(snapshot);

      for (let call = 0; call < 1000; call += 1) {
        expect(Date.now()).toBe(expectedNow);
      }

      // Per-call work stays correct, while the debug event is forwarded once
      // without paying for page-console object formatting.
      expect(info).not.toHaveBeenCalled();
      expect(postMessage).toHaveBeenCalledTimes(1);
    });

    it("does not touch the debug channel at all when debugMode is off, even under load", () => {
      const postMessage = vi.fn();
      vi.stubGlobal("postMessage", postMessage);
      const info = vi.spyOn(console, "info").mockImplementation(() => {});
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      vi.spyOn(ORIGINAL_DATE, "now").mockReturnValue(snapshot.date.baseEpochMs);

      installDatePatch(snapshot);

      for (let call = 0; call < 1000; call += 1) {
        Date.now();
        new Date().getFullYear();
        new Date().getTimezoneOffset();
      }

      expect(info).not.toHaveBeenCalled();
      expect(postMessage).not.toHaveBeenCalled();
    });

    it("keeps 1000 repeated toLocaleString reads stable and correct via the formatter cache", () => {
      const snapshot = buildSnapshot("Europe/Warsaw", "2026-01-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-01-15T12:00:00.000Z");
      const expected = new NATIVE_INTL_CTORS.DateTimeFormat("pl-PL", {
        timeZone: "Europe/Warsaw",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      }).format(new ORIGINAL_DATE("2026-01-15T12:00:00.000Z"));

      for (let call = 0; call < 1000; call += 1) {
        expect(date.toLocaleString()).toBe(expected);
      }
    });

    it("keeps 1000 repeated numeric getter reads coherent across mixed methods", () => {
      const snapshot = buildSnapshot("Asia/Tokyo", "2026-07-15T12:00:00.000Z");
      installDatePatch(snapshot);
      installIntlPatch(snapshot);

      const date = new Date("2026-07-15T12:00:00.000Z");
      const expectedHour = date.getHours();
      const expectedYear = date.getFullYear();
      const expectedMonth = date.getMonth();

      for (let call = 0; call < 1000; call += 1) {
        expect(date.getHours()).toBe(expectedHour);
        expect(date.getFullYear()).toBe(expectedYear);
        expect(date.getMonth()).toBe(expectedMonth);
      }
    });
  });

  it("does not expose a product-specific native Date marker on window", () => {
    const snapshot = buildSnapshot();

    installDatePatch(snapshot);

    expect("__PT_NATIVE_DATE__" in globalThis).toBe(false);
    expect(
      Object.getOwnPropertyDescriptor(globalThis, "__PT_NATIVE_DATE__"),
    ).toBeUndefined();
    expect(Reflect.ownKeys(globalThis)).not.toContain("__PT_NATIVE_DATE__");
    // Guard against reintroducing the earlier Date-constructor state cache.
    expect(Object.getOwnPropertyNames(Date)).not.toContain("__native_state__");

    const shiftedDate = new Date();
    expect(
      Object.getOwnPropertySymbols(shiftedDate).some((symbol) => {
        const key = Symbol.keyFor(symbol) ?? "";
        return (
          key === "shifted-date" || key.includes("pt") || key.includes("date-shift")
        );
      }),
    ).toBe(false);
  });

  it("ignores a forged Date.prototype.constructor when recovering the native Date", () => {
    installDatePatch(buildSnapshot());

    const fakeDate = function FakeDate() {
      return new ORIGINAL_DATE(0);
    } as unknown as typeof Date;
    Object.defineProperty(fakeDate, "prototype", {
      value: ORIGINAL_DATE.prototype,
    });
    Object.defineProperty(fakeDate, "now", {
      value: () => 123,
    });
    Object.defineProperty(fakeDate, "parse", {
      value: (value: string) => ORIGINAL_DATE.parse(value),
    });
    Object.defineProperty(fakeDate, "UTC", {
      value: (...args: Parameters<DateConstructor["UTC"]>) =>
        ORIGINAL_DATE.UTC(...args),
    });

    Object.defineProperty(ORIGINAL_DATE.prototype, "constructor", {
      configurable: true,
      value: fakeDate,
    });

    expect(getNativeDate()).toBe(ORIGINAL_DATE);
  });

  it("uses locale.timeZone as the single Date timezone source", () => {
    const snapshot = buildSnapshot("Europe/Paris");
    snapshot.locale.timeZone = "America/Los_Angeles";
    snapshot.date.timeZone = "Europe/Paris";
    installDatePatch(snapshot);

    const parsed = Date.parse("01/15/2026");
    const utcMidnightMs = ORIGINAL_DATE.UTC(2026, 0, 15, 0, 0, 0, 0);
    const expected =
      utcMidnightMs +
      getTimeZoneOffsetMinutes(snapshot.date.timeZone, utcMidnightMs) * 60_000;
    const localeDriven =
      utcMidnightMs +
      getTimeZoneOffsetMinutes(snapshot.locale.timeZone, utcMidnightMs) * 60_000;

    expect(parsed).toBe(localeDriven);
    expect(parsed).not.toBe(expected);
  });

  it("preserves native own-property shape on patched Intl constructors", () => {
    installIntlPatch(buildSnapshot());

    const compareConstructorShape = <T extends keyof typeof NATIVE_INTL_CTORS>(
      key: T,
    ): void => {
      const nativeCtor = NATIVE_INTL_CTORS[key];
      if (!nativeCtor) {
        return;
      }

      const patchedCtor = Intl[key] as typeof nativeCtor;

      expect(Function.prototype.toString.call(patchedCtor)).toContain("[native code]");
      expect(Object.getOwnPropertyNames(patchedCtor).sort()).toEqual(
        Object.getOwnPropertyNames(nativeCtor).sort(),
      );
      expect(Object.keys(Object.getOwnPropertyDescriptors(patchedCtor)).sort()).toEqual(
        Object.keys(Object.getOwnPropertyDescriptors(nativeCtor)).sort(),
      );
      expect(patchedCtor.prototype).toBe(nativeCtor.prototype);
      expect(patchedCtor.supportedLocalesOf.toString()).toContain("[native code]");
    };

    compareConstructorShape("DateTimeFormat");
    compareConstructorShape("NumberFormat");
    compareConstructorShape("Collator");
    compareConstructorShape("RelativeTimeFormat");
    compareConstructorShape("ListFormat");
    compareConstructorShape("DisplayNames");
    compareConstructorShape("PluralRules");
    compareConstructorShape("Segmenter");
  });

  it("repairs the Date constructor, parse, prototype constructor, and methods", () => {
    const integrity = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    installDatePatch(buildSnapshot(), {
      registrar: integrity,
      realmId: "document",
    });
    const canonicalDate = Date;
    const canonicalParse = Date.parse;
    const canonicalConstructor = Date.prototype.constructor;
    const canonicalToString = Date.prototype.toString;

    globalThis.Date = ORIGINAL_DATE;
    Object.defineProperty(canonicalDate, "parse", {
      configurable: true,
      writable: true,
      value: () => 0,
    });
    Object.defineProperty(canonicalDate.prototype, "constructor", {
      configurable: true,
      writable: true,
      value: ORIGINAL_DATE,
    });
    Object.defineProperty(canonicalDate.prototype, "toString", {
      configurable: true,
      writable: true,
      value: () => "attacker",
    });

    const repaired = integrity.ensureSurface("timeLocale");

    expect(repaired).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "repaired",
          methodId: "date.constructor",
        }),
        expect.objectContaining({ status: "repaired", methodId: "date.parse" }),
        expect.objectContaining({ status: "repaired", methodId: "date.toString" }),
      ]),
    );
    expect(Date).toBe(canonicalDate);
    expect(Date.parse).toBe(canonicalParse);
    expect(Date.prototype.constructor).toBe(canonicalConstructor);
    expect(Date.prototype.toString).toBe(canonicalToString);
  });

  it("registers canonical Date methods even when public Reflect.ownKeys is poisoned", () => {
    const integrity = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    const ownKeysSpy = vi.spyOn(Reflect, "ownKeys").mockReturnValue([]);
    installDatePatch(buildSnapshot(), {
      registrar: integrity,
      realmId: "document",
    });
    ownKeysSpy.mockRestore();
    const canonicalGetHours = Date.prototype.getHours;
    expect(Reflect.deleteProperty(Date.prototype, "getHours")).toBe(true);

    expect(integrity.ensureSurface("timeLocale")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "repaired",
          reason: "descriptor-missing",
        }),
      ]),
    );
    expect(Date.prototype.getHours).toBe(canonicalGetHours);
  });

  it("repairs Intl constructors, resolvedOptions, and the DateTimeFormat format getter", () => {
    const integrity = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    installIntlPatch(buildSnapshot(), {
      registrar: integrity,
      realmId: "document",
    });
    const canonicalConstructor = Intl.DateTimeFormat;
    const canonicalResolvedOptions = Object.getOwnPropertyDescriptor(
      canonicalConstructor.prototype,
      "resolvedOptions",
    );
    const canonicalFormat = Object.getOwnPropertyDescriptor(
      canonicalConstructor.prototype,
      "format",
    );
    if (!canonicalResolvedOptions || !canonicalFormat) {
      throw new Error("Patched Intl descriptors are unavailable");
    }

    Object.defineProperty(Intl, "DateTimeFormat", {
      configurable: true,
      value: NATIVE_INTL_CTORS.DateTimeFormat,
    });
    Object.defineProperty(canonicalConstructor.prototype, "resolvedOptions", {
      configurable: true,
      value: () => ({ locale: "attacker" }),
    });
    Object.defineProperty(canonicalConstructor.prototype, "format", {
      configurable: true,
      get: () => () => "attacker",
    });

    const repaired = integrity.ensureSurface("timeLocale");

    expect(repaired).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "repaired",
          methodId: "intl.constructor",
        }),
        expect.objectContaining({
          status: "repaired",
          methodId: "intl.resolvedOptions",
        }),
        expect.objectContaining({
          status: "repaired",
          methodId: "intl.DateTimeFormat.format",
        }),
      ]),
    );
    expect(Intl.DateTimeFormat).toBe(canonicalConstructor);
    expect(
      Object.getOwnPropertyDescriptor(
        canonicalConstructor.prototype,
        "resolvedOptions",
      ),
    ).toEqual(canonicalResolvedOptions);
    expect(
      Object.getOwnPropertyDescriptor(canonicalConstructor.prototype, "format"),
    ).toEqual(canonicalFormat);
  });
});
