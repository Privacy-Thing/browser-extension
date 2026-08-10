import { describe, expect, it } from "vitest";

import {
  formatBetaReleaseNotes,
  selectPreviousReleaseRef,
} from "../../scripts/extract-beta-release-notes.mjs";

describe("extract-beta-release-notes", () => {
  it("prefers the newer stable tag when the previous beta is already included in stable", () => {
    expect(
      selectPreviousReleaseRef({
        betaTags: ["beta-20260410-120000", "beta-20260409-120000"],
        stableTags: ["v0.7.0"],
        isAncestor: (older: string, newer: string) =>
          older === "beta-20260410-120000" && newer === "v0.7.0",
      }),
    ).toBe("v0.7.0");
  });

  it("prefers the newer beta tag when stable is older", () => {
    expect(
      selectPreviousReleaseRef({
        betaTags: ["beta-20260410-120000", "beta-20260409-120000"],
        stableTags: ["v0.7.0"],
        isAncestor: (older: string, newer: string) =>
          older === "v0.7.0" && newer === "beta-20260410-120000",
      }),
    ).toBe("beta-20260410-120000");
  });

  it("falls back to the latest stable tag when no beta exists", () => {
    expect(
      selectPreviousReleaseRef({
        betaTags: [],
        stableTags: ["v0.7.0", "v0.6.2"],
      }),
    ).toBe("v0.7.0");
  });

  it("formats a rerun note when the beta range is empty", () => {
    expect(
      formatBetaReleaseNotes({
        releaseTag: "beta-20260410-120000",
        targetSha: "abcdef1234567890",
        baseRef: "beta-20260409-120000",
        commits: [],
        compareUrl: "",
      }),
    ).toContain("This beta republishes the same target commit.");
  });

  it("formats a stable sync note when the beta is cut from the same stable SHA", () => {
    expect(
      formatBetaReleaseNotes({
        releaseTag: "beta-20260410-120000",
        targetSha: "abcdef1234567890",
        baseRef: "v0.7.0",
        commits: [],
        compareUrl: "",
        syncStableVersion: "0.7.0",
      }),
    ).toContain("Beta channel synced to stable `0.7.0`.");
  });

  it("formats exact-range beta notes", () => {
    expect(
      formatBetaReleaseNotes({
        releaseTag: "beta-20260410-120000",
        targetSha: "abcdef1234567890",
        baseRef: "beta-20260409-120000",
        compareUrl: "https://github.com/example/repo/compare/old...new",
        commits: [
          { shortSha: "abcdef1", subject: "feat: first change" },
          { shortSha: "1234567", subject: "fix: second change" },
        ],
      }),
    ).toContain("Changes in this beta:");
  });

  it("falls back to commit timestamps when refs are unrelated", () => {
    expect(
      selectPreviousReleaseRef({
        betaTags: ["beta-20260410-120000"],
        stableTags: ["v0.7.0"],
        getCommitTimestamp: (ref: string) => (ref === "v0.7.0" ? 200 : 100),
      }),
    ).toBe("v0.7.0");
  });
});
