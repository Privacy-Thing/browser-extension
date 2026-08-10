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

export const STORY_RULES: DomainRule[] = [
  {
    pattern: "browserleaks.com",
    enabled: true,
    locationId: "new-york",
    ruleSeedKey: "storybook-browserleaks",
  },
  {
    pattern: "*.example.com",
    enabled: true,
    locationId: "warsaw",
    ruleSeedKey: "storybook-example",
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
      getURL: (path: string) => `chrome-extension://storybook/${path}`,
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
