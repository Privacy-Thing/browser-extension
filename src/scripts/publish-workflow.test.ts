import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = path.resolve(".github/workflows/publish.yml");
const SYNC_WORKFLOW_PATH = path.resolve(".github/workflows/sync-privacy-policy.yml");
const CROSS_CHECKOUT_PATTERN = /git checkout origin\/main -- (.+)/g;
const RELATIVE_IMPORT_PATTERN = /\bfrom\s+"\.\.?\//;

const collectOverlaidScripts = (workflow: string) =>
  [...workflow.matchAll(CROSS_CHECKOUT_PATTERN)].flatMap((match) =>
    (match[1] ?? "").trim().split(/\s+/),
  );

describe("publish workflow", () => {
  // A release built from an older tag keeps that tag's tree. Overlaying main's
  // copy of a script that imports repo-local modules pairs a new importer with
  // the tag's old module, and the mismatch fails at link time (v0.9.1.1 died on
  // a renamed brand-config export).
  it("only overlays main scripts that import node builtins", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
    const scripts = collectOverlaidScripts(workflow);

    expect(scripts.length).toBeGreaterThan(0);

    for (const script of scripts) {
      const source = fs.readFileSync(path.resolve(script), "utf8");

      expect(
        RELATIVE_IMPORT_PATTERN.test(source),
        `${script} imports repo-local modules and must not be checked out from origin/main`,
      ).toBe(false);
    }
  });

  it("packages source archives with the checked-out tag's own script", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain("pnpm package:source");
    expect(collectOverlaidScripts(workflow)).not.toContain(
      "scripts/package-source-code.mjs",
    );
  });

  it("keeps untrusted dispatch and release values out of shell source", () => {
    const publishWorkflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
    const privacyPolicyWorkflow = fs.readFileSync(SYNC_WORKFLOW_PATH, "utf8");

    expect(publishWorkflow).not.toContain(
      'BUILD_TIMESTAMP="${{ inputs.build_timestamp }}"',
    );
    expect(publishWorkflow).toContain(
      "BUILD_TIMESTAMP_INPUT: ${{ inputs.build_timestamp }}",
    );
    expect(publishWorkflow).toContain('BUILD_TIMESTAMP="${BUILD_TIMESTAMP_INPUT}"');

    expect(privacyPolicyWorkflow).not.toContain(
      "${{ github.event.release.tag_name || github.sha || 'manual' }}\"",
    );
    expect(privacyPolicyWorkflow).toContain(
      "SOURCE_REF: ${{ github.event.release.tag_name || github.sha || 'manual' }}",
    );
    expect(privacyPolicyWorkflow).toContain("${SOURCE_REF}");
  });
});
