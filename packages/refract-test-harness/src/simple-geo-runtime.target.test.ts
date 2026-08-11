import { createSimpleGeoRuntime } from "@privacy-brand/refract-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const createSeededRandom = (seed = 0x9e37_79b9) => {
  let state = seed >>> 0;
  return (): number => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

const createRuntime = (noiseRadius = 50) =>
  createSimpleGeoRuntime(
    {
      latitude: 52.2297,
      longitude: 21.0122,
      accuracy: 25,
      noiseRadius,
    },
    [6, 10],
    createSeededRandom(),
  );

describe("createSimpleGeoRuntime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("uses the configured watch cadence", () => {
    const runtime = createSimpleGeoRuntime(
      {
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
      },
      [2, 5],
      () => 0.5,
    );

    expect(runtime.getNextWatchDelay()).toBe(3500);
  });

  it("uses captured Web Crypto instead of Math.random by default", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used");
    });

    const runtime = createSimpleGeoRuntime(
      {
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 25,
        noiseRadius: 50,
      },
      [2, 5],
    );

    expect(runtime.getNextWatchDelay()).toBeGreaterThanOrEqual(2_000);
    expect(runtime.getNextWatchDelay()).toBeLessThan(5_000);
    expect(runtime.randomizeCoords()).toEqual({
      latitude: expect.any(Number),
      longitude: expect.any(Number),
    });
  });

  it("keeps the random walk inside noiseRadius", () => {
    const noiseRadius = 50;
    const runtime = createRuntime(noiseRadius);

    for (let index = 0; index < 1000; index += 1) {
      const { latitude, longitude } = runtime.randomizeCoords();
      const deltaLatitude = latitude - 52.2297;
      const deltaLongitude =
        (longitude - 21.0122) * Math.cos(52.2297 * (Math.PI / 180));
      const distanceMeters =
        Math.sqrt(deltaLatitude ** 2 + deltaLongitude ** 2) * 111320;
      expect(distanceMeters).toBeLessThanOrEqual(noiseRadius + 1);
    }
  });

  it.each([
    { latitude: 90, longitude: 180 },
    { latitude: -90, longitude: -180 },
    { latitude: 89.9999, longitude: 179.9999 },
    { latitude: -89.9999, longitude: -179.9999 },
  ])(
    "keeps boundary coordinates valid at $latitude, $longitude",
    ({ latitude: centerLatitude, longitude: centerLongitude }) => {
      const noiseRadius = 50;
      const runtime = createSimpleGeoRuntime(
        {
          latitude: centerLatitude,
          longitude: centerLongitude,
          accuracy: 25,
          noiseRadius,
        },
        [6, 10],
        createSeededRandom(),
      );

      for (let index = 0; index < 500; index += 1) {
        const coords = runtime.randomizeCoords();
        expect(Number.isFinite(coords.latitude)).toBe(true);
        expect(Number.isFinite(coords.longitude)).toBe(true);
        expect(coords.latitude).toBeGreaterThanOrEqual(-90);
        expect(coords.latitude).toBeLessThanOrEqual(90);
        expect(coords.longitude).toBeGreaterThanOrEqual(-180);
        expect(coords.longitude).toBeLessThanOrEqual(180);

        const fromLat = centerLatitude * (Math.PI / 180);
        const toLat = coords.latitude * (Math.PI / 180);
        const deltaLat = toLat - fromLat;
        const normalizedDeltaLng =
          ((coords.longitude - centerLongitude + 540) % 360) - 180;
        const deltaLng = normalizedDeltaLng * (Math.PI / 180);
        const haversine =
          Math.sin(deltaLat / 2) ** 2 +
          Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;
        const distanceMeters =
          2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(haversine)));
        expect(distanceMeters).toBeLessThanOrEqual(noiseRadius + 0.01);
      }
    },
  );

  it("emits correlated drift instead of teleporting", () => {
    const runtime = createRuntime();
    let previous = runtime.randomizeCoords();
    let maxStep = 0;

    for (let index = 0; index < 100; index += 1) {
      const next = runtime.randomizeCoords();
      const deltaLatitude = next.latitude - previous.latitude;
      const deltaLongitude =
        (next.longitude - previous.longitude) *
        Math.cos(previous.latitude * (Math.PI / 180));
      const stepMeters = Math.sqrt(deltaLatitude ** 2 + deltaLongitude ** 2) * 111320;
      maxStep = Math.max(maxStep, stepMeters);
      previous = next;
    }

    expect(maxStep).toBeLessThan(25);
  });

  it("converges warm-up accuracy over successive samples", () => {
    const runtime = createSimpleGeoRuntime(
      {
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 20,
        noiseRadius: 50,
      },
      [6, 10],
      () => 0.5,
    );

    const first = runtime.walkAccuracy();
    expect(first).toBeGreaterThan(30);
    for (let index = 0; index < 8; index += 1) {
      runtime.walkAccuracy();
    }
    const converged = runtime.walkAccuracy();

    expect(converged).toBeLessThan(first);
    expect(converged).toBeLessThanOrEqual(30);
  });

  it("keeps the simple measurement delay in the 50-500ms range", () => {
    const runtime = createRuntime();

    for (let index = 0; index < 100; index += 1) {
      const delay = runtime.getMeasurementDelay();
      expect(delay).toBeGreaterThanOrEqual(50);
      expect(delay).toBeLessThanOrEqual(500);
    }
  });

  it("returns nullable coordinate fields as null", () => {
    expect(createRuntime().getNullableCoords()).toEqual({
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    });
  });

  it("uses the actual cached position age for maximumAge", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));
    const runtime = createRuntime();

    expect(
      runtime.shouldUseCachedPosition(Date.now() - 4_000, Date.now() + 10_000, {
        maximumAge: 5_000,
      }),
    ).toBe(true);
    expect(
      runtime.shouldUseCachedPosition(Date.now() - 11_000, Date.now() + 10_000, {
        maximumAge: 10_000,
      }),
    ).toBe(false);
    expect(
      runtime.shouldUseCachedPosition(Date.now() - 1_000, Date.now() - 1, {
        maximumAge: 10_000,
      }),
    ).toBe(false);
  });
});
