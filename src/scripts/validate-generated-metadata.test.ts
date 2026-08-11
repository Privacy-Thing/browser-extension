import { describe, expect, it } from "vitest";

import {
  type RawCatalogs,
  validateCatalogs,
} from "../../scripts/validate-generated-metadata";

const weighted = <T>(value: T, weight: number) => ({ value, weight });

const steamProfile = () => ({
  resolutions: [weighted({ width: 1920, height: 1080 }, 1)],
  cpuCores: [weighted(8, 1)],
  ram: [weighted(16, 1)],
});

const chromeByMajor = (versionsPerMajor: number) => {
  const byMajor: Record<string, string[]> = {};
  for (let major = 150; major > 150 - 4; major -= 1) {
    byMajor[String(major)] = Array.from(
      { length: versionsPerMajor },
      (_unused, index) => `${major}.0.${1000 + index}.5`,
    );
  }
  return byMajor;
};

const osmCountries = (count: number) => {
  const entries: { countryCode: string; languageCodes: string[] }[] = [];
  for (let index = 0; index < count; index += 1) {
    const first = String.fromCharCode(97 + Math.floor(index / 26));
    const second = String.fromCharCode(97 + (index % 26));
    entries.push({ countryCode: `${first}${second}`, languageCodes: ["en"] });
  }
  return entries;
};

const localeEntries = (count: number) =>
  Array.from({ length: count }, (_unused, index) => ({
    value: `l${index}`,
    label: `Locale ${index} [l${index}]`,
    targets: ["chromium", "firefox"] as const,
  }));

const makeValidCatalogs = (versionsPerMajor = 1): RawCatalogs => {
  const osm = osmCountries(120);
  const locales = localeEntries(60);
  return {
    steam: { windows: steamProfile(), linux: steamProfile() },
    apple: {
      devices: [
        weighted(
          {
            screen: {
              width: 1512,
              height: 982,
              availWidth: 1512,
              availHeight: 944,
              colorDepth: 30,
              devicePixelRatio: 2,
            },
            hardwareConcurrency: 8,
            physicalMemoryGb: 16,
            maxTouchPoints: 0,
            displayClass: "pro-14",
            scalingMode: "default",
            nativeWidth: 3024,
            nativeHeight: 1964,
          },
          1,
        ),
      ],
      marginals: steamProfile(),
    },
    chrome: {
      windows: chromeByMajor(versionsPerMajor),
      mac: chromeByMajor(versionsPerMajor),
      linux: chromeByMajor(versionsPerMajor),
    },
    osmCatalog: osm,
    osmMap: Object.fromEntries(
      osm.map((entry) => [entry.countryCode, entry.languageCodes]),
    ),
    localeCatalog: locales,
    localeOptionsByTarget: {
      chromium: locales.map(({ value, label }) => ({ value, label })),
      firefox: locales.map(({ value, label }) => ({ value, label })),
    },
  };
};

describe("validateCatalogs", () => {
  it("accepts a well-formed catalog set", () => {
    expect(validateCatalogs(makeValidCatalogs())).toEqual([]);
  });

  it("rejects an empty per-platform Chrome map", () => {
    const catalogs = makeValidCatalogs();
    (catalogs.chrome as Record<string, unknown>).mac = {};
    const problems = validateCatalogs(catalogs);
    expect(problems.some((p) => p.startsWith("chrome.mac"))).toBe(true);
  });

  it("rejects a missing Steam platform", () => {
    const catalogs = makeValidCatalogs();
    delete (catalogs.steam as Record<string, unknown>).linux;
    expect(validateCatalogs(catalogs)).toContain('steam: missing platform "linux"');
  });

  it("rejects duplicate OSM country codes", () => {
    const catalogs = makeValidCatalogs();
    const osm = catalogs.osmCatalog as {
      countryCode: string;
      languageCodes: string[];
    }[];
    osm.push({ countryCode: osm[0]!.countryCode, languageCodes: ["en"] });
    catalogs.osmMap = Object.fromEntries(
      osm.map((e) => [e.countryCode, e.languageCodes]),
    );
    expect(
      validateCatalogs(catalogs).some((p) => p.includes("duplicate country code")),
    ).toBe(true);
  });

  it("rejects weights that do not sum to one", () => {
    const catalogs = makeValidCatalogs();
    (catalogs.steam as { windows: ReturnType<typeof steamProfile> }).windows.cpuCores =
      [weighted(8, 0.4), weighted(4, 0.2)];
    expect(
      validateCatalogs(catalogs).some((p) =>
        p.startsWith("steam.windows.cpuCores: weights sum"),
      ),
    ).toBe(true);
  });

  it("rejects a locale option missing from the main catalog", () => {
    const catalogs = makeValidCatalogs();
    (
      catalogs.localeOptionsByTarget as { chromium: { value: string; label: string }[] }
    ).chromium.push({ value: "zz", label: "Ghost [zz]" });
    expect(
      validateCatalogs(catalogs).some((p) =>
        p.includes("not present in localeCatalog"),
      ),
    ).toBe(true);
  });

  it("flags a collapsed catalog via drift detection", () => {
    const baseline = makeValidCatalogs(8);
    const current = makeValidCatalogs(1);
    const problems = validateCatalogs(current, { baseline, driftThreshold: 0.5 });
    expect(problems.some((p) => p.startsWith("drift: chrome.versions"))).toBe(true);
  });

  it("does not flag drift when counts are stable", () => {
    const problems = validateCatalogs(makeValidCatalogs(8), {
      baseline: makeValidCatalogs(8),
      driftThreshold: 0.5,
    });
    expect(problems).toEqual([]);
  });

  it("flags an unexpectedly expanded catalog", () => {
    const problems = validateCatalogs(makeValidCatalogs(8), {
      baseline: makeValidCatalogs(1),
      growthThreshold: 0.5,
    });
    expect(problems.some((p) => p.startsWith("drift: chrome.versions grew"))).toBe(
      true,
    );
  });

  it("flags a large weighted distribution change", () => {
    const baseline = makeValidCatalogs();
    const current = makeValidCatalogs();
    const baselineCpu = (baseline.steam as { windows: ReturnType<typeof steamProfile> })
      .windows.cpuCores;
    const currentCpu = (current.steam as { windows: ReturnType<typeof steamProfile> })
      .windows.cpuCores;
    baselineCpu.splice(0, 1, weighted(4, 0.5), weighted(8, 0.5));
    currentCpu.splice(0, 1, weighted(4, 0.1), weighted(8, 0.9));

    expect(
      validateCatalogs(current, { baseline }).some((p) =>
        p.startsWith("drift: steam.windows.cpuCores distribution"),
      ),
    ).toBe(true);
  });

  it("compares object-valued distributions by stable keys", () => {
    const baseline = makeValidCatalogs();
    const current = makeValidCatalogs();
    const currentResolutions = (
      current.steam as { windows: ReturnType<typeof steamProfile> }
    ).windows.resolutions;
    currentResolutions[0] = weighted({ height: 1080, width: 1920 }, 1);

    expect(validateCatalogs(current, { baseline })).toEqual([]);
  });

  it("flags widespread OSM language mapping changes", () => {
    const baseline = makeValidCatalogs();
    const current = makeValidCatalogs();
    const currentOsm = current.osmCatalog as {
      countryCode: string;
      languageCodes: string[];
    }[];
    for (const entry of currentOsm.slice(0, 30)) entry.languageCodes = ["zz"];
    current.osmMap = Object.fromEntries(
      currentOsm.map((entry) => [entry.countryCode, entry.languageCodes]),
    );

    expect(
      validateCatalogs(current, { baseline }).some((p) =>
        p.startsWith("drift: osm language mappings changed"),
      ),
    ).toBe(true);
  });
});
