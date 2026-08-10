import type { FirefoxShimState } from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { describe, expect, it } from "vitest";

import {
  shouldReportFxGeo,
  shouldReportFxTimeLocale,
} from "@/injection/firefox/xray-surface-reporting";

const makeShimState = (overrides: Partial<FirefoxShimState>): FirefoxShimState => ({
  bootstrap: { revision: 1 },
  geoStatus: "absent",
  geo: null,
  timeLocaleStatus: "absent",
  timeLocale: null,
  fingerprintStatus: "absent",
  fingerprint: null,
  debug: null,
  blockServiceWorkerRegistration: false,
  ...overrides,
});

describe("Firefox XRay surface reporting", () => {
  it("does not report geolocation access when Firefox shim geo state is absent", () => {
    expect(shouldReportFxGeo(makeShimState({ geoStatus: "absent" }))).toBe(false);
    expect(shouldReportFxGeo(null)).toBe(false);
  });

  it("reports geolocation access only when Firefox shim geo state is ready", () => {
    expect(shouldReportFxGeo(makeShimState({ geoStatus: "ready" }))).toBe(true);
  });

  it("does not report time and locale access when Firefox shim time-locale state is absent", () => {
    expect(
      shouldReportFxTimeLocale(makeShimState({ timeLocaleStatus: "absent" })),
    ).toBe(false);
    expect(shouldReportFxTimeLocale(null)).toBe(false);
  });

  it("reports time and locale access only when Firefox shim time-locale state is ready", () => {
    expect(shouldReportFxTimeLocale(makeShimState({ timeLocaleStatus: "ready" }))).toBe(
      true,
    );
  });
});
