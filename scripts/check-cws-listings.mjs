import { readdirSync, readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import { MANIFEST_LOCALES } from "./brand-config.mjs";

const repoUrl = (relativePath) => new URL(`../${relativePath}`, import.meta.url);
const retiredNamePattern = new RegExp(["geo", "warp"].join(""), "i");
const readJson = (relativePath) =>
  JSON.parse(readFileSync(repoUrl(relativePath), "utf8"));

const CWS_LOCALE_FILE_NAMES = {
  en: "en-US",
  es: "es-ES",
  pt_BR: "pt-BR",
  zh_CN: "zh-CN",
};
const CWS_SECTION_SEPARATOR = "=".repeat(50);
const countSectionSeparators = (description) =>
  description.split(/\r?\n/u).filter((line) => line === CWS_SECTION_SEPARATOR).length;

const titles = readJson("config/store-listings/chrome/titles.json").locales;
const expectedLocales = Object.keys(MANIFEST_LOCALES.locales).sort();
const titleLocales = Object.keys(titles).sort();

if (
  expectedLocales.length !== titleLocales.length ||
  expectedLocales.some((locale, index) => locale !== titleLocales[index])
) {
  throw new Error(
    `CWS title locales must match manifest locales. Expected: ${expectedLocales.join(", ")}; ` +
      `received: ${titleLocales.join(", ")}.`,
  );
}

const expectedDescriptionFiles = expectedLocales
  .map((locale) => {
    const fileLocale = CWS_LOCALE_FILE_NAMES[locale] ?? locale;
    return `description.${fileLocale}.md`;
  })
  .sort();
const chromeDirectory = fileURLToPath(repoUrl("config/store-listings/chrome"));
const descriptionFiles = readdirSync(chromeDirectory)
  .filter((fileName) => fileName.startsWith("description.") && fileName.endsWith(".md"))
  .sort();

if (
  expectedDescriptionFiles.length !== descriptionFiles.length ||
  expectedDescriptionFiles.some(
    (fileName, index) => fileName !== descriptionFiles[index],
  )
) {
  throw new Error(
    `CWS description files must match manifest locales. Expected: ${expectedDescriptionFiles.join(", ")}; ` +
      `received: ${descriptionFiles.join(", ")}.`,
  );
}

const polishDescription = readFileSync(
  repoUrl("config/store-listings/chrome/description.pl.md"),
  "utf8",
);
const expectedSeparators = countSectionSeparators(polishDescription);

if (expectedSeparators === 0) {
  throw new Error("The reference Polish CWS listing has no section separators.");
}

for (const locale of expectedLocales) {
  const title = titles[locale];
  const titleLength = [...title].length;
  if (titleLength > 75) {
    throw new Error(`CWS title "${locale}" has ${titleLength}/75 characters.`);
  }

  const fileLocale = CWS_LOCALE_FILE_NAMES[locale] ?? locale;
  const description = readFileSync(
    repoUrl(`config/store-listings/chrome/description.${fileLocale}.md`),
    "utf8",
  ).trim();
  if (!description) {
    throw new Error(`CWS description "${locale}" is empty.`);
  }

  const sectionSeparatorCount = countSectionSeparators(description);
  if (sectionSeparatorCount !== expectedSeparators) {
    throw new Error(
      `CWS description "${locale}" has ${sectionSeparatorCount} section separators; ` +
        `the reference Polish listing has ${expectedSeparators}.`,
    );
  }

  if (retiredNamePattern.test(`${title}\n${description}`)) {
    throw new Error(`CWS listing "${locale}" contains the retired product name.`);
  }
}

process.stdout.write(
  `CWS titles and descriptions cover ${expectedLocales.length} locales, match the Polish section structure, and satisfy store limits.\n`,
);
