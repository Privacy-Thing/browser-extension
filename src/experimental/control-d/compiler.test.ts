import { describe, expect, it } from "vitest";

import { compileControlDPattern, compileControlDState } from "./compiler";
import type { ControlDProxyLocation } from "./contracts";

import type { DomainRule, Location } from "@/shared/types";

const warsaw: Location = {
  id: "warsaw",
  label: "Warsaw",
  latitude: 52.23,
  longitude: 21.01,
  countryCode: "PL",
  accuracy: 25,
  noiseRadius: 50,
  language: "pl",
  languages: ["pl"],
  timeZone: "Europe/Warsaw",
};

const paris: Location = {
  ...warsaw,
  id: "paris",
  label: "Paris",
  latitude: 48.86,
  longitude: 2.35,
  countryCode: "FR",
  language: "fr",
  languages: ["fr"],
  timeZone: "Europe/Paris",
};

const ottawa: Location = {
  ...warsaw,
  id: "ottawa",
  label: "Ottawa",
  latitude: 45.42,
  longitude: -75.7,
  countryCode: "CA",
  language: "en",
  languages: ["en"],
  timeZone: "America/Toronto",
};

const proxies: ControlDProxyLocation[] = [
  {
    pk: "WAW",
    city: "Warsaw",
    countryCode: "PL",
    countryName: "Poland",
    latitude: 52.2,
    longitude: 21,
  },
  {
    pk: "PAR",
    city: "Paris",
    countryCode: "FR",
    countryName: "France",
    latitude: 48.86,
    longitude: 2.35,
  },
  {
    pk: "YOW",
    city: "Ottawa",
    countryCode: "CA",
    countryName: "Canada",
    latitude: 45.42,
    longitude: -75.7,
  },
  {
    pk: "BER",
    city: "Berlin",
    countryCode: "DE",
    countryName: "Germany",
    latitude: 52.52,
    longitude: 13.4,
  },
];

const rule = (pattern: string): DomainRule => ({
  pattern,
  enabled: true,
  locationId: warsaw.id,
});

describe("compileControlDPattern", () => {
  it("preserves subdomain-only patterns", () => {
    expect(compileControlDPattern("*.example.com")).toEqual({
      hostname: "*.example.com",
    });
  });

  it("maps Privacy Thing suffix patterns to apex-and-subdomains", () => {
    expect(compileControlDPattern("*example.com")).toEqual({
      hostname: "example.com",
    });
  });

  it("includes exact hosts with a widening warning and rejects unproven wildcards", () => {
    expect(compileControlDPattern("example.com")).toMatchObject({
      hostname: "example.com",
      warning: { code: "exact-pattern-broadened" },
    });
    expect(compileControlDPattern("server-*.example.com")).toMatchObject({
      warning: { code: "unsupported-pattern" },
    });
  });

  it("keeps exact hosts in the compiled regional rules", () => {
    const result = compileControlDState({
      rules: [rule("www.linkedin.com"), rule("github.com")],
      locations: [warsaw],
      proxies,
      storedMappings: {},
    });

    expect(result.rules.map((entry) => entry.hostname)).toEqual([
      "github.com",
      "www.linkedin.com",
    ]);
    expect(result.mappings.warsaw).toMatchObject({
      locationLabel: "Warsaw",
      ruleCount: 2,
    });
    expect(result.warnings).toHaveLength(2);
    expect(
      result.warnings.every((warning) => warning.code === "exact-pattern-broadened"),
    ).toBe(true);
  });
});

describe("compileControlDState", () => {
  it("compiles the exported Warsaw, Paris, and Ottawa rule set", () => {
    const result = compileControlDState({
      rules: [
        rule("www.linkedin.com"),
        rule("github.com"),
        rule("*www.instagram.com"),
        rule("*example.com"),
        { pattern: "*jakdojade.pl", enabled: true },
        { ...rule("iteracja.elpassion.com"), locationId: ottawa.id },
        { ...rule("test.pl"), locationId: paris.id },
      ],
      locations: [warsaw, paris, ottawa],
      proxies,
      storedMappings: {},
    });

    expect(result.rules).toHaveLength(6);
    expect(result.rules.map((entry) => entry.hostname)).toEqual([
      "example.com",
      "github.com",
      "iteracja.elpassion.com",
      "test.pl",
      "www.instagram.com",
      "www.linkedin.com",
    ]);
    expect(result.mappings).toMatchObject({
      warsaw: { proxyPk: "WAW", ruleCount: 4 },
      paris: { proxyPk: "PAR", ruleCount: 1 },
      ottawa: { proxyPk: "YOW", ruleCount: 1 },
    });
  });

  it("selects the nearest exit in the confirmed country", () => {
    const result = compileControlDState({
      rules: [rule("*example.com")],
      locations: [warsaw],
      proxies,
      storedMappings: {},
    });

    expect(result.rules).toEqual([
      {
        sourcePattern: "*example.com",
        hostname: "example.com",
        locationId: "warsaw",
        proxyPk: "WAW",
      },
    ]);
    expect(result.mappings.warsaw).toMatchObject({
      status: "exact",
      confirmed: true,
      proxyPk: "WAW",
    });
  });

  it("uses a visible approximate mapping when the country is unavailable", () => {
    const result = compileControlDState({
      rules: [rule("*.example.com")],
      locations: [{ ...warsaw, countryCode: "CZ" }],
      proxies,
      storedMappings: {},
    });

    expect(result.mappings.warsaw).toMatchObject({
      status: "approximate",
      confirmed: false,
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "approximate-location" }),
    );
  });

  it("honors an explicit skip and ignores disabled or location-less rules", () => {
    const result = compileControlDState({
      rules: [rule("*example.com"), { ...rule("*off.test"), enabled: false }],
      locations: [warsaw],
      proxies,
      storedMappings: {
        warsaw: {
          locationId: "warsaw",
          proxyPk: null,
          status: "skipped",
          confirmed: true,
        },
      },
    });

    expect(result.rules).toEqual([]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "skipped-location" }),
    );
  });
});
