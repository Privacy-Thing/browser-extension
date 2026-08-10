import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

/**
 * Keep repository-root resolution anchored to this source file instead of the
 * current working directory. The relative `../../..` climb is deliberate:
 * it resolves correctly both before the move (`tools/api-conformance/src`) and
 * after the move (`packages/platform-api-conformance/src`), so package-level execution
 * cannot silently retarget build outputs, source scans, or cache/report paths.
 */
export const repositoryRootDirectory = path.resolve(SOURCE_DIRECTORY, "../../..");

export const injectionSourceDirectory = path.join(
  repositoryRootDirectory,
  "src",
  "injection",
);

export const chromiumBuildDir = path.join(repositoryRootDirectory, "build", "chrome");

export const firefoxBuildDir = path.join(repositoryRootDirectory, "build", "firefox");

export const chromiumMarkerPath = path.join(
  repositoryRootDirectory,
  "build",
  "runtime-applied-marker.chromium.txt",
);

export const buildTargetScriptPath = path.join(
  repositoryRootDirectory,
  "scripts",
  "build-target.mjs",
);

export const webExtRemoteModulePath = path.join(
  repositoryRootDirectory,
  "node_modules",
  "web-ext",
  "lib",
  "firefox",
  "remote.js",
);

export const resolveRepoPath = (...segments: string[]): string =>
  path.resolve(repositoryRootDirectory, ...segments);
