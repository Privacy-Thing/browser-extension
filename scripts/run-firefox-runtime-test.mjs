import { spawnSync } from "node:child_process";
import process from "node:process";

import { resolveRequiredFxBinary } from "./firefox-binary.mjs";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const additionalPlaywrightArgs = process.argv.slice(2);
const runtimeWorkerCount = process.env.PT_FIREFOX_RUNTIME_WORKERS?.trim();
const hasWorkerOverride = additionalPlaywrightArgs.some(
  (argument) =>
    argument === "--workers" ||
    argument.startsWith("--workers=") ||
    argument === "-j" ||
    argument.startsWith("-j"),
);
const runtimeWorkerArgs =
  runtimeWorkerCount && !hasWorkerOverride ? [`--workers=${runtimeWorkerCount}`] : [];

const firefoxExecutablePath = await resolveRequiredFxBinary(
  "Firefox runtime Playwright suite",
);

const result = spawnSync(
  pnpmCommand,
  [
    "exec",
    "playwright",
    "test",
    "--config",
    "config/playwright.config.ts",
    "tests/e2e/firefox-runtime-bootstrap.spec.ts",
    "tests/e2e/firefox-runtime-bootstrap-followup.spec.ts",
    "tests/e2e/firefox-runtime-transport.spec.ts",
    "tests/e2e/firefox-runtime-core.spec.ts",
    "tests/e2e/firefox-runtime-transport-refresh.spec.ts",
    "tests/e2e/firefox-runtime-edge.spec.ts",
    "tests/e2e/firefox-runtime-transport-state.spec.ts",
    ...runtimeWorkerArgs,
    ...additionalPlaywrightArgs,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      FIREFOX_EXECUTABLE_PATH: firefoxExecutablePath,
      PT_E2E_LANE: "firefox-runtime",
    },
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
