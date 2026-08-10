export const BUILD_BROWSER_TARGET =
  typeof __PT_BROWSER_TARGET__ !== "undefined" ? __PT_BROWSER_TARGET__ : "chromium";
export type BuildChannel = "release" | "beta" | "local";
export const BUILD_CHANNEL: BuildChannel =
  typeof __PT_BUILD_CHANNEL__ !== "undefined" ? __PT_BUILD_CHANNEL__ : "local";
export const FX_RUNTIME_TEST_HOST =
  typeof __PT_FX_RUNTIME_TEST_HOST__ !== "undefined" &&
  typeof __PT_FX_RUNTIME_TEST_HOST__ === "string"
    ? __PT_FX_RUNTIME_TEST_HOST__.trim()
    : "";
export const CONFORMANCE_LOCATION_ID =
  typeof __PT_CONFORMANCE_LOCATION_ID__ !== "undefined" &&
  typeof __PT_CONFORMANCE_LOCATION_ID__ === "string"
    ? __PT_CONFORMANCE_LOCATION_ID__.trim()
    : "";
