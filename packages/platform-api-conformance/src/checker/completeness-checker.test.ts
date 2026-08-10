import { afterEach, describe, expect, it, vi } from "vitest";

import { SourceScanner } from "../scanner/source-scanner.js";
import type { DetectedPatch } from "../types.js";

import { CompletenessChecker } from "./completeness-checker.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CompletenessChecker", () => {
  it("counts only unique runtime descriptor APIs in completeness messaging", () => {
    vi.spyOn(SourceScanner, "scan").mockReturnValue({
      indexedPropertyCount: 10,
      discoveredSurfaceCount: 2,
      totalEstimated: 10,
    });

    const patches: DetectedPatch[] = [
      { api: "Date.prototype.toString", browser: "chromium", diffType: "changed" },
      { api: "Date.prototype.toString", browser: "firefox", diffType: "changed" },
      {
        api: "Date.prototype.toString",
        browser: "chromium",
        diffType: "value-changed",
        vanillaValue: "native",
        spoofedValue: "spoofed",
      },
      {
        api: "Navigator.prototype.language",
        browser: "chromium",
        diffType: "value-changed",
        vanillaValue: "en-US",
        spoofedValue: "en-GB",
      },
    ];

    const findings = CompletenessChecker.check(patches, "/repo");

    expect(findings).toHaveLength(2);
    expect(findings[0]?.message).toContain(
      "10 indexed source patch sites found, 1 unique runtime descriptor API changes detected.",
    );
    expect(findings[1]?.message).toContain(
      "10 indexed source patch sites vs 1 unique runtime descriptor detections.",
    );
  });

  it("does not report a gap when indexed source sites stay within the threshold", () => {
    vi.spyOn(SourceScanner, "scan").mockReturnValue({
      indexedPropertyCount: 2,
      discoveredSurfaceCount: 1,
      totalEstimated: 2,
    });

    const patches: DetectedPatch[] = [
      { api: "Date.prototype.toString", browser: "chromium", diffType: "changed" },
      {
        api: "Date.prototype.toString",
        browser: "chromium",
        diffType: "value-changed",
        vanillaValue: "native",
        spoofedValue: "spoofed",
      },
    ];

    const findings = CompletenessChecker.check(patches, "/repo");

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(
      "2 indexed source patch sites found, 1 unique runtime descriptor API changes detected.",
    );
  });
});
