import { en } from "./en";
import { es } from "./es";
import { pt } from "./pt";

export type UiLocale = "en" | "es" | "pt";

export const resolveUiLocale = (language: string | undefined): UiLocale => {
  const baseLanguage = language?.toLowerCase().split("-")[0];
  return baseLanguage === "es" || baseLanguage === "pt" ? baseLanguage : "en";
};

export const UI_LOCALE = resolveUiLocale(globalThis.navigator?.language);
export const t = { en, es, pt }[UI_LOCALE];

if (typeof document !== "undefined") {
  document.documentElement.lang = UI_LOCALE;
}

export type { Translations } from "./types";
