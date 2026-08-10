import { BRAND_DISPLAY_NAME } from "@privacy-brand/tooling-shared/brand";

import config from "../api-conformance.config.js";

import { CacheManager } from "./cache/cache-manager.js";
import { CompatChecker } from "./checker/compat-checker.js";
import { CompletenessChecker } from "./checker/completeness-checker.js";
import { CrossPathChecker } from "./checker/cross-path-checker.js";
import { DescriptorChecker } from "./checker/descriptor-checker.js";
import { injectionSourceDirectory, repositoryRootDirectory } from "./repo-paths.js";
import { ConsoleReporter } from "./reporter/console-reporter.js";
import { GithubSummaryReporter } from "./reporter/github-summary-reporter.js";
import { HtmlReporter } from "./reporter/html-reporter.js";
import { JsonReporter } from "./reporter/json-reporter.js";
import { diffSnapshots, diffValueProbes } from "./runtime/differ.js";
import { captureSnapshots } from "./runtime/snapshot.js";
import { SourceLocator } from "./scanner/source-locator.js";
import { parseTargets } from "./target/target-parser.js";
import type { DetectedPatch, Finding, Suppression } from "./types.js";

const CONFORMANCE_RUN_LABEL = `${BRAND_DISPLAY_NAME} API Conformance (v2: Runtime-First)`;

type CliOptions = {
  outputGithubSummary: boolean;
  outputHtml: boolean;
  outputJson: boolean;
  preset: string | undefined;
  scanOnly: boolean;
  targetArgs: string[];
};

const parseCliOptions = (args: string[]): CliOptions => {
  const targetArgs: string[] = [];
  let preset: string | undefined;
  let scanOnly = false;
  let outputJson = false;
  let outputHtml = false;
  let outputGithubSummary = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--target" && args[i + 1]) {
      targetArgs.push(args[i + 1]!);
      i++;
    } else if (args[i] === "--preset" && args[i + 1]) {
      preset = args[i + 1];
      i++;
    } else if (args[i] === "--scan-only") {
      scanOnly = true;
    } else if (args[i] === "--json") {
      outputJson = true;
    } else if (args[i] === "--html") {
      outputHtml = true;
    } else if (args[i] === "--github-summary") {
      outputGithubSummary = true;
    } else if (args[i] === "--clear-cache") {
      CacheManager.clear();
      console.log("Cache cleared.");
    }
  }

  return {
    outputGithubSummary,
    outputHtml,
    outputJson,
    preset,
    scanOnly,
    targetArgs,
  };
};

const capturePatches = async (): Promise<{
  allPatches: DetectedPatch[];
  firefoxSnapshotAvailable: boolean;
}> => {
  console.log(
    `\nCapturing runtime snapshots (${config.apiSurfaces.length} API surfaces)...`,
  );
  const snapshots = await captureSnapshots(config);
  const allPatches: DetectedPatch[] = [];
  for (const [browser, snapshot] of [
    ["chromium", snapshots.chromium],
    ["firefox", snapshots.firefox],
  ] as const) {
    if (!snapshot) continue;
    const descriptorPatches = diffSnapshots(
      snapshot.vanilla,
      snapshot.spoofed,
      browser,
    );
    const probePatches = diffValueProbes(
      snapshot.vanillaProbes,
      snapshot.spoofedProbes,
      browser,
      config.valueProbes ?? [],
    );
    allPatches.push(...descriptorPatches, ...probePatches);
    const label = browser === "chromium" ? "Chromium" : "Firefox ";
    console.log(
      `  ${label}: ${descriptorPatches.length} descriptor + ${probePatches.length} value-probe changes detected.`,
    );
  }
  console.log(`\nTotal: ${allPatches.length} API property changes detected.`);
  return { allPatches, firefoxSnapshotAvailable: Boolean(snapshots.firefox) };
};

const printScan = (patches: DetectedPatch[]): void => {
  const grouped = new Map<string, string[]>();
  for (const patch of patches) {
    const browsers = grouped.get(patch.api) ?? [];
    if (!browsers.includes(patch.browser)) browsers.push(patch.browser);
    grouped.set(patch.api, browsers);
  }
  for (const [api, browsers] of [...grouped.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    console.log(`  - ${api} [${browsers.join(", ")}]`);
  }
};

const createFindings = (
  allPatches: DetectedPatch[],
  targets: ReturnType<typeof parseTargets>,
  firefoxSnapshotAvailable: boolean,
): Finding[] => {
  const findings = CompletenessChecker.check(allPatches, repositoryRootDirectory);
  const uniqueApis = new Map(allPatches.map((patch) => [patch.api, patch]));
  for (const patch of uniqueApis.values()) {
    findings.push(...CompatChecker.check(patch, targets));
  }
  findings.push(...CrossPathChecker.check(allPatches, { firefoxSnapshotAvailable }));
  findings.push(...DescriptorChecker.check(allPatches, targets));
  return findings;
};

async function main() {
  console.log(`=== ${CONFORMANCE_RUN_LABEL} ===`);
  CacheManager.init(config.cacheDir);
  const options = parseCliOptions(process.argv.slice(2));

  const targets = parseTargets(
    options.targetArgs,
    options.preset ?? config.defaultTargetPreset,
    config.targetPresets,
  );
  const { allPatches, firefoxSnapshotAvailable } = await capturePatches();
  if (options.scanOnly) {
    printScan(allPatches);
    return;
  }
  const findings = createFindings(allPatches, targets, firefoxSnapshotAvailable);

  // ---- Apply suppressions ----

  const suppressions = config.suppressions ?? [];
  const { filtered: filteredFindings, suppressedCount } = applySupppressions(
    findings,
    suppressions,
  );

  if (suppressedCount > 0) {
    console.log(`\n${suppressedCount} finding(s) suppressed by config.suppressions.`);
  }

  const scannedApis = Array.from(new Set(allPatches.map((p) => p.api))).sort();

  // ---- Source Location Correlation ----
  // Best-effort: scan src/injection/ for property-definition patterns and
  // attach the likely declaration site to each finding.

  const locator = new SourceLocator();
  locator.buildIndex(injectionSourceDirectory, repositoryRootDirectory);

  for (const finding of filteredFindings) {
    if (!finding.location) {
      const loc = locator.formatLocations(finding.api);
      if (loc) {
        finding.location = loc;
      }
    }
  }

  // ---- Reporters ----

  ConsoleReporter.report(filteredFindings, targets, scannedApis);

  const reportInput = {
    config,
    findings: filteredFindings,
    scannedApis,
    targets,
  };

  if (options.outputJson) {
    JsonReporter.report(reportInput);
  }

  if (options.outputHtml) {
    HtmlReporter.report(reportInput);
  }

  if (options.outputGithubSummary) {
    GithubSummaryReporter.report(reportInput);
  }
}

function matchesSuppression(finding: Finding, suppression: Suppression): boolean {
  const apiMatches =
    typeof suppression.api === "string"
      ? finding.api === suppression.api
      : suppression.api.test(finding.api);
  if (!apiMatches) {
    return false;
  }
  if (!suppression.targets) {
    return true;
  }
  return Boolean(
    finding.affectedTargets?.some((affectedTarget) =>
      suppression.targets?.some(
        (target) =>
          affectedTarget === target || affectedTarget.startsWith(`${target} `),
      ),
    ),
  );
}

function applySupppressions(
  findings: Finding[],
  suppressions: Suppression[],
): { filtered: Finding[]; suppressedCount: number } {
  if (suppressions.length === 0) return { filtered: findings, suppressedCount: 0 };

  let suppressedCount = 0;
  const filtered = findings.filter((f) => {
    const suppressed = suppressions.some((s) => matchesSuppression(f, s));
    if (suppressed) suppressedCount++;
    return !suppressed;
  });

  return { filtered, suppressedCount };
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
