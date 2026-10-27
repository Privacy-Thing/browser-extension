import type { LocaleGlossary } from "./types";
import { ZH_GLOSSARY, ZH_REGIONAL_FORBIDDEN, type ZhVariant } from "./zh-glossary";

import type { UiLocale } from "@/shared/ui-locale";

/** The glossary of one Chinese variant in the shape every locale glossary uses. */
const zhGlossary = (variant: ZhVariant): LocaleGlossary => ({
  terms: ZH_GLOSSARY.map((entry) => ({
    id: entry.id,
    english: entry.english,
    ...(entry.required ? { required: entry.required } : {}),
    ...(entry.exempt ? { exempt: entry.exempt } : {}),
    term: entry[variant].term,
    ...(entry[variant].alternatives
      ? { alternatives: entry[variant].alternatives }
      : {}),
    ...(entry[variant].forbidden ? { forbidden: entry[variant].forbidden } : {}),
  })),
  forbidden: Object.keys(ZH_REGIONAL_FORBIDDEN[variant]),
});

/** Glossaries enforced by the locale copy tests. Add one when a locale gets a glossary. */
export const LOCALE_GLOSSARIES: Partial<Record<UiLocale, LocaleGlossary>> = {
  "zh-CN": zhGlossary("zh-CN"),
  "zh-TW": zhGlossary("zh-TW"),
};

export type { GlossaryTerm, LocaleGlossary } from "./types";
