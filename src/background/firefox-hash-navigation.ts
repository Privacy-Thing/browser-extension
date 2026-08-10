import {
  buildFxSeededUrl,
  parseFirefoxHashSeed,
  resolveFxSeedForHost,
  type FirefoxWindowSeedState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";

type FxHashRedirectInput = {
  currentTabUrl?: string;
  method: string;
  url: string;
  seedState: FirefoxWindowSeedState | null;
};

/**
 * Returns true only for same-origin navigations that can reuse an already
 * loaded document instead of needing a fresh first-inline seed.
 *
 * Firefox hash seeding must stay conservative here: hostname-only matching is
 * not enough because protocol or port changes still require a new document and
 * therefore a fresh bootstrap path.
 */
export const isFxSameHostNav = (
  targetUrl: URL,
  currentTabUrl: string | undefined,
): boolean => {
  if (!currentTabUrl) {
    return false;
  }

  let parsedCurrentTabUrl: URL;
  try {
    parsedCurrentTabUrl = new URL(currentTabUrl);
  } catch {
    return false;
  }

  if (
    (parsedCurrentTabUrl.protocol !== "http:" &&
      parsedCurrentTabUrl.protocol !== "https:") ||
    parsedCurrentTabUrl.origin !== targetUrl.origin
  ) {
    return false;
  }

  return parsedCurrentTabUrl.toString() !== targetUrl.toString();
};

/**
 * Builds the Firefox hash-seeded redirect URL only for the narrow baseline
 * where hash is still the authoritative transport.
 *
 * Returning `null` means the caller should not redirect at all because the
 * request is not eligible (non-GET, unsupported URL, already seeded) or an
 * existing same-origin document can be reused safely without a visible hash hop.
 */
export const buildFxHashRedirect = ({
  currentTabUrl,
  method,
  url,
  seedState,
}: FxHashRedirectInput): string | null => {
  if (!seedState || method.trim().toUpperCase() !== "GET") {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

  if (isFxSameHostNav(parsedUrl, currentTabUrl)) {
    return null;
  }

  if (parseFirefoxHashSeed(parsedUrl.hash)) {
    return null;
  }

  const resolvedState = resolveFxSeedForHost(parsedUrl.hostname, seedState);
  if (resolvedState === null) {
    return null;
  }

  const seededUrl = buildFxSeededUrl(parsedUrl.toString(), resolvedState);
  return seededUrl === parsedUrl.toString() ? null : seededUrl;
};
