import { describe, expect, it } from "vitest";

import { LOCALE_GLOSSARIES } from "./glossary";
import {
  assembledSentences,
  brokenEntries,
  changedTechnicalValues,
  forbiddenTermProblems,
  interpolationProblems,
  localeEntries,
  MAIN_CATALOGS,
  notices,
  requiredTermProblems,
  spacedSentenceProblems,
  TRANSLATED_LOCALES,
  type Script,
  type TranslatedLocale,
  unknownParameters,
  untranslatedEntries,
  type WidthBudget,
  widthProblems,
} from "./testing/catalog-checks";

/*
 * Checks every translated locale against English: catalog shape and message arguments,
 * interpolation, technical values, leftover English, glossary terms, width and the
 * sentences the UI assembles from fragments. A new locale only needs a profile here.
 * Script-specific rules live in per-script tests (chinese-copy.test.ts).
 */

type LocaleProfile = { script: Script; width: WidthBudget };

// Width counts full-width (CJK) characters as 2 columns. Spanish, Portuguese and the
// Slavic languages run longer than English; Chinese runs shorter per column.
const LOCALE_PROFILES = {
  es: { script: "latin", width: { ratio: 2.6, slack: 20 } },
  pt: { script: "latin", width: { ratio: 2.6, slack: 20 } },
  ru: { script: "cyrillic", width: { ratio: 2.6, slack: 20 } },
  uk: { script: "cyrillic", width: { ratio: 2.6, slack: 20 } },
  "zh-CN": { script: "han", width: { ratio: 1.25, slack: 4 } },
  "zh-TW": { script: "han", width: { ratio: 1.25, slack: 4 } },
} as const satisfies Record<TranslatedLocale, LocaleProfile>;

describe.each(TRANSLATED_LOCALES)("%s copy", (locale) => {
  const entries = localeEntries(locale);
  const profile: LocaleProfile = LOCALE_PROFILES[locale];
  const glossary = LOCALE_GLOSSARIES[locale];

  it("matches the English catalog shape and renders every message", () => {
    expect(
      [...unknownParameters],
      "add new parameter names to PARAMETER_KINDS",
    ).toEqual([]);
    expect(brokenEntries(entries)).toEqual([]);
  });

  it("keeps every interpolated value, number, brand and placeholder", () => {
    expect(interpolationProblems(entries)).toEqual([]);
  });

  it("keeps technical values identical and translates every sentence", () => {
    expect(changedTechnicalValues(entries)).toEqual([]);
    expect(untranslatedEntries(entries, profile.script)).toEqual([]);
  });

  it.runIf(glossary)("follows the locale glossary", () => {
    if (!glossary) return;
    expect(forbiddenTermProblems(entries, glossary)).toEqual([]);
    expect(requiredTermProblems(entries, glossary)).toEqual([]);
  });

  it("stays within the width budget of the English strings", () => {
    expect(widthProblems(entries, profile.width)).toEqual([]);
  });

  it.runIf(profile.script !== "han")("assembles split fragments into sentences", () => {
    expect(spacedSentenceProblems(assembledSentences(MAIN_CATALOGS[locale]))).toEqual(
      [],
    );
  });

  it("translates every release notice completely", () => {
    for (const notice of notices) {
      expect(notice.title[locale], notice.id).toBeTruthy();
      expect(notice.message[locale], notice.id).toHaveLength(
        notice.message.en?.length ?? 0,
      );
    }
  });
});
