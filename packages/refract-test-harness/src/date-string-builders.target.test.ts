import {
  DATE_STRING_SOURCE,
  buildDateStringFormatter,
  buildDateLocaleOptions,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

type CountingDateTimeFormat = {
  DateTimeFormat: typeof Intl.DateTimeFormat;
  getConstructorCalls: () => number;
};

const createCountingFormatter = (): CountingDateTimeFormat => {
  const NativeDateTimeFormat = Intl.DateTimeFormat;
  let constructorCalls = 0;

  const DateTimeFormat = function DateTimeFormat(
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ) {
    constructorCalls += 1;
    return new NativeDateTimeFormat(locales, options);
  } as unknown as typeof Intl.DateTimeFormat;

  return {
    DateTimeFormat,
    getConstructorCalls: () => constructorCalls,
  };
};

describe("date-string-builders", () => {
  const intlDefaults = {
    languages: ["pl-PL", "pl"],
    timeZone: "Europe/Warsaw",
  } as const;

  it("applies Date toLocale defaults only when the page omitted styles and fields", () => {
    const defaultedOptions = buildDateLocaleOptions(
      undefined,
      { year: "numeric", month: "numeric", day: "numeric" },
      intlDefaults,
    );
    const explicitOptions = buildDateLocaleOptions(
      { hour: "2-digit" },
      { year: "numeric", month: "numeric", day: "numeric" },
      intlDefaults,
    );

    expect(defaultedOptions).toEqual({
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    expect(explicitOptions).toEqual({
      timeZone: "Europe/Warsaw",
      hour: "2-digit",
    });
  });

  it("does not mutate page-owned option bags when applying spoofed defaults", () => {
    const pageOptions: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
    };

    const result = buildDateLocaleOptions(
      pageOptions,
      { hour: "numeric", minute: "numeric", second: "numeric" },
      intlDefaults,
    );

    expect(result).not.toBe(pageOptions);
    expect(result).toEqual({
      hour: "2-digit",
      timeZone: "Europe/Warsaw",
    });
    expect(pageOptions).toEqual({
      hour: "2-digit",
    });
  });

  it("builds formatters with spoofed locale and timezone defaults", () => {
    const formatter = buildDateStringFormatter({
      DateTimeFormat: Intl.DateTimeFormat,
      locales: undefined,
      options: undefined,
      defaults: { year: "numeric", month: "2-digit", day: "2-digit" },
      intlDefaults: intlDefaults,
    });

    expect(formatter.resolvedOptions().timeZone).toBe("Europe/Warsaw");
    expect(formatter.resolvedOptions().locale.toLowerCase()).toContain("pl");
    expect(formatter.format(new Date("2026-01-15T12:00:00.000Z"))).toContain("2026");
  });

  const DATE_LOCALE_DEFAULTS = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  } as const;

  it("reuses a single formatter across 1000 identical toLocale-style calls", () => {
    const counting = createCountingFormatter();
    const date = new Date("2026-01-15T12:00:00.000Z");

    const first = buildDateStringFormatter({
      DateTimeFormat: counting.DateTimeFormat,
      locales: undefined,
      options: undefined,
      defaults: DATE_LOCALE_DEFAULTS,
      intlDefaults: intlDefaults,
    });
    const expected = first.format(date);

    for (let call = 0; call < 1000; call += 1) {
      const formatter = buildDateStringFormatter({
        DateTimeFormat: counting.DateTimeFormat,
        locales: undefined,
        options: undefined,
        defaults: DATE_LOCALE_DEFAULTS,
        intlDefaults: intlDefaults,
      });
      expect(formatter).toBe(first);
      expect(formatter.format(date)).toBe(expected);
    }

    expect(counting.getConstructorCalls()).toBe(1);
  });

  it("keeps distinct formatters per locale, options, and timeZone", () => {
    const counting = createCountingFormatter();

    buildDateStringFormatter({
      DateTimeFormat: counting.DateTimeFormat,
      locales: "en-US",
      options: undefined,
      defaults: DATE_LOCALE_DEFAULTS,
      intlDefaults: intlDefaults,
    });
    buildDateStringFormatter({
      DateTimeFormat: counting.DateTimeFormat,
      locales: "de-DE",
      options: undefined,
      defaults: DATE_LOCALE_DEFAULTS,
      intlDefaults: intlDefaults,
    });
    buildDateStringFormatter({
      DateTimeFormat: counting.DateTimeFormat,
      locales: "en-US",
      options: { hour12: true },
      defaults: DATE_LOCALE_DEFAULTS,
      intlDefaults: intlDefaults,
    });
    buildDateStringFormatter({
      DateTimeFormat: counting.DateTimeFormat,
      locales: "en-US",
      options: { timeZone: "Asia/Tokyo" },
      defaults: DATE_LOCALE_DEFAULTS,
      intlDefaults: intlDefaults,
    });

    // Re-issue the first key: must hit cache, not reconstruct.
    buildDateStringFormatter({
      DateTimeFormat: counting.DateTimeFormat,
      locales: "en-US",
      options: undefined,
      defaults: DATE_LOCALE_DEFAULTS,
      intlDefaults: intlDefaults,
    });

    expect(counting.getConstructorCalls()).toBe(4);
  });

  it("honors caller-provided timeZone, dateStyle, and hour12 from cached formatters", () => {
    const counting = createCountingFormatter();
    const date = new Date("2026-07-15T23:30:00.000Z");

    const tokyo = buildDateStringFormatter({
      DateTimeFormat: counting.DateTimeFormat,
      locales: "en-US",
      options: {
        timeZone: "Asia/Tokyo",
        dateStyle: "full",
        timeStyle: "short",
        hour12: false,
      },
      defaults: DATE_LOCALE_DEFAULTS,
      intlDefaults: intlDefaults,
    });
    const reference = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      dateStyle: "full",
      timeStyle: "short",
      hour12: false,
    });

    expect(tokyo.format(date)).toBe(reference.format(date));
    expect(tokyo.resolvedOptions().timeZone).toBe("Asia/Tokyo");
    expect(
      buildDateStringFormatter({
        DateTimeFormat: counting.DateTimeFormat,
        locales: "en-US",
        options: {
          timeZone: "Asia/Tokyo",
          dateStyle: "full",
          timeStyle: "short",
          hour12: false,
        },
        defaults: DATE_LOCALE_DEFAULTS,
        intlDefaults: intlDefaults,
      }),
    ).toBe(tokyo);
    expect(counting.getConstructorCalls()).toBe(1);
  });

  it("bypasses the cache for non-serializable Intl.Locale arguments without breaking output", () => {
    const counting = createCountingFormatter();
    const date = new Date("2026-07-15T12:00:00.000Z");
    const locale = new Intl.Locale("en-US");

    const first = buildDateStringFormatter({
      DateTimeFormat: counting.DateTimeFormat,
      locales: locale,
      options: undefined,
      defaults: DATE_LOCALE_DEFAULTS,
      intlDefaults: intlDefaults,
    });
    const second = buildDateStringFormatter({
      DateTimeFormat: counting.DateTimeFormat,
      locales: locale,
      options: undefined,
      defaults: DATE_LOCALE_DEFAULTS,
      intlDefaults: intlDefaults,
    });

    expect(first.format(date)).toBe(second.format(date));
    expect(counting.getConstructorCalls()).toBe(2);
  });

  it("stays bounded and correct past its size limit (no unbounded growth)", () => {
    const counting = createCountingFormatter();
    const date = new Date("2026-07-15T12:00:00.000Z");
    // 60 distinct valid IANA zones produce 60 distinct cache keys, exceeding the
    // internal bound (48) so the cache must clear() at least once.
    const zones = Intl.supportedValuesOf("timeZone").slice(0, 60);
    expect(zones.length).toBe(60);

    const firstZoneOutput = buildDateStringFormatter({
      DateTimeFormat: counting.DateTimeFormat,
      locales: "en-US",
      options: { timeZone: zones[0] },
      defaults: DATE_LOCALE_DEFAULTS,
      intlDefaults: intlDefaults,
    }).format(date);

    for (const timeZone of zones) {
      const formatter = buildDateStringFormatter({
        DateTimeFormat: counting.DateTimeFormat,
        locales: "en-US",
        options: { timeZone },
        defaults: DATE_LOCALE_DEFAULTS,
        intlDefaults: intlDefaults,
      });
      expect(typeof formatter.format(date)).toBe("string");
    }

    // Re-request the first zone: even if it was evicted by a clear(), output
    // must remain identical.
    const reFirst = buildDateStringFormatter({
      DateTimeFormat: counting.DateTimeFormat,
      locales: "en-US",
      options: { timeZone: zones[0] },
      defaults: DATE_LOCALE_DEFAULTS,
      intlDefaults: intlDefaults,
    });
    expect(reFirst.format(date)).toBe(firstZoneOutput);

    // The real invariant (independent of the internal cache limit): each distinct
    // key constructs at most once, so the total never exceeds the distinct-key
    // count plus one possible reconstruction of an evicted entry. A per-call
    // construction would blow past this. This holds whether or not eviction ran.
    expect(counting.getConstructorCalls()).toBeLessThanOrEqual(zones.length + 1);
  });

  it("exports a literal worker inline source for Date string builders", () => {
    expect(DATE_STRING_SOURCE).toContain(
      "const buildDateLocaleOptions = (options, defaults, intlDefaults) => {",
    );
    expect(DATE_STRING_SOURCE).toContain(
      "const buildDateStringFormatter = (DateTimeFormat, locales, options, defaults, intlDefaults) =>",
    );
    expect(DATE_STRING_SOURCE).not.toContain("__vite_ssr_import_");
  });
});
