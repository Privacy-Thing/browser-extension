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

  it("matches Client Hints only at the intended API boundaries", () => {
    const patches: DetectedPatch[] = [
      {
        api: "PrefixNavigatorUAData.prototype.brandsFactory",
        browser: "chromium",
        diffType: "changed",
        vanillaDescriptor: {},
        spoofedDescriptor: {},
      },
      {
        api: "NavigatorUAData.prototype.brands",
        browser: "chromium",
        diffType: "changed",
        vanillaDescriptor: {},
        spoofedDescriptor: {},
      },
    ];

    const findings = CrossPathChecker.check(patches, {
      firefoxSnapshotAvailable: true,
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          api: "PrefixNavigatorUAData.prototype.brandsFactory",
          severity: "INFO",
        }),
      ]),
    );
    expect(findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          api: "NavigatorUAData.prototype.brands",
        }),
      ]),
    );
  });
});
