import type { ReactNode } from "react";

import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import type {
  DomainRule,
  GlobalFallbackRule,
  Location,
  TrustedSite,
} from "@/shared/types";
import {
  SettingsContext,
  type SettingsContextValue,
} from "@/ui/options/state/SettingsContext";

export const STORY_LOCATIONS: Location[] = [
  {
    id: "warsaw",
    label: "Warsaw",
    latitude: 52.2297,
    longitude: 21.0122,
    accuracy: 25,
    noiseRadius: 120,
    language: "pl-PL",
    languages: ["pl-PL", "pl", "en-US"],
    timeZone: "Europe/Warsaw",
  },
  {
    id: "new-york",
    label: "New York",
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 30,
    noiseRadius: 160,
    language: "en-US",
    languages: ["en-US", "en"],
    timeZone: "America/New_York",
  },
  {
    id: "sydney",
    label: "Sydney",
    latitude: -33.8688,
    longitude: 151.2093,
    accuracy: 35,
    noiseRadius: 180,
    language: "en-AU",
    languages: ["en-AU", "en"],
    timeZone: "Australia/Sydney",
  },
];

export const STORY_SHOWCASE_LOCATIONS: Location[] = [
  ...STORY_LOCATIONS,
  {
    id: "tokyo",
    label: "Tokyo",
    latitude: 35.6762,
    longitude: 139.6503,
    accuracy: 28,
    noiseRadius: 140,
    language: "ja-JP",
    languages: ["ja-JP", "ja", "en-US"],
    timeZone: "Asia/Tokyo",
  },
  {
    id: "paris",
    label: "Paris",
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 24,
    noiseRadius: 110,
    language: "fr-FR",
    languages: ["fr-FR", "fr", "en-US"],
    timeZone: "Europe/Paris",
  },
  {
    id: "sao-paulo",
    label: "São Paulo",
    latitude: -23.5505,
    longitude: -46.6333,
    accuracy: 32,
    noiseRadius: 170,
    language: "pt-BR",
    languages: ["pt-BR", "pt", "en-US"],
    timeZone: "America/Sao_Paulo",
  },
  {
    id: "singapore",
    label: "Singapore",
    latitude: 1.3521,
    longitude: 103.8198,
    accuracy: 26,
    noiseRadius: 130,
    language: "en-SG",
    languages: ["en-SG", "en", "zh-SG"],
    timeZone: "Asia/Singapore",
  },
  {
    id: "toronto",
    label: "Toronto",
    latitude: 43.6532,
    longitude: -79.3832,
    accuracy: 30,
    noiseRadius: 150,
    language: "en-CA",
    languages: ["en-CA", "en", "fr-CA"],
    timeZone: "America/Toronto",
  },
  {
    id: "cape-town",
    label: "Cape Town",
    latitude: -33.9249,
    longitude: 18.4241,
    accuracy: 34,
    noiseRadius: 175,
    language: "en-ZA",
    languages: ["en-ZA", "en", "af"],
    timeZone: "Africa/Johannesburg",
  },
];

export const STORY_RULES: DomainRule[] = [
  {
    pattern: "cloudflare.com",
    enabled: true,
    locationId: "new-york",
    ruleSeedKey: "storybook-cloudflare",
  },
  {
    pattern: "allegro.pl",
    enabled: true,
    locationId: "warsaw",
    ruleSeedKey: "storybook-allegro",
  },
  {
    pattern: "cnn.com",
    enabled: true,
    locationId: "warsaw",
    ruleSeedKey: "storybook-cnn",
  },
];

export const STORY_TRUSTED_SITES: TrustedSite[] = [
  { pattern: "accounts.google.com", enabled: true },
  { pattern: "intranet.example.com", enabled: false },
];

export const STORY_GLOBAL_FALLBACK: GlobalFallbackRule = {
  enabled: true,
  locationId: "warsaw",
  ruleSeedKey: "storybook-fallback",
};

const createSettingsFixture = (
  values: Partial<SettingsContextValue>,
): SettingsContextValue =>
  new Proxy(values, {
    get(target, property, receiver) {
      if (Reflect.has(target, property)) {
        return Reflect.get(target, property, receiver);
      }

      throw new Error(`Missing Options story fixture field: ${String(property)}`);
    },
  }) as SettingsContextValue;

export const StorySettingsProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: Partial<SettingsContextValue>;
}) => (
  <SettingsContext.Provider value={createSettingsFixture(value)}>
    {children}
  </SettingsContext.Provider>
);

export const installChromeBoundary = (): void => {
  if (typeof chrome !== "undefined" && chrome.runtime?.id) {
    return;
  }

  const boundary = {
    runtime: {
      id: "storybook",
      getManifest: () => ({ version: "0.0.0-storybook" }),
      getURL: (path: string) =>
        typeof location === "undefined"
          ? `chrome-extension://storybook/${path}`
          : new URL(path, `${location.origin}/`).href,
      sendMessage: async () => null,
    },
    storage: {
      local: {
        get: async () => ({
          [EXTENSION_STORAGE_KEYS.preferences]: DEFAULT_PREFERENCES,
        }),
      },
      onChanged: {
        addListener: () => undefined,
        removeListener: () => undefined,
      },
    },
  };
  const existingChrome = Reflect.get(globalThis, "chrome");

  if (typeof existingChrome === "object" && existingChrome !== null) {
    Reflect.set(existingChrome, "runtime", boundary.runtime);
    Reflect.set(existingChrome, "storage", boundary.storage);
    return;
  }

  Reflect.set(globalThis, "chrome", boundary);
};
