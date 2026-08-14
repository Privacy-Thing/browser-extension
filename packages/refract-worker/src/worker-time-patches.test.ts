import { describe, expect, it, vi } from "vitest";

import type { WorkerRuntimeSupport } from "./worker-runtime-support";
import { installWorkerTemporal } from "./worker-time-patches";

import type { RuntimeSnapshot } from "@/shared/types";

const snapshot = {
  geo: { latitude: 0, longitude: 0, accuracy: 0, noiseRadius: 0 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500],
  temporalApiEnabled: true,
} satisfies RuntimeSnapshot;

const createSupport = () => {
  const register = vi.fn();
  const localeOnce = vi.fn();
  const markSurfaceUsed = vi.fn();
  return {
    register,
    localeOnce,
    markSurfaceUsed,
    support: {
      register,
      markSurfaceUsed,
      loggers: { localeOnce },
    } as unknown as WorkerRuntimeSupport,
  };
};

describe("worker Temporal API patch", () => {
  it("reuses the shared semantics and registers worker integrity anchors", () => {
    const Temporal = {
      Now: {
        instant: () => "instant",
        timeZoneId: () => "Native/Zone",
      },
    };
    const { support, register, localeOnce, markSurfaceUsed } = createSupport();

    installWorkerTemporal(snapshot, support, { Temporal });

    expect(Temporal.Now.timeZoneId()).toBe("Europe/Warsaw");
    expect(Temporal.Now.instant()).toBe("instant");
    expect(register).toHaveBeenCalledTimes(2);
    expect(localeOnce).toHaveBeenCalledWith("temporal.Now.timeZoneId", []);
    expect(markSurfaceUsed).toHaveBeenCalledWith(
      "timeLocale",
      "temporal.Now.timeZoneId",
    );
  });

  it("is inactive while the feature flag is off", () => {
    const Temporal = { Now: { timeZoneId: () => "Native/Zone" } };
    const nativeTimeZoneId = Temporal.Now.timeZoneId;
    const { support, register } = createSupport();

    installWorkerTemporal({ ...snapshot, temporalApiEnabled: false }, support, {
      Temporal,
    });

    expect(Temporal.Now.timeZoneId).toBe(nativeTimeZoneId);
    expect(register).not.toHaveBeenCalled();
  });
});
