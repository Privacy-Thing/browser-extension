import { describe, expect, it } from "vitest";

import { extractSteamSurveyText } from "../../scripts/steam-survey-text.mjs";

describe("extractSteamSurveyText", () => {
  it("extracts labels from nested survey markup", () => {
    expect(
      extractSteamSurveyText("<span>1920 <strong>x</strong> 1080</span>\u00a0"),
    ).toBe("1920 x 1080");
  });

  it("does not recreate markup from malformed delimiters", () => {
    expect(extractSteamSurveyText("<<script>script>alert(1)</script>>CPU")).toBe(
      "script alert(1) CPU",
    );
    expect(extractSteamSurveyText("RAM <unfinished")).toBe("RAM");
  });
});
