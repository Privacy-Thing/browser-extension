/* global console, process */

import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";

import { chromium } from "@playwright/test";

import { resolveBuildMetadata } from "./resolve-build-metadata.mjs";

const args = new Set(process.argv.slice(2));
const launchOnly = args.has("--launch-only");
const watchOnly = args.has("--watch-only");

if (launchOnly && watchOnly) {
  console.error("Use either --launch-only or --watch-only, not both.");
  process.exit(1);
}

const cwd = process.cwd();
const extensionPath = path.resolve(cwd, "build/chrome");
const userDataDir = path.resolve(
  cwd,
  process.env.PT_CHROME_PROFILE ?? "build/chrome-profile",
);
const chromeDefaultProfileDir = path.join(userDataDir, "Default");
const chromePreferencesPath = path.join(chromeDefaultProfileDir, "Preferences");
const executablePath =
  process.env.CHROME_EXECUTABLE_PATH ?? process.env.PT_CHROME_BINARY;
const channel = process.env.PT_CHROME_CHANNEL ?? "chromium";
const buildMetadata = resolveBuildMetadata();
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const buildSalt = process.env.PT_BUILD_SALT ?? randomBytes(80).toString("hex");
const watchBuilds = [
  {
    label: "chromium-main",
    extraEnv: {
      PT_EMPTY_OUT_DIR: "false",
    },
  },
  {
    label: "chromium-content-bootstrap",
    extraEnv: {
      PT_EXTRA_ENTRY: "chromium-content-bootstrap",
      PT_EMPTY_OUT_DIR: "false",
    },
  },
  {
    label: "chromium-main-early",
    extraEnv: {
      PT_EXTRA_ENTRY: "chromium-main-early",
      PT_EMPTY_OUT_DIR: "false",
    },
  },
  {
    label: "chromium-main-runtime",
    extraEnv: {
      PT_EXTRA_ENTRY: "chromium-main-runtime",
      PT_EMPTY_OUT_DIR: "false",
    },
  },
];

let activeChildren = [];
let shuttingDown = false;
const buildEnv = {
  ...process.env,
  PT_BROWSER_TARGET: "chromium",
  PT_OUT_DIR: "build/chrome",
  PT_BUILD_CHANNEL: buildMetadata.channel,
  PT_BUILD_TIMESTAMP: buildMetadata.buildTimestamp,
  PT_RELEASE_VERSION: buildMetadata.releaseVersion,
  PT_DISPLAY_VERSION: buildMetadata.displayVersion,
  PT_MANIFEST_VERSION: buildMetadata.manifestVersion,
  PT_ARTIFACT_VERSION_LABEL: buildMetadata.artifactVersionLabel,
  PT_BUILD_SALT: buildSalt,
};

const spawnChild = (command, commandArgs, env = process.env, pipeOutput = false) => {
  const child = spawn(command, commandArgs, {
    cwd,
    stdio: pipeOutput ? ["inherit", "pipe", "pipe"] : "inherit",
    env,
  });

  activeChildren.push(child);
  child.on("exit", () => {
    activeChildren = activeChildren.filter((entry) => entry !== child);
  });

  return child;
};

const startViteWatchers = async () => {
  console.log("[chrome-dev] starting Vite watch mode for Chromium bundles...");

  const initialBuilds = watchBuilds.map(
    (watchBuild) =>
      new Promise((resolve, reject) => {
        let initialBuildDone = false;
        let stdoutBuffer = "";

        const child = spawnChild(
          pnpmCommand,
          ["exec", "vite", "build", "--config", "config/vite.config.ts", "--watch"],
          {
            ...buildEnv,
            ...watchBuild.extraEnv,
          },
          true,
        );

        child.stdout?.on("data", (chunk) => {
          const text = chunk.toString();
          process.stdout.write(text);
          stdoutBuffer += text;

          if (!initialBuildDone && stdoutBuffer.includes("built in ")) {
            initialBuildDone = true;
            console.log(`[chrome-dev] ${watchBuild.label} initial build ready.`);
            resolve();
          }

          if (stdoutBuffer.length > 8_000) {
            stdoutBuffer = stdoutBuffer.slice(-4_000);
          }
        });

        child.stderr?.on("data", (chunk) => {
          process.stderr.write(chunk);
        });

        child.on("exit", (code) => {
          if (shuttingDown) {
            return;
          }

          if (!initialBuildDone) {
            reject(
              new Error(
                `${watchBuild.label} watcher exited before initial build with code ${code ?? 1}.`,
              ),
            );
            return;
          }

          console.error(
            `[chrome-dev] ${watchBuild.label} watcher exited with code ${code ?? 1}.`,
          );
          shutdown(code ?? 1);
        });
      }),
  );

  await Promise.all(initialBuilds);
  console.log("[chrome-dev] initial Chromium watch build is ready.");
};

const ensureDevModeEnabled = async () => {
  await mkdir(chromeDefaultProfileDir, { recursive: true });

  let preferences = {};
  try {
    preferences = JSON.parse(await readFile(chromePreferencesPath, "utf8"));
  } catch (error) {
    if (
      (error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT") === false
    ) {
      throw error;
    }
  }

  const nextPreferences = {
    ...preferences,
    extensions: {
      ...(typeof preferences.extensions === "object" && preferences.extensions !== null
        ? preferences.extensions
        : {}),
      ui: {
        ...(typeof preferences.extensions?.ui === "object" &&
        preferences.extensions.ui !== null
          ? preferences.extensions.ui
          : {}),
        developer_mode: true,
      },
    },
  };

  await writeFile(
    chromePreferencesPath,
    `${JSON.stringify(nextPreferences, null, 2)}\n`,
    "utf8",
  );
};

const launch = async () => {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    ...(executablePath ? { executablePath } : { channel }),
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const extensionWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(extensionWorker.url()).host;

    console.log(
      `[chrome-dev] loaded Privacy Thing ${buildMetadata.displayVersion} as extension ${extensionId}`,
    );
    console.log(
      "[chrome-dev] rebuilds will update build/chrome; reload the extension in chrome://extensions to apply them.",
    );

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
    console.log("[chrome-dev] opened extension options page.");

    await new Promise((resolve) => {
      context.once("close", resolve);
    });
  } finally {
    await context.close().catch(() => undefined);
  }
};

const shutdown = (code = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of activeChildren) {
    if (typeof child.kill === "function") {
      child.kill("SIGTERM");
    }
  }

  globalThis
    .setTimeout(() => {
      for (const child of activeChildren) {
        if (typeof child.kill === "function" && child.exitCode === null) {
          child.kill("SIGKILL");
        }
      }
    }, 1_000)
    .unref();

  globalThis.setTimeout(() => process.exit(code), 25);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

await mkdir(userDataDir, { recursive: true });
await ensureDevModeEnabled();

if (!launchOnly) {
  try {
    await startViteWatchers();
  } catch (error) {
    console.error(
      `[chrome-dev] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

if (!watchOnly) {
  try {
    await launch();
  } catch (error) {
    console.error(
      `[chrome-dev] ${error instanceof Error ? error.message : String(error)}`,
    );
    shutdown(1);
  }
}
