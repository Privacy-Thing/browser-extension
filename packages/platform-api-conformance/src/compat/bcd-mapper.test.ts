import { BRAND_DISPLAY_NAME } from "@privacy-brand/tooling-shared/brand";
import { describe, it, expect } from "vitest";

import { mapToBcdKey } from "./bcd-mapper.js";

describe("BCD Mapper", () => {
  it("should map standard prototype properties", () => {
    expect(mapToBcdKey("Navigator.prototype.userAgent")).toBe(
      "api.Navigator.userAgent",
    );
    expect(mapToBcdKey("Date.prototype.getTimezoneOffset")).toBe(
      "javascript.builtins.Date.getTimezoneOffset",
    );
  });

  it("should map global constructors", () => {
    expect(mapToBcdKey("globalThis.Date")).toBe("javascript.builtins.Date.Date");
    expect(mapToBcdKey("window.Worker")).toBe("api.Worker.Worker");
    expect(mapToBcdKey("self.SharedWorker")).toBe("api.SharedWorker.SharedWorker");
  });

  it("should map static methods", () => {
    expect(mapToBcdKey("Date.now")).toBe("javascript.builtins.Date.now");
    expect(mapToBcdKey("Date.parse")).toBe("javascript.builtins.Date.parse");
  });

  it("should map Intl properties", () => {
    expect(mapToBcdKey("Intl.DateTimeFormat")).toBe(
      "javascript.builtins.Intl.DateTimeFormat",
    );
  });

  it("should strip out generic global prefixes for direct web APIs", () => {
    // Some implementations might inject e.g. window.navigator.language
    expect(mapToBcdKey("window.navigator.language")).toBe("api.Navigator.language");
  });

  it("should return null for completely unknown/custom APIs", () => {
    expect(mapToBcdKey(`${BRAND_DISPLAY_NAME}.secretAPI`)).toBeNull();
    expect(mapToBcdKey("UNKNOWN_TARGET.property")).toBeNull();
  });
});
