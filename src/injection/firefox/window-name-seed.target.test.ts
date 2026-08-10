import type { FirefoxWindowSeedState } from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { describe, expect, it } from "vitest";

import {
  buildFxWindowSeed,
  canPersistFxWindowSeed,
  parseFirefoxWindowSeed,
} from "@/injection/firefox/window-name-seed";

const PREFIX = "\u001f\u001e";

const createSeedState = (language = "pl-PL"): FirefoxWindowSeedState => ({
  entries: [
    {
      pattern: "example.com",
      state: {
        bootstrap: {
          revision: 1,
        },
        geoStatus: "ready",
        geo: {
          latitude: 52.23,
          longitude: 21.01,
          accuracy: 25,
          noiseRadius: 100,
          watchPositionDelay: [60, 500],
        },
        timeLocaleStatus: "ready",
        timeLocale: {
          language,
          languages: [language],
          timeZone: language === "pl-PL" ? "Europe/Warsaw" : "Europe/Berlin",
          offsetMinutes: -60,
        },
        fingerprintStatus: "ready",
        fingerprint: {
          hardwareConcurrency: 8,
          platform: "Win32",
        },
        debug: null,
        blockServiceWorkerRegistration: false,
      },
    },
  ],
  containerState: null,
});

describe("Firefox window.name seed helpers", () => {
  it("round-trips a payload while preserving the previous name", () => {
    const value = buildFxWindowSeed("existing-name", createSeedState(), PREFIX);

    expect(parseFirefoxWindowSeed(value, PREFIX)).toEqual({
      previousName: "existing-name",
      seedState: createSeedState(),
    });
  });

  it("reuses the original previous name instead of nesting seeds", () => {
    const first = buildFxWindowSeed("existing-name", createSeedState(), PREFIX);
    const second = buildFxWindowSeed(first, createSeedState("de-DE"), PREFIX);

    expect(parseFirefoxWindowSeed(second, PREFIX)).toEqual({
      previousName: "existing-name",
      seedState: createSeedState("de-DE"),
    });
  });

  it("allows rewriting the same seed but preserves a fresher different seed", () => {
    const current = buildFxWindowSeed(
      "existing-name",
      createSeedState("de-DE"),
      PREFIX,
    );

    expect(canPersistFxWindowSeed("", createSeedState(), PREFIX)).toBe(true);
    expect(canPersistFxWindowSeed(current, createSeedState("de-DE"), PREFIX)).toBe(
      true,
    );
    expect(canPersistFxWindowSeed(current, createSeedState(), PREFIX)).toBe(false);
  });

  it("rejects legacy window.name payloads without the current build key", () => {
    const { bootstrap: _bootstrap, ...legacyState } =
      createSeedState().entries[0]!.state;
    const legacyValue = `${PREFIX}${btoa(
      JSON.stringify({
        previousName: "existing-name",
        seedState: {
          entries: [
            {
              pattern: "example.com",
              state: legacyState,
            },
          ],
          containerState: null,
        },
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "")}`;

    expect(parseFirefoxWindowSeed(legacyValue, PREFIX)).toBeNull();
  });

  it("rejects payloads from a different build key", () => {
    const mismatchedValue = `${PREFIX}${btoa(
      JSON.stringify({
        buildKey: "stale-build",
        previousName: "existing-name",
        seedState: createSeedState(),
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "")}`;

    expect(parseFirefoxWindowSeed(mismatchedValue, PREFIX)).toBeNull();
  });
});
