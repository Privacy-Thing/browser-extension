import fs from "node:fs";
import process from "node:process";
import { URL } from "node:url";

// Source: Steam Hardware & Software Survey (Valve), read directly from the official
// public survey page. The page renders per-platform marginal distributions for display
// resolution, physical CPU count, and system RAM as aggregate percentages (facts).
const STEAM_SURVEY_BASE_URL =
  "https://store.steampowered.com/hwsurvey/Steam-Hardware-Software-Survey-Welcome-to-Steam/?platform=";

const OUTPUT_PATH = new URL(
  "../src/shared/hardware-profiles.steam.generated.ts",
  import.meta.url,
);
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Steam's "pc" platform filter is Windows; we expose it under the "windows" key. Linux
// is kept separate because its distribution differs sharply (more 4-core machines,
// Steam Deck contamination).
const PLATFORMS = [
  { param: "pc", surveyLabel: "Windows", catalogKey: "windows" },
  { param: "linux", surveyLabel: "Linux", catalogKey: "linux" },
];

// Reject resolutions that are clearly not desktop primary displays: Steam Deck portrait
// panels (800x1280), phones streaming, and anything narrower than a real laptop panel.
const MIN_RESOLUTION_WIDTH = 1024;
const MIN_RESOLUTION_HEIGHT = 600;
const MAX_ASPECT_RATIO = 3.8; // ultrawide 32:9 ≈ 3.55; reject taller-than-wide panels
const MIN_ASPECT_RATIO = 1.2;

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
    "hardware-profiles.steam.generated.ts is less than 24h old — skipping download.\n",
  );
  process.exit(0);
}

const stripTags = (value) =>
  value
    .replace(/<[^>]*>/g, "")
    .replace(/\u00a0/g, " ")
    .trim();

const fetchPage = async (param) => {
  const url = `${STEAM_SURVEY_BASE_URL}${param}`;
  const response = await globalThis.fetch(url, { headers: { Accept: "text/html" } });
  if (!response.ok) {
    throw new Error(
      `Could not download Steam survey page for ${param} (${response.status}).`,
    );
  }
  return response.text();
};

/**
 * Extracts the `(name, percent)` rows for a survey category from the page HTML.
 *
 * The page groups each category as a `stats_row` (label + highlighted top row) followed
 * by a `stats_row_details` block listing every entry. The top entry is repeated inside
 * the details (bold-wrapped), so rows are deduplicated by name. Percentages are display
 * values ("53.60%"), returned here as numbers.
 */
const extractCategoryRows = (html, categoryLabel) => {
  const header = new RegExp(
    `id="(cat\\d+)_stats_row"[^>]*>\\s*<a name="cat\\d+"></a>\\s*<div class="stats_col_left">${categoryLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</div>`,
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
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isInteger(width) || !Number.isInteger(height)) return undefined;
  if (width < MIN_RESOLUTION_WIDTH || height < MIN_RESOLUTION_HEIGHT) return undefined;
  const aspect = width / height;
  if (aspect < MIN_ASPECT_RATIO || aspect > MAX_ASPECT_RATIO) return undefined;
  return { width, height };
};

const parseCpuCores = (name) => {
  const match = /^(\d+)\s*cpus?$/i.exec(name.trim());
  if (!match) return undefined;
  const cores = Number(match[1]);
  if (!Number.isInteger(cores) || cores < 1 || cores > 256) return undefined;
  return cores;
};

const parseRamGb = (name) => {
  const match = /^([\d.]+)\s*GB$/i.exec(name.trim());
  if (!match) return undefined;
  const gb = Number(match[1]);
  if (!Number.isFinite(gb) || gb <= 0) return undefined;
  return gb;
};

/**
 * Collapses survey rows for one category into weighted entries, dropping rows that fail
 * `parseValue` and renormalizing the surviving weights to sum to 1.
 */
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
    throw new Error("No valid survey rows survived filtering for a category.");
  }
  return entries
    .map((entry) => ({ value: entry.value, weight: entry.weight / total }))
    .sort((a, b) => b.weight - a.weight);
};

const buildPlatform = (html, surveyLabel) => ({
  resolutions: toWeightedEntries(
    extractCategoryRows(html, `Primary Display Resolution (${surveyLabel})`),
    parseResolution,
    (v) => `${v.width}x${v.height}`,
  ),
  cpuCores: toWeightedEntries(
    extractCategoryRows(html, `Physical CPUs (${surveyLabel})`),
    parseCpuCores,
    (v) => String(v),
  ),
  ram: toWeightedEntries(
    extractCategoryRows(html, `System RAM (${surveyLabel})`),
    parseRamGb,
    (v) => String(v),
  ),
});

const extractSurveyMonth = (html) =>
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}/.exec(
    html,
  )?.[0] ?? "unknown";

const buildOutput = (
  catalog,
  surveyMonth,
) => `// Generated by scripts/build-steam-hardware.mjs. Do not edit by hand.
// Source: Steam Hardware & Software Survey (Valve), snapshot ${surveyMonth}, read from
//   ${STEAM_SURVEY_BASE_URL}<pc|linux>
// Weights are renormalized marginal probabilities (sum to 1 per category).

import type { SteamHardwareCatalog } from "./hardware-profiles";

export const steamHardwareSurveyDate = ${JSON.stringify(surveyMonth)} as const;

export const steamHardwareCatalog: SteamHardwareCatalog = ${JSON.stringify(catalog, null, 2)};
`;

const catalog = {};
let surveyMonth = "unknown";
for (const { param, surveyLabel, catalogKey } of PLATFORMS) {
  process.stdout.write(`Fetching Steam survey (${param})...\n`);
  const html = await fetchPage(param);
  if (surveyMonth === "unknown") surveyMonth = extractSurveyMonth(html);
  catalog[catalogKey] = buildPlatform(html, surveyLabel);
  const p = catalog[catalogKey];
  process.stdout.write(
    `  ${catalogKey}: ${p.resolutions.length} resolutions, ${p.cpuCores.length} core buckets, ${p.ram.length} RAM buckets\n`,
  );
}

process.stdout.write(`Survey snapshot: ${surveyMonth}\n`);

// Refuse to emit a structurally-valid-but-broken catalog (e.g. a missing or
// empty platform from a truncated survey).
for (const key of ["windows", "linux"]) {
  const profile = catalog[key];
  if (!profile) {
    throw new Error(
      `steam: missing platform "${key}" — refusing to write a broken catalog`,
    );
  }
  for (const category of ["resolutions", "cpuCores", "ram"]) {
    if (!Array.isArray(profile[category]) || profile[category].length === 0) {
      throw new Error(
        `steam: ${key}.${category} is empty — refusing to write a broken catalog`,
      );
    }
  }
}

const steamTmpPath = new URL(`${OUTPUT_PATH.href}.tmp`);
fs.writeFileSync(steamTmpPath, buildOutput(catalog, surveyMonth));
fs.renameSync(steamTmpPath, OUTPUT_PATH);
process.stdout.write("Generated hardware-profiles.steam.generated.ts\n");
