// Assembles config/store-listings/amo/stable-metadata.json (consumed by web-ext
// --amo-metadata in the stable publish workflow) from human-editable sources:
//   - config/store-listings/meta.json      : compatibility, categories, per-locale title
//   - config/store-listings/firefox/description.<locale>.md : long listing body (real newlines)
//   - config/manifest-locales.json (firefox)                : the per-locale summary (shared with the manifest)
//   - LICENSE.md                                            : the public license shown on the listing
//
// Run `node scripts/build-amo-metadata.mjs` to regenerate, or with `--check`
// to fail when the committed file drifts from the sources. The summary is NOT
// duplicated here: reusing the manifest's firefox short description keeps the
// AMO summary and the in-product description in sync. The license is sourced the
// same way, from LICENSE.md, so the AMO listing cannot drift from the license
// text that ships inside the package.

import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import { toAmoPlainTextLicense } from "./amo-license-text.mjs";
import { MANIFEST_LOCALES } from "./brand-config.mjs";

const repoUrl = (relativePath) => new URL(`../${relativePath}`, import.meta.url);
const retiredNamePattern = new RegExp(["geo", "warp"].join(""), "i");

const readJson = (relativePath) =>
  JSON.parse(readFileSync(repoUrl(relativePath), "utf8"));

const assertAmoMarkdown = (text, context) => {
  const unsupportedPatterns = [
    ["ATX headings", /^ {0,3}#{1,6}\s/m],
    ["thematic breaks", /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/m],
    ["images", /!\[[^\]]*\]\([^)]*\)/],
    ["tables", /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)?\|?\s*$/m],
    ["raw HTML", /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?>/],
    ["indented continuation blocks", /\n[ \t]*\n[ \t]{2,}\S/],
  ];

  for (const [label, pattern] of unsupportedPatterns) {
    if (pattern.test(text)) {
      throw new Error(
        `${context} uses unsupported AMO Markdown (${label}). ` +
          "Use bold paragraphs for section labels, keep list items to one paragraph, " +
          "and use only AMO's supported Markdown subset.",
      );
    }
  }
};

const readDescription = (locale) => {
  const description = readFileSync(
    repoUrl(`config/store-listings/firefox/description.${locale}.md`),
    "utf8",
  ).trimEnd();
  assertAmoMarkdown(description, `AMO description "${locale}"`);
  return description;
};

// AMO accepts either `license` (a slug from its predefined list) or
// `custom_license`, never both. Its predefined AGPL slug is 3.0-only, while this
// project uses AGPL-3.0-or-later with section 7 terms. Carry the complete license
// as linkified plain text so the listing cannot narrow or omit those terms.
const readCustomLicense = () => {
  const source = readFileSync(repoUrl("LICENSE.md"), "utf8").trimEnd();
  const name = /^#\s+(.+)$/m.exec(source)?.[1]?.trim();

  if (!name) {
    throw new Error("LICENSE.md needs a top-level heading to name the AMO license.");
  }

  return {
    name: { "en-US": name },
    text: { "en-US": toAmoPlainTextLicense(source) },
  };
};

const buildMetadata = () => {
  const meta = readJson("config/store-listings/meta.json");

  if (meta.version?.license) {
    throw new Error(
      "meta.json must not set version.license: AMO rejects license and " +
        "custom_license together, and the complete license comes from LICENSE.md.",
    );
  }

  const name = {};
  const summary = {};
  const description = {};
  const mappedStoreLocales = [];

  for (const [amoLocale, entry] of Object.entries(meta.locales)) {
    const storeLocale = entry.storeLocale;
    const storeEntry = MANIFEST_LOCALES.locales[storeLocale];
    if (!storeEntry) {
      throw new Error(
        `meta.json locale "${amoLocale}" maps to unknown store locale "${storeLocale}"`,
      );
    }

    mappedStoreLocales.push(storeLocale);
    name[amoLocale] = entry.title;
    summary[amoLocale] = storeEntry.firefox;
    description[amoLocale] = readDescription(amoLocale);
  }

  const configuredStoreLocales = Object.keys(MANIFEST_LOCALES.locales).sort();
  const uniqueMappedStoreLocales = [...new Set(mappedStoreLocales)].sort();
  const unsupportedStoreLocales = [
    ...new Set(meta.unsupportedManifestLocales ?? []),
  ].sort();
  const coveredStoreLocales = [
    ...new Set([...uniqueMappedStoreLocales, ...unsupportedStoreLocales]),
  ].sort();
  const overlap = uniqueMappedStoreLocales.filter((locale) =>
    unsupportedStoreLocales.includes(locale),
  );
  if (
    overlap.length > 0 ||
    configuredStoreLocales.length !== coveredStoreLocales.length ||
    configuredStoreLocales.some(
      (locale, index) => locale !== coveredStoreLocales[index],
    )
  ) {
    throw new Error(
      "AMO locale mappings and explicit upstream exclusions must cover every " +
        "configured manifest locale exactly once. " +
        `Configured: ${configuredStoreLocales.join(", ")}; ` +
        `mapped: ${uniqueMappedStoreLocales.join(", ")}; ` +
        `excluded: ${unsupportedStoreLocales.join(", ")}.`,
    );
  }

  const listingText = JSON.stringify({ name, summary, description });
  if (retiredNamePattern.test(listingText)) {
    throw new Error("AMO listing metadata contains the retired product name.");
  }

  return {
    version: { ...meta.version, custom_license: readCustomLicense() },
    categories: meta.categories,
    name,
    summary,
    description,
  };
};

const OUTPUT_PATH = "config/store-listings/amo/stable-metadata.json";

const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

const isCheck = process.argv.includes("--check");
const generated = serialize(buildMetadata());

if (isCheck) {
  const current = readFileSync(repoUrl(OUTPUT_PATH), "utf8");
  if (current !== generated) {
    process.stderr.write(
      `${OUTPUT_PATH} is out of sync with config/store-listings/. ` +
        "Run `pnpm task generate:amo-metadata` and commit the result.\n",
    );
    process.exit(1);
  }
  process.stdout.write(`${OUTPUT_PATH} is in sync.\n`);
} else {
  writeFileSync(fileURLToPath(repoUrl(OUTPUT_PATH)), generated);
  process.stdout.write(`Wrote ${OUTPUT_PATH}.\n`);
}
