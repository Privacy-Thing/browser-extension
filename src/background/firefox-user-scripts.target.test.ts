import type { FirefoxShimState } from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { describe, expect, it } from "vitest";

import {
  buildUserScriptMatches,
  createUserScriptRegs,
} from "@/background/firefox-user-scripts";
import { FX_STATIC_CANDIDATES_KEY } from "@/shared/build-id-test-values";
import { buildFxSeedScriptId } from "@/shared/extension-contract";

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

describe("createUserScriptRegs", () => {
  it("limits the global wildcard pattern to http and https URLs", () => {
    expect(buildUserScriptMatches("*")).toEqual(["http://*/*", "https://*/*"]);
  });

  it("builds one static state-seed registration per ordinary matched rule", () => {
    const registrations = createUserScriptRegs({
      ruleEntries: [
        {
          pattern: "example.com",
          state: createShimState(1),
        },
        {
          pattern: "*.example.com",
          state: createShimState(2),
        },
      ],
    });

    expect(registrations).toHaveLength(2);
    expect(registrations[0]).toMatchObject({
      id: buildFxSeedScriptId(0),
      matches: ["*://example.com/*"],
      allFrames: true,
      runAt: "document_start",
      world: "MAIN",
    });
    expect(registrations[0]?.js[0]).toMatchObject({
      code: expect.stringContaining(JSON.stringify(FX_STATIC_CANDIDATES_KEY)),
    });
    expect(registrations[0]).not.toHaveProperty("cookieStoreId");
    expect(registrations[1]).toMatchObject({
      id: buildFxSeedScriptId(1),
      matches: ["*://*.example.com/*"],
    });
  });

  it("keeps multi-wildcard leading-star patterns as ordinary wildcard matches", () => {
    expect(buildUserScriptMatches("*a*b.example.com")).toEqual([
      "*://*a*b.example.com/*",
    ]);
  });

  it("excludes Trusted Sites from wildcard static seeds", () => {
    const registrations = createUserScriptRegs({
      ruleEntries: [{ pattern: "*", state: createShimState(1) }],
      trustedPatterns: ["trusted.example.com"],
    });

    expect(registrations[0]?.excludeMatches).toEqual(["*://trusted.example.com/*"]);
  });
});
