import process from "node:process";

import rawBrandConfig from "../config/brand-config.json" with { type: "json" };
import rawManifestLocales from "../config/manifest-locales.json" with { type: "json" };
import rawCwsTitles from "../config/store-listings/chrome/titles.json" with { type: "json" };
import rawStoreLocales from "../config/store-listings/store-locales.json" with { type: "json" };

/** @typedef {typeof rawBrandConfig} BrandConfig */
/** @typedef {keyof BrandConfig["channels"]} BrandChannelKey */

/** Central brand metadata shared by runtime code, build scripts, and packaging. */
export const BRAND_CONFIG = Object.freeze(rawBrandConfig);

/** Base end-user product name for the current brand. */
export const BRAND_DISPLAY_NAME = BRAND_CONFIG.displayName;

/** Public name of the spoofing engine. */
export const BRAND_ENGINE_NAME = BRAND_CONFIG.engineName;

/** Public name of the diagnostics surface. */
export const BRAND_DIAGNOSTICS_NAME = BRAND_CONFIG.diagnosticsName;

/** Base filesystem and slug-style identifier for the current brand. */
export const BRAND_FILE_STEM = BRAND_CONFIG.fileStem;

/** Artifact filename stem used by packaged browser builds. */
export const BRAND_ARTIFACT_STEM = BRAND_CONFIG.artifactStem;

/** Default filename stem for exported settings bundles. */
export const SETTINGS_EXPORT_STEM = BRAND_CONFIG.settingsExportStem;

/** Short manifest/store description for the current brand. */
export const BRAND_SHORT_DESCRIPTION = BRAND_CONFIG.shortDescription;

/**
 * Per-locale short descriptions injected into `manifest.description` through
 * generated `_locales/<locale>/messages.json`. Long store-listing copy is not
 * here: AMO listing copy lives in `config/store-listings/amo/stable-metadata.json`, Chrome Web
 * Store listing copy in the CWS dashboard. Only the manifest short description
 * is localized via `_locales`.
 */
export const STORE_LOCALES = Object.freeze(rawStoreLocales);

/** Per-locale descriptions shipped in the extension manifest only. */
export const MANIFEST_LOCALES = Object.freeze(rawManifestLocales);

/** Default locale for manifest __MSG__ replacements. */
export const MANIFEST_DEFAULT_LOCALE = MANIFEST_LOCALES.defaultLocale;

/** All locales emitted as _locales/<locale>/messages.json in extension builds. */
export const MANIFEST_LOCALE_CODES = Object.freeze(
  Object.keys(MANIFEST_LOCALES.locales),
);

/** Localized Chrome Web Store titles injected into Chromium manifests. */
export const CWS_TITLES = Object.freeze(rawCwsTitles);

/** Resolves a target-specific localized manifest description. */
export const resolveManifestShortDesc = (locale, target = "chromium") => {
  const entry = MANIFEST_LOCALES.locales[locale];
  if (!entry) {
    throw new Error(`Unknown manifest locale: ${locale}`);
  }

  return entry[resolveStoreTargetKey(target)];
};

/** Default `_locales` locale; must have a `messages.json`. */
export const STORE_DEFAULT_LOCALE = STORE_LOCALES.defaultLocale;

/** All locale codes that get a generated `_locales/<locale>/messages.json`. */
export const STORE_LOCALE_CODES = Object.freeze(Object.keys(STORE_LOCALES.locales));

/** Maps a build target to the matching store-locale description key. */
const resolveStoreTargetKey = (target = "chromium") =>
  target === "firefox" ? "firefox" : "chromium";

/**
 * Resolves the localized manifest short description for a locale + build target.
 * Throws on an unknown locale so build-time generation fails loudly rather than
 * silently shipping an empty description.
 */
export const resolveStoreShortDesc = (locale, target = "chromium") => {
  const entry = STORE_LOCALES.locales[locale];
  if (!entry) {
    throw new Error(`Unknown store locale: ${locale}`);
  }

  return entry[resolveStoreTargetKey(target)];
};

/** Stable-channel brand metadata. */
export const STABLE_BRAND_CHANNEL = Object.freeze(BRAND_CONFIG.channels.stable);

/** Beta-channel brand metadata. */
export const BETA_BRAND_CHANNEL = Object.freeze(BRAND_CONFIG.channels.beta);

/** Stable display name used by release-like channels. */
export const STABLE_DISPLAY_NAME = STABLE_BRAND_CHANNEL.displayName;

/** Beta display name used by beta-branded builds. */
export const BETA_BRAND_DISPLAY_NAME = BETA_BRAND_CHANNEL.displayName;

/** Stable icon asset directory. */
export const STABLE_ICON_ASSET_DIR = STABLE_BRAND_CHANNEL.iconAssetDir;

/** Beta icon asset directory. */
export const BETA_ICON_ASSET_DIR = BETA_BRAND_CHANNEL.iconAssetDir;

/** Stable Firefox extension ID. */
export const STABLE_FX_EXT_ID = STABLE_BRAND_CHANNEL.firefoxExtensionId;

/** Beta Firefox extension ID. */
export const BETA_FX_EXT_ID = BETA_BRAND_CHANNEL.firefoxExtensionId;

const BRAND_CHANNELS = Object.freeze({
  stable: STABLE_BRAND_CHANNEL,
  beta: BETA_BRAND_CHANNEL,
});

/** Normalizes legacy build-channel aliases to the current naming. */
export const normalizeBuildChannel = (channel = "local") =>
  channel === "next" ? "beta" : channel;

const resolveBrandingChannel = (channel = "local") =>
  normalizeBuildChannel(channel) === "beta" ? "beta" : "stable";

const resolveFxChannel = (channel = "local") =>
  ["local", "beta"].includes(normalizeBuildChannel(channel)) ? "beta" : "stable";

const resolveBrandChannel = (channel = "local") =>
  BRAND_CHANNELS[resolveBrandingChannel(channel)];

/** Resolves the brand display name for a given build channel. */
export const resolveBrandDisplayName = (channel = "local") =>
  resolveBrandChannel(channel).displayName;

/**
 * Resolves the localized manifest name for a browser target and release channel.
 * Chromium store titles keep the localized slogan from the stable CWS source,
 * while Firefox uses the channel display name managed separately by AMO.
 */
export const resolveManifestExtName = (
  locale,
  target = "chromium",
  channel = "local",
) => {
  const displayName = resolveBrandDisplayName(channel);
  if (target === "firefox") {
    return displayName;
  }

  const stableTitle = CWS_TITLES.locales[locale];
  if (!stableTitle) {
    throw new Error(`Unknown CWS title locale: ${locale}`);
  }

  const stablePrefix = `${STABLE_DISPLAY_NAME} — `;
  if (!stableTitle.startsWith(stablePrefix)) {
    throw new Error(`CWS title "${locale}" must start with "${stablePrefix}".`);
  }

  return `${displayName} — ${stableTitle.slice(stablePrefix.length)}`;
};

/** Resolves the icon asset directory for a given build channel. */
export const resolveBrandIconAssetDir = (channel = "local") =>
  resolveBrandChannel(channel).iconAssetDir;

/** Resolves the Firefox extension ID for a given build channel. */
export const resolveFxExtId = (channel = "local") =>
  BRAND_CHANNELS[resolveFxChannel(channel)].firefoxExtensionId;

/** Resolves an explicitly configured Firefox update URL for non-release builds. */
export const resolveFirefoxUpdateUrl = (
  channel = "local",
  explicitUpdateUrl = process.env.PT_FIREFOX_UPDATE_URL?.trim() ?? "",
) => {
  const normalizedChannel = normalizeBuildChannel(channel);

  if (!["local", "beta"].includes(normalizedChannel)) {
    return "";
  }

  return explicitUpdateUrl;
};

/** Returns whether source maps should be emitted for the given build channel. */
export const shouldEmitBuildMaps = (channel = "local") =>
  normalizeBuildChannel(channel) === "local";

/** Builds a packaged artifact filename for the current brand. */
export const buildArtifactFileName = (versionLabel, target, extension) =>
  `${BRAND_ARTIFACT_STEM}-${versionLabel}-${target}.${extension}`;

/** Builds a source archive filename for the current brand. */
export const buildSourceArchiveName = (versionLabel) =>
  `${BRAND_ARTIFACT_STEM}-${versionLabel}-source.zip`;

/** Builds the archive prefix used for branded source bundles. */
export const buildSourceArchivePrefix = (versionLabel) =>
  `${BRAND_ARTIFACT_STEM}-${versionLabel}-source/`;

/** Builds a temporary directory prefix used by packaging scripts. */
export const buildBrandTempDirPrefix = (label) => `${BRAND_ARTIFACT_STEM}-${label}-`;
