import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CHANGELOG_PATH = path.resolve("CHANGELOG.md");
// @TODO: Dodać wspólny helper weryfikujący poprawność wersji i daty
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:\.\d+)?$/; // MAJOR.MINOR.PATCH.REVISION
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UNRELEASED_HEADER = "## [Unreleased]";
const RELEASE_HEADER_PATTERN = /^## \[[^\]]+\] - \d{4}-\d{2}-\d{2}$/m;

export const promoteUnreleasedSection = (changelog, version, date) => {
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`Invalid version: ${version}`);
  }

  if (!DATE_PATTERN.test(date)) {
    throw new Error(`Invalid date: ${date}`);
  }

  const unreleasedIndex = changelog.indexOf(UNRELEASED_HEADER);

  if (unreleasedIndex === -1) {
    throw new Error("CHANGELOG is missing the [Unreleased] section");
  }

  const afterHeaderIndex = changelog.indexOf("\n", unreleasedIndex);
  const releaseHeaderMatch = RELEASE_HEADER_PATTERN.exec(
    changelog.slice(afterHeaderIndex + 1),
  );
  const nextSectionIndex =
    releaseHeaderMatch == null
      ? changelog.length
      : afterHeaderIndex + 1 + releaseHeaderMatch.index;
  const unreleasedBody = changelog.slice(afterHeaderIndex + 1, nextSectionIndex).trim();

  if (!unreleasedBody) {
    throw new Error("CHANGELOG [Unreleased] section is empty");
  }

  const releaseSection = `${UNRELEASED_HEADER}\n\n## [${version}] - ${date}\n\n${unreleasedBody}\n\n`;

  return `${changelog.slice(0, unreleasedIndex)}${releaseSection}${changelog.slice(
    nextSectionIndex,
  )}`;
};

const parseArgs = (argv) => {
  const args = {
    version: process.env.PT_RELEASE_VERSION ?? "",
    date: "",
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--version") {
      args.version = argv[index + 1] ?? args.version;
      index += 1;
      continue;
    }

    if (value === "--date") {
      args.date = argv[index + 1] ?? args.date;
      index += 1;
      continue;
    }

    if (value === "--write") {
      args.write = true;
    }
  }

  if (!SEMVER_PATTERN.test(args.version)) {
    throw new Error("Use --version X.Y.Z or X.Y.Z.N or set PT_RELEASE_VERSION");
  }

  if (!DATE_PATTERN.test(args.date)) {
    throw new Error("Use --date YYYY-MM-DD");
  }

  return args;
};

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  const args = parseArgs(process.argv.slice(2));
  const changelog = fs.readFileSync(CHANGELOG_PATH, "utf8");
  const updated = promoteUnreleasedSection(changelog, args.version, args.date);

  if (args.write) {
    fs.writeFileSync(CHANGELOG_PATH, updated);
    process.stdout.write(
      `Promoted ${UNRELEASED_HEADER} to ## [${args.version}] - ${args.date} in CHANGELOG.md\n`,
    );
  } else {
    process.stdout.write(updated);
  }
}
