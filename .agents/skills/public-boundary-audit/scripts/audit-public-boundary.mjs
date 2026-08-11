#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../../..");
const strict = process.argv.includes("--strict");
const retiredName = ["geo", "warp"].join("");
const retiredNamePattern = new RegExp(retiredName, "gi");
const EXPECTED_RETIRED_HITS = 4;

const findings = [];

const addFinding = (level, check, message) => {
  findings.push({ level, check, message });
};

const readRepositoryFile = (relativePath) =>
  readFileSync(path.join(repositoryRoot, relativePath), "utf8");

const readJson = (relativePath) => JSON.parse(readRepositoryFile(relativePath));

const countRetiredNameHits = (value) =>
  [...String(value).matchAll(new RegExp(retiredName, "gi"))].length;

const versionableFiles = () => {
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );

  return output
    .split("\0")
    .filter(Boolean)
    .filter((relativePath) => existsSync(path.join(repositoryRoot, relativePath)));
};

const checkClaudeSkillsLink = () => {
  const linkPath = path.join(repositoryRoot, ".claude/skills");
  if (!existsSync(linkPath) || !lstatSync(linkPath).isSymbolicLink()) {
    addFinding("error", "agent-skills", ".claude/skills is not a symbolic link");
    return;
  }

  const target = readlinkSync(linkPath);
  if (target !== "../.agents/skills") {
    addFinding(
      "error",
      "agent-skills",
      `.claude/skills points to ${JSON.stringify(target)}, expected ../.agents/skills`,
    );
  }
};

const checkPackageMetadata = () => {
  const manifest = readJson("package.json");
  const repositoryUrl =
    typeof manifest.repository === "object"
      ? manifest.repository?.url
      : manifest.repository;

  if (
    typeof repositoryUrl !== "string" ||
    !repositoryUrl.toLowerCase().includes("privacy-thing/browser-extension")
  ) {
    addFinding(
      "warning",
      "repository-url",
      `package.json repository does not point at Privacy-Thing/browser-extension: ${String(repositoryUrl)}`,
    );
  }

  const packageManager = String(manifest.packageManager ?? "");
  const packageManagerMajor = packageManager.match(/^pnpm@(\d+)/)?.[1];
  const readmePnpmMajor = readRepositoryFile("README.md").match(/pnpm\s+(\d+)/i)?.[1];

  if (
    packageManagerMajor &&
    readmePnpmMajor &&
    packageManagerMajor !== readmePnpmMajor
  ) {
    addFinding(
      "warning",
      "pnpm-version",
      `README requires pnpm ${readmePnpmMajor}, packageManager pins pnpm ${packageManagerMajor}`,
    );
  }
};

const checkPlaywrightImages = () => {
  const workspace = readRepositoryFile("pnpm-workspace.yaml");
  const overrideVersion = (packageName) => {
    const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return workspace.match(
      new RegExp(`^\\s*["']?${escapedName}["']?\\s*:\\s*([^\\s#]+)`, "m"),
    )?.[1];
  };
  const pinnedVersions = [
    overrideVersion("@playwright/test"),
    overrideVersion("playwright"),
    overrideVersion("playwright-core"),
  ];

  if (pinnedVersions.some((version) => !version)) {
    addFinding(
      "error",
      "playwright-override",
      "pnpm-workspace.yaml must pin @playwright/test, playwright and playwright-core",
    );
    return;
  }

  const [expected] = pinnedVersions;
  if (new Set(pinnedVersions).size !== 1) {
    addFinding(
      "error",
      "playwright-override",
      `Playwright overrides disagree: ${pinnedVersions.join(", ")}`,
    );
    return;
  }

  const workflowFiles = versionableFiles().filter((file) =>
    /^\.github\/workflows\/.*\.ya?ml$/.test(file),
  );

  for (const workflowFile of workflowFiles) {
    const workflow = readRepositoryFile(workflowFile);
    const imageVersions = new Set(
      [...workflow.matchAll(/mcr\.microsoft\.com\/playwright:v([^\s-]+)-/g)].map(
        (match) => match[1],
      ),
    );

    for (const actual of imageVersions) {
      if (actual !== expected) {
        addFinding(
          "error",
          "playwright-image",
          `${workflowFile} uses Playwright ${actual}, pnpm-workspace.yaml pins ${expected}`,
        );
      }
    }
  }
};

const stripYamlComments = (source) =>
  source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

const permissionWrites = (workflow) => {
  const lines = workflow.split("\n");
  const writes = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const permissions = line.match(/^(\s*)permissions\s*:\s*(\S+)?\s*$/);
    if (!permissions) continue;

    const [, indentation, inlineValue] = permissions;
    if (inlineValue === "write-all") writes.push("write-all");
    if (inlineValue) continue;

    for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
      const child = lines[childIndex];
      if (!child.trim()) continue;
      const childIndentation = child.match(/^\s*/)?.[0].length ?? 0;
      if (childIndentation <= indentation.length) break;

      const writePermission = child.match(/^\s*([a-z-]+)\s*:\s*write\s*$/);
      if (writePermission) writes.push(writePermission[1]);
    }
  }

  return writes;
};

const checkCiWorkflow = () => {
  const relativePath = ".github/workflows/ci.yml";
  if (!existsSync(path.join(repositoryRoot, relativePath))) {
    addFinding("error", "ci-workflow", `${relativePath} is missing`);
    return;
  }

  const workflow = stripYamlComments(readRepositoryFile(relativePath));
  const forbidden = [
    [/(^|\n)\s*pull_request_target\s*:/, "pull_request_target"],
    [/runs-on\s*:\s*(?:\[[^\]]*self-hosted|self-hosted)/, "self-hosted runner"],
    [/(^|\n)\s*environment\s*:/, "GitHub environment"],
  ];

  for (const [pattern, label] of forbidden) {
    if (pattern.test(workflow)) {
      addFinding("error", "ci-workflow", `${relativePath} uses forbidden ${label}`);
    }
  }

  if (!/(^|\n)\s*pull_request\s*:/.test(workflow)) {
    addFinding("error", "ci-workflow", `${relativePath} does not handle pull_request`);
  }

  const secretNames = [
    ...workflow.matchAll(/\bsecrets\.([A-Za-z_][A-Za-z0-9_]*)/g),
  ].map((match) => match[1]);
  const forbiddenSecrets = [...new Set(secretNames)].filter(
    (secretName) => secretName !== "GITHUB_TOKEN",
  );
  if (forbiddenSecrets.length > 0 || /\bsecrets\s*\[/.test(workflow)) {
    addFinding(
      "error",
      "ci-workflow",
      `${relativePath} uses forbidden repository secrets: ${forbiddenSecrets.join(", ") || "dynamic lookup"}`,
    );
  }

  const writes = permissionWrites(workflow);
  if (writes.length > 0) {
    addFinding(
      "error",
      "ci-workflow",
      `${relativePath} grants write permissions: ${[...new Set(writes)].join(", ")}`,
    );
  }
};

const checkMetadataRefresh = () => {
  const relativePath = ".github/workflows/refresh-metadata.yml";
  if (!existsSync(path.join(repositoryRoot, relativePath))) {
    addFinding("error", "metadata-refresh-workflow", `${relativePath} is missing`);
    return;
  }

  const lines = stripYamlComments(readRepositoryFile(relativePath)).split("\n");
  const resolveIndex = lines.findIndex((line) => line === "  resolve:");
  if (resolveIndex === -1) {
    addFinding(
      "error",
      "metadata-refresh-workflow",
      `${relativePath} is missing the resolve job`,
    );
    return;
  }

  const nextJobOffset = lines
    .slice(resolveIndex + 1)
    .findIndex((line) => /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line));
  const resolveEnd =
    nextJobOffset === -1 ? lines.length : resolveIndex + 1 + nextJobOffset;
  const resolveJob = lines.slice(resolveIndex + 1, resolveEnd);
  const requiredGate = "if: ${{ vars.METADATA_REFRESH_ENABLED == 'true' }}";

  if (!resolveJob.some((line) => line.trim() === requiredGate)) {
    addFinding(
      "error",
      "metadata-refresh-workflow",
      `${relativePath} resolve job is missing the default-deny ${requiredGate} gate`,
    );
  }
};

const checkTrackedSecrets = () => {
  const secretPatterns = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key material"],
    [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key identifier"],
  ];

  for (const relativePath of versionableFiles()) {
    if (
      /\.env(?:\.|$)/.test(path.basename(relativePath)) &&
      relativePath !== ".env.example"
    ) {
      addFinding(
        "error",
        "tracked-secret",
        `${relativePath} is a tracked environment file`,
      );
    }

    let source;
    try {
      source = readRepositoryFile(relativePath);
    } catch {
      continue;
    }

    for (const [pattern, label] of secretPatterns) {
      if (pattern.test(source)) {
        addFinding("error", "tracked-secret", `${relativePath} contains ${label}`);
      }
    }
  }
};

const buildAllowedRetiredLines = () => {
  const brand = readJson("config/brand-config.json");
  const notifications = readJson("src/shared/extension-notifications.json");
  const renameNotice = notifications.notifications?.find(
    (notification) => notification.id === "privacy-thing-rename",
  );
  const stableId = brand.channels?.stable?.firefoxExtensionId;
  const betaId = brand.channels?.beta?.firefoxExtensionId;
  const renameTitle = renameNotice?.title?.en;
  const renameParagraph = renameNotice?.message?.en?.[0];
  const requiredValues = [
    ["stable Firefox extension id", stableId],
    ["beta Firefox extension id", betaId],
    ["rename notification title", renameTitle],
    ["rename notification paragraph", renameParagraph],
  ];

  for (const [label, value] of requiredValues) {
    if (typeof value !== "string" || countRetiredNameHits(value) !== 1) {
      addFinding(
        "error",
        "retired-name-allowlist",
        `${label} must contain the retired name exactly once`,
      );
    }
  }

  if (!Array.isArray(renameNotice?.message?.en) || renameNotice.message.en.length < 1) {
    addFinding(
      "error",
      "retired-name-allowlist",
      "privacy-thing-rename notification is missing its first English paragraph",
    );
  }

  const exactLines = new Map([
    [
      "config/brand-config.json",
      new Set([
        `"firefoxExtensionId": ${JSON.stringify(stableId)},`,
        `"firefoxExtensionId": ${JSON.stringify(betaId)},`,
      ]),
    ],
    [
      "src/shared/extension-notifications.json",
      new Set([
        `"en": ${JSON.stringify(renameTitle)}`,
        `${JSON.stringify(renameParagraph)},`,
      ]),
    ],
  ]);

  return exactLines;
};

const checkRetiredNameBoundary = () => {
  const allowedLines = buildAllowedRetiredLines();
  const hitCounts = new Map();
  let totalHits = 0;

  for (const relativePath of versionableFiles()) {
    if (retiredNamePattern.test(relativePath)) {
      addFinding(
        "error",
        "retired-name-filename",
        `${relativePath} contains the retired name`,
      );
    }
    retiredNamePattern.lastIndex = 0;

    let source;
    try {
      source = readRepositoryFile(relativePath);
    } catch {
      continue;
    }

    const lines = source.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const matches = [...line.matchAll(new RegExp(retiredName, "gi"))];
      if (matches.length === 0) continue;

      totalHits += matches.length;
      hitCounts.set(relativePath, (hitCounts.get(relativePath) ?? 0) + matches.length);
      const allowed = allowedLines.get(relativePath)?.has(line.trim()) === true;
      if (!allowed || matches.length !== 1) {
        addFinding(
          "error",
          "retired-name-source",
          `${relativePath}:${index + 1}: ${line.trim()}`,
        );
      }
    }
  }

  const expectedCounts = new Map([
    ["config/brand-config.json", 2],
    ["src/shared/extension-notifications.json", 2],
  ]);
  for (const [relativePath, expected] of expectedCounts) {
    const actual = hitCounts.get(relativePath) ?? 0;
    if (actual !== expected) {
      addFinding(
        "error",
        "retired-name-count",
        `${relativePath} has ${actual} retired-name hit(s), expected ${expected}`,
      );
    }
  }

  if (hitCounts.size !== expectedCounts.size || totalHits !== EXPECTED_RETIRED_HITS) {
    addFinding(
      "error",
      "retired-name-count",
      `found ${totalHits} hit(s) in ${hitCounts.size} file(s), expected ${EXPECTED_RETIRED_HITS} in ${expectedCounts.size}`,
    );
  }
};

checkClaudeSkillsLink();
checkPackageMetadata();
checkPlaywrightImages();
checkCiWorkflow();
checkMetadataRefresh();
checkTrackedSecrets();
checkRetiredNameBoundary();

if (findings.length === 0) {
  process.stdout.write("Public boundary audit: no mechanical findings.\n");
  process.exit(0);
}

for (const finding of findings) {
  process.stdout.write(
    `${finding.level.toUpperCase()} [${finding.check}] ${finding.message}\n`,
  );
}

const errors = findings.filter((finding) => finding.level === "error").length;
const warnings = findings.length - errors;
process.stdout.write(
  `Public boundary audit: ${errors} error(s), ${warnings} warning(s).\n`,
);

if (errors > 0 || (strict && warnings > 0)) process.exitCode = 1;
