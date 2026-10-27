import type { SurfacePresentationState } from "@privacy-brand/xray-protocol";

import { en } from "../en";
import { es } from "../es";
import type { LocaleGlossary } from "../glossary";
import { applyUiLocalePreference } from "../index";
import { pt } from "../pt";
import { ru } from "../ru";
import type { LocaleCatalog } from "../types";
import { uk } from "../uk";
import { zhCN } from "../zh-CN";
import { zhTW } from "../zh-TW";

import { ALLOWED_LATIN, trimTrailing } from "./allowed-latin";

import { cleanupEn } from "@/experimental/control-d/cleanup-copy-en";
import { cleanupEs } from "@/experimental/control-d/cleanup-copy-es";
import { cleanupPt } from "@/experimental/control-d/cleanup-copy-pt";
import { cleanupRu } from "@/experimental/control-d/cleanup-copy-ru";
import { cleanupUk } from "@/experimental/control-d/cleanup-copy-uk";
import { cleanupZhCN } from "@/experimental/control-d/cleanup-copy-zh-CN";
import { cleanupZhTW } from "@/experimental/control-d/cleanup-copy-zh-TW";
import { controlDEn } from "@/experimental/control-d/ui-copy-en";
import { controlDEs } from "@/experimental/control-d/ui-copy-es";
import { controlDPt } from "@/experimental/control-d/ui-copy-pt";
import { controlDRu } from "@/experimental/control-d/ui-copy-ru";
import { controlDUk } from "@/experimental/control-d/ui-copy-uk";
import { controlDZhCN } from "@/experimental/control-d/ui-copy-zh-CN";
import { controlDZhTW } from "@/experimental/control-d/ui-copy-zh-TW";
import { featureText } from "@/experimental/control-d/ui-feature-copy";
import { controlDRuleFeatureCopy } from "@/experimental/control-d/ui-rule-feature-copy";
import { explanationCopy } from "@/experimental/control-d/ui-rule-feature-explanation-copy";
import {
  BRAND_DIAGNOSTICS_NAME,
  BRAND_DISPLAY_NAME,
  BRAND_ENGINE_NAME,
} from "@/shared/brand";
import notificationCatalog from "@/shared/extension-notifications.json";
import { UI_LOCALES, type UiLocale } from "@/shared/ui-locale";
import { featurePendingCopy } from "@/ui/components/provider-feature/provider-feature-copy";
import { ruleGroupCopy } from "@/ui/shared/rule-group-copy";

/*
 * Locale-independent checks shared by the translation tests. Every catalog keyed by
 * UI locale is flattened into English/translated pairs; messages are rendered with
 * sample arguments so interpolation can be compared. Script-specific rules (CJK
 * punctuation, character sets) live in the per-script tests such as
 * chinese-copy.test.ts. The procedure is in .agents/skills/ui-translation/SKILL.md.
 */

export type TranslatedLocale = Exclude<UiLocale, "en">;

export const TRANSLATED_LOCALES = UI_LOCALES.filter(
  (locale): locale is TranslatedLocale => locale !== "en",
);

export type Entry = {
  /** Catalog path, with the argument variant for rendered messages. */
  path: string;
  english: string;
  translated: string;
  /** True for the main sample rendering of a message, used for parity checks. */
  primary: boolean;
};

// ─── Sample arguments ──────────────────────────────────────────────────────────

type ArgumentKind = "number" | "string" | "strings" | "boolean" | "counts";

/** Message parameters by name; an unknown name fails the shape test. */
const PARAMETER_KINDS: Readonly<Record<string, ArgumentKind>> = {
  a: "number",
  count: "number",
  e: "number",
  extra: "number",
  f: "number",
  index: "number",
  minutes: "number",
  p: "number",
  r: "number",
  selected: "number",
  total: "number",
  u: "number",
  languages: "strings",
  hosts: "strings",
  counts: "counts",
  enabled: "boolean",
  available: "string",
  category: "string",
  code: "string",
  first: "string",
  hostname: "string",
  label: "string",
  locale: "string",
  location: "string",
  locationLabel: "string",
  message: "string",
  name: "string",
  provider: "string",
  pattern: "string",
  saved: "string",
  scope: "string",
  second: "string",
  section: "string",
  service: "string",
  suggested: "string",
  surface: "string",
  _surface: "string",
  time: "string",
  timeZone: "string",
  unavailable: "string",
  value: "string",
  versionToken: "string",
  zone: "string",
};

const SURFACE_STATES: readonly SurfacePresentationState[] = [
  "not-applicable",
  "native-by-policy",
  "unrecoverable",
  "degraded",
  "pending",
  "repaired",
  "browser-enforced",
  "protected",
  "unknown",
];

/** Interpolated text is marked so spacing checks can skip its boundaries. */
const sampleText = (index: number, item = 0) =>
  `⟦${String.fromCharCode(97 + index)}${item || ""}⟧`;
export const SAMPLE_TEXT_PATTERN = /⟦[a-z]\d*⟧/g;

type RenderVariant = { id: string; numbers: (index: number) => number; items: number };

const RENDER_VARIANTS: readonly RenderVariant[] = [
  { id: "sample", numbers: (index) => 37 + index * 11, items: 3 },
  { id: "one", numbers: () => 1, items: 1 },
  { id: "two", numbers: () => 2, items: 2 },
  { id: "zero", numbers: () => 0, items: 1 },
];

const parameterNames = (message: (...args: never[]) => unknown): string[] => {
  const source = message.toString();
  const head = source
    .slice(0, source.indexOf("=>"))
    .replace(/^async\b/, "")
    .trim();
  const list = head.startsWith("(") ? head.slice(1, head.lastIndexOf(")")) : head;
  return list
    .split(",")
    .map((name) => name.split(/[:=]/)[0]?.trim() ?? "")
    .filter(Boolean);
};

const sampleArgument = (
  kind: ArgumentKind,
  index: number,
  variant: RenderVariant,
): unknown => {
  switch (kind) {
    case "number":
      return variant.numbers(index);
    case "string":
      return sampleText(index);
    case "strings":
      return Array.from({ length: variant.items }, (_, item) =>
        sampleText(index, item + 1),
      );
    case "boolean":
      return variant.id !== "zero";
    case "counts":
      return Object.fromEntries(
        SURFACE_STATES.map((state, stateIndex) => [
          state,
          variant.id === "sample" ? stateIndex + 3 : variant.numbers(stateIndex),
        ]),
      );
  }
};

export const unknownParameters = new Set<string>();

// ─── Catalog flattening ────────────────────────────────────────────────────────

type Message = (...args: unknown[]) => unknown;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const missing = (value: unknown) => `<missing:${typeof value}>`;

const renderMessages = (
  english: Message,
  translated: unknown,
  path: string,
): Entry[] => {
  const kinds = parameterNames(english).map((name) => {
    const kind = PARAMETER_KINDS[name];
    if (!kind) unknownParameters.add(`${path}(${name})`);
    return kind ?? "string";
  });
  return RENDER_VARIANTS.map((variant) => {
    const args = kinds.map((kind, index) => sampleArgument(kind, index, variant));
    const render = (message: unknown) => {
      if (typeof message !== "function") return missing(message);
      try {
        return String((message as Message)(...args));
      } catch (error) {
        return `<threw:${String(error)}>`;
      }
    };
    return {
      path: `${path}(${variant.id})`,
      english: render(english),
      translated: render(translated),
      primary: variant.id === "sample",
    };
  });
};

const flatten = (english: unknown, translated: unknown, path: string): Entry[] => {
  if (typeof english === "string") {
    const text = typeof translated === "string" ? translated : missing(translated);
    return [{ path, english, translated: text, primary: true }];
  }
  if (typeof english === "function") {
    return renderMessages(english as Message, translated, path);
  }
  if (Array.isArray(english)) {
    const list = Array.isArray(translated) ? (translated as unknown[]) : [];
    return english.flatMap((item, index) =>
      flatten(item, list[index], `${path}.${index}`),
    );
  }
  if (!isRecord(english)) return [];
  const record = isRecord(translated) ? translated : {};
  return Object.keys(english).flatMap((key) =>
    flatten(english[key], record[key], path ? `${path}.${key}` : key),
  );
};

/** Copies a locale-following message proxy while that locale is active. */
const snapshot = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).map((key) => [key, snapshot(value[key])]),
  );
};
const readProxy = (proxy: object, locale: UiLocale) => {
  applyUiLocalePreference(locale);
  const copy = snapshot(proxy);
  applyUiLocalePreference("en");
  return copy;
};

// ─── Catalogs ──────────────────────────────────────────────────────────────────

/** Every catalog keyed by locale. A new locale fails type checking until it is added. */
export const MAIN_CATALOGS = {
  en,
  es,
  pt,
  ru,
  uk,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
} satisfies Record<UiLocale, LocaleCatalog>;

const CONTROL_D_CATALOGS = {
  en: controlDEn,
  es: controlDEs,
  pt: controlDPt,
  ru: controlDRu,
  uk: controlDUk,
  "zh-CN": controlDZhCN,
  "zh-TW": controlDZhTW,
} satisfies Record<UiLocale, object>;

const CLEANUP_CATALOGS = {
  en: cleanupEn,
  es: cleanupEs,
  pt: cleanupPt,
  ru: cleanupRu,
  uk: cleanupUk,
  "zh-CN": cleanupZhCN,
  "zh-TW": cleanupZhTW,
} satisfies Record<UiLocale, object>;

type NoticeCatalog = {
  notifications: Array<{
    id: string;
    title: Record<string, string>;
    message: Record<string, string[]>;
  }>;
};
export const notices = (notificationCatalog as NoticeCatalog).notifications;

const catalogPairs = (locale: TranslatedLocale): Array<[string, unknown, unknown]> => [
  ["", en, MAIN_CATALOGS[locale]],
  ["controlD", controlDEn, CONTROL_D_CATALOGS[locale]],
  ["controlDCleanup", cleanupEn, CLEANUP_CATALOGS[locale]],
  ["controlDFeature", readProxy(featureText, "en"), readProxy(featureText, locale)],
  ["controlDRuleFeature", controlDRuleFeatureCopy.en, controlDRuleFeatureCopy[locale]],
  ["controlDExplanation", explanationCopy.en, explanationCopy[locale]],
  ["ruleGroup", ruleGroupCopy.en, ruleGroupCopy[locale]],
  ["providerFeaturePending", featurePendingCopy.en, featurePendingCopy[locale]],
  [
    "notifications",
    Object.fromEntries(notices.map((notice) => [notice.id, notice.title.en])),
    Object.fromEntries(notices.map((notice) => [notice.id, notice.title[locale]])),
  ],
  [
    "notificationMessages",
    Object.fromEntries(notices.map((notice) => [notice.id, notice.message.en])),
    Object.fromEntries(notices.map((notice) => [notice.id, notice.message[locale]])),
  ],
];

const entryCache = new Map<TranslatedLocale, Entry[]>();

/** All English/translated pairs of a locale, across every catalog. */
export const localeEntries = (locale: TranslatedLocale): Entry[] => {
  const cached = entryCache.get(locale);
  if (cached) return cached;
  const entries = catalogPairs(locale).flatMap(([root, english, translated]) =>
    flatten(english, translated, root),
  );
  entryCache.set(locale, entries);
  return entries;
};

// ─── Shape and interpolation ───────────────────────────────────────────────────

export const brokenEntries = (entries: readonly Entry[]) =>
  entries
    .filter((entry) => /^<(?:missing|threw)/.test(entry.translated))
    .map((entry) => `${entry.path}: ${entry.translated}`);

const BRANDS = [BRAND_DISPLAY_NAME, BRAND_DIAGNOSTICS_NAME, BRAND_ENGINE_NAME];
const placeholders = (text: string) =>
  (text.match(/\{\{?[A-Za-z]+\}?\}|<[A-Z]+>|XXXXX-XXXXX/g) ?? []).sort().join();

const droppedValues = (entry: Entry): string[] => {
  const dropped = [
    ...(entry.english.match(SAMPLE_TEXT_PATTERN) ?? []).map(
      (value) => `argument ${value}`,
    ),
    ...(entry.english.match(/\d+(?:[.,:]\d+)*/g) ?? []).map(
      (value) => `number ${value}`,
    ),
    ...BRANDS.filter((brand) => entry.english.includes(brand)),
  ].filter(
    (label) => !entry.translated.includes(label.replace(/^(?:argument|number) /, "")),
  );
  const expected = placeholders(entry.english);
  const actual = placeholders(entry.translated);
  return [
    ...dropped.map((label) => `drops ${label}`),
    ...(expected === actual ? [] : [`placeholders ${expected} → ${actual}`]),
  ];
};

/** Dropped arguments, numbers, brands or placeholders, and rendering garbage. */
export const interpolationProblems = (entries: readonly Entry[]) =>
  entries.flatMap((entry) => {
    const garbage = /undefined|NaN|\[object |\$\{|\bnull\b/.test(entry.translated);
    const found = [
      ...(garbage ? ["garbage"] : []),
      ...(entry.primary ? droppedValues(entry) : []),
    ];
    return found.map((problem) => `${entry.path}: ${problem}`);
  });

// ─── Technical values and leftover English ─────────────────────────────────────

/** Paths whose value is code or a brand name and must equal English. */
const IDENTICAL_PATHS: readonly RegExp[] = [
  // Method names; webGLGetExtension is a description ("GPU renderer info") and is translated.
  /^sidebar\.accessed\.methods\.(?!webGLGetExtension$)/,
  /^about\.assets\.(?:fontAwesome|mapLibre|openFreeMap|openStreetMap)\.label$/,
  /^about\.assets\.localData\.chromiumDash\.label$/,
  /^about\.assets\.localData\.localeCatalog\.(?:mozilla|chromium)\.label$/,
  /^about\.assets\.osmWikiCountryCodes\.licenseLabel$/,
  /^about\.license\.creatorLabel$/,
  /^about\.support\.linkLabel$/,
];

/** URLs and JavaScript expressions such as `navigator.language` stay as they are. */
const isTechnicalValue = (text: string) => {
  if (/^https?:\/\/\S+$/.test(text)) return true;
  const code = text.startsWith("new ") ? text.slice(4) : text;
  return /^[A-Za-z_$][\w$.…()]*$/.test(code) && /[.…][A-Za-z_$]|\(\)/.test(code);
};

export const isIdentical = (entry: Pick<Entry, "path" | "english">) =>
  IDENTICAL_PATHS.some((pattern) => pattern.test(entry.path)) ||
  isTechnicalValue(entry.english);

/** Technical values that were translated although they must stay identical. */
export const changedTechnicalValues = (entries: readonly Entry[]) =>
  entries
    .filter((entry) => isIdentical(entry) && entry.translated !== entry.english)
    .map((entry) => `${entry.path}: ${entry.translated}`);

/** Paths allowed to keep English words, with the reason. */
export const LEFTOVER_EXEMPT: Readonly<Record<string, string>> = {
  "controlD.intro.names": "Discloses the literal Control D resource names.",
  "about.assets.osmWikiCountryCodes.label":
    "Title of an external page; may stay in English.",
  "about.assets.localData.steam.label":
    "Name of an external survey; may stay in English.",
  "controlDExplanation.customRules":
    "Control D dashboard feature name, kept as Control D shows it.",
  "controlDExplanation.tooltip": "Names the Control D dashboard feature Custom Rule.",
  "notificationMessages.privacy-thing-open-source.1": "Names the GitHub issue feature.",
};

/** Place names that many languages write the same way as English. */
const IDENTICAL_ALLOWED = /^welcome\.presetNames\./;

const PLACEHOLDER = /\{\{?[A-Za-z]+\}?\}/g;
const HTML_TAG = /<\/?[a-z]+\/?>/g;
const ROUTE_TOKEN = /<[A-Z]+>/g;

/** A word without trailing punctuation or the hyphen of a compound such as `IP-адрес`. */
const bareWord = (token: string) => trimTrailing(token, "-.:)");

const isNonWord = (word: string) =>
  ALLOWED_LATIN.has(word) ||
  // Code: navigator.language, a/b, call(), no_log, hostnames, camelCase identifiers.
  /[._/()=:]/.test(word) ||
  /^[a-z]+[A-Z][A-Za-z]*$/.test(word) ||
  // Acronyms and locale codes.
  /^[A-Z][A-Z0-9-]+$/.test(word) ||
  /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(word);

/** Latin words left in a non-Latin catalog that are not on the allowlist. */
export const leftoverEnglish = (text: string): string[] =>
  text
    .replace(SAMPLE_TEXT_PATTERN, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(PLACEHOLDER, " ")
    .replace(HTML_TAG, " ")
    .replace(ROUTE_TOKEN, " ")
    .split(/[^\w$.\-/()[\]<>=:@#*']+/)
    .map(bareWord)
    .filter((word) => /[A-Za-z]{2}/.test(word) && !isNonWord(word));

/** English function words that do not occur in Spanish or Portuguese copy. */
const ENGLISH_FUNCTION_WORDS = new Set(
  "the and your you with this that from will when which before after isn't can't don't doesn't".split(
    " ",
  ),
);

const englishFunctionWord = (text: string) =>
  text
    .toLowerCase()
    .match(/[a-z']+/g)
    ?.find((word) => ENGLISH_FUNCTION_WORDS.has(word));

export type Script = "latin" | "cyrillic" | "han";

/** Messages that still read as English. */
export const untranslatedEntries = (entries: readonly Entry[], script: Script) =>
  entries
    .filter((entry) => !isIdentical(entry) && !LEFTOVER_EXEMPT[entry.path])
    .flatMap((entry) => {
      if (script === "latin") {
        const english = englishFunctionWord(entry.translated);
        if (english) return [`${entry.path}: English word “${english}”`];
      } else {
        const leftovers = leftoverEnglish(entry.translated);
        if (leftovers.length > 0) return [`${entry.path}: ${leftovers.join(" ")}`];
      }
      const words = entry.english.match(/[A-Za-z]{2,}/g) ?? [];
      return entry.translated === entry.english &&
        !IDENTICAL_ALLOWED.test(entry.path) &&
        words.length >= 2 &&
        leftoverEnglish(entry.english).length > 0
        ? [`${entry.path}: identical to English`]
        : [];
    });

// ─── Glossary ──────────────────────────────────────────────────────────────────

/** Forbidden glossary or regional words used anywhere in the catalog. */
export const forbiddenTermProblems = (
  entries: readonly Pick<Entry, "path" | "translated">[],
  glossary: LocaleGlossary,
) => {
  const forbidden = [
    ...glossary.terms.flatMap((term) => term.forbidden ?? []),
    ...glossary.forbidden,
  ];
  return entries.flatMap((entry) =>
    forbidden
      .filter((term) => entry.translated.includes(term))
      .map((term) => `${entry.path}: ${term}`),
  );
};

/** Messages whose English uses a product term but whose translation lacks the fixed term. */
export const requiredTermProblems = (
  entries: readonly Entry[],
  glossary: LocaleGlossary,
) =>
  glossary.terms.flatMap((term) => {
    const required = term.required;
    if (!required) return [];
    const accepted = [term.term, ...(term.alternatives ?? [])];
    return entries
      .filter(
        (entry) =>
          entry.primary &&
          required.test(entry.english.replace(/\{\{?[A-Za-z]+\}?\}/g, "")),
      )
      .filter((entry) => !isIdentical(entry))
      .filter((entry) => !term.exempt?.[entry.path.replace(/\(\w+\)$/, "")])
      .filter(
        (entry) => !accepted.some((candidate) => entry.translated.includes(candidate)),
      )
      .map((entry) => `${term.id} → ${term.term}: ${entry.path}: ${entry.translated}`);
  });

// ─── Width ─────────────────────────────────────────────────────────────────────

/** Columns a string takes: full-width (CJK) characters count as 2. */
export const displayWidth = (text: string) =>
  [...text.replace(SAMPLE_TEXT_PATTERN, "xxxx")].reduce(
    (width, character) =>
      width + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(character) ? 2 : 1),
    0,
  );

/** Fragments joined around links; word order moves between them, so judge the whole sentence. */
export const isFragmentPath = (path: string) =>
  /(?:prefix|suffix|middle|body|before|after|lead)\w*(?:\(\w+\))?$/i.test(path) ||
  /typography\./.test(path);

export type WidthBudget = { ratio: number; slack: number };

/** Translations wider than `ratio` × English, or English + `slack` for short strings. */
export const widthProblems = (entries: readonly Entry[], budget: WidthBudget) =>
  entries
    .filter((entry) => entry.english !== "" && !isFragmentPath(entry.path))
    .filter((entry) => {
      const english = displayWidth(entry.english);
      return (
        displayWidth(entry.translated) >
        Math.max(Math.ceil(english * budget.ratio), english + budget.slack)
      );
    })
    .map(
      (entry) =>
        `${entry.path}: ${displayWidth(entry.translated)} > ${displayWidth(entry.english)} (${entry.translated})`,
    );

// ─── Sentence assembly ─────────────────────────────────────────────────────────

/**
 * Sentences the UI builds from fragments around links, emphasis or code, joined the
 * way the components join them. Update this list when a component splits a sentence.
 */
export const assembledSentences = (catalog: LocaleCatalog): Record<string, string> => {
  const { fragmentSpace, fullStop } = catalog.common.typography;
  const { about, welcome, advanced, rules, locations, sidebar } = catalog;
  const consent = advanced.privacy.osmConsent;
  const warning = rules.globalFallback.dialog;
  return {
    aboutIntro: `${about.body1}${fragmentSpace}${about.body2}${fragmentSpace}${about.body3Prefix}${fragmentSpace}${about.body3LinkLabel}${about.body3Suffix}`,
    website: `${about.website.prefix}${about.website.linkLabel}${about.website.suffix}`,
    support: `${about.support.bodyPrefix}${about.support.linkLabel}${about.support.bodySuffix}`,
    creator: `${about.license.creatorPrefix}${about.license.creatorLabel}${about.license.creatorSuffix}`,
    mapPreviews: `${about.assets.mapPreviewsPrefix}OpenFreeMap${about.assets.mapPreviewsMiddle}OpenStreetMap${about.assets.mapPreviewsSuffix}`,
    osmWiki: `${about.assets.osmWikiCountryCodes.label}${about.assets.osmWikiCountryCodes.body}`,
    osmWikiLicense: `${about.assets.osmWikiCountryCodes.licenseLabel}${about.assets.osmWikiCountryCodes.licenseBody}`,
    steam: `${about.assets.localData.steam.label}${about.assets.localData.steam.body}`,
    chromiumDash: `${about.assets.localData.chromiumDash.label}${about.assets.localData.chromiumDash.body}`,
    localeCatalog: `${about.assets.localData.localeCatalog.prefix}Mozilla${about.assets.localData.localeCatalog.middle}Chromium${about.assets.localData.localeCatalog.body}`,
    privacyStep: `${welcome.steps.privacy.descriptionBeforePolicy}${fragmentSpace}${welcome.steps.privacy.policyLink}${welcome.steps.privacy.descriptionAfterPolicy}`,
    welcomeImport: `${welcome.steps.welcome.description}${fragmentSpace}${welcome.steps.welcome.importInline}${fullStop}`,
    osmConsent: `${consent.statePrefix}${fragmentSpace}${consent.stateEnabled}${fullStop}`,
    osmConsentOff: `${consent.statePrefix}${fragmentSpace}${consent.stateDisabled}${fullStop}`,
    vpnWarning: `${warning.locationProfileWarningPrefix}${warning.locationProfileWarningLinkLabel}${warning.locationProfileWarningSuffix}`,
    networkLimits: `${locations.help.networkBodyPrefix}${locations.help.networkBodyLinkLabel}${locations.help.networkBodySuffix}`,
    preferEnglish: `${locations.editor.preferEnglishContentDescriptionPrefix} en-US ${locations.editor.preferEnglishContentDescriptionSuffix}`,
    report: `${sidebar.report.partial}${fragmentSpace}${sidebar.report.evidenceHint}`,
  };
};

/** Spacing and sentence-end problems in assembled sentences of space-separated scripts. */
export const spacedSentenceProblems = (sentences: Record<string, string>) =>
  Object.entries(sentences).flatMap(([id, sentence]) => [
    ...(/ {2,}/.test(sentence) ? [`${id}: double space: ${sentence}`] : []),
    ...(/ [,.;:!?]/.test(sentence)
      ? [`${id}: space before punctuation: ${sentence}`]
      : []),
    ...(/^\s|\s$/.test(sentence)
      ? [`${id}: leading or trailing space: ${sentence}`]
      : []),
    ...(/[.!?…]["»”)]?$/.test(sentence)
      ? []
      : [`${id}: does not end a sentence: ${sentence}`]),
  ]);
