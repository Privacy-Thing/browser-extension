import fs from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseArgs,
  pollOperation,
  publishSubmission,
  uploadPackage,
} from "./publish-edge.mjs";

type FakeResponseInit = {
  ok?: boolean;
  status?: number;
  location?: string;
  json?: unknown;
  text?: string;
};

const fakeResponse = ({
  ok = true,
  status = 200,
  location,
  json,
  text = "",
}: FakeResponseInit) => ({
  ok,
  status,
  headers: {
    get: (name: string) =>
      name.toLowerCase() === "location" ? (location ?? null) : null,
  },
  json: async () => json,
  text: async () => text,
});

const credentials = { apiKey: "key", clientId: "client" };

// Deterministic poll knobs: zero-delay and a fixed clock so no real time elapses.
const noWait = {
  delay: async () => {},
  now: () => 0,
  pollIntervalMs: 0,
  pollTimeoutMs: 1000,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseArgs", () => {
  it("requires product id and zip path", () => {
    expect(() => parseArgs(["--zip-path", "a.zip"])).toThrow(/product-id/);
    expect(() => parseArgs(["--product-id", "p"])).toThrow(/zip-path/);
  });

  it("parses product id, zip path and notes", () => {
    const args = parseArgs([
      "--product-id",
      "prod-1",
      "--zip-path",
      "pkg.zip",
      "--notes",
      "release notes",
    ]);
    expect(args.productId).toBe("prod-1");
    expect(args.zipPath).toBe("pkg.zip");
    expect(args.notes).toBe("release notes");
  });
});

describe("uploadPackage", () => {
  it("posts the zip and returns the operation id from Location", async () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from("zip"));
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        fakeResponse({ status: 202, location: "/products/p/operations/op-123" }),
      );

    const operationId = await uploadPackage({
      credentials,
      productId: "p",
      zipPath: "pkg.zip",
      fetchImpl,
    });

    expect(operationId).toBe("op-123");
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain("/v1/products/p/submissions/draft/package");
    expect(options.headers.Authorization).toBe("ApiKey key");
    expect(options.headers["X-ClientID"]).toBe("client");
  });

  it("throws with the response body on failure", async () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from("zip"));
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(fakeResponse({ ok: false, status: 401, text: "bad key" }));

    await expect(
      uploadPackage({ credentials, productId: "p", zipPath: "pkg.zip", fetchImpl }),
    ).rejects.toThrow(/401: bad key/);
  });
});

describe("pollOperation", () => {
  it("resolves when status reaches Succeeded", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ json: { status: "InProgress" } }))
      .mockResolvedValueOnce(fakeResponse({ json: { status: "Succeeded" } }));

    const result = await pollOperation({
      credentials,
      url: "https://example/op",
      fetchImpl,
      ...noWait,
    });

    expect(result.status).toBe("Succeeded");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws when status is Failed", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        fakeResponse({ json: { status: "Failed", message: "manifest invalid" } }),
      );

    await expect(
      pollOperation({ credentials, url: "https://example/op", fetchImpl, ...noWait }),
    ).rejects.toThrow(/manifest invalid/);
  });

  it("times out when status never settles", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(fakeResponse({ json: { status: "InProgress" } }));

    await expect(
      pollOperation({
        credentials,
        url: "https://example/op",
        fetchImpl,
        delay: async () => {},
        now: () => 0,
        pollIntervalMs: 0,
        pollTimeoutMs: 0,
      }),
    ).rejects.toThrow(/did not complete/);
  });
});

describe("publishSubmission", () => {
  it("returns the publish operation id on success", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(fakeResponse({ status: 202, location: "pub-9" }));

    const result = await publishSubmission({
      credentials,
      productId: "p",
      notes: "notes",
      fetchImpl,
    });

    expect(result).toEqual({ skipped: false, operationId: "pub-9" });
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ notes: "notes" });
  });

  it("skips when a submission is already in progress", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        fakeResponse({ ok: false, status: 400, text: "A submission is in progress" }),
      );

    const result = await publishSubmission({
      credentials,
      productId: "p",
      fetchImpl,
    });

    expect(result).toEqual({
      skipped: true,
      reason: "SUBMISSION_IN_PROGRESS",
      details: "A submission is in progress",
    });
  });

  it("throws on other client errors", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        fakeResponse({ ok: false, status: 400, text: "validation error" }),
      );

    await expect(
      publishSubmission({ credentials, productId: "p", fetchImpl }),
    ).rejects.toThrow(/validation error/);
  });
});
