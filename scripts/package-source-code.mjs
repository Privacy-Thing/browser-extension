import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  buildSourceArchiveName,
  buildSourceArchivePrefix,
  buildBrandTempDirPrefix,
} from "./brand-config.mjs";
import { resolveBuildMetadata } from "./resolve-build-metadata.mjs";

const metadata = resolveBuildMetadata();
const artifactsDir = path.resolve("build", "artifacts");
const archiveFileName = buildSourceArchiveName(metadata.artifactVersionLabel);
const archivePath = path.join(artifactsDir, archiveFileName);
const archivePrefix = buildSourceArchivePrefix(metadata.artifactVersionLabel);

const renderReviewerReadme = (buildMetadata) => {
  const buildCommand =
    buildMetadata.channel === "release"
      ? `PT_BUILD_CHANNEL=release PT_RELEASE_VERSION=${buildMetadata.releaseVersion} pnpm task build:firefox`
      : `PT_BUILD_CHANNEL=${buildMetadata.channel} PT_BUILD_TIMESTAMP=${buildMetadata.buildTimestamp} pnpm task build:firefox`;

  return `# AMO Source Code Review

This archive contains the source code used to build the Firefox extension version submitted for AMO review.
The distributed add-on is bundled with Vite, so the original source code is included for verification.

## Build Prerequisites

- Node.js 24
- Corepack available (bundled with Node.js 24)
- pnpm 11, activated through Corepack using the packageManager field from package.json

## Install Dependencies

\`\`\`bash
corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm install --frozen-lockfile
\`\`\`

## Rebuild the Submitted Firefox Extension

\`\`\`bash
${buildCommand}
\`\`\`

The generated Firefox extension is written to:

\`\`\`text
build/firefox/
\`\`\`

## License

This archive is provided under the terms in \`LICENSE.md\`. Bundled third-party
components keep their own licenses, listed in
\`licenses/privacything/THIRD_PARTY_NOTICES.md\`.

## Notes

- \`pnpm-lock.yaml\` is included to make dependency resolution reproducible.
- This archive is the complete tracked source tree at the released commit.
- Distributed beta and release builds intentionally omit sourcemaps from the packaged extension output.
`;
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status ?? 1}`);
  }
};

fs.mkdirSync(artifactsDir, { recursive: true });
fs.rmSync(archivePath, { force: true });
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), buildBrandTempDirPrefix("source")),
);
const tempArchivePath = path.join(tempDir, "source.zip");
const extractRoot = path.join(tempDir, "extract");
const extractPrefixDir = path.join(extractRoot, archivePrefix);

try {
  run("git", [
    "archive",
    "--format=zip",
    `--prefix=${archivePrefix}`,
    "--output",
    tempArchivePath,
    "HEAD",
  ]);

  fs.mkdirSync(extractRoot, { recursive: true });
  run("python3", [
    "-c",
    [
      "import os",
      "import sys",
      "import zipfile",
      "",
      "archive_path = os.path.abspath(sys.argv[1])",
      "extract_root = os.path.abspath(sys.argv[2])",
      "",
      "with zipfile.ZipFile(archive_path) as archive:",
      "    archive.extractall(extract_root)",
    ].join("\n"),
    tempArchivePath,
    extractRoot,
  ]);

  fs.writeFileSync(
    path.join(extractPrefixDir, "README.md"),
    renderReviewerReadme(metadata),
    "utf8",
  );

  run("python3", [
    "-c",
    [
      "import os",
      "import sys",
      "import zipfile",
      "",
      "source_dir = os.path.abspath(sys.argv[1])",
      "output_path = os.path.abspath(sys.argv[2])",
      "",
      "with zipfile.ZipFile(output_path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:",
      "    for root, _, files in os.walk(source_dir):",
      "        for name in sorted(files):",
      "            file_path = os.path.join(root, name)",
      "            archive.write(file_path, os.path.relpath(file_path, source_dir))",
    ].join("\n"),
    extractRoot,
    archivePath,
  ]);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

process.stdout.write(`${archivePath}\n`);
