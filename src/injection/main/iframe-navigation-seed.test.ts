import { describe, expect, it } from "vitest";

import {
  isIframeSrcAttribute,
  isIframeSrcdocAttribute,
  sameOriginSeedHostname,
} from "@/injection/main/iframe-navigation-seed";

describe("iframe navigation seed policy", () => {
  it("recognizes src attributes without allocating normalized names", () => {
    expect(isIframeSrcAttribute("src")).toBe(true);
    expect(isIframeSrcAttribute("SRC")).toBe(true);
    expect(isIframeSrcAttribute("srcdoc")).toBe(false);
    expect(isIframeSrcdocAttribute("SrcDoc")).toBe(true);
  });

  it("accepts relative and absolute same-origin destinations", () => {
    expect(
      sameOriginSeedHostname(
        "/frame",
        "https://example.test/page",
        "https://example.test",
      ),
    ).toBe("example.test");
    expect(
      sameOriginSeedHostname(
        "https://example.test/frame",
        "https://example.test/page",
        "https://example.test",
      ),
    ).toBe("example.test");
  });

  it("rejects cross-origin, empty and invalid destinations", () => {
    expect(
      sameOriginSeedHostname(
        "https://other.test/frame",
        "https://example.test/page",
        "https://example.test",
      ),
    ).toBeNull();
    expect(
      sameOriginSeedHostname(
        "https://example.test:444/frame",
        "https://example.test/page",
        "https://example.test",
      ),
    ).toBeNull();
    expect(
      sameOriginSeedHostname(" ", "https://example.test/page", "https://example.test"),
    ).toBeNull();
    expect(
      sameOriginSeedHostname(
        "https://[invalid",
        "https://example.test/page",
        "https://example.test",
      ),
    ).toBeNull();
  });

  it("trims destinations with the captured String.prototype.trim", () => {
    const nativeTrim = String.prototype.trim;
    String.prototype.trim = () => "";
    try {
      expect(
        sameOriginSeedHostname(
          "  /frame  ",
          "https://example.test/page",
          "https://example.test",
        ),
      ).toBe("example.test");
    } finally {
      String.prototype.trim = nativeTrim;
    }
  });
});
