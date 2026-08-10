import type { FirefoxGeoState } from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { createFxGeoBridge } from "@privacy-brand/refract-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GEO_STATE: FirefoxGeoState = {
  latitude: 52.2297,
  longitude: 21.0122,
  accuracy: 25,
  noiseRadius: 50,
  watchPositionDelay: [60, 500],
};

describe("createFxGeoBridge", () => {
  const buildTargetGlobal = (
    geolocation: Geolocation,
    permissions: Permissions,
  ): typeof globalThis =>
    ({
      navigator: {
        geolocation,
        permissions,
      },
      setTimeout,
      clearTimeout,
      document: {
        visibilityState: "visible" as DocumentVisibilityState,
      },
    }) as unknown as typeof globalThis;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.1234);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("buffers getCurrentPosition until Firefox shim geo state resolves", () => {
    const geolocation = {} as Geolocation;
    const permissions = {
      query: vi.fn(),
    } as unknown as Permissions;
    const successCallback = vi.fn();
    const syncBootstrapState = vi.fn();
    const bridge = createFxGeoBridge({
      syncBootstrapState,
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    bridge.install();
    geolocation.getCurrentPosition(successCallback);
    vi.runAllTimers();

    expect(successCallback).not.toHaveBeenCalled();
    expect(syncBootstrapState).toHaveBeenCalledTimes(1);

    bridge.resolveGeoState(GEO_STATE);
    vi.runAllTimers();

    expect(successCallback).toHaveBeenCalledTimes(1);
    expect(
      (successCallback.mock.calls[0]?.[0] as GeolocationPosition).coords.accuracy,
    ).toBeGreaterThan(0);
  });

  it("queues geolocation permission queries until Firefox shim geo state resolves", async () => {
    const geolocation = {} as Geolocation;
    const nativeStatus = Object.create({
      get name() {
        return "geolocation";
      },
      get state() {
        return "prompt";
      },
      onchange: null,
    }) as PermissionStatus;
    const permissions = {
      query: vi.fn(async () => nativeStatus),
    } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    bridge.install();

    let resolved = false;
    const statusPromise = permissions.query({
      name: "geolocation",
    } as PermissionDescriptor) as Promise<PermissionStatus>;
    void statusPromise.then(() => {
      resolved = true;
    });
    await Promise.resolve();

    expect(resolved).toBe(false);

    bridge.resolveGeoState(null);

    const status = await statusPromise;
    expect(status.name).toBe("geolocation");
    expect(status.state).toBe("denied");
  });

  // -------------------------------------------------------------------------
  // resolveGeoState idempotency
  // -------------------------------------------------------------------------

  it("second resolveGeoState call is ignored — only first state takes effect", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    bridge.install();
    bridge.resolveGeoState(GEO_STATE);

    expect(bridge.isResolved()).toBe(true);

    // Second call with different state should not override.
    const differentState: FirefoxGeoState = { ...GEO_STATE, latitude: 0, longitude: 0 };
    bridge.resolveGeoState(differentState);

    // Bridge remains resolved; no throw.
    expect(bridge.isResolved()).toBe(true);
  });

  it("isResolved() returns false before any resolveGeoState call", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    expect(bridge.isResolved()).toBe(false);
  });

  it("isResolved() returns true after resolveGeoState(null) — absent geo", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    bridge.resolveGeoState(null);
    expect(bridge.isResolved()).toBe(true);
  });

  // -------------------------------------------------------------------------
  // watchPosition — unique IDs and clearWatch semantics
  // -------------------------------------------------------------------------

  it("watchPosition returns unique incrementing watch IDs", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    bridge.install();

    const id1 = geolocation.watchPosition(vi.fn());
    const id2 = geolocation.watchPosition(vi.fn());
    const id3 = geolocation.watchPosition(vi.fn());

    expect(typeof id1).toBe("number");
    expect(new Set([id1, id2, id3]).size).toBe(3);
    expect(id2).toBeGreaterThan(id1);
    expect(id3).toBeGreaterThan(id2);
  });

  it("clearWatch before state resolution prevents buffered watchPosition from firing", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    bridge.install();

    const success = vi.fn();
    const watchId = geolocation.watchPosition(success);

    // Cancel while still buffered.
    geolocation.clearWatch(watchId);

    // Resolve state — buffered watch should be discarded.
    bridge.resolveGeoState(GEO_STATE);
    vi.runAllTimers();

    expect(success).not.toHaveBeenCalled();
  });

  it("clearWatch after state resolution stops ongoing watch ticks", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    bridge.install();
    bridge.resolveGeoState(GEO_STATE);

    const success = vi.fn();
    const watchId = geolocation.watchPosition(success);

    // Advance past the minimum watch delay (60 s) to get at least one tick.
    vi.advanceTimersByTime(90_000);
    const callsAfterFirstRun = success.mock.calls.length;
    expect(callsAfterFirstRun).toBeGreaterThanOrEqual(1);

    geolocation.clearWatch(watchId);

    // Advance further — no additional calls should arrive.
    vi.advanceTimersByTime(500_000);
    expect(success.mock.calls.length).toBe(callsAfterFirstRun);
  });

  it("clearWatch of unknown ID is a no-op and does not throw", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    bridge.install();
    bridge.resolveGeoState(GEO_STATE);

    expect(() => geolocation.clearWatch(99_999)).not.toThrow();
  });

  it("clearWatch does not affect other active watches", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    bridge.install();
    bridge.resolveGeoState(GEO_STATE);

    const success1 = vi.fn();
    const success2 = vi.fn();

    const watchId1 = geolocation.watchPosition(success1);
    geolocation.watchPosition(success2);

    // Advance past minimum delay to get at least one tick on both watches.
    vi.advanceTimersByTime(90_000);
    const calls1Before = success1.mock.calls.length;
    const calls2Before = success2.mock.calls.length;
    expect(calls1Before).toBeGreaterThanOrEqual(1);
    expect(calls2Before).toBeGreaterThanOrEqual(1);

    // Cancel only watch 1.
    geolocation.clearWatch(watchId1);

    // Advance further — watch 1 frozen, watch 2 may fire more.
    vi.advanceTimersByTime(200_000);
    expect(success1.mock.calls.length).toBe(calls1Before);
    expect(success2.mock.calls.length).toBeGreaterThanOrEqual(calls2Before);
  });

  // -------------------------------------------------------------------------
  // getCurrentPosition after state is already resolved
  // -------------------------------------------------------------------------

  it("getCurrentPosition resolves immediately when called after state is ready", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    bridge.install();
    bridge.resolveGeoState(GEO_STATE);

    const success = vi.fn();
    geolocation.getCurrentPosition(success);
    vi.runAllTimers();

    expect(success).toHaveBeenCalledTimes(1);
    const position = success.mock.calls[0]?.[0] as GeolocationPosition;
    expect(position.coords.latitude).toBeTypeOf("number");
    expect(position.coords.longitude).toBeTypeOf("number");
    expect(position.toJSON()).toEqual({
      timestamp: position.timestamp,
      coords: position.coords.toJSON(),
    });
    expect(JSON.parse(JSON.stringify(position))).toEqual(position.toJSON());
  });

  it("getCurrentPosition reports TIMEOUT after Firefox state is ready", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    bridge.install();
    bridge.resolveGeoState(GEO_STATE);

    const success = vi.fn();
    const error = vi.fn();
    geolocation.getCurrentPosition(success, error, { timeout: 0 });
    expect(error).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();

    expect(success).not.toHaveBeenCalled();
    expect((error.mock.calls[0]?.[0] as GeolocationPositionError).code).toBe(3);
  });

  it("returns a fresh Firefox cached position before applying timeout", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });
    bridge.install();
    bridge.resolveGeoState(GEO_STATE);
    const firstSuccess = vi.fn();
    const cachedSuccess = vi.fn();
    const error = vi.fn();

    geolocation.getCurrentPosition(firstSuccess, error, {
      maximumAge: 60_000,
      timeout: 10_000,
    });
    vi.runOnlyPendingTimers();
    geolocation.getCurrentPosition(cachedSuccess, error, {
      maximumAge: 60_000,
      timeout: 0,
    });
    vi.runOnlyPendingTimers();

    expect(cachedSuccess).toHaveBeenCalledWith(firstSuccess.mock.calls[0]?.[0]);
    expect(error).not.toHaveBeenCalled();
  });

  it("returns a fresh Firefox cached position to watchPosition before timeout", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });
    bridge.install();
    bridge.resolveGeoState(GEO_STATE);
    const firstSuccess = vi.fn();
    const watchSuccess = vi.fn();
    const error = vi.fn();

    geolocation.getCurrentPosition(firstSuccess, error, { timeout: 10_000 });
    vi.runOnlyPendingTimers();
    const watchId = geolocation.watchPosition(watchSuccess, error, {
      maximumAge: 60_000,
      timeout: 0,
    });
    vi.runOnlyPendingTimers();

    expect(watchSuccess).toHaveBeenCalledWith(firstSuccess.mock.calls[0]?.[0]);
    expect(error).not.toHaveBeenCalled();
    geolocation.clearWatch(watchId);
  });

  it("getCurrentPosition calls errorCallback when geo is absent after resolve", () => {
    const geolocation = {} as Geolocation;
    const permissions = { query: vi.fn() } as unknown as Permissions;
    const bridge = createFxGeoBridge({
      syncBootstrapState: vi.fn(),
      targetGlobal: buildTargetGlobal(geolocation, permissions),
      logGeolocation: vi.fn(),
      logPermissions: vi.fn(),
    });

    bridge.install();
    bridge.resolveGeoState(null); // geo disabled

    const success = vi.fn();
    const error = vi.fn();
    geolocation.getCurrentPosition(success, error);
    vi.runAllTimers();

    expect(success).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect((error.mock.calls[0]?.[0] as GeolocationPositionError).code).toBe(2);
  });
});
