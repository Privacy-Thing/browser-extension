import { describe, expect, it } from "vitest";

import {
  controlDEndpointName,
  controlDFolderName,
  controlDProfileName,
  controlDRuleComment,
  generateResourceCode,
  parseControlDProfileCode,
} from "./resource-names";

const CODE = "ABCDE-FGHJK";

describe("Control D resource names", () => {
  it("uses readable names within the live API limit", () => {
    expect(controlDProfileName(CODE)).toBe("Privacy Thing ABCDE-FGHJK");
    expect(controlDEndpointName(CODE, "chromium")).toBe("PT Browser ABCDE-FGHJK");
    expect(controlDEndpointName(CODE, "firefox")).toBe("PT Firefox ABCDE-FGHJK");
    expect(controlDFolderName(CODE, "WAW")).toBe("PT ABCDE-FGHJK WAW");
    expect(controlDRuleComment(CODE)).toBe("PT ABCDE-FGHJK");
    expect(
      controlDFolderName(CODE, "an-arbitrarily-long-proxy-primary-key").length,
    ).toBeLessThanOrEqual(32);
  });

  it("generates a hardware-independent Crockford Base32 code", () => {
    const code = generateResourceCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
  });

  it("recovers only the new exact profile format", () => {
    expect(parseControlDProfileCode("Privacy Thing ABCDE-FGHJK")).toBe(CODE);
    expect(parseControlDProfileCode("Privacy Thing 123e4567e89b12d3")).toBeNull();
    expect(parseControlDProfileCode("Renamed Privacy Thing ABCDE-FGHJK")).toBeNull();
  });
});
