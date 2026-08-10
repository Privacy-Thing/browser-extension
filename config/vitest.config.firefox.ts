import { createTargetVitestConfig } from "./vitest.config.base";

/**
 * Firefox-target unit test config. Mirrors the shared Vitest base but compiles
 * source with `__PT_BROWSER_TARGET__ === "firefox"` so target-dependent
 * shared suites and Firefox-only assertions exercise the Firefox branches.
 */
export default createTargetVitestConfig("firefox");
