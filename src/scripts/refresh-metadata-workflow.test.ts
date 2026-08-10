import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = path.resolve(".github/workflows/refresh-metadata.yml");

describe("refresh-metadata workflow", () => {
  it("publishes the revision tag and main record atomically before dispatching publish", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
    const atomicPushIndex = workflow.indexOf(
      'git push --atomic origin HEAD:main "${REV_TAG}"',
    );
    const publishDispatchIndex = workflow.indexOf(
      "actions/workflows/publish.yml/dispatches",
    );

    expect(atomicPushIndex).toBeGreaterThan(-1);
    expect(publishDispatchIndex).toBeGreaterThan(atomicPushIndex);
    expect(workflow).not.toContain('run: git push origin "${REV_TAG}"');
  });
});
