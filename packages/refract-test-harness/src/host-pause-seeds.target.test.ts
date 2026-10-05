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

it.each(["service-worker", "shared-worker"] as const)(
  "narrow %s tests preserve other surfaces and cannot replay an expired iframe or unload seed",
  async (workerTest) => {
    const { applyHostOverride } = await import("@/shared/host-protection-pause");
    const { isRuntimeSnapshot } = await import("@/shared/runtime-snapshot");
    const runtime =
      await import("@privacy-brand/refract-browser/common/runtime-config");
    const fx = await import("@privacy-brand/refract-browser/common/firefox-shim-state");
    const baseline = {
      ...snapshot,
      blockServiceWorkerRegistration: true,
      sharedWorkerHandlingMode: "strict" as const,
    };
    const pause = { hostname: "h.example", id: "test", expiresAt: 1000, workerTest };
    const narrow = applyHostOverride(baseline, pause)!;
    expect(narrow.locale).toEqual(baseline.locale);
    expect(narrow.geo).toEqual(baseline.geo);
    expect(narrow.blockServiceWorkerRegistration).toBe(workerTest !== "service-worker");
    expect(narrow.sharedWorkerHandlingMode).toBe(
      workerTest === "shared-worker" ? "native" : "strict",
    );
    const seed = {
      entries: [{ pattern: "*", state: fx.buildFirefoxShimState(baseline) }],
      containerState: null,
      hostPauses: [pause],
    };
    const state = fx.resolveFxSeedForHost("h.example", seed)!;
    expect(state.timeLocale?.language).toBe("pl");
    expect(state.blockServiceWorkerRegistration).toBe(
      narrow.blockServiceWorkerRegistration,
    );
    expect(fx.toSnapshotFromFxState(state)?.hostOverrideExpiresAt).toBe(1000);
    const name =
      runtime.getWindowSeedPrefix() +
      btoa(
        JSON.stringify({
          kind: "snapshot",
          previousName: "original",
          snapshot: narrow,
        }),
      );
    const carrier = { name };
    expect(runtime.consumeRuntimeWindowSeed(carrier)?.kind).toBe("snapshot");
    carrier.name = name; // A later iframe/unload writer replays the same activation.
    vi.setSystemTime(1000);
    expect(isRuntimeSnapshot(narrow)).toBe(false);
    expect(runtime.consumeRuntimeWindowSeed(carrier)).toBeNull();
    expect(fx.toSnapshotFromFxState(state)).toBeNull();
    expect(
      fx.resolveFxSeedForHost("h.example", seed)?.blockServiceWorkerRegistration,
    ).toBe(true);
    expect(fx.resolveFxSeedForHost("k.example", seed)?.sharedWorkerHandlingMode).toBe(
      "strict",
    );
  },
);

it("saved worker policies survive early transports without changing regional values or independent top hosts", async () => {
  const fx = await import("@privacy-brand/refract-browser/common/firefox-shim-state");
  const preload = await import("@/content/preloaded-runtime");
  const workerPolicyExceptions = { "h.example": { serviceWorker: false as const } };
  const baseline = { ...snapshot, blockServiceWorkerRegistration: true };
  const state = fx.buildFirefoxShimState(baseline);
  const seed = {
    entries: [{ pattern: "*", state }],
    containerState: null,
    workers: workerPolicyExceptions,
  };
  const restored = fx.normalizeFxWindowSeed(seed)!;
  expect(
    fx.resolveFxSeedForHost("h.example", restored)?.blockServiceWorkerRegistration,
  ).toBe(false);
  expect(
    fx.resolveFxSeedForHost("k.example", restored)?.blockServiceWorkerRegistration,
  ).toBe(true);
  const readStatic = (topHostname: string | null, hostname = "k.example") => {
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
        workers: workerPolicyExceptions,
      },
    ];
    return fx.takeFxStaticState(globalThis, hostname, { topHostname });
  };
  expect(readStatic("h.example")?.blockServiceWorkerRegistration).toBe(false);
  expect(readStatic("k.example")?.blockServiceWorkerRegistration).toBe(true);
  expect(readStatic(null)).toEqual(state);
  // An iframe host cannot opt into its own exception when its top host is unknown.
  expect(readStatic(null, "h.example")).toEqual(state);
  const preloaded = {
    entries: [
      { pattern: "*", snapshot: baseline, blockServiceWorkerRegistration: true },
    ],
    workerPolicyExceptions,
  };
  expect(preload.resolvePreloadedSnapshot("h.example", preloaded)).toEqual({
    ...baseline,
    blockServiceWorkerRegistration: false,
  });
  expect(preload.resolvePreloadedSnapshot("k.example", preloaded)).toEqual(baseline);
  expect(
    preload.resolvePreloadedSnapshot("h.example", {
      ...preloaded,
      trustedSites: [{ pattern: "h.example", enabled: true }],
    }),
  ).toBeNull();
  expect(
    fx.resolveFxSeedForHost("h.example", {
      ...restored,
      trustedPatterns: ["h.example"],
    }),
  ).toBeNull();
});
