/**
 * Derives stable, browser-family-aware fingerprint surfaces so UA and Client
 * Hints spoofing stay internally consistent across reloads.
 */

import { buildClientHints } from "./browser-client-hints.js";
import type { BrowserFingerprintSource } from "./browser-fingerprint-source.js";
import { pickChromeBuild } from "./chrome-version-catalog";

export {
  clearFingerprintCache,
  readFingerprintSource,
} from "./browser-fingerprint-source.js";
export type {
  BrowserFingerprintSource,
  UserAgentDataLike,
} from "./browser-fingerprint-source.js";
export { quoteHeaderString, serializeHintBrands } from "./browser-client-hints.js";

import type { BrowserClientHintBrand, BrowserFingerprint } from "@/shared/types";

export type FingerprintOptions = {
  rotateChromiumVersion?: boolean | undefined;
  versionSeedKey?: string | undefined;
};

const cloneOptionalBrands = (
  brands: readonly BrowserClientHintBrand[] | undefined,
): BrowserClientHintBrand[] | undefined => (brands ? cloneBrands(brands) : undefined);

type BrowserVersionParts<TFamily extends BrowserFamily, TProduct extends string> = {
  family: TFamily;
  product: TProduct;
  major: number;
  minor: number;
  patch: number | undefined;
};

const buildBrowserVersion = <TFamily extends BrowserFamily, TProduct extends string>({
  family,
  product,
  major,
  minor,
  patch,
}: BrowserVersionParts<TFamily, TProduct>) => ({
  family,
  product,
  fullVersion: patch === undefined ? `${major}.${minor}` : `${major}.${minor}.${patch}`,
  major,
  minor,
  ...(patch === undefined ? {} : { patch }),
});

const parseFirefoxUaVersion = (userAgent: string): BrowserUaVersion | null => {
  const firefoxMatch = userAgent.match(FIREFOX_VERSION_PATTERN);
  const firefoxGroups = firefoxMatch?.groups;
  if (!firefoxGroups) {
    return null;
  }

  const major = Number(firefoxGroups.major);
  const minor = Number(firefoxGroups.minor ?? 0);
  const patch =
    firefoxGroups.patch === undefined ? undefined : Number(firefoxGroups.patch);
  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    (patch !== undefined && !Number.isInteger(patch))
  ) {
    return null;
  }

  return buildBrowserVersion({
    family: "firefox",
    product: "Firefox",
    major,
    minor,
    patch,
  });
};

const parseSafariUaVersion = (userAgent: string): BrowserUaVersion | null => {
  const safariMatch = userAgent.match(SAFARI_VERSION_PATTERN);
  const safariGroups = safariMatch?.groups;
  if (!safariGroups || !/\bSafari\//.test(userAgent) || /\bChrome\//.test(userAgent)) {
    return null;
  }

  const major = Number(safariGroups.major);
  const minor = Number(safariGroups.minor ?? 0);
  const patch =
    safariGroups.patch === undefined ? undefined : Number(safariGroups.patch);
  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    (patch !== undefined && !Number.isInteger(patch))
  ) {
    return null;
  }

  return buildBrowserVersion({
    family: "safari",
    product: "Version",
    major,
    minor,
    patch,
  });
};

/** Parsed Chromium version token reused across UA and Client Hints shaping. */
export type ChromiumUaVersion = {
  product: "Chrome" | "Chromium";
  fullVersion: string;
  major: number;
  minor: number;
  build: number;
  patch: number;
};

/** Parsed browser version token for the currently detected browser family. */
export type BrowserUaVersion =
  | (ChromiumUaVersion & { family: "chromium" })
  | {
      family: "firefox";
      product: "Firefox";
      fullVersion: string;
      major: number;
      minor: number;
      patch?: number;
    }
  | {
      family: "safari";
      product: "Version";
      fullVersion: string;
      major: number;
      minor: number;
      patch?: number;
    };

export type BrowserFamily = BrowserUaVersion["family"];

const CHROMIUM_VERSION_PATTERN =
  /\b(?<product>Chrome|Chromium)\/(?<major>\d+)\.(?<minor>\d+)\.(?<build>\d+)\.(?<patch>\d+)\b/;
const CHROMIUM_COMPAT_RE =
  /\b(?<product>Edg|OPR)\/(?<major>\d+)\.(?<minor>\d+)\.(?<build>\d+)\.(?<patch>\d+)\b/g;
const FIREFOX_VERSION_PATTERN =
  /\bFirefox\/(?<major>\d+)(?:\.(?<minor>\d+))?(?:\.(?<patch>\d+))?\b/;
const SAFARI_VERSION_PATTERN =
  /\bVersion\/(?<major>\d+)(?:\.(?<minor>\d+))?(?:\.(?<patch>\d+))?\b/;

const isFinitePositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * Creates a stable, local seed from the native UA string.
 * Fingerprint values must not drift between page reloads, but should still vary
 * across materially different browser builds.
 */
const hashString = (value: string): number => {
  let hash = 2166136261;

  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const cloneBrands = (
  brands: readonly BrowserClientHintBrand[],
): BrowserClientHintBrand[] =>
  brands.map((brand) => ({
    brand: brand.brand,
    version: brand.version,
  }));

const isReducedChromiumVersion = (version: ChromiumUaVersion): boolean =>
  version.minor === 0 && version.build === 0 && version.patch === 0;

const makeReducedHintVersion = (
  seedSource: string,
  parsedVersion: ChromiumUaVersion,
  catalogBuildPatch?: { build: number; patch: number },
): ChromiumUaVersion => {
  let build: number;
  let patch: number;

  if (catalogBuildPatch) {
    build = catalogBuildPatch.build;
    patch = catalogBuildPatch.patch;
  } else {
    const hash = hashString(`${seedSource}::reduced-client-hints`);
    build = 1000 + (hash % 9000);
    patch = 1 + (Math.floor(hash / 9000) % 99);
  }

  return {
    ...parsedVersion,
    build,
    patch,
    fullVersion: `${parsedVersion.major}.${parsedVersion.minor}.${build}.${patch}`,
  };
};

const fuzzChromiumVersion = (
  parsedVersion: ChromiumUaVersion,
  seedSource: string,
  catalogBuildPatch?: { build: number; patch: number },
): ChromiumUaVersion => {
  if (isReducedChromiumVersion(parsedVersion)) {
    return parsedVersion;
  }

  if (catalogBuildPatch) {
    return {
      ...parsedVersion,
      build: catalogBuildPatch.build,
      patch: catalogBuildPatch.patch,
      fullVersion: `${parsedVersion.major}.${parsedVersion.minor}.${catalogBuildPatch.build}.${catalogBuildPatch.patch}`,
    };
  }

  const hash = hashString(seedSource);
  // Keep the major/minor family intact and only move the build nearby, matching
  // the "real browser with a plausible adjacent build" model from Spoofing V2.
  const buildDelta = (hash % 7) - 3;
  const patch = 10 + (Math.floor(hash / 7) % 90);
  const build = Math.max(0, parsedVersion.build + buildDelta);

  return {
    ...parsedVersion,
    build,
    patch,
    fullVersion: `${parsedVersion.major}.${parsedVersion.minor}.${build}.${patch}`,
  };
};

const parseChromiumVersion = (version: string): ChromiumUaVersion | null => {
  const parts = version.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const [major, minor, build, patch] = parts.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    !Number.isInteger(build) ||
    !Number.isInteger(patch)
  ) {
    return null;
  }

  return {
    product: "Chrome",
    fullVersion: `${major}.${minor}.${build}.${patch}`,
    major,
    minor,
    build,
    patch,
  };
};

/** Parses the Chromium product token that is shared by UA and Client Hints. */
export const parseChromiumUaVersion = (userAgent: string): ChromiumUaVersion | null => {
  const match = userAgent.match(CHROMIUM_VERSION_PATTERN);
  const groups = match?.groups;
  if (!groups) {
    return null;
  }

  const major = Number(groups.major);
  const minor = Number(groups.minor);
  const build = Number(groups.build);
  const patch = Number(groups.patch);
  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    !Number.isInteger(build) ||
    !Number.isInteger(patch)
  ) {
    return null;
  }

  return {
    product: groups.product === "Chromium" ? "Chromium" : "Chrome",
    fullVersion: `${major}.${minor}.${build}.${patch}`,
    major,
    minor,
    build,
    patch,
  };
};

/**
 * Parses the browser version token used for UA/appVersion spoofing.
 * Client Hints remain Chromium-only, but UA fuzzing itself applies to the
 * current browser family when a recognizable version token exists.
 */
export const parseBrowserUaVersion = (userAgent: string): BrowserUaVersion | null => {
  const chromiumVersion = parseChromiumUaVersion(userAgent);
  if (chromiumVersion) {
    return {
      ...chromiumVersion,
      family: "chromium",
    };
  }

  return parseFirefoxUaVersion(userAgent) ?? parseSafariUaVersion(userAgent);
};

/** Returns the detected browser family for a UA string, if recognizable. */
export const detectBrowserFamily = (
  userAgent: string | undefined,
): BrowserFamily | undefined => {
  if (!userAgent) {
    return undefined;
  }

  return parseBrowserUaVersion(userAgent)?.family;
};

/** True only when both UAs map to the same known browser family. */
export const isSameBrowserFamily = (
  leftUserAgent: string | undefined,
  rightUserAgent: string | undefined,
): boolean => {
  const leftFamily = detectBrowserFamily(leftUserAgent);
  if (!leftFamily) {
    return false;
  }

  return leftFamily === detectBrowserFamily(rightUserAgent);
};

/** Fuzzes a Chromium version while keeping it close to the native build line. */
export const fuzzChromiumUaVersion = (
  userAgent: string,
  seedSource = userAgent,
): ChromiumUaVersion | null => {
  const parsed = parseChromiumUaVersion(userAgent);
  if (!parsed) {
    return null;
  }

  return fuzzChromiumVersion(parsed, seedSource);
};

/** Rewrites a Chromium-family user agent to use the fuzzed Chromium version. */
export const fuzzChromiumUserAgent = (
  userAgent: string,
  seedSource = userAgent,
): string => {
  const parsed = parseChromiumUaVersion(userAgent);
  const fuzzed = fuzzChromiumUaVersion(userAgent, seedSource);
  if (!parsed || !fuzzed) {
    return userAgent;
  }

  return userAgent
    .replace(
      `${parsed.product}/${parsed.fullVersion}`,
      `${parsed.product}/${fuzzed.fullVersion}`,
    )
    .replace(CHROMIUM_COMPAT_RE, `${"$<product>"}/${fuzzed.fullVersion}`);
};

/** Fuzzes the browser version token while preserving the detected browser family. */
export const fuzzBrowserUaVersion = (
  userAgent: string,
  seedSource = userAgent,
): BrowserUaVersion | null => {
  const parsed = parseBrowserUaVersion(userAgent);
  if (!parsed) {
    return null;
  }

  if (parsed.family === "chromium") {
    const fuzzedChromium = fuzzChromiumUaVersion(userAgent, seedSource);
    return fuzzedChromium
      ? {
          ...fuzzedChromium,
          family: "chromium",
        }
      : null;
  }

  const hash = hashString(seedSource);
  // Firefox/Safari UAs have shorter version tokens than Chromium. Keep the
  // major line stable and move only the minor/patch components nearby.
  const minor = Math.max(0, parsed.minor + ((hash % 7) - 3));
  const patch = parsed.patch === undefined ? undefined : 1 + (Math.floor(hash / 7) % 9);

  return {
    ...parsed,
    minor,
    ...(patch === undefined ? {} : { patch }),
    fullVersion:
      patch === undefined
        ? `${parsed.major}.${minor}`
        : `${parsed.major}.${minor}.${patch}`,
  };
};

/** Rewrites the current browser-family user agent using the fuzzed version token. */
export const fuzzBrowserUserAgent = (
  userAgent: string,
  seedSource = userAgent,
): string => {
  const parsed = parseBrowserUaVersion(userAgent);
  const fuzzed = fuzzBrowserUaVersion(userAgent, seedSource);
  if (!parsed || !fuzzed) {
    return userAgent;
  }

  if (parsed.family === "chromium") {
    return fuzzChromiumUserAgent(userAgent, seedSource);
  }

  const nextUserAgent = userAgent.replace(
    `${parsed.product}/${parsed.fullVersion}`,
    `${fuzzed.product}/${fuzzed.fullVersion}`,
  );

  return parsed.family === "firefox"
    ? nextUserAgent.replace(`rv:${parsed.fullVersion}`, `rv:${fuzzed.fullVersion}`)
    : nextUserAgent;
};

/** Converts a user agent string into the `navigator.appVersion` surface. */
export const deriveAppVersion = (userAgent: string): string =>
  userAgent.startsWith("Mozilla/") ? userAgent.slice("Mozilla/".length) : userAgent;

const isChromiumBrand = (brand: string): boolean =>
  brand === "Chromium" ||
  brand === "Google Chrome" ||
  brand === "Chrome" ||
  brand === "Microsoft Edge" ||
  brand === "Opera" ||
  brand === "Brave";

const alignBrands = (
  brands: readonly BrowserClientHintBrand[] | undefined,
  chromiumVersion: ChromiumUaVersion | null,
  fullVersion: boolean,
): BrowserClientHintBrand[] | undefined => {
  if (!brands) {
    return undefined;
  }

  const clonedBrands = cloneBrands(brands);
  if (!chromiumVersion) {
    return clonedBrands;
  }

  return clonedBrands.map((brand) =>
    isChromiumBrand(brand.brand)
      ? {
          ...brand,
          version: fullVersion
            ? chromiumVersion.fullVersion
            : String(chromiumVersion.major),
        }
      : brand,
  );
};

const cloneOrAlignBrands = (
  brands: readonly BrowserClientHintBrand[] | undefined,
  chromiumVersion: ChromiumUaVersion | null,
  fullVersion: boolean,
  keepNativeVersion: boolean,
): BrowserClientHintBrand[] | undefined => {
  if (keepNativeVersion) {
    return cloneOptionalBrands(brands);
  }

  return alignBrands(brands, chromiumVersion, fullVersion);
};

const resolveCatalogBuildPatch = (
  keepNativeVersion: boolean,
  parsedVersion: BrowserUaVersion | null,
  platform: string | undefined,
  versionSeedSource: string,
): { build: number; patch: number } | undefined => {
  if (keepNativeVersion || parsedVersion?.family !== "chromium") {
    return undefined;
  }

  return pickChromeBuild(
    parsedVersion.major,
    platform,
    hashString(versionSeedSource),
    !isReducedChromiumVersion(parsedVersion)
      ? { build: parsedVersion.build, patch: parsedVersion.patch }
      : undefined,
  );
};

type ChromiumVersionInput = {
  parsedVersion: BrowserUaVersion | null;
  keepNativeVersion: boolean;
  userAgent: string;
  versionSeedSource: string;
  catalogBuildPatch: { build: number; patch: number } | undefined;
};

const resolveChromiumVersion = ({
  parsedVersion,
  keepNativeVersion,
  userAgent,
  versionSeedSource,
  catalogBuildPatch,
}: ChromiumVersionInput): ChromiumUaVersion | null => {
  if (parsedVersion?.family !== "chromium") {
    return null;
  }

  if (keepNativeVersion) {
    return parseChromiumUaVersion(userAgent);
  }

  return fuzzChromiumVersion(parsedVersion, versionSeedSource, catalogBuildPatch);
};

type FingerprintUaInput = {
  sourceUserAgent: string;
  parsedVersion: BrowserUaVersion | null;
  keepNativeVersion: boolean;
  catalogBuildPatch: { build: number; patch: number } | undefined;
  chromiumVersion: ChromiumUaVersion | null;
  versionSeedSource: string;
};

const resolveFingerprintUa = ({
  sourceUserAgent,
  parsedVersion,
  keepNativeVersion,
  catalogBuildPatch,
  chromiumVersion,
  versionSeedSource,
}: FingerprintUaInput): string => {
  const useCatalogUa =
    !keepNativeVersion &&
    Boolean(catalogBuildPatch) &&
    parsedVersion?.family === "chromium" &&
    !isReducedChromiumVersion(parsedVersion) &&
    Boolean(chromiumVersion);

  if (useCatalogUa && chromiumVersion && parsedVersion?.family === "chromium") {
    return sourceUserAgent
      .replace(
        `${parsedVersion.product}/${parsedVersion.fullVersion}`,
        `${parsedVersion.product}/${chromiumVersion.fullVersion}`,
      )
      .replace(CHROMIUM_COMPAT_RE, `${"$<product>"}/${chromiumVersion.fullVersion}`);
  }

  if (keepNativeVersion) {
    return sourceUserAgent;
  }

  return fuzzBrowserUserAgent(sourceUserAgent, versionSeedSource);
};

const getReducedUaHintVersion = (
  seedSource: string,
  brands: readonly BrowserClientHintBrand[] | undefined,
  fallback: ChromiumUaVersion | null,
  catalogBuildPatch?: { build: number; patch: number },
): ChromiumUaVersion | null => {
  if (!fallback) {
    return null;
  }

  const nativeVersion = brands
    ?.filter((brand) => isChromiumBrand(brand.brand))
    .map((brand) => parseChromiumVersion(brand.version))
    .find(
      (version): version is ChromiumUaVersion =>
        !!version &&
        version.major === fallback.major &&
        version.build >= 1000 &&
        !isReducedChromiumVersion(version),
    );

  if (nativeVersion) {
    return fuzzChromiumVersion(
      nativeVersion,
      `${seedSource}::${nativeVersion.fullVersion}`,
      catalogBuildPatch,
    );
  }

  if (brands?.some((brand) => brand.brand === "Brave")) {
    return fallback;
  }

  return makeReducedHintVersion(seedSource, fallback, catalogBuildPatch);
};

/**
 * Builds the JS-visible fingerprint payload consumed by navigator and
 * client-hints patches. Returns `undefined` when spoofing is disabled.
 */
export const createBrowserFingerprint = (
  source: BrowserFingerprintSource,
  enabled: boolean,
  options: FingerprintOptions = {},
): BrowserFingerprint | undefined => {
  if (!enabled || !source.userAgent) {
    return undefined;
  }

  const parsedVersion = parseBrowserUaVersion(source.userAgent);
  const versionSeedSource = options.versionSeedKey
    ? `${source.userAgent}::${options.versionSeedKey}`
    : source.userAgent;
  const keepNativeVersion =
    options.rotateChromiumVersion === false && parsedVersion?.family === "chromium";
  const nativeClientHints = source.userAgentData;
  // Catalog lookup: pick a real Canary build/patch for this major+platform combination.
  // Falls back to arithmetic generation when no catalog entry matches.
  const catalogBuildPatch = resolveCatalogBuildPatch(
    keepNativeVersion,
    parsedVersion,
    nativeClientHints?.platform ?? source.platform,
    versionSeedSource,
  );
  // Use the private fuzzChromiumVersion directly so the catalog param threads through.
  const chromiumVersion = resolveChromiumVersion({
    parsedVersion,
    keepNativeVersion,
    userAgent: source.userAgent,
    versionSeedSource,
    catalogBuildPatch,
  });
  // For non-reduced Chromium with a catalog hit, replace the native version directly
  // so UA stays aligned with the catalog-chosen build/patch. For everything else
  // (reduced Chromium, Firefox, Safari, no catalog match) use the standard fuzz path.
  const userAgent = resolveFingerprintUa({
    sourceUserAgent: source.userAgent,
    parsedVersion,
    keepNativeVersion,
    catalogBuildPatch,
    chromiumVersion,
    versionSeedSource,
  });
  const nativeFullVersionList = nativeClientHints?.fullVersionList;
  const clientHintVersion =
    !keepNativeVersion && chromiumVersion && isReducedChromiumVersion(chromiumVersion)
      ? getReducedUaHintVersion(
          versionSeedSource,
          nativeFullVersionList ?? nativeClientHints?.brands,
          chromiumVersion,
          catalogBuildPatch,
        )
      : chromiumVersion;
  // UA, low-entropy brands, and full-version brands are derived from one
  // Chromium version so JS-visible and network-visible signals stay aligned.
  const brands = cloneOrAlignBrands(
    nativeClientHints?.brands,
    clientHintVersion,
    false,
    keepNativeVersion,
  );
  const fullVersionList = keepNativeVersion
    ? (cloneOptionalBrands(nativeFullVersionList) ??
      alignBrands(nativeClientHints?.brands, chromiumVersion, true))
    : alignBrands(
        nativeFullVersionList ?? nativeClientHints?.brands,
        clientHintVersion,
        true,
      );
  const clientHints = buildClientHints(
    nativeClientHints,
    brands,
    fullVersionList,
    source.platform,
  );

  return {
    ...(isFinitePositiveNumber(source.hardwareConcurrency)
      ? { hardwareConcurrency: source.hardwareConcurrency }
      : {}),
    ...(isFinitePositiveNumber(source.deviceMemory)
      ? { deviceMemory: source.deviceMemory }
      : {}),
    ...(source.platform ? { platform: source.platform } : {}),
    userAgent,
    ...(source.vendor ? { vendor: source.vendor } : {}),
    appVersion: deriveAppVersion(userAgent),
    ...(clientHints ? { clientHints } : {}),
  };
};
