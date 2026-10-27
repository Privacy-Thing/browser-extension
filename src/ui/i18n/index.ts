import { en } from "./en";
import { es } from "./es";
import { pt } from "./pt";
import { ru } from "./ru";
import { uk } from "./uk";
import { zhCN } from "./zh-CN";
import { zhTW } from "./zh-TW";

import { isUiLocale, type UiLocale, type UiLocalePreference } from "@/shared/ui-locale";

export type { UiLocale, UiLocalePreference };

const catalogs = { en, es, pt, ru, uk, "zh-CN": zhCN, "zh-TW": zhTW } as const;

const HANT_REGIONS = new Set(["tw", "hk", "mo"]);

/**
 * Chinese has one catalog per script: an explicit `Hant`/`Hans` script subtag wins,
 * otherwise Taiwan, Hong Kong and Macao use Traditional and every other `zh` tag
 * (including bare `zh`, `zh-CN` and `zh-SG`) uses Simplified.
 */
const resolveChineseUiLocale = (subtags: readonly string[]): UiLocale => {
  if (subtags.includes("hant")) return "zh-TW";
  if (subtags.includes("hans")) return "zh-CN";
  return subtags.some((subtag) => HANT_REGIONS.has(subtag)) ? "zh-TW" : "zh-CN";
};

export const resolveUiLocale = (language: string | undefined): UiLocale => {
  const [baseLanguage, ...subtags] = language?.toLowerCase().split("-") ?? [];
  if (baseLanguage === "zh") return resolveChineseUiLocale(subtags);
  return baseLanguage !== undefined && isUiLocale(baseLanguage) ? baseLanguage : "en";
};

const resolveActiveUiLocale = (preference: UiLocalePreference): UiLocale =>
  preference === "auto" ? resolveUiLocale(globalThis.navigator?.language) : preference;

let activeLocale = resolveUiLocale(globalThis.navigator?.language);
const localeListeners = new Set<() => void>();

export const getActiveUiLocale = (): UiLocale => activeLocale;

export const subscribeActiveUiLocale = (listener: () => void): (() => void) => {
  localeListeners.add(listener);
  return () => {
    localeListeners.delete(listener);
  };
};

export const applyUiLocalePreference = (preference: UiLocalePreference): void => {
  const nextLocale = resolveActiveUiLocale(preference);
  if (nextLocale === activeLocale) return;
  activeLocale = nextLocale;
  if (typeof document !== "undefined") {
    document.documentElement.lang = activeLocale;
  }
  for (const listener of localeListeners) listener();
};

const isMessageRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const createMessagesProxy = (read: () => object): object =>
  new Proxy(
    {},
    {
      get(_target, property) {
        const value = Reflect.get(read(), property);
        if (!isMessageRecord(value)) return value;
        return createMessagesProxy(() => {
          const next = Reflect.get(read(), property);
          return isMessageRecord(next) ? next : {};
        });
      },
      has(_target, property) {
        return Reflect.has(read(), property);
      },
      ownKeys() {
        return Reflect.ownKeys(read());
      },
      getOwnPropertyDescriptor(_target, property) {
        if (!Reflect.has(read(), property)) return undefined;
        return {
          configurable: true,
          enumerable: true,
          value: Reflect.get(read(), property),
          writable: true,
        };
      },
    },
  );

export const t = createMessagesProxy(() => catalogs[activeLocale]) as typeof en;

if (typeof document !== "undefined") {
  document.documentElement.lang = activeLocale;
}

export type { Translations } from "./types";
