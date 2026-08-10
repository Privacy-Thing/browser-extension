import { describe, expect, it } from "vitest";

import { CONFIGURABLE_SURFACES } from "@/shared/spoofing-surfaces";
import { t } from "@/ui/i18n";
import { buildSpoofingSurfaces } from "@/ui/options/components/tabs/OptionsTab";

describe("buildSpoofingSurfaces", () => {
  it("builds enabled rows for every catalog surface when supported", () => {
    const surfaces = buildSpoofingSurfaces({
      browserTarget: "chromium",
      sharedSpoofing: undefined,
    });

    expect(surfaces.map((surface) => surface.key)).toEqual(
      CONFIGURABLE_SURFACES.map((surface) => surface.key),
    );
    // Every surface defaults ON except the serviceWorker block (default OFF).
    for (const surface of surfaces) {
      expect(surface.checked).toBe(surface.key !== "serviceWorker");
    }
  });

  it("omits Client Hints when the browser target does not support them", () => {
    const surfaces = buildSpoofingSurfaces({
      browserTarget: "firefox",
      sharedSpoofing: {
        clientHints: true,
      },
    });

    expect(surfaces.some((surface) => surface.key === "clientHints")).toBe(false);
  });

  it("keeps Client Hints on Chromium and preserves explicit toggle state", () => {
    const surfaces = buildSpoofingSurfaces({
      browserTarget: "chromium",
      sharedSpoofing: {
        clientHints: false,
      },
    });

    expect(surfaces.some((surface) => surface.key === "clientHints")).toBe(true);
    expect(surfaces.find((surface) => surface.key === "clientHints")?.checked).toBe(
      false,
    );
  });

  it("omits Battery when the browser target does not support it", () => {
    const surfaces = buildSpoofingSurfaces({
      browserTarget: "firefox",
      sharedSpoofing: { battery: true },
    });

    expect(surfaces.some((surface) => surface.key === "battery")).toBe(false);
  });
});

describe("OptionsTab copy", () => {
  it("uses geolocation advanced modal labels", () => {
    expect(
      t.optionsPage.browserFingerprintSpoofing.items.geolocation.advancedButton,
    ).toBe("Advanced");
    expect(
      t.optionsPage.browserFingerprintSpoofing.items.geolocation.advancedModal.title,
    ).toBe("Geolocation advanced settings");
  });

  it("uses user-facing badge count labels", () => {
    expect(t.optionsPage.badgeQueryCount.label).toBe(
      "Show call count on extension badge",
    );
    expect(t.optionsPage.badgeQueryCount.includeDateCalls.label).toBe(
      "Include Date API calls",
    );
  });
});
