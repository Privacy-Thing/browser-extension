/* global fetch, setTimeout */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Microsoft Edge Add-ons Publish API v1.1.
// Auth is an API key plus the publisher Client ID (no Azure AD token exchange,
// unlike the legacy v1 flow). See https://go.microsoft.com/fwlink/?linkid=2186383
const API_BASE = "https://api.addons.microsoftedge.microsoft.com";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_POLL_TIMEOUT_MS = 5 * 60_000;

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const parseArgs = (argv) => {
  const args = {
    productId: "",
    zipPath: "",
    notes: "",
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    pollTimeoutMs: DEFAULT_POLL_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--product-id") {
      args.productId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--zip-path") {
      args.zipPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--notes") {
      args.notes = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--poll-interval-ms") {
      args.pollIntervalMs = Number(argv[index + 1] ?? args.pollIntervalMs);
      index += 1;
      continue;
    }

    if (value === "--poll-timeout-ms") {
      args.pollTimeoutMs = Number(argv[index + 1] ?? args.pollTimeoutMs);
      index += 1;
    }
  }

  if (!args.productId) {
    throw new Error("Use --product-id <id>");
  }

  if (!args.zipPath) {
    throw new Error("Use --zip-path <path>");
  }

  return args;
};

const readCredentials = () => {
  const apiKey = process.env.EDGE_API_KEY?.trim();
  const clientId = process.env.EDGE_CLIENT_ID?.trim();

  if (!apiKey || !clientId) {
    throw new Error("Missing Edge credentials. Set EDGE_API_KEY and EDGE_CLIENT_ID.");
  }

  return { apiKey, clientId };
};

const authHeaders = ({ apiKey, clientId }) => ({
  Authorization: `ApiKey ${apiKey}`,
  "X-ClientID": clientId,
});

// The Add-ons API returns the operation handle in the Location response header.
// It is documented as the operation ID; accept either a bare ID or a full path.
const extractOperationId = (response) => {
  const location = response.headers.get("location");
  if (!location) {
    throw new Error("Edge API did not return an operation Location header");
  }

  const segments = location.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? location;
};

const uploadPackage = async ({
  credentials,
  productId,
  zipPath,
  fetchImpl = fetch,
}) => {
  const zipBuffer = fs.readFileSync(path.resolve(zipPath));
  const response = await fetchImpl(
    `${API_BASE}/v1/products/${productId}/submissions/draft/package`,
    {
      method: "POST",
      headers: {
        ...authHeaders(credentials),
        "Content-Type": "application/zip",
      },
      body: zipBuffer,
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Edge upload failed with ${response.status}${details ? `: ${details}` : ""}`,
    );
  }

  return extractOperationId(response);
};

// Polls an operation status endpoint until the API reports a terminal state.
// Cadence is driven by the API-reported status, not wall-clock guesses; tests
// inject `delay`/`now` to drive it deterministically without real timers.
const pollOperation = async ({
  credentials,
  url,
  fetchImpl = fetch,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  pollTimeoutMs = DEFAULT_POLL_TIMEOUT_MS,
  delay = sleep,
  now = () => Date.now(),
}) => {
  const deadline = now() + pollTimeoutMs;

  for (;;) {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: authHeaders(credentials),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `Edge operation status failed with ${response.status}${
          details ? `: ${details}` : ""
        }`,
      );
    }

    const payload = await response.json();
    const status = payload.status;

    if (status === "Succeeded") {
      return payload;
    }

    if (status === "Failed") {
      const reason =
        payload.message ||
        (Array.isArray(payload.errors)
          ? payload.errors.map((error) => error.message).join("; ")
          : "") ||
        payload.errorCode ||
        "unknown error";
      throw new Error(`Edge operation failed: ${reason}`);
    }

    if (now() >= deadline) {
      throw new Error(
        `Edge operation did not complete within ${pollTimeoutMs}ms (last status: ${
          status ?? "unknown"
        })`,
      );
    }

    await delay(pollIntervalMs);
  }
};

const pollUploadOperation = ({ credentials, productId, operationId, ...rest }) =>
  pollOperation({
    credentials,
    url: `${API_BASE}/v1/products/${productId}/submissions/draft/package/operations/${operationId}`,
    ...rest,
  });

const publishSubmission = async ({
  credentials,
  productId,
  notes,
  fetchImpl = fetch,
}) => {
  const response = await fetchImpl(`${API_BASE}/v1/products/${productId}/submissions`, {
    method: "POST",
    headers: {
      ...authHeaders(credentials),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(notes ? { notes } : {}),
  });

  // A submission already in review cannot be re-submitted; treat it as a skip
  // rather than a failure, mirroring the Chrome Web Store helper.
  if (response.status === 400 || response.status === 409) {
    const details = await response.text();
    if (/in.?progress|in.?review|pending|already/i.test(details)) {
      return { skipped: true, reason: "SUBMISSION_IN_PROGRESS", details };
    }

    throw new Error(`Edge publish failed with ${response.status}: ${details}`);
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Edge publish failed with ${response.status}${details ? `: ${details}` : ""}`,
    );
  }

  return { skipped: false, operationId: extractOperationId(response) };
};

const pollPublishOperation = ({ credentials, productId, operationId, ...rest }) =>
  pollOperation({
    credentials,
    url: `${API_BASE}/v1/products/${productId}/submissions/operations/${operationId}`,
    ...rest,
  });

export {
  API_BASE,
  parseArgs,
  readCredentials,
  uploadPackage,
  pollOperation,
  pollUploadOperation,
  publishSubmission,
  pollPublishOperation,
};

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  const args = parseArgs(process.argv.slice(2));
  const credentials = readCredentials();
  const pollOptions = {
    pollIntervalMs: args.pollIntervalMs,
    pollTimeoutMs: args.pollTimeoutMs,
  };

  const uploadOperationId = await uploadPackage({
    credentials,
    productId: args.productId,
    zipPath: args.zipPath,
  });
  process.stdout.write(`Edge upload accepted (operation ${uploadOperationId})\n`);

  await pollUploadOperation({
    credentials,
    productId: args.productId,
    operationId: uploadOperationId,
    ...pollOptions,
  });
  process.stdout.write("Edge package upload succeeded\n");

  const publishResult = await publishSubmission({
    credentials,
    productId: args.productId,
    notes: args.notes,
  });

  if (publishResult.skipped) {
    process.stdout.write(
      `Edge publish skipped: ${publishResult.reason}\n${publishResult.details ?? ""}\n`,
    );
  } else {
    process.stdout.write(
      `Edge publish accepted (operation ${publishResult.operationId})\n`,
    );
    await pollPublishOperation({
      credentials,
      productId: args.productId,
      operationId: publishResult.operationId,
      ...pollOptions,
    });
    process.stdout.write("Edge submission published to review\n");
  }
}
