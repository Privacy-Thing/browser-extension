import {
  chromeVersionCatalog,
  type ChromeVersionPlatformKey,
  type ChromeVersionsByMajor,
} from "./chrome-versions.generated";

const normalizePlatformKey = (
  platform: string | undefined,
): ChromeVersionPlatformKey | undefined => {
  if (!platform) return undefined;
  const lower = platform.toLowerCase();
  if (lower === "windows" || lower.startsWith("win")) return "windows";
  if (lower === "macos" || lower === "mac os x" || lower.startsWith("mac"))
    return "mac";
  if (lower === "linux" || lower.startsWith("linux")) return "linux";
  return undefined;
};

const parseVersionBuildPatch = (
  version: string,
): { build: number; patch: number } | undefined => {
  const parts = version.split(".");
  if (parts.length !== 4) return undefined;
  const build = Number(parts[2]);
  const patch = Number(parts[3]);
  if (!Number.isInteger(build) || !Number.isInteger(patch) || build < 0 || patch < 0) {
    return undefined;
  }
  return { build, patch };
};

/**
 * Returns a real Canary build/patch pair from the catalog for the given
 * major version and platform, deterministically selected by hash.
 * Returns undefined when no catalog entry exists (caller should fall back to arithmetic).
 * Excludes the native build/patch so the spoofed version is always different from the real one.
 */
export const pickChromeBuild = (
  major: number,
  platform: string | undefined,
  hash: number,
  exclude?: { build: number; patch: number },
): { build: number; patch: number } | undefined => {
  const key = normalizePlatformKey(platform);
  if (!key) return undefined;

  const byMajor = chromeVersionCatalog[key] as ChromeVersionsByMajor;
  const allVersions = byMajor[String(major)];
  if (!allVersions || allVersions.length === 0) return undefined;

  const versions = exclude
    ? allVersions.filter((v) => {
        const parsed = parseVersionBuildPatch(v);
        return (
          !parsed || parsed.build !== exclude.build || parsed.patch !== exclude.patch
        );
      })
    : allVersions;
  if (versions.length === 0) return undefined;

  const version = versions[hash % versions.length];
  if (!version) return undefined;

  return parseVersionBuildPatch(version);
};

/**
 * Returns all build/patch string pairs from the catalog for the given
 * major version and platform. Used to feed the Options animation cycle.
 * Returns an empty array when no catalog entry exists (animation falls back to its own generator).
 */
export const pickChromeFrames = (
  major: number,
  platform: string | undefined,
): readonly { build: string; patch: string }[] => {
  const key = normalizePlatformKey(platform);
  if (!key) return [];

  const byMajor = chromeVersionCatalog[key] as ChromeVersionsByMajor;
  const versions = byMajor[String(major)];
  if (!versions || versions.length === 0) return [];

  const result: { build: string; patch: string }[] = [];

  for (const version of versions) {
    const parts = version.split(".");
    if (parts.length !== 4) continue;
    const build = parts[2];
    const patch = parts[3];
    if (!build || !patch || !/^\d+$/.test(build) || !/^\d+$/.test(patch)) continue;
    result.push({ build, patch });
  }

  return result;
};

export const countChromeVersions = (
  major: number,
  platform: string | undefined,
): number => pickChromeFrames(major, platform).length;
