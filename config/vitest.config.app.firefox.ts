import { createTargetVitestConfig } from "./vitest.config.base";

const appOnlyExcludes = ["packages/platform-api-conformance/**/*.test.ts"];
const appOnlyCoverageExcludes = ["packages/platform-api-conformance/**/*.{ts,tsx}"];

export default createTargetVitestConfig("firefox", {
  extraTestExclude: appOnlyExcludes,
  extraCoverageExclude: appOnlyCoverageExcludes,
});
