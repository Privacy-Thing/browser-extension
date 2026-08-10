import { afterEach, describe, expect, it, vi } from "vitest";

import type { RuntimeSnapshot } from "@/shared/types";

const mocks = vi.hoisted(() => ({
  markSurfaceUsed: vi.fn(),
}));

vi.mock("@privacy-brand/refract-browser/common/surface-usage-emitter", () => ({
  markSurfaceUsed: mocks.markSurfaceUsed,
}));

class FakeNavigator {}

const buildSnapshot = (timeLocaleEnabled: boolean): RuntimeSnapshot =>
  ({
    geo: {
      latitude: 52.2297,
      longitude: 21.0122,
      accuracy: 25,
      noiseRadius: 50,
    },
    locale: {
      language: "pl-PL",
      languages: ["pl-PL", "pl"],
      timeZone: "Europe/Warsaw",
      acceptLanguage: "pl-PL,pl;q=0.9",
    },
    date: {
      baseEpochMs: Date.parse("2026-01-15T12:00:00.000Z"),
      offsetMs: 0,
      timeZone: "Europe/Warsaw",
    },
    debugMode: false,
    watchPositionDelay: [60, 500],
    timeLocaleEnabled,
    fingerprint: {
      hardwareConcurrency: 12,
      spoofingToggles: { navigator: true },
    },
  }) satisfies RuntimeSnapshot;

afterEach(() => {
  mocks.markSurfaceUsed.mockReset();
  vi.resetModules();
});

describe("navigator fingerprint surface categorization", () => {
  it("marks navigator (never timeLocale) for fingerprint reads, even when Time & Locale is disabled", async () => {
    const { installNavigatorPatch } = await import("@/injection/main/locale-patch");

    Object.defineProperty(FakeNavigator.prototype, "hardwareConcurrency", {
      configurable: true,
      get(): number {
        return 2;
      },
    });

    installNavigatorPatch(buildSnapshot(false), FakeNavigator.prototype);

    const navigator = new FakeNavigator() as FakeNavigator & {
      hardwareConcurrency: number;
      webdriver: boolean;
    };

    // Reading fingerprint surfaces must attribute usage to "navigator".
    expect(navigator.hardwareConcurrency).toBe(12);
    expect(navigator.webdriver).toBe(false);

    const markedCategories = mocks.markSurfaceUsed.mock.calls.map((call) => call[0]);
    expect(markedCategories).toContain("navigator");
    // Regression: a navigator-fingerprint read must never report Time & Locale
    // usage. The main runtime previously wrapped this surface under the
    // timeLocale category, leaking disabled-surface reports into XRay.
    expect(markedCategories).not.toContain("timeLocale");

    Reflect.deleteProperty(FakeNavigator.prototype, "hardwareConcurrency");
  });
});
