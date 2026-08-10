import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { buildArtifactFileName } from "./brand-config.mjs";

const [, , rawTarget] = process.argv;

if (!["chromium", "firefox"].includes(rawTarget)) {
  throw new Error("Use target chromium or firefox");
}

const artifactsDir = path.resolve("build", "artifacts");
const chromiumDistDir = path.resolve("build/chrome");
const firefoxDistDir = path.resolve("build/firefox");

fs.mkdirSync(artifactsDir, { recursive: true });

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with code ${result.status ?? 1}`,
    );
  }
};

const resolvePnpmCommand = () => (process.platform === "win32" ? "pnpm.cmd" : "pnpm");

const zipDirectory = (directory, filename) => {
  const outputPath = path.resolve(artifactsDir, filename);
  fs.rmSync(outputPath, { force: true });
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
    path.resolve(directory),
    outputPath,
  ]);
};

const readArtifactVersionLabel = (directory) => {
  const manifestPath = path.resolve(directory, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const versionName = String(manifest.version_name ?? "").trim();
  const version = String(manifest.version ?? "").trim();

  if (versionName) {
    return versionName;
  }

  if (version) {
    return `v${version}`;
  }

  throw new Error(`Missing version metadata in ${manifestPath}`);
};

const packageFirefoxXpi = () => {
  const versionLabel = readArtifactVersionLabel(firefoxDistDir);
  run(resolvePnpmCommand(), [
    "exec",
    "web-ext",
    "build",
    "--source-dir",
    firefoxDistDir,
    "--artifacts-dir",
    artifactsDir,
    "--filename",
    buildArtifactFileName(versionLabel, "firefox", "xpi"),
    "--overwrite-dest",
    "--no-input",
  ]);
};

if (rawTarget === "chromium") {
  zipDirectory(
    chromiumDistDir,
    buildArtifactFileName(readArtifactVersionLabel(chromiumDistDir), "chromium", "zip"),
  );
}

if (rawTarget === "firefox") {
  zipDirectory(
    firefoxDistDir,
    buildArtifactFileName(readArtifactVersionLabel(firefoxDistDir), "firefox", "zip"),
  );
  packageFirefoxXpi();
}
