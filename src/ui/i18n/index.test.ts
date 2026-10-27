// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { zhCN } from "./zh-CN";
import { zhTW } from "./zh-TW";

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

  it.each([
    "zh",
    "zh-CN",
    "zh-SG",
    "zh-Hans",
    "zh-Hans-HK",
    "ZH-hans-tw",
    "zh-MY",
    "zh-Hans-CN-x-hant",
    "zh-CN-x-tw",
    "zh-u-nu-hanidec",
  ])("selects Simplified Chinese for %s", (language) => {
    expect(resolveUiLocale(language)).toBe("zh-CN");
  });

  it.each([
    "zh-TW",
    "zh-HK",
    "zh-MO",
    "zh-Hant",
    "zh-Hant-CN",
    "ZH-tw",
    "zh-hant-sg",
    "zh-yue-HK",
    "zh-TW-u-ca-roc",
  ])("selects Traditional Chinese for %s", (language) => {
    expect(resolveUiLocale(language)).toBe("zh-TW");
  });

  it.each([undefined, "", "en", "en-US", "pl-PL", "ja-JP", "zhx"])(
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

  it("marks the document language with the resolved Chinese locale", () => {
    applyUiLocalePreference("zh-TW");
    expect(document.documentElement.lang).toBe("zh-TW");
    expect(t.advanced.display.language.title).toBe(
      zhTW.advanced.display.language.title,
    );
    applyUiLocalePreference("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(t.advanced.display.language.title).toBe(
      zhCN.advanced.display.language.title,
    );
    applyUiLocalePreference("en");
    expect(document.documentElement.lang).toBe("en");
  });
});
