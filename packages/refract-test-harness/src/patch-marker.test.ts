import {
  inspectPatchAnchors,
  markPatchAnchor,
} from "@privacy-brand/refract-core/runtime/patch-marker";
import { describe, expect, it } from "vitest";

const KEY = "patch-marker-test";

describe("descriptor-aware patch markers", () => {
  it("does not treat an absent marker as an installation", () => {
    expect(
      inspectPatchAnchors(KEY, [{ fn: function nativeLike() {}, name: "first" }]),
    ).toBe("absent");
  });

  it("accepts only a complete set of exact anchors", () => {
    const first = function first() {};
    const second = function second() {};
    markPatchAnchor(first, KEY, "first");
    markPatchAnchor(second, KEY, "second");

    expect(
      inspectPatchAnchors(KEY, [
        { fn: first, name: "first" },
        { fn: second, name: "second" },
      ]),
    ).toBe("installed");
  });

  it("reports partial or malformed anchors as conflicts", () => {
    const first = function first() {};
    const second = function second() {};
    markPatchAnchor(first, KEY, "first");

    expect(
      inspectPatchAnchors(KEY, [
        { fn: first, name: "first" },
        { fn: second, name: "second" },
      ]),
    ).toBe("conflict");

    Object.defineProperty(second, Symbol.for(KEY), {
      configurable: true,
      value: "second",
    });
    expect(inspectPatchAnchors(KEY, [{ fn: second, name: "second" }])).toBe("conflict");
  });

  it("does not accept copied public symbols as installation evidence", () => {
    const legitimate = function legitimate() {};
    markPatchAnchor(legitimate, KEY, "first");
    expect(Object.getOwnPropertySymbols(legitimate)).toEqual([]);

    const forged = function forged() {};
    Object.defineProperty(forged, Symbol.for(KEY), {
      configurable: false,
      enumerable: false,
      writable: false,
      value: "first",
    });

    expect(inspectPatchAnchors(KEY, [{ fn: forged, name: "first" }])).toBe("conflict");
  });
});
