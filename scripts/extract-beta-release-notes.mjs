import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const BETA_TAG_PATTERN = /^beta-\d{8}-\d{6}$/;

const runGit = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
  }).trim();

const parseArgs = (argv) => {
  const args = {
    output: "",
    tag: "",
    target: "HEAD",
    base: "",
    syncStableVersion: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--output") {
      args.output = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--tag") {
      args.tag = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--target") {
      args.target = argv[index + 1] ?? args.target;
      index += 1;
      continue;
    }

    if (value === "--base") {
      args.base = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--sync-stable-version") {
      args.syncStableVersion = argv[index + 1] ?? "";
      index += 1;
    }
  }

  if (!BETA_TAG_PATTERN.test(args.tag)) {
    throw new Error("Use --tag beta-YYYYMMDD-HHMMSS");
  }

  if (!args.output) {
    throw new Error("Use --output <path>");
  }

  return args;
};

export const selectPreviousReleaseRef = ({
  betaTags,
  stableTags,
  isAncestor = () => false,
  getCommitTimestamp = () => 0,
}) => {
  const latestBeta = betaTags[0];
  const latestStable = stableTags[0];

  if (latestBeta && latestStable) {
    if (isAncestor(latestBeta, latestStable)) {
      return latestStable;
    }

    if (isAncestor(latestStable, latestBeta)) {
      return latestBeta;
    }

    return getCommitTimestamp(latestStable) > getCommitTimestamp(latestBeta)
      ? latestStable
      : latestBeta;
  }

  if (latestBeta) {
    return latestBeta;
  }

  if (latestStable) {
    return latestStable;
  }

  throw new Error("Could not find a previous beta or stable tag");
};

export const formatBetaReleaseNotes = ({
  releaseTag,
  targetSha,
  baseRef,
  commits,
  compareUrl,
  syncStableVersion = "",
}) => {
  if (commits.length === 0) {
    if (syncStableVersion) {
      return [
        `Beta release: ${releaseTag}`,
        `Commit: \`${targetSha.slice(0, 7)}\``,
        "",
        `Beta channel synced to stable \`${syncStableVersion}\`.`,
        "",
      ].join("\n");
    }

    return [
      `Beta release: ${releaseTag}`,
      `Commit: \`${targetSha.slice(0, 7)}\``,
      `Range start: \`${baseRef}\``,
      "",
      "No new commits since the previous beta/stable reference.",
      "This beta republishes the same target commit.",
      "",
    ].join("\n");
  }

  const compareBlock = compareUrl ? `Compare: ${compareUrl}\n\n` : "";
  const commitLines = commits
    .map((commit) => `- ${commit.subject} (\`${commit.shortSha}\`)`)
    .join("\n");

  return [
    `Beta release: ${releaseTag}`,
    `Commit: \`${targetSha.slice(0, 7)}\``,
    `Range start: \`${baseRef}\``,
    "",
    `${compareBlock}Changes in this beta:`,
    "",
    commitLines,
    "",
  ].join("\n");
};

const parseGitHubRepoUrl = (remoteUrl) => {
  const sshMatch = /^git@github\.com:(?<slug>[^/]+\/[^/]+?)(?:\.git)?$/.exec(remoteUrl);
  if (sshMatch?.groups?.slug) {
    return `https://github.com/${sshMatch.groups.slug}`;
  }

  const httpsMatch = /^https:\/\/github\.com\/(?<slug>[^/]+\/[^/]+?)(?:\.git)?$/.exec(
    remoteUrl,
  );
  if (httpsMatch?.groups?.slug) {
    return `https://github.com/${httpsMatch.groups.slug}`;
  }

  return "";
};

const isAncestorRef = (olderRef, newerRef) => {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", olderRef, newerRef], {
      encoding: "utf8",
      stdio: "pipe",
    });
    return true;
  } catch (error) {
    if (typeof error === "object" && error && "status" in error && error.status === 1) {
      return false;
    }

    throw error;
  }
};

const getCommitTimestamp = (ref) =>
  Number.parseInt(runGit(["show", "-s", "--format=%ct", ref]), 10);

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const targetSha = runGit(["rev-parse", args.target]);
  const betaTags = runGit(["tag", "--list", "beta-*", "--sort=-refname"])
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
  const stableTags = runGit(["tag", "--list", "v*", "--sort=-v:refname"])
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
  const baseRef =
    args.base ||
    selectPreviousReleaseRef({
      betaTags,
      stableTags,
      isAncestor: isAncestorRef,
      getCommitTimestamp,
    });
  const rawCommits = runGit(["log", "--format=%H%x09%s", `${baseRef}..${targetSha}`]);
  const commits = rawCommits
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sha, ...subjectParts] = line.split("\t");
      return {
        sha,
        shortSha: sha.slice(0, 7),
        subject: subjectParts.join("\t"),
      };
    });
  const repoUrl = parseGitHubRepoUrl(runGit(["config", "--get", "remote.origin.url"]));
  const baseSha = runGit(["rev-parse", baseRef]);
  const compareUrl = repoUrl ? `${repoUrl}/compare/${baseSha}...${targetSha}` : "";
  const notes = formatBetaReleaseNotes({
    releaseTag: args.tag,
    targetSha,
    baseRef,
    commits,
    compareUrl,
    syncStableVersion: args.syncStableVersion,
  });

  fs.writeFileSync(path.resolve(args.output), notes);
};

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main();
}
