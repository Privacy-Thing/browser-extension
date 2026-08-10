import { describe, expect, it } from "vitest";

import { EXAMPLE_LOCATIONS } from "@/background/storage/locations";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  findSupportedLocale,
  getRuntimeLocale,
  getLocaleCatalogEntry,
  getLocaleOptions,
  getEnglishLocale,
  canPreferEnglish,
  isLocaleSupported,
  normalizeLocationLocales,
  normalizeLocaleConfig,
  normalizeLocaleTag,
} from "@/shared/locale-catalog";

describe("locale catalog", () => {
  it("tracks target availability for browser-native tags", () => {
    expect(getLocaleCatalogEntry("pl")).toEqual(
      expect.objectContaining({
        value: "pl",
        targets: expect.arrayContaining(["chromium", "firefox"]),
      }),
    );

    if (BUILD_BROWSER_TARGET === "chromium") {
      expect(isLocaleSupported("fil")).toBe(true);
      expect(isLocaleSupported("tl")).toBe(false);
    } else {
      expect(isLocaleSupported("tl")).toBe(true);
      expect(isLocaleSupported("fil")).toBe(false);
    }

    expect(getLocaleOptions(BUILD_BROWSER_TARGET).length).toBeGreaterThan(0);
  });

  it("normalizes legacy and cross-target locale variants", () => {
    const aliasInput = BUILD_BROWSER_TARGET === "chromium" ? "tl" : "fil";
    const aliasExpected = BUILD_BROWSER_TARGET === "chromium" ? "fil" : "tl";

    expect(normalizeLocaleTag("pl-PL")).toBe("pl");
    expect(normalizeLocaleTag("pt_BR")).toBe("pt-BR");
    expect(normalizeLocaleTag(aliasInput)).toBe(aliasExpected);
    expect(normalizeLocaleTag("zh-Hant-HK")).toBe("zh-HK");
    expect(normalizeLocaleTag("hi-IN")).toBe("hi");
    expect(normalizeLocaleTag("en")).toBe("en");
  });

  it("finds only target-supported locale matches", () => {
    expect(findSupportedLocale("zh-Hant-HK")).toBe("zh-HK");
    expect(findSupportedLocale("iw")).toBe("he");
    expect(findSupportedLocale("in")).toBe("id");
  });

  it("keeps language aligned with the first languages entry", () => {
    const normalized = normalizeLocaleConfig({
      language: "pl-PL",
      languages: ["EN_us", "pl-PL", "en-US"],
    });

    expect(normalized).toEqual({
      language: "pl",
      languages: ["pl", "en-US"],
    });
  });

  it("drops empty normalized language entries from the list", () => {
    const normalized = normalizeLocaleConfig({
      language: "pl-PL",
      languages: ["---", "EN_us", "pl-PL"],
    });

    expect(normalized.languages).toEqual(["pl", "en-US"]);
  });

  it("derives an English-first runtime locale without mutating saved order", () => {
    const englishLocale = getEnglishLocale();
    const runtimeLocale = getRuntimeLocale({
      language: "pl",
      languages: ["pl", "en-US"],
      preferEnglishContent: true,
    });

    expect(runtimeLocale).toEqual({
      language: englishLocale,
      languages: Object.freeze([englishLocale, "pl"]),
      formattingLanguage: "pl",
      formattingLanguages: Object.freeze(["pl", "en-US"]),
    });
  });

  it("only offers the English-first browser option when it would change behavior", () => {
    expect(
      canPreferEnglish({
        language: "pl",
        languages: ["pl"],
      }),
    ).toBe(true);

    expect(
      canPreferEnglish({
        language: "en-US",
        languages: ["en-US", "pl"],
      }),
    ).toBe(false);
  });

  it("drops redundant English-first preference when the primary locale is already English", () => {
    expect(
      normalizeLocationLocales({
        language: "en-US",
        languages: ["en-US", "pl"],
        preferEnglishContent: true,
      }).preferEnglishContent,
    ).toBe(false);
  });

  it("keeps built-in example locations inside the active browser catalog", () => {
    for (const location of EXAMPLE_LOCATIONS) {
      expect(
        isLocaleSupported(location.language),
        `${location.id} primary language`,
      ).toBe(true);
      for (const language of location.languages) {
        expect(isLocaleSupported(language), `${location.id} language ${language}`).toBe(
          true,
        );
      }
    }
  });
});
