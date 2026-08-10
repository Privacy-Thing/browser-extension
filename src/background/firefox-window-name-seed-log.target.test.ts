import type { FirefoxWindowSeedState } from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { describe, expect, it } from "vitest";

import {
  buildWindowSeedLog,
  type WindowSeedTrigger,
} from "@/background/firefox-window-name-seed-log";

const createSeedState = (): FirefoxWindowSeedState => ({
  entries: [
    {
      pattern: "example.com",
      state: {
        bootstrap: {
          revision: 1,
        },
        geoStatus: "ready",
        geo: {
          latitude: 52.23,
          longitude: 21.01,
          accuracy: 25,
          noiseRadius: 100,
          watchPositionDelay: [60, 500],
        },
        timeLocaleStatus: "ready",
        timeLocale: {
          language: "pl-PL",
          languages: ["pl-PL"],
          timeZone: "Europe/Warsaw",
          offsetMinutes: -60,
        },
        fingerprintStatus: "ready",
        fingerprint: {
          hardwareConcurrency: 8,
          platform: "Win32",
        },
        debug: null,
        blockServiceWorkerRegistration: false,
      },
    },
  ],
  containerState: null,
});

const trigger: WindowSeedTrigger = "on-before-navigate";

describe("Firefox window.name seed log details", () => {
  it("includes trigger information for successful seeds", () => {
    expect(
      buildWindowSeedLog({
        outcome: "success",
        frameId: 0,
        cookieStoreId: "firefox-default",
        trigger,
        seedState: createSeedState(),
      }),
    ).toEqual({
      success: true,
      frameId: 0,
      cookieStoreId: "firefox-default",
      trigger,
      entryCount: 1,
      hasContainerState: false,
    });
  });

  it("records missing state failures without tab diagnostics", () => {
    expect(
      buildWindowSeedLog({
        outcome: "missing-seed-state",
        frameId: 0,
        cookieStoreId: undefined,
        trigger: "on-committed-about-blank",
      }),
    ).toEqual({
      success: false,
      frameId: 0,
      cookieStoreId: null,
      trigger: "on-committed-about-blank",
      reason: "missing-seed-state",
    });
  });

  it("captures executeScript errors with tab context", () => {
    expect(
      buildWindowSeedLog({
        outcome: "execute-script-failed",
        frameId: 0,
        cookieStoreId: "firefox-default",
        trigger: "popup-rule-mutation",
        error: new Error("Missing host permission for the tab"),
        tab: {
          url: "https://example.com/old",
          pendingUrl: "https://example.com/new",
          status: "loading",
          discarded: false,
          cookieStoreId: "firefox-default",
        },
      }),
    ).toEqual({
      success: false,
      frameId: 0,
      cookieStoreId: "firefox-default",
      trigger: "popup-rule-mutation",
      reason: "execute-script-failed",
      error: "Missing host permission for the tab",
      errorName: "Error",
      tabUrl: "https://example.com/old",
      pendingUrl: "https://example.com/new",
      tabStatus: "loading",
      tabDiscarded: false,
      tabCookieStoreId: "firefox-default",
    });
  });

  it("records when the hash carrier already owns the navigation", () => {
    expect(
      buildWindowSeedLog({
        outcome: "hash-transport-preferred",
        frameId: 0,
        cookieStoreId: "firefox-default",
        trigger,
        hostname: "example.com",
      }),
    ).toEqual({
      success: false,
      frameId: 0,
      cookieStoreId: "firefox-default",
      trigger,
      reason: "hash-transport-preferred",
      hostname: "example.com",
    });
  });

  it("records provisional about:blank preseed skips without surfacing executeScript noise", () => {
    expect(
      buildWindowSeedLog({
        outcome: "about-blank-seed-unavailable",
        frameId: 0,
        cookieStoreId: undefined,
        trigger,
      }),
    ).toEqual({
      success: false,
      frameId: 0,
      cookieStoreId: null,
      trigger,
      reason: "about-blank-seed-unavailable",
    });
  });

  it("falls back to stringifying non-Error failures", () => {
    expect(
      buildWindowSeedLog({
        outcome: "execute-script-failed",
        frameId: 2,
        cookieStoreId: undefined,
        trigger,
        error: "script target vanished",
      }),
    ).toEqual({
      success: false,
      frameId: 2,
      cookieStoreId: null,
      trigger,
      reason: "execute-script-failed",
      error: "script target vanished",
    });
  });
});
