import { cpus } from "node:os";
import { basename, join } from "node:path";

import { defineConfig } from "vitest/config";
import type { CoverageOptions } from "vitest/node";

import { repositoryRootDirectory, uiAliasEntries } from "./path-aliases";

/**
 * Ceiling on worker threads per Vitest invocation.
 *
 * The default pool takes `os.cpus() - 1`. Cap that at four so local and CI runs
 * keep capacity for the process itself, while still adapting to smaller runners.
 * Override with `PT_VITEST_WORKERS` for an explicitly sized invocation.
 */
const resolveMaxWorkers = (): number => {
  const configured = Number.parseInt(process.env.PT_VITEST_WORKERS ?? "", 10);
  const requested = Number.isFinite(configured) && configured > 0 ? configured : 4;
  return Math.max(1, Math.min(requested, cpus().length - 1));
};

const sharedMaxWorkers = resolveMaxWorkers();

type CoverageLane = "neutral" | "chromium" | "firefox";
type BrowserTarget = Exclude<CoverageLane, "neutral">;
type VitestLaneConfigOptions = {
  extraTestExclude?: string[];
  extraCoverageExclude?: string[];
};

const resolveCoverageDir = (browserTarget: CoverageLane): string => {
  const configuredReportsDir = process.env.PT_COVERAGE_REPORTS_DIR;
  if (!configuredReportsDir) {
    return `build/coverage/${browserTarget}`;
  }

  return basename(configuredReportsDir) === browserTarget
    ? configuredReportsDir
    : join(configuredReportsDir, browserTarget);
};

export const sharedDefine = {
  __PT_BUILD_CHANNEL__: JSON.stringify("release"),
  __PT_FIREFOX_STATE_PORT_ID__: JSON.stringify("tportid"),
  __PT_FX_STATE_CHANGE_EVENT__: JSON.stringify("tStateChg"),
  __PT_RUNTIME_READY_EVENT_NAME__: JSON.stringify("tReady"),
  __PT_RUNTIME_APPLIED_ATTR__: JSON.stringify("truntimeapplied"),
  __PT_RUNTIME_CONFIG_ATTR__: JSON.stringify("truntimeconfig"),
  __PT_RUNTIME_PAYLOAD_ATTR__: JSON.stringify("data-truntimepayload"),
  __PT_RUNTIME_DISABLED_ATTR__: JSON.stringify("data-truntimedisabled"),
  __PT_LOG_EVENT_TYPE__: JSON.stringify("tLogEvt"),
  __PT_SHIM_GUARD_KEY__: JSON.stringify("tGuard"),
  __PT_TEMPORAL_HANDOFF_KEY__: JSON.stringify("tTemporalHandoff"),
  __PT_WORKER_PATCH_GUARD_KEY__: JSON.stringify("tWorkerPatch"),
  __PT_SW_PATCH_GUARD_KEY__: JSON.stringify("tServiceWorkerPatch"),
  __PT_FX_STATIC_CANDIDATES_KEY__: JSON.stringify("tFirefoxStaticState"),
  __PT_SURFACE_USAGE_TYPE__: JSON.stringify("tSurfaceUsage"),
  __PT_SURFACE_ERROR_TYPE__: JSON.stringify("tSurfaceError"),
  __PT_SURFACE_USAGE_REG_TYPE__: JSON.stringify("tSurfaceUsageRegister"),
  __PT_SW_REWRITE_TYPE__: JSON.stringify("tRewriteCandidate"),
  __PT_SW_STRICT_ISSUE_TYPE__: JSON.stringify("tSharedWorkerStrictIssue"),
  __PT_FX_HANDOFF_ATTR__: JSON.stringify("tFirefoxMainHandoff"),
  __PT_FX_HANDOFF_READY_EVENT__: JSON.stringify("tFirefoxMainHandoffReady"),
  __PT_STRICT_WORKER_PREFIX__: JSON.stringify("tStrictSharedWorker"),
  __PT_WORKER_ACK_TYPE__: JSON.stringify("tWorkerBootstrapAck"),
};

export const repositoryTestIncludes = [
  "src/**/*.test.ts",
  "src/**/*.test.tsx",
  "packages/**/*.test.ts",
  "packages/**/*.test.tsx",
  "tools/**/*.test.ts",
  "scripts/**/*.test.ts",
  "tests/e2e/harness/**/*.test.ts",
];

export const sharedTestExcludes = ["**/node_modules/**"];

export const createCoverageConfig = (
  lane: CoverageLane,
  extraCoverageExclude: string[] = [],
): CoverageOptions => ({
  provider: "v8" as const,
  clean: true,
  reportOnFailure: true,
  reportsDirectory: resolveCoverageDir(lane),
  reporter: ["text-summary", "json-summary", "json", "html", "lcov"],
  include: ["src/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "tools/**/*.ts"],
  exclude: [
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/**/*.stories.tsx",
    "src/**/stories/**",
    "src/test-utils/**",
    "packages/**/*.test.ts",
    "packages/**/*.test.tsx",
    "packages/**/*.stories.tsx",
    "packages/**/stories/**",
    "tools/**/*.test.ts",
    "**/*.d.ts",
    ...extraCoverageExclude,
  ],
});

export const createNeutralTestConfig = (options: VitestLaneConfigOptions = {}) => {
  const { extraTestExclude = [], extraCoverageExclude = [] } = options;
  return defineConfig({
    root: repositoryRootDirectory,
    resolve: { alias: uiAliasEntries },
    define: sharedDefine,
    esbuild: { jsx: "automatic", jsxImportSource: "react" },
    test: {
      environment: "node",
      pool: "threads",
      maxWorkers: sharedMaxWorkers,
      include: repositoryTestIncludes,
      exclude: [
        ...sharedTestExcludes,
        "**/*.target.test.ts",
        "**/*.target.test.tsx",
        "**/*.chromium.test.ts",
        "**/*.chromium.test.tsx",
        "**/*.firefox.test.ts",
        "**/*.firefox.test.tsx",
        ...extraTestExclude,
      ],
      coverage: createCoverageConfig("neutral", extraCoverageExclude),
    },
  });
};

export const createTargetVitestConfig = (
  browserTarget: BrowserTarget,
  options: VitestLaneConfigOptions = {},
) => {
  const { extraTestExclude = [], extraCoverageExclude = [] } = options;
  const roots = ["src", "packages", "tools", "scripts"];
  const include = roots.flatMap((sourceRoot) => [
    `${sourceRoot}/**/*.target.test.ts`,
    `${sourceRoot}/**/*.target.test.tsx`,
    `${sourceRoot}/**/*.${browserTarget}.test.ts`,
    `${sourceRoot}/**/*.${browserTarget}.test.tsx`,
  ]);

  return defineConfig({
    root: repositoryRootDirectory,
    resolve: {
      alias: uiAliasEntries,
    },
    define: {
      __PT_BROWSER_TARGET__: JSON.stringify(browserTarget),
      ...sharedDefine,
    },
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "react",
    },
    test: {
      environment: "node",
      pool: "threads",
      maxWorkers: sharedMaxWorkers,
      include,
      exclude: [...sharedTestExcludes, ...extraTestExclude],
      coverage: createCoverageConfig(browserTarget, extraCoverageExclude),
    },
  });
};
