import { describe, expect, it } from "vitest";

import { LOCALE_GLOSSARIES } from "./glossary";
import {
  NON_TAIWAN_VARIANT_CHARACTERS,
  SIMPLIFIED_ONLY_CHARACTERS,
  TRADITIONAL_ONLY_CHARACTERS,
} from "./glossary/zh-script-charsets.generated";
import {
  assembledSentences,
  forbiddenTermProblems,
  isFragmentPath,
  localeEntries,
  MAIN_CATALOGS,
  SAMPLE_TEXT_PATTERN,
} from "./testing/catalog-checks";
import { unreviewedLocaleNotices } from "./translation-review";

/*
 * Script rules for the machine-translated Chinese catalogs. Shape, interpolation,
 * glossary, leftover English and width run for every locale in locale-copy.test.ts;
 * this file adds what only applies to Chinese: character sets per script, punctuation
 * and spacing, and the sentences assembled from fragments. Terms and conventions live
 * in ./glossary/zh-glossary.ts.
 *
 * House style for both catalogs (Chrome and Firefox zh-CN / zh-TW do the same):
 * full-width punctuation in Chinese sentences, one half-width space between Chinese
 * and Latin letters or digits, no space next to full-width punctuation, “” quotes in
 * zh-CN and 「」 quotes in zh-TW, ——, and … for ellipses.
 */

const VARIANTS = ["zh-CN", "zh-TW"] as const;

const HAN = "\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff";
const FULL_WIDTH_PUNCTUATION = "，。、；：！？（）“”「」『』《》——…";

const punctuationProblems = (text: string, path: string): string[] => {
  const problems: string[] = [];
  const masked = text.replace(SAMPLE_TEXT_PATTERN, "⟦⟧");
  const check = (pattern: RegExp, message: string) => {
    const match = pattern.exec(masked);
    if (match)
      problems.push(
        `${message}: …${masked.slice(Math.max(0, match.index - 8), match.index + 10)}…`,
      );
  };
  check(new RegExp(`[${HAN}][,;:!?]`), "half-width punctuation after Chinese");
  check(new RegExp(`[${HAN}]\\.(?!\\w)`), "half-width full stop after Chinese");
  check(
    new RegExp(`[${HAN}][A-Za-z0-9]|[A-Za-z0-9%][${HAN}]`),
    "missing space between Chinese and Latin or digits",
  );
  check(
    new RegExp(
      `[${FULL_WIDTH_PUNCTUATION.replace("——", "—")}] | [${FULL_WIDTH_PUNCTUATION.replace("——", "—")}]`,
    ),
    "space next to full-width punctuation",
  );
  check(/(?<!—)—(?!—)/, "single em dash; use —— or ·");
  check(/\.\.\./, "three dots; use …");
  check(
    new RegExp(`\\([^()]*[${HAN}][^()]*\\)`),
    "half-width parentheses around Chinese",
  );
  check(new RegExp(`"[^"]*[${HAN}][^"]*"`), "ASCII quotes around Chinese");
  check(new RegExp(`[${HAN}] [${HAN}]`), "space between Chinese characters");
  check(/ {2,}/, "double space");
  check(/\t|\u00a0|\u3000/, "tab, non-breaking or ideographic space");
  if (!isFragmentPath(path)) check(/^\s|\s$/, "leading or trailing whitespace");
  return problems;
};

describe.each(VARIANTS)("%s script rules", (variant) => {
  const notice = {
    path: "translationReview.notice",
    translated: unreviewedLocaleNotices[variant] ?? "<missing>",
  };
  const strings = [...localeEntries(variant), notice];

  it("marks the catalog as not reviewed by a native speaker", () => {
    expect(unreviewedLocaleNotices[variant]).toBeTruthy();
  });

  it("uses only characters of its own script", () => {
    const forbidden =
      variant === "zh-CN"
        ? new Set(TRADITIONAL_ONLY_CHARACTERS)
        : new Set([...SIMPLIFIED_ONLY_CHARACTERS, ...NON_TAIWAN_VARIANT_CHARACTERS]);
    const problems = strings.flatMap((entry) => {
      const characters = [
        ...new Set(
          [...entry.translated].filter((character) => forbidden.has(character)),
        ),
      ];
      return characters.length > 0 ? [`${entry.path}: ${characters.join("")}`] : [];
    });
    expect(problems).toEqual([]);
  });

  it("keeps the review notice free of forbidden terms", () => {
    const glossary = LOCALE_GLOSSARIES[variant];
    expect(glossary).toBeDefined();
    if (glossary) expect(forbiddenTermProblems([notice], glossary)).toEqual([]);
  });

  it("follows the Chinese punctuation and spacing conventions", () => {
    const problems = strings.flatMap((entry) =>
      punctuationProblems(entry.translated, entry.path).map(
        (problem) => `${entry.path}: ${problem}`,
      ),
    );
    expect(problems).toEqual([]);
  });

  it("assembles split fragments into complete sentences", () => {
    const catalog = MAIN_CATALOGS[variant];
    expect(catalog.common.typography).toEqual({
      fragmentSpace: "",
      fullStop: "。",
      listSeparator: "、",
    });
    const problems = Object.entries(assembledSentences(catalog)).flatMap(
      ([id, sentence]) => [
        ...punctuationProblems(sentence, id).map((problem) => `${id}: ${problem}`),
        ...(/[。！？]$/.test(sentence)
          ? []
          : [`${id}: does not end a sentence: ${sentence}`]),
      ],
    );
    expect(problems).toEqual([]);
  });
});
