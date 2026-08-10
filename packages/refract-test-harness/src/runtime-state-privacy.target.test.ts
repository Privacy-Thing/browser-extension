import {
  installRuntimeOnce,
  installModuleOnce,
  maskAsNative,
  updateRefractSnapshot,
  createSimpleGeoRuntime,
  type RuntimeSnapshot,
} from "@privacy-brand/refract-core";
import { describe, expect, it, vi } from "vitest";

const snapshot: RuntimeSnapshot = {
  geo: {
    latitude: 52.2297,
    longitude: 21.0122,
    accuracy: 25,
    noiseRadius: 50,
  },
  locale: {
    language: "en-US",
    languages: ["en-US"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "en-US",
  },
  date: {
    baseEpochMs: 1_700_000_000_000,
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  authKey: "private-auth-key",
  debugMode: false,
  fingerprint: {
    canvasNoiseSeed: 42,
  },
  watchPositionDelay: [1, 2],
};

const findRuntimeCandidates = (target: object): unknown[] =>
  Object.getOwnPropertySymbols(target)
    .map((symbol) => Reflect.get(target, symbol) as unknown)
    .filter((value) => {
      if (!value || typeof value !== "object") return false;
      const candidate = value as Record<string, unknown>;
      return (
        candidate.modules instanceof Set ||
        Array.isArray(candidate.pendingInstallers) ||
        (candidate.snapshot as { fingerprint?: unknown } | undefined)?.fingerprint !==
          undefined ||
        (candidate.native as { Date?: unknown } | undefined)?.Date !== undefined
      );
    });

describe("private Refract runtime state", () => {
  it("does not publish the runtime control-plane on the target global", () => {
    const targetGlobal = {
      Date,
      Intl,
    } as unknown as typeof globalThis;

    installRuntimeOnce(targetGlobal, snapshot, {
      symbolKey: "runtime-state-privacy-test",
      version: "test",
      installedBy: "test",
    });

    expect(findRuntimeCandidates(targetGlobal)).toEqual([]);
  });

  it("does not publish the native-source registry on the page global", () => {
    const symbolsBefore = new Set(Object.getOwnPropertySymbols(globalThis));
    const wrapped = maskAsNative(function wrapped(): void {});

    expect(wrapped.toString()).toBe("function wrapped() { [native code] }");
    expect(
      Object.getOwnPropertySymbols(globalThis)
        .filter((symbol) => !symbolsBefore.has(symbol))
        .map((symbol) => Reflect.get(globalThis, symbol)),
    ).toEqual([]);
  });

  it("does not route private state through later poisoned collection methods", () => {
    const nativeWeakMapGet = WeakMap.prototype.get;
    const nativeWeakMapSet = WeakMap.prototype.set;
    const nativeSetAdd = Set.prototype.add;
    const nativeSetHas = Set.prototype.has;
    const leakedStates: unknown[] = [];
    const interceptedModuleSets: Set<unknown>[] = [];

    WeakMap.prototype.get = function (key: object): unknown {
      const value = Reflect.apply(nativeWeakMapGet, this, [key]) as unknown;
      if (
        value &&
        typeof value === "object" &&
        "pendingInstallers" in value &&
        "modules" in value
      ) {
        leakedStates.push(value);
      }
      return value;
    };
    WeakMap.prototype.set = function (
      key: object,
      value: unknown,
    ): WeakMap<object, unknown> {
      if (
        value &&
        typeof value === "object" &&
        "pendingInstallers" in value &&
        "modules" in value
      ) {
        leakedStates.push(value);
      }
      return Reflect.apply(nativeWeakMapSet, this, [key, value]) as WeakMap<
        object,
        unknown
      >;
    };
    Set.prototype.has = function (value: unknown): boolean {
      if (value === "xray-bridge") interceptedModuleSets.push(this);
      return Reflect.apply(nativeSetHas, this, [value]) as boolean;
    };
    Set.prototype.add = function (value: unknown): Set<unknown> {
      if (value === "xray-bridge") interceptedModuleSets.push(this);
      return Reflect.apply(nativeSetAdd, this, [value]) as Set<unknown>;
    };

    try {
      const targetGlobal = { Date, Intl } as unknown as typeof globalThis;
      const state = installRuntimeOnce(targetGlobal, snapshot, {
        symbolKey: "poisoned-collection-test",
        version: "test",
      });
      installModuleOnce(state, "xray-bridge", () => undefined);
    } finally {
      WeakMap.prototype.get = nativeWeakMapGet;
      WeakMap.prototype.set = nativeWeakMapSet;
      Set.prototype.add = nativeSetAdd;
      Set.prototype.has = nativeSetHas;
    }

    expect(leakedStates).toEqual([]);
    expect(interceptedModuleSets).toEqual([]);
  });

  it("copies late snapshots without inherited toJSON or control fields", () => {
    const targetGlobal = { Date, Intl } as unknown as typeof globalThis;
    const installer = vi.fn();
    const state = installRuntimeOnce(
      targetGlobal,
      null,
      { symbolKey: "poisoned-json-clone-test", version: "test" },
      { canvas: installer },
    );
    let leakedSnapshot: unknown;

    Object.defineProperty(Object.prototype, "toJSON", {
      configurable: true,
      value(this: unknown) {
        if (
          this &&
          typeof this === "object" &&
          (this as { authKey?: unknown }).authKey === snapshot.authKey
        ) {
          leakedSnapshot = this;
        }
        return {};
      },
    });
    Object.defineProperty(Object.prototype, "sharedWorkerHandlingMode", {
      configurable: true,
      value: "strict",
    });

    try {
      updateRefractSnapshot(state, snapshot);
    } finally {
      delete (Object.prototype as Record<string, unknown>).toJSON;
      delete (Object.prototype as Record<string, unknown>).sharedWorkerHandlingMode;
    }

    expect(leakedSnapshot).toBeUndefined();
    expect(installer).toHaveBeenCalledTimes(1);
    expect(state.snapshot).not.toBe(snapshot);
    expect(state.snapshot?.authKey).toBe(snapshot.authKey);
    expect(state.snapshot?.sharedWorkerHandlingMode).toBeUndefined();
    expect(Object.getPrototypeOf(state.snapshot)).toBeNull();
  });

  it("does not expose deferred installers through array setters, species, or iterators", () => {
    const targetGlobal = { Date, Intl } as unknown as typeof globalThis;
    const state = installRuntimeOnce(targetGlobal, null, {
      symbolKey: "poisoned-private-queue-test",
      version: "test",
    });
    const installer = vi.fn();
    let leakedInstaller: unknown;
    let leakedSpecies: unknown;
    let leakedIteratorReceiver: unknown;
    const nativeIterator = Array.prototype[Symbol.iterator];
    const nativeIndexOf = Array.prototype.indexOf;
    const nativeSpeciesDescriptor = Object.getOwnPropertyDescriptor(
      Array,
      Symbol.species,
    )!;

    Object.defineProperty(Array.prototype, "0", {
      configurable: true,
      set(value) {
        leakedInstaller = value;
      },
    });
    try {
      installRuntimeOnce(
        targetGlobal,
        null,
        { symbolKey: "poisoned-private-queue-test", version: "test" },
        { canvas: installer },
      );
    } finally {
      delete (Array.prototype as unknown as Record<string, unknown>)["0"];
    }

    class LeakArray extends Array {
      constructor(...args: any[]) {
        super(...args);
        leakedSpecies = this;
      }
    }
    Object.defineProperty(Array, Symbol.species, {
      configurable: true,
      get: () => LeakArray,
    });
    Object.defineProperty(Array.prototype, Symbol.iterator, {
      configurable: true,
      value(this: unknown[]) {
        if (Reflect.apply(nativeIndexOf, this, [installer]) >= 0) {
          leakedIteratorReceiver = this;
        }
        return Reflect.apply(nativeIterator, this, []);
      },
    });
    try {
      updateRefractSnapshot(state, snapshot);
    } finally {
      Object.defineProperty(Array, Symbol.species, nativeSpeciesDescriptor);
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        configurable: true,
        writable: true,
        value: nativeIterator,
      });
    }

    expect(leakedInstaller).toBeUndefined();
    expect(leakedSpecies).toBeUndefined();
    expect(leakedIteratorReceiver).toBeUndefined();
    expect(installer).toHaveBeenCalledTimes(1);
  });

  it("does not route private snapshot arrays through page-owned iterators", () => {
    const targetGlobal = { Date, Intl } as unknown as typeof globalThis;
    const state = installRuntimeOnce(targetGlobal, snapshot, {
      symbolKey: "private-snapshot-array-test",
      version: "test",
    });
    const privateSnapshot = state.snapshot!;
    const nativeIterator = Array.prototype[Symbol.iterator];
    let leakedReceiver: unknown;
    Object.defineProperty(Array.prototype, Symbol.iterator, {
      configurable: true,
      value(this: unknown[]) {
        if (Object.isFrozen(this) && this.length === 2) {
          leakedReceiver = this;
        }
        return Reflect.apply(nativeIterator, this, []);
      },
    });

    try {
      const geoRuntime = createSimpleGeoRuntime(
        privateSnapshot.geo,
        privateSnapshot.watchPositionDelay,
      );
      expect(geoRuntime.getNextWatchDelay()).toBeGreaterThanOrEqual(1_000);
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        configurable: true,
        writable: true,
        value: nativeIterator,
      });
    }

    expect(leakedReceiver).toBeUndefined();
  });
});
