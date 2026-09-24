import { en } from "./en";
import { es } from "./es";
import { pt } from "./pt";
import { ru } from "./ru";
import { uk } from "./uk";

import { isUiLocale, type UiLocale, type UiLocalePreference } from "@/shared/ui-locale";

export type { UiLocale, UiLocalePreference };

const catalogs = { en, es, pt, ru, uk } as const;

export const resolveUiLocale = (language: string | undefined): UiLocale => {
  const baseLanguage = language?.toLowerCase().split("-")[0];
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

const createMessagesProxy = (read: () => object): object =>
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
