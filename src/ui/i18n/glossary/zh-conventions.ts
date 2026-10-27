/** Conventions shared by the Chinese catalogs; enforced by chinese-copy.test.ts. */

export type ZhVariant = "zh-CN" | "zh-TW";

/**
 * Second-person pronoun per catalog, enforced as a required-use and forbidden-word
 * check. zh-CN uses the polite 您 (Chromium and Mozilla support zh-CN do); zh-TW keeps the
 * plain 你 (Chromium zh-TW does). Changing a catalog is `use`/`avoid` here plus one
 * replacement of the pronoun in that catalog and its release notices.
 */
export const ZH_REGISTER: Readonly<Record<ZhVariant, { use: string; avoid: string }>> =
  {
    "zh-CN": { use: "您", avoid: "你" },
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
