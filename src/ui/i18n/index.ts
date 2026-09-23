import { en } from "./en";
import { es } from "./es";
import { pt } from "./pt";
import { ru } from "./ru";
import { uk } from "./uk";

export type UiLocale = "en" | "es" | "pt" | "ru" | "uk";

export const resolveUiLocale = (language: string | undefined): UiLocale => {
  const baseLanguage = language?.toLowerCase().split("-")[0];
  return baseLanguage === "es" ||
    baseLanguage === "pt" ||
    baseLanguage === "ru" ||
    baseLanguage === "uk"
    ? baseLanguage
    : "en";
};

export const UI_LOCALE = resolveUiLocale(globalThis.navigator?.language);
export const t = { en, es, pt, ru, uk }[UI_LOCALE];

if (typeof document !== "undefined") {
  document.documentElement.lang = UI_LOCALE;
}

export type { Translations } from "./types";
