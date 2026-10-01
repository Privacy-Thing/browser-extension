#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveChromeExecutable } from "./resolve-chrome.mjs";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(skillRoot, "../../..");
const chromeRoot = path.join(repoRoot, "build", "chrome");
const manifestPath = path.join(chromeRoot, "manifest.json");

const deriveChromiumExtId = (extensionPath) => {
  const idBytes = createHash("sha256").update(extensionPath).digest().subarray(0, 16);
  return Array.from(
    idBytes,
    (byte) =>
      `${String.fromCharCode(97 + (byte >> 4))}${String.fromCharCode(97 + (byte & 0x0f))}`,
  ).join("");
};

const fail = (message) => {
  console.error(`[verify-privacything doctor] ${message}`);
  process.exit(1);
};

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (!Number.isFinite(nodeMajor) || nodeMajor < 24) {
  fail(`Node 24+ required, found ${process.versions.node}.`);
}

const packageJsonPath = path.join(repoRoot, "package.json");
if (!existsSync(packageJsonPath)) {
  fail(`Missing ${packageJsonPath}.`);
}

if (!existsSync(path.join(repoRoot, "node_modules"))) {
  fail("node_modules is missing. Run pnpm install --frozen-lockfile.");
}

try {
  execFileSync("pnpm", ["-v"], { cwd: repoRoot, stdio: "pipe" });
} catch {
  fail("pnpm is not runnable. Enable Corepack or install pnpm 11.");
}

if (!existsSync(manifestPath)) {
  fail("build/chrome/manifest.json is missing. Run pnpm task build:chrome.");
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(
    `Could not parse manifest: ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (manifest.manifest_version !== 3) {
  fail(`Expected manifest_version 3, found ${String(manifest.manifest_version)}.`);
}

const requiredPages = [
  "src/ui/popup/index.html",
  "src/ui/options/index.html",
  "src/ui/sidebar/index.html",
];
for (const relative of requiredPages) {
  const pagePath = path.join(chromeRoot, relative);
  if (!existsSync(pagePath)) {
    fail(`Missing ${pagePath}. Rebuild with pnpm task build:chrome.`);
  }
}

const extensionId = deriveChromiumExtId(chromeRoot);
const versionName = manifest.version_name ?? manifest.version ?? "(unknown)";
let chromeExecutable;
try {
  chromeExecutable = resolveChromeExecutable();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

console.log("[verify-privacything doctor] ok");
console.log(`repo: ${repoRoot}`);
console.log(`build: ${chromeRoot}`);
console.log(`version_name: ${versionName}`);
console.log(`extension_id: ${extensionId}`);
console.log(`chrome: ${chromeExecutable}`);
console.log(
  "profile_rule: use build/agent-profiles/<task>/ or the drive helper temp dir; never the operator Default profile",
);
