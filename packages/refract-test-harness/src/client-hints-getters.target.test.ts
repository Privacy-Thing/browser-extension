import {
  cloneClientHintBrands,
  DIRECT_ENTROPY_HINTS,
  HIGH_ENTROPY_GETTERS,
  ENTROPY_GETTERS_SOURCE,
} from "@privacy-brand/refract-core";
import type { BrowserClientHints } from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

describe("client-hints-getters", () => {
  const clientHints: BrowserClientHints = {
    architecture: "arm",
    bitness: "64",
    platformVersion: "15.4.0",
    model: "MacBookPro",
    formFactors: ["Desktop"],
    wow64: false,
    fullVersionList: [
      { brand: "Chromium", version: "139.0.7201.45" },
      { brand: "NotAChromiumBrand", version: "1.0.0.0" },
    ],
    mobile: false,
    platform: "macOS",
  };

  it("exposes direct getters and uaFullVersion from one shared map", () => {
    expect(DIRECT_ENTROPY_HINTS).toEqual([
      "architecture",
      "bitness",
      "platformVersion",
      "model",
      "formFactors",
      "wow64",
      "fullVersionList",
      "mobile",
      "platform",
      "deviceMemory",
    ]);
    expect(HIGH_ENTROPY_GETTERS.architecture(clientHints)).toBe("arm");
    expect(HIGH_ENTROPY_GETTERS.platform(clientHints)).toBe("macOS");
    expect(HIGH_ENTROPY_GETTERS.uaFullVersion(clientHints)).toBe("139.0.7201.45");
  });

  it("does not invoke inherited array index setters for public hint arrays", () => {
    let intercepted: unknown;
    let brands: ReturnType<typeof cloneClientHintBrands>;
    let formFactors: unknown;

    Object.defineProperty(Array.prototype, "0", {
      configurable: true,
      set(value) {
        intercepted = value;
      },
    });
    try {
      brands = cloneClientHintBrands(clientHints.fullVersionList);
      formFactors = HIGH_ENTROPY_GETTERS.formFactors(clientHints);
    } finally {
      delete (Array.prototype as unknown as Record<string, unknown>)["0"];
    }

    expect(intercepted).toBeUndefined();
    expect(brands).toEqual(clientHints.fullVersionList);
    expect(formFactors).toEqual(["Desktop"]);
    expect(Object.hasOwn(brands as object, "0")).toBe(true);
    expect(Object.hasOwn(formFactors as object, "0")).toBe(true);
  });

  it("builds the worker inline source from the same shared definitions", () => {
    expect(ENTROPY_GETTERS_SOURCE).toContain("function getUaFullVersion(clientHints)");
    expect(ENTROPY_GETTERS_SOURCE).toContain("const HIGH_ENTROPY_GETTERS={");
    expect(ENTROPY_GETTERS_SOURCE).toContain(
      "architecture:(hints)=>hints.architecture",
    );
    expect(ENTROPY_GETTERS_SOURCE).toContain("uaFullVersion:getUaFullVersion");
  });
});
