import { cloneLocaleLanguages } from "./locale-getters";

export type IntlDefaults = {
  languages: readonly string[];
  timeZone: string;
};

export const createIntlDefaults = (
  languages: readonly string[],
  timeZone: string,
): IntlDefaults => ({
  languages,
  timeZone,
});

/**
 * Applies the spoofed locale fallback only when the page did not provide an
 * explicit locale list. Firefox can pass `null` here before its mutable
 * time/locale state arrives, so the helper must preserve the original input.
 */
export const withDefaultLocales = (
  locales: Intl.LocalesArgument | undefined,
  defaults: IntlDefaults | null,
): Intl.LocalesArgument | undefined => {
  return locales ?? (defaults ? cloneLocaleLanguages(defaults.languages) : undefined);
};

/**
 * Applies the spoofed timezone fallback only when the page did not provide an
 * explicit `timeZone`. The returned object is always a shallow clone when
 * defaults are present so callers can safely pass page-owned option bags.
 */
export const withDefaultTimeZone = <TOptions extends Intl.DateTimeFormatOptions>(
  options: TOptions | undefined,
  defaults: IntlDefaults | null,
): TOptions | undefined => {
  if (!defaults) {
    return options;
  }

  const nextOptions = options ? { ...options } : ({} as TOptions);
  nextOptions.timeZone = nextOptions.timeZone ?? defaults.timeZone;
  return nextOptions;
};

export const INTL_DEFAULTS_SOURCE = `
  const withDefaultLocales = (locales, defaults) => {
    return locales ?? (defaults ? cloneLocaleLanguages(defaults.languages) : undefined);
  };

  const withDefaultTimeZone = (options, defaults) => {
    if (!defaults) {
      return options;
    }

    const nextOptions = options ? { ...options } : {};
    nextOptions.timeZone = nextOptions.timeZone ?? defaults.timeZone;
    return nextOptions;
  };

  const createIntlDefaults = (languages, timeZone) => ({
    languages,
    timeZone
  });
`;
