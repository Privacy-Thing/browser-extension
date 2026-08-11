import { isLocalDateString } from "@privacy-brand/refract-core/time/zoned-date-semantics";
import { describe, expect, it } from "vitest";

describe("isLocalDateString", () => {
  it.each([
    "2026-08-11T12:30:00Z",
    "2026-08-11T12:30:00+0200",
    "2026-08-11T12:30:00-02:30",
    "Tue Aug 11 2026 12:30:00 GMT+0200",
    "Tue Aug 11 2026 12:30:00 GMT+0200 (Central European Summer Time)",
  ])("recognizes an explicit timezone in %s", (value) => {
    expect(isLocalDateString(value)).toBe(false);
  });

  it.each([
    "2026-08-11T12:30:00",
    "Tue Aug 11 2026 12:30:00",
    "Tue Aug 11 2026 12:30:00 GMT+0200 (unterminated",
    "Tue Aug 11 2026 12:30:00 GMT+0200 (outer(inner))",
    "Tue Aug 11 2026 12:30:00 GMT+0200 (description))",
    "Tue Aug 11 2026 12:30:00 GMT+0200 ((description)",
  ])("keeps a timezone-free or malformed value local in %s", (value) => {
    expect(isLocalDateString(value)).toBe(true);
  });

  it("handles a long adversarial suffix linearly", () => {
    const value = `2026-08-11T12:30:00z${"(".repeat(100_000)}`;
    expect(isLocalDateString(value)).toBe(true);
  });

  it("keeps ISO date-only values outside local date-time parsing", () => {
    expect(isLocalDateString("2026-08-11")).toBe(false);
  });
});
