import { mergeLegacyRefs, stripLegacyRefs } from "./legacy-behavior-data";

import { FX_RUNTIME_TEST_HOST } from "@/shared/build-flags";
import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { normalizeLocations } from "@/shared/locale-catalog";
import type { Location } from "@/shared/types";

export const LOCATIONS_STORAGE_KEY = EXTENSION_STORAGE_KEYS.locations;

export const EXAMPLE_LOCATION_IDS = [
  "spf-warsaw",
  "spf-paris",
  "spf-london",
  "spf-ottawa",
  "spf-new-york",
  "spf-las-vegas",
  "spf-san-francisco",
  "spf-sydney",
  "spf-beijing",
  "spf-hong-kong",
  "spf-new-delhi",
  "spf-cairo",
] as const;

export const EXAMPLE_LOCATIONS: Location[] = [
  {
    id: "spf-warsaw",
    label: "Warsaw",
    latitude: 52.2297,
    longitude: 21.0122,
    accuracy: 25,
    noiseRadius: 50,
    language: "pl",
    languages: ["pl"],
    timeZone: "Europe/Warsaw",
  },
  {
    id: "spf-paris",
    label: "Paris",
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 25,
    noiseRadius: 50,
    language: "fr-FR",
    languages: ["fr-FR", "fr"],
    timeZone: "Europe/Paris",
  },
  {
    id: "spf-london",
    label: "London",
    latitude: 51.5074,
    longitude: -0.1278,
    accuracy: 25,
    noiseRadius: 50,
    language: "en-GB",
    languages: ["en-GB", "en"],
    timeZone: "Europe/London",
  },
  {
    id: "spf-ottawa",
    label: "Ottawa",
    latitude: 45.4215,
    longitude: -75.6972,
    accuracy: 25,
    noiseRadius: 50,
    language: "en-CA",
    languages: ["en-CA", "en", "fr-CA", "fr"],
    timeZone: "America/Toronto",
  },
  {
    id: "spf-new-york",
    label: "New York",
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 25,
    noiseRadius: 50,
    language: "en-US",
    languages: ["en-US", "en"],
    timeZone: "America/New_York",
  },
  {
    id: "spf-las-vegas",
    label: "Las Vegas",
    latitude: 36.1699,
    longitude: -115.1398,
    accuracy: 25,
    noiseRadius: 50,
    language: "en-US",
    languages: ["en-US", "en"],
    timeZone: "America/Los_Angeles",
  },
  {
    id: "spf-san-francisco",
    label: "San Francisco",
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 25,
    noiseRadius: 50,
    language: "en-US",
    languages: ["en-US", "en"],
    timeZone: "America/Los_Angeles",
  },
  {
    id: "spf-sydney",
    label: "Sydney",
    latitude: -33.8688,
    longitude: 151.2093,
    accuracy: 25,
    noiseRadius: 50,
    language: "en-AU",
    languages: ["en-AU", "en"],
    timeZone: "Australia/Sydney",
  },
  {
    id: "spf-beijing",
    label: "Beijing",
    latitude: 39.9042,
    longitude: 116.4074,
    accuracy: 25,
    noiseRadius: 50,
    language: "zh-CN",
    languages: ["zh-CN", "zh"],
    timeZone: "Asia/Shanghai",
  },
  {
    id: "spf-hong-kong",
    label: "Hong Kong",
    latitude: 22.3193,
    longitude: 114.1694,
    accuracy: 25,
    noiseRadius: 50,
    language: "zh-HK",
    languages: ["zh-HK", "zh", "en"],
    timeZone: "Asia/Hong_Kong",
  },
  {
    id: "spf-new-delhi",
    label: "New Delhi",
    latitude: 28.6139,
    longitude: 77.209,
    accuracy: 25,
    noiseRadius: 50,
    language: "hi",
    languages: ["hi", "en"],
    timeZone: "Asia/Kolkata",
  },
  {
    id: "spf-cairo",
    label: "Cairo",
    latitude: 30.0444,
    longitude: 31.2357,
    accuracy: 25,
    noiseRadius: 50,
    language: "ar",
    languages: ["ar"],
    timeZone: "Africa/Cairo",
  },
  {
    id: "spf-lagos",
    label: "Lagos",
    latitude: 6.5244,
    longitude: 3.3792,
    accuracy: 25,
    noiseRadius: 50,
    language: "en",
    languages: ["en"],
    timeZone: "Africa/Lagos",
  },
  {
    id: "spf-kyiv",
    label: "Kyiv",
    latitude: 50.4501,
    longitude: 30.5234,
    accuracy: 25,
    noiseRadius: 50,
    language: "uk",
    languages: ["uk"],
    timeZone: "Europe/Kyiv",
  },
  {
    id: "spf-kinshasa",
    label: "Kinshasa",
    latitude: -4.4419,
    longitude: 15.2663,
    accuracy: 25,
    noiseRadius: 50,
    language: "fr",
    languages: ["fr"],
    timeZone: "Africa/Kinshasa",
  },
  {
    id: "spf-sao-paulo",
    label: "Sao Paulo",
    latitude: -23.5558,
    longitude: -46.6396,
    accuracy: 25,
    noiseRadius: 50,
    language: "pt-BR",
    languages: ["pt-BR", "pt"],
    timeZone: "America/Sao_Paulo",
  },
  {
    id: "spf-buenos-aires",
    label: "Buenos Aires",
    latitude: -34.6037,
    longitude: -58.3816,
    accuracy: 25,
    noiseRadius: 50,
    language: "es",
    languages: ["es"],
    timeZone: "America/Argentina/Buenos_Aires",
  },
  {
    id: "spf-lima",
    label: "Lima",
    latitude: -12.0464,
    longitude: -77.0428,
    accuracy: 25,
    noiseRadius: 50,
    language: "es",
    languages: ["es"],
    timeZone: "America/Lima",
  },
  {
    id: "spf-rio-de-janeiro",
    label: "Rio de Janeiro",
    latitude: -22.9068,
    longitude: -43.1729,
    accuracy: 25,
    noiseRadius: 50,
    language: "pt-BR",
    languages: ["pt-BR", "pt"],
    timeZone: "America/Sao_Paulo",
  },
  {
    id: "spf-caracas",
    label: "Caracas",
    latitude: 10.4806,
    longitude: -66.9036,
    accuracy: 25,
    noiseRadius: 50,
    language: "es",
    languages: ["es"],
    timeZone: "America/Caracas",
  },
  {
    id: "spf-berlin",
    label: "Berlin",
    latitude: 52.52,
    longitude: 13.405,
    accuracy: 25,
    noiseRadius: 50,
    language: "de-DE",
    languages: ["de-DE", "de"],
    timeZone: "Europe/Berlin",
  },
  {
    id: "spf-madrid",
    label: "Madrid",
    latitude: 40.4168,
    longitude: -3.7038,
    accuracy: 25,
    noiseRadius: 50,
    language: "es",
    languages: ["es"],
    timeZone: "Europe/Madrid",
  },
];

const randomUnit = (): number => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoApi.getRandomValues(values);
    return (values[0] ?? 0) / 0xffffffff;
  }
  return 0.5;
};

export const randomizeLocation = <TLocation extends Location>(
  location: TLocation,
  radiusMeters: number,
): TLocation => {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    return { ...location };
  }

  const distanceMeters = Math.sqrt(randomUnit()) * radiusMeters;
  const angle = randomUnit() * Math.PI * 2;
  const earthRadiusMeters = 6_378_137;
  const latitudeRadians = (location.latitude * Math.PI) / 180;
  const deltaLatitude = (distanceMeters * Math.cos(angle)) / earthRadiusMeters;
  const deltaLongitude =
    (distanceMeters * Math.sin(angle)) /
    (earthRadiusMeters * Math.max(Math.cos(latitudeRadians), 0.000001));

  return {
    ...location,
    latitude: location.latitude + (deltaLatitude * 180) / Math.PI,
    longitude: location.longitude + (deltaLongitude * 180) / Math.PI,
  };
};

// Firefox runtime test builds ship with the full example library so the
// bundled DEFAULT_RULES (see src/background/storage/rules.ts) can resolve
// against an actual "spf-warsaw" location. Production builds keep empty defaults
// (commit e559005 — user opts in via welcome flow / generator).
export const DEFAULT_LOCATIONS: Location[] = FX_RUNTIME_TEST_HOST
  ? EXAMPLE_LOCATIONS.map((location) => ({ ...location }))
  : [];

export const loadLocations = async (): Promise<Location[]> => {
  const stored = await chrome.storage.local.get(LOCATIONS_STORAGE_KEY);
  const locations = stored[LOCATIONS_STORAGE_KEY];
  return Array.isArray(locations)
    ? normalizeLocations(stripLegacyRefs(locations) as Location[])
    : normalizeLocations(DEFAULT_LOCATIONS);
};

export const saveLocations = async (locations: readonly Location[]): Promise<void> => {
  const stored = await chrome.storage.local.get(LOCATIONS_STORAGE_KEY);
  await chrome.storage.local.set({
    [LOCATIONS_STORAGE_KEY]: mergeLegacyRefs(
      normalizeLocations(locations),
      stored[LOCATIONS_STORAGE_KEY],
    ),
  });
};
