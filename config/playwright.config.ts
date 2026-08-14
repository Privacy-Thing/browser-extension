import path from "node:path";

import { defineConfig } from "@playwright/test";

import { parseE2ELane, resolveE2ELaneFiles } from "./e2e-lanes";

const PW_BUILD_GLOBAL_DEFAULTS = {
  __PT_BROWSER_TARGET__: "chromium",
  __PT_FX_RUNTIME_TEST_HOST__: process.env.PT_FIREFOX_RUNTIME_TEST_HOST?.trim() ?? "",
  __PT_CONFORMANCE_LOCATION_ID__:
    process.env.PT_API_CONFORMANCE_LOCATION_ID?.trim() ?? "",
  __PT_RUNTIME_READY_EVENT_NAME__: "__pt_runtime_ready_playwright__",
  __PT_RUNTIME_APPLIED_ATTR__: "pt-runtime-applied-playwright",
  __PT_RUNTIME_CONFIG_ATTR__: "pt-runtime-config-playwright",
  __PT_RUNTIME_PAYLOAD_ATTR__: "data-pt-runtime-payload-playwright",
  __PT_RUNTIME_DISABLED_ATTR__: "data-pt-runtime-disabled-playwright",
  __PT_LOG_EVENT_TYPE__: "pt:log-event-playwright",
  __PT_SHIM_GUARD_KEY__: "__pt_shim_guard_playwright__",
  __PT_TEMPORAL_HANDOFF_KEY__: "__pt_temporal_handoff_playwright__",
  __PT_WORKER_PATCH_GUARD_KEY__: "__pt_worker_patch_playwright__",
  __PT_SW_PATCH_GUARD_KEY__: "__pt_service_worker_patch_playwright__",
  __PT_FIREFOX_STATE_PORT_ID__: "pt-firefox-state-port-playwright",
  __PT_FX_STATE_CHANGE_EVENT__: "pt-firefox-state-change-playwright",
  __PT_FX_STATIC_CANDIDATES_KEY__: "__pt_firefox_static_state_candidates_playwright__",
  __PT_SURFACE_USAGE_TYPE__: "pt:surface-usage-playwright",
  __PT_SURFACE_ERROR_TYPE__: "pt:surface-error-playwright",
  __PT_SURFACE_USAGE_REG_TYPE__: "pt:surface-usage-register-playwright",
  __PT_SW_REWRITE_TYPE__: "pt:shared-worker-rewrite-candidate-playwright",
  __PT_SW_STRICT_ISSUE_TYPE__: "pt:shared-worker-strict-issue-playwright",
  __PT_FX_HANDOFF_ATTR__: "pt-firefox-main-handoff-playwright",
  __PT_FX_HANDOFF_READY_EVENT__: "pt:firefox-main-handoff-ready-playwright",
  __PT_STRICT_WORKER_PREFIX__: "pt-strict-shared-worker-playwright",
  __PT_WORKER_ACK_TYPE__: "pt:worker-bootstrap-ack-playwright",
} as const;

Object.assign(globalThis, PW_BUILD_GLOBAL_DEFAULTS);

// Playwright resolves a reporter `outputFile` against the config directory, so a
// caller-supplied relative path would land in `config/`. Anchor it to the working
// directory instead, matching Playwright's own PLAYWRIGHT_JSON_OUTPUT_FILE semantics.
const jsonReporterOutputFile = process.env.PT_PLAYWRIGHT_JSON_REPORT
  ? path.resolve(process.cwd(), process.env.PT_PLAYWRIGHT_JSON_REPORT)
  : undefined;
const selectedLane = parseE2ELane(process.env.PT_E2E_LANE);
const selectedFiles = resolveE2ELaneFiles(selectedLane);
const isCi = Boolean(process.env.CI);

/**
 * Browser workers per lane. CI jobs run on separate ephemeral runners, so the default
 * three keeps each lane parallel without coordinating capacity across jobs. Local runs
 * stay single-worker. `PT_PLAYWRIGHT_WORKERS` can override either default.
 */
const resolveWorkers = (): number => {
  const configured = Number.parseInt(process.env.PT_PLAYWRIGHT_WORKERS ?? "", 10);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return isCi ? 3 : 1;
};

export default defineConfig({
  testDir: "../tests/e2e",
  testMatch: selectedFiles.map((file) => `**/${file}`),
  outputDir: "../build/test-results",
  ...(jsonReporterOutputFile
    ? {
        reporter: [["line"], ["json", { outputFile: jsonReporterOutputFile }]],
      }
    : {}),
  retries: 0,
  workers: resolveWorkers(),
  // Keep waits tied to observable state while allowing for slower CI scheduling.
  timeout: isCi ? 60_000 : 30_000,
  use: {
    headless: true,
    actionTimeout: isCi ? 30_000 : 10_000,
    trace: "retain-on-failure",
  },
});
