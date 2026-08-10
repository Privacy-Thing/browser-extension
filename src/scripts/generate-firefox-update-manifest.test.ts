import { describe, expect, it } from "vitest";

import { BETA_FX_EXT_ID, BRAND_ARTIFACT_STEM } from "../../scripts/brand-config.mjs";
import { buildFxUpdateManifest } from "../../scripts/generate-firefox-update-manifest.mjs";

const BETA_UPDATE_PACKAGE_URL = `https://example.test/firefox/${BRAND_ARTIFACT_STEM}-beta.xpi`;

describe("generate-firefox-update-manifest", () => {
  it("builds a Firefox self-hosted update manifest", () => {
    expect(
      buildFxUpdateManifest({
        addonId: BETA_FX_EXT_ID,
        version: "0.2026.410.1835",
        updateLink: BETA_UPDATE_PACKAGE_URL,
      }),
    ).toEqual({
      addons: {
        [BETA_FX_EXT_ID]: {
          updates: [
            {
              version: "0.2026.410.1835",
              update_link: BETA_UPDATE_PACKAGE_URL,
            },
          ],
        },
      },
    });
  });

  it("rejects non-https update links", () => {
    expect(() =>
      buildFxUpdateManifest({
        addonId: BETA_FX_EXT_ID,
        version: "0.2026.410.1835",
        updateLink: `http://example.com/${BRAND_ARTIFACT_STEM}-beta.xpi`,
      }),
    ).toThrow("Firefox update_link must use https");
  });
});
