import { maskAsNative } from "@privacy-brand/refract-core";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("native mask helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to local native sources when top-owner property access throws", () => {
    const blockedOwner = new Proxy(
      {},
      {
        get(_target, property) {
          if (typeof property === "symbol") {
            throw new DOMException(
              "Blocked a frame with origin from accessing a cross-origin frame.",
              "SecurityError",
            );
          }

          return undefined;
        },
        defineProperty(_target, property) {
          if (typeof property === "symbol") {
            throw new DOMException(
              "Blocked a frame with origin from accessing a cross-origin frame.",
              "SecurityError",
            );
          }

          return true;
        },
      },
    );

    vi.stubGlobal("top", blockedOwner);

    const fn = maskAsNative(function example() {
      return 1;
    }, "function example() { [native code] }");

    expect(() => fn()).not.toThrow();
    expect(fn.toString()).toBe("function example() { [native code] }");
  });
});
