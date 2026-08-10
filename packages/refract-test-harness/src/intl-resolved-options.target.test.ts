import {
  INTL_RESOLVED_SOURCE,
  applyResolvedDefaults,
  createLazyResolved,
  createResolvedTransform,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

describe("applyResolvedDefaults", () => {
  const overrides = {
    language: "pl-PL",
    timeZone: "Europe/Warsaw",
  };

  it("injects only the defaults requested by the runtime", () => {
    expect(
      applyResolvedDefaults(
        { calendar: "gregory", locale: "en-US" },
        { locale: true },
        overrides,
      ),
    ).toEqual({
      calendar: "gregory",
      locale: "pl-PL",
    });

    expect(
      applyResolvedDefaults({ calendar: "gregory" }, { timeZone: true }, overrides),
    ).toEqual({
      calendar: "gregory",
      timeZone: "Europe/Warsaw",
    });
  });

  it("preserves native options when no spoofed defaults apply", () => {
    const options = {
      calendar: "gregory",
      locale: "fr-FR",
      timeZone: "America/New_York",
    };

    expect(applyResolvedDefaults(options, undefined, overrides)).toEqual(options);
    expect(applyResolvedDefaults(options, {}, overrides)).toEqual(options);
  });

  it("keeps key order stable when overwriting existing locale/timeZone fields", () => {
    const result = applyResolvedDefaults(
      {
        locale: "en-US",
        calendar: "gregory",
        timeZone: "UTC",
      },
      { locale: true, timeZone: true },
      overrides,
    );

    expect(Object.keys(result)).toEqual(["locale", "calendar", "timeZone"]);
    expect(result).toEqual({
      locale: "pl-PL",
      calendar: "gregory",
      timeZone: "Europe/Warsaw",
    });
  });
});

describe("createResolvedTransform", () => {
  it("reuses the same overrides across multiple resolvedOptions calls", () => {
    const transform = createResolvedTransform({
      language: "pl-PL",
      timeZone: "Europe/Warsaw",
    });

    expect(
      transform({ locale: "en-US", numberingSystem: "latn" }, { locale: true }),
    ).toEqual({
      locale: "pl-PL",
      numberingSystem: "latn",
    });

    expect(transform({ calendar: "gregory" }, { timeZone: true })).toEqual({
      calendar: "gregory",
      timeZone: "Europe/Warsaw",
    });
  });

  it("preserves key order through the bound transform", () => {
    const transform = createResolvedTransform({
      language: "pl-PL",
      timeZone: "Europe/Warsaw",
    });

    const result = transform(
      {
        locale: "en-US",
        calendar: "gregory",
        timeZone: "UTC",
      },
      { locale: true, timeZone: true },
    );

    expect(Object.keys(result)).toEqual(["locale", "calendar", "timeZone"]);
    expect(result).toEqual({
      locale: "pl-PL",
      calendar: "gregory",
      timeZone: "Europe/Warsaw",
    });
  });

  it("exports a literal worker inline source for resolvedOptions transforms", () => {
    expect(INTL_RESOLVED_SOURCE).toContain(
      "const applyResolvedDefaults = (options, defaults, overrides) => ({",
    );
    expect(INTL_RESOLVED_SOURCE).toContain(
      "const createResolvedTransform = (overrides) => (options, defaults) =>",
    );
    expect(INTL_RESOLVED_SOURCE).toContain(
      "const createLazyResolved = (resolveOverrides) => (options, defaults) => {",
    );
    expect(INTL_RESOLVED_SOURCE).not.toContain("__vite_ssr_import_");
  });
});

describe("createLazyResolved", () => {
  it("defers override lookup until each resolvedOptions call", () => {
    let currentOverrides = {
      language: "pl-PL",
      timeZone: "Europe/Warsaw",
    };
    const transform = createLazyResolved(() => currentOverrides);

    expect(transform({ locale: "en-US" }, { locale: true })).toEqual({
      locale: "pl-PL",
    });

    currentOverrides = {
      language: "fr-FR",
      timeZone: "Europe/Paris",
    };

    expect(transform({ timeZone: "UTC" }, { timeZone: true })).toEqual({
      timeZone: "Europe/Paris",
    });
  });

  it("preserves native options when lazy overrides are unavailable", () => {
    const transform = createLazyResolved(() => null);
    const options = {
      locale: "en-US",
      numberingSystem: "latn",
      timeZone: "UTC",
    };

    expect(transform(options, { locale: true, timeZone: true })).toEqual(options);
  });
});
