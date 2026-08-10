import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// @TODO: Dodać wspólny helper weryfikujący poprawność wersji i daty
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:\.\d+)?$/; // MAJOR.MINOR.PATCH.REVISION
const STABLE_TAG_PATTERN = /^v(\d+\.\d+\.\d+(?:\.\d+)?)$/; // vMAJOR.MINOR.PATCH[.REVISION]

/**
 * Compute the next metadata-refresh revision from a stable base version.
 *
 * A 3-part base gains a `.1` revision; a 4-part base increments its revision:
 *   0.8.9   -> 0.8.9.1
 *   0.9.4.2 -> 0.9.4.3
 */
export const computeNextRevision = (baseVersion) => {
  if (!SEMVER_PATTERN.test(baseVersion)) {
    throw new Error(`Invalid base version: ${baseVersion}`);
  }

  const parts = baseVersion.split(".").map(Number);

  if (parts.length === 3) {
    return `${baseVersion}.1`;
  }

  const [major, minor, patch, revision] = parts;
  return `${major}.${minor}.${patch}.${revision + 1}`;
};

/**
 * Pick the highest stable `vX.Y.Z[.R]` tag from a list of tag names.
 * `beta-*` and any non-stable tags are ignored.
 */
export const pickLatestStableTag = (tagNames) => {
  const stable = tagNames
    .map((name) => name.trim())
    .map((name) => STABLE_TAG_PATTERN.exec(name))
    .filter((match) => match != null)
    .map((match) => ({ tag: match[0], version: match[1] }));

  if (stable.length === 0) {
    throw new Error("No stable vX.Y.Z tags found");
  }

  stable.sort((a, b) => compareVersions(b.version, a.version));
  return stable[0];
};

const compareVersions = (a, b) => {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) {
      return diff > 0 ? 1 : -1;
    }
  }

  return 0;
};

const readGitTags = () => {
  const output = execFileSync("git", ["tag", "--list", "v*"], { encoding: "utf8" });
  return output.split("\n").filter((line) => line.trim().length > 0);
};

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  const latest = pickLatestStableTag(readGitTags());
  const nextVersion = computeNextRevision(latest.version);

  process.stdout.write(
    [
      `PT_BASE_STABLE_TAG=${latest.tag}`,
      `PT_BASE_STABLE_VERSION=${latest.version}`,
      `PT_NEXT_REVISION_VERSION=${nextVersion}`,
      `PT_NEXT_REVISION_TAG=v${nextVersion}`,
    ].join("\n") + "\n",
  );
}
