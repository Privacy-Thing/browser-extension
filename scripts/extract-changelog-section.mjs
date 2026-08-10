import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CHANGELOG_PATH = path.resolve("CHANGELOG.md");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseArgs = (argv) => {
  const args = {
    output: "",
    version: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--output") {
      args.output = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--version") {
      args.version = (argv[index + 1] ?? "").replace(/^v/, "");
      index += 1;
    }
  }

  if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(args.version)) {
    throw new Error("Use --version X.Y.Z or X.Y.Z.N (optionally v-prefixed)");
  }

  if (!args.output) {
    throw new Error("Use --output <path>");
  }

  return args;
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const changelog = fs.readFileSync(CHANGELOG_PATH, "utf8");
  const sectionPattern = new RegExp(
    `^## \\[${escapeRegExp(args.version)}\\] - (?<date>\\d{4}-\\d{2}-\\d{2})$`,
    "m",
  );
  const match = sectionPattern.exec(changelog);

  if (match == null || !match.groups?.date) {
    throw new Error(`Could not find CHANGELOG entry for ${args.version}`);
  }

  const contentStart = changelog.indexOf("\n", match.index) + 1;
  const nextHeaderMatch = /^## \[/m.exec(changelog.slice(contentStart));
  const contentEnd =
    nextHeaderMatch == null ? changelog.length : contentStart + nextHeaderMatch.index;
  const body = changelog.slice(contentStart, contentEnd).trim();

  if (!body) {
    throw new Error(`CHANGELOG entry for ${args.version} is empty`);
  }

  const output = `Released: ${match.groups.date}\n\n${body}\n`;
  fs.writeFileSync(path.resolve(args.output), output);
};

main();
