import { INTL_CTOR_PATCH_SOURCE } from "@privacy-brand/refract-core";
import { patchIntlConstructor } from "@privacy-brand/refract-core";
import { afterEach, describe, expect, it } from "vitest";

describe("intl-constructor-patch", () => {
  const ORIGINAL_NUMBER_FORMAT = Intl.NumberFormat;
  const NATIVE_NUMBER_RESOLVED = Object.getOwnPropertyDescriptor(
    ORIGINAL_NUMBER_FORMAT.prototype,
    "resolvedOptions",
  );

  afterEach(() => {
    Object.defineProperty(Intl, "NumberFormat", {
      configurable: true,
      value: ORIGINAL_NUMBER_FORMAT,
    });
    if (NATIVE_NUMBER_RESOLVED) {
      Object.defineProperty(
        ORIGINAL_NUMBER_FORMAT.prototype,
        "resolvedOptions",
        NATIVE_NUMBER_RESOLVED,
      );
    }
  });

  it("exports a literal worker inline source for Intl constructor patching", () => {
    expect(INTL_CTOR_PATCH_SOURCE).toContain(
      "const patchIntlConstructor = (key, optionsTransform, resultTransform, resolveIntlDefaults) => {",
    );
    expect(INTL_CTOR_PATCH_SOURCE).not.toContain("__vite_ssr_import_");
  });

  it("marks locale defaults only when an Intl defaults source is available", () => {
    const capturedDefaultFlags: boolean[] = [];

    patchIntlConstructor<Intl.NumberFormat, Intl.NumberFormatOptions>({
      intlObject: Intl,
      key: "NumberFormat",
      intlDefaults: null,
      resolveIntlDefaults: () => null,
      intlInstanceDefaults: new WeakMap(),
      optionsTransform: (options) => options,
      resultTransform: (options) => options,
      maskAsNative: (fn) => fn,
      createNativeSource: (name) => name,
      hooks: {
        onConstructed: (_key, details) => {
          capturedDefaultFlags.push(details.defaults.locale === true);
        },
      },
    });

    // Trigger constructor path after patching.
    new Intl.NumberFormat(undefined);

    expect(capturedDefaultFlags).toEqual([false]);
  });

  it("uses lazy Intl defaults when they become available", () => {
    const capturedEffectiveLocales: Intl.LocalesArgument[] = [];
    const capturedDefaultFlags: boolean[] = [];

    patchIntlConstructor<Intl.NumberFormat, Intl.NumberFormatOptions>({
      intlObject: Intl,
      key: "NumberFormat",
      intlDefaults: null,
      resolveIntlDefaults: () => ({
        languages: ["pl-PL", "pl"],
        timeZone: "Europe/Warsaw",
      }),
      intlInstanceDefaults: new WeakMap(),
      optionsTransform: (options) => options,
      resultTransform: (options) => options,
      maskAsNative: (fn) => fn,
      createNativeSource: (name) => name,
      hooks: {
        onConstructed: (_key, details) => {
          capturedEffectiveLocales.push(details.effectiveLocales);
          capturedDefaultFlags.push(details.defaults.locale === true);
        },
      },
    });

    new Intl.NumberFormat(undefined);

    expect(capturedEffectiveLocales).toEqual([["pl-PL", "pl"]]);
    expect(capturedDefaultFlags).toEqual([true]);
  });
});
