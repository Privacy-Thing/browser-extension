import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  buildLocalePrefs,
  findSupportedLocale,
  getLocaleCatalogEntry,
  normalizeLocaleConfig,
  type BrowserLocaleTarget,
} from "@/shared/locale-catalog";
import { osmCountryLanguageMap } from "@/shared/osm-country-languages.generated";

export type CountryLocaleOption = {
  value: string;
  label: string;
  language: string;
  languages: string[];
};

export type CountryLocaleMatch = {
  options: CountryLocaleOption[];
  selectedValue: string;
  required: boolean;
};

const FALLBACK_LANGUAGE = "en";

const buildFallbackOption = (
  target: BrowserLocaleTarget = BUILD_BROWSER_TARGET,
): CountryLocaleOption => {
  const locale = findSupportedLocale(FALLBACK_LANGUAGE, target) ?? FALLBACK_LANGUAGE;
  const normalized = normalizeLocaleConfig(
    {
      language: locale,
      languages: buildLocalePrefs(locale),
    },
    target,
  );

  return {
    value: normalized.language,
    label:
      getLocaleCatalogEntry(normalized.language)?.label ??
      `${normalized.language} [${normalized.language}]`,
    language: normalized.language,
    languages: normalized.languages,
  };
};

const resolveCountryLocale = (
  sourceLanguageCode: string,
  countryCode: string,
  target: BrowserLocaleTarget,
): CountryLocaleOption | null => {
  const normalizedCountryCode = countryCode.toUpperCase();
  const locale =
    findSupportedLocale(`${sourceLanguageCode}-${normalizedCountryCode}`, target) ??
    findSupportedLocale(sourceLanguageCode, target);

  if (!locale) {
    return null;
  }

  const normalized = normalizeLocaleConfig(
    {
      language: locale,
      languages: buildLocalePrefs(locale),
    },
    target,
  );

  return {
    value: normalized.language,
    label:
      getLocaleCatalogEntry(normalized.language)?.label ??
      `${normalized.language} [${normalized.language}]`,
    language: normalized.language,
    languages: normalized.languages,
  };
};

export const matchCountryCodeToLocale = (
  countryCode: string | undefined,
  target: BrowserLocaleTarget = BUILD_BROWSER_TARGET,
): CountryLocaleMatch => {
  const fallback = buildFallbackOption(target);
  if (!countryCode) {
    return {
      options: [fallback],
      selectedValue: fallback.value,
      required: false,
    };
  }

  const normalizedCountryCode = countryCode.toLowerCase();
  const sourceLanguageCodes = osmCountryLanguageMap[normalizedCountryCode] ?? [];
  const optionsByValue = new Map<string, CountryLocaleOption>();

  for (const sourceLanguageCode of sourceLanguageCodes) {
    const resolved = resolveCountryLocale(
      sourceLanguageCode,
      normalizedCountryCode,
      target,
    );
    if (!resolved || optionsByValue.has(resolved.value)) {
      continue;
    }
    optionsByValue.set(resolved.value, resolved);
  }

  const options = [...optionsByValue.values()];
  if (options.length === 0) {
    return {
      options: [fallback],
      selectedValue: fallback.value,
      required: false,
    };
  }

  return {
    options,
    selectedValue: options.length > 1 ? "" : options[0]!.value,
    required: options.length > 1,
  };
};
