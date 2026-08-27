import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveProfileSnapshot, toRuntimeSnapshot } from "@/background/rules/resolver";
import type { Location, RuntimeSnapshot } from "@/shared/types";

const profile: Location = {
  id: "warsaw",
  label: "Warsaw",
  latitude: 52.2297,
  longitude: 21.0122,
  accuracy: 25,
  noiseRadius: 50,
  language: "pl-PL",
  languages: ["pl-PL", "pl"],
  timeZone: "Europe/Warsaw",
};

const fingerprintSource = {
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  platform: "MacIntel",
  vendor: "Google Inc.",
  hardwareConcurrency: 8,
  deviceMemory: 8,
  userAgentData: {
    brands: [{ brand: "Chromium", version: "125" }],
    fullVersionList: [{ brand: "Chromium", version: "125.0.6422.0" }],
    mobile: false,
    platform: "macOS",
  },
};

const resolve = (
  hostname: string,
  domainFencingEnabled: boolean,
  extra: {
    rules?: Parameters<typeof resolveProfileSnapshot>[0]["rules"];
    cookieStoreId?: string;
    containerAssignments?: Parameters<
      typeof resolveProfileSnapshot
    >[0]["containerAssignments"];
  } = {},
): RuntimeSnapshot | null =>
  resolveProfileSnapshot({
    browserFingerprintSource: fingerprintSource,
    fingerprintEnabled: true,
    containerAssignments: extra.containerAssignments ?? [],
    cookieStoreId: extra.cookieStoreId,
    debugMode: false,
    domainFencingEnabled,
    globalFallbackRule: {
      enabled: true,
      locationId: "warsaw",
      ruleSeedKey: "glb123",
      authKey: "fa11bac0",
    },
    hostname,
    profiles: [profile],
    rules: extra.rules ?? [],
    sharedSpoofing: undefined,
    sharedWorkerHandlingMode: "native",
    trustedSites: [],
    watchPositionDelay: [60, 500],
  });

describe("domain fencing in resolveProfileSnapshot", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps flag-off snapshots bit-identical to the unfenced Default Rule", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const off = resolve("shop.example.com", false);
    const stillOff = resolve("news.other.org", false);
    expect(off?.fingerprint?.canvasNoiseSeed).toBe(
      stillOff?.fingerprint?.canvasNoiseSeed,
    );
    expect(off?.locale.timeZone).toBe("Europe/Warsaw");
    expect(off?.authKey).toBe("fa11bac0");
  });

  it("does not change manually chosen region fields when fencing is on", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const off = resolve("shop.example.com", false);
    const on = resolve("shop.example.com", true);
    expect(on?.locale).toEqual(off?.locale);
    expect(on?.geo).toEqual(off?.geo);
    expect(on?.authKey).toBe(off?.authKey);
  });

  it("varies generated fingerprint values per eTLD+1 on every target", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const first = resolve("www.example.com", true);
    const sameSite = resolve("shop.example.com", true);
    const other = resolve("news.other.org", true);

    expect(first?.fingerprint?.canvasNoiseSeed).toBe(
      sameSite?.fingerprint?.canvasNoiseSeed,
    );
    expect(first?.fingerprint?.canvasNoiseSeed).not.toBe(
      other?.fingerprint?.canvasNoiseSeed,
    );
    expect(first?.fingerprint?.clientHints?.fullVersionList).not.toEqual(
      other?.fingerprint?.clientHints?.fullVersionList,
    );
    expect(first?.fingerprint?.clientHints?.fullVersionList).toEqual(
      sameSite?.fingerprint?.clientHints?.fullVersionList,
    );
  });

  it("omits generated fingerprint on shared templates without a hostname", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const template = toRuntimeSnapshot({
      authKey: "fa11bac0",
      browserFingerprintSource: fingerprintSource,
      debugMode: false,
      domainFencing: {},
      fingerprintEnabled: true,
      profile,
      ruleOverrides: undefined,
      ruleSeedKey: "glb123",
      sharedSpoofing: undefined,
      sharedWorkerHandlingMode: "native",
      watchPositionDelay: [60, 500],
    });
    expect(template.fingerprint).toBeUndefined();
    expect(template.locale.timeZone).toBe("Europe/Warsaw");
    expect(template.authKey).toBe("fa11bac0");
  });

  it("does not fence an explicit domain rule", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const off = resolve("shop.example.com", false, {
      rules: [
        {
          pattern: "shop.example.com",
          locationId: "warsaw",
          enabled: true,
          ruleSeedKey: "rule01",
        },
      ],
    });
    const on = resolve("shop.example.com", true, {
      rules: [
        {
          pattern: "shop.example.com",
          locationId: "warsaw",
          enabled: true,
          ruleSeedKey: "rule01",
        },
      ],
    });
    expect(on?.fingerprint?.canvasNoiseSeed).toBe(off?.fingerprint?.canvasNoiseSeed);
    expect(on?.authKey).toBeUndefined();
  });
});
