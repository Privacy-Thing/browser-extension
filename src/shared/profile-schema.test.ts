import { describe, expect, it } from "vitest";

import { locationProfileSchema } from "@/shared/profile-schema";

const location = {
  id: "warsaw",
  label: "Warsaw",
  latitude: 52.2297,
  longitude: 21.0122,
  accuracy: 25,
  noiseRadius: 50,
  language: "pl-PL",
  languages: ["pl-PL", "pl"],
  timeZone: "Europe/Warsaw",
};

describe("locationProfileSchema", () => {
  // zod 3 accepted +Infinity and Firefox storage keeps it; saving must not fail.
  it.each(["accuracy", "noiseRadius"] as const)(
    "keeps a stored infinite %s",
    (field) => {
      expect(
        locationProfileSchema.parse({ ...location, [field]: Infinity })[field],
      ).toBe(Infinity);
    },
  );

  it.each([-Infinity, NaN])("rejects %s as accuracy", (accuracy) => {
    expect(locationProfileSchema.safeParse({ ...location, accuracy }).success).toBe(
      false,
    );
  });

  it("still defaults an omitted noiseRadius", () => {
    const { noiseRadius: _omitted, ...rest } = location;
    expect(locationProfileSchema.parse(rest).noiseRadius).toBe(50);
  });
});
