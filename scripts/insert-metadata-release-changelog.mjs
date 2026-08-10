import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CHANGELOG_PATH = path.resolve("CHANGELOG.md");
// @TODO: Dodać wspólny helper weryfikujący poprawność wersji i daty
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:\.\d+)?$/; // MAJOR.MINOR.PATCH.REVISION
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UNRELEASED_HEADER = "## [Unreleased]";

const DEFAULT_NOTE =
  "- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) " +
  "from upstream sources to keep spoofed fingerprints current.";

/**
 * Insert a dedicated `## [version] - date` release section directly below the
 * `## [Unreleased]` header **without draining** the Unreleased body.
 *
 * This is the metadata-refresh counterpart to `promote-unreleased-changelog.mjs`:
 * a scheduled revision release must not consume in-progress feature notes that
 * are queued for the next deliberate `X.Y.Z` release.
 */
export const insertMetadataSection = (
  changelog,
  version,
  date,
  note = DEFAULT_NOTE,
) => {
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
  const insertionPoint =
    afterHeaderIndex === -1 ? changelog.length : afterHeaderIndex + 1;
  const releaseSection = `\n## [${version}] - ${date}\n\n${note.trim()}\n`;

  return `${changelog.slice(0, insertionPoint)}${releaseSection}${changelog.slice(
    insertionPoint,
  )}`;
};

const parseArgs = (argv) => {
  const args = {
    version: process.env.PT_RELEASE_VERSION ?? "",
    date: "",
    note: "",
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

    if (value === "--note") {
      args.note = argv[index + 1] ?? args.note;
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
  const updated = insertMetadataSection(
    changelog,
    args.version,
    args.date,
    args.note || undefined,
  );

  if (args.write) {
    fs.writeFileSync(CHANGELOG_PATH, updated);
    process.stdout.write(
      `Inserted ## [${args.version}] - ${args.date} below ${UNRELEASED_HEADER} in CHANGELOG.md\n`,
    );
  } else {
    process.stdout.write(updated);
  }
}
