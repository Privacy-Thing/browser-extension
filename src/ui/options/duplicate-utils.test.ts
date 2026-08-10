import { describe, expect, it } from "vitest";

import { duplicateLocation } from "@/ui/options/duplicate-utils";

describe("duplicateLocation", () => {
  it("creates a copied location with a unique id and readable label", () => {
    const result = duplicateLocation(
      {
        id: "warsaw",
        label: "Warsaw",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
        language: "pl-PL",
        languages: ["pl-PL", "pl"],
        timeZone: "Europe/Warsaw",
      },
      ["warsaw", "warsaw-copy"],
    );

    expect(result.id).toBe("warsaw-copy-2");
    expect(result.label).toBe("Warsaw copy");
    expect(result.timeZone).toBe("Europe/Warsaw");
  });
});
