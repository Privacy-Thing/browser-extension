/**
 * Integration idempotency tests using realm simulation.
 *
 * Per spec §F.4.1 and §8.1-8.4:
 * - install once: correct state
 * - install twice: same state object, no re-wrapping
 * - early install then runtime install: no double Date offset, no double geolocation wrapping
 * - install in iframe-like realm: state isolated per realm (not shared with parent)
 * - snapshot update on re-install
 *
 * These tests run at the integration level without a real browser, covering the
 * 20% realm-simulated integration tier from the test pyramid.
 */

import {
  installRuntimeOnce,
  getRefractRuntimeState,
  isRefractInstalled,
  updateRefractSnapshot,
  type RuntimeSnapshot,
  type RefractRuntimeState,
} from "@privacy-brand/refract-core";
import { describe, expect, it, vi } from "vitest";

import { createWindowRealm } from "./realm/create-window-realm";
import {
  assertStateInstalled,
  assertInstallIdempotent,
} from "./realm/install-assertions";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const SYMBOL_KEY = "refract-integration-test-realm";

const makeSnapshot = (overrides?: Partial<RuntimeSnapshot>): RuntimeSnapshot => ({
  geo: { latitude: 52.23, longitude: 21.01, accuracy: 30, noiseRadius: 100 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "en"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,en;q=0.9",
  },
  date: {
    baseEpochMs: 1_700_000_000_000,
    offsetMs: 3_600_000,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [5_000, 15_000],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Single install
// ---------------------------------------------------------------------------

describe("realm install — single install", () => {
  it("creates and returns an initialized state on first install", () => {
    const { global } = createWindowRealm();
    const snapshot = makeSnapshot();

    const state = installRuntimeOnce(global, snapshot, {
      symbolKey: SYMBOL_KEY,
      version: "test",
    });

    assertStateInstalled(state);
    expect(state.snapshot).toEqual(snapshot);
    expect(state.snapshot).not.toBe(snapshot);
    expect(isRefractInstalled(global, SYMBOL_KEY)).toBe(true);
  });

  it("state is retrievable via getRefractRuntimeState after install", () => {
    const { global } = createWindowRealm();

    const installed = installRuntimeOnce(global, makeSnapshot(), {
      symbolKey: SYMBOL_KEY + "-retrieve",
      version: "test",
    });

    const retrieved = getRefractRuntimeState(global, SYMBOL_KEY + "-retrieve");
    expect(retrieved).toBe(installed);
  });

  it("getRefractRuntimeState returns undefined on a fresh realm before install", () => {
    const { global } = createWindowRealm();
    const state = getRefractRuntimeState(global, "not-installed-key");
    expect(state).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Double install (early + runtime path)
// ---------------------------------------------------------------------------

describe("realm install — idempotency (double install)", () => {
  it("second installRuntimeOnce returns the exact same state reference", () => {
    const { global } = createWindowRealm();
    const snapshot = makeSnapshot();
    const key = SYMBOL_KEY + "-double";

    const state1 = installRuntimeOnce(global, snapshot, {
      symbolKey: key,
      version: "test",
      installedBy: "early",
    });

    const state2 = installRuntimeOnce(global, snapshot, {
      symbolKey: key,
      version: "test",
      installedBy: "runtime",
    });

    assertInstallIdempotent(state1, state2);
    // installedBy should reflect the FIRST installer, not the second.
    expect(state2.installedBy).toBe("early");
  });

  it("module installers are not called twice on double install", () => {
    const { global } = createWindowRealm();
    const key = SYMBOL_KEY + "-modules-once";
    const snapshot = makeSnapshot();

    const dateInstaller = vi.fn(() => undefined);
    const modules = { date: dateInstaller };

    installRuntimeOnce(
      global,
      snapshot,
      { symbolKey: key, version: "test" },
      modules as any,
    );
    installRuntimeOnce(
      global,
      snapshot,
      { symbolKey: key, version: "test" },
      modules as any,
    );

    expect(dateInstaller).toHaveBeenCalledTimes(1);
  });

  it("each module is installed exactly once even when installModuleOnce is called N times", () => {
    const { global } = createWindowRealm();
    const key = SYMBOL_KEY + "-once-modules";
    const snapshot = makeSnapshot();

    const geolocationInstaller = vi.fn(() => undefined);
    const modules = { geolocation: geolocationInstaller };

    // Three install attempts.
    for (let i = 0; i < 3; i++) {
      installRuntimeOnce(
        global,
        snapshot,
        { symbolKey: key, version: "test" },
        modules as any,
      );
    }

    expect(geolocationInstaller).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Per-realm isolation
// ---------------------------------------------------------------------------

describe("realm install — per-realm isolation", () => {
  it("two separate realms have independent state objects", () => {
    const realm1 = createWindowRealm();
    const realm2 = createWindowRealm();
    const key = SYMBOL_KEY + "-isolation";

    const state1 = installRuntimeOnce(realm1.global, makeSnapshot(), {
      symbolKey: key,
      version: "test",
    });
    const state2 = installRuntimeOnce(
      realm2.global,
      makeSnapshot({ debugMode: true }),
      {
        symbolKey: key,
        version: "test",
      },
    );

    expect(state1).not.toBe(state2);
    expect(state1.snapshot?.debugMode).toBe(false);
    expect(state2.snapshot?.debugMode).toBe(true);
  });

  it("installing in realm1 does not mark realm2 as installed", () => {
    const realm1 = createWindowRealm();
    const realm2 = createWindowRealm();
    const key = SYMBOL_KEY + "-no-cross-realm";

    installRuntimeOnce(realm1.global, makeSnapshot(), {
      symbolKey: key,
      version: "test",
    });

    expect(isRefractInstalled(realm2.global, key)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Snapshot update
// ---------------------------------------------------------------------------

describe("realm install — snapshot update after install", () => {
  it("updateRefractSnapshot replaces the snapshot on existing state", () => {
    const { global } = createWindowRealm();
    const key = SYMBOL_KEY + "-snapshot-update";
    const initialSnapshot = makeSnapshot({ debugMode: false });

    const state = installRuntimeOnce(global, initialSnapshot, {
      symbolKey: key,
      version: "test",
    });

    expect(state.snapshot?.debugMode).toBe(false);

    const updatedSnapshot = makeSnapshot({ debugMode: true });
    updateRefractSnapshot(state, updatedSnapshot);

    expect(state.snapshot?.debugMode).toBe(true);
    // State reference must not change.
    expect(getRefractRuntimeState(global, key)).toBe(state);
  });

  it("re-calling installRuntimeOnce with a new snapshot updates snapshot in-place", () => {
    const { global } = createWindowRealm();
    const key = SYMBOL_KEY + "-snapshot-reimport";

    const state1 = installRuntimeOnce(global, makeSnapshot({ debugMode: false }), {
      symbolKey: key,
      version: "test",
    });

    const newSnapshot = makeSnapshot({ debugMode: true });
    const state2 = installRuntimeOnce(global, newSnapshot, {
      symbolKey: key,
      version: "test",
    });

    // Per install.ts: on re-install, snapshot is updated even though state.installed is true.
    expect(state2).toBe(state1);
    expect(state1.snapshot?.debugMode).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Teardown handlers
// ---------------------------------------------------------------------------

describe("realm install — teardown handlers", () => {
  it("teardown handlers registered by module installers are collected on the state", () => {
    const { global } = createWindowRealm();
    const key = SYMBOL_KEY + "-teardown";
    const teardownFn = vi.fn();

    const modules = {
      date: (_state: RefractRuntimeState) => teardownFn,
    };

    const state = installRuntimeOnce(
      global,
      makeSnapshot(),
      { symbolKey: key, version: "test" },
      modules as any,
    );

    expect(state.teardown.entries.get(0)).toBe(teardownFn);
  });
});
