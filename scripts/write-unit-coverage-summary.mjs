/* global console, process */

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const resolveSummaryFiles = () => {
  const configuredReportsDir = process.env.PT_COVERAGE_REPORTS_DIR;
  if (!configuredReportsDir) {
    return [
      {
        label: "Neutral",
        path: resolve("build/coverage/neutral/coverage-summary.json"),
      },
      {
        label: "Chromium",
        path: resolve("build/coverage/chromium/coverage-summary.json"),
      },
      {
        label: "Firefox",
        path: resolve("build/coverage/firefox/coverage-summary.json"),
      },
    ];
  }

  const resolvedReportsDir = resolve(configuredReportsDir);
  const targetDirName = basename(resolvedReportsDir);

  if (["neutral", "chromium", "firefox"].includes(targetDirName)) {
    const reportsRoot = dirname(resolvedReportsDir);
    return [
      {
        label: "Neutral",
        path: join(
          targetDirName === "neutral"
            ? resolvedReportsDir
            : join(reportsRoot, "neutral"),
          "coverage-summary.json",
        ),
      },
      {
        label: "Chromium",
        path: join(
          targetDirName === "chromium"
            ? resolvedReportsDir
            : join(reportsRoot, "chromium"),
          "coverage-summary.json",
        ),
      },
      {
        label: "Firefox",
        path: join(
          targetDirName === "firefox"
            ? resolvedReportsDir
            : join(reportsRoot, "firefox"),
          "coverage-summary.json",
        ),
      },
    ];
  }

  return [
    {
      label: "Neutral",
      path: join(resolvedReportsDir, "neutral", "coverage-summary.json"),
    },
    {
      label: "Chromium",
      path: join(resolvedReportsDir, "chromium", "coverage-summary.json"),
    },
    {
      label: "Firefox",
      path: join(resolvedReportsDir, "firefox", "coverage-summary.json"),
    },
  ];
};

const isValidMetric = (metric) =>
  metric &&
  typeof metric.pct === "number" &&
  typeof metric.covered === "number" &&
  typeof metric.total === "number";

/**
 * A lane that ran no test files still gets a coverage summary, but Istanbul fills
 * it with `total: 0` and the string `"Unknown"` for every percentage. Reporting
 * that as a row of "Unavailable" reads like a broken run, when the honest answer
 * is that the change had no tests related to this lane.
 */
const hasMeasuredCode = (summary) =>
  ["lines", "statements", "functions", "branches"].some(
    (key) => isValidMetric(summary[key]) && summary[key].total > 0,
  );

const formatMetric = (metric) =>
  isValidMetric(metric)
    ? `${metric.pct.toFixed(2)}% (${metric.covered}/${metric.total})`
    : "Unavailable";

const readCoverageSummary = (resolvedPath) => {
  try {
    const parsed = JSON.parse(readFileSync(resolvedPath, "utf8"));
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.total ||
      typeof parsed.total !== "object"
    ) {
      return null;
    }
    return parsed.total;
  } catch {
    return null;
  }
};

const summaryFiles = resolveSummaryFiles();

const rows = summaryFiles.map(({ label, path }) => {
  if (!existsSync(path)) {
    return { label, available: false };
  }

  const summary = readCoverageSummary(path);
  if (!summary) {
    return { label, available: false };
  }

  if (!hasMeasuredCode(summary)) {
    return { label, available: false, measuredNothing: true };
  }

  return {
    label,
    available: true,
    lines: formatMetric(summary.lines),
    statements: formatMetric(summary.statements),
    functions: formatMetric(summary.functions),
    branches: formatMetric(summary.branches),
  };
});

console.log("## Unit coverage");
console.log("");

if (!rows.some((row) => row.available)) {
  console.log(
    rows.every((row) => row.measuredNothing)
      ? "No unit tests were related to this change, so no coverage was measured."
      : "Coverage summary unavailable.",
  );
  process.exit(0);
}

console.log("| Target | Lines | Statements | Functions | Branches |");
console.log("| --- | --- | --- | --- | --- |");

for (const row of rows) {
  if (!row.available) {
    const cell = row.measuredNothing ? "No related tests" : "Unavailable";
    console.log(`| ${row.label} | ${cell} | ${cell} | ${cell} | ${cell} |`);
    continue;
  }

  console.log(
    `| ${row.label} | ${row.lines} | ${row.statements} | ${row.functions} | ${row.branches} |`,
  );
}

console.log("");
console.log("HTML and LCOV reports are uploaded in the `unit-coverage` artifact.");
