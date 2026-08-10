import { describe, expect, it } from "vitest";

import { matchCountryCodeToLocale } from "@/shared/osm-country-language-matcher";

describe("OSM country language matcher", () => {
  it("maps Egypt to Arabic instead of English", () => {
    const result = matchCountryCodeToLocale("eg");

    expect(result.required).toBe(false);
    expect(result.options[0]?.value).toMatch(/^ar(?:-EG)?$/);
    expect(result.options[0]?.language).toMatch(/^ar(?:-EG)?$/);
    expect(result.options[0]?.languages).toContain("ar");
  });

  it("returns multiple options for multilingual countries in OSM order", () => {
    const result = matchCountryCodeToLocale("ca");

    expect(result.required).toBe(true);
    expect(result.options.map((option) => option.value)).toEqual(["en-CA", "fr-CA"]);
    expect(result.selectedValue).toBe("");
  });

  it("falls back to English when a country has no usable locale match", () => {
    const result = matchCountryCodeToLocale("zz");

    expect(result.required).toBe(false);
    expect(result.options).toEqual([
      expect.objectContaining({
        value: "en",
        languages: ["en"],
      }),
    ]);
  });
});
