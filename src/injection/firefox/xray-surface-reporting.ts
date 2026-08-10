import type { FirefoxShimState } from "@privacy-brand/refract-browser/common/firefox-shim-state";

export const shouldReportFxGeo = (state: FirefoxShimState | null): boolean =>
  state?.geoStatus === "ready";

export const shouldReportFxTimeLocale = (state: FirefoxShimState | null): boolean =>
  state?.timeLocaleStatus === "ready";

export const shouldReportFxFp = (state: FirefoxShimState | null): boolean =>
  state?.fingerprintStatus === "ready";
