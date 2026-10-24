import { describe, expect, it } from "vitest";

import { createUniqueLocationId } from "@/shared/location-id";
import { isReservedKey } from "@/shared/reserved-keys";

describe("reserved keys", () => {
  it("covers every inherited Object.prototype member and prototype", () => {
    for (const name of [...Object.getOwnPropertyNames(Object.prototype), "prototype"])
      expect(isReservedKey(name), name).toBe(true);
  });

  it("matches exactly, so lowercase slugs of other members stay usable", () => {
    for (const name of ["tostring", "ToString", "valueof", "proto", " constructor"])
      expect(isReservedKey(name), name).toBe(false);
  });
});

describe("preset ID generator", () => {
  it("never emits a reserved name for a label", () => {
    expect(createUniqueLocationId("Constructor", [], "profile")).toBe("constructor-2");
    expect(createUniqueLocationId(" Prototype ", ["prototype-2"], "profile")).toBe(
      "prototype-3",
    );
    expect(createUniqueLocationId("__proto__", [], "profile")).toBe("proto");
  });

  it("keeps ordinary slugs, numbering and the fallback", () => {
    expect(createUniqueLocationId("Warsaw, Poland", [], "profile")).toBe(
      "warsaw-poland",
    );
    expect(createUniqueLocationId("Warsaw", ["warsaw"], "profile")).toBe("warsaw-2");
    expect(createUniqueLocationId("東京", ["profile"], "profile")).toBe("profile-2");
  });
});
