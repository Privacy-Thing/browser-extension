import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  findLastSuccessfulEdgePublish,
  isRevisionReleaseTag,
  parseArgs,
  resolveEdgePublishDecision,
  runCli,
  shouldThrottleReleaseTag,
} from "./resolve-edge-publish-throttle.mjs";

type FakeResponseInit = {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
};

const fakeResponse = ({
  ok = true,
  status = 200,
  json,
  text = "",
}: FakeResponseInit) => ({
  ok,
  status,
  json: async () => json,
  text: async () => text,
});

const baseNow = () => new Date("2026-07-12T12:00:00.000Z");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("release tag classification", () => {
  it("does not throttle three-part stable release tags", () => {
    expect(isRevisionReleaseTag("v1.2.3")).toBe(false);
    expect(shouldThrottleReleaseTag("v1.2.3")).toBe(false);
    expect(
      resolveEdgePublishDecision({
        releaseTag: "v1.2.3",
        throttleDays: 10,
        lastPublishedAt: "2026-07-12T11:00:00.000Z",
        now: baseNow,
      }),
    ).toMatchObject({ publish: true, reason: "MANUAL_STABLE_RELEASE" });
  });

  it("throttles four-part revision release tags", () => {
    expect(isRevisionReleaseTag("v1.2.3.4")).toBe(true);
    expect(shouldThrottleReleaseTag("v1.2.3.4")).toBe(true);
  });
});

describe("resolveEdgePublishDecision", () => {
  it("allows a revision when no previous Edge publish exists", () => {
    expect(
      resolveEdgePublishDecision({
        releaseTag: "v1.2.3.4",
        throttleDays: 10,
        lastPublishedAt: null,
        now: baseNow,
      }),
    ).toMatchObject({ publish: true, reason: "NO_PREVIOUS_EDGE_PUBLISH" });
  });

  it("throttles a revision when the previous Edge publish was 9 days ago", () => {
    expect(
      resolveEdgePublishDecision({
        releaseTag: "v1.2.3.4",
        throttleDays: 10,
        lastPublishedAt: "2026-07-03T12:00:00.000Z",
        now: baseNow,
      }),
    ).toMatchObject({ publish: false, reason: "THROTTLED" });
  });

  it("allows a revision when the previous Edge publish was exactly 10 days ago", () => {
    expect(
      resolveEdgePublishDecision({
        releaseTag: "v1.2.3.4",
        throttleDays: 10,
        lastPublishedAt: "2026-07-02T12:00:00.000Z",
        now: baseNow,
      }),
    ).toMatchObject({ publish: true, reason: "THROTTLE_WINDOW_EXPIRED" });
  });

  it("allows a revision when the previous Edge publish was more than 10 days ago", () => {
    expect(
      resolveEdgePublishDecision({
        releaseTag: "v1.2.3.4",
        throttleDays: 10,
        lastPublishedAt: "2026-07-01T12:00:00.000Z",
        now: baseNow,
      }),
    ).toMatchObject({ publish: true, reason: "THROTTLE_WINDOW_EXPIRED" });
  });
});

describe("findLastSuccessfulEdgePublish", () => {
  it("ignores the current run id", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        fakeResponse({
          json: {
            workflow_runs: [
              { id: 100, updated_at: "2026-07-12T11:00:00.000Z" },
              { id: 99, updated_at: "2026-07-10T11:00:00.000Z" },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        fakeResponse({
          json: {
            jobs: [
              {
                id: 1,
                name: "edge-stable",
                conclusion: "success",
                completed_at: "2026-07-10T11:00:00.000Z",
                steps: [
                  {
                    name: "Publish stable package to Edge Add-ons",
                    conclusion: "success",
                    completed_at: "2026-07-10T11:01:00.000Z",
                  },
                ],
              },
            ],
          },
        }),
      );

    const result = await findLastSuccessfulEdgePublish({
      fetchImpl,
      repository: "owner/repo",
      currentRunId: "100",
      token: "token",
    });

    expect(result?.runId).toBe("99");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1][0])).toContain("/actions/runs/99/jobs");
  });

  it("ignores edge jobs where the publish step is skipped or missing", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        fakeResponse({
          json: {
            workflow_runs: [
              { id: 98, updated_at: "2026-07-11T11:00:00.000Z" },
              { id: 97, updated_at: "2026-07-10T11:00:00.000Z" },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        fakeResponse({
          json: {
            jobs: [
              {
                id: 2,
                name: "edge-stable",
                conclusion: "success",
                completed_at: "2026-07-11T11:00:00.000Z",
                steps: [
                  {
                    name: "Publish stable package to Edge Add-ons",
                    conclusion: "skipped",
                  },
                ],
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        fakeResponse({
          json: {
            jobs: [
              {
                id: 3,
                name: "edge-stable",
                conclusion: "success",
                completed_at: "2026-07-10T11:00:00.000Z",
                steps: [{ name: "Build stable Chrome ZIP", conclusion: "success" }],
              },
            ],
          },
        }),
      );

    const result = await findLastSuccessfulEdgePublish({
      fetchImpl,
      repository: "owner/repo",
      currentRunId: "100",
      token: "token",
    });

    expect(result).toBeNull();
  });

  it("ignores non-edge jobs", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        fakeResponse({
          json: {
            workflow_runs: [{ id: 96, updated_at: "2026-07-10T11:00:00.000Z" }],
          },
        }),
      )
      .mockResolvedValueOnce(
        fakeResponse({
          json: {
            jobs: [
              {
                id: 4,
                name: "cws-stable",
                conclusion: "success",
                completed_at: "2026-07-10T11:00:00.000Z",
                steps: [
                  {
                    name: "Publish stable package to Edge Add-ons",
                    conclusion: "success",
                  },
                ],
              },
            ],
          },
        }),
      );

    const result = await findLastSuccessfulEdgePublish({
      fetchImpl,
      repository: "owner/repo",
      currentRunId: "100",
      token: "token",
    });

    expect(result).toBeNull();
  });
});

describe("runCli", () => {
  it("defaults to a safe skip when revision history lookup fails", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "edge-throttle-"));
    const outputPath = path.join(dir, "output");
    const summaryPath = path.join(dir, "summary");
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(fakeResponse({ ok: false, status: 500, text: "boom" }));

    const decision = await runCli({
      argv: ["--release-tag", "v1.2.3.4", "--throttle-days", "10"],
      env: {
        GITHUB_TOKEN: "token",
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_RUN_ID: "100",
        GITHUB_OUTPUT: outputPath,
        GITHUB_STEP_SUMMARY: summaryPath,
      },
      fetchImpl,
      now: baseNow,
    });

    expect(decision).toMatchObject({
      publish: false,
      reason: "THROTTLE_HISTORY_UNAVAILABLE",
    });
    expect(readFileSync(outputPath, "utf8")).toContain("publish=false");
    expect(readFileSync(summaryPath, "utf8")).toContain(
      "Could not inspect previous Edge publish history",
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects invalid throttle days", () => {
    expect(() =>
      parseArgs(["--release-tag", "v1.2.3.4", "--throttle-days", "0"]),
    ).toThrow(/positive integer/);
  });
});
