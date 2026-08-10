import { describe, expect, it } from "vitest";

import type { DetectedPatch } from "../types.js";

import { CrossPathChecker } from "./cross-path-checker.js";

describe("CrossPathChecker", () => {
  it("ignores value-probe-only gaps when checking browser parity", () => {
    const patches: DetectedPatch[] = [
      {
        api: "Intl.DateTimeFormat.resolvedOptions.locale",
        browser: "chromium",
        diffType: "value-changed",
        vanillaValue: "en-US",
        spoofedValue: "en-GB",
        valueProbeCategory: "compatibility",
      },
    ];

    const findings = CrossPathChecker.check(patches, {
      firefoxSnapshotAvailable: true,
    });

    expect(findings).toEqual([]);
  });

  it("still reports descriptor-level parity gaps", () => {
    const patches: DetectedPatch[] = [
      {
        api: "Navigator.prototype.language",
        browser: "chromium",
        diffType: "changed",
        vanillaDescriptor: {
          configurable: true,
          enumerable: false,
        },
        spoofedDescriptor: {
          configurable: true,
          enumerable: false,
          getterValue: '"en-GB"',
        },
      },
    ];

    const findings = CrossPathChecker.check(patches, {
      firefoxSnapshotAvailable: true,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "stealth",
      severity: "WARNING",
      api: "Navigator.prototype.language",
    });
  });
});
