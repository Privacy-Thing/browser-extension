import { createIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installScreenPatch } from "@/injection/main/screen-patch";
import type { SpoofingSurfaceKey } from "@/shared/spoofing-surfaces";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

const buildSnapshot = (
  screenOverrides: NonNullable<NonNullable<RuntimeSnapshot["fingerprint"]>["screen"]>,
): RuntimeSnapshot => ({
  geo: { latitude: 0, longitude: 0, accuracy: 10, noiseRadius: 50 },
  locale: { language: "en", languages: ["en"], timeZone: "UTC", acceptLanguage: "en" },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
  debugMode: false,
  watchPositionDelay: [100, 500],
  fingerprint: {
    screen: screenOverrides,
  },
});

describe("installScreenPatch", () => {
  beforeEach(() => {
    vi.stubGlobal("screen", Object.create({}) as Screen);
    vi.stubGlobal("devicePixelRatio", 1);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clamps fallback availHeight to zero when height is smaller than the taskbar offset", () => {
    installScreenPatch(
      buildSnapshot({
        width: 32,
        height: 20,
        colorDepth: 24,
      }),
    );

    expect(screen.height).toBe(20);
    expect(screen.availHeight).toBe(0);
  });

  it("uses explicit captured screen values when provided", () => {
    installScreenPatch(
      buildSnapshot({
        width: 1440,
        height: 900,
        availWidth: 1420,
        availHeight: 860,
        colorDepth: 24,
        pixelDepth: 30,
        devicePixelRatio: 2,
      }),
    );

    expect(screen.width).toBe(1440);
    expect(screen.availWidth).toBe(1420);
    expect(screen.availHeight).toBe(860);
    expect(screen.colorDepth).toBe(24);
    expect(screen.pixelDepth).toBe(30);
    expect(devicePixelRatio).toBe(2);
  });

  it("repairs deleted Screen and devicePixelRatio getters", () => {
    const integrity = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    installScreenPatch(
      buildSnapshot({
        width: 1440,
        height: 900,
        colorDepth: 24,
        devicePixelRatio: 2,
      }),
      globalThis,
      { registrar: integrity, realmId: "document" },
    );
    const screenPrototype = Object.getPrototypeOf(screen) as object;

    Reflect.deleteProperty(screenPrototype, "width");
    Reflect.deleteProperty(globalThis, "devicePixelRatio");
    const results = integrity.ensureSurface("screen");

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "repaired",
          methodId: "screen.width",
          reason: "descriptor-missing",
        }),
        expect.objectContaining({
          status: "repaired",
          methodId: "screen.devicePixelRatio",
          reason: "descriptor-missing",
        }),
      ]),
    );
    expect(screen.width).toBe(1440);
    expect(devicePixelRatio).toBe(2);
  });
});
