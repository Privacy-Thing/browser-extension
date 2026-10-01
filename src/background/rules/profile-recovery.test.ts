import { describe, expect, it } from "vitest";

import { recoverInvalidProfile } from "./profile-recovery";

import { InvalidTimeZoneError } from "@/shared/time-zone-validation";

describe("catalog profile recovery", () => {
  it("does not swallow an unrelated snapshot build failure", () => {
    const error = new Error("storage unavailable");
    expect(() =>
      recoverInvalidProfile(
        () => {
          throw error;
        },
        () => null,
      ),
    ).toThrow(error);
  });
  it("recovers the typed legacy time zone failure", () => {
    expect(
      recoverInvalidProfile(
        () => {
          throw new InvalidTimeZoneError("invalid");
        },
        () => null,
      ),
    ).toBeNull();
  });
});
