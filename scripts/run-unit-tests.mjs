import { constants as osConstants } from "node:os";
import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const SHUTDOWN_GRACE_MS = 5000;

const parseArgs = (argv) => {
  const forwardedArgs = [];
  let coverageEnabled = false;

  for (const arg of argv) {
    if (arg === "--coverage") {
      coverageEnabled = true;
      continue;
    }

    forwardedArgs.push(arg);
  }

  return {
    coverageEnabled,
    forwardedArgs,
  };
};

const getSignalExitCode = (signal) => {
  if (!signal) {
    return 1;
  }

  return 128 + (osConstants.signals[signal] ?? 0);
};

const buildVitestArgs = (configPath, forwardedArgs, coverageEnabled) => [
  "exec",
  "vitest",
  "run",
  "--config",
  configPath,
  ...(coverageEnabled ? ["--coverage.enabled", "true"] : []),
  ...forwardedArgs,
];

const sendSignalToChild = (pid, signal) => {
  if (pid == null) {
    return false;
  }

  try {
    process.kill(process.platform === "win32" ? pid : -pid, signal);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ESRCH"
    ) {
      return false;
    }

    throw error;
  }
};

const isChildAlive = (pid) => {
  if (pid == null) {
    return false;
  }

  try {
    process.kill(process.platform === "win32" ? pid : -pid, 0);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ESRCH"
    ) {
      return false;
    }

    throw error;
  }
};

const spawnVitestRun = (label, configPath, forwardedArgs, coverageEnabled) => {
  const child = spawn(
    pnpmCommand,
    buildVitestArgs(configPath, forwardedArgs, coverageEnabled),
    {
      stdio: "inherit",
      detached: process.platform !== "win32",
      env: process.env,
    },
  );

  const run = {
    label,
    child,
    pid: child.pid ?? null,
    exited: false,
    exitCode: null,
    exitSignal: null,
    completed: null,
  };

  run.completed = new Promise((resolve, reject) => {
    child.once("error", (error) => {
      run.exited = true;
      reject(error);
    });

    child.once("exit", (code, signal) => {
      run.exited = true;
      run.exitCode = code;
      run.exitSignal = signal;
      resolve(run);
    });
  });

  return run;
};

const { coverageEnabled, forwardedArgs } = parseArgs(process.argv.slice(2));
const runs = [
  {
    label: coverageEnabled ? "neutral coverage" : "neutral",
    configPath: "config/vitest.config.neutral.ts",
  },
  {
    label: coverageEnabled ? "chromium coverage" : "chromium",
    configPath: "config/vitest.config.chromium.ts",
  },
  {
    label: coverageEnabled ? "firefox coverage" : "firefox",
    configPath: "config/vitest.config.firefox.ts",
  },
];

let currentRun = null;
let cleaningUp = false;
let shutdownRequested = false;

const cleanupRun = async (run, { force = false } = {}) => {
  if (!run || run.pid == null || run.exited) {
    return;
  }

  sendSignalToChild(run.pid, force ? "SIGKILL" : "SIGTERM");

  if (force) {
    return;
  }

  await Promise.race([run.completed.catch(() => undefined), sleep(SHUTDOWN_GRACE_MS)]);

  if (!run.exited && isChildAlive(run.pid)) {
    sendSignalToChild(run.pid, "SIGKILL");
    await run.completed.catch(() => undefined);
  }
};

const requestShutdown = async (signal) => {
  if (cleaningUp) {
    if (currentRun) {
      await cleanupRun(currentRun, { force: true });
    }
    process.exit(getSignalExitCode(signal));
  }

  cleaningUp = true;

  if (currentRun) {
    await cleanupRun(currentRun);
  }

  process.exit(getSignalExitCode(signal));
};

const handleSignal = (signal) => {
  if (shutdownRequested) {
    void requestShutdown(signal);
    return;
  }

  shutdownRequested = true;
  void requestShutdown(signal);
};

process.on("SIGINT", () => {
  handleSignal("SIGINT");
});

process.on("SIGTERM", () => {
  handleSignal("SIGTERM");
});

process.on("exit", () => {
  if (currentRun && !currentRun.exited) {
    sendSignalToChild(currentRun.pid, "SIGKILL");
  }
});

for (const runDefinition of runs) {
  const run = spawnVitestRun(
    runDefinition.label,
    runDefinition.configPath,
    forwardedArgs,
    coverageEnabled,
  );
  currentRun = run;

  try {
    await run.completed;
  } catch (error) {
    currentRun = null;
    await cleanupRun(run, { force: true });
    throw error;
  }

  if (currentRun === run) {
    currentRun = null;
  }

  if (run.exitCode !== 0 || run.exitSignal) {
    process.exit(run.exitCode ?? getSignalExitCode(run.exitSignal));
  }
}
