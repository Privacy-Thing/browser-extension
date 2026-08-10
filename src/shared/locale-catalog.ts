import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  localeCatalog,
  localeOptionsByTarget,
  type BrowserLocaleCatalogEntry,
  type BrowserLocaleOption,
  type BrowserLocaleTarget,
} from "@/shared/locale-catalog.generated";
import type { Location, RuntimeSnapshot } from "@/shared/types";

export type { BrowserLocaleTarget } from "@/shared/locale-catalog.generated";

const localeByLowerValue = new Map(
  localeCatalog.map((entry) => [entry.value.toLowerCase(), entry]),
);

const localeValuesByTarget = {
  chromium: new Set(
    localeOptionsByTarget.chromium.map((entry) => entry.value.toLowerCase()),
  ),
  firefox: new Set(
    localeOptionsByTarget.firefox.map((entry) => entry.value.toLowerCase()),
  ),
} satisfies Record<BrowserLocaleTarget, ReadonlySet<string>>;

const MANUAL_ALIAS_CANDIDATES: Record<string, readonly string[]> = {
  "ca-es-valencia": ["ca-valencia"],
  "ca-valencia": ["ca-es-valencia"],
  fil: ["tl"],
  tl: ["fil"],
  in: ["id"],
  iw: ["he"],
  ji: ["yi"],
  "zh-hans": ["zh-CN"],
  "zh-hans-cn": ["zh-CN"],
  "zh-hans-sg": ["zh-CN"],
  "zh-hant": ["zh-TW"],
  "zh-hant-tw": ["zh-TW"],
  "zh-hant-hk": ["zh-HK"],
  "zh-hant-mo": ["zh-HK"],
};

const toTitleCase = (value: string): string =>
  value.length === 0
    ? value
    : `${value[0]?.toUpperCase() ?? ""}${value.slice(1).toLowerCase()}`;

const normalizeLocaleSyntax = (raw: string): string =>
  raw
    .trim()
    .replace(/_/g, "-")
    .split("-")
    .filter((part) => part.length > 0)
    .map((part, index) => {
      if (index === 0) {
        return part.toLowerCase();
      }
      if (/^\d{3}$/.test(part) || /^[a-z]{2}$/i.test(part)) {
        return part.toUpperCase();
      }
      if (/^[a-z]{4}$/i.test(part)) {
        return toTitleCase(part);
      }
      return part.toLowerCase();
    })
    .join("-");

const pushCandidate = (candidates: string[], next: string): void => {
  if (!next) {
    return;
  }

  const normalized = normalizeLocaleSyntax(next);
  if (!normalized) {
    return;
  }

  if (
    !candidates.some(
      (candidate) => candidate.toLowerCase() === normalized.toLowerCase(),
    )
  ) {
    candidates.push(normalized);
  }
};

const buildChineseFallback = (tag: string): string | null => {
  const [language, ...subtags] = tag.split("-");
  if (language !== "zh") {
    return null;
  }

  const loweredSubtags = subtags.map((subtag) => subtag.toLowerCase());
  const region = loweredSubtags.find(
    (subtag) => /^\d{3}$/.test(subtag) || /^[a-z]{2}$/.test(subtag),
  );

  if (loweredSubtags.includes("hant")) {
    return region === "hk" || region === "mo" ? "zh-HK" : "zh-TW";
  }
  if (loweredSubtags.includes("hans")) {
    return "zh-CN";
  }
  if (region === "hk" || region === "mo") {
    return "zh-HK";
  }
  if (region === "tw") {
    return "zh-TW";
  }
  if (region === "cn" || region === "sg") {
    return "zh-CN";
  }

  return "zh";
};

const buildLocaleCandidates = (raw: string): string[] => {
  const syntaxNormalized = normalizeLocaleSyntax(raw);
  const candidates: string[] = [];

  pushCandidate(candidates, syntaxNormalized);

  try {
    for (const canonical of Intl.getCanonicalLocales(syntaxNormalized)) {
      pushCandidate(candidates, canonical);
    }
  } catch {
    // Preserve the best-effort syntax-normalized input for unknown tags.
  }

  for (const candidate of [...candidates]) {
    for (const alias of MANUAL_ALIAS_CANDIDATES[candidate.toLowerCase()] ?? []) {
      pushCandidate(candidates, alias);
    }
  }

  const chineseFallback = buildChineseFallback(syntaxNormalized);
  if (chineseFallback) {
    pushCandidate(candidates, chineseFallback);
  }

  const baseLanguage = syntaxNormalized.split("-")[0];
  if (baseLanguage) {
    pushCandidate(candidates, baseLanguage);
  }

  return candidates;
};

const resolveCatalogValue = (
  tag: string,
  target: BrowserLocaleTarget,
): string | null => {
  const lowerTag = tag.toLowerCase();
  if (!localeValuesByTarget[target].has(lowerTag)) {
    return null;
  }

  return localeByLowerValue.get(lowerTag)?.value ?? tag;
};

export const findSupportedLocale = (
  raw: string,
  target: BrowserLocaleTarget = BUILD_BROWSER_TARGET,
): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  for (const candidate of buildLocaleCandidates(trimmed)) {
    const resolved = resolveCatalogValue(candidate, target);
    if (resolved) {
      return resolved;
    }
  }

  return null;
};

export const getLocaleCatalogEntry = (
  value: string,
): BrowserLocaleCatalogEntry | null =>
  localeByLowerValue.get(value.toLowerCase()) ?? null;

/** Human-readable English locale name without the catalog's technical tag suffix. */
export const getLocaleDisplayName = (value: string): string => {
  const label = getLocaleCatalogEntry(value)?.label;
  if (!label) return value;

  const suffixStart = label.lastIndexOf(" [");
  return suffixStart >= 0 && label.endsWith("]") ? label.slice(0, suffixStart) : label;
};

export const getLocaleOptions = (
  target: BrowserLocaleTarget,
): readonly BrowserLocaleOption[] => localeOptionsByTarget[target];

export const isLocaleSupported = (
  value: string,
  target: BrowserLocaleTarget = BUILD_BROWSER_TARGET,
): boolean => localeValuesByTarget[target].has(value.toLowerCase());

export const normalizeLocaleTag = (
  raw: string,
  target: BrowserLocaleTarget = BUILD_BROWSER_TARGET,
): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  const syntaxNormalized = normalizeLocaleSyntax(trimmed);
  const supported = findSupportedLocale(trimmed, target);
  if (supported) {
    return supported;
  }

  return (
    localeByLowerValue.get(syntaxNormalized.toLowerCase())?.value ?? syntaxNormalized
  );
};

const splitLocaleList = (languages: readonly string[]): string[] =>
  languages
    .flatMap((language) => language.split(","))
    .map((language) => language.trim())
    .filter((language) => language.length > 0);

const dedupeLocaleList = (languages: readonly string[]): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const language of languages) {
    const key = language.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(language);
  }

  return deduped;
};

const getBaseLanguage = (language: string): string =>
  language.split("-")[0]?.toLowerCase() ?? "";

export const buildLocalePrefs = (language: string): string[] => {
  const baseLanguage = getBaseLanguage(language);
  return baseLanguage && baseLanguage !== language.toLowerCase()
    ? [language, baseLanguage]
    : [language];
};

export const normalizeLocaleConfig = (
  value: Pick<Location, "language" | "languages">,
  target: BrowserLocaleTarget = BUILD_BROWSER_TARGET,
): Pick<Location, "language" | "languages"> => {
  const normalizedLanguage = normalizeLocaleTag(value.language, target);
  const normalizedLanguages = dedupeLocaleList(
    splitLocaleList(value.languages)
      .map((language) => normalizeLocaleTag(language, target))
      .filter((language) => language.length > 0),
  );

  const primaryLanguage =
    normalizedLanguage ||
    normalizedLanguages[0] ||
    normalizeLocaleSyntax(value.language) ||
    value.language.trim();
  const alignedLanguages = dedupeLocaleList([
    primaryLanguage,
    ...normalizedLanguages.filter(
      (language) => language.toLowerCase() !== primaryLanguage.toLowerCase(),
    ),
  ]);

  return {
    language: primaryLanguage,
    languages: alignedLanguages.length > 0 ? alignedLanguages : [primaryLanguage],
  };
};

export const getEnglishLocale = (
  target: BrowserLocaleTarget = BUILD_BROWSER_TARGET,
): string => normalizeLocaleTag("en", target) || "en";

export const canPreferEnglish = (
  value: Pick<Location, "language" | "languages">,
  target: BrowserLocaleTarget = BUILD_BROWSER_TARGET,
): boolean => {
  const normalized = normalizeLocaleConfig(value, target);
  const englishBaseLanguage = getBaseLanguage(getEnglishLocale(target));
  const primaryLanguageIsEnglish =
    getBaseLanguage(normalized.language) === englishBaseLanguage;
  const includesEnglish = normalized.languages.some(
    (language) => getBaseLanguage(language) === englishBaseLanguage,
  );

  return !primaryLanguageIsEnglish || !includesEnglish;
};

export const getRuntimeLocale = (
  value: Pick<Location, "language" | "languages" | "preferEnglishContent">,
  target: BrowserLocaleTarget = BUILD_BROWSER_TARGET,
): Omit<RuntimeSnapshot["locale"], "timeZone" | "acceptLanguage"> => {
  const normalized = normalizeLocaleConfig(value, target);
  const formattingLanguage = normalized.language;
  const formattingLanguages = Object.freeze([...normalized.languages]);

  if (value.preferEnglishContent !== true || !canPreferEnglish(value, target)) {
    return {
      language: normalized.language,
      languages: Object.freeze([...normalized.languages]),
      formattingLanguage,
      formattingLanguages,
    };
  }

  const englishLocale = getEnglishLocale(target);
  const languages = dedupeLocaleList([
    englishLocale,
    ...normalized.languages.filter(
      (language) => getBaseLanguage(language) !== getBaseLanguage(englishLocale),
    ),
  ]);

  return {
    language: englishLocale,
    languages: Object.freeze(languages),
    formattingLanguage,
    formattingLanguages,
  };
};

export const normalizeLocationLocales = <
  T extends Pick<Location, "language" | "languages"> & {
    preferEnglishContent?: boolean;
  },
>(
  value: T,
  target: BrowserLocaleTarget = BUILD_BROWSER_TARGET,
): T => ({
  ...value,
  ...normalizeLocaleConfig(value, target),
  preferEnglishContent:
    value.preferEnglishContent === true && canPreferEnglish(value, target),
});

export const normalizeLocations = (
  locations: readonly Location[],
  target: BrowserLocaleTarget = BUILD_BROWSER_TARGET,
): Location[] =>
  locations.map((location) => normalizeLocationLocales(location, target));
