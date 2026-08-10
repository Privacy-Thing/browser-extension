import { describe, expect, it } from "vitest";

import { DescriptorChecker } from "./descriptor-checker.js";

describe("DescriptorChecker", () => {
  const targets = [
    { name: "chrome", version: 136 },
    { name: "firefox", version: 149 },
  ] as const;

  it("keeps generic value-probe diffs at INFO by default", () => {
    const findings = DescriptorChecker.check(
      [
        {
          api: "Navigator.prototype.language",
          browser: "chromium",
          diffType: "value-changed",
          vanillaValue: '"en-US"',
          spoofedValue: '"en-GB"',
        },
      ],
      [...targets],
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "compatibility",
      severity: "INFO",
      api: "Navigator.prototype.language",
    });
  });

  it("elevates compatibility-sensitive value probes to configured severity", () => {
    const findings = DescriptorChecker.check(
      [
        {
          api: "Intl.DateTimeFormat.prototype.format(returned-function-lies)",
          browser: "chromium",
          diffType: "value-changed",
          vanillaValue: '"1/1/1970"',
          spoofedValue: '"01/01/1970"',
          valueProbeSeverity: "WARNING",
        },
      ],
      [...targets],
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "compatibility",
      severity: "WARNING",
      api: "Intl.DateTimeFormat.prototype.format(returned-function-lies)",
    });
    expect(findings[0]?.message).toContain("compatibility-sensitive output drift");
  });

  it("reports explicit value-policy violations with compatibility category", () => {
    const findings = DescriptorChecker.check(
      [
        {
          api: "Date.prototype.toString(parseable)",
          browser: "chromium",
          diffType: "value-policy-violation",
          vanillaValue: '"invalid"',
          spoofedValue: '"invalid"',
          valueProbePattern: "^ok$",
          valueProbeDescription: "roundtrip parse should stay usable",
        },
      ],
      [...targets],
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "compatibility",
      severity: "WARNING",
      api: "Date.prototype.toString(parseable)",
    });
    expect(findings[0]?.message).toContain("roundtrip parse should stay usable");
  });
});
