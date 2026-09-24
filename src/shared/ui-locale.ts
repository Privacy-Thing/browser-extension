export const UI_LOCALE_PREFERENCES = ["auto", "en", "es", "pt", "ru", "uk"] as const;

export type UiLocalePreference = (typeof UI_LOCALE_PREFERENCES)[number];

export const UI_LOCALES = ["en", "es", "pt", "ru", "uk"] as const;

export type UiLocale = (typeof UI_LOCALES)[number];

export const isUiLocalePreference = (value: unknown): value is UiLocalePreference =>
  typeof value === "string" &&
  (UI_LOCALE_PREFERENCES as readonly string[]).includes(value);

export const isUiLocale = (value: string): value is UiLocale =>
  (UI_LOCALES as readonly string[]).includes(value);
