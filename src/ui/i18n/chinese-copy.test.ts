import type { SurfacePresentationState } from "@privacy-brand/xray-protocol";
import { afterAll, describe, expect, it } from "vitest";

import { en } from "./en";
import { QUOTED_FEATURE_NAMES } from "./glossary/zh-conventions";
import {
  ZH_GLOSSARY,
  ZH_REGIONAL_FORBIDDEN,
  type ZhVariant,
} from "./glossary/zh-glossary";
import {
  NON_TAIWAN_VARIANT_CHARACTERS,
  SIMPLIFIED_ONLY_CHARACTERS,
  TRADITIONAL_ONLY_CHARACTERS,
} from "./glossary/zh-script-charsets.generated";
import { unreviewedLocaleNotices } from "./translation-review";
import { zhCN } from "./zh-CN";
import { zhTW } from "./zh-TW";

import { applyUiLocalePreference } from "./index";

import { cleanupEn } from "@/experimental/control-d/cleanup-copy-en";
import { cleanupZhCN } from "@/experimental/control-d/cleanup-copy-zh-CN";
import { cleanupZhTW } from "@/experimental/control-d/cleanup-copy-zh-TW";
import { controlDEn } from "@/experimental/control-d/ui-copy-en";
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
import { featurePendingCopy } from "@/ui/components/provider-feature/provider-feature-copy";
import { ruleGroupCopy } from "@/ui/shared/rule-group-copy";

/*
 * Safeguards for the machine-translated Chinese catalogs. No native speaker has
 * reviewed them, so these checks pin what can be checked mechanically: the catalog
 * shape, interpolated values, script purity, glossary terms, leftover English,
 * punctuation and spacing, sentence assembly and string length. The glossary and
 * conventions live in ./glossary/zh-glossary.ts.
 *
 * House style for both catalogs (Chrome and Firefox zh-CN / zh-TW do the same):
 * full-width punctuation in Chinese sentences, one half-width space between Chinese
 * and Latin letters or digits, no space next to full-width punctuation, “” quotes in
 * zh-CN and 「」 quotes in zh-TW, ——, and … for ellipses.
 */

const VARIANTS = ["zh-CN", "zh-TW"] as const satisfies readonly ZhVariant[];

type Entry = {
  /** Catalog path, with the argument variant for rendered messages. */
  path: string;
  english: string;
  chinese: string;
  /** True for the main sample rendering of a message, used for parity checks. */
  primary: boolean;
};

// ─── Sample arguments ──────────────────────────────────────────────────────────

type ArgumentKind = "number" | "string" | "latin" | "strings" | "boolean" | "counts";

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
  code: "latin",
  first: "string",
  hostname: "latin",
  label: "string",
  locale: "latin",
  location: "string",
  locationLabel: "string",
  message: "latin",
  name: "string",
  provider: "string",
  pattern: "latin",
  saved: "string",
  scope: "string",
  second: "string",
  section: "string",
  service: "string",
  suggested: "string",
  surface: "string",
  _surface: "string",
  time: "latin",
  timeZone: "latin",
  unavailable: "string",
  value: "string",
  versionToken: "latin",
  zone: "latin",
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

/**
 * Interpolated text is marked so spacing checks can see its boundaries. ⟦a⟧ may be a
 * Chinese label, so no space is required next to it; ⟪a⟫ stands for a value that is
 * always Latin (hostname, pattern, time, locale code), so the house style requires a
 * space between it and Chinese text.
 */
const sampleText = (index: number, item = 0, latin = false) => {
  const mark = `${String.fromCharCode(97 + index)}${item || ""}`;
  return latin ? `⟪${mark}⟫` : `⟦${mark}⟧`;
};
const SAMPLE_TEXT_PATTERN = /[⟦⟪][a-z]\d*[⟧⟫]/g;

type RenderVariant = { id: string; numbers: (index: number) => number; items: number };

const RENDER_VARIANTS: readonly RenderVariant[] = [
  { id: "sample", numbers: (index) => 37 + index * 11, items: 3 },
  { id: "one", numbers: () => 1, items: 1 },
  { id: "two", numbers: () => 2, items: 2 },
  { id: "zero", numbers: () => 0, items: 1 },
];

const parameterNames = (message: (...args: never[]) => unknown): string[] => {
  const source = message.toString();
  const match = /^(?:async\s*)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>/.exec(source);
  const list = match?.[1] ?? match?.[2] ?? "";
  return list
    .split(",")
    .map((name) => name.trim().replace(/[:=].*$/, ""))
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
    case "latin":
      return sampleText(index, 0, true);
    case "strings":
      return Array.from({ length: variant.items }, (_, item) =>
        sampleText(index, item + 1, true),
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

const unknownParameters = new Set<string>();

// ─── Catalog flattening ────────────────────────────────────────────────────────

type Message = (...args: unknown[]) => unknown;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const flatten = (english: unknown, chinese: unknown, path: string): Entry[] => {
  if (typeof english === "string") {
    return [
      {
        path,
        english,
        chinese: typeof chinese === "string" ? chinese : `<missing:${typeof chinese}>`,
        primary: true,
      },
    ];
  }
  if (typeof english === "function") {
    const names = parameterNames(english as Message);
    const kinds = names.map((name) => {
      const kind = PARAMETER_KINDS[name];
      if (!kind) unknownParameters.add(`${path}(${name})`);
      return kind ?? "string";
    });
    return RENDER_VARIANTS.map((variant) => {
      const args = kinds.map((kind, index) => sampleArgument(kind, index, variant));
      const render = (message: unknown) => {
        if (typeof message !== "function") return `<missing:${typeof message}>`;
        try {
          return String((message as Message)(...args));
        } catch (error) {
          return `<threw:${String(error)}>`;
        }
      };
      return {
        path: `${path}(${variant.id})`,
        english: render(english),
        chinese: render(chinese),
        primary: variant.id === "sample",
      };
    });
  }
  if (Array.isArray(english)) {
    const list = Array.isArray(chinese) ? (chinese as unknown[]) : [];
    return english.flatMap((item, index) =>
      flatten(item, list[index], `${path}.${index}`),
    );
  }
  if (isRecord(english)) {
    const record = isRecord(chinese) ? chinese : {};
    return Object.keys(english).flatMap((key) =>
      flatten(english[key], record[key], path ? `${path}.${key}` : key),
    );
  }
  return [];
};

/** Copies a locale-following message proxy while that locale is active. */
const snapshot = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).map((key) => [key, snapshot(value[key])]),
  );
};
const readProxy = (proxy: object, locale: "en" | ZhVariant) => {
  applyUiLocalePreference(locale);
  return snapshot(proxy);
};
afterAll(() => applyUiLocalePreference("en"));

type NoticeCatalog = {
  notifications: Array<{
    id: string;
    title: Record<string, string>;
    message: Record<string, string[]>;
  }>;
};
const notices = (notificationCatalog as NoticeCatalog).notifications;

const catalogPairs = (variant: ZhVariant): Array<[string, unknown, unknown]> => {
  const main = variant === "zh-CN" ? zhCN : zhTW;
  return [
    ["", en, main],
    ["controlD", controlDEn, variant === "zh-CN" ? controlDZhCN : controlDZhTW],
    ["controlDCleanup", cleanupEn, variant === "zh-CN" ? cleanupZhCN : cleanupZhTW],
    ["controlDFeature", readProxy(featureText, "en"), readProxy(featureText, variant)],
    [
      "controlDRuleFeature",
      controlDRuleFeatureCopy.en,
      controlDRuleFeatureCopy[variant],
    ],
    ["controlDExplanation", explanationCopy.en, explanationCopy[variant]],
    ["ruleGroup", ruleGroupCopy.en, ruleGroupCopy[variant]],
    ["providerFeaturePending", featurePendingCopy.en, featurePendingCopy[variant]],
    [
      "notifications",
      Object.fromEntries(notices.map((notice) => [notice.id, notice.title.en])),
      Object.fromEntries(notices.map((notice) => [notice.id, notice.title[variant]])),
    ],
    [
      "notificationMessages",
      Object.fromEntries(notices.map((notice) => [notice.id, notice.message.en])),
      Object.fromEntries(notices.map((notice) => [notice.id, notice.message[variant]])),
    ],
  ];
};

const entriesByVariant = Object.fromEntries(
  VARIANTS.map((variant) => [
    variant,
    catalogPairs(variant).flatMap(([root, english, chinese]) =>
      flatten(english, chinese, root),
    ),
  ]),
) as Record<ZhVariant, Entry[]>;

/** Chinese-only strings checked for script, glossary and punctuation. */
const extraChinese = (variant: ZhVariant): Entry[] => [
  {
    path: "translationReview.notice",
    english: "",
    chinese: unreviewedLocaleNotices[variant] ?? "<missing>",
    primary: true,
  },
];

const chineseEntries = (variant: ZhVariant) => [
  ...entriesByVariant[variant],
  ...extraChinese(variant),
];

// ─── Technical strings ─────────────────────────────────────────────────────────

/** Paths whose value is a proper name and must equal English. */
const IDENTICAL_PATHS: readonly RegExp[] = [
  /^sidebar\.accessed\.methods\.(?!intlConstructor$|webGLGetExtension$)/,
  /^about\.(?:assets|localData)\..*\.label$/,
  /^about\.assets\.localData\.[a-zA-Z]+\.label$/,
  /^about\.assets\.localeCatalog\.(?:mozilla|chromium)\.label$/,
  /^about\.assets\.osmWikiCountryCodes\.licenseLabel$/,
  /^about\.license\.creatorLabel$/,
  /^about\.support\.linkLabel$/,
];

/** URLs and JavaScript expressions such as `navigator.language` stay as they are. */
const TECHNICAL_VALUE =
  /^(?:https?:\/\/\S+|(?:new )?[A-Za-z_$][\w$]*(?:(?:\.|…)[\w$]+|\(\))+(?:\.[\w$]+|\(\))*)$/;

const isIdentical = (entry: Pick<Entry, "path" | "english">) =>
  IDENTICAL_PATHS.some((pattern) => pattern.test(entry.path)) ||
  TECHNICAL_VALUE.test(entry.english);

/** Paths allowed to keep English words, with the reason. */
const LEFTOVER_EXEMPT: Readonly<Record<string, string>> = {
  "controlD.intro.names": "Discloses the literal Control D resource names.",
};

/** English allowed inside Chinese text: brands, platforms, API names, units, codes. */
const ALLOWED_LATIN = new Set(
  [
    BRAND_DISPLAY_NAME,
    BRAND_DIAGNOSTICS_NAME,
    BRAND_ENGINE_NAME,
    "Control D",
    "Privacy Badger",
    "uBlock Origin",
    "OpenStreetMap",
    "OpenFreeMap",
    "Nominatim",
    "MapLibre",
    "Vercel",
    "Valve",
    "Steam",
    "ChromiumDash",
    "Mozilla",
    "GitHub",
    "Firefox",
    "Chrome",
    "Chromium",
    "Edge",
    "Opera",
    "Brave",
    "Safari",
    "Windows",
    "macOS",
    "Linux",
    "Android",
    "iOS",
    "ChromeOS",
    "Google",
    "Apple",
    "Microsoft",
    "Tor",
    "API",
    "APIs",
    "DNS",
    "DNS-over-HTTPS",
    "DoH",
    "VPN",
    "IP",
    "URL",
    "HTTP",
    "HTTPS",
    "JSON",
    "JavaScript",
    "WebGL",
    "WebRTC",
    "Canvas",
    "Temporal",
    "Intl",
    "Date",
    "Navigator",
    "navigator",
    "Worker",
    "Workers",
    "Web",
    "Service",
    "Shared",
    "Dedicated",
    "Blob",
    "User-Agent",
    "Accept-Language",
    "Client",
    "Hints",
    "GPU",
    "CPU",
    "RAM",
    "GB",
    "MB",
    "KB",
    "UTC",
    "GMT",
    "IANA",
    "BCP",
    "ISO",
    "WiFi",
    "Wi-Fi",
    "GPS",
    "CC",
    "BY-SA",
    "Wiki",
    "OSM",
    "UA",
    "Beta",
    "Etc",
    "TLD",
    "no_log",
    "localhost",
    "Cookie",
    "Cookies",
    "IndexedDB",
    "Cache Storage",
    "localStorage",
    "sessionStorage",
    "AudioContext",
    "AnalyserNode",
    "AudioBuffer",
    "RTCPeerConnection",
    "BatteryManager",
    "SharedWorker",
    "ServiceWorker",
    "userScripts",
    "Geolocation",
    "Sec-CH-UA",
    "Sec-CH-UA-Platform",
    "Sec-CH-UA-Mobile",
    "Sec-CH-UA-Full-Version-List",
    "Unix",
    "Font Awesome",
    "Fonticons, Inc.",
    "GNU Affero General Public License",
    "AGPL",
    "SIL",
    "OFL",
    "MIT",
  ]
    .flatMap((value) => value.split(/\s+/))
    .map((word) => word.replace(/[.,:)]+$/, "")),
);

const CODE_TOKEN = /[A-Za-z0-9_$]*[._/()[\]<>=:@#-][A-Za-z0-9_$./()[\]<>=:@#*-]*/g;

const leftoverEnglish = (text: string): string[] =>
  text
    .replace(SAMPLE_TEXT_PATTERN, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\{\{?[A-Za-z]+\}?\}|<\/?(?:em|strong|code|b|i|br)\s*\/?>|<[A-Z]+>/g, " ")
    .split(/[^A-Za-z0-9_$.\-/()[\]<>=:@#*']+/)
    .filter((token) => /[A-Za-z]{2,}/.test(token))
    .filter((token) => !ALLOWED_LATIN.has(token.replace(/[.:)]+$/, "")))
    .filter(
      (token) => !(token.match(CODE_TOKEN)?.[0] === token && /[._/()=:]/.test(token)),
    )
    .filter((token) => !/^[*\w.-]*\.[a-z]{2,}$/.test(token))
    .filter((token) => !/^[A-Z]{2,}(?:-[A-Z0-9]+)*$/.test(token))
    .filter((token) => !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(token));

// ─── Character classes ─────────────────────────────────────────────────────────

const HAN = "\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff";
const HAN_CHAR = new RegExp(`[${HAN}]`);
const FULL_WIDTH_PUNCTUATION = "，。、；：！？（）“”「」『』《》——…";

const displayWidth = (text: string) =>
  [...text.replace(SAMPLE_TEXT_PATTERN, "xxxx")].reduce(
    (width, character) =>
      width + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(character) ? 2 : 1),
    0,
  );

const isFragmentPath = (path: string) =>
  /(?:prefix|suffix|middle|body|before|after|lead)\w*(?:\(\w+\))?$/i.test(path) ||
  /typography\./.test(path);

const punctuationProblems = (text: string, path: string): string[] => {
  const problems: string[] = [];
  const masked = text.replace(/⟪[a-z]\d*⟫/g, "Q").replace(SAMPLE_TEXT_PATTERN, "⟦⟧");
  const check = (pattern: RegExp, message: string) => {
    const match = pattern.exec(masked);
    if (match)
      problems.push(
        `${message}: …${masked.slice(Math.max(0, match.index - 8), match.index + 10)}…`,
      );
  };
  check(new RegExp(`[${HAN}][,;:!?]`), "half-width punctuation after Chinese");
  check(new RegExp(`[${HAN}]\\.(?!\\w)`), "half-width full stop after Chinese");
  check(
    new RegExp(`[${HAN}][A-Za-z0-9]|[A-Za-z0-9%][${HAN}]`),
    "missing space between Chinese and Latin or digits",
  );
  check(
    new RegExp(
      `[${FULL_WIDTH_PUNCTUATION.replace("——", "—")}] | [${FULL_WIDTH_PUNCTUATION.replace("——", "—")}]`,
    ),
    "space next to full-width punctuation",
  );
  check(/(?<!—)—(?!—)/, "single em dash; use —— or ·");
  check(/\.\.\./, "three dots; use …");
  check(
    new RegExp(`\\([^()]*[${HAN}][^()]*\\)`),
    "half-width parentheses around Chinese",
  );
  check(new RegExp(`"[^"]*[${HAN}][^"]*"`), "ASCII quotes around Chinese");
  check(new RegExp(`[${HAN}] [${HAN}]`), "space between Chinese characters");
  check(/ {2,}/, "double space");
  check(/\t|\u00a0|\u3000/, "tab, non-breaking or ideographic space");
  if (!isFragmentPath(path)) check(/^\s|\s$/, "leading or trailing whitespace");
  return problems;
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

/** Strings allowed to exceed the width budget, with the reason. */
const WIDTH_EXEMPT: Readonly<Record<string, string>> = {
  "demo.comparison.notAvailable":
    "English is the three-letter “N/A”; the Chinese needs four characters to say that the value could not be read.",
};

describe.each(VARIANTS)("%s catalog", (variant) => {
  const entries = entriesByVariant[variant];
  const chinese = chineseEntries(variant);

  it("matches the English catalog shape, message arguments and renders without errors", () => {
    expect(
      [...unknownParameters],
      "add new parameter names to PARAMETER_KINDS",
    ).toEqual([]);
    const broken = entries
      .filter((entry) => /^<(?:missing|threw)/.test(entry.chinese))
      .map((entry) => `${entry.path}: ${entry.chinese}`);
    expect(broken).toEqual([]);
    const notices = Object.keys(unreviewedLocaleNotices);
    expect(notices).toContain(variant);
  });

  it("keeps every interpolated value, number, brand and placeholder", () => {
    const brands = [BRAND_DISPLAY_NAME, BRAND_DIAGNOSTICS_NAME, BRAND_ENGINE_NAME];
    const problems = entries.flatMap((entry) => {
      const found: string[] = [];
      if (/undefined|NaN|\[object |\$\{|\bnull\b/.test(entry.chinese))
        found.push("garbage");
      if (!entry.primary) return found.map((problem) => `${entry.path}: ${problem}`);
      for (const value of entry.english.match(SAMPLE_TEXT_PATTERN) ?? []) {
        if (!entry.chinese.includes(value)) found.push(`drops argument ${value}`);
      }
      for (const value of entry.english.match(/\d+(?:[.,:]\d+)*/g) ?? []) {
        if (!entry.chinese.includes(value)) found.push(`drops number ${value}`);
      }
      for (const brand of brands) {
        if (entry.english.includes(brand) && !entry.chinese.includes(brand)) {
          found.push(`drops ${brand}`);
        }
      }
      const placeholders = (text: string) =>
        (text.match(/\{\{?[A-Za-z]+\}?\}|<[A-Z]+>|XXXXX-XXXXX/g) ?? []).sort();
      if (placeholders(entry.english).join() !== placeholders(entry.chinese).join()) {
        found.push(
          `placeholders ${placeholders(entry.english).join()} → ${placeholders(entry.chinese).join()}`,
        );
      }
      return found.map((problem) => `${entry.path}: ${problem}`);
    });
    expect(problems).toEqual([]);
  });

  it("uses only characters of its own script", () => {
    const forbidden =
      variant === "zh-CN"
        ? new Set(TRADITIONAL_ONLY_CHARACTERS)
        : new Set([...SIMPLIFIED_ONLY_CHARACTERS, ...NON_TAIWAN_VARIANT_CHARACTERS]);
    const problems = chinese.flatMap((entry) => {
      const characters = [
        ...new Set([...entry.chinese].filter((character) => forbidden.has(character))),
      ];
      return characters.length > 0 ? [`${entry.path}: ${characters.join("")}`] : [];
    });
    expect(problems).toEqual([]);
  });

  it("uses no forbidden glossary terms or other-region vocabulary", () => {
    const forbiddenTerms = [
      ...ZH_GLOSSARY.flatMap((term) => term[variant].forbidden ?? []),
      ...Object.keys(ZH_REGIONAL_FORBIDDEN[variant]),
    ];
    const problems = chinese.flatMap((entry) =>
      forbiddenTerms
        .filter((term) => entry.chinese.includes(term))
        .map((term) => `${entry.path}: ${term}`),
    );
    expect(problems).toEqual([]);
  });

  it("uses the glossary term wherever English uses the product term", () => {
    const problems = ZH_GLOSSARY.flatMap((term) => {
      const required = term.required;
      if (!required) return [];
      const choice = term[variant];
      const accepted = [choice.term, ...(choice.alternatives ?? [])];
      return entries
        .filter(
          (entry) =>
            entry.primary &&
            required.test(entry.english.replace(/\{\{?[A-Za-z]+\}?\}/g, "")),
        )
        .filter((entry) => !isIdentical(entry))
        .filter((entry) => !term.exempt?.[entry.path.replace(/\(\w+\)$/, "")])
        .filter(
          (entry) => !accepted.some((candidate) => entry.chinese.includes(candidate)),
        )
        .map((entry) => `${term.id} → ${choice.term}: ${entry.path}: ${entry.chinese}`);
    });
    expect(problems).toEqual([]);
  });

  it("translates every sentence and keeps technical values identical", () => {
    const identical = entries
      .filter((entry) => isIdentical(entry))
      .filter((entry) => entry.chinese !== entry.english)
      .map((entry) => `${entry.path}: ${entry.chinese}`);
    expect(identical).toEqual([]);
    // intlConstructor and webGLGetExtension are descriptions, not method names.
    const methodNames = ({
      intlConstructor: _intl,
      webGLGetExtension: _webgl,
      ...names
    }: Readonly<Record<string, string>>) => names;
    expect(
      methodNames(
        variant === "zh-CN"
          ? zhCN.sidebar.accessed.methods
          : zhTW.sidebar.accessed.methods,
      ),
    ).toEqual(methodNames(en.sidebar.accessed.methods));

    const untranslated = entries
      .filter((entry) => !isIdentical(entry) && !LEFTOVER_EXEMPT[entry.path])
      .flatMap((entry) => {
        const leftovers = leftoverEnglish(entry.chinese);
        if (leftovers.length > 0) return [`${entry.path}: ${leftovers.join(" ")}`];
        if (
          entry.chinese === entry.english &&
          /[A-Za-z]{3,}/.test(entry.english) &&
          !HAN_CHAR.test(entry.chinese) &&
          leftoverEnglish(entry.english).length > 0
        ) {
          return [`${entry.path}: identical to English`];
        }
        return [];
      });
    expect(untranslated).toEqual([]);
  });

  it("quotes the Trusted Sites feature name inside sentences", () => {
    const { term, open, close } = QUOTED_FEATURE_NAMES[variant];
    const problems = chinese
      .filter((entry) => /[，。；、：]/.test(entry.chinese))
      .filter((entry) => {
        const unquoted = new RegExp(`(?<!${open})${term}(?!${close})`);
        return unquoted.test(entry.chinese);
      })
      .map((entry) => `${entry.path}: ${entry.chinese}`);
    expect(problems).toEqual([]);
  });

  it("follows the Chinese punctuation and spacing conventions", () => {
    const problems = chinese.flatMap((entry) =>
      punctuationProblems(entry.chinese, entry.path).map(
        (problem) => `${entry.path}: ${problem}`,
      ),
    );
    expect(problems).toEqual([]);
  });

  it("assembles split fragments into complete sentences", () => {
    const catalog = variant === "zh-CN" ? zhCN : zhTW;
    const { fragmentSpace, fullStop } = catalog.common.typography;
    expect(fragmentSpace).toBe("");
    expect(fullStop).toBe("。");
    const about = catalog.about;
    const sentences: Record<string, string> = {
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
      privacyStep: `${catalog.welcome.steps.privacy.descriptionBeforePolicy}${fragmentSpace}${catalog.welcome.steps.privacy.policyLink}${catalog.welcome.steps.privacy.descriptionAfterPolicy}`,
      welcomeImport: `${catalog.welcome.steps.welcome.description}${fragmentSpace}${catalog.welcome.steps.welcome.importInline}${fullStop}`,
      osmConsent: `${catalog.advanced.privacy.osmConsent.statePrefix}${fragmentSpace}${catalog.advanced.privacy.osmConsent.stateEnabled}${fullStop}`,
      osmConsentOff: `${catalog.advanced.privacy.osmConsent.statePrefix}${fragmentSpace}${catalog.advanced.privacy.osmConsent.stateDisabled}${fullStop}`,
      vpnWarning: `${catalog.rules.globalFallback.dialog.locationProfileWarningPrefix}${catalog.rules.globalFallback.dialog.locationProfileWarningLinkLabel}${catalog.rules.globalFallback.dialog.locationProfileWarningSuffix}`,
      networkLimits: `${catalog.locations.help.networkBodyPrefix}${catalog.locations.help.networkBodyLinkLabel}${catalog.locations.help.networkBodySuffix}`,
      preferEnglish: `${catalog.locations.editor.preferEnglishContentDescriptionPrefix} en-US ${catalog.locations.editor.preferEnglishContentDescriptionSuffix}`,
      report: `${catalog.sidebar.report.partial}${fragmentSpace}${catalog.sidebar.report.evidenceHint}`,
    };
    const problems = Object.entries(sentences).flatMap(([id, sentence]) => [
      ...punctuationProblems(sentence, id).map((problem) => `${id}: ${problem}`),
      ...(/[。！？]$/.test(sentence)
        ? []
        : [`${id}: does not end a sentence: ${sentence}`]),
    ]);
    expect(problems).toEqual([]);
  });

  it("stays within the width budget of the English strings", () => {
    // CJK glyphs are about twice as wide as Latin letters, so width counts them as 2.
    const RATIO = 1.25;
    const SLACK = 4;
    const tooWide = chinese
      .filter((entry) => entry.english !== "" && !WIDTH_EXEMPT[entry.path])
      .filter(
        (entry) =>
          displayWidth(entry.chinese) >
          Math.max(
            Math.ceil(displayWidth(entry.english) * RATIO),
            displayWidth(entry.english) + SLACK,
          ),
      )
      .map(
        (entry) =>
          `${entry.path}: ${displayWidth(entry.chinese)} > ${displayWidth(entry.english)} (${entry.chinese})`,
      );
    expect(tooWide).toEqual([]);
  });
});

describe("Chinese release notices", () => {
  it.each(VARIANTS)("keeps %s notices complete", (variant) => {
    for (const notice of notices) {
      expect(notice.title[variant], notice.id).toBeTruthy();
      expect(notice.message[variant], notice.id).toHaveLength(
        notice.message.en?.length ?? 0,
      );
    }
  });
});
