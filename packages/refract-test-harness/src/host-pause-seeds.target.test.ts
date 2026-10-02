import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  FX_STATIC_CANDIDATES_KEY,
  SHIM_GUARD_KEY,
} from "@/shared/build-id-test-values";
import type { RuntimeSnapshot } from "@/shared/types";

const snapshot: RuntimeSnapshot = {
  geo: { latitude: 52, longitude: 21, accuracy: 25, noiseRadius: 50 },
  locale: {
    language: "pl",
    languages: ["pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500],
};
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(999);
});
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as Record<symbol, unknown>)[Symbol.for(FX_STATIC_CANDIDATES_KEY)];
});

it("Firefox seed and static transports apply the top-host exception and reject its exact expiry", async () => {
  const fx = await import("@privacy-brand/refract-browser/common/firefox-shim-state");
  const state = fx.buildFirefoxShimState(snapshot);
  const pause = { hostname: "h.example", id: "pause", expiresAt: 1000 };
  const seed = {
    containerState: fx.buildFirefoxShimState(null),
    entries: [{ pattern: "*", state }],
    hostPauses: [pause],
  };
  expect(fx.resolveFxSeedForHost("h.example", seed)?.hostPause).toEqual(pause);
  expect(fx.resolveFxSeedForHost("k.example", seed)?.timeLocale?.language).toBe("pl");
  const readStatic = (hostname: string, topHostname: string | null) => {
    (globalThis as Record<symbol, unknown>)[Symbol.for(FX_STATIC_CANDIDATES_KEY)] = [
      {
        buildKey: SHIM_GUARD_KEY,
        pattern: "*",
        specificity: {
          nonWildcardLength: 0,
          exactMatchBonus: 0,
          subdomainOnlyBonus: 0,
          wildcardCount: 1,
        },
        state,
        hostPauses: [pause],
      },
    ];
    return fx.takeFxStaticState(globalThis, hostname, { topHostname });
  };
  expect(readStatic("k.example", "h.example")?.hostPause).toEqual(pause);
  expect(readStatic("h.example", "k.example")?.timeLocale?.language).toBe("pl");
  expect(readStatic("h.example", null)).toBeNull();
  const hash = fx.parseFirefoxHashSeed(
    fx.getFirefoxHashSeedPrefix() +
      btoa(
        JSON.stringify({
          buildKey: SHIM_GUARD_KEY,
          originalHash: "",
          state: fx.resolveFxSeedForHost("h.example", seed),
        }),
      )
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", ""),
  );
  expect(hash?.state.hostPause).toEqual(pause);
  vi.setSystemTime(1000);
  expect(fx.resolveFxSeedForHost("h.example", seed)?.timeLocale?.language).toBe("pl");
  expect(readStatic("h.example", "h.example")?.timeLocale?.language).toBe("pl");
  expect(fx.toSnapshotFromFxState(hash!.state)).toBeNull();
});

it("Chromium rejects a disabled seed at the deadline even if Date.now is subsequently patched", async () => {
  const runtime = await import("@privacy-brand/refract-browser/common/runtime-config");
  const name =
    runtime.getWindowSeedPrefix() +
    btoa(JSON.stringify({ kind: "disabled", previousName: "", expiresAt: 1000 }));
  expect(runtime.consumeRuntimeWindowSeed({ name })?.kind).toBe("disabled");
  vi.setSystemTime(1000);
  const clock = vi.spyOn(Date, "now").mockReturnValue(1);
  expect(runtime.consumeRuntimeWindowSeed({ name })).toBeNull();
  clock.mockRestore();
});
