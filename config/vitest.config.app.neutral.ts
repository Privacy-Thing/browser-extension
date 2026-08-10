import { createNeutralTestConfig } from "./vitest.config.base";

export default createNeutralTestConfig({
  extraTestExclude: [
    "packages/platform-api-conformance/**/*.test.ts",
    "packages/platform-api-conformance/**/*.test.tsx",
  ],
  extraCoverageExclude: ["packages/platform-api-conformance/**/*.{ts,tsx}"],
});
