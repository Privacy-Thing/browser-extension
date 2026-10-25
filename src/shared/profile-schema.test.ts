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
  it.each(["accuracy", "noiseRadius"] as const)(
    "rejects an infinite %s, which would remove the privacy bound",
    (field) => {
      expect(
        locationProfileSchema.safeParse({ ...location, [field]: Infinity }).success,
      ).toBe(false);
    },
  );

  it("still defaults an omitted noiseRadius", () => {
    const { noiseRadius: _omitted, ...rest } = location;
    expect(locationProfileSchema.parse(rest).noiseRadius).toBe(50);
  });
});
