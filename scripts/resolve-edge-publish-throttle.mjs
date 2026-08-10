/* global fetch */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const EDGE_JOB_NAME = "edge-stable";
const EDGE_PUBLISH_STEP_NAME = "Publish stable package to Edge Add-ons";
const DEFAULT_THROTTLE_DAYS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isRevisionReleaseTag = (tag) => /^v\d+\.\d+\.\d+\.\d+$/.test(String(tag ?? ""));

const shouldThrottleReleaseTag = (tag) => isRevisionReleaseTag(tag);

const parseArgs = (argv) => {
  const args = {
    releaseTag: "",
    throttleDays: DEFAULT_THROTTLE_DAYS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--release-tag") {
      args.releaseTag = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--throttle-days") {
      args.throttleDays = Number(argv[index + 1] ?? "");
      index += 1;
    }
  }

  if (!args.releaseTag) {
    throw new Error("Use --release-tag <tag>");
  }

  if (!Number.isInteger(args.throttleDays) || args.throttleDays <= 0) {
    throw new Error("Use --throttle-days <positive integer>");
  }

  return args;
};

const githubRequest = async ({ fetchImpl, token, url }) => {
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `GitHub API request failed with ${response.status}${
        details ? `: ${details}` : ""
      }`,
    );
  }

  return response.json();
};

const findLastEdgePublish = async ({
  fetchImpl = fetch,
  repository,
  currentRunId,
  token = process.env.GITHUB_TOKEN,
}) => {
  if (!repository) {
    throw new Error("Missing GitHub repository");
  }

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const runsPayload = await githubRequest({
    fetchImpl,
    token,
    url:
      `https://api.github.com/repos/${repository}/actions/workflows/publish.yml/runs` +
      "?status=completed&per_page=50",
  });

  const runs = Array.isArray(runsPayload.workflow_runs)
    ? runsPayload.workflow_runs
    : [];

  for (const run of runs) {
    const runId = String(run.id ?? "");
    if (!runId || runId === String(currentRunId ?? "")) {
      continue;
    }

    const jobsPayload = await githubRequest({
      fetchImpl,
      token,
      url: `https://api.github.com/repos/${repository}/actions/runs/${runId}/jobs?per_page=100`,
    });
    const jobs = Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs : [];
    const edgeJob = jobs.find((job) => job.name === EDGE_JOB_NAME);
    if (!edgeJob || edgeJob.conclusion !== "success") {
      continue;
    }

    const publishStep = Array.isArray(edgeJob.steps)
      ? edgeJob.steps.find((step) => step.name === EDGE_PUBLISH_STEP_NAME)
      : null;
    if (!publishStep || publishStep.conclusion !== "success") {
      continue;
    }

    const completedAt =
      publishStep.completed_at || edgeJob.completed_at || run.updated_at;
    if (!completedAt) {
      continue;
    }

    return {
      runId,
      jobId: edgeJob.id,
      completedAt,
    };
  }

  return null;
};

const resolveEdgeDecision = ({
  releaseTag,
  throttleDays,
  lastPublishedAt,
  now = () => new Date(),
}) => {
  if (!shouldThrottleReleaseTag(releaseTag)) {
    return {
      publish: true,
      reason: "MANUAL_STABLE_RELEASE",
      message: `${releaseTag} is not a revision release; Edge publishing is not throttled.`,
    };
  }

  if (!lastPublishedAt) {
    return {
      publish: true,
      reason: "NO_PREVIOUS_EDGE_PUBLISH",
      message: "No previous successful Edge publish was found; allowing this revision.",
    };
  }

  const lastDate = new Date(lastPublishedAt);
  if (Number.isNaN(lastDate.getTime())) {
    throw new Error(`Invalid lastPublishedAt: ${lastPublishedAt}`);
  }

  const currentDate = now();
  const currentTime =
    currentDate instanceof Date
      ? currentDate.getTime()
      : new Date(currentDate).getTime();
  if (Number.isNaN(currentTime)) {
    throw new Error("Invalid current time");
  }

  const elapsedMs = currentTime - lastDate.getTime();
  const throttleMs = throttleDays * MS_PER_DAY;

  if (elapsedMs >= throttleMs) {
    return {
      publish: true,
      reason: "THROTTLE_WINDOW_EXPIRED",
      message: `Last successful Edge publish was at ${lastDate.toISOString()}, at least ${throttleDays} days ago.`,
    };
  }

  const nextPublishAt = new Date(lastDate.getTime() + throttleMs).toISOString();
  return {
    publish: false,
    reason: "THROTTLED",
    message: `Last successful Edge publish was at ${lastDate.toISOString()}; next revision Edge publish is allowed at ${nextPublishAt}.`,
  };
};

const appendLine = (filePath, line) => {
  if (!filePath) {
    return;
  }
  fs.appendFileSync(filePath, `${line}\n`);
};

const writeOutputs = ({ outputPath, summaryPath, decision }) => {
  appendLine(outputPath, `publish=${decision.publish ? "true" : "false"}`);
  appendLine(outputPath, `reason=${decision.reason}`);
  appendLine(summaryPath, "### Edge publish throttle");
  appendLine(summaryPath, "");
  appendLine(summaryPath, `- Publish Edge: ${decision.publish ? "yes" : "no"}`);
  appendLine(summaryPath, `- Reason: ${decision.reason}`);
  appendLine(summaryPath, `- Detail: ${decision.message}`);
};

const runCli = async ({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
  now = () => new Date(),
} = {}) => {
  const args = parseArgs(argv);
  let lastPublish = null;

  if (shouldThrottleReleaseTag(args.releaseTag)) {
    try {
      lastPublish = await findLastEdgePublish({
        fetchImpl,
        repository: env.GITHUB_REPOSITORY,
        currentRunId: env.GITHUB_RUN_ID,
        token: env.GITHUB_TOKEN,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const decision = {
        publish: false,
        reason: "THROTTLE_HISTORY_UNAVAILABLE",
        message: `Could not inspect previous Edge publish history: ${message}`,
      };
      process.stdout.write(`${decision.message}\n`);
      writeOutputs({
        outputPath: env.GITHUB_OUTPUT,
        summaryPath: env.GITHUB_STEP_SUMMARY,
        decision,
      });
      return decision;
    }
  }

  const decision = resolveEdgeDecision({
    releaseTag: args.releaseTag,
    throttleDays: args.throttleDays,
    lastPublishedAt: lastPublish?.completedAt,
    now,
  });

  process.stdout.write(`${decision.message}\n`);
  writeOutputs({
    outputPath: env.GITHUB_OUTPUT,
    summaryPath: env.GITHUB_STEP_SUMMARY,
    decision,
  });
  return decision;
};

export {
  DEFAULT_THROTTLE_DAYS,
  EDGE_JOB_NAME,
  EDGE_PUBLISH_STEP_NAME,
  findLastEdgePublish as findLastSuccessfulEdgePublish,
  isRevisionReleaseTag,
  parseArgs,
  resolveEdgeDecision as resolveEdgePublishDecision,
  runCli,
  shouldThrottleReleaseTag,
};

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  runCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
