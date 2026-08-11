import { describe, expect, it } from "vitest";

import { applyWildcards } from "../../scripts/wildcard-pattern.mjs";

describe("applyWildcards", () => {
  it("replaces every wildcard in a target pattern", () => {
    expect(applyWildcards("src/*/generated/*.ts", "runtime")).toBe(
      "src/runtime/generated/runtime.ts",
    );
  });
});
