import type { BrowserFingerprintSource } from "@/shared/browser-fingerprint";
import { detectBrowserFamily } from "@/shared/browser-fingerprint";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";

export type AcceptLanguagePolicy = "chromium" | "firefox" | "brave";

const dedupeLanguages = (languages: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const language of languages) {
    const trimmed = language.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
};

const getBaseLanguage = (language: string): string =>
  language.split("-")[0]?.toLowerCase() ?? "";

const formatWeightedLanguage = (language: string, index: number): string => {
  if (index === 0) {
    return language;
  }

  const quality = Math.max(1 - index * 0.1, 0.1);
  return `${language};q=${quality.toFixed(1)}`;
};

const expandChromiumLanguages = (languages: readonly string[]): string[] => {
  const deduped = dedupeLanguages(languages);
  const expanded: string[] = [];
  const seen = new Set<string>();

  const pushLanguage = (language: string): void => {
    const key = language.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    expanded.push(language);
  };

  for (const [index, language] of deduped.entries()) {
    pushLanguage(language);

    const baseLanguage = getBaseLanguage(language);
    if (!baseLanguage || baseLanguage === language.toLowerCase()) {
      continue;
    }

    const nextLanguage = deduped[index + 1];
    if (nextLanguage && getBaseLanguage(nextLanguage) === baseLanguage) {
      continue;
    }

    pushLanguage(baseLanguage);
  }

  return expanded;
};

export const detectLanguagePolicy = (
  source?: BrowserFingerprintSource,
): AcceptLanguagePolicy => {
  const brands = [
    ...(source?.userAgentData?.brands ?? []),
    ...(source?.userAgentData?.fullVersionList ?? []),
  ];

  if (brands.some((brand) => brand.brand === "Brave")) {
    return "brave";
  }

  const browserFamily = detectBrowserFamily(source?.userAgent);
  if (browserFamily === "firefox") {
    return "firefox";
  }

  if (browserFamily === "chromium") {
    return "chromium";
  }

  return BUILD_BROWSER_TARGET === "firefox" ? "firefox" : "chromium";
};

export const serializeAcceptLanguage = (
  languages: readonly string[],
  policy: AcceptLanguagePolicy,
): string => {
  const deduped = dedupeLanguages(languages);
  if (deduped.length === 0) {
    return "";
  }

  if (policy === "brave") {
    return deduped[0] ?? "";
  }

  const serializedLanguages =
    policy === "chromium" ? expandChromiumLanguages(deduped) : deduped;

  return serializedLanguages
    .map((language, index) => formatWeightedLanguage(language, index))
    .join(",");
};
