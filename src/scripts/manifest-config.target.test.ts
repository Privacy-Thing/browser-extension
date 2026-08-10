import { describe, expect, it } from "vitest";

import { createManifest } from "../../config/manifest";
import {
  STABLE_DISPLAY_NAME,
  resolveBrandDisplayName,
} from "../../scripts/brand-config.mjs";

describe("extension manifest", () => {
  it("declares Firefox response filtering permissions only for Firefox builds", () => {
    const firefoxManifest = createManifest({ browserTarget: "firefox" });
    const chromiumManifest = createManifest({ browserTarget: "chromium" });

    expect(firefoxManifest.permissions).toContain("webRequest");
    expect(firefoxManifest.permissions).toContain("webRequestBlocking");
    expect(firefoxManifest.permissions).toContain("webRequestFilterResponse");
    expect(chromiumManifest.permissions).not.toContain("webRequest");
    expect(chromiumManifest.permissions).not.toContain("webRequestBlocking");
    expect(chromiumManifest.permissions).not.toContain("webRequestFilterResponse");
  });

  it("uses the preview name for stable public manifests", () => {
    expect(STABLE_DISPLAY_NAME).toBe("Privacy Thing (Preview)");
    expect(resolveBrandDisplayName("stable")).toBe("Privacy Thing (Preview)");
  });

  it("declares Firefox toolbar theme icons without adding them to Chromium", () => {
    const firefoxManifest = createManifest({ browserTarget: "firefox" });
    const chromiumManifest = createManifest({ browserTarget: "chromium" });

    expect(firefoxManifest.action).toMatchObject({
      theme_icons: [
        {
          light: "icons/icon-theme-light-16.png",
          dark: "icons/icon-theme-dark-16.png",
          size: 16,
        },
        {
          light: "icons/icon-theme-light-32.png",
          dark: "icons/icon-theme-dark-32.png",
          size: 32,
        },
        {
          light: "icons/icon-theme-light-48.png",
          dark: "icons/icon-theme-dark-48.png",
          size: 48,
        },
        {
          light: "icons/icon-theme-light-128.png",
          dark: "icons/icon-theme-dark-128.png",
          size: 128,
        },
      ],
    });
    expect(chromiumManifest.action).not.toHaveProperty("theme_icons");
  });
});
