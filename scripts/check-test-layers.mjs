/* global console */

/**
 * Ratchets the test-layer policy from AGENTS.md: E2E asserts the model, not the
 * sentence, and anything that passes without the extension installed does not
 * belong in layer 4.
 *
 * Two rules, both scoped to `tests/e2e/**` on purpose. Storybook stories measure
 * geometry by design — that is the layer these assertions are supposed to live
 * in — so widening the scope would forbid the destination.
 *
 *   visual-measurement  CSS and geometry reads. A popup button's diameter does
 *                       not depend on the extension, so asserting it here pays
 *                       an extension build and a browser launch for nothing, and
 *                       makes a pure CSS tweak break the slowest lane.
 *   translated-copy     Literals that appear in the language pack. Copy is owned
 *                       by src/ui/i18n and Storybook; E2E should read the
 *                       `data-*` state hooks instead. Assertions on user data —
 *                       location names, hostnames, rule patterns — stay correct
 *                       and are listed in `userDataLiterals`.
 *
 * The language-pack test is a substring match, which over-reports: "Warsaw" and
 * "*.example.com" are user data that happen to occur in the pack. That bias is
 * deliberate. A guard that errs toward flagging forces every exception through
 * `userDataLiterals`, where it is named and reviewed, instead of silently
 * passing something it failed to classify.
 *
 * Usage:
 *   node scripts/check-test-layers.mjs            # verify
 *   node scripts/check-test-layers.mjs --write    # lower baselines to current
 *   node scripts/check-test-layers.mjs --verbose  # list every occurrence
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const write = process.argv.includes("--write");
const verbose = process.argv.includes("--verbose");

const budgetPath = path.join(root, "config", "test-layer-budget.json");
const e2eDirectory = path.join(root, "tests", "e2e");
const languagePackDirectory = path.join(root, "src", "ui", "i18n", "en-sections");

const budgetFile = JSON.parse(await readFile(budgetPath, "utf8"));
const baselines = budgetFile.budgets ?? {};
const userDataLiterals = new Set(budgetFile.userDataLiterals ?? []);
const exemptSpecs = new Set(budgetFile.exemptSpecs ?? []);

const VISUAL_PATTERN =
  /getComputedStyle|getBoundingClientRect|toHaveCSS|setViewportSize/g;
/** Simple literals only: an interpolated template is not a copy assertion. */
const COPY_PATTERN = /\.(?:toContainText|toHaveText)\(\s*(["'`])([^"'`\n]+)\1/g;

/**
 * Only the string *values* count as copy. Matching the raw module source would
 * also match identifiers — `counts.pending` made every probe-page `"pending"`
 * marker look like a translated label.
 */
const readLanguagePack = async () => {
  const files = await readdir(languagePackDirectory);
  const sources = await Promise.all(
    files
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFile(path.join(languagePackDirectory, file), "utf8")),
  );
  const literals = [];
  for (const source of sources) {
    for (const match of source.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)) {
      // Drop interpolations: `${counts.pending} confirming` is copy around an
      // expression, and the expression's identifiers are not user-visible text.
      literals.push(
        (match[1] ?? match[2] ?? match[3] ?? "").replaceAll(/\$\{[^}]*\}/g, "\n"),
      );
    }
  }
  return literals.join("\n");
};

const languagePack = await readLanguagePack();

const lineOf = (source, index) => source.slice(0, index).split("\n").length;

const findings = { "visual-measurement": [], "translated-copy": [] };

for (const entry of (await readdir(e2eDirectory, { withFileTypes: true })).sort(
  (a, b) => a.name.localeCompare(b.name),
)) {
  if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;

  const relativePath = path.join("tests", "e2e", entry.name);
  const source = await readFile(path.join(e2eDirectory, entry.name), "utf8");

  for (const match of source.matchAll(VISUAL_PATTERN)) {
    findings["visual-measurement"].push({
      file: relativePath,
      line: lineOf(source, match.index),
      detail: match[0],
    });
  }

  if (exemptSpecs.has(entry.name)) continue;

  for (const match of source.matchAll(COPY_PATTERN)) {
    const literal = match[2].trim();
    if (userDataLiterals.has(literal)) continue;
    if (!languagePack.includes(literal)) continue;
    findings["translated-copy"].push({
      file: relativePath,
      line: lineOf(source, match.index),
      detail: literal,
    });
  }
}

const rules = Object.keys(findings);
const regressions = [];
const improvements = [];
const counts = {};

for (const rule of rules) {
  const perFile = {};
  for (const finding of findings[rule]) {
    perFile[finding.file] = (perFile[finding.file] ?? 0) + 1;
  }
  counts[rule] = perFile;

  const baseline = baselines[rule] ?? {};
  const files = [
    ...new Set([...Object.keys(perFile), ...Object.keys(baseline)]),
  ].sort();

  for (const file of files) {
    const current = perFile[file] ?? 0;
    const allowed = baseline[file] ?? 0;
    if (current > allowed) regressions.push({ rule, file, current, allowed });
    else if (current < allowed) improvements.push({ rule, file, current, allowed });
  }

  const total = Object.values(perFile).reduce((sum, value) => sum + value, 0);
  const budgeted = Object.values(baseline).reduce((sum, value) => sum + value, 0);
  console.log(`${rule.padEnd(20)} ${String(total).padStart(3)} / ${budgeted}`);

  if (verbose) {
    for (const finding of findings[rule]) {
      console.log(`    ${finding.file}:${finding.line}  ${finding.detail}`);
    }
  }
}

if (write) {
  if (regressions.length > 0) {
    console.error("\nRefusing to --write: that would raise a baseline.");
    for (const { rule, file, current, allowed } of regressions) {
      console.error(`  ${rule} ${file}: ${current} > ${allowed}`);
    }
    process.exit(1);
  }
  if (improvements.length === 0) {
    console.log("\nBaselines already match current counts; nothing to write.");
    process.exit(0);
  }
  budgetFile.budgets = Object.fromEntries(
    rules.map((rule) => [
      rule,
      Object.fromEntries(
        Object.entries(counts[rule]).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ]),
  );
  await writeFile(budgetPath, `${JSON.stringify(budgetFile, null, 2)}\n`, "utf8");
  console.log(
    `\nLowered ${improvements.length} baseline(s) in ${path.relative(root, budgetPath)}.`,
  );
  process.exit(0);
}

if (regressions.length > 0) {
  console.error("\nTest-layer budget exceeded:");
  for (const { rule, file, current, allowed } of regressions) {
    console.error(`  ${rule} ${file}: ${current} occurrence(s), budget is ${allowed}`);
    for (const finding of findings[rule]
      .filter((item) => item.file === file)
      .slice(0, 10)) {
      console.error(`      ${finding.file}:${finding.line}  ${finding.detail}`);
    }
  }
  console.error(
    "\nMove CSS and geometry assertions into the popup stories under" +
      " src/ui/popup/stories, and assert `data-*` state hooks instead of translated copy." +
      "\nIf the occurrence is legitimate — locating an element rather than asserting its" +
      " design, or a literal that is user data — record it in config/test-layer-budget.json.",
  );
  process.exit(1);
}

const total = rules.reduce(
  (sum, rule) => sum + Object.values(counts[rule]).reduce((a, b) => a + b, 0),
  0,
);
console.log(
  `\nValidated test-layer policy across tests/e2e (${total} budgeted occurrence(s)).`,
);
