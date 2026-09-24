import { describe, expect, it } from "vitest";

import { applyUiLocalePreference, resolveUiLocale, t } from "./index";

describe("resolveUiLocale", () => {
  it.each(["es", "es-ES", "es-MX", "ES-ar"])("selects Spanish for %s", (language) => {
    expect(resolveUiLocale(language)).toBe("es");
  });

  it.each(["pt", "pt-BR", "pt-PT", "PT-ao"])(
    "selects Portuguese for %s",
    (language) => {
      expect(resolveUiLocale(language)).toBe("pt");
    },
  );

  it.each(["ru", "ru-RU", "RU-kz"])("selects Russian for %s", (language) => {
    expect(resolveUiLocale(language)).toBe("ru");
  });

  it.each(["uk", "uk-UA", "UK-ua"])("selects Ukrainian for %s", (language) => {
    expect(resolveUiLocale(language)).toBe("uk");
  });

  it.each([undefined, "", "en", "en-US", "pl-PL"])(
    "falls back to English for %s",
    (language) => {
      expect(resolveUiLocale(language)).toBe("en");
    },
  );

  it("switches the active catalog without recapturing nested messages", () => {
    const language = t.advanced.display.language;
    applyUiLocalePreference("es");
    expect(language.title).toBe("Idioma");
    applyUiLocalePreference("en");
    expect(language.title).toBe("Language");
  });
});
