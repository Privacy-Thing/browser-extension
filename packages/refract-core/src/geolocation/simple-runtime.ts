/* eslint-disable sonarjs/pseudo-random */
import type { RuntimeSnapshot } from "../types/snapshot";

type GeoSource = RuntimeSnapshot["geo"];
type WatchDelayRange = [number, number];
type NullableCoordinateFields = Pick<
  GeolocationCoordinates,
  "altitude" | "altitudeAccuracy" | "heading" | "speed"
>;

const EARTH_RADIUS_METERS = 6_371_000;
const toRadians = (degrees: number): number => degrees * (Math.PI / 180);
const toDegrees = (radians: number): number => radians * (180 / Math.PI);
const normalizeLongitude = (longitude: number): number =>
  ((((longitude + 180) % 360) + 360) % 360) - 180;

const normalizeCoordinates = (
  latitude: number,
  longitude: number,
): { latitude: number; longitude: number } => {
  let normalizedLatitude = ((((latitude + 180) % 360) + 360) % 360) - 180;
  let normalizedLongitude = longitude;

  if (normalizedLatitude > 90) {
    normalizedLatitude = 180 - normalizedLatitude;
    normalizedLongitude += 180;
  } else if (normalizedLatitude < -90) {
    normalizedLatitude = -180 - normalizedLatitude;
    normalizedLongitude += 180;
  }

  return {
    latitude: normalizedLatitude,
    longitude: normalizeLongitude(normalizedLongitude),
  };
};

const getGreatCircleDistance = (
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number => {
  const fromLatRad = toRadians(fromLatitude);
  const toLatRad = toRadians(toLatitude);
  const deltaLat = toLatRad - fromLatRad;
  const deltaLng = toRadians(normalizeLongitude(toLongitude - fromLongitude));
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLatRad) * Math.cos(toLatRad) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
};

const getInitialBearing = (
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number => {
  const fromLatRad = toRadians(fromLatitude);
  const toLatRad = toRadians(toLatitude);
  const deltaLng = toRadians(normalizeLongitude(toLongitude - fromLongitude));
  return Math.atan2(
    Math.sin(deltaLng) * Math.cos(toLatRad),
    Math.cos(fromLatRad) * Math.sin(toLatRad) -
      Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(deltaLng),
  );
};

const moveCoordinate = (
  latitude: number,
  longitude: number,
  distanceMeters: number,
  bearing: number,
): { latitude: number; longitude: number } => {
  const latitudeRad = toRadians(latitude);
  const longitudeRad = toRadians(longitude);
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const nextLatitudeRad = Math.asin(
    Math.sin(latitudeRad) * Math.cos(angularDistance) +
      Math.cos(latitudeRad) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const nextLongitudeRad =
    longitudeRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRad),
      Math.cos(angularDistance) - Math.sin(latitudeRad) * Math.sin(nextLatitudeRad),
    );

  return normalizeCoordinates(toDegrees(nextLatitudeRad), toDegrees(nextLongitudeRad));
};

type SimpleGeoState = {
  geo: GeoSource;
  center: { latitude: number; longitude: number };
  currentAccuracy: number;
  currentHeading: number;
  lastLat: number;
  lastLng: number;
  sampleCount: number;
  warmupSamples: number;
  warmupInitialMultiplier: number;
  paceMultiplier: number;
  paceHoldRemaining: number;
  callbackDelayMinMs: number;
  callbackDelayRangeMs: number;
};

const createSimpleGeoState = (geo: GeoSource): SimpleGeoState => {
  const center = normalizeCoordinates(geo.latitude, geo.longitude);
  return {
    geo,
    center,
    currentAccuracy: geo.accuracy,
    currentHeading: Math.random() * 2 * Math.PI,
    lastLat: center.latitude,
    lastLng: center.longitude,
    sampleCount: 0,
    warmupSamples: 3 + Math.floor(Math.random() * 5),
    warmupInitialMultiplier: 2 + Math.random() * 2,
    paceMultiplier: 0.5 + Math.random(),
    paceHoldRemaining: 3 + Math.floor(Math.random() * 5),
    callbackDelayMinMs: 5 + Math.random() * 15,
    callbackDelayRangeMs: 25 + Math.random() * 90,
  };
};

/** Box-Muller transform for Gaussian-distributed noise. */
const gaussianNoise = (scale: number): number => {
  const u1 = Math.max(1e-10, Math.random());
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * scale;
};

const getStepMeters = (state: SimpleGeoState, radiusMeters: number): number => {
  state.paceHoldRemaining -= 1;
  if (state.paceHoldRemaining <= 0) {
    state.paceMultiplier = 0.15 + Math.random() * 1.35;
    state.paceHoldRemaining = 3 + Math.floor(Math.random() * 5);
  }
  const accuracyFactor = state.currentAccuracy / Math.max(1, state.geo.accuracy);
  return (
    Math.min(state.geo.accuracy / 10, radiusMeters / 15) *
    state.paceMultiplier *
    accuracyFactor
  );
};

const pullTowardCenter = (
  state: SimpleGeoState,
  coordinate: { latitude: number; longitude: number },
  radiusMeters: number,
): { latitude: number; longitude: number } => {
  const distance = getGreatCircleDistance(
    state.center.latitude,
    state.center.longitude,
    coordinate.latitude,
    coordinate.longitude,
  );
  if (distance <= 0.01) return coordinate;

  const edgeRatio = Math.min(1, distance / radiusMeters);
  return moveCoordinate(
    coordinate.latitude,
    coordinate.longitude,
    distance * edgeRatio * edgeRatio * 0.3,
    getInitialBearing(
      coordinate.latitude,
      coordinate.longitude,
      state.center.latitude,
      state.center.longitude,
    ),
  );
};

const clampToRadius = (
  state: SimpleGeoState,
  coordinate: { latitude: number; longitude: number },
  radiusMeters: number,
): { latitude: number; longitude: number } => {
  const distance = getGreatCircleDistance(
    state.center.latitude,
    state.center.longitude,
    coordinate.latitude,
    coordinate.longitude,
  );
  if (distance <= radiusMeters) return coordinate;

  return moveCoordinate(
    state.center.latitude,
    state.center.longitude,
    radiusMeters * 0.7,
    getInitialBearing(
      state.center.latitude,
      state.center.longitude,
      coordinate.latitude,
      coordinate.longitude,
    ),
  );
};

const randomizeCoords = (
  state: SimpleGeoState,
): { latitude: number; longitude: number } => {
  const radiusMeters = state.geo.noiseRadius ?? 50;
  if (radiusMeters <= 0) return { ...state.center };

  const stepMeters = getStepMeters(state, radiusMeters);
  state.currentHeading += (Math.random() - 0.5) * 1.2;
  const stepped = moveCoordinate(
    state.lastLat,
    state.lastLng,
    stepMeters,
    state.currentHeading,
  );
  const noisy = moveCoordinate(
    stepped.latitude,
    stepped.longitude,
    gaussianNoise(stepMeters * 0.15),
    state.currentHeading + Math.PI / 2,
  );
  const next = clampToRadius(
    state,
    pullTowardCenter(state, noisy, radiusMeters),
    radiusMeters,
  );
  state.lastLat = next.latitude;
  state.lastLng = next.longitude;
  return { latitude: next.latitude, longitude: next.longitude };
};

const walkAccuracy = (state: SimpleGeoState): number => {
  const step = (Math.random() - 0.5) * 6;
  state.currentAccuracy = Math.max(
    state.geo.accuracy * 0.5,
    Math.min(state.geo.accuracy * 1.5, state.currentAccuracy + step),
  );
  const warmup =
    1 +
    (state.warmupInitialMultiplier - 1) *
      Math.max(0, 1 - state.sampleCount / state.warmupSamples);
  state.sampleCount += 1;
  return Math.round(state.currentAccuracy * warmup);
};

/** Creates the single supported spoofed-geolocation runtime. */
export const createSimpleGeoRuntime = (
  geo: GeoSource,
  watchPositionDelay: WatchDelayRange,
) => {
  const state = createSimpleGeoState(geo);
  return {
    randomizeCoords: () => randomizeCoords(state),
    walkAccuracy: () => walkAccuracy(state),
    getNullableCoords: (): NullableCoordinateFields => ({
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    }),
    getNextWatchDelay: (): number => {
      const minSeconds = watchPositionDelay[0];
      const maxSeconds = watchPositionDelay[1];
      return (minSeconds + Math.random() * Math.max(0, maxSeconds - minSeconds)) * 1000;
    },
    getCallbackDelay: (): number => {
      const base =
        state.callbackDelayMinMs + Math.random() * state.callbackDelayRangeMs;
      return Math.random() < 0.05 ? base * (2 + Math.random()) : base;
    },
    getMeasurementDelay: (): number =>
      50 + Math.random() * Math.min(450, state.currentAccuracy * 10),
    shouldUseCachedPosition: (
      cachedPositionTimestamp: number,
      cachedPositionExpires: number,
      options?: PositionOptions,
    ): boolean => {
      const now = Date.now();
      const maximumAge = options?.maximumAge ?? 0;
      return (
        maximumAge > 0 &&
        now < cachedPositionExpires &&
        now - cachedPositionTimestamp <= maximumAge
      );
    },
  };
};
