import type { UiLocale } from "@/shared/ui-locale";

export const languageOptionLabel = (
  activeLocale: UiLocale,
  englishName: string,
  localizedName: string,
): string =>
  activeLocale === "en" ? englishName : `${englishName} (${localizedName})`;
