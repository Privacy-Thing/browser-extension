import { describe, expect, it } from "vitest";

import {
  formatNumberInputValue,
  isPartialNumber,
  parseNumberInputValue,
} from "./number-input";

describe("number-input helpers", () => {
  it("accepts partial decimal strings with dot or comma separators", () => {
    expect(isPartialNumber("12.")).toBe(true);
    expect(isPartialNumber("12,")).toBe(true);
    expect(isPartialNumber("-0,5")).toBe(true);
    expect(isPartialNumber("12,3.4")).toBe(false);
  });

  it("parses both dot and comma decimal separators", () => {
    expect(parseNumberInputValue("52.2297")).toBe(52.2297);
    expect(parseNumberInputValue("52,2297")).toBe(52.2297);
    expect(parseNumberInputValue("-0,125")).toBe(-0.125);
  });

  it("treats incomplete tokens as uncommitted values", () => {
    expect(parseNumberInputValue("")).toBeNull();
    expect(parseNumberInputValue("-")).toBeNull();
    expect(parseNumberInputValue(".")).toBeNull();
    expect(parseNumberInputValue("-.")).toBeNull();
  });

  it("formats controlled values without altering empty inputs", () => {
    expect(formatNumberInputValue(undefined)).toBe("");
    expect(formatNumberInputValue("")).toBe("");
    expect(formatNumberInputValue(12.5)).toBe("12.5");
  });
});
