import { describe, expect, it } from "vitest";

import {
  BETA_FX_EXT_ID,
  BETA_BRAND_DISPLAY_NAME,
  BETA_ICON_ASSET_DIR,
  STABLE_FX_EXT_ID,
  STABLE_DISPLAY_NAME,
  STABLE_ICON_ASSET_DIR,
  normalizeBuildChannel,
  resolveBrandDisplayName,
  resolveBrandIconAssetDir,
  resolveFxExtId,
  resolveFirefoxUpdateUrl,
  shouldEmitBuildMaps,
} from "../../scripts/brand-config.mjs";

describe("brand-config channel helpers", () => {
  it("normalizes legacy next channel to beta", () => {
    expect(normalizeBuildChannel("next")).toBe("beta");
  });

  it("keeps the stable Firefox ID for release", () => {
    expect(resolveFxExtId("release")).toBe(STABLE_FX_EXT_ID);
  });

  it("uses the beta Firefox ID for local and beta builds", () => {
    expect(resolveFxExtId("local")).toBe(BETA_FX_EXT_ID);
    expect(resolveFxExtId("beta")).toBe(BETA_FX_EXT_ID);
    expect(resolveFxExtId("next")).toBe(BETA_FX_EXT_ID);
  });

  it("does not invent a Firefox update URL for local and beta builds", () => {
    expect(resolveFirefoxUpdateUrl("local")).toBe("");
    expect(resolveFirefoxUpdateUrl("beta")).toBe("");
    expect(resolveFirefoxUpdateUrl("next")).toBe("");
  });

  it("uses an explicitly configured Firefox update URL for non-release builds", () => {
    const updateUrl = "https://example.test/firefox/updates.json";

    expect(resolveFirefoxUpdateUrl("local", updateUrl)).toBe(updateUrl);
    expect(resolveFirefoxUpdateUrl("beta", updateUrl)).toBe(updateUrl);
    expect(resolveFirefoxUpdateUrl("next", updateUrl)).toBe(updateUrl);
  });

  it("does not set a Firefox update URL for release builds", () => {
    expect(resolveFirefoxUpdateUrl("release")).toBe("");
  });

  it("uses the beta display name for beta builds only", () => {
    expect(resolveBrandDisplayName("beta")).toBe(BETA_BRAND_DISPLAY_NAME);
    expect(resolveBrandDisplayName("next")).toBe(BETA_BRAND_DISPLAY_NAME);
    expect(resolveBrandDisplayName("local")).toBe(STABLE_DISPLAY_NAME);
    expect(resolveBrandDisplayName("release")).toBe(STABLE_DISPLAY_NAME);
  });

  it("uses a dedicated icon asset directory for beta builds only", () => {
    expect(resolveBrandIconAssetDir("beta")).toBe(BETA_ICON_ASSET_DIR);
    expect(resolveBrandIconAssetDir("next")).toBe(BETA_ICON_ASSET_DIR);
    expect(resolveBrandIconAssetDir("local")).toBe(STABLE_ICON_ASSET_DIR);
    expect(resolveBrandIconAssetDir("release")).toBe(STABLE_ICON_ASSET_DIR);
  });

  it("emits sourcemaps only for local builds", () => {
    expect(shouldEmitBuildMaps("local")).toBe(true);
    expect(shouldEmitBuildMaps("beta")).toBe(false);
    expect(shouldEmitBuildMaps("next")).toBe(false);
    expect(shouldEmitBuildMaps("release")).toBe(false);
  });
});
