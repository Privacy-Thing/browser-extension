import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { z } from "zod";

// Validates the generated spoofing catalogs (src/shared/*.generated.ts) so a
// scheduled revision release can never ship a structurally-valid-but-broken
// file (empty per-platform Chrome map, missing Steam platform, duplicate OSM
// countries, truncated upstream collapsing entry counts, etc.).
//
// Pure `validateCatalogs()` returns the list of problems and is unit-tested;
// the CLI dynamically imports the catalogs from --shared-dir (works on any
// checkout/worktree because the generated files only use erased `import type`).

const WEIGHT_SUM_TOLERANCE = 1e-4;
const CHROME_VERSION_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;
const COUNTRY_CODE_PATTERN = /^[a-z]{2}$/;
const CHROME_PLATFORMS = ["windows", "mac", "linux"] as const;
const STEAM_PLATFORMS = ["windows", "linux"] as const;
const MIN_CHROME_MAJORS = 3;
const MIN_OSM_COUNTRIES = 100;
const MIN_LOCALE_ENTRIES = 50;
const APPLE_DISPLAY_CLASSES = [
  "air-13",
  "air-15",
  "pro-14",
  "pro-16",
  "legacy-retina-13",
  "external-display-mac",
] as const;
const APPLE_SCALING_MODES = [
  "default",
  "more-space",
  "larger-text",
  "external",
] as const;

const weightedSchema = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value,
    weight: z
      .number()
      .positive()
      .max(1 + WEIGHT_SUM_TOLERANCE),
  });

const screenResolutionSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const steamPlatformSchema = z.object({
  resolutions: z.array(weightedSchema(screenResolutionSchema)),
  cpuCores: z.array(weightedSchema(z.number().int().min(1).max(256))),
  ram: z.array(weightedSchema(z.number().int().positive())),
});

const appleDeviceSchema = weightedSchema(
  z.object({
    screen: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      availWidth: z.number().int().positive(),
      availHeight: z.number().int().positive(),
      colorDepth: z.number().int().positive(),
      devicePixelRatio: z.number().positive(),
    }),
    hardwareConcurrency: z.number().int().min(1).max(16),
    physicalMemoryGb: z.number().int().positive(),
    maxTouchPoints: z.number().int().min(0),
    displayClass: z.enum(APPLE_DISPLAY_CLASSES),
    scalingMode: z.enum(APPLE_SCALING_MODES),
    nativeWidth: z.number().int().positive(),
    nativeHeight: z.number().int().positive(),
  }),
);

const osmEntrySchema = z.object({
  countryCode: z.string().regex(COUNTRY_CODE_PATTERN),
  languageCodes: z.array(z.string().min(1)).nonempty(),
});

const localeOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});
const localeEntrySchema = localeOptionSchema.extend({
  targets: z.array(z.enum(["chromium", "firefox"])).nonempty(),
});

export type RawCatalogs = {
  steam: unknown;
  apple: unknown;
  chrome: unknown;
  osmCatalog: unknown;
  osmMap: unknown;
  localeCatalog: unknown;
  localeOptionsByTarget: unknown;
};

export type ValidateOptions = {
  baseline?: RawCatalogs | undefined;
  driftThreshold?: number | undefined;
  growthThreshold?: number | undefined;
  distributionDriftThreshold?: number | undefined;
  osmMappingDriftThreshold?: number | undefined;
};

const checkWeightsSumToOne = (
  entries: readonly { weight: number }[],
  label: string,
  problems: string[],
): void => {
  if (entries.length === 0) return;
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (Math.abs(total - 1) > WEIGHT_SUM_TOLERANCE) {
    problems.push(`${label}: weights sum to ${total.toFixed(6)}, expected ~1`);
  }
};

const safeParse = (
  schema: z.ZodTypeAny,
  value: unknown,
  label: string,
  problems: string[],
): boolean => {
  const result = schema.safeParse(value);
  if (!result.success) {
    for (const issue of result.error.issues.slice(0, 10)) {
      problems.push(`${label}: ${issue.path.join(".") || "<root>"} — ${issue.message}`);
    }
    return false;
  }
  return true;
};

const validateSteam = (raw: unknown, problems: string[]): void => {
  const schema = z.record(z.string(), steamPlatformSchema);
  if (!safeParse(schema, raw, "steam", problems)) return;
  const catalog = raw as Record<string, z.infer<typeof steamPlatformSchema>>;
  for (const platform of STEAM_PLATFORMS) {
    const profile = catalog[platform];
    if (!profile) {
      problems.push(`steam: missing platform "${platform}"`);
      continue;
    }
    for (const category of ["resolutions", "cpuCores", "ram"] as const) {
      if (profile[category].length === 0) {
        problems.push(`steam.${platform}.${category}: empty`);
      }
      checkWeightsSumToOne(
        profile[category],
        `steam.${platform}.${category}`,
        problems,
      );
    }
  }
};

const validateApple = (raw: unknown, problems: string[]): void => {
  const schema = z.object({
    devices: z.array(appleDeviceSchema),
    marginals: steamPlatformSchema,
  });
  if (!safeParse(schema, raw, "apple", problems)) return;
  const catalog = raw as z.infer<typeof schema>;
  if (catalog.devices.length === 0) problems.push("apple.devices: empty");
  checkWeightsSumToOne(catalog.devices, "apple.devices", problems);
  for (const category of ["resolutions", "cpuCores", "ram"] as const) {
    if (catalog.marginals[category].length === 0) {
      problems.push(`apple.marginals.${category}: empty`);
    }
  }
};

const validateChrome = (raw: unknown, problems: string[]): void => {
  const versionsByMajor = z.record(z.string(), z.array(z.string()));
  const schema = z.record(z.string(), versionsByMajor);
  if (!safeParse(schema, raw, "chrome", problems)) return;
  const catalog = raw as Record<string, Record<string, string[]>>;
  for (const platform of CHROME_PLATFORMS) {
    const byMajor = catalog[platform];
    if (!byMajor) {
      problems.push(`chrome: missing platform "${platform}"`);
      continue;
    }
    const majors = Object.keys(byMajor);
    if (majors.length < MIN_CHROME_MAJORS) {
      problems.push(
        `chrome.${platform}: only ${majors.length} major version(s), expected >= ${MIN_CHROME_MAJORS}`,
      );
    }
    for (const major of majors) {
      const versions = byMajor[major] ?? [];
      if (versions.length === 0) {
        problems.push(`chrome.${platform}.${major}: empty version list`);
      }
      for (const version of versions) {
        if (!CHROME_VERSION_PATTERN.test(version)) {
          problems.push(`chrome.${platform}.${major}: invalid version "${version}"`);
        }
      }
    }
  }
};

const validateOsm = (
  rawCatalog: unknown,
  rawMap: unknown,
  problems: string[],
): void => {
  if (!safeParse(z.array(osmEntrySchema), rawCatalog, "osm", problems)) return;
  const catalog = rawCatalog as z.infer<typeof osmEntrySchema>[];
  if (catalog.length < MIN_OSM_COUNTRIES) {
    problems.push(
      `osm: only ${catalog.length} countries, expected >= ${MIN_OSM_COUNTRIES}`,
    );
  }
  const seen = new Set<string>();
  for (const entry of catalog) {
    if (seen.has(entry.countryCode)) {
      problems.push(`osm: duplicate country code "${entry.countryCode}"`);
    }
    seen.add(entry.countryCode);
  }
  if (rawMap && typeof rawMap === "object") {
    const map = rawMap as Record<string, readonly string[]>;
    if (Object.keys(map).length !== seen.size) {
      problems.push(
        `osm: map has ${Object.keys(map).length} entries, catalog has ${seen.size} unique countries`,
      );
    }
  } else {
    problems.push("osm: osmCountryLanguageMap missing or not an object");
  }
};

const validateLocale = (
  rawCatalog: unknown,
  rawOptions: unknown,
  problems: string[],
): void => {
  if (!safeParse(z.array(localeEntrySchema), rawCatalog, "locale", problems)) return;
  const catalog = rawCatalog as z.infer<typeof localeEntrySchema>[];
  if (catalog.length < MIN_LOCALE_ENTRIES) {
    problems.push(
      `locale: only ${catalog.length} entries, expected >= ${MIN_LOCALE_ENTRIES}`,
    );
  }
  const values = new Set(catalog.map((entry) => entry.value.toLowerCase()));

  const optionsSchema = z.record(z.string(), z.array(localeOptionSchema));
  if (!safeParse(optionsSchema, rawOptions, "locale.optionsByTarget", problems)) return;
  const optionsByTarget = rawOptions as Record<
    string,
    z.infer<typeof localeOptionSchema>[]
  >;
  for (const [target, options] of Object.entries(optionsByTarget)) {
    if (options.length === 0) problems.push(`locale.optionsByTarget.${target}: empty`);
    const perTarget = new Set<string>();
    for (const option of options) {
      const key = option.value.toLowerCase();
      if (perTarget.has(key)) {
        problems.push(
          `locale.optionsByTarget.${target}: duplicate value "${option.value}"`,
        );
      }
      perTarget.add(key);
      if (!values.has(key)) {
        problems.push(
          `locale.optionsByTarget.${target}: value "${option.value}" not present in localeCatalog`,
        );
      }
    }
  }
};

const sizeMetrics = (catalogs: RawCatalogs): Record<string, number> => {
  const metrics: Record<string, number> = {};
  const steam = catalogs.steam as Record<
    string,
    { resolutions: unknown[]; cpuCores: unknown[]; ram: unknown[] }
  >;
  if (steam && typeof steam === "object") {
    for (const platform of STEAM_PLATFORMS) {
      const p = steam[platform];
      metrics[`steam.${platform}`] = p
        ? p.resolutions.length + p.cpuCores.length + p.ram.length
        : 0;
    }
  }
  const apple = catalogs.apple as { devices?: unknown[] } | undefined;
  metrics["apple.devices"] = Array.isArray(apple?.devices) ? apple!.devices.length : 0;
  const chrome = catalogs.chrome as
    Record<string, Record<string, unknown[]>> | undefined;
  metrics["chrome.versions"] = chrome
    ? Object.values(chrome).reduce(
        (sum, byMajor) =>
          sum + Object.values(byMajor).reduce((s, versions) => s + versions.length, 0),
        0,
      )
    : 0;
  metrics["osm.countries"] = Array.isArray(catalogs.osmCatalog)
    ? catalogs.osmCatalog.length
    : 0;
  metrics["locale.entries"] = Array.isArray(catalogs.localeCatalog)
    ? catalogs.localeCatalog.length
    : 0;
  return metrics;
};

const validateDrift = (
  current: RawCatalogs,
  baseline: RawCatalogs,
  dropThreshold: number,
  growthThreshold: number,
  problems: string[],
): void => {
  const currentMetrics = sizeMetrics(current);
  const baselineMetrics = sizeMetrics(baseline);
  for (const [key, baseValue] of Object.entries(baselineMetrics)) {
    if (baseValue <= 0) continue;
    const value = currentMetrics[key] ?? 0;
    const floor = baseValue * (1 - dropThreshold);
    const ceiling = baseValue * (1 + growthThreshold);
    if (value < floor) {
      problems.push(
        `drift: ${key} dropped from ${baseValue} to ${value} (below floor ${floor.toFixed(0)} at ${(
          dropThreshold * 100
        ).toFixed(0)}% threshold)`,
      );
    } else if (value > ceiling) {
      problems.push(
        `drift: ${key} grew from ${baseValue} to ${value} (above ceiling ${ceiling.toFixed(0)} at ${(
          growthThreshold * 100
        ).toFixed(0)}% threshold)`,
      );
    }
  }
};

type WeightedValue = { value: unknown; weight: number };

const stableValueKey = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableValueKey).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableValueKey(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? String(value);
};

const collectWeightedSets = (
  catalogs: RawCatalogs,
): Record<string, readonly WeightedValue[]> => {
  const distributions: Record<string, readonly WeightedValue[]> = {};
  const steam = catalogs.steam as
    Record<string, Record<string, WeightedValue[]>> | undefined;
  for (const platform of STEAM_PLATFORMS) {
    const profile = steam?.[platform];
    for (const category of ["resolutions", "cpuCores", "ram"] as const) {
      const entries = profile?.[category];
      if (Array.isArray(entries)) {
        distributions[`steam.${platform}.${category}`] = entries;
      }
    }
  }

  const apple = catalogs.apple as
    | {
        devices?: WeightedValue[];
        marginals?: Record<string, WeightedValue[]>;
      }
    | undefined;
  if (Array.isArray(apple?.devices)) {
    distributions["apple.devices"] = apple.devices;
  }
  for (const category of ["resolutions", "cpuCores", "ram"] as const) {
    const entries = apple?.marginals?.[category];
    if (Array.isArray(entries)) {
      distributions[`apple.marginals.${category}`] = entries;
    }
  }
  return distributions;
};

const distributionWeights = (
  entries: readonly WeightedValue[],
): Map<string, number> => {
  const weights = new Map<string, number>();
  for (const entry of entries) {
    const key = stableValueKey(entry.value);
    weights.set(key, (weights.get(key) ?? 0) + entry.weight);
  }
  return weights;
};

const totalVariationDistance = (
  current: readonly WeightedValue[],
  baseline: readonly WeightedValue[],
): number => {
  const currentWeights = distributionWeights(current);
  const baselineWeights = distributionWeights(baseline);
  const keys = new Set([...currentWeights.keys(), ...baselineWeights.keys()]);
  let absoluteDifference = 0;
  for (const key of keys) {
    absoluteDifference += Math.abs(
      (currentWeights.get(key) ?? 0) - (baselineWeights.get(key) ?? 0),
    );
  }
  return absoluteDifference / 2;
};

const validateWeightDrift = (
  current: RawCatalogs,
  baseline: RawCatalogs,
  threshold: number,
  problems: string[],
): void => {
  const currentDistributions = collectWeightedSets(current);
  const baselineDistributions = collectWeightedSets(baseline);
  for (const [key, baselineEntries] of Object.entries(baselineDistributions)) {
    const currentEntries = currentDistributions[key];
    if (
      !currentEntries ||
      currentEntries.length === 0 ||
      baselineEntries.length === 0
    ) {
      continue;
    }
    const distance = totalVariationDistance(currentEntries, baselineEntries);
    if (distance > threshold) {
      problems.push(
        `drift: ${key} distribution distance ${distance.toFixed(4)} exceeds ${threshold.toFixed(4)}`,
      );
    }
  }
};

const osmLanguageMap = (raw: unknown): Map<string, string> => {
  const result = new Map<string, string>();
  if (!Array.isArray(raw)) return result;
  for (const entry of raw) {
    const candidate = entry as Record<string, unknown> | null;
    if (
      !candidate ||
      typeof candidate !== "object" ||
      typeof candidate.countryCode !== "string" ||
      !Array.isArray(candidate.languageCodes)
    ) {
      continue;
    }
    result.set(
      candidate.countryCode,
      [...candidate.languageCodes].sort().join("\u0000"),
    );
  }
  return result;
};

const validateOsmMappingDrift = (
  current: RawCatalogs,
  baseline: RawCatalogs,
  threshold: number,
  problems: string[],
): void => {
  const currentMap = osmLanguageMap(current.osmCatalog);
  const baselineMap = osmLanguageMap(baseline.osmCatalog);
  const countries = new Set([...currentMap.keys(), ...baselineMap.keys()]);
  if (countries.size === 0) return;

  let changed = 0;
  for (const country of countries) {
    if (currentMap.get(country) !== baselineMap.get(country)) changed += 1;
  }
  const ratio = changed / countries.size;
  if (ratio > threshold) {
    problems.push(
      `drift: osm language mappings changed for ${changed}/${countries.size} countries (${ratio.toFixed(4)}, limit ${threshold.toFixed(4)})`,
    );
  }
};

export const validateCatalogs = (
  catalogs: RawCatalogs,
  options: ValidateOptions = {},
): string[] => {
  const problems: string[] = [];
  validateSteam(catalogs.steam, problems);
  validateApple(catalogs.apple, problems);
  validateChrome(catalogs.chrome, problems);
  validateOsm(catalogs.osmCatalog, catalogs.osmMap, problems);
  validateLocale(catalogs.localeCatalog, catalogs.localeOptionsByTarget, problems);
  if (options.baseline) {
    validateDrift(
      catalogs,
      options.baseline,
      options.driftThreshold ?? 0.5,
      options.growthThreshold ?? 0.5,
      problems,
    );
    validateWeightDrift(
      catalogs,
      options.baseline,
      options.distributionDriftThreshold ?? 0.25,
      problems,
    );
    validateOsmMappingDrift(
      catalogs,
      options.baseline,
      options.osmMappingDriftThreshold ?? 0.2,
      problems,
    );
  }
  return problems;
};

const loadCatalogs = async (sharedDir: string): Promise<RawCatalogs> => {
  const importFrom = async (file: string) =>
    import(pathToFileURL(path.join(sharedDir, file)).href);
  const steam = await importFrom("hardware-profiles.steam.generated.ts");
  const apple = await importFrom("hardware-profiles.apple.generated.ts");
  const chrome = await importFrom("chrome-versions.generated.ts");
  const osm = await importFrom("osm-country-languages.generated.ts");
  const locale = await importFrom("locale-catalog.generated.ts");
  return {
    steam: steam.steamHardwareCatalog,
    apple: apple.appleHardwareCatalog,
    chrome: chrome.chromeVersionCatalog,
    osmCatalog: osm.osmCountryLanguageCatalog,
    osmMap: osm.osmCountryLanguageMap,
    localeCatalog: locale.localeCatalog,
    localeOptionsByTarget: locale.localeOptionsByTarget,
  };
};

const parseArgs = (argv: string[]) => {
  const args = {
    sharedDir: "src/shared",
    baselineDir: "",
    driftThreshold: 0.5,
    growthThreshold: 0.5,
    distributionDriftThreshold: 0.25,
    osmMappingDriftThreshold: 0.2,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--shared-dir") args.sharedDir = argv[++index] ?? args.sharedDir;
    else if (value === "--baseline-dir")
      args.baselineDir = argv[++index] ?? args.baselineDir;
    else if (value === "--drift-threshold") args.driftThreshold = Number(argv[++index]);
    else if (value === "--growth-threshold")
      args.growthThreshold = Number(argv[++index]);
    else if (value === "--distribution-drift-threshold")
      args.distributionDriftThreshold = Number(argv[++index]);
    else if (value === "--osm-mapping-drift-threshold")
      args.osmMappingDriftThreshold = Number(argv[++index]);
  }
  return args;
};

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  const args = parseArgs(process.argv.slice(2));
  void (async () => {
    try {
      const catalogs = await loadCatalogs(path.resolve(args.sharedDir));
      const baseline = args.baselineDir
        ? await loadCatalogs(path.resolve(args.baselineDir))
        : undefined;
      const problems = validateCatalogs(catalogs, {
        baseline,
        driftThreshold: args.driftThreshold,
        growthThreshold: args.growthThreshold,
        distributionDriftThreshold: args.distributionDriftThreshold,
        osmMappingDriftThreshold: args.osmMappingDriftThreshold,
      });
      if (problems.length > 0) {
        console.error(`Metadata validation failed (${problems.length} problem(s)):`);
        for (const problem of problems) console.error(`  - ${problem}`);
        process.exit(1);
      }
      console.log(`Metadata validation passed for ${args.sharedDir}.`);
    } catch (error) {
      console.error(
        "Metadata validation crashed:",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  })();
}
