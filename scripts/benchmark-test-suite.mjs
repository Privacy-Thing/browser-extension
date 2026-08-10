/* global console */

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, cpus, freemem, hostname, platform, release, totalmem } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import { resolveRequiredFxBinary } from "./firefox-binary.mjs";

const root = resolve(import.meta.dirname, "..");
const outputRoot = resolve(root, "build/test-benchmarks");
const executableSuffix = process.platform === "win32" ? ".cmd" : "";
const vitest = join(root, `node_modules/.bin/vitest${executableSuffix}`);
const playwright = join(root, `node_modules/.bin/playwright${executableSuffix}`);

const parseArgs = (args) => {
  const options = { label: "after", warmups: 1, samples: 3, compare: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--label") options.label = args[++index];
    else if (argument === "--warmups") options.warmups = Number(args[++index]);
    else if (argument === "--samples") options.samples = Number(args[++index]);
    else if (argument === "--compare") options.compare = args[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.label || !Number.isInteger(options.warmups) || options.warmups < 0) {
    throw new Error("--label is required and --warmups must be a non-negative integer");
  }
  if (!Number.isInteger(options.samples) || options.samples < 1) {
    throw new Error("--samples must be a positive integer");
  }
  return options;
};

const options = parseArgs(process.argv.slice(2));
const outputDirectory = join(outputRoot, options.label);
await mkdir(outputDirectory, { recursive: true });

const hasNeutralConfig = async () => {
  try {
    await readFile(join(root, "config/vitest.config.neutral.ts"));
    return true;
  } catch {
    return false;
  }
};

const hasBuildContractConfig = async () => {
  try {
    await readFile(join(root, "config/vitest.config.build-contracts.ts"));
    return true;
  } catch {
    return false;
  }
};

const vitestCommand = (config, outputFile, paths = []) => ({
  command: vitest,
  args: [
    "run",
    "--config",
    config,
    "--maxWorkers=4",
    "--reporter=json",
    `--outputFile=${outputFile}`,
    ...paths,
  ],
});

const playwrightCommand = (outputFile, paths, extraEnv = {}) => ({
  command: playwright,
  args: ["test", "--config", "config/playwright.config.ts", "--workers=3", ...paths],
  env: {
    PT_PLAYWRIGHT_JSON_REPORT: outputFile,
    ...extraEnv,
  },
});

const createLanes = async (iterationDirectory) => {
  const neutral = await hasNeutralConfig();
  const buildContractsUseVitest = await hasBuildContractConfig();
  const unitRuns = neutral
    ? [
        vitestCommand(
          "config/vitest.config.neutral.ts",
          join(iterationDirectory, "unit-neutral.json"),
        ),
        vitestCommand(
          "config/vitest.config.chromium.ts",
          join(iterationDirectory, "unit-chromium.json"),
        ),
        vitestCommand(
          "config/vitest.config.firefox.ts",
          join(iterationDirectory, "unit-firefox.json"),
        ),
      ]
    : [
        vitestCommand(
          "config/vitest.config.chromium.ts",
          join(iterationDirectory, "unit-chromium.json"),
        ),
        vitestCommand(
          "config/vitest.config.firefox.ts",
          join(iterationDirectory, "unit-firefox.json"),
        ),
      ];

  const firefoxExecutablePath = await resolveRequiredFxBinary(
    "Firefox runtime test-suite benchmark",
  );

  return [
    { name: "unit", type: "vitest", runs: unitRuns },
    {
      name: "chromium-core",
      type: "playwright",
      runs: [
        playwrightCommand(
          join(iterationDirectory, "chromium-core.json"),
          [
            "tests/e2e/extension-runtime.spec.ts",
            "tests/e2e/extension-fingerprint.spec.ts",
          ],
          { PT_E2E_LANE: "core" },
        ),
      ],
    },
    {
      name: "product",
      type: "playwright",
      runs: [
        playwrightCommand(
          join(iterationDirectory, "product.json"),
          [
            "tests/e2e/extension-options-locations.spec.ts",
            "tests/e2e/extension-options-navigation.spec.ts",
            "tests/e2e/extension-options-rules.spec.ts",
            "tests/e2e/extension-popup.spec.ts",
            "tests/e2e/extension-state.spec.ts",
          ],
          { PT_E2E_LANE: "product" },
        ),
      ],
    },
    {
      name: "storybook",
      type: "vitest",
      runs: [
        vitestCommand(
          "vitest.storybook.config.ts",
          join(iterationDirectory, "storybook.json"),
        ),
      ],
    },
    {
      name: "build-contracts",
      type: buildContractsUseVitest ? "vitest" : "playwright",
      runs: buildContractsUseVitest
        ? [
            vitestCommand(
              "config/vitest.config.build-contracts.ts",
              join(iterationDirectory, "build-contracts.json"),
            ),
          ]
        : [
            playwrightCommand(join(iterationDirectory, "build-contracts.json"), [
              "tests/e2e/chromium-build.spec.ts",
              "tests/e2e/firefox-build.spec.ts",
            ]),
          ],
    },
    {
      name: "firefox-runtime",
      type: "playwright",
      runs: [
        {
          command: playwright,
          args: [
            "test",
            "--config",
            "config/playwright.config.ts",
            "--workers=3",
            "tests/e2e/firefox-runtime-bootstrap.spec.ts",
            "tests/e2e/firefox-runtime-bootstrap-followup.spec.ts",
            "tests/e2e/firefox-runtime-transport.spec.ts",
            "tests/e2e/firefox-runtime-core.spec.ts",
            "tests/e2e/firefox-runtime-transport-refresh.spec.ts",
            "tests/e2e/firefox-runtime-edge.spec.ts",
            "tests/e2e/firefox-runtime-transport-state.spec.ts",
          ],
          env: {
            PT_PLAYWRIGHT_JSON_REPORT: join(iterationDirectory, "firefox-runtime.json"),
            PT_E2E_LANE: "firefox-runtime",
            PT_FIREFOX_RUNTIME_WORKERS: "3",
            FIREFOX_EXECUTABLE_PATH: firefoxExecutablePath,
          },
        },
      ],
    },
  ];
};

const runCommand = ({ command, args, env = {} }) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: {
        ...process.env,
        CI: "1",
        NODE_OPTIONS: "--disable-warning=DEP0205",
        ...env,
      },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0 && !signal) resolvePromise();
      else
        reject(new Error(`${command} ${args.join(" ")} exited with ${signal ?? code}`));
    });
  });

const percentile = (values, fraction) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
};

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
};

const summarizeDurations = (values) => {
  const center = median(values);
  return {
    medianMs: Math.round(center),
    p95Ms: Math.round(percentile(values, 0.95)),
    madMs: Math.round(median(values.map((value) => Math.abs(value - center)))),
    minMs: Math.round(Math.min(...values)),
    maxMs: Math.round(Math.max(...values)),
  };
};

const flattenPlaywrightSuites = (suites, prefix = []) => {
  const files = [];
  for (const suite of suites ?? []) {
    const path = suite.file ?? prefix.at(-1) ?? suite.title;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const durationMs = (test.results ?? []).reduce(
          (sum, result) => sum + (result.duration ?? 0),
          0,
        );
        files.push({
          file: path,
          status: test.status,
          durationMs,
        });
      }
    }
    files.push(...flattenPlaywrightSuites(suite.suites, [...prefix, path]));
  }
  return files;
};

const readReporter = async (path, type) => {
  const report = JSON.parse(await readFile(path, "utf8"));
  if (type === "playwright") {
    const tests = flattenPlaywrightSuites(report.suites);
    return {
      files: new Set(tests.map((test) => test.file)).size,
      collected: tests.length,
      passed: tests.filter((test) => test.status === "expected").length,
      failed: tests.filter((test) => test.status === "unexpected").length,
      skipped: tests.filter((test) => test.status === "skipped").length,
      fileDurations: tests,
    };
  }
  const testResults = report.testResults ?? [];
  const assertionResults = testResults.flatMap((file) => file.assertionResults ?? []);
  return {
    files: testResults.length,
    collected: report.numTotalTests ?? assertionResults.length,
    passed: report.numPassedTests ?? 0,
    failed: report.numFailedTests ?? 0,
    skipped: report.numPendingTests ?? 0,
    fileDurations: testResults.map((file) => ({
      file: file.name,
      status: file.status,
      durationMs: Math.max(
        0,
        (file.endTime ?? file.startTime ?? 0) - (file.startTime ?? 0),
      ),
    })),
  };
};

const reporterPathsForRun = (run) => {
  const outputArgument = run.args.find((argument) =>
    argument.startsWith("--outputFile="),
  );
  const vitestPath = outputArgument?.slice("--outputFile=".length);
  const playwrightPath = run.env?.PT_PLAYWRIGHT_JSON_REPORT;
  return vitestPath ?? playwrightPath;
};

const measuredRuns = [];
for (let index = -options.warmups; index < options.samples; index += 1) {
  const measured = index >= 0;
  const iterationName = measured
    ? `sample-${index + 1}`
    : `warmup-${index + options.warmups + 1}`;
  const iterationDirectory = join(outputDirectory, iterationName);
  await mkdir(iterationDirectory, { recursive: true });
  const lanes = await createLanes(iterationDirectory);

  for (const lane of lanes) {
    const started = process.hrtime.bigint();
    const reports = [];
    for (const run of lane.runs) {
      await runCommand(run);
      const reporterPath = reporterPathsForRun(run);
      if (!reporterPath) throw new Error(`Missing reporter output for ${lane.name}`);
      reports.push(await readReporter(reporterPath, lane.type));
    }
    const wallMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    if (measured) {
      measuredRuns.push({
        sample: index + 1,
        lane: lane.name,
        wallMs: Math.round(wallMs),
        files: reports.reduce((sum, report) => sum + report.files, 0),
        collected: reports.reduce((sum, report) => sum + report.collected, 0),
        passed: reports.reduce((sum, report) => sum + report.passed, 0),
        failed: reports.reduce((sum, report) => sum + report.failed, 0),
        skipped: reports.reduce((sum, report) => sum + report.skipped, 0),
        slowestFiles: reports
          .flatMap((report) => report.fileDurations)
          .sort((left, right) => right.durationMs - left.durationMs)
          .slice(0, 20),
      });
    }
  }
}

const laneNames = [...new Set(measuredRuns.map((run) => run.lane))];
const lanes = laneNames.map((name) => {
  const samples = measuredRuns.filter((run) => run.lane === name);
  return {
    name,
    files: Math.round(median(samples.map((sample) => sample.files))),
    collected: Math.round(median(samples.map((sample) => sample.collected))),
    passed: Math.round(median(samples.map((sample) => sample.passed))),
    failed: Math.round(median(samples.map((sample) => sample.failed))),
    skipped: Math.round(median(samples.map((sample) => sample.skipped))),
    ...summarizeDurations(samples.map((sample) => sample.wallMs)),
  };
});
const totalMedianMs = lanes.reduce((sum, lane) => sum + lane.medianMs, 0);
for (const lane of lanes) {
  lane.timeSharePercent =
    totalMedianMs === 0
      ? 0
      : Number(((lane.medianMs / totalMedianMs) * 100).toFixed(2));
}

const git = async (args) => {
  let output = "";
  await new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, {
      cwd: root,
      stdio: ["ignore", "pipe", "inherit"],
    });
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`git ${args.join(" ")} failed`)),
    );
  });
  return output.trim();
};

const capture = async (command, args) => {
  let output = "";
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`${command} ${args.join(" ")} failed`)),
    );
  });
  return output.trim();
};

const firefoxExecutablePath = await resolveRequiredFxBinary(
  "Firefox runtime test-suite benchmark metadata",
);
const chromiumExecutablePath = await capture("node", [
  "--input-type=module",
  "-e",
  "import { chromium } from '@playwright/test'; process.stdout.write(chromium.executablePath())",
]);
const gitStatus = await git(["status", "--porcelain"]);

const summary = {
  schemaVersion: 1,
  label: options.label,
  suiteSha:
    options.label === "before"
      ? "ee5a80eac9ff0ab0da8fa556b1d6d0130c6a5db3"
      : await git(["rev-parse", "HEAD"]),
  harnessSha: await git(["hash-object", "scripts/benchmark-test-suite.mjs"]),
  dirty: gitStatus.length > 0,
  generatedAt: new Date().toISOString(),
  methodology: {
    warmups: options.warmups,
    samples: options.samples,
    ci: true,
    vitestWorkers: 4,
    vitestPool: "threads",
    playwrightWorkers: 3,
  },
  environment: {
    platform: platform(),
    architecture: arch(),
    release: release(),
    hostname: hostname(),
    node: process.version,
    cpuModel: cpus()[0]?.model ?? "unknown",
    cpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    freeMemoryBytesAtSummary: freemem(),
    pnpm: await capture("pnpm", ["--version"]),
    vitest: await capture(vitest, ["--version"]),
    playwright: await capture(playwright, ["--version"]),
    chromiumExecutable: chromiumExecutablePath,
    chromiumVersion: await capture(chromiumExecutablePath, ["--version"]),
    firefoxExecutable: firefoxExecutablePath,
    firefoxVersion: await capture(firefoxExecutablePath, ["--version"]),
  },
  lanes,
  totalMedianMs,
  samples: measuredRuns,
};

await writeFile(
  join(outputDirectory, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);

if (options.compare) {
  const baseline = JSON.parse(await readFile(resolve(root, options.compare), "utf8"));
  const rows = [
    "lane,before_files,after_files,before_collected,after_collected,before_passed,after_passed,before_skipped,after_skipped,before_ms,after_ms,delta_ms,delta_percent",
  ];
  for (const lane of lanes) {
    const before = baseline.lanes.find((candidate) => candidate.name === lane.name);
    if (!before) continue;
    const delta = lane.medianMs - before.medianMs;
    const percent = before.medianMs === 0 ? 0 : (delta / before.medianMs) * 100;
    rows.push(
      [
        lane.name,
        before.files,
        lane.files,
        before.collected,
        lane.collected,
        before.passed,
        lane.passed,
        before.skipped,
        lane.skipped,
        before.medianMs,
        lane.medianMs,
        delta,
        percent.toFixed(2),
      ].join(","),
    );
  }
  await writeFile(join(outputDirectory, "comparison.csv"), `${rows.join("\n")}\n`);
}

console.log(`Benchmark summary written to ${join(outputDirectory, "summary.json")}`);
