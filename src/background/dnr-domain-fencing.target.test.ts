import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildFenceDnrRule,
  FENCE_DNR_ID_BASE,
  FENCE_DNR_LRU,
  FENCE_DNR_PRIORITY,
  resetFenceDnrRules,
  syncFenceDnrRule,
  versionListHeader,
} from "@/background/dnr-domain-fencing";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { RuntimeSnapshot } from "@/shared/types";

const snapshotWithVersionList = (
  fullVersionList: { brand: string; version: string }[],
): RuntimeSnapshot =>
  ({
    geo: { latitude: 0, longitude: 0, accuracy: 10, noiseRadius: 50 },
    locale: {
      language: "en-US",
      languages: ["en-US"],
      timeZone: "UTC",
      acceptLanguage: "en-US",
    },
    date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
    debugMode: false,
    watchPositionDelay: [60, 500],
    fingerprint: {
      clientHints: {
        brands: [{ brand: "Chromium", version: "125" }],
        fullVersionList,
        mobile: false,
        platform: "macOS",
      },
    },
  }) as RuntimeSnapshot;

describe("buildFenceDnrRule", () => {
  it("scopes Sec-CH-UA-Full-Version-List to the registrable domain", () => {
    const rule = buildFenceDnrRule(
      FENCE_DNR_ID_BASE,
      "example.com",
      '"Chromium";v="125.0.6422.112"',
    );

    expect(rule.priority).toBe(FENCE_DNR_PRIORITY);
    expect(rule.priority).toBeGreaterThan(1);
    expect(rule.condition.requestDomains).toEqual(["example.com"]);
    expect(rule.action.requestHeaders).toEqual([
      {
        header: "Sec-CH-UA-Full-Version-List",
        operation: "set",
        value: '"Chromium";v="125.0.6422.112"',
      },
    ]);
  });
});

describe("versionListHeader", () => {
  it("returns null when client hints are disabled", () => {
    const snapshot = snapshotWithVersionList([
      { brand: "Chromium", version: "125.0.6422.112" },
    ]);
    snapshot.fingerprint = {
      ...snapshot.fingerprint,
      spoofingToggles: { clientHints: false },
    };
    expect(versionListHeader(snapshot)).toBeNull();
  });
});

describe("syncFenceDnrRule", () => {
  const updateSessionRules = vi.fn(
    (_update: chrome.declarativeNetRequest.UpdateRuleOptions) => Promise.resolve(),
  );

  beforeEach(() => {
    resetFenceDnrRules();
    updateSessionRules.mockClear();
    vi.stubGlobal("chrome", {
      declarativeNetRequest: { updateSessionRules },
    });
  });

  afterEach(() => {
    resetFenceDnrRules();
    vi.unstubAllGlobals();
  });

  it("installs a session rule for fenced Chromium identities and reuses the LRU slot", async () => {
    const snapshot = snapshotWithVersionList([
      { brand: "Chromium", version: "125.0.6422.112" },
    ]);

    await syncFenceDnrRule("www.example.com", snapshot, true);
    await syncFenceDnrRule("shop.example.com", snapshot, true);

    if (BUILD_BROWSER_TARGET !== "chromium") {
      expect(updateSessionRules).not.toHaveBeenCalled();
      return;
    }

    expect(updateSessionRules).toHaveBeenCalledTimes(1);
    const firstCall = updateSessionRules.mock.calls.at(0);
    expect(firstCall?.[0]).toEqual({
      removeRuleIds: [],
      addRules: [
        expect.objectContaining({
          id: FENCE_DNR_ID_BASE,
          condition: expect.objectContaining({
            requestDomains: ["example.com"],
          }),
        }),
      ],
    });
  });

  it("does not install a rule for explicit domain-rule identities", async () => {
    const snapshot = snapshotWithVersionList([
      { brand: "Chromium", version: "125.0.6422.112" },
    ]);
    await syncFenceDnrRule("example.com", snapshot, false);
    expect(updateSessionRules).not.toHaveBeenCalled();
  });

  it("evicts the oldest site once the LRU is full", async () => {
    if (BUILD_BROWSER_TARGET !== "chromium") {
      return;
    }

    const snapshot = snapshotWithVersionList([
      { brand: "Chromium", version: "125.0.6422.112" },
    ]);
    for (let index = 0; index < FENCE_DNR_LRU; index += 1) {
      await syncFenceDnrRule(`site${index}.example`, snapshot, true);
    }
    updateSessionRules.mockClear();
    await syncFenceDnrRule("overflow.example", snapshot, true);

    expect(updateSessionRules).toHaveBeenCalledTimes(1);
    const overflowCall = updateSessionRules.mock.calls.at(0);
    expect(overflowCall?.[0].removeRuleIds).toEqual([FENCE_DNR_ID_BASE]);
  });
});
