import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const BUILD_CHANNELS = new Set(["local", "beta", "release"]);
const LEGACY_CHANNEL_ALIASES = new Map([["next", "beta"]]);
const TIMESTAMP_PATTERN = /^\d{8}_\d{6}$/;
// @TODO: Dodać wspólny helper weryfikujący poprawność wersji i daty
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:\.\d+)?$/; // MAJOR.MINOR.PATCH.REVISION
const PACKAGE_JSON_PATH = path.resolve("package.json");

const pad = (value, size = 2) => String(value).padStart(size, "0");
const formatTimestampParts = ({ year, month, day, hour, minute, second }) =>
  [year, pad(month), pad(day)].join("") +
  "_" +
  [pad(hour), pad(minute), pad(second)].join("");

export const formatUtcTimestamp = (date = new Date()) =>
  formatTimestampParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  });

export const formatLocalTimestamp = (date = new Date()) =>
  formatTimestampParts({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  });

export const dayOfYear = ({ year, month, day }) => {
  const start = Date.UTC(year, 0, 0);
  const current = Date.UTC(year, month - 1, day);

  return Math.floor((current - start) / 86_400_000);
};

export const parseTimestamp = (rawTimestamp) => {
  if (!TIMESTAMP_PATTERN.test(rawTimestamp)) {
    throw new Error(`Invalid build timestamp: ${rawTimestamp}`);
  }

  const year = Number(rawTimestamp.slice(0, 4));
  const month = Number(rawTimestamp.slice(4, 6));
  const day = Number(rawTimestamp.slice(6, 8));
  const hour = Number(rawTimestamp.slice(9, 11));
  const minute = Number(rawTimestamp.slice(11, 13));
  const second = Number(rawTimestamp.slice(13, 15));
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const normalized = formatTimestampParts({
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
    hour: parsed.getUTCHours(),
    minute: parsed.getUTCMinutes(),
    second: parsed.getUTCSeconds(),
  });

  if (Number.isNaN(parsed.getTime()) || normalized !== rawTimestamp) {
    throw new Error(`Invalid build timestamp: ${rawTimestamp}`);
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
  };
};

export const toManifestVersion = (timestamp) => {
  const parsed = parseTimestamp(timestamp);
  const year = parsed.year;
  const monthDay = parsed.month * 100 + parsed.day;
  const hourMinute = parsed.hour * 100 + parsed.minute;

  return `0.${year}.${monthDay}.${hourMinute}`;
};

const readPackageVersion = () => {
  const source = fs.readFileSync(PACKAGE_JSON_PATH, "utf8");
  const json = JSON.parse(source);

  if (!SEMVER_PATTERN.test(json.version ?? "")) {
    throw new Error(`Invalid package.json version: ${json.version}`);
  }

  return json.version;
};

export const resolveBuildMetadata = ({
  channel = process.env.PT_BUILD_CHANNEL ?? "local",
  releaseVersion = process.env.PT_RELEASE_VERSION ?? readPackageVersion(),
  timestamp = process.env.PT_BUILD_TIMESTAMP || undefined,
} = {}) => {
  const normalizedChannel = LEGACY_CHANNEL_ALIASES.get(channel) ?? channel;

  if (!BUILD_CHANNELS.has(normalizedChannel)) {
    throw new Error(`Unsupported build channel: ${channel}`);
  }

  if (normalizedChannel === "release") {
    if (!SEMVER_PATTERN.test(releaseVersion)) {
      throw new Error(`Invalid release version: ${releaseVersion}`);
    }

    return {
      channel: normalizedChannel,
      releaseVersion,
      buildTimestamp: "",
      displayVersion: releaseVersion,
      manifestVersion: releaseVersion,
      artifactVersionLabel: `v${releaseVersion}`,
    };
  }

  const rawTimestamp =
    timestamp ??
    (normalizedChannel === "beta" ? formatUtcTimestamp() : formatLocalTimestamp());
  const validatedTimestamp = formatTimestampParts(parseTimestamp(rawTimestamp));
  const manifestVersion = toManifestVersion(validatedTimestamp);
  const buildLabel = normalizedChannel === "beta" ? "beta" : "local";

  return {
    channel: normalizedChannel,
    releaseVersion: "",
    buildTimestamp: validatedTimestamp,
    displayVersion: `${manifestVersion}-${buildLabel}`,
    manifestVersion,
    artifactVersionLabel: `${buildLabel}-${validatedTimestamp}`,
  };
};

const parseArgs = (argv) => {
  const args = {
    format: "github-env",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--format") {
      args.format = argv[index + 1] ?? args.format;
      index += 1;
    }
  }

  if (!["github-env", "json"].includes(args.format)) {
    throw new Error(`Unsupported output format: ${args.format}`);
  }

  return args;
};

const toGithubEnv = (metadata) =>
  [
    `PT_BUILD_CHANNEL=${metadata.channel}`,
    `PT_BUILD_TIMESTAMP=${metadata.buildTimestamp}`,
    `PT_RELEASE_VERSION=${metadata.releaseVersion}`,
    `PT_DISPLAY_VERSION=${metadata.displayVersion}`,
    `PT_MANIFEST_VERSION=${metadata.manifestVersion}`,
    `PT_ARTIFACT_VERSION_LABEL=${metadata.artifactVersionLabel}`,
  ].join("\n");

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  const args = parseArgs(process.argv.slice(2));
  const metadata = resolveBuildMetadata();

  if (args.format === "json") {
    process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
  } else {
    process.stdout.write(`${toGithubEnv(metadata)}\n`);
  }
}
