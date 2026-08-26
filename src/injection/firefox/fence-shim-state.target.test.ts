import type { FirefoxShimState } from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { describe, expect, it } from "vitest";

import { fenceFxShimState } from "@/injection/firefox/fence-shim-state";
import { deriveFenceBaseKey } from "@/shared/domain-fencing";

const baseState = (fingerprint: FirefoxShimState["fingerprint"]): FirefoxShimState => ({
  bootstrap: { revision: 1 },
  geoStatus: "absent",
  geo: null,
  timeLocaleStatus: "absent",
  timeLocale: null,
  fingerprintStatus: fingerprint ? "ready" : "absent",
  fingerprint,
  debug: null,
});

describe("fenceFxShimState", () => {
  it("is a no-op without a fencing marker", () => {
    const state = baseState({ canvasNoiseSeed: 111 });
    expect(fenceFxShimState(state, "example.com")).toBe(state);
  });

  it("fences noise seeds per site and strips the marker", () => {
    const marked = (): FirefoxShimState =>
      baseState({
        canvasNoiseSeed: 111,
        fencing: { key: deriveFenceBaseKey("abc123") },
      });
    const first = fenceFxShimState(marked(), "example.com");
    const second = fenceFxShimState(marked(), "other.org");
    expect(first.fingerprint?.fencing).toBeUndefined();
    expect(first.fingerprint?.canvasNoiseSeed).not.toBe(111);
    expect(first.fingerprint?.canvasNoiseSeed).not.toBe(
      second.fingerprint?.canvasNoiseSeed,
    );
  });
});
