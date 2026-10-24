import { readFileSync } from "node:fs";
import path from "node:path";

import { bindAnalystTraps } from "@privacy-brand/refract-core/runtime/analyst-traps";
import { describe, expect, it, vi } from "vitest";

import { getTrappableMethods } from "./inspector-state";
import { FX_TRAP_EXCLUSIONS } from "./inspector-support";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  SPOOFING_SURFACE_METHODS,
  isSurfaceSupported,
  getSurfaceDefinition,
} from "@/shared/spoofing-surfaces";
import type { RuntimeSnapshot } from "@/shared/types";

const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), "utf8");
// These are hook producers and their method-ID mappings, never integrity metadata.
const hookSources = [
  "src/injection/main/geo-surface-patch.ts",
  "src/injection/main/date-intl-patch.ts",
  "src/injection/main/intl-patch-installer.ts",
  "src/injection/main/canvas-patch-installer.ts",
  "src/injection/main/webgl-patch.ts",
  "src/injection/main/audio-patch.ts",
  "src/injection/main/locale-patch.ts",
  "src/injection/main/screen-patch.ts",
  "src/injection/main/client-hints-patch.ts",
  "src/injection/main/webrtc-patch.ts",
  "src/injection/main/worker-patch.ts",
  "src/injection/main/service-worker-patch.ts",
  "src/injection/main/runtime-module-installers.ts",
]
  .map(read)
  .join("\n");

const snapshot: RuntimeSnapshot = {
  geo: { latitude: 0, longitude: 0, accuracy: 10, noiseRadius: 50 },
  locale: { language: "en", languages: ["en"], acceptLanguage: "en", timeZone: "UTC" },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
  debugMode: false,
  watchPositionDelay: [60, 500],
  temporalApiEnabled: true,
  sharedWorkerHandlingMode: "spoof",
  blockServiceWorkerRegistration: true,
  fingerprint: {
    hardwareConcurrency: 4,
    deviceMemory: 8,
    maxTouchPoints: 0,
    platform: "Linux x86_64",
    userAgent: "Test Browser",
    vendor: "Test Vendor",
    appVersion: "1",
    canvasNoiseSeed: 1,
    audioNoiseSeed: 1,
    webGL: {},
    clientHints: {},
    screen: { width: 1280, height: 720, colorDepth: 24, devicePixelRatio: 1 },
  },
};

describe("Inspector method catalog coverage", () => {
  for (const method of SPOOFING_SURFACE_METHODS) {
    it(`${method.id} has a selected trap or an explicit target exclusion`, () => {
      const supported = isSurfaceSupported(
        getSurfaceDefinition(method.surfaceKey),
        BUILD_BROWSER_TARGET,
      );
      const excluded =
        BUILD_BROWSER_TARGET === "firefox" &&
        Object.hasOwn(FX_TRAP_EXCLUSIONS, method.id);
      const available = getTrappableMethods(snapshot);
      if (!supported || excluded) {
        expect(available).not.toContain(method.id);
        if (excluded)
          expect(
            FX_TRAP_EXCLUSIONS[method.id as keyof typeof FX_TRAP_EXCLUSIONS],
          ).not.toHaveLength(0);
        return;
      }
      expect(available).toContain(method.id);
      const stop = vi.fn();
      const emit = bindAnalystTraps(
        vi.fn(),
        { methods: [method.id], mode: "first-call" },
        stop,
      );
      emit(method.surfaceKey, method.id);
      expect(stop).toHaveBeenCalledOnce();
      // BatteryManager and Temporal generate stable IDs inside their shared adapters.
      if (method.surfaceKey === "battery") {
        const battery = read("packages/refract-core/src/fingerprint/battery-status.ts");
        expect(
          battery.includes(
            method.id === "battery.getBattery"
              ? 'state.onAccess?.("battery.getBattery")'
              : "state.onAccess?.(batteryManagerMethodId(key))",
          ),
        ).toBe(true);
        expect(hookSources).toContain(
          'onAccess: (methodId) => markSurfaceUsed("battery", methodId)',
        );
      } else if (method.id.startsWith("temporal.")) {
        expect(read("packages/refract-core/src/time/temporal-api-patch.ts")).toContain(
          "state.onAccess?.(methodId)",
        );
        expect(read("src/injection/temporal-api-patch.ts")).toContain(
          'markSurfaceUsed("timeLocale", methodId)',
        );
      } else {
        expect(hookSources.includes(`"${method.id}"`)).toBe(true);
      }
    });
  }
});
