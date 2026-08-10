import {
  createIntlDefaults,
  INTL_DEFAULTS_SOURCE,
  withDefaultLocales,
  withDefaultTimeZone,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

describe("intl-defaults", () => {
  const defaults = {
    languages: ["pl-PL", "pl"] as const,
    timeZone: "Europe/Warsaw",
  };

  it("creates the shared locale/timeZone defaults object", () => {
    expect(createIntlDefaults(defaults.languages, defaults.timeZone)).toEqual(defaults);
  });

  it("uses spoofed locales only when the page omits them", () => {
    expect(withDefaultLocales(undefined, defaults)).toEqual(["pl-PL", "pl"]);
    expect(withDefaultLocales("en-US", defaults)).toBe("en-US");
  });

  it("preserves the original locale input when defaults are unavailable", () => {
    expect(withDefaultLocales(undefined, null)).toBeUndefined();
    expect(withDefaultLocales(["en-US", "en"], null)).toEqual(["en-US", "en"]);
  });

  it("fills the spoofed timezone only when the page omitted it", () => {
    expect(withDefaultTimeZone(undefined, defaults)).toEqual({
      timeZone: "Europe/Warsaw",
    });

    expect(withDefaultTimeZone({ hour: "2-digit" }, defaults)).toEqual({
      hour: "2-digit",
      timeZone: "Europe/Warsaw",
    });
  });

  it("keeps explicit page timeZone values untouched", () => {
    const options = {
      hour: "2-digit",
      timeZone: "America/New_York",
    } satisfies Intl.DateTimeFormatOptions;

    const result = withDefaultTimeZone(options, defaults);

    expect(result).toEqual(options);
    expect(result).not.toBe(options);
  });

  it("exports literal worker inline sources for locale and timezone defaults", () => {
    expect(INTL_DEFAULTS_SOURCE).toContain(
      "const withDefaultLocales = (locales, defaults) => {",
    );
    expect(INTL_DEFAULTS_SOURCE).toContain(
      "const withDefaultTimeZone = (options, defaults) => {",
    );
    expect(INTL_DEFAULTS_SOURCE).toContain(
      "const createIntlDefaults = (languages, timeZone) => ({",
    );
    expect(INTL_DEFAULTS_SOURCE).not.toContain("__vite_ssr_import_");
  });
});
