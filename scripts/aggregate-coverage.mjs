/* global console */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootRequire = createRequire(import.meta.url);
const coverageRequire = createRequire(
  rootRequire.resolve("@vitest/coverage-v8/package.json"),
);
const libCoverage = coverageRequire("istanbul-lib-coverage");

const lanes = ["neutral", "chromium", "firefox"];

export const buildCoverageAggregate = async (root) => {
  const reports = new Map();
  const coverageMap = libCoverage.createCoverageMap({});

  for (const lane of lanes) {
    const laneDirectory = path.join(root, "build", "coverage", lane);
    const summaryPath = path.join(laneDirectory, "coverage-summary.json");
    const coveragePath = path.join(laneDirectory, "coverage-final.json");
    try {
      const [summary, coverage] = await Promise.all([
        readFile(summaryPath, "utf8"),
        readFile(coveragePath, "utf8"),
      ]);
      const parsedSummary = JSON.parse(summary);
      const parsedCoverage = JSON.parse(coverage);
      coverageMap.merge(parsedCoverage);
      reports.set(lane, parsedSummary);
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

  return {
    schemaVersion: 1,
    method: "Istanbul coverage-map union across available unit-test lanes",
    lanes: Object.fromEntries(
      [...reports].map(([lane, report]) => [lane, report.total]),
    ),
    aggregate,
    files,
  };
};

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  const root = process.cwd();
  const output = await buildCoverageAggregate(root);
  const outputDirectory = path.join(root, "build", "coverage");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "aggregate-summary.json"),
    `${JSON.stringify(output, null, 2)}\n`,
  );
  console.log(
    `Aggregated ${Object.keys(output.files).length} covered source files across ${Object.keys(output.lanes).length} unit-test lanes.`,
  );
}
