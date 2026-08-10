import { describe, expect, it } from "vitest";

import {
  computeNextRevision,
  pickLatestStableTag,
} from "../../scripts/compute-next-revision.mjs";

describe("computeNextRevision", () => {
  it("appends a revision to a 3-part stable version", () => {
    expect(computeNextRevision("0.8.9")).toBe("0.8.9.1");
  });

  it("increments the revision of a 4-part version", () => {
    expect(computeNextRevision("0.9.4.2")).toBe("0.9.4.3");
  });

  it("rejects malformed versions", () => {
    expect(() => computeNextRevision("0.8")).toThrow(/Invalid base version/);
    expect(() => computeNextRevision("v0.8.9")).toThrow(/Invalid base version/);
  });
});

describe("pickLatestStableTag", () => {
  it("selects the highest stable tag and ignores beta tags", () => {
    const latest = pickLatestStableTag([
      "v0.8.9",
      "v0.8.10",
      "v0.8.10.1",
      "beta-20260620-101010",
      "v0.8.2",
    ]);

    expect(latest).toEqual({ tag: "v0.8.10.1", version: "0.8.10.1" });
  });

  it("orders numerically rather than lexicographically", () => {
    expect(pickLatestStableTag(["v0.8.9", "v0.8.10"]).version).toBe("0.8.10");
  });

  it("treats a 4-part revision as newer than its 3-part base", () => {
    expect(pickLatestStableTag(["v0.8.10", "v0.8.10.1"]).version).toBe("0.8.10.1");
  });

  it("throws when no stable tags are present", () => {
    expect(() => pickLatestStableTag(["beta-20260620-101010"])).toThrow(/No stable/);
  });
});
