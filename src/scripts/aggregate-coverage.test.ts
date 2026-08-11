import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildCoverageAggregate } from "../../scripts/aggregate-coverage.mjs";

const temporaryRoots: string[] = [];

const summary = {
  total: {
    lines: { total: 1, covered: 1, skipped: 0, pct: 100 },
    statements: { total: 1, covered: 1, skipped: 0, pct: 100 },
    functions: { total: 0, covered: 0, skipped: 0, pct: 100 },
    branches: { total: 0, covered: 0, skipped: 0, pct: 100 },
  },
};

const coverageFor = (sourcePath: string) => ({
  [sourcePath]: {
    path: sourcePath,
    statementMap: {
      "0": {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 1 },
      },
    },
    fnMap: {},
    branchMap: {},
    s: { "0": 1 },
    f: {},
    b: {},
  },
});

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("buildCoverageAggregate", () => {
  it("skips an entire lane when either coverage file is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "coverage-aggregate-test-"));
    temporaryRoots.push(root);
    const neutralDirectory = join(root, "build", "coverage", "neutral");
    const chromiumDirectory = join(root, "build", "coverage", "chromium");
    await Promise.all([
      mkdir(neutralDirectory, { recursive: true }),
      mkdir(chromiumDirectory, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(
        join(neutralDirectory, "coverage-summary.json"),
        JSON.stringify(summary),
      ),
      writeFile(
        join(neutralDirectory, "coverage-final.json"),
        JSON.stringify(coverageFor(join(root, "src", "neutral.ts"))),
      ),
      writeFile(
        join(chromiumDirectory, "coverage-summary.json"),
        JSON.stringify(summary),
      ),
    ]);

    const aggregate = await buildCoverageAggregate(root);

    expect(Object.keys(aggregate.lanes)).toEqual(["neutral"]);
    expect(Object.keys(aggregate.files)).toEqual(["src/neutral.ts"]);
  });
});
