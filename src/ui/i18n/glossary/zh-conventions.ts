/** Conventions shared by the Chinese catalogs; enforced by chinese-copy.test.ts. */

export type ZhVariant = "zh-CN" | "zh-TW";

/**
 * Second-person pronoun per catalog. To switch zh-CN to the polite form, set
 * `use: "您", avoid: "你"` and replace 你 with 您 in the zh-CN catalogs and the zh-CN
 * release notices (about 146 occurrences, one mechanical replacement); the copy test
 * then confirms that nothing else changed.
 */
export const ZH_REGISTER: Readonly<Record<ZhVariant, { use: string; avoid: string }>> =
  {
    "zh-CN": { use: "你", avoid: "您" },
    "zh-TW": { use: "你", avoid: "您" },
  };

/**
 * The feature name Trusted Sites is quoted when a sentence refers to it, so it does not
 * read as “a trusted website”; headings, labels and button text carry no quotes. A
 * string counts as a sentence when it has sentence punctuation (，。；、：).
 */
export const QUOTED_FEATURE_NAMES: Readonly<
  Record<ZhVariant, { term: string; open: string; close: string }>
> = {
  "zh-CN": { term: "受信任的网站", open: "“", close: "”" },
  "zh-TW": { term: "受信任的網站", open: "「", close: "」" },
};

/** The glossary entry for the second-person pronoun of a catalog. */
export const registerChoice = (variant: ZhVariant) => ({
  term: ZH_REGISTER[variant].use,
  forbidden: [ZH_REGISTER[variant].avoid],
});
