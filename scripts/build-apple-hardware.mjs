import fs from "node:fs";
import process from "node:process";
import { URL } from "node:url";

// Apple Silicon hardware profiles from Valve's public Steam Hardware & Software
// Survey. Steam provides macOS marginal distributions; this generator constrains
// them with a small Apple display/scaling compatibility table so runtime profiles
// are plausible bundles instead of independent field draws.

const STEAM_MAC_SURVEY_URL =
  "https://store.steampowered.com/hwsurvey/Steam-Hardware-Software-Survey-Welcome-to-Steam/?platform=mac";
const OUTPUT_PATH = new URL(
  "../src/shared/hardware-profiles.apple.generated.ts",
  import.meta.url,
);
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const MAC_MENU_BAR_PX = 25;

const CPU_COMPATIBILITY = {
  "air-13": [8, 10],
  "air-15": [8, 10],
  "pro-14": [10, 11, 12, 14, 16],
  "pro-16": [10, 12, 14, 16],
  "legacy-retina-13": [8, 10],
  // Capped at 16 (Apple Silicon "Max" laptop). Higher counts (20/24/28/32) are
  // Ultra/Xeon desktop-tier and read as non-Apple-Silicon; they carry ~0 survey
  // weight, so dropping them keeps every bundle plausible for any macOS host now
  // that arch gating is relaxed.
  "external-display-mac": [8, 10, 12, 14, 16],
};

const RAM_COMPATIBILITY = {
  "air-13": [8, 16, 24],
  "air-15": [8, 16, 24],
  "pro-14": [16, 24, 32, 36, 48, 64],
  "pro-16": [16, 24, 32, 36, 48, 64],
  "legacy-retina-13": [8, 16, 24],
  "external-display-mac": [8, 16, 24, 32, 36, 48, 64],
};

const resolutionKey = ({ width, height }) => `${width}x${height}`;

const builtIn = ({
  width,
  height,
  nativeWidth,
  nativeHeight,
  displayClass,
  scalingMode,
}) => ({
  value: { width, height },
  nativeWidth,
  nativeHeight,
  displayClass,
  scalingMode,
  devicePixelRatio: 2,
  colorDepth: 30,
});

const external = ({ width, height }) => ({
  value: { width, height },
  nativeWidth: width,
  nativeHeight: height,
  displayClass: "external-display-mac",
  scalingMode: "external",
  devicePixelRatio: 1,
  colorDepth: 24,
});

const APPLE_DISPLAY_MODES = [
  builtIn({
    width: 1280,
    height: 800,
    nativeWidth: 2560,
    nativeHeight: 1600,
    displayClass: "legacy-retina-13",
    scalingMode: "larger-text",
  }),
  builtIn({
    width: 1440,
    height: 900,
    nativeWidth: 2560,
    nativeHeight: 1600,
    displayClass: "legacy-retina-13",
    scalingMode: "default",
  }),
  builtIn({
    width: 1280,
    height: 832,
    nativeWidth: 2560,
    nativeHeight: 1664,
    displayClass: "air-13",
    scalingMode: "larger-text",
  }),
  builtIn({
    width: 1352,
    height: 878,
    nativeWidth: 2560,
    nativeHeight: 1664,
    displayClass: "air-13",
    scalingMode: "larger-text",
  }),
  builtIn({
    width: 1408,
    height: 881,
    nativeWidth: 2560,
    nativeHeight: 1664,
    displayClass: "air-13",
    scalingMode: "default",
  }),
  builtIn({
    width: 1440,
    height: 932,
    nativeWidth: 2560,
    nativeHeight: 1664,
    displayClass: "air-13",
    scalingMode: "default",
  }),
  builtIn({
    width: 1470,
    height: 956,
    nativeWidth: 2560,
    nativeHeight: 1664,
    displayClass: "air-13",
    scalingMode: "default",
  }),
  builtIn({
    width: 1496,
    height: 967,
    nativeWidth: 2880,
    nativeHeight: 1864,
    displayClass: "air-15",
    scalingMode: "default",
  }),
  builtIn({
    width: 1512,
    height: 982,
    nativeWidth: 3024,
    nativeHeight: 1964,
    displayClass: "pro-14",
    scalingMode: "default",
  }),
  builtIn({
    width: 1710,
    height: 1107,
    nativeWidth: 3024,
    nativeHeight: 1964,
    displayClass: "pro-14",
    scalingMode: "more-space",
  }),
  builtIn({
    width: 1800,
    height: 1169,
    nativeWidth: 3024,
    nativeHeight: 1964,
    displayClass: "pro-14",
    scalingMode: "more-space",
  }),
  builtIn({
    width: 1728,
    height: 1117,
    nativeWidth: 3456,
    nativeHeight: 2234,
    displayClass: "pro-16",
    scalingMode: "default",
  }),
  builtIn({
    width: 1920,
    height: 1243,
    nativeWidth: 3456,
    nativeHeight: 2234,
    displayClass: "pro-16",
    scalingMode: "more-space",
  }),
  builtIn({
    width: 2056,
    height: 1329,
    nativeWidth: 3456,
    nativeHeight: 2234,
    displayClass: "pro-16",
    scalingMode: "more-space",
  }),
  external({ width: 1920, height: 1080 }),
  external({ width: 2240, height: 1260 }),
  external({ width: 2560, height: 1440 }),
  external({ width: 3840, height: 2160 }),
];

const DISPLAY_MODE_BY_SIZE = new Map(
  APPLE_DISPLAY_MODES.map((mode) => [resolutionKey(mode.value), mode]),
);

const ALL_COMPATIBLE_CPUS = new Set(Object.values(CPU_COMPATIBILITY).flat());
const ALL_COMPATIBLE_RAM = new Set(Object.values(RAM_COMPATIBILITY).flat());

const isOutputFresh = () => {
  try {
    const { mtimeMs } = fs.statSync(OUTPUT_PATH);
    return Date.now() - mtimeMs < MAX_AGE_MS;
  } catch {
    return false;
  }
};

const FORCE_REGEN =
  process.env.PT_FORCE_REGEN === "1" || process.argv.includes("--force");

if (!FORCE_REGEN && isOutputFresh()) {
  process.stdout.write(
    "hardware-profiles.apple.generated.ts is less than 24h old - skipping download.\n",
  );
  process.exit(0);
}

const stripTags = (value) =>
  value
    .replace(/<[^>]*>/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const assertDisplayModes = () => {
  const seen = new Set();
  for (const mode of APPLE_DISPLAY_MODES) {
    const key = resolutionKey(mode.value);
    if (seen.has(key)) throw new Error(`Duplicate Apple display mode: ${key}`);
    seen.add(key);
    if (mode.displayClass === "external-display-mac") {
      if (mode.devicePixelRatio !== 1 || mode.nativeWidth !== mode.value.width) {
        throw new Error(`External display mode must be 1x/native: ${key}`);
      }
      continue;
    }
    if (mode.devicePixelRatio !== 2 || mode.colorDepth !== 30) {
      throw new Error(`Built-in Retina mode must use DPR 2 and 30-bit color: ${key}`);
    }
    const exact2x =
      mode.nativeWidth === mode.value.width * 2 &&
      mode.nativeHeight === mode.value.height * 2;
    if (
      !exact2x &&
      !["default", "more-space", "larger-text"].includes(mode.scalingMode)
    ) {
      throw new Error(`Scaled Retina mode must be explicitly classified: ${key}`);
    }
  }
};

const fetchPage = async () => {
  const response = await globalThis.fetch(STEAM_MAC_SURVEY_URL, {
    headers: { Accept: "text/html" },
  });
  if (!response.ok) {
    throw new Error(`Could not download Steam macOS survey page (${response.status}).`);
  }
  return response.text();
};

const extractCategoryRows = (html, categoryLabel) => {
  const header = new RegExp(
    `id="(cat\\d+)_stats_row"[^>]*>\\s*<a name="cat\\d+"></a>\\s*<div class="stats_col_left">${escapeRegExp(categoryLabel)}</div>`,
  ).exec(html);
  if (!header) {
    throw new Error(`Survey category not found on page: "${categoryLabel}".`);
  }

  const catId = header[1];
  const detailsStart = html.indexOf(`id="${catId}_details"`);
  if (detailsStart < 0) return [];
  const nextRow = /id="cat\d+_stats_row"/.exec(html.slice(detailsStart + 10));
  const block = html.slice(
    detailsStart,
    detailsStart + 10 + (nextRow ? nextRow.index : 8000),
  );

  const rows = [];
  const seen = new Set();
  const cellPattern =
    /stats_col_mid data_row">([\s\S]*?)<\/div>\s*<div class="stats_col_right data_row">([\s\S]*?)<\/div>/g;
  let match;
  while ((match = cellPattern.exec(block)) !== null) {
    const name = stripTags(match[1]);
    const percentMatch = /([\d.]+)\s*%/.exec(stripTags(match[2]));
    if (!percentMatch || seen.has(name)) continue;
    seen.add(name);
    rows.push({ name, percentage: Number(percentMatch[1]) / 100 });
  }
  return rows;
};

const parseResolution = (name) => {
  const match = /^(\d+)\s*x\s*(\d+)$/.exec(name.trim());
  if (!match) return undefined;
  const resolution = { width: Number(match[1]), height: Number(match[2]) };
  return DISPLAY_MODE_BY_SIZE.has(resolutionKey(resolution)) ? resolution : undefined;
};

const parseCpuCores = (name) => {
  const match = /^(\d+)\s*cpus?$/i.exec(name.trim());
  if (!match) return undefined;
  const cores = Number(match[1]);
  return ALL_COMPATIBLE_CPUS.has(cores) ? cores : undefined;
};

const parseRamGb = (name) => {
  const match = /^([\d.]+)\s*GB$/i.exec(name.trim());
  if (!match) return undefined;
  const gb = Number(match[1]);
  return ALL_COMPATIBLE_RAM.has(gb) ? gb : undefined;
};

const toWeightedEntries = (rows, parseValue, keyOf) => {
  const buckets = new Map();
  for (const row of rows) {
    const value = parseValue(row.name);
    if (value === undefined) continue;
    if (!Number.isFinite(row.percentage) || row.percentage <= 0) continue;
    const key = keyOf(value);
    if (buckets.has(key)) continue;
    buckets.set(key, { value, weight: row.percentage });
  }

  const entries = [...buckets.values()];
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    throw new Error(
      "No valid Apple Silicon survey rows survived filtering for a category.",
    );
  }
  return entries
    .map((entry) => ({ value: entry.value, weight: entry.weight / total }))
    .sort((a, b) => b.weight - a.weight);
};

const compatibleWith = (displayClass, cores, ramGb) =>
  CPU_COMPATIBILITY[displayClass]?.includes(cores) &&
  RAM_COMPATIBILITY[displayClass]?.includes(ramGb);

const screenFromMode = (mode) => ({
  width: mode.value.width,
  height: mode.value.height,
  availWidth: mode.value.width,
  availHeight: Math.max(mode.value.height - MAC_MENU_BAR_PX, 0),
  colorDepth: mode.colorDepth,
  devicePixelRatio: mode.devicePixelRatio,
});

const buildDevices = ({ resolutions, cpuCores, ram }) => {
  const rawDevices = [];
  for (const resolution of resolutions) {
    const mode = DISPLAY_MODE_BY_SIZE.get(resolutionKey(resolution.value));
    if (!mode) continue;
    for (const cpu of cpuCores) {
      for (const ramGb of ram) {
        if (!compatibleWith(mode.displayClass, cpu.value, ramGb.value)) continue;
        rawDevices.push({
          value: {
            screen: screenFromMode(mode),
            hardwareConcurrency: cpu.value,
            physicalMemoryGb: ramGb.value,
            maxTouchPoints: 0,
            displayClass: mode.displayClass,
            scalingMode: mode.scalingMode,
            nativeWidth: mode.nativeWidth,
            nativeHeight: mode.nativeHeight,
          },
          weight: resolution.weight * cpu.weight * ramGb.weight,
        });
      }
    }
  }

  const total = rawDevices.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    throw new Error(
      "No Apple Silicon bundle candidates survived compatibility filtering.",
    );
  }
  return rawDevices
    .map((entry) => ({ value: entry.value, weight: entry.weight / total }))
    .sort((a, b) => b.weight - a.weight);
};

const extractSurveyMonth = (html) =>
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}/.exec(
    html,
  )?.[0] ?? "unknown";

const buildCatalog = (html) => {
  const marginals = {
    resolutions: toWeightedEntries(
      extractCategoryRows(html, "Primary Display Resolution (OSX)"),
      parseResolution,
      (v) => `${v.width}x${v.height}`,
    ),
    cpuCores: toWeightedEntries(
      extractCategoryRows(html, "Physical CPUs (OSX)"),
      parseCpuCores,
      (v) => String(v),
    ),
    ram: toWeightedEntries(
      extractCategoryRows(html, "System RAM (OSX)"),
      parseRamGb,
      (v) => String(v),
    ),
  };
  return { devices: buildDevices(marginals), marginals };
};

const buildOutput = (
  catalog,
  surveyMonth,
) => `// Generated by scripts/build-apple-hardware.mjs. Do not edit by hand.
// Source weights: Steam Hardware & Software Survey (Valve), macOS snapshot ${surveyMonth}, read from
//   ${STEAM_MAC_SURVEY_URL}
// Bundles are synthetic: Steam macOS marginals constrained by Apple display/scaling
// and CPU/RAM compatibility rules. Runtime use is gated to macOS hosts.

import type { AppleHardwareCatalog } from "./hardware-profiles";

export const appleHardwareSurveyDate = ${JSON.stringify(surveyMonth)} as const;

export const appleHardwareCatalog: AppleHardwareCatalog = ${JSON.stringify(catalog, null, 2)};
`;

assertDisplayModes();
process.stdout.write("Fetching Steam survey (mac)...\n");
const html = await fetchPage();
const surveyMonth = extractSurveyMonth(html);
const catalog = buildCatalog(html);
process.stdout.write(
  `  mac: ${catalog.devices.length} coherent bundles from ${catalog.marginals.resolutions.length} resolutions, ${catalog.marginals.cpuCores.length} core buckets, ${catalog.marginals.ram.length} RAM buckets\n`,
);
process.stdout.write(`Survey snapshot: ${surveyMonth}\n`);

// Refuse to emit a structurally-valid-but-broken catalog: a truncated survey or
// over-aggressive compatibility filtering could leave no devices or marginals.
if (catalog.devices.length === 0) {
  throw new Error(
    "apple: no coherent device bundles — refusing to write a broken catalog",
  );
}
for (const category of ["resolutions", "cpuCores", "ram"]) {
  if (
    !Array.isArray(catalog.marginals[category]) ||
    catalog.marginals[category].length === 0
  ) {
    throw new Error(
      `apple: marginals.${category} is empty — refusing to write a broken catalog`,
    );
  }
}

const appleTmpPath = new URL(`${OUTPUT_PATH.href}.tmp`);
fs.writeFileSync(appleTmpPath, buildOutput(catalog, surveyMonth));
fs.renameSync(appleTmpPath, OUTPUT_PATH);
process.stdout.write("Generated hardware-profiles.apple.generated.ts\n");
