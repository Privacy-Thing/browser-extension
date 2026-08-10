import {
  parseFirefoxHashSeed,
  type FirefoxWindowSeedState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { describe, expect, it } from "vitest";

import { buildFxHashRedirect } from "@/background/firefox-hash-navigation";

const createSeedState = (): FirefoxWindowSeedState => ({
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
          language: "pl-PL",
          languages: ["pl-PL", "pl"],
          timeZone: "Europe/Warsaw",
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

describe("buildFxHashRedirect", () => {
  it("builds a seeded redirect for matched GET navigations", () => {
    const redirectUrl = buildFxHashRedirect({
      method: "GET",
      url: "https://example.com/path?demo=1#target",
      seedState: createSeedState(),
    });

    expect(redirectUrl).not.toBeNull();
    expect(parseFirefoxHashSeed(new URL(redirectUrl!).hash)).toEqual({
      originalHash: "#target",
      state: createSeedState().entries[0]!.state,
    });
  });

  it("skips POST navigations", () => {
    expect(
      buildFxHashRedirect({
        method: "POST",
        url: "https://example.com/submit",
        seedState: createSeedState(),
      }),
    ).toBeNull();
  });

  it("skips redirects on same-host navigations from an existing document", () => {
    expect(
      buildFxHashRedirect({
        currentTabUrl: "https://example.com/",
        method: "GET",
        url: "https://example.com/path",
        seedState: createSeedState(),
      }),
    ).toBeNull();
  });

  it("keeps redirects for reloads on the same host", () => {
    const redirectUrl = buildFxHashRedirect({
      currentTabUrl: "https://example.com/path",
      method: "GET",
      url: "https://example.com/path",
      seedState: createSeedState(),
    });

    expect(redirectUrl).not.toBeNull();
    expect(parseFirefoxHashSeed(new URL(redirectUrl!).hash)).toEqual({
      originalHash: "",
      state: createSeedState().entries[0]!.state,
    });
  });

  it("keeps redirects when the protocol changes", () => {
    const redirectUrl = buildFxHashRedirect({
      currentTabUrl: "http://example.com/path",
      method: "GET",
      url: "https://example.com/path",
      seedState: createSeedState(),
    });

    expect(redirectUrl).not.toBeNull();
  });

  it("keeps redirects when the port changes", () => {
    const redirectUrl = buildFxHashRedirect({
      currentTabUrl: "https://example.com:8443/path",
      method: "GET",
      url: "https://example.com/path",
      seedState: createSeedState(),
    });

    expect(redirectUrl).not.toBeNull();
  });

  it("skips unmatched hosts", () => {
    expect(
      buildFxHashRedirect({
        method: "GET",
        url: "https://unmatched.test/path",
        seedState: createSeedState(),
      }),
    ).toBeNull();
  });

  it("skips invalid or already seeded URLs", () => {
    const seededUrl = buildFxHashRedirect({
      method: "GET",
      url: "https://example.com/path",
      seedState: createSeedState(),
    });

    expect(
      buildFxHashRedirect({
        method: "GET",
        url: seededUrl!,
        seedState: createSeedState(),
      }),
    ).toBeNull();
    expect(
      buildFxHashRedirect({
        method: "GET",
        url: "not-a-url",
        seedState: createSeedState(),
      }),
    ).toBeNull();
  });
});
