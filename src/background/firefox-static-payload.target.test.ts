import {
  takeFxStaticState,
  type FirefoxShimState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { describe, expect, it } from "vitest";

import {
  buildFxStateCandidate,
  buildFxSeedSource,
} from "@/background/firefox-static-payload";
import {
  FX_STATIC_CANDIDATES_KEY,
  SHIM_GUARD_KEY,
} from "@/shared/build-id-test-values";

const createShimState = (revision: number): FirefoxShimState => ({
  bootstrap: { revision },
  geoStatus: "absent",
  geo: null,
  timeLocaleStatus: "ready",
  timeLocale: {
    language: "en-CA",
    languages: ["en-CA", "en"],
    timeZone: "America/Toronto",
    offsetMinutes: 240,
  },
  fingerprintStatus: "absent",
  fingerprint: null,
  debug: null,
});

describe("buildFxStateCandidate", () => {
  it("derives specificity metadata from the rule pattern", () => {
    expect(
      buildFxStateCandidate({
        pattern: "*.example.com",
        state: createShimState(1),
      }),
    ).toEqual({
      buildKey: SHIM_GUARD_KEY,
      pattern: "*.example.com",
      specificity: {
        nonWildcardLength: 12,
        exactMatchBonus: 0,
        subdomainOnlyBonus: 1,
        wildcardCount: 1,
      },
      state: createShimState(1),
    });
  });
});

describe("buildFxSeedSource", () => {
  it("appends a state candidate to the shared global carrier", () => {
    const candidate = buildFxStateCandidate({
      pattern: "example.com",
      state: createShimState(1),
    });

    const globalRecord = globalThis as Record<string | symbol, unknown>;
    const symbol = Symbol.for(FX_STATIC_CANDIDATES_KEY);
    delete globalRecord[symbol];

    try {
      const source = buildFxSeedSource(candidate);
      const runSource = new Function(source) as () => void;
      runSource();

      expect(takeFxStaticState(globalThis, "example.com")).toEqual(candidate.state);
    } finally {
      delete globalRecord[symbol];
    }
  });

  it("leaves the carrier property non-enumerable", () => {
    const candidate = buildFxStateCandidate({
      pattern: "example.com",
      state: createShimState(1),
    });

    const globalRecord = globalThis as Record<string | symbol, unknown>;
    const symbol = Symbol.for(FX_STATIC_CANDIDATES_KEY);
    delete globalRecord[symbol];

    try {
      const source = buildFxSeedSource(candidate);
      const runSource = new Function(source) as () => void;
      runSource();

      const descriptor = Object.getOwnPropertyDescriptor(globalRecord, symbol);
      expect(descriptor?.enumerable).toBe(false);
    } finally {
      delete globalRecord[symbol];
    }
  });
});
