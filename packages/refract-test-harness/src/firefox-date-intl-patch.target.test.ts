import type { FirefoxTimeLocaleState } from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { installFxDateIntl } from "@privacy-brand/refract-core";
import { getTimeZoneOffsetMinutes } from "@privacy-brand/refract-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const TEST_EPOCH_MS = Date.parse("2026-01-15T12:00:00.000Z");
const TEST_STATE: FirefoxTimeLocaleState = {
  language: "pl-PL",
  languages: ["pl-PL", "pl"],
  timeZone: "Europe/Warsaw",
  offsetMinutes: getTimeZoneOffsetMinutes("Europe/Warsaw", TEST_EPOCH_MS),
};

const ORIGINAL_DATE = Date;
const NATIVE_INTL_CTORS = {
  DateTimeFormat: Intl.DateTimeFormat,
  NumberFormat: Intl.NumberFormat,
  Collator: Intl.Collator,
  RelativeTimeFormat: Intl.RelativeTimeFormat,
  ListFormat: "ListFormat" in Intl ? Intl.ListFormat : undefined,
  DisplayNames: "DisplayNames" in Intl ? Intl.DisplayNames : undefined,
  PluralRules: Intl.PluralRules,
  Segmenter: "Segmenter" in Intl ? Intl.Segmenter : undefined,
} as const;
const NATIVE_FORMAT_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  NATIVE_INTL_CTORS.DateTimeFormat.prototype,
  "format",
);
const NATIVE_INTL_RESOLVED = {
  NumberFormat: Object.getOwnPropertyDescriptor(
    Intl.NumberFormat.prototype,
    "resolvedOptions",
  ),
  Collator: Object.getOwnPropertyDescriptor(Intl.Collator.prototype, "resolvedOptions"),
  RelativeTimeFormat: Object.getOwnPropertyDescriptor(
    Intl.RelativeTimeFormat.prototype,
    "resolvedOptions",
  ),
  ListFormat:
    "ListFormat" in Intl
      ? Object.getOwnPropertyDescriptor(Intl.ListFormat.prototype, "resolvedOptions")
      : undefined,
  DisplayNames:
    "DisplayNames" in Intl
      ? Object.getOwnPropertyDescriptor(Intl.DisplayNames.prototype, "resolvedOptions")
      : undefined,
  PluralRules: Object.getOwnPropertyDescriptor(
    Intl.PluralRules.prototype,
    "resolvedOptions",
  ),
  Segmenter:
    "Segmenter" in Intl
      ? Object.getOwnPropertyDescriptor(Intl.Segmenter.prototype, "resolvedOptions")
      : undefined,
} as const;

const restorePatchedGlobals = (): void => {
  globalThis.Date = ORIGINAL_DATE;

  Object.defineProperty(Intl, "DateTimeFormat", {
    configurable: true,
    value: NATIVE_INTL_CTORS.DateTimeFormat,
  });
  Object.defineProperty(Intl, "NumberFormat", {
    configurable: true,
    value: NATIVE_INTL_CTORS.NumberFormat,
  });
  Object.defineProperty(Intl, "Collator", {
    configurable: true,
    value: NATIVE_INTL_CTORS.Collator,
  });
  Object.defineProperty(Intl, "RelativeTimeFormat", {
    configurable: true,
    value: NATIVE_INTL_CTORS.RelativeTimeFormat,
  });
  Object.defineProperty(Intl, "PluralRules", {
    configurable: true,
    value: NATIVE_INTL_CTORS.PluralRules,
  });
  if (NATIVE_INTL_RESOLVED.NumberFormat) {
    Object.defineProperty(
      NATIVE_INTL_CTORS.NumberFormat.prototype,
      "resolvedOptions",
      NATIVE_INTL_RESOLVED.NumberFormat,
    );
  }
  if (NATIVE_INTL_RESOLVED.Collator) {
    Object.defineProperty(
      NATIVE_INTL_CTORS.Collator.prototype,
      "resolvedOptions",
      NATIVE_INTL_RESOLVED.Collator,
    );
  }
  if (NATIVE_INTL_RESOLVED.RelativeTimeFormat) {
    Object.defineProperty(
      NATIVE_INTL_CTORS.RelativeTimeFormat.prototype,
      "resolvedOptions",
      NATIVE_INTL_RESOLVED.RelativeTimeFormat,
    );
  }
  if (NATIVE_INTL_RESOLVED.PluralRules) {
    Object.defineProperty(
      NATIVE_INTL_CTORS.PluralRules.prototype,
      "resolvedOptions",
      NATIVE_INTL_RESOLVED.PluralRules,
    );
  }

  if (NATIVE_INTL_CTORS.ListFormat) {
    Object.defineProperty(Intl, "ListFormat", {
      configurable: true,
      value: NATIVE_INTL_CTORS.ListFormat,
    });
    if (NATIVE_INTL_RESOLVED.ListFormat) {
      Object.defineProperty(
        NATIVE_INTL_CTORS.ListFormat.prototype,
        "resolvedOptions",
        NATIVE_INTL_RESOLVED.ListFormat,
      );
    }
  }

  if (NATIVE_INTL_CTORS.DisplayNames) {
    Object.defineProperty(Intl, "DisplayNames", {
      configurable: true,
      value: NATIVE_INTL_CTORS.DisplayNames,
    });
    if (NATIVE_INTL_RESOLVED.DisplayNames) {
      Object.defineProperty(
        NATIVE_INTL_CTORS.DisplayNames.prototype,
        "resolvedOptions",
        NATIVE_INTL_RESOLVED.DisplayNames,
      );
    }
  }

  if (NATIVE_INTL_CTORS.Segmenter) {
    Object.defineProperty(Intl, "Segmenter", {
      configurable: true,
      value: NATIVE_INTL_CTORS.Segmenter,
    });
    if (NATIVE_INTL_RESOLVED.Segmenter) {
      Object.defineProperty(
        NATIVE_INTL_CTORS.Segmenter.prototype,
        "resolvedOptions",
        NATIVE_INTL_RESOLVED.Segmenter,
      );
    }
  }
};

afterEach(() => {
  restorePatchedGlobals();
});

describe("installFxDateIntl", () => {
  it("defaults DateTimeFormat locale and timeZone from Firefox shim state", () => {
    let syncCalls = 0;

    installFxDateIntl({
      syncBootstrapState: () => {
        syncCalls += 1;
      },
      getTimeLocaleState: () => TEST_STATE,
    });

    const formatter = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const resolved = formatter.resolvedOptions();

    expect(resolved.locale.toLowerCase()).toContain("pl");
    expect(resolved.timeZone).toBe("Europe/Warsaw");
    expect(syncCalls).toBeGreaterThan(0);
  });

  it("preserves explicit Intl locale and timeZone arguments", () => {
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => TEST_STATE,
    });

    const numberFormat = new Intl.NumberFormat("en-US");
    const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
    });

    expect(numberFormat.resolvedOptions().locale.toLowerCase()).toContain("en");
    expect(dateTimeFormat.resolvedOptions().locale.toLowerCase()).toContain("en");
    expect(dateTimeFormat.resolvedOptions().timeZone).toBe("America/New_York");
  });

  it("preserves native-looking DateTimeFormat format getter metadata and illegal invocation parity", () => {
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => TEST_STATE,
    });

    const formatDescriptor = Object.getOwnPropertyDescriptor(
      Intl.DateTimeFormat.prototype,
      "format",
    );

    expect(formatDescriptor?.get?.name).toBe("get format");
    expect(Function.prototype.toString.call(formatDescriptor?.get)).toContain(
      "[native code]",
    );
    expect(() => formatDescriptor?.get?.call(Intl.DateTimeFormat.prototype)).toThrow(
      TypeError,
    );
    expect(() =>
      NATIVE_FORMAT_DESCRIPTOR?.get?.call(NATIVE_INTL_CTORS.DateTimeFormat.prototype),
    ).toThrow(TypeError);
  });

  it("keeps DateTimeFormat prototype getter output aligned with direct formatting", () => {
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => TEST_STATE,
    });

    const formatter = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const date = new Date("2026-01-15T12:00:00.000Z");
    const directResult = formatter.format(date);
    const formatDescriptor = Object.getOwnPropertyDescriptor(
      Intl.DateTimeFormat.prototype,
      "format",
    );

    expect(formatDescriptor?.get).toBeTypeOf("function");
    const extractedFormat = formatDescriptor!.get!.call(formatter);
    expect(extractedFormat(date)).toBe(directResult);
    expect(formatDescriptor!.get!.call(formatter)).toBe(extractedFormat);
  });

  it("defaults locale across the patched non-DateTimeFormat Intl constructors", () => {
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => TEST_STATE,
    });

    expect(new Intl.NumberFormat().resolvedOptions().locale.toLowerCase()).toContain(
      "pl",
    );
    expect(new Intl.Collator().resolvedOptions().locale.toLowerCase()).toContain("pl");
    expect(
      new Intl.RelativeTimeFormat().resolvedOptions().locale.toLowerCase(),
    ).toContain("pl");
    expect(new Intl.PluralRules().resolvedOptions().locale.toLowerCase()).toContain(
      "pl",
    );

    if ("ListFormat" in Intl) {
      expect(new Intl.ListFormat().resolvedOptions().locale.toLowerCase()).toContain(
        "pl",
      );
    }
    if ("DisplayNames" in Intl) {
      expect(
        new Intl.DisplayNames(undefined, { type: "region" })
          .resolvedOptions()
          .locale.toLowerCase(),
      ).toContain("pl");
    }
    if ("Segmenter" in Intl) {
      expect(new Intl.Segmenter().resolvedOptions().locale.toLowerCase()).toContain(
        "pl",
      );
    }
  });

  it("keeps Firefox Intl defaults regional when navigator locales prefer bare English", () => {
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => ({
        language: "en",
        languages: ["en", "pl"],
        formattingLanguage: "pl",
        formattingLanguages: ["pl", "en-US"],
        timeZone: "Europe/Warsaw",
        offsetMinutes: TEST_STATE.offsetMinutes,
      }),
    });

    expect(new Intl.NumberFormat().resolvedOptions().locale.toLowerCase()).toContain(
      "pl",
    );
    expect(
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .resolvedOptions()
        .locale.toLowerCase(),
    ).toContain("pl");
  });

  it("preserves native own-property shape on Firefox default-locale Intl constructors", () => {
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => TEST_STATE,
    });

    const compareConstructorShape = <T extends keyof typeof NATIVE_INTL_CTORS>(
      key: T,
    ): void => {
      if (key === "DateTimeFormat") {
        return;
      }

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

    compareConstructorShape("NumberFormat");
    compareConstructorShape("Collator");
    compareConstructorShape("RelativeTimeFormat");
    compareConstructorShape("ListFormat");
    compareConstructorShape("DisplayNames");
    compareConstructorShape("PluralRules");
    compareConstructorShape("Segmenter");
  });

  it("does not claim locale defaults before Firefox shim state exists", () => {
    const nativeLocale = new NATIVE_INTL_CTORS.NumberFormat().resolvedOptions().locale;

    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => null,
    });

    expect(new Intl.NumberFormat().resolvedOptions().locale).toBe(nativeLocale);
  });

  it("spoofs Date timezone offset and locale-based formatting", () => {
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => TEST_STATE,
    });

    const date = new Date(TEST_EPOCH_MS);
    const implicitLocaleString = date.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const explicitLocaleString = ORIGINAL_DATE.prototype.toLocaleString.call(
      date,
      TEST_STATE.languages,
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: TEST_STATE.timeZone,
      },
    );

    expect(date.getTimezoneOffset()).toBe(
      getTimeZoneOffsetMinutes(TEST_STATE.timeZone, TEST_EPOCH_MS),
    );
    expect(implicitLocaleString).toBe(explicitLocaleString);
  });

  it("adjusts local multi-argument Date construction to the spoofed timezone", () => {
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => TEST_STATE,
    });

    const nativeDate = new ORIGINAL_DATE(2026, 0, 15, 12, 34, 56);
    const spoofedDate = new Date(2026, 0, 15, 12, 34, 56);
    const expectedEpochMs =
      nativeDate.getTime() -
      (nativeDate.getTimezoneOffset() - TEST_STATE.offsetMinutes) * 60 * 1000;

    expect(spoofedDate.getTime()).toBe(expectedEpochMs);
  });

  it("adjusts local date-string construction to the spoofed timezone", () => {
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => TEST_STATE,
    });

    const nativeDate = new ORIGINAL_DATE("2026-01-15T12:34:56");
    const spoofedDate = new Date("2026-01-15T12:34:56");
    const expectedEpochMs =
      nativeDate.getTime() -
      (nativeDate.getTimezoneOffset() - TEST_STATE.offsetMinutes) * 60 * 1000;

    expect(spoofedDate.getTime()).toBe(expectedEpochMs);
  });

  it("keeps Firefox Date on the native epoch and applies compatible DST semantics", () => {
    const torontoState: FirefoxTimeLocaleState = {
      ...TEST_STATE,
      timeZone: "America/Toronto",
      offsetMinutes: getTimeZoneOffsetMinutes("America/Toronto", TEST_EPOCH_MS),
    };
    vi.spyOn(ORIGINAL_DATE, "now").mockReturnValue(TEST_EPOCH_MS);

    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => torontoState,
    });

    expect(Date.now()).toBe(TEST_EPOCH_MS);
    expect(new Date(TEST_EPOCH_MS).getTime()).toBe(TEST_EPOCH_MS);
    expect(Date.parse("2026-03-08T02:30:00")).toBe(
      ORIGINAL_DATE.parse("2026-03-08T07:30:00.000Z"),
    );

    const gapDate = new Date(2026, 2, 8, 2, 30);
    expect(gapDate.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    const overlapDate = new Date(2026, 10, 1, 1, 30);
    expect(overlapDate.toISOString()).toBe("2026-11-01T05:30:00.000Z");

    const setterDate = new Date("2026-03-08T06:30:00.000Z");
    setterDate.setHours(2, 30, 0, 0);
    expect(setterDate.toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("uses the Firefox profile timezone after Date input coercion", () => {
    const torontoState: FirefoxTimeLocaleState = {
      ...TEST_STATE,
      timeZone: "America/Toronto",
      offsetMinutes: getTimeZoneOffsetMinutes("America/Toronto", TEST_EPOCH_MS),
    };
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => torontoState,
    });

    const constructorInput = {
      [Symbol.toPrimitive]: vi.fn(() => "2026-01-15T12:00:00"),
    };
    const parseInput = { toString: vi.fn(() => "2026-01-15T12:00:00") };

    expect(new Date(constructorInput as unknown as string).toISOString()).toBe(
      "2026-01-15T17:00:00.000Z",
    );
    expect(constructorInput[Symbol.toPrimitive]).toHaveBeenCalledOnce();
    expect(Date.parse(parseInput as unknown as string)).toBe(
      ORIGINAL_DATE.parse("2026-01-15T17:00:00.000Z"),
    );
    expect(parseInput.toString).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// First-inline timing tests
// These guard against the Firefox first-call race: spoofed APIs must not crash
// or leak host timezone before bootstrap state resolves, and bootstrap polling
// must happen on every access (not just the first).
// ---------------------------------------------------------------------------

describe("installFxDateIntl — first-inline timing", () => {
  it("calls onFirstAccess exactly once on the first Intl access", () => {
    const onFirstAccess = vi.fn();
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => TEST_STATE,
      onFirstAccess,
    });

    // onFirstAccess fires from resolveTimeLocaleState(), which is invoked
    // by patchFxDefaultIntlCtors on every non-DateTimeFormat
    // Intl constructor call (e.g. NumberFormat, Collator).
    new Intl.NumberFormat();
    new Intl.NumberFormat();
    new Intl.NumberFormat();

    expect(onFirstAccess).toHaveBeenCalledTimes(1);
  });

  it("calls syncBootstrapState on every non-DateTimeFormat Intl construction", () => {
    const syncBootstrapState = vi.fn();
    installFxDateIntl({
      syncBootstrapState,
      getTimeLocaleState: () => null,
    });

    // NumberFormat/Collator constructors call resolveIntlDefaults() → resolveTimeLocaleState()
    // → syncBootstrapState() synchronously during construction.
    new Intl.NumberFormat();
    new Intl.NumberFormat();
    new Intl.NumberFormat();

    expect(syncBootstrapState.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("does not crash when getTimeLocaleState returns null (bootstrap not yet resolved)", () => {
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => null,
    });

    // All patched surfaces must degrade gracefully before state resolves.
    expect(() => new Date()).not.toThrow();
    expect(() => new Intl.DateTimeFormat()).not.toThrow();
    expect(() => new Intl.NumberFormat()).not.toThrow();
    expect(() => new Intl.Collator()).not.toThrow();
  });

  it("applies state that becomes available after the first access (bootstrap race)", () => {
    let resolvedState: FirefoxTimeLocaleState | null = null;

    installFxDateIntl({
      syncBootstrapState: () => {
        // Simulate bootstrap data arriving mid-session.
        resolvedState = TEST_STATE;
      },
      getTimeLocaleState: () => resolvedState,
    });

    // Before state is available — syncBootstrapState resolves it on first call.
    // After state resolves, the next NumberFormat construction picks up the timezone.
    const beforeTimeZone = new Intl.NumberFormat().resolvedOptions().locale;
    const afterTimeZone = new Intl.NumberFormat().resolvedOptions().locale;

    // Both are valid strings (no crash).
    expect(typeof beforeTimeZone).toBe("string");
    expect(typeof afterTimeZone).toBe("string");
    // After state resolves, the locale matches the spoofed language.
    expect(afterTimeZone).toContain(TEST_STATE.language.split("-")[0]!);
  });

  it("returns correct Intl locale and timezone on the first read when state is preloaded (no bootstrap lag)", () => {
    installFxDateIntl({
      syncBootstrapState: () => {},
      getTimeLocaleState: () => TEST_STATE,
    });

    // All reads happen synchronously — as a page's first inline script would do.
    // State was preloaded, so no syncBootstrapState call is needed for correctness.
    const resolvedOptions = new Intl.DateTimeFormat().resolvedOptions();
    const timezoneOffset = new Date(TEST_EPOCH_MS).getTimezoneOffset();

    expect(resolvedOptions.locale.toLowerCase()).toContain(
      TEST_STATE.language.split("-")[0]!.toLowerCase(),
    );
    expect(resolvedOptions.timeZone).toBe(TEST_STATE.timeZone);
    expect(timezoneOffset).toBe(
      getTimeZoneOffsetMinutes(TEST_STATE.timeZone, TEST_EPOCH_MS),
    );

    restorePatchedGlobals();
  });
});
