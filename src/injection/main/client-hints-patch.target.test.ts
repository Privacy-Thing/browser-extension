import { createIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { cloneRuntimeSnapshot } from "@privacy-brand/refract-core/runtime/snapshot-clone";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installClientHintsPatch } from "@/injection/main/client-hints-patch";
import type { SpoofingSurfaceKey } from "@/shared/spoofing-surfaces";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

const buildSnapshot = (): RuntimeSnapshot => ({
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
    acceptLanguage: "pl-PL,pl",
  },
  date: {
    baseEpochMs: Date.parse("2026-01-15T12:00:00.000Z"),
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [60, 500],
  fingerprint: {
    clientHints: {
      brands: [{ brand: "Google Chrome", version: "139" }],
      mobile: false,
      platform: "macOS",
      fullVersionList: [{ brand: "Google Chrome", version: "139.0.7201.45" }],
    },
  },
});

describe("installClientHintsPatch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("patches userAgentData getters and high entropy values", async () => {
    class FakeUserAgentData {
      get brands() {
        return [{ brand: "Google Chrome", version: "138" }];
      }

      get mobile() {
        return true;
      }

      get platform() {
        return "Windows";
      }

      async getHighEntropyValues(_hints: readonly string[]) {
        return {
          architecture: "x86",
          bitness: "32",
          brands: [{ brand: "Google Chrome", version: "138" }],
          formFactors: ["Desktop"],
          mobile: true,
          platform: "Windows",
          platformVersion: "10.0.0",
          wow64: true,
          fullVersionList: [{ brand: "Google Chrome", version: "138.0.0.0" }],
        };
      }

      toJSON() {
        return {
          brands: [{ brand: "Google Chrome", version: "138" }],
          mobile: true,
          platform: "Windows",
        };
      }
    }

    const userAgentData = new FakeUserAgentData();
    vi.stubGlobal("navigator", { userAgentData });

    installClientHintsPatch(buildSnapshot());

    expect(userAgentData.brands).toEqual([{ brand: "Google Chrome", version: "139" }]);
    expect(userAgentData.mobile).toBe(false);
    expect(userAgentData.platform).toBe("macOS");
    expect(userAgentData.toJSON()).toEqual({
      brands: [{ brand: "Google Chrome", version: "139" }],
      mobile: false,
      platform: "macOS",
    });

    await expect(
      userAgentData.getHighEntropyValues([
        "architecture",
        "bitness",
        "formFactors",
        "platformVersion",
        "wow64",
        "fullVersionList",
      ]),
    ).resolves.toEqual({
      brands: [{ brand: "Google Chrome", version: "139" }],
      mobile: false,
      platform: "macOS",
      fullVersionList: [{ brand: "Google Chrome", version: "139.0.7201.45" }],
    });
    expect(userAgentData.getHighEntropyValues.toString()).toContain("[native code]");
    expect(userAgentData.toJSON.toString()).toContain("[native code]");
  });

  it("skips when userAgentData is unavailable", () => {
    vi.stubGlobal("navigator", {});

    expect(() => installClientHintsPatch(buildSnapshot())).not.toThrow();
  });

  it("reuses one high-entropy wrapper across repeated realm discovery", async () => {
    const nativeCalls = vi.fn();
    class FakeUserAgentData {
      async getHighEntropyValues(_hints: readonly string[]) {
        nativeCalls();
        return {};
      }

      toJSON() {
        return {};
      }
    }

    const userAgentData = new FakeUserAgentData();
    vi.stubGlobal("navigator", { userAgentData });
    installClientHintsPatch(buildSnapshot());
    const installedMethod = userAgentData.getHighEntropyValues;
    nativeCalls.mockClear();

    for (let attempt = 0; attempt < 10_000; attempt += 1) {
      installClientHintsPatch(buildSnapshot());
    }

    expect(userAgentData.getHighEntropyValues).toBe(installedMethod);
    await expect(userAgentData.getHighEntropyValues([])).resolves.toMatchObject({
      mobile: false,
      platform: "macOS",
    });
    expect(nativeCalls).toHaveBeenCalledTimes(1);
  });

  it("does not expose its installation registry through poisoned WeakMap methods", () => {
    class FakeUserAgentData {
      async getHighEntropyValues(_hints: readonly string[]) {
        return {};
      }
      toJSON() {
        return {};
      }
    }
    vi.stubGlobal("navigator", { userAgentData: new FakeUserAgentData() });
    installClientHintsPatch(buildSnapshot());
    const nativeGet = WeakMap.prototype.get;
    const nativeSet = WeakMap.prototype.set;
    const nativeDelete = WeakMap.prototype.delete;
    const observed: unknown[] = [];
    WeakMap.prototype.get = function (key: object) {
      observed.push(this, key);
      return Reflect.apply(nativeGet, this, [key]);
    };
    WeakMap.prototype.set = function (key: object, value: unknown) {
      observed.push(this, key, value);
      return Reflect.apply(nativeSet, this, [key, value]);
    };
    WeakMap.prototype.delete = function (key: object) {
      observed.push(this, key);
      return Reflect.apply(nativeDelete, this, [key]);
    };

    try {
      class ReplacementUserAgentData {
        async getHighEntropyValues(_hints: readonly string[]) {
          return {};
        }
        toJSON() {
          return {};
        }
      }
      vi.stubGlobal("navigator", { userAgentData: new ReplacementUserAgentData() });
      installClientHintsPatch(buildSnapshot());
    } finally {
      WeakMap.prototype.get = nativeGet;
      WeakMap.prototype.set = nativeSet;
      WeakMap.prototype.delete = nativeDelete;
    }

    expect(observed).toEqual([]);
  });

  it("registers exact descriptors even when page intrinsics are poisoned", () => {
    class FakeUserAgentData {
      get brands() {
        return [];
      }
      get mobile() {
        return true;
      }
      get platform() {
        return "Windows";
      }
      async getHighEntropyValues() {
        return {};
      }
      toJSON() {
        return {};
      }
    }
    const userAgentData = new FakeUserAgentData();
    vi.stubGlobal("navigator", { userAgentData });
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    const nativeOwnDescriptor = Object.getOwnPropertyDescriptor;
    const nativeGetPrototypeOf = Object.getPrototypeOf;
    const nativeDefineProperty = Object.defineProperty;
    const nativeHasOwn = Object.hasOwn;
    const nativeReflectApply = Reflect.apply;

    try {
      Object.getOwnPropertyDescriptor = () => undefined;
      Object.getPrototypeOf = () => null;
      Object.defineProperty = () => {
        throw new Error("page-controlled defineProperty");
      };
      Object.hasOwn = () => false;
      Reflect.apply = () => {
        throw new Error("page-controlled apply");
      };

      installClientHintsPatch(buildSnapshot(), globalThis, {
        registrar: registry,
        realmId: "document",
        receiver: userAgentData,
      });
    } finally {
      Object.getOwnPropertyDescriptor = nativeOwnDescriptor;
      Object.getPrototypeOf = nativeGetPrototypeOf;
      Object.defineProperty = nativeDefineProperty;
      Object.hasOwn = nativeHasOwn;
      Reflect.apply = nativeReflectApply;
    }

    expect(registry.ensureSurface("clientHints")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "intact", methodId: "clientHints.brands" }),
        expect.objectContaining({
          status: "intact",
          methodId: "clientHints.getHighEntropyValues",
        }),
      ]),
    );

    const target = nativeGetPrototypeOf(userAgentData);
    if (!target) throw new Error("Missing User-Agent Data prototype");
    Reflect.deleteProperty(target, "brands");
    nativeDefineProperty(target, "getHighEntropyValues", {
      configurable: true,
      value: async () => ({ attacker: true }),
    });

    expect(registry.ensureSurface("clientHints")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "repaired", methodId: "clientHints.brands" }),
        expect.objectContaining({
          status: "repaired",
          methodId: "clientHints.getHighEntropyValues",
        }),
      ]),
    );
  });

  it("returns public DTOs without calling page-owned methods on private arrays", async () => {
    class FakeUserAgentData {
      get brands() {
        return [];
      }
      get mobile() {
        return true;
      }
      get platform() {
        return "Windows";
      }
      async getHighEntropyValues(
        _hints: readonly string[],
      ): Promise<Record<string, unknown>> {
        return {};
      }
      toJSON() {
        return {};
      }
    }
    const userAgentData = new FakeUserAgentData();
    vi.stubGlobal("navigator", { userAgentData });
    const privateSnapshot = cloneRuntimeSnapshot({
      ...buildSnapshot(),
      fingerprint: {
        clientHints: {
          ...buildSnapshot().fingerprint?.clientHints,
          formFactors: ["Desktop"],
        },
      },
    });
    installClientHintsPatch(privateSnapshot);
    const nativeMap = Array.prototype.map;
    const nativeFind = Array.prototype.find;
    const interceptedReceivers: unknown[] = [];
    Array.prototype.map = function (this: unknown[], ...args: unknown[]) {
      if (Object.isFrozen(this)) interceptedReceivers.push(this);
      return Reflect.apply(nativeMap, this, args);
    } as typeof Array.prototype.map;
    Array.prototype.find = function (this: unknown[], ...args: unknown[]) {
      if (Object.isFrozen(this)) interceptedReceivers.push(this);
      return Reflect.apply(nativeFind, this, args);
    } as typeof Array.prototype.find;

    try {
      const brands = userAgentData.brands;
      const values = await userAgentData.getHighEntropyValues([
        "formFactors",
        "fullVersionList",
        "uaFullVersion",
      ]);
      expect(brands).toEqual([{ brand: "Google Chrome", version: "139" }]);
      expect(values).toMatchObject({
        formFactors: ["Desktop"],
        fullVersionList: [{ brand: "Google Chrome", version: "139.0.7201.45" }],
        uaFullVersion: "139.0.7201.45",
      });
      expect(values.formFactors).not.toBe(
        privateSnapshot.fingerprint?.clientHints?.formFactors,
      );
      expect(values.fullVersionList).not.toBe(
        privateSnapshot.fingerprint?.clientHints?.fullVersionList,
      );
      expect(Object.getPrototypeOf(values.formFactors)).toBe(Array.prototype);
      expect(Object.getPrototypeOf(values.fullVersionList)).toBe(Array.prototype);
      expect(Object.getPrototypeOf((values.fullVersionList as object[])[0]!)).toBe(
        Object.prototype,
      );
    } finally {
      Array.prototype.map = nativeMap;
      Array.prototype.find = nativeFind;
    }

    expect(interceptedReceivers).toEqual([]);
  });
});
