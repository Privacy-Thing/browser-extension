import { describe, expect, it } from "vitest";

import {
  BRAND_ARTIFACT_STEM,
  buildArtifactFileName,
  buildSourceArchiveName,
  buildSourceArchivePrefix,
  buildBrandTempDirPrefix,
} from "../../scripts/brand-config.mjs";

describe("brand-config artifact helpers", () => {
  it("builds artifact filenames from the centralized artifact stem", () => {
    expect(buildArtifactFileName("v1.2.3", "chromium", "zip")).toBe(
      `${BRAND_ARTIFACT_STEM}-v1.2.3-chromium.zip`,
    );
    expect(buildArtifactFileName("beta-20260524", "firefox", "xpi")).toBe(
      `${BRAND_ARTIFACT_STEM}-beta-20260524-firefox.xpi`,
    );
  });

  it("builds source archive names and prefixes from the centralized artifact stem", () => {
    expect(buildSourceArchiveName("v1.2.3")).toBe(
      `${BRAND_ARTIFACT_STEM}-v1.2.3-source.zip`,
    );
    expect(buildSourceArchivePrefix("v1.2.3")).toBe(
      `${BRAND_ARTIFACT_STEM}-v1.2.3-source/`,
    );
  });

  it("builds temporary directory prefixes from the centralized artifact stem", () => {
    expect(buildBrandTempDirPrefix("source")).toBe(`${BRAND_ARTIFACT_STEM}-source-`);
  });
});
