import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildServiceAssertion } from "../../scripts/publish-cws.mjs";

describe("publish-cws", () => {
  it("builds a service account assertion with three JWT segments", () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: {
        format: "pem",
        type: "pkcs8",
      },
      publicKeyEncoding: {
        format: "pem",
        type: "spki",
      },
    });

    const token = buildServiceAssertion({
      clientEmail: "publisher@example.iam.gserviceaccount.com",
      privateKey,
      issuedAt: 1_700_000_000,
      expiresAt: 1_700_003_600,
    });

    expect(token.split(".")).toHaveLength(3);
  });
});
