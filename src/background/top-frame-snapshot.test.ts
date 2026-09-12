import { describe, expect, it, vi } from "vitest";

import {
  inheritTabSnapshot,
  pickTopFrameDecision,
  resolveTopFrameDecision,
  type TopFrameDecision,
} from "@/background/top-frame-snapshot";
import type { RuntimeSnapshot } from "@/shared/types";

const snapshot = (language: string): RuntimeSnapshot => ({
  geo: { latitude: 0, longitude: 0, accuracy: 10, noiseRadius: 100 },
  locale: {
    language,
    languages: [language],
    timeZone: "UTC",
    acceptLanguage: language,
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
  debugMode: false,
  watchPositionDelay: [100, 500],
});

const london: TopFrameDecision = {
  snapshot: snapshot("en-GB"),
  trustedSiteMatched: false,
};
const berlin: TopFrameDecision = {
  snapshot: snapshot("de-DE"),
  trustedSiteMatched: true,
  fencesIdentity: true,
};
const nativeTop: TopFrameDecision = {
  snapshot: null,
  trustedSiteMatched: true,
};

describe("pickTopFrameDecision", () => {
  it("keeps the top frame on its own decision", () => {
    expect(pickTopFrameDecision(0, london, berlin)).toEqual({
      decision: london,
      inherited: false,
    });
  });

  it("copies the top decision onto every subframe when top is cached", () => {
    expect(pickTopFrameDecision(2, berlin, london)).toEqual({
      decision: london,
      inherited: true,
    });
  });

  it("copies a null top snapshot onto subframes", () => {
    expect(pickTopFrameDecision(3, berlin, nativeTop)).toEqual({
      decision: nativeTop,
      inherited: true,
    });
  });

  it("falls back to the frame's own decision when top is missing", () => {
    expect(pickTopFrameDecision(2, berlin, undefined)).toEqual({
      decision: berlin,
      inherited: false,
    });
  });
});

describe("resolveTopFrameDecision", () => {
  it("does not resolve the tab for the top frame", async () => {
    const result = await resolveTopFrameDecision({
      frameId: 0,
      ownDecision: london,
      readTop: () => berlin,
      resolveTopFromTab: async () => {
        throw new Error("must not resolve top from the tab");
      },
    });

    expect(result).toEqual({ decision: london, inherited: false });
  });

  it("prefers the cached top decision over a tab lookup", async () => {
    const result = await resolveTopFrameDecision({
      frameId: 4,
      ownDecision: berlin,
      readTop: () => london,
      resolveTopFromTab: async () => {
        throw new Error("must not resolve top from the tab");
      },
    });

    expect(result).toEqual({ decision: london, inherited: true });
  });

  it("seeds from the tab URL when the top cache is empty", async () => {
    const result = await resolveTopFrameDecision({
      frameId: 4,
      ownDecision: berlin,
      readTop: () => undefined,
      resolveTopFromTab: async () => ({
        hostname: "publer.com",
        decision: london,
        cookieStoreId: "firefox-container-1",
      }),
    });

    expect(result).toEqual({
      decision: london,
      inherited: true,
      seededTop: {
        hostname: "publer.com",
        cookieStoreId: "firefox-container-1",
      },
    });
  });
});

describe("inheritTabSnapshot", () => {
  it("returns null for the top frame", () => {
    const writeCache = vi.fn();
    const result = inheritTabSnapshot({
      tabId: 1,
      frameId: 0,
      hostname: "publer.com",
      readTop: () => london,
      writeCache,
    });

    expect(result).toBeNull();
    expect(writeCache).not.toHaveBeenCalled();
  });

  it("copies a cached top decision onto the subframe", () => {
    const writeCache = vi.fn();
    const result = inheritTabSnapshot({
      tabId: 1,
      frameId: 4,
      hostname: "cdn.example.net",
      readTop: () => london,
      writeCache,
    });

    expect(result).toBe(london);
    expect(writeCache).toHaveBeenCalledWith({
      tabId: 1,
      frameId: 4,
      hostname: "cdn.example.net",
      value: london,
    });
  });

  it("does not seed frame 0 from an unconfirmed tab hostname", () => {
    const writeCache = vi.fn();
    const result = inheritTabSnapshot({
      tabId: 1,
      frameId: 4,
      hostname: "cdn.example.net",
      readTop: () => undefined,
      writeCache,
    });

    expect(result).toBeNull();
    expect(writeCache).not.toHaveBeenCalled();
  });
});
