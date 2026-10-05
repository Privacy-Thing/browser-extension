import { describe, expect, it } from "vitest";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  buildRegionalPreview,
  getSuggestedTimeZone,
  REGIONAL_SAMPLE_EPOCHS,
} from "@/shared/regional-profile";
import { buildRuntimeSnapshot } from "@/shared/runtime-snapshot-builder";
import type { Location } from "@/shared/types";

const warsaw: Location = {
  id: "warsaw",
  label: "Warsaw",
  latitude: 52.2297,
  longitude: 21.0122,
  accuracy: 30,
  noiseRadius: 50,
  timeZone: "Europe/Warsaw",
  language: "pl-PL",
  languages: ["pl-PL", "pl", "de-DE"],
};

describe("regional profile advice", () => {
  it("suggests only a supported geographic zone and does not mutate a mismatched profile", () => {
    const profile = { ...warsaw, timeZone: "Asia/Tokyo" };
    const before = structuredClone(profile);
    expect(getSuggestedTimeZone(profile)).toBe("Europe/Warsaw");
    expect(profile).toEqual(before);
  });

  it.each(["America/New_York", "US/Eastern"])(
    "recognizes zone aliases: %s",
    (timeZone) => {
      expect(
        getSuggestedTimeZone({
          ...warsaw,
          latitude: 40.7128,
          longitude: -74.006,
          timeZone,
        }),
      ).toBeNull();
    },
  );

  it("preserves UTC, intentional border choices and multilingual profiles", () => {
    const profiles = [
      { ...warsaw, timeZone: "UTC" },
      { ...warsaw, latitude: 51.05, longitude: 14.98, timeZone: "Europe/Prague" },
      {
        ...warsaw,
        latitude: 50.85,
        longitude: 4.35,
        timeZone: "Europe/Brussels",
        language: "fr",
        languages: ["fr", "nl", "de"],
      },
    ];
    for (const profile of profiles) {
      const before = structuredClone(profile);
      getSuggestedTimeZone(profile);
      buildRegionalPreview(profile, BUILD_BROWSER_TARGET);
      expect(profile).toEqual(before);
    }
  });

  it.each(["", "Mars/Olympus"])(
    "does not format or suggest for an invalid zone: %s",
    (timeZone) => {
      const profile = { ...warsaw, timeZone };
      expect(getSuggestedTimeZone(profile)).toBeNull();
      expect(buildRegionalPreview(profile, BUILD_BROWSER_TARGET)).toBeNull();
    },
  );

  it("does not suggest for invalid coordinates", () => {
    expect(getSuggestedTimeZone({ ...warsaw, latitude: NaN })).toBeNull();
    expect(getSuggestedTimeZone({ ...warsaw, latitude: 91 })).toBeNull();
  });
});

describe("regional preview", () => {
  it.each([false, true])(
    "matches the actual runtime snapshot with English preference %s",
    (preferEnglishContent) => {
      const profile = { ...warsaw, preferEnglishContent };
      const snapshot = buildRuntimeSnapshot({
        profile,
        browserFingerprintSource: {
          userAgent:
            BUILD_BROWSER_TARGET === "firefox"
              ? "Mozilla/5.0 Firefox/142.0"
              : "Mozilla/5.0 Chrome/142.0.0.0",
        },
        authKey: undefined,
        fingerprintEnabled: true,
        debugMode: false,
        sharedSpoofing: undefined,
        sharedWorkerHandlingMode: "native",
        watchPositionDelay: [1, 2],
        ruleOverrides: undefined,
        ruleSeedKey: undefined,
      });
      const preview = buildRegionalPreview(profile, BUILD_BROWSER_TARGET);
      expect(preview).toMatchObject(snapshot.locale);
      expect(preview?.language).toBe(preferEnglishContent ? "en" : "pl");
      expect(preview?.resolvedFormattingLocale).toBe("pl");
      expect(preview?.number).toBe(new Intl.NumberFormat("pl-PL").format(1234567.89));
    },
  );

  it("uses browser-specific header expansion and Brave reduction", () => {
    const profile = {
      ...warsaw,
      languages: ["pl-PL", "de-DE"],
      preferEnglishContent: true,
    };
    expect(buildRegionalPreview(profile, "chromium")?.acceptLanguage).toBe(
      "en,pl;q=0.9,de-DE;q=0.8,de;q=0.7",
    );
    expect(buildRegionalPreview(profile, "firefox")?.acceptLanguage).toBe(
      "en,pl;q=0.9,de-DE;q=0.8",
    );
    expect(buildRegionalPreview(profile, "brave")?.acceptLanguage).toBe("en");
  });

  it("uses catalog fallbacks and preserves supported language order", () => {
    const profile = { ...warsaw, language: "zh-Hant", languages: ["zh-Hant", "en-US"] };
    const preview = buildRegionalPreview(profile, BUILD_BROWSER_TARGET);
    expect(preview?.language).toBe("zh-TW");
    expect(preview?.languages).toEqual(["zh-TW", "en-US"]);
    expect(preview?.resolvedFormattingLocale).toBe("zh-TW");
  });

  it("shows seasonal zone offsets without comparing offsets for geographic advice", () => {
    const preview = buildRegionalPreview(warsaw, BUILD_BROWSER_TARGET);
    expect(preview?.dates).toEqual(
      REGIONAL_SAMPLE_EPOCHS.map((epoch) =>
        new Intl.DateTimeFormat("pl-PL", {
          timeZone: "Europe/Warsaw",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          timeZoneName: "short",
        }).format(epoch),
      ),
    );
    expect(preview?.dates[0]).toContain("13:34:56");
    expect(preview?.dates[1]).toContain("14:34:56");
    // Paris and Warsaw currently share offsets but are different geographic zones.
    expect(getSuggestedTimeZone({ ...warsaw, timeZone: "Europe/Paris" })).toBe(
      "Europe/Warsaw",
    );
    expect(getSuggestedTimeZone(warsaw)).toBeNull();
  });
});
