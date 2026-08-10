import { describe, expect, it, vi } from "vitest";

import {
  buildLocationDraft,
  fetchLocationCandidates,
  fetchLocationDraft,
} from "@/background/location-drafts";
import { normalizeLocaleConfig } from "@/shared/locale-catalog";

describe("location drafts", () => {
  it("builds a location draft from geocoding data", () => {
    const draft = buildLocationDraft(
      {
        lat: "52.2297",
        lon: "21.0122",
        display_name: "Warsaw, Masovian Voivodeship, Poland",
        address: {
          city: "Warsaw",
          country: "Poland",
          country_code: "pl",
        },
      },
      [{ id: "warsaw-poland", label: "Warsaw, Poland" } as never],
    );

    expect(draft.id).toBe("warsaw-poland-2");
    expect(draft.label).toBe("Warsaw, Poland");
    expect({
      language: draft.language,
      languages: draft.languages,
    }).toEqual(
      normalizeLocaleConfig({
        language: "pl-PL",
        languages: ["pl-PL", "pl"],
      }),
    );
    expect(draft.languageSelection.required).toBe(false);
    expect(draft.languageSelection.options).toEqual([
      expect.objectContaining({
        value: draft.language,
        language: draft.language,
        languages: draft.languages,
      }),
    ]);
    expect(draft.preferEnglishContent).toBe(false);
    expect(draft.timeZone).toBe("Europe/Warsaw");
  });

  it("fetches the first location draft from nominatim-style results", async () => {
    const rawFetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({
        ok: true,
        json: async () => [
          {
            lat: "48.8566",
            lon: "2.3522",
            display_name: "Paris, Ile-de-France, France",
            address: {
              city: "Paris",
              country: "France",
              country_code: "fr",
            },
          },
        ],
      }),
    );
    const fetchMock = rawFetchMock as unknown as typeof fetch;

    const draft = await fetchLocationDraft("Paris", [], fetchMock);

    expect(draft.label).toBe("Paris, France");
    expect({
      language: draft.language,
      languages: draft.languages,
    }).toEqual(
      normalizeLocaleConfig({
        language: "fr-FR",
        languages: ["fr-FR", "fr"],
      }),
    );
    expect(draft.timeZone).toBe("Europe/Paris");
    expect(draft.languageSelection.required).toBe(false);
    expect(rawFetchMock).toHaveBeenCalledTimes(1);
    expect(String(rawFetchMock.mock.calls[0]?.[0])).toContain("limit=10");
  });

  it("returns multiple nominatim candidates without choosing the first result", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: "52.2297",
          lon: "21.0122",
          display_name: "Warsaw, Masovian Voivodeship, Poland",
          addresstype: "city",
          address: {
            city: "Warsaw",
            country: "Poland",
            country_code: "pl",
          },
        },
        {
          lat: "41.2995",
          lon: "-96.2801",
          display_name: "Warsaw, Nebraska, United States",
          addresstype: "village",
          address: {
            village: "Warsaw",
            country: "United States",
            country_code: "us",
          },
        },
      ],
    })) as unknown as typeof fetch;

    const candidates = await fetchLocationCandidates("Warsaw", fetchMock);

    expect(candidates).toEqual([
      expect.objectContaining({
        label: "Warsaw, Poland",
        latitude: 52.2297,
        longitude: 21.0122,
        sourceLabel: "Warsaw, Masovian Voivodeship, Poland",
      }),
      expect.objectContaining({
        label: "Warsaw, United States",
        latitude: 41.2995,
        longitude: -96.2801,
        sourceLabel: "Warsaw, Nebraska, United States",
      }),
    ]);
  });

  it("drops non-settlement results, keeping city/town/village", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: "52.2319581",
          lon: "21.0067249",
          display_name: "Warsaw, Masovian Voivodeship, Poland",
          addresstype: "city",
          address: { city: "Warsaw", country: "Poland", country_code: "pl" },
        },
        {
          lat: "52.2333742",
          lon: "21.0711489",
          display_name: "Warsaw, Masovian Voivodeship, Poland",
          addresstype: "administrative",
          address: { country: "Poland", country_code: "pl" },
        },
        {
          lat: "41.2381017",
          lon: "-85.8530544",
          display_name: "Warsaw, Kosciusko County, Indiana, United States",
          addresstype: "town",
          address: { town: "Warsaw", country: "United States", country_code: "us" },
        },
      ],
    })) as unknown as typeof fetch;

    const candidates = await fetchLocationCandidates("Warsaw", fetchMock);

    expect(candidates).toHaveLength(2);
    expect(candidates.map((candidate) => candidate.sourceLabel)).toEqual([
      "Warsaw, Masovian Voivodeship, Poland",
      "Warsaw, Kosciusko County, Indiana, United States",
    ]);
  });

  it("deduplicates overlapping nominatim results for the same settlement", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: "52.2319581",
          lon: "21.0067249",
          display_name: "Warsaw, Masovian Voivodeship, Poland",
          addresstype: "city",
          importance: 0.7999836822006081,
          place_rank: 16,
          address: {
            city: "Warsaw",
            state: "Masovian Voivodeship",
            country: "Poland",
            country_code: "pl",
          },
        },
        {
          lat: "52.2333742",
          lon: "21.0711489",
          display_name: "Warsaw, Masovian Voivodeship, Poland",
          addresstype: "administrative",
          importance: 0.7999836822006081,
          place_rank: 8,
          address: {
            state: "Masovian Voivodeship",
            country: "Poland",
            country_code: "pl",
          },
        },
        {
          lat: "41.2381017",
          lon: "-85.8530544",
          display_name: "Warsaw, Kosciusko County, Indiana, United States",
          addresstype: "town",
          importance: 0.4617859607565146,
          place_rank: 16,
          address: {
            town: "Warsaw",
            county: "Kosciusko County",
            state: "Indiana",
            country: "United States",
            country_code: "us",
          },
        },
        {
          lat: "42.7401871",
          lon: "-78.1325548",
          display_name:
            "Village of Warsaw, Town of Warsaw, Wyoming County, New York, 14569, United States",
          addresstype: "village",
          importance: 0.4472660198213956,
          place_rank: 16,
          address: {
            village: "Village of Warsaw",
            county: "Wyoming County",
            state: "New York",
            country: "United States",
            country_code: "us",
          },
        },
        {
          lat: "42.7401871",
          lon: "-78.1325548",
          display_name:
            "Town of Warsaw, Wyoming County, New York, 14569, United States",
          addresstype: "village",
          importance: 0.380300885223626,
          place_rank: 16,
          address: {
            village: "Town of Warsaw",
            county: "Wyoming County",
            state: "New York",
            country: "United States",
            country_code: "us",
          },
        },
      ],
    })) as unknown as typeof fetch;

    const candidates = await fetchLocationCandidates("Warsaw", fetchMock);

    expect(candidates.map((candidate) => candidate.sourceLabel)).toEqual([
      "Warsaw, Masovian Voivodeship, Poland",
      "Warsaw, Kosciusko County, Indiana, United States",
      "Village of Warsaw, Town of Warsaw, Wyoming County, New York, 14569, United States",
    ]);
  });

  it("falls back to unfiltered results when no settlement type matches", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: "51.5101",
          lon: "-0.1340",
          display_name: "10 Downing Street, London, England, United Kingdom",
          addresstype: "house",
          address: { city: "London", country: "United Kingdom", country_code: "gb" },
        },
      ],
    })) as unknown as typeof fetch;

    const candidates = await fetchLocationCandidates("10 Downing Street", fetchMock);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.sourceLabel).toBe(
      "10 Downing Street, London, England, United Kingdom",
    );
  });

  it.each([
    {
      label: "Beijing, China",
      country: "China",
      countryCode: "cn",
      lat: "39.9042",
      lon: "116.4074",
      expectedLanguage: "zh-CN",
      expectedLanguages: ["zh-CN", "zh"],
      expectedTimeZone: "Asia/Shanghai",
    },
    {
      label: "Córdoba, Argentina",
      country: "Argentina",
      countryCode: "ar",
      lat: "-31.4201",
      lon: "-64.1888",
      expectedLanguage: "es-AR",
      expectedLanguages: ["es-AR", "es"],
      expectedTimeZone: "America/Argentina/Cordoba",
    },
    {
      label: "Caracas, Venezuela",
      country: "Venezuela",
      countryCode: "ve",
      lat: "10.4806",
      lon: "-66.9036",
      expectedLanguage: "es-VE",
      expectedLanguages: ["es-VE", "es"],
      expectedTimeZone: "America/Caracas",
    },
    {
      label: "Nairobi, Kenya",
      country: "Kenya",
      countryCode: "ke",
      lat: "-1.2921",
      lon: "36.8219",
      expectedLanguage: "sw",
      expectedLanguages: ["sw"],
      expectedTimeZone: "Africa/Nairobi",
    },
  ])(
    "infers $expectedLanguage from a generated $label draft",
    ({
      label,
      country,
      countryCode,
      lat,
      lon,
      expectedLanguage,
      expectedLanguages,
      expectedTimeZone,
    }) => {
      const city = label.split(",")[0]!;
      const draft = buildLocationDraft(
        {
          lat,
          lon,
          display_name: label,
          address: {
            city,
            country,
            country_code: countryCode,
          },
        },
        [],
      );

      expect({
        language: draft.language,
        languages: draft.languages,
      }).toEqual(
        normalizeLocaleConfig({
          language: expectedLanguage,
          languages: expectedLanguages,
        }),
      );
      expect(draft.timeZone).toBe(expectedTimeZone);
    },
  );

  it("falls back to generic English for unknown country codes", () => {
    const draft = buildLocationDraft(
      {
        lat: "0",
        lon: "0",
        display_name: "Null Island",
        address: {
          country: "Unknown",
          country_code: "zz",
        },
      },
      [],
    );

    expect({
      language: draft.language,
      languages: draft.languages,
    }).toEqual(
      normalizeLocaleConfig({
        language: "en",
        languages: ["en"],
      }),
    );
    expect(draft.languageSelection.required).toBe(false);
  });

  it("requires a language choice for countries with multiple OSM language options", () => {
    const draft = buildLocationDraft(
      {
        lat: "45.4215",
        lon: "-75.6972",
        display_name: "Ottawa, Ontario, Canada",
        address: {
          city: "Ottawa",
          country: "Canada",
          country_code: "ca",
        },
      },
      [],
    );

    expect(draft.languageSelection.required).toBe(true);
    expect(draft.languageSelection.selectedValue).toBe("");
    expect(draft.languageSelection.options).toEqual([
      expect.objectContaining({
        value: "en-CA",
      }),
      expect.objectContaining({
        value: "fr-CA",
      }),
    ]);
  });

  it("uses Arabic for Egypt instead of the English fallback", () => {
    const draft = buildLocationDraft(
      {
        lat: "30.0444",
        lon: "31.2357",
        display_name: "Cairo, Egypt",
        address: {
          city: "Cairo",
          country: "Egypt",
          country_code: "eg",
        },
      },
      [],
    );

    expect(draft.language).toMatch(/^ar(?:-EG)?$/);
    expect(draft.languages).toContain("ar");
  });

  it("rejects empty location queries", async () => {
    await expect(fetchLocationDraft("   ", [])).rejects.toThrow(
      "Enter a location to generate a location.",
    );
  });
});
