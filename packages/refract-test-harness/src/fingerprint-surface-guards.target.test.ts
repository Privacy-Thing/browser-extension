import {
  FP_SURFACE_GUARDS_SOURCE,
  isFpSurfaceEnabled,
  type RuntimeSnapshot,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

describe("isFpSurfaceEnabled", () => {
  const baseFingerprint: RuntimeSnapshot["fingerprint"] = {
    spoofingToggles: {},
  };

  it("treats missing fingerprint data as enabled by default", () => {
    expect(isFpSurfaceEnabled(undefined, "canvas")).toBe(true);
    expect(isFpSurfaceEnabled(null, "webGL")).toBe(true);
  });

  it("treats missing per-surface toggles as enabled", () => {
    expect(isFpSurfaceEnabled(baseFingerprint, "audio")).toBe(true);
  });

  it("treats explicit false toggle as disabled", () => {
    expect(
      isFpSurfaceEnabled({ spoofingToggles: { clientHints: false } }, "clientHints"),
    ).toBe(false);
  });

  it("exports a literal worker inline source for the same helper", () => {
    expect(FP_SURFACE_GUARDS_SOURCE).toContain(
      "function isFpSurfaceEnabled(fingerprint, surface)",
    );
    expect(FP_SURFACE_GUARDS_SOURCE).not.toContain("__vite_ssr_import_");
  });
});
