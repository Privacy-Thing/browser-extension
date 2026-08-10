import runtimeBrandConfig from "../../config/runtime-brand-config.json" with { type: "json" };

const {
  diagnosticsName,
  displayName,
  engineName,
  fileStem,
  settingsExportStem,
  shortDescription,
} = runtimeBrandConfig;

/** Public brand metadata safe to bundle into extension runtime code. */
export const BRAND_CONFIG = {
  diagnosticsName,
  displayName,
  engineName,
  fileStem,
  settingsExportStem,
  shortDescription,
} as const;

/** Base end-user product name for the current brand. */
export const BRAND_DISPLAY_NAME = BRAND_CONFIG.displayName;

/** Public name of the spoofing engine. */
export const BRAND_ENGINE_NAME = BRAND_CONFIG.engineName;

/** Public name of the diagnostics surface. */
export const BRAND_DIAGNOSTICS_NAME = BRAND_CONFIG.diagnosticsName;

/** Base filesystem and slug-style identifier for the current brand. */
export const BRAND_FILE_STEM = BRAND_CONFIG.fileStem;

/** Default filename stem for exported settings bundles. */
export const SETTINGS_EXPORT_STEM = BRAND_CONFIG.settingsExportStem;

/** Short manifest/store description for the current brand. */
export const BRAND_SHORT_DESCRIPTION = BRAND_CONFIG.shortDescription;
