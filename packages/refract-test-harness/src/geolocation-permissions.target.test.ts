import {
  createGeoPermissionState,
  getOrCreateGeoPermState,
  installGeoPermPatch,
} from "@privacy-brand/refract-core";
import { createIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { afterEach, describe, expect, it, vi } from "vitest";

const createPermissionFixture = () => {
  const slots = new WeakMap<object, { state: PermissionState }>();
  let onchange: ((this: PermissionStatus, ev: Event) => unknown) | null = null;
  const prototype = Object.create(EventTarget.prototype) as PermissionStatus;
  const requireSlot = (receiver: object): { state: PermissionState } => {
    const slot = slots.get(receiver);
    if (!slot) {
      throw new TypeError("Illegal invocation");
    }
    return slot;
  };

  Object.defineProperties(prototype, {
    name: {
      configurable: true,
      enumerable: true,
      get(this: object) {
        requireSlot(this);
        return "geolocation";
      },
    },
    state: {
      configurable: true,
      enumerable: true,
      get(this: object) {
        return requireSlot(this).state;
      },
    },
    onchange: {
      configurable: true,
      enumerable: true,
      get(this: object) {
        requireSlot(this);
        return onchange;
      },
      set(this: object, value: typeof onchange) {
        requireSlot(this);
        onchange = value;
      },
    },
  });

  const createStatus = (): PermissionStatus => {
    const status = Object.create(prototype) as PermissionStatus;
    slots.set(status, { state: "prompt" });
    return status;
  };
  const status = createStatus();

  return { createStatus, prototype, status };
};

describe("geolocation permissions helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shares one permissions patch state through the hidden realm runtime", () => {
    const targetGlobal = {
      Date,
      Intl,
    } as unknown as typeof globalThis;

    const first = getOrCreateGeoPermState(targetGlobal);
    const second = getOrCreateGeoPermState(targetGlobal);

    expect(second).toBe(first);
  });

  it("returns a native PermissionStatus while overriding only its prototype state", async () => {
    const { prototype, status } = createPermissionFixture();
    const nativeStateGetter = Object.getOwnPropertyDescriptor(prototype, "state")?.get;
    const queryTarget = {
      query: vi.fn(async (_descriptor: PermissionDescriptor) => status),
    };

    installGeoPermPatch({
      patchState: createGeoPermissionState(),
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: () => "granted",
    });

    const result = await queryTarget.query({ name: "geolocation" });

    expect(result).toBe(status);
    expect(result.name).toBe("geolocation");
    expect(result.state).toBe("granted");
    expect(Object.getOwnPropertyNames(result)).toEqual([]);
    expect(nativeStateGetter?.call(result)).toBe("prompt");
    expect(() => nativeStateGetter?.call({})).toThrow("Illegal invocation");

    const handler = vi.fn();
    result.onchange = handler;
    expect(result.onchange).toBe(handler);
    expect(
      Object.getOwnPropertyDescriptor(prototype, "state")?.get?.toString(),
    ).toContain("[native code]");
  });

  it("validates the receiver through native query before resolving geolocation", () => {
    const { status } = createPermissionFixture();
    const queryTarget = {
      query(this: unknown) {
        if (this !== queryTarget) {
          throw new TypeError("Illegal invocation");
        }
        return Promise.resolve(status);
      },
    };
    const resolveGeolocationState = vi.fn(() => "granted" as const);
    const descriptorName = vi.fn(() => "geolocation");

    installGeoPermPatch({
      patchState: createGeoPermissionState(),
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState,
    });

    expect(() =>
      Reflect.apply(queryTarget.query, {}, [
        {
          get name() {
            return descriptorName();
          },
        },
      ]),
    ).toThrow("Illegal invocation");
    expect(descriptorName).not.toHaveBeenCalled();
    expect(resolveGeolocationState).not.toHaveBeenCalled();
  });

  it("delegates primitive descriptors to native query unchanged", () => {
    const { status } = createPermissionFixture();
    const nativePromise = Promise.resolve(status);
    const nativeQuery = vi.fn(() => nativePromise);
    const queryTarget = { query: nativeQuery };
    const resolveGeolocationState = vi.fn(() => "granted" as const);

    installGeoPermPatch({
      patchState: createGeoPermissionState(),
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState,
    });

    const result = Reflect.apply(queryTarget.query, queryTarget, [null]);

    expect(result).toBe(nativePromise);
    expect(nativeQuery).toHaveBeenCalledWith(null);
    expect(resolveGeolocationState).not.toHaveBeenCalled();
  });

  it("patches geolocation queries and returns the original native promise otherwise", async () => {
    const { status } = createPermissionFixture();
    const nativePromise = Promise.resolve(status);
    const nativeQuery = vi.fn((_descriptor: PermissionDescriptor) => nativePromise);
    const logger = vi.fn();
    const queryTarget = { query: nativeQuery };

    installGeoPermPatch({
      logger,
      patchState: createGeoPermissionState(),
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: () => "denied",
    });

    const notificationPromise = queryTarget.query({
      name: "notifications",
    } as PermissionDescriptor);
    expect(notificationPromise).toBe(nativePromise);

    const geolocationStatus = await queryTarget.query({
      name: "geolocation",
    } as PermissionDescriptor);
    expect(geolocationStatus.state).toBe("denied");
    expect(nativeQuery).toHaveBeenCalledTimes(2);
    expect(queryTarget.query.toString()).toContain("[native code]");
    expect(Object.hasOwn(queryTarget.query, "prototype")).toBe(false);
    expect(logger).toHaveBeenNthCalledWith(1, "query [native]", [
      { name: "notifications" },
    ]);
    expect(logger).toHaveBeenNthCalledWith(
      2,
      "query [geolocation]",
      [{ name: "geolocation" }],
      { state: "denied" },
    );
  });

  it("supports asynchronous geolocation state resolution", async () => {
    const { status } = createPermissionFixture();
    const queryTarget = {
      query: vi.fn(async (_descriptor: PermissionDescriptor) => status),
    };

    installGeoPermPatch({
      patchState: createGeoPermissionState(),
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: async () => "denied" as const,
    });

    await expect(
      queryTarget.query({ name: "geolocation" } as PermissionDescriptor),
    ).resolves.toMatchObject({ state: "denied" });
  });

  it("uses the descriptor name consumed by native query without reading it again", async () => {
    const { status } = createPermissionFixture();
    const nativeQuery = vi.fn((descriptor: PermissionDescriptor) => {
      void descriptor.name;
      return Promise.resolve(status);
    });
    const queryTarget = { query: nativeQuery };
    let nameReads = 0;
    const descriptor = {
      get name() {
        nameReads += 1;
        return nameReads === 1 ? "geolocation" : "notifications";
      },
    } as PermissionDescriptor;

    installGeoPermPatch({
      patchState: createGeoPermissionState(),
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: () => "denied",
    });

    const result = await queryTarget.query(descriptor);

    expect(nameReads).toBe(1);
    expect(result.state).toBe("denied");
  });

  it("updates repeated installations without stacking query or state wrappers", async () => {
    const { prototype, status } = createPermissionFixture();
    const nativeQuery = vi.fn((descriptor: PermissionDescriptor) => {
      void descriptor.name;
      return Promise.resolve(status);
    });
    const queryTarget = { query: nativeQuery };
    const patchState = createGeoPermissionState();
    const firstLogger = vi.fn();
    const latestLogger = vi.fn();

    installGeoPermPatch({
      logger: firstLogger,
      patchState,
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: () => "granted",
    });
    const patchedQuery = queryTarget.query;
    await queryTarget.query({ name: "geolocation" });
    const patchedStateGetter = Object.getOwnPropertyDescriptor(prototype, "state")?.get;

    installGeoPermPatch({
      logger: latestLogger,
      patchState,
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: () => "denied",
    });
    const result = await queryTarget.query({ name: "geolocation" });

    expect(queryTarget.query).toBe(patchedQuery);
    expect(Object.getOwnPropertyDescriptor(prototype, "state")?.get).toBe(
      patchedStateGetter,
    );
    expect(result.state).toBe("denied");
    expect(firstLogger).toHaveBeenCalledTimes(1);
    expect(latestLogger).toHaveBeenCalledTimes(1);
  });

  it("keeps one state getter after ten thousand permission queries", async () => {
    const { prototype, status } = createPermissionFixture();
    const queryTarget = {
      query: vi.fn((descriptor: PermissionDescriptor) => {
        void descriptor.name;
        return Promise.resolve(status);
      }),
    };

    installGeoPermPatch({
      patchState: createGeoPermissionState(),
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: () => "granted",
    });

    await queryTarget.query({ name: "geolocation" });
    const stateGetter = Object.getOwnPropertyDescriptor(prototype, "state")?.get;
    await Promise.all(
      Array.from({ length: 10_000 }, () => queryTarget.query({ name: "geolocation" })),
    );

    expect(Object.getOwnPropertyDescriptor(prototype, "state")?.get).toBe(stateGetter);
    expect(status.state).toBe("granted");
  });

  it("repairs a deleted PermissionStatus.state getter on the next query", async () => {
    const { prototype, status } = createPermissionFixture();
    const queryTarget = {
      query: vi.fn(async (_descriptor: PermissionDescriptor) => status),
    };
    const registry = createIntegrityRegistry<string, string>({
      now: () => 1,
    });

    installGeoPermPatch({
      integrity: {
        registrar: registry,
        surfaceId: "geolocation",
        realmId: "document",
      },
      patchState: createGeoPermissionState(),
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: () => "granted",
    });

    await queryTarget.query({ name: "geolocation" });
    const canonicalGetter = Object.getOwnPropertyDescriptor(prototype, "state")?.get;
    expect(Reflect.deleteProperty(prototype, "state")).toBe(true);

    const result = await queryTarget.query({ name: "geolocation" });

    expect(Object.getOwnPropertyDescriptor(prototype, "state")?.get).toBe(
      canonicalGetter,
    );
    expect(result.state).toBe("granted");
    expect(registry.getIncidentHistory()).toEqual([
      expect.objectContaining({
        outcome: "repaired",
        reason: "descriptor-missing",
        surfaceId: "geolocation",
      }),
    ]);
  });

  it("repairs PermissionStatus.state deleted before the first query", async () => {
    const { prototype, status } = createPermissionFixture();
    const queryTarget = {
      query: vi.fn(async (_descriptor: PermissionDescriptor) => status),
    };
    const registry = createIntegrityRegistry<string, string>({ now: () => 1 });
    installGeoPermPatch({
      integrity: { registrar: registry, surfaceId: "geolocation", realmId: "document" },
      patchState: createGeoPermissionState(),
      permissionPrototype: prototype,
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: () => "granted",
    });
    expect(Reflect.deleteProperty(prototype, "state")).toBe(true);

    const result = await queryTarget.query({ name: "geolocation" });

    expect(result.state).toBe("granted");
    expect(registry.getIncidentHistory()).toEqual([
      expect.objectContaining({ outcome: "repaired", reason: "descriptor-missing" }),
    ]);
  });

  it("repairs a configurable PermissionStatus.state replacement before the first query", async () => {
    const { prototype, status } = createPermissionFixture();
    const queryTarget = {
      query: vi.fn(async (_descriptor: PermissionDescriptor) => status),
    };
    const registry = createIntegrityRegistry<string, string>({ now: () => 1 });
    installGeoPermPatch({
      integrity: { registrar: registry, surfaceId: "geolocation", realmId: "document" },
      patchState: createGeoPermissionState(),
      permissionPrototype: prototype,
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: () => "denied",
    });
    Object.defineProperty(prototype, "state", {
      configurable: true,
      get: () => "prompt",
    });

    const result = await queryTarget.query({ name: "geolocation" });

    expect(result.state).toBe("denied");
    expect(registry.getIncidentHistory()).toEqual([
      expect.objectContaining({ outcome: "repaired", reason: "descriptor-replaced" }),
    ]);
  });

  it("reports a fixed PermissionStatus.state replacement before the first query", async () => {
    const { prototype, status } = createPermissionFixture();
    const queryTarget = {
      query: vi.fn(async (_descriptor: PermissionDescriptor) => status),
    };
    const registry = createIntegrityRegistry<string, string>({ now: () => 1 });
    installGeoPermPatch({
      integrity: { registrar: registry, surfaceId: "geolocation", realmId: "document" },
      patchState: createGeoPermissionState(),
      permissionPrototype: prototype,
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: () => "granted",
    });
    Object.defineProperty(prototype, "state", {
      configurable: false,
      get: () => "prompt",
    });

    await queryTarget.query({ name: "geolocation" });

    expect(registry.getIncidentHistory()).toEqual([
      expect.objectContaining({
        outcome: "unrecoverable",
        reason: "hostile-non-configurable",
      }),
    ]);
  });

  it("checks effective state lookup on every returned PermissionStatus", async () => {
    const { createStatus, prototype, status: firstStatus } = createPermissionFixture();
    const secondStatus = createStatus();
    let queryCount = 0;
    const queryTarget = {
      query: vi.fn(async (_descriptor: PermissionDescriptor) => {
        queryCount += 1;
        return queryCount === 1 ? firstStatus : secondStatus;
      }),
    };
    const registry = createIntegrityRegistry<string, string>({ now: () => 1 });
    installGeoPermPatch({
      integrity: { registrar: registry, surfaceId: "geolocation", realmId: "document" },
      patchState: createGeoPermissionState(),
      permissionPrototype: prototype,
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: () => "granted",
    });
    await queryTarget.query({ name: "geolocation" });
    Object.defineProperty(secondStatus, "state", {
      configurable: true,
      get: () => "prompt",
    });

    const result = await queryTarget.query({ name: "geolocation" });

    expect(Object.hasOwn(secondStatus, "state")).toBe(false);
    expect(result.state).toBe("granted");
    expect(registry.getIncidentHistory()).toEqual([
      expect.objectContaining({
        outcome: "repaired",
        reason: "prototype-chain-changed",
      }),
    ]);
  });

  it("repairs PermissionStatus.state prototype drift and an own shadow together", async () => {
    const { prototype, status } = createPermissionFixture();
    const queryTarget = {
      query: vi.fn(async (_descriptor: PermissionDescriptor) => status),
    };
    const registry = createIntegrityRegistry<string, string>({ now: () => 1 });
    installGeoPermPatch({
      integrity: { registrar: registry, surfaceId: "geolocation", realmId: "document" },
      patchState: createGeoPermissionState(),
      permissionPrototype: prototype,
      queryTarget: queryTarget as unknown as Permissions,
      resolveGeolocationState: () => "granted",
    });
    Object.defineProperty(prototype, "state", {
      configurable: true,
      get: () => "prompt",
    });
    Object.defineProperty(status, "state", {
      configurable: true,
      get: () => "prompt",
    });

    const result = await queryTarget.query({ name: "geolocation" });

    expect(Object.hasOwn(status, "state")).toBe(false);
    expect(result.state).toBe("granted");
    expect(registry.getRecentResults()).toEqual([
      expect.objectContaining({ status: "repaired" }),
    ]);
  });
});
