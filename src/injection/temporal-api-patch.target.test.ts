import { createIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installTemporalApiPatch } from "@/injection/temporal-api-patch";
import type { RuntimeSnapshot } from "@/shared/types";

const mocks = vi.hoisted(() => ({ markSurfaceUsed: vi.fn() }));

vi.mock("@privacy-brand/refract-browser/common/surface-usage-emitter", () => ({
  markSurfaceUsed: mocks.markSurfaceUsed,
}));

const snapshot = {
  geo: { latitude: 0, longitude: 0, accuracy: 0, noiseRadius: 0 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    formattingLanguages: ["pl-PL"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl;q=0.9",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500],
  temporalApiEnabled: true,
} satisfies RuntimeSnapshot;

const createTemporal = () => ({
  Now: {
    instant() {
      return "instant";
    },
    timeZoneId() {
      return "Native/Zone";
    },
  },
});

describe("injected Temporal API adapter", () => {
  beforeEach(() => mocks.markSurfaceUsed.mockReset());

  it("installs, reports, and registers available Temporal methods", () => {
    const Temporal = createTemporal();
    const registrar = createIntegrityRegistry();
    const anchors = installTemporalApiPatch(
      snapshot,
      { Temporal },
      {
        registrar,
        realmId: "test",
      },
    );

    expect(anchors).toHaveLength(2);
    expect(Temporal.Now.timeZoneId()).toBe("Europe/Warsaw");
    expect(Temporal.Now.instant()).toBe("instant");
    expect(mocks.markSurfaceUsed).toHaveBeenCalledWith(
      "timeLocale",
      "temporal.Now.timeZoneId",
    );
    expect(registrar.ensureSurface("timeLocale")).toHaveLength(2);
  });

  it("does not touch Temporal while the flag or Time & Locale is disabled", () => {
    const Temporal = createTemporal();
    const nativeTimeZoneId = Temporal.Now.timeZoneId;

    expect(
      installTemporalApiPatch({ ...snapshot, temporalApiEnabled: false }, { Temporal }),
    ).toEqual([]);
    expect(
      installTemporalApiPatch({ ...snapshot, timeLocaleEnabled: false }, { Temporal }),
    ).toEqual([]);
    expect(Temporal.Now.timeZoneId).toBe(nativeTimeZoneId);
  });

  it("adopts early wrappers without replacing or double-counting them", () => {
    const Temporal = createTemporal();
    installTemporalApiPatch(snapshot, { Temporal });
    const earlyTimeZoneId = Temporal.Now.timeZoneId;
    mocks.markSurfaceUsed.mockReset();
    const registrar = createIntegrityRegistry();

    const anchors = installTemporalApiPatch(
      snapshot,
      { Temporal },
      { registrar, realmId: "test" },
      true,
    );

    expect(anchors).toHaveLength(2);
    expect(Temporal.Now.timeZoneId).toBe(earlyTimeZoneId);
    expect(Temporal.Now.timeZoneId()).toBe("Europe/Warsaw");
    expect(mocks.markSurfaceUsed).toHaveBeenCalledTimes(1);
    expect(registrar.ensureSurface("timeLocale")).toHaveLength(2);
  });
});
