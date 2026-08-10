/* global console, process */

import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, access, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { resolveBrandIconAssetDir } from "./brand-config.mjs";
import { resolveBuildMetadata } from "./resolve-build-metadata.mjs";

const [, , rawTarget = "chromium", rawOutDir] = process.argv;

if (!["chromium", "firefox"].includes(rawTarget)) {
  console.error(`Unsupported build target: ${rawTarget}`);
  process.exit(1);
}

const outDir =
  rawOutDir ?? (rawTarget === "firefox" ? "build/firefox" : "build/chrome");
const buildMetadata = resolveBuildMetadata();

// Stable per-build random salt shared across all Vite invocations so that
// anti-detection identifiers are consistent across entry-point bundles.
const buildSalt = randomBytes(80).toString("hex");
const thirdPartyNoticesPath = path.join(
  process.cwd(),
  "licenses",
  "privacything",
  "THIRD_PARTY_NOTICES.md",
);
const thirdPartyLicensesDir = path.join(process.cwd(), "licenses");
const projectLegalGenPath = path.join(
  process.cwd(),
  "scripts",
  "generate-legal-files.mjs",
);
const thirdPartyNoticesGenPath = path.join(
  process.cwd(),
  "scripts",
  "generate-third-party-notices.mjs",
);
const projectLegalFiles = [
  "LICENSE.md",
  "NOTICE.md",
  path.join("licenses", "privacything", "BRANDING.md"),
  path.join("licenses", "privacything", "COMMERCIAL_LICENSE.md"),
].map((relativePath) => path.join(process.cwd(), relativePath));

const listFilesRecursive = async (directoryPath) => {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
};

const ensureNonEmptyFiles = async (paths, missingMessage) => {
  const stats = await Promise.all(paths.map((filePath) => stat(filePath)));

  if (stats.some((entry) => entry.size === 0)) {
    throw new Error(missingMessage);
  }
};

const assertFilesMatch = async (actualPath, expectedPath, mismatchMessage) => {
  const [actualContent, expectedContent] = await Promise.all([
    readFile(actualPath, "utf8"),
    readFile(expectedPath, "utf8"),
  ]);

  if (actualContent !== expectedContent) {
    throw new Error(mismatchMessage);
  }
};

const assertFileSetMatches = async ({
  actualFiles,
  expectedFiles,
  mismatchMessage,
}) => {
  if (actualFiles.length !== expectedFiles.length) {
    throw new Error(mismatchMessage);
  }

  const actualByName = new Map(
    actualFiles.map((filePath) => [path.basename(filePath), filePath]),
  );
  const expectedByName = new Map(
    expectedFiles.map((filePath) => [path.basename(filePath), filePath]),
  );

  if (actualByName.size !== expectedByName.size) {
    throw new Error(mismatchMessage);
  }

  await Promise.all(
    [...actualByName.entries()].map(async ([fileName, actualPath]) => {
      const expectedPath = expectedByName.get(fileName);

      if (!expectedPath) {
        throw new Error(mismatchMessage);
      }

      await assertFilesMatch(actualPath, expectedPath, mismatchMessage);
    }),
  );
};

const runNodeScript = (scriptPath, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: "pipe",
      env: process.env,
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          stderr.trim() || `${path.basename(scriptPath)} exited with code ${code ?? 1}`,
        ),
      );
    });
  });

const ensureThirdPartyNotices = async () => {
  try {
    await access(thirdPartyNoticesPath);
    await access(thirdPartyLicensesDir);
  } catch {
    throw new Error(
      "Missing generated third-party notices or licenses/. Run `pnpm task generate:legal` before building.",
    );
  }

  const licenseFiles = await listFilesRecursive(thirdPartyLicensesDir);
  const licenseTextFiles = licenseFiles.filter((filePath) => filePath.endsWith(".txt"));

  if (licenseTextFiles.length === 0) {
    throw new Error(
      "The licenses/ directory is empty. Run `pnpm task generate:legal` before building.",
    );
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "privacything-legal-check-"));

  try {
    const expectedOutputPath = path.join(
      tempRoot,
      "licenses",
      "privacything",
      "THIRD_PARTY_NOTICES.md",
    );
    const expectedLicensesDir = path.join(tempRoot, "licenses");

    await runNodeScript(thirdPartyNoticesGenPath, [
      "--output",
      expectedOutputPath,
      "--licenses-dir",
      expectedLicensesDir,
      "--licenses-embed-path",
      "licenses",
      "--no-legacy-cleanup",
    ]);

    const expectedLicenseFiles = (await listFilesRecursive(expectedLicensesDir)).filter(
      (filePath) => filePath.endsWith(".txt"),
    );

    if (expectedLicenseFiles.length === 0) {
      throw new Error(
        "Generated third-party notices or licenses/ are older than package/generator inputs. Run `pnpm task generate:legal` before building.",
      );
    }

    await assertFilesMatch(
      thirdPartyNoticesPath,
      expectedOutputPath,
      "Generated third-party notices or licenses/ are older than package/generator inputs. Run `pnpm task generate:legal` before building.",
    );
    await assertFileSetMatches({
      actualFiles: licenseTextFiles,
      expectedFiles: expectedLicenseFiles,
      mismatchMessage:
        "Generated third-party notices or licenses/ are older than package/generator inputs. Run `pnpm task generate:legal` before building.",
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};

const ensureProjectLegalFiles = async () => {
  try {
    await Promise.all(projectLegalFiles.map((filePath) => access(filePath)));
  } catch {
    throw new Error(
      "Missing generated project legal files. Run `pnpm task generate:legal` before building.",
    );
  }

  await ensureNonEmptyFiles(
    projectLegalFiles,
    "Generated project legal files are empty. Run `pnpm task generate:legal` before building.",
  );

  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "privacything-project-legal-check-"),
  );

  try {
    await runNodeScript(projectLegalGenPath, ["--output-root", tempRoot]);

    await Promise.all(
      projectLegalFiles.map(async (actualPath) => {
        const expectedPath = path.join(
          tempRoot,
          path.relative(process.cwd(), actualPath),
        );
        await assertFilesMatch(
          actualPath,
          expectedPath,
          "Generated project legal files are older than their templates. Run `pnpm task generate:legal` before building.",
        );
      }),
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};

const ensureUiLegalFiles = async () => {
  await ensureProjectLegalFiles();
  await ensureThirdPartyNotices();
};

const copyLegalArtifacts = async () => {
  await ensureUiLegalFiles();

  const noticesDestination = path.join(
    process.cwd(),
    outDir,
    "licenses",
    "privacything",
    "THIRD_PARTY_NOTICES.md",
  );
  const licensesDestination = path.join(process.cwd(), outDir, "licenses");
  const legacyLegalDestinations = [
    path.join(process.cwd(), outDir, "THIRD_PARTY_NOTICES.md"),
    path.join(process.cwd(), outDir, "COMERCIAL_LICENSE.md"),
    path.join(process.cwd(), outDir, "COMMERCIAL_LICENSE.md"),
    path.join(process.cwd(), outDir, "NOTICE.md"),
    path.join(process.cwd(), outDir, "BRANDING.md"),
  ];

  await Promise.all(
    legacyLegalDestinations.map((destinationPath) =>
      rm(destinationPath, { force: true }),
    ),
  );
  await rm(noticesDestination, { force: true });
  await rm(licensesDestination, { recursive: true, force: true });
  await cp(thirdPartyNoticesPath, noticesDestination, { force: true });
  await cp(thirdPartyLicensesDir, licensesDestination, {
    force: true,
    recursive: true,
  });

  await Promise.all(
    projectLegalFiles.map(async (filePath) => {
      const destinationPath = path.join(
        process.cwd(),
        outDir,
        path.relative(process.cwd(), filePath),
      );
      await rm(destinationPath, { force: true });
      await cp(filePath, destinationPath, { force: true });
    }),
  );
};

const overlayBetaIcons = async () => {
  const iconAssetDir = resolveBrandIconAssetDir(buildMetadata.channel);

  if (iconAssetDir === "icons") {
    return;
  }

  const sourceDir = path.join(process.cwd(), "public", iconAssetDir);
  const destinationDir = path.join(process.cwd(), outDir, "icons");

  try {
    await access(sourceDir);
  } catch {
    throw new Error(`Missing beta icon asset directory: ${sourceDir}`);
  }

  await cp(sourceDir, destinationDir, {
    force: true,
    recursive: true,
  });
};

const runViteBuild = (extraEnv = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "vite", "build", "--config", "config/vite.config.ts"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          PT_BROWSER_TARGET: rawTarget,
          PT_OUT_DIR: outDir,
          PT_BUILD_CHANNEL: buildMetadata.channel,
          PT_BUILD_TIMESTAMP: buildMetadata.buildTimestamp,
          PT_RELEASE_VERSION: buildMetadata.releaseVersion,
          PT_DISPLAY_VERSION: buildMetadata.displayVersion,
          PT_MANIFEST_VERSION: buildMetadata.manifestVersion,
          PT_ARTIFACT_VERSION_LABEL: buildMetadata.artifactVersionLabel,
          PT_BUILD_SALT: buildSalt,
          ...extraEnv,
        },
      },
    );

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`vite build exited with code ${code ?? 1}`));
    });
  });

try {
  await ensureUiLegalFiles();

  await runViteBuild({
    PT_LOG_BUILD_IDS: process.env.CI ? "false" : "true",
  });

  if (rawTarget === "chromium") {
    const chromiumExtraEntries = [
      "chromium-content-bootstrap",
      "chromium-main-early",
      "chromium-main-runtime",
    ];

    for (const extraEntry of chromiumExtraEntries) {
      await runViteBuild({
        PT_EXTRA_ENTRY: extraEntry,
        PT_EMPTY_OUT_DIR: "false",
        PT_LOG_BUILD_IDS: "false",
      });
    }
  }

  if (rawTarget === "firefox") {
    const firefoxExtraEntries = [
      "chromium-content-bootstrap",
      "firefox-main-runtime",
      "firefox-main-early",
    ];

    if ((process.env.PT_FIREFOX_RUNTIME_TEST_HOST ?? "").trim()) {
      firefoxExtraEntries.push("firefox-timing-spike");
    }

    for (const extraEntry of firefoxExtraEntries) {
      await runViteBuild({
        PT_EXTRA_ENTRY: extraEntry,
        PT_EMPTY_OUT_DIR: "false",
        PT_LOG_BUILD_IDS: "false",
      });
    }
  }

  await overlayBetaIcons();
  await copyLegalArtifacts();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
