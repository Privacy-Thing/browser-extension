import tzLookup from "@photostructure/tz-lookup";

import { matchCountryCodeToLocale } from "@/shared/osm-country-language-matcher";
import { slugifyToken } from "@/shared/slugify";
import type { Location, LocationSearchCandidate, ProfileDraft } from "@/shared/types";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  importance?: number;
  place_rank?: number;
  addresstype?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
};

const MAX_LOCATION_CANDIDATES = 5;
const NEAR_DUPLICATE_METERS = 2_000;
const SETTLEMENT_ADDRESS_TYPES = new Set(["city", "town", "village", "municipality"]);
const ADDRESS_TYPE_RANK: Record<string, number> = {
  city: 0,
  town: 1,
  municipality: 2,
  village: 3,
};

const filterSettlementResults = (
  results: readonly NominatimResult[],
): readonly NominatimResult[] => {
  const settlements = results.filter(
    (result) =>
      result.addresstype !== undefined &&
      SETTLEMENT_ADDRESS_TYPES.has(result.addresstype),
  );
  // Fall back to the unfiltered set when nothing is a settlement (e.g. address-only
  // lookups) so we don't regress the "no match" behavior for valid non-settlement results.
  return settlements.length > 0 ? settlements : results;
};

const normalizeSearchText = (value: string | undefined): string =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^(city|town|village|municipality)\s+of\s+/u, "")
    .replace(/\s+/gu, " ");

const getAddressLocality = (result: NominatimResult): string =>
  result.address?.city ??
  result.address?.town ??
  result.address?.village ??
  result.address?.municipality ??
  result.name ??
  result.display_name.split(",")[0]?.trim() ??
  "";

const getResultAreaKey = (result: NominatimResult): string => {
  const address = result.address ?? {};
  return [
    normalizeSearchText(address.county),
    normalizeSearchText(address.state),
    normalizeSearchText(address.country),
  ].join("|");
};

const getSemanticResultKey = (result: NominatimResult): string =>
  `${normalizeSearchText(getAddressLocality(result))}|${getResultAreaKey(result)}`;

const getResultCoordinates = (
  result: NominatimResult,
): { latitude: number; longitude: number } | null => {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const getDistanceMeters = (
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
): number => {
  const earthRadiusMeters = 6_378_137;
  const firstLatitude = (first.latitude * Math.PI) / 180;
  const secondLatitude = (second.latitude * Math.PI) / 180;
  const deltaLatitude = secondLatitude - firstLatitude;
  const deltaLongitude = ((second.longitude - first.longitude) * Math.PI) / 180;
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;

  return (
    earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
};

const getResultScore = (result: NominatimResult): number => {
  const typeRank = ADDRESS_TYPE_RANK[result.addresstype ?? ""] ?? 10;
  const importance = result.importance ?? 0;
  const placeRank = result.place_rank ?? 99;

  return typeRank * 1_000 - importance * 100 + placeRank / 100;
};

const compareNominatimResults = (
  first: NominatimResult,
  second: NominatimResult,
): number => getResultScore(first) - getResultScore(second);

const areNearDuplicateResults = (
  first: NominatimResult,
  second: NominatimResult,
): boolean => {
  if (getResultAreaKey(first) !== getResultAreaKey(second)) {
    return false;
  }

  const firstCoordinates = getResultCoordinates(first);
  const secondCoordinates = getResultCoordinates(second);
  if (!firstCoordinates || !secondCoordinates) {
    return false;
  }

  return (
    getDistanceMeters(firstCoordinates, secondCoordinates) <= NEAR_DUPLICATE_METERS
  );
};

const dedupeNominatimResults = (
  results: readonly NominatimResult[],
): NominatimResult[] => {
  const deduped: Array<{ key: string; result: NominatimResult }> = [];

  for (const result of results) {
    const semanticKey = getSemanticResultKey(result);
    const duplicateIndex = deduped.findIndex(
      (candidate) =>
        candidate.key === semanticKey ||
        areNearDuplicateResults(candidate.result, result),
    );

    if (duplicateIndex === -1) {
      deduped.push({ key: semanticKey, result });
      continue;
    }

    const duplicate = deduped[duplicateIndex];
    if (duplicate && compareNominatimResults(result, duplicate.result) < 0) {
      deduped[duplicateIndex] = { key: semanticKey, result };
    }
  }

  return deduped.map((candidate) => candidate.result);
};

const slugifyId = (value: string): string => slugifyToken(value);

const createUniqueLocationId = (
  baseLabel: string,
  existingIds: readonly string[],
): string => {
  const baseId = slugifyId(baseLabel) || "profile";
  if (!existingIds.includes(baseId)) {
    return baseId;
  }

  for (let index = 2; ; index += 1) {
    const candidate = `${baseId}-${index}`;
    if (!existingIds.includes(candidate)) {
      return candidate;
    }
  }
};

const pickLocationLabel = (result: NominatimResult): string => {
  const address = result.address ?? {};

  const locality =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    address.state;
  const country = address.country;

  if (locality && country && locality !== country) {
    return `${locality}, ${country}`;
  }

  return (
    locality ?? country ?? result.display_name.split(",")[0]?.trim() ?? "New location"
  );
};

const buildCandidateId = (result: NominatimResult, index: number): string => {
  const base = slugifyId(`${pickLocationLabel(result)} ${result.lat} ${result.lon}`);
  return base ? `${base}-${index + 1}` : `location-result-${index + 1}`;
};

const toSearchCandidate = (
  result: NominatimResult,
  index: number,
): LocationSearchCandidate => {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Location lookup returned invalid coordinates.");
  }

  return {
    id: buildCandidateId(result, index),
    label: pickLocationLabel(result),
    description: result.display_name,
    sourceLabel: result.display_name,
    latitude,
    longitude,
    ...(result.address ? { address: result.address } : {}),
  };
};

export const buildDraftFromCandidate = (
  candidate: LocationSearchCandidate,
  existingProfiles: readonly Location[],
): ProfileDraft => {
  if (!Number.isFinite(candidate.latitude) || !Number.isFinite(candidate.longitude)) {
    throw new Error("Location lookup returned invalid coordinates.");
  }

  const languageSelection = matchCountryCodeToLocale(candidate.address?.country_code);
  const selectedLanguageOption =
    languageSelection.options.find(
      (option) => option.value === languageSelection.selectedValue,
    ) ?? languageSelection.options[0];

  if (!selectedLanguageOption) {
    throw new Error("Location lookup could not resolve a default locale.");
  }

  return {
    id: createUniqueLocationId(
      candidate.label,
      existingProfiles.map((profile) => profile.id),
    ),
    label: candidate.label,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    accuracy: 25,
    noiseRadius: 50,
    language: selectedLanguageOption.language,
    languages: selectedLanguageOption.languages,
    preferEnglishContent: false,
    timeZone: tzLookup(candidate.latitude, candidate.longitude),
    sourceLabel: candidate.sourceLabel,
    languageSelection,
  };
};

export const buildLocationDraft = (
  result: NominatimResult,
  existingProfiles: readonly Location[],
): ProfileDraft =>
  buildDraftFromCandidate(toSearchCandidate(result, 0), existingProfiles);

export const fetchLocationCandidates = async (
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LocationSearchCandidate[]> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Enter a location to generate a location.");
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", trimmedQuery);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "10");

  let response: Response;

  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    throw new Error("Location lookup failed because the network is unavailable.");
  }

  if (response.status === 429) {
    throw new Error("Location lookup is rate limited. Try again in a moment.");
  }

  if (!response.ok) {
    throw new Error("Location lookup is currently unavailable.");
  }

  const results = (await response.json()) as NominatimResult[];
  const candidates = dedupeNominatimResults(filterSettlementResults(results)).slice(
    0,
    MAX_LOCATION_CANDIDATES,
  );
  const firstCandidate = candidates[0];
  if (!firstCandidate) {
    throw new Error("No matching location found.");
  }

  return candidates.map(toSearchCandidate);
};

export const fetchLocationDraft = async (
  query: string,
  existingProfiles: readonly Location[],
  fetchImpl: typeof fetch = fetch,
): Promise<ProfileDraft> => {
  const candidates = await fetchLocationCandidates(query, fetchImpl);
  const firstCandidate = candidates[0];
  if (!firstCandidate) {
    throw new Error("No matching location found.");
  }

  return buildDraftFromCandidate(firstCandidate, existingProfiles);
};
