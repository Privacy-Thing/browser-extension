import { afterEach, describe, expect, it, vi } from "vitest";

import { createSpoofedRuntime, getSystemValues } from "./snapshot-sim";

import { serializeAcceptLanguage } from "@/shared/accept-language";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { getTimeZoneOffsetMinutes } from "@/shared/time-zone-offset";
import type { RuntimeSnapshot } from "@/shared/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTokyoSnapshot = (): RuntimeSnapshot => ({
  geo: {
    latitude: 35.6762,
    longitude: 139.6503,
    accuracy: 100,
    noiseRadius: 50,
  },
  locale: {
    language: "ja",
    languages: Object.freeze(["ja", "en-US"]) as readonly string[],
    timeZone: "Asia/Tokyo",
    acceptLanguage: "ja,en-US",
  },
  date: { baseEpochMs: Date.now(), offsetMs: 0, timeZone: "Asia/Tokyo" },
  debugMode: false,
  watchPositionDelay: [60, 500] as [number, number],
});

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

const mockNavigator = (value: {
  language: string;
  languages: readonly string[];
}): void => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value,
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  if (navigatorDescriptor) {
    Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, "navigator");
});

// ---------------------------------------------------------------------------
// createSpoofedRuntime
// ---------------------------------------------------------------------------

describe("createSpoofedRuntime", () => {
  it("returns spoofed locale fields", () => {
    const runtime = createSpoofedRuntime(makeTokyoSnapshot());
    expect(runtime.locale.language).toBe("ja");
    expect([...runtime.locale.languages]).toEqual(["ja", "en-US"]);
    expect(runtime.locale.timeZone).toBe("Asia/Tokyo");
  });

  it("getTimezoneOffset returns -540 for Asia/Tokyo", () => {
    const runtime = createSpoofedRuntime(makeTokyoSnapshot());
    // Verify via the shared helper so the test stays coherent with the
    // production offset computation, then pin the known-constant value.
    const expected = getTimeZoneOffsetMinutes("Asia/Tokyo", Date.now());
    expect(runtime.date.getTimezoneOffset()).toBe(expected);
    // Tokyo is UTC+9 with no DST — offset is always -540.
    expect(runtime.date.getTimezoneOffset()).toBe(-540);
  });

  it("toString includes GMT+0900", () => {
    const runtime = createSpoofedRuntime(makeTokyoSnapshot());
    expect(runtime.date.toString()).toContain("GMT+0900");
  });

  it("toString includes Japan Standard Time", () => {
    const runtime = createSpoofedRuntime(makeTokyoSnapshot());
    expect(runtime.date.toString()).toContain("Japan Standard Time");
  });

  it("toLocaleString returns a non-empty string", () => {
    const runtime = createSpoofedRuntime(makeTokyoSnapshot());
    expect(runtime.date.toLocaleString().length).toBeGreaterThan(0);
  });

  it("toLocaleDateString returns a non-empty string", () => {
    const runtime = createSpoofedRuntime(makeTokyoSnapshot());
    expect(runtime.date.toLocaleDateString().length).toBeGreaterThan(0);
  });

  it("toLocaleTimeString returns a non-empty string", () => {
    const runtime = createSpoofedRuntime(makeTokyoSnapshot());
    expect(runtime.date.toLocaleTimeString().length).toBeGreaterThan(0);
  });

  it("uses formattingLanguages for locale-sensitive date previews", () => {
    const runtime = createSpoofedRuntime({
      ...makeTokyoSnapshot(),
      locale: {
        language: "en",
        languages: ["en", "ja"],
        formattingLanguage: "ja",
        formattingLanguages: ["ja", "en-US"],
        timeZone: "Asia/Tokyo",
        acceptLanguage: "en,ja",
      },
    });

    const rendered = runtime.date.toLocaleDateString();
    const expected = new Intl.DateTimeFormat(["ja", "en-US"], {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(new Date(Date.now()));

    expect(rendered).toBe(expected);
  });

  it("toDateString contains year", () => {
    const runtime = createSpoofedRuntime(makeTokyoSnapshot());
    expect(runtime.date.toDateString()).toContain(new Date().getFullYear().toString());
  });

  it("geo coordinates match snapshot", () => {
    const runtime = createSpoofedRuntime(makeTokyoSnapshot());
    expect(runtime.geo.latitude).toBe(35.6762);
    expect(runtime.geo.longitude).toBe(139.6503);
    expect(runtime.geo.accuracy).toBe(100);
  });

  it("methods are live — each call recomputes from Date.now()", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const runtime = createSpoofedRuntime(makeTokyoSnapshot());
    const first = runtime.date.toTimeString();
    vi.advanceTimersByTime(2_000);
    const second = runtime.date.toTimeString();
    expect(second).not.toBe(first);
  });
});

// ---------------------------------------------------------------------------
// getSystemValues
// ---------------------------------------------------------------------------
describe("getSystemValues", () => {
  it("reads language and languages from navigator", () => {
    mockNavigator({
      language: "pl-PL",
      languages: ["pl-PL", "pl"],
    });

    const values = getSystemValues();
    expect(values.language).toBe("pl-PL");
    expect(values.languages).toEqual(["pl-PL", "pl"]);
    expect(values.acceptLanguage).toBe(
      serializeAcceptLanguage(
        ["pl-PL", "pl"],
        BUILD_BROWSER_TARGET === "firefox" ? "firefox" : "chromium",
      ),
    );
  });

  it("reads the current timezone and date formatting surfaces deterministically", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    mockNavigator({
      language: "en-US",
      languages: ["en-US", "en"],
    });

    const now = new Date();
    const values = getSystemValues();

    expect(values.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(values.acceptLanguage).toBe(
      serializeAcceptLanguage(
        ["en-US", "en"],
        BUILD_BROWSER_TARGET === "firefox" ? "firefox" : "chromium",
      ),
    );
    expect(values.timezoneOffset).toBe(now.getTimezoneOffset());
    expect(values.dateString).toBe(now.toString());
    expect(values.dateToDateString).toBe(now.toDateString());
    expect(values.dateToTimeString).toBe(now.toTimeString());
    expect(values.dateLocaleString).toBe(now.toLocaleString());
    expect(values.dateLocaleDateString).toBe(now.toLocaleDateString());
    expect(values.dateLocaleTimeString).toBe(now.toLocaleTimeString());
  });
});
