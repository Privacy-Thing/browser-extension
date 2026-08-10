import {
  installRuntimeOnce,
  getRefractRuntimeState,
  isRefractInstalled,
  installModuleOnce,
  registerInstalledDesc,
  updateRefractSnapshot,
  type RuntimeSnapshot,
  type RefractRuntimeState,
} from "@privacy-brand/refract-core";
import { describe, expect, it, vi } from "vitest";

const mockSnapshot: RuntimeSnapshot = {
  geo: { latitude: 52.2297, longitude: 21.0122, accuracy: 25, noiseRadius: 50 },
  locale: {
    language: "en-US",
    languages: ["en-US"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "en-US",
  },
  date: { baseEpochMs: 1700000000000, offsetMs: 0, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [1, 2],
};

describe("Refract Core Runtime Idempotency & Installer", () => {
  it("initializes and returns a single unified state object per global realm", () => {
    const fakeGlobal = {} as any;
    const symbolKey = "test-symbol-key-1";
    const version = "1.0.0";

    const state = installRuntimeOnce(fakeGlobal, mockSnapshot, {
      symbolKey,
      version,
      installedBy: "test",
    });

    expect(state).toBeDefined();
    expect(state.installed).toBe(true);
    expect(state.version).toBe(version);
    expect(state.installedBy).toBe("test");

    // Second call should return the exact same object reference
    const state2 = installRuntimeOnce(fakeGlobal, mockSnapshot, {
      symbolKey,
      version,
    });
    expect(state2).toBe(state);

    // Should be retrievable via getRefractRuntimeState
    const state3 = getRefractRuntimeState(fakeGlobal, symbolKey);
    expect(state3).toBe(state);

    expect(isRefractInstalled(fakeGlobal, symbolKey)).toBe(true);
  });

  it("safely handles uninitialized realms", () => {
    const fakeGlobal = {} as any;
    const symbolKey = "test-symbol-key-uninitialized";

    expect(getRefractRuntimeState(fakeGlobal, symbolKey)).toBeUndefined();
    expect(isRefractInstalled(fakeGlobal, symbolKey)).toBe(false);
  });

  it("enforces modular idempotency by installing each module exactly once", () => {
    const fakeGlobal = {} as any;
    const symbolKey = "test-symbol-key-modules";
    const version = "1.0.0";

    const state = installRuntimeOnce(fakeGlobal, mockSnapshot, {
      symbolKey,
      version,
      installedBy: "test",
    });

    const mockInstaller = vi.fn((_state: RefractRuntimeState) => {
      return () => {}; // return dummy teardown callback
    });

    // First installation of the module succeeds
    const success1 = installModuleOnce(state, "date", mockInstaller);
    expect(success1).toBe(true);
    expect(mockInstaller).toHaveBeenCalledTimes(1);
    expect(state.modules.has("date")).toBe(true);
    expect(state.teardown.length).toBe(1);

    // Second installation of the same module is skipped and returns false
    const success2 = installModuleOnce(state, "date", mockInstaller);
    expect(success2).toBe(false);
    expect(mockInstaller).toHaveBeenCalledTimes(1); // Still 1
  });

  it("repairs registered descriptors before skipping an installed module", () => {
    const fakeGlobal = {} as any;
    const state = installRuntimeOnce(fakeGlobal, mockSnapshot, {
      symbolKey: "test-symbol-key-integrity-skip",
      version: "1.0.0",
    });
    const target = {};
    const canonical = function canonical() {};
    const descriptor: PropertyDescriptor = {
      configurable: true,
      writable: true,
      value: canonical,
    };
    const installer = vi.fn(() => {
      Object.defineProperty(target, "method", descriptor);
      registerInstalledDesc({
        registrar: state.integrity,
        target,
        key: "method",
        descriptor,
        anchor: {
          surfaceId: "navigator",
          realmId: "document",
          repairPolicy: "repair",
          criticality: "preview-critical",
        },
      });
    });

    expect(installModuleOnce(state, "navigator", installer)).toBe(true);
    Reflect.deleteProperty(target, "method");
    expect(installModuleOnce(state, "navigator", installer)).toBe(false);
    expect(installer).toHaveBeenCalledTimes(1);
    expect(Object.getOwnPropertyDescriptor(target, "method")?.value).toBe(canonical);
    expect(state.integrity.getIncidentHistory()).toEqual([
      expect.objectContaining({
        outcome: "repaired",
        reason: "descriptor-missing",
      }),
    ]);
  });

  it("checks registered descriptors after a snapshot revision", () => {
    const fakeGlobal = {} as any;
    const state = installRuntimeOnce(fakeGlobal, mockSnapshot, {
      symbolKey: "test-symbol-key-integrity-snapshot",
      version: "1.0.0",
    });
    const target = {};
    const getter = () => "spoofed";
    const descriptor: PropertyDescriptor = {
      configurable: true,
      get: getter,
    };
    Object.defineProperty(target, "value", descriptor);
    registerInstalledDesc({
      registrar: state.integrity,
      target,
      key: "value",
      descriptor,
      anchor: {
        surfaceId: "navigator",
        realmId: "document",
        repairPolicy: "repair",
        criticality: "preview-critical",
      },
    });

    Reflect.deleteProperty(target, "value");
    updateRefractSnapshot(state, { ...mockSnapshot, debugMode: true });
    expect(Object.getOwnPropertyDescriptor(target, "value")?.get).toBe(getter);
    expect(state.integrity.getIncidentHistory()).toEqual([
      expect.objectContaining({
        outcome: "repaired",
        reason: "descriptor-missing",
      }),
    ]);
  });

  it("orchestrates installation order and allows custom module injectors", () => {
    const fakeGlobal = {} as any;
    const symbolKey = "test-symbol-key-order";
    const version = "1.0.0";

    const orderCalled: string[] = [];
    const makeMockInstaller = (name: string) => {
      return () => {
        orderCalled.push(name);
      };
    };

    const modules = {
      "native-mask": makeMockInstaller("native-mask"),
      date: makeMockInstaller("date"),
      geolocation: makeMockInstaller("geolocation"),
      iframes: makeMockInstaller("iframes"),
    };

    installRuntimeOnce(
      fakeGlobal,
      mockSnapshot,
      {
        symbolKey,
        version,
      },
      modules as any,
    );

    // The order should follow the spec order (native-mask -> date -> geolocation -> iframes)
    expect(orderCalled).toEqual(["native-mask", "date", "geolocation", "iframes"]);
  });

  it("updates snapshots in-place on existing state during re-loads", () => {
    const fakeGlobal = {} as any;
    const symbolKey = "test-symbol-key-snapshot";
    const version = "1.0.0";

    const state = installRuntimeOnce(fakeGlobal, mockSnapshot, {
      symbolKey,
      version,
    });

    expect(state.snapshot).toEqual(mockSnapshot);
    expect(state.snapshot).not.toBe(mockSnapshot);

    const updatedSnapshot: RuntimeSnapshot = {
      ...mockSnapshot,
      debugMode: true,
    };

    updateRefractSnapshot(state, updatedSnapshot);
    expect(state.snapshot).toEqual(updatedSnapshot);
    expect(state.snapshot).not.toBe(updatedSnapshot);
    expect(state.snapshot?.debugMode).toBe(true);
  });
});
