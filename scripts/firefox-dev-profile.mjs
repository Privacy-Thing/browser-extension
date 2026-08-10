/* global console, process */

import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { resolveRequiredFxBinary } from "./firefox-binary.mjs";
import { resolveBuildMetadata } from "./resolve-build-metadata.mjs";

const args = new Set(process.argv.slice(2));
const launchOnly = args.has("--launch-only");
const watchOnly = args.has("--watch-only");

if (launchOnly && watchOnly) {
  console.error("Use either --launch-only or --watch-only, not both.");
  process.exit(1);
}

const cwd = process.cwd();
const outDir = path.resolve(cwd, "build/firefox");
const firefoxProfile = path.resolve(
  cwd,
  process.env.PT_FIREFOX_PROFILE ?? "build/web-ext-profile/firefox",
);
const buildMetadata = resolveBuildMetadata();
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const buildSalt = process.env.PT_BUILD_SALT ?? randomBytes(80).toString("hex");
const watchBuilds = [
  {
    label: "firefox-main",
    extraEnv: {
      PT_EMPTY_OUT_DIR: "false",
    },
  },
  {
    label: "firefox-main-runtime",
    extraEnv: {
      PT_EXTRA_ENTRY: "firefox-main-runtime",
      PT_EMPTY_OUT_DIR: "false",
    },
  },
  {
    label: "firefox-main-early",
    extraEnv: {
      PT_EXTRA_ENTRY: "firefox-main-early",
      PT_EMPTY_OUT_DIR: "false",
    },
  },
];

let activeChildren = [];
let shuttingDown = false;
const buildEnv = {
  ...process.env,
  PT_BROWSER_TARGET: "firefox",
  PT_OUT_DIR: "build/firefox",
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
  console.log("[firefox-dev] starting Vite watch mode for Firefox bundles...");

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
            console.log(`[firefox-dev] ${watchBuild.label} initial build ready.`);
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
            `[firefox-dev] ${watchBuild.label} watcher exited with code ${code ?? 1}.`,
          );
          shutdown(code ?? 1);
        });
      }),
  );

  await Promise.all(initialBuilds);
  console.log("[firefox-dev] initial Firefox watch build is ready.");
};

const startFirefox = async () => {
  const firefoxBinary = await resolveRequiredFxBinary("Firefox dev/start workflow");
  console.log(
    `[firefox-dev] launching Firefox with profile ${path.relative(cwd, firefoxProfile)}`,
  );
  const child = spawnChild(pnpmCommand, [
    "exec",
    "web-ext",
    "run",
    "--source-dir",
    outDir,
    "--firefox",
    firefoxBinary,
    "--firefox-profile",
    firefoxProfile,
    "--profile-create-if-missing",
    "--keep-profile-changes",
    "--no-input",
  ]);

  child.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }

    shutdown(code ?? 0);
  });
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

try {
  await mkdir(firefoxProfile, { recursive: true });
  await startViteWatchers();
} catch (error) {
  console.error(
    `[firefox-dev] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

if (!watchOnly) {
  try {
    await startFirefox();
  } catch (error) {
    console.error(
      `[firefox-dev] ${error instanceof Error ? error.message : String(error)}`,
    );
    shutdown(1);
  }
}
