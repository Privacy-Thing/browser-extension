import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const webExtEntryPath = require.resolve("web-ext");
const webExtRoot = path.dirname(webExtEntryPath);
const submitAddonModule = await import(
  pathToFileURL(path.join(webExtRoot, "lib/util/submit-addon.js")).href
);
const signModule = await import(
  pathToFileURL(path.join(webExtRoot, "lib/cmd/sign.js")).href
);

const { default: BaseSubmitClient } = submitAddonModule;
const sign = signModule.default;

const parseArgs = (argv) => {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (next === undefined || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
};

const toNumber = (value, fallback) => {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a number, received: ${value}`);
  }

  return parsed;
};

const sleep = (milliseconds) =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });

const extractThrottleSeconds = (detail, retryAfterHeader, fallbackSeconds) => {
  if (retryAfterHeader) {
    const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds;
    }
  }

  if (detail) {
    const matchedSeconds = detail.match(/Expected available in (\d+) seconds/i);
    if (matchedSeconds) {
      return Number.parseInt(matchedSeconds[1], 10);
    }
  }

  return fallbackSeconds;
};

const readThrottleDetail = async (response) => {
  try {
    const bodyText = await response.text();
    if (!bodyText) {
      return "";
    }

    try {
      const parsed = JSON.parse(bodyText);
      if (typeof parsed?.detail === "string") {
        return parsed.detail;
      }
    } catch {
      // Keep the raw body text when the response is not JSON.
    }

    return bodyText;
  } catch {
    return "";
  }
};

class RetryableAmoSubmitClient extends BaseSubmitClient {
  constructor(options) {
    super(options);
    this.throttleMaxAttempts = options.throttleMaxAttempts ?? 5;
    this.throttleFallbackSeconds = options.throttleFallbackSeconds ?? 90;
    this.throttleBufferSeconds = options.throttleBufferSeconds ?? 5;
  }

  async waitForThrottle(response, attempt, context) {
    const detail = await readThrottleDetail(response);
    const throttleSeconds = extractThrottleSeconds(
      detail,
      response.headers.get("retry-after"),
      this.throttleFallbackSeconds,
    );
    const sleepSeconds = throttleSeconds + this.throttleBufferSeconds;

    process.stderr.write(
      `${context} throttled by AMO (attempt ${attempt}/${this.throttleMaxAttempts}). ` +
        `Sleeping ${sleepSeconds}s before retry.\n`,
    );

    if (detail) {
      process.stderr.write(`${detail}\n`);
    }

    await sleep(sleepSeconds * 1000);
  }

  async fetchJson(url, method = "GET", body, errorMsg = "Bad Request") {
    for (let attempt = 1; attempt <= this.throttleMaxAttempts; attempt += 1) {
      const response = await this.fetch(url, method, body);

      if (response.status === 429 && (body === undefined || typeof body === "string")) {
        if (attempt < this.throttleMaxAttempts) {
          await this.waitForThrottle(response, attempt, `${method} ${url.pathname}`);
          continue;
        }
      }

      if (response.status < 200 || response.status >= 500) {
        throw new Error(`${errorMsg}: ${response.statusText || response.status}.`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          [
            `${errorMsg}: ${response.statusText || response.status}`,
            JSON.stringify(data, null, 2),
          ].join("\n"),
        );
      }

      return data;
    }

    throw new Error(`${errorMsg}: exhausted retries.`);
  }

  async doFormDataPatch(data, addonId, versionId) {
    const patchUrl = new globalThis.URL(
      `addon/${addonId}/versions/${versionId}/`,
      this.apiUrl,
    );

    for (let attempt = 1; attempt <= this.throttleMaxAttempts; attempt += 1) {
      const formData = new globalThis.FormData();
      for (const field in data) {
        formData.set(field, data[field]);
      }

      const response = await this.fetch(patchUrl, "PATCH", formData);
      if (response.ok) {
        return;
      }

      if (response.status === 429 && attempt < this.throttleMaxAttempts) {
        await this.waitForThrottle(response, attempt, `PATCH ${patchUrl.pathname}`);
        continue;
      }

      throw new Error(
        `Uploading ${Object.keys(data)} failed: response status was ${response.status}`,
      );
    }
  }
}

const args = parseArgs(process.argv.slice(2));

const requiredArgs = [
  "channel",
  "source-dir",
  "artifacts-dir",
  "api-key",
  "api-secret",
  "timeout",
];

for (const requiredArg of requiredArgs) {
  if (!args[requiredArg]) {
    throw new Error(`Missing required argument --${requiredArg}`);
  }
}

await sign(
  {
    amoBaseUrl: args["amo-base-url"] ?? "https://addons.mozilla.org/api/v5/",
    apiKey: args["api-key"],
    apiSecret: args["api-secret"],
    artifactsDir: args["artifacts-dir"],
    sourceDir: args["source-dir"],
    timeout: toNumber(args.timeout, 120000),
    approvalTimeout:
      args["approval-timeout"] !== undefined
        ? toNumber(args["approval-timeout"], undefined)
        : undefined,
    channel: args.channel,
    amoMetadata: args["amo-metadata"],
    uploadSourceCode: args["upload-source-code"],
    webextVersion: require(path.join(webExtRoot, "package.json")).version,
  },
  {
    submitAddon: (options) =>
      submitAddonModule.signAddon({
        ...options,
        SubmitClient: RetryableAmoSubmitClient,
      }),
  },
);
