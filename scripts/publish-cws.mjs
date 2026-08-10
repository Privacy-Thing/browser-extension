/* global fetch */

import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { URLSearchParams, fileURLToPath } from "node:url";

const TOKEN_SCOPE = "https://www.googleapis.com/auth/chromewebstore";
const TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";

const base64UrlEncode = (value) =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

export const buildServiceAssertion = ({
  clientEmail,
  privateKey,
  scope = TOKEN_SCOPE,
  audience = TOKEN_AUDIENCE,
  issuedAt = Math.floor(Date.now() / 1000),
  expiresAt = issuedAt + 3600,
}) => {
  if (!clientEmail) {
    throw new Error("Missing service account client_email");
  }

  if (!privateKey) {
    throw new Error("Missing service account private_key");
  }

  const header = base64UrlEncode({
    alg: "RS256",
    typ: "JWT",
  });
  const payload = base64UrlEncode({
    iss: clientEmail,
    scope,
    aud: audience,
    exp: expiresAt,
    iat: issuedAt,
  });
  const signer = crypto.createSign("RSA-SHA256");

  signer.update(`${header}.${payload}`);
  signer.end();

  const signature = signer
    .sign(privateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${header}.${payload}.${signature}`;
};

const parseArgs = (argv) => {
  const args = {
    publisherId: "",
    itemId: "",
    zipPath: "",
    publishType: "DEFAULT_PUBLISH",
    skipReview: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--publisher-id") {
      args.publisherId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--item-id") {
      args.itemId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--zip-path") {
      args.zipPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--publish-type") {
      args.publishType = argv[index + 1] ?? args.publishType;
      index += 1;
      continue;
    }

    if (value === "--skip-review") {
      args.skipReview = true;
    }
  }

  if (!args.publisherId) {
    throw new Error("Use --publisher-id <id>");
  }

  if (!args.itemId) {
    throw new Error("Use --item-id <id>");
  }

  if (!args.zipPath) {
    throw new Error("Use --zip-path <path>");
  }

  return args;
};

const readServiceAccount = () => {
  const rawFromEnv = process.env.CWS_SERVICE_ACCOUNT_JSON?.trim();
  const rawFromFile = process.env.CWS_SERVICE_ACCOUNT_JSON_FILE?.trim();

  if (rawFromEnv) {
    return JSON.parse(rawFromEnv);
  }

  if (rawFromFile) {
    return JSON.parse(fs.readFileSync(path.resolve(rawFromFile), "utf8"));
  }

  return null;
};

const getAccessToken = async () => {
  const explicitToken = process.env.CWS_ACCESS_TOKEN?.trim();
  if (explicitToken) {
    return explicitToken;
  }

  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    throw new Error(
      "Missing CWS credentials. Set CWS_ACCESS_TOKEN or CWS_SERVICE_ACCOUNT_JSON(_FILE).",
    );
  }

  const assertion = buildServiceAssertion({
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  });
  const response = await fetch(TOKEN_AUDIENCE, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`CWS token exchange failed with ${response.status}`);
  }

  const payload = await response.json();
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("CWS token exchange did not return access_token");
  }

  return payload.access_token;
};

const toItemName = ({ publisherId, itemId }) =>
  `publishers/${publisherId}/items/${itemId}`;

const uploadPackage = async ({ accessToken, publisherId, itemId, zipPath }) => {
  const zipBuffer = fs.readFileSync(path.resolve(zipPath));
  const response = await fetch(
    `https://chromewebstore.googleapis.com/upload/v2/${toItemName({ publisherId, itemId })}:upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/zip",
      },
      body: zipBuffer,
    },
  );

  if (!response.ok) {
    const details = await response.text();
    if (
      response.status === 400 &&
      details.includes("NOT_UPDATEABLE") &&
      details.includes("in review")
    ) {
      return {
        skipped: true,
        reason: "ITEM_IN_REVIEW",
        details,
      };
    }

    throw new Error(
      `CWS upload failed with ${response.status}${details ? `: ${details}` : ""}`,
    );
  }

  return response.json();
};

const publishItem = async ({
  accessToken,
  publisherId,
  itemId,
  publishType,
  skipReview,
}) => {
  const response = await fetch(
    `https://chromewebstore.googleapis.com/v2/${toItemName({ publisherId, itemId })}:publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        publishType,
        skipReview,
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `CWS publish failed with ${response.status}${details ? `: ${details}` : ""}`,
    );
  }

  return response.json();
};

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  const args = parseArgs(process.argv.slice(2));
  const accessToken = await getAccessToken();
  const uploadResult = await uploadPackage({
    accessToken,
    publisherId: args.publisherId,
    itemId: args.itemId,
    zipPath: args.zipPath,
  });
  const publishResult = uploadResult.skipped
    ? null
    : await publishItem({
        accessToken,
        publisherId: args.publisherId,
        itemId: args.itemId,
        publishType: args.publishType,
        skipReview: args.skipReview,
      });

  process.stdout.write(
    `${JSON.stringify(
      {
        uploadResult,
        publishResult,
      },
      null,
      2,
    )}\n`,
  );
}
