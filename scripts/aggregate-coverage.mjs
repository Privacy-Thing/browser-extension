/* global console */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const rootRequire = createRequire(import.meta.url);
const coverageRequire = createRequire(
  rootRequire.resolve("@vitest/coverage-v8/package.json"),
);
const libCoverage = coverageRequire("istanbul-lib-coverage");

const root = process.cwd();
const lanes = ["neutral", "chromium", "firefox"];
const reports = new Map();
const coverageMap = libCoverage.createCoverageMap({});

for (const lane of lanes) {
  const laneDirectory = path.join(root, "build", "coverage", lane);
  const summaryPath = path.join(laneDirectory, "coverage-summary.json");
  const coveragePath = path.join(laneDirectory, "coverage-final.json");
  try {
    await access(summaryPath);
    await access(coveragePath);
    reports.set(lane, JSON.parse(await readFile(summaryPath, "utf8")));
    coverageMap.merge(JSON.parse(await readFile(coveragePath, "utf8")));
  } catch {
    // Baseline revisions predate the neutral lane, so aggregation must also work with two reports.
  }
}
if (reports.size === 0) throw new Error("No unit coverage reports were found.");

const aggregate = coverageMap.getCoverageSummary().toJSON();
const files = Object.fromEntries(
  coverageMap
    .files()
    .map((file) => [
      path.relative(root, file).replaceAll(path.sep, "/"),
      coverageMap.fileCoverageFor(file).toSummary().toJSON(),
    ])
    .sort(([left], [right]) => left.localeCompare(right)),
);

const output = {
  schemaVersion: 1,
  method: "Istanbul coverage-map union across available unit-test lanes",
  lanes: Object.fromEntries([...reports].map(([lane, report]) => [lane, report.total])),
  aggregate,
  files,
};

const outputDirectory = path.join(root, "build", "coverage");
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  path.join(outputDirectory, "aggregate-summary.json"),
  `${JSON.stringify(output, null, 2)}\n`,
);
console.log(
  `Aggregated ${coverageMap.files().length} covered source files across ${reports.size} unit-test lanes.`,
);
