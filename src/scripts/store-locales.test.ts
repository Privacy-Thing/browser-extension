import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BETA_BRAND_DISPLAY_NAME,
  CWS_TITLES,
  MANIFEST_DEFAULT_LOCALE,
  MANIFEST_LOCALE_CODES,
  MANIFEST_LOCALES,
  STABLE_DISPLAY_NAME,
  STORE_DEFAULT_LOCALE,
  STORE_LOCALE_CODES,
  STORE_LOCALES,
  resolveManifestExtName,
  resolveManifestShortDesc,
  resolveStoreShortDesc,
} from "../../scripts/brand-config.mjs";

// Chrome Web Store rejects a package whose manifest description exceeds 132
// characters; AMO allows up to 250 for the summary.
const CHROME_DESCRIPTION_LIMIT = 132;
const AMO_SUMMARY_LIMIT = 250;
const CHROMIUM_NAME_LIMIT = 75;
const AMO_NAME_LIMIT = 50;

describe("manifest locales", () => {
  it("includes the default locale", () => {
    expect(MANIFEST_LOCALE_CODES).toContain(MANIFEST_DEFAULT_LOCALE);
  });

  it("ships the planned locale set", () => {
    expect(MANIFEST_LOCALE_CODES).toEqual([
      "ar",
      "zh_CN",
      "uk",
      "ru",
      "pt_BR",
      "pl",
      "ko",
      "ja",
      "it",
      "fr",
      "es",
      "en",
      "de",
    ]);
  });

  it("keeps every short description within store limits", () => {
    for (const locale of MANIFEST_LOCALE_CODES) {
      const chromium = resolveManifestShortDesc(locale, "chromium");
      const firefox = resolveManifestShortDesc(locale, "firefox");

      expect(chromium.length).toBeGreaterThan(0);
      expect(firefox.length).toBeGreaterThan(0);
      expect(chromium.length).toBeLessThanOrEqual(CHROME_DESCRIPTION_LIMIT);
      expect(firefox.length).toBeLessThanOrEqual(AMO_SUMMARY_LIMIT);
    }
  });

  it("ships localized Chromium titles while keeping Firefox channel names", () => {
    expect(Object.keys(CWS_TITLES.locales).sort()).toEqual(
      [...MANIFEST_LOCALE_CODES].sort(),
    );

    for (const locale of MANIFEST_LOCALE_CODES) {
      const stableTitle = resolveManifestExtName(locale, "chromium", "release");
      const betaTitle = resolveManifestExtName(locale, "chromium", "beta");

      expect(stableTitle).toBe(CWS_TITLES.locales[locale]);
      expect(stableTitle.length).toBeLessThanOrEqual(CHROMIUM_NAME_LIMIT);
      expect(betaTitle).toBe(
        stableTitle.replace(STABLE_DISPLAY_NAME, BETA_BRAND_DISPLAY_NAME),
      );
      expect(betaTitle.length).toBeLessThanOrEqual(CHROMIUM_NAME_LIMIT);
    }

    expect(resolveManifestExtName("pl", "firefox", "release")).toBe(
      STABLE_DISPLAY_NAME,
    );
    expect(resolveManifestExtName("pl", "firefox", "beta")).toBe(
      BETA_BRAND_DISPLAY_NAME,
    );
  });

  it("defaults unknown build targets to the chromium description", () => {
    const locale = MANIFEST_DEFAULT_LOCALE;
    expect(resolveManifestShortDesc(locale, "chromium")).toBe(
      MANIFEST_LOCALES.locales[locale].chromium,
    );
    expect(resolveManifestShortDesc(locale, "unknown")).toBe(
      resolveManifestShortDesc(locale, "chromium"),
    );
  });

  it("throws on an unknown locale so generation fails loudly", () => {
    expect(() => resolveManifestShortDesc("xx", "chromium")).toThrow(
      /Unknown manifest locale/,
    );
    expect(() => resolveManifestExtName("xx", "chromium")).toThrow(
      /Unknown CWS title locale/,
    );
  });
});

describe("store locales", () => {
  it("keeps its default locale available for AMO metadata generation", () => {
    expect(STORE_LOCALE_CODES).toContain(STORE_DEFAULT_LOCALE);
  });

  it("continues to resolve AMO source descriptions", () => {
    expect(resolveStoreShortDesc(STORE_DEFAULT_LOCALE, "chromium")).toBe(
      STORE_LOCALES.locales[STORE_DEFAULT_LOCALE].chromium,
    );
  });
});

describe("AMO stable metadata (listing source of truth)", () => {
  const metadata = JSON.parse(
    readFileSync(
      new URL("../../config/store-listings/amo/stable-metadata.json", import.meta.url),
      "utf8",
    ),
  ) as {
    name: Record<string, string>;
    summary: Record<string, string>;
    description: Record<string, string>;
  };

  it("ships matching locales for name, summary, and description", () => {
    // Guards the reset regression: a missing locale here silently reverts the
    // AMO listing for that language on the next stable publish.
    expect(Object.keys(metadata.name).sort()).toEqual(
      Object.keys(metadata.summary).sort(),
    );
    expect(Object.keys(metadata.summary).sort()).toEqual(
      Object.keys(metadata.description).sort(),
    );
  });

  it("covers every configured manifest locale exactly once", () => {
    const meta = JSON.parse(
      readFileSync(
        new URL("../../config/store-listings/meta.json", import.meta.url),
        "utf8",
      ),
    ) as {
      locales: Record<string, { storeLocale: string }>;
      unsupportedManifestLocales: string[];
    };

    expect(
      [
        ...Object.values(meta.locales).map(({ storeLocale }) => storeLocale),
        ...meta.unsupportedManifestLocales,
      ].sort(),
    ).toEqual([...MANIFEST_LOCALE_CODES].sort());
    expect(Object.keys(metadata.summary).sort()).toEqual(
      Object.keys(meta.locales).sort(),
    );
  });

  it("contains no retired product name in AMO listing metadata", () => {
    const retiredName = ["geo", "warp"].join("");
    expect(JSON.stringify(metadata).toLowerCase()).not.toContain(retiredName);
  });

  it("keeps every localized AMO name within the store limit", () => {
    for (const [locale, name] of Object.entries(metadata.name)) {
      expect(name.length, locale).toBeGreaterThan(0);
      expect(name.length, locale).toBeLessThanOrEqual(AMO_NAME_LIMIT);
    }
  });

  it("keeps every summary within the AMO limit and non-empty", () => {
    for (const [locale, summary] of Object.entries(metadata.summary)) {
      expect(summary.length, locale).toBeGreaterThan(0);
      expect(summary.length, locale).toBeLessThanOrEqual(AMO_SUMMARY_LIMIT);
    }
  });

  it("keeps every description non-empty and distinct from its summary", () => {
    for (const [locale, description] of Object.entries(metadata.description)) {
      expect(description.length, locale).toBeGreaterThan(0);
      expect(description, locale).not.toBe(metadata.summary[locale]);
    }
  });
});
