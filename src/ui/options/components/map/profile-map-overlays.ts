import type { AddLayerObject, StyleSpecification } from "maplibre-gl";

export type TracePoint = {
  latitude: number;
  longitude: number;
};

export type DraftCoordinates = {
  latitude: number;
  longitude: number;
};

export type CircleCenter = {
  latitude: number;
  longitude: number;
};

export type OverlayFeatureKind =
  | "accuracy-circle"
  | "accuracy-label-arc"
  | "range-circle"
  | "range-label-arc"
  | "trace-line";

type OverlayGeometry =
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "Polygon"; coordinates: [number, number][][] };

type OverlayFeatureProperties = {
  kind: OverlayFeatureKind;
  label?: string;
};

export type OverlayFeature = {
  type: "Feature";
  properties: OverlayFeatureProperties;
  geometry: OverlayGeometry;
};

export type OverlayFeatureCollection = {
  type: "FeatureCollection";
  features: OverlayFeature[];
};

export type ProfileMapOverlayState = {
  draft: DraftCoordinates | null;
  tracePoints: TracePoint[];
  rangeRadius: number;
  rangeCenter: CircleCenter | undefined;
  accuracyRadius: number;
  accuracyCenter: CircleCenter | undefined;
  showRangeLabel: boolean;
  showAccuracyLabel: boolean;
  rangeLabel: string;
  accuracyLabel: string;
};

export type ProfileMapOverlayPalette = {
  accuracyColor: string;
  rangeColor: string;
  traceColor: string;
  textColor: string;
  textHaloColor: string;
};

const EARTH_RADIUS_METERS = 6_378_137;

const toRadians = (value: number): number => (value * Math.PI) / 180;
const toDegrees = (value: number): number => (value * 180) / Math.PI;

export const createCircleCoordinates = (
  center: CircleCenter,
  radiusMeters: number,
  steps = 64,
): [number, number][] => {
  if (radiusMeters <= 0) {
    return [[center.longitude, center.latitude]];
  }

  const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
  const latitude = toRadians(center.latitude);
  const longitude = toRadians(center.longitude);
  const coordinates: [number, number][] = [];

  for (let step = 0; step <= steps; step += 1) {
    const bearing = (step / steps) * Math.PI * 2;
    const nextLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance) +
        Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const nextLongitude =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
        Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(nextLatitude),
      );

    coordinates.push([toDegrees(nextLongitude), toDegrees(nextLatitude)]);
  }

  return coordinates;
};

export const createArcCoordinates = ({
  center,
  radiusMeters,
  startBearingDegrees,
  endBearingDegrees,
  steps = 18,
}: {
  center: CircleCenter;
  radiusMeters: number;
  startBearingDegrees: number;
  endBearingDegrees: number;
  steps?: number;
}): [number, number][] => {
  if (radiusMeters <= 0) {
    return [[center.longitude, center.latitude]];
  }

  const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
  const latitude = toRadians(center.latitude);
  const longitude = toRadians(center.longitude);
  const coordinates: [number, number][] = [];
  const start = toRadians(startBearingDegrees);
  const end = toRadians(endBearingDegrees);
  const span = end - start;

  for (let step = 0; step <= steps; step += 1) {
    const bearing = start + (span * step) / steps;
    const nextLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance) +
        Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const nextLongitude =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
        Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(nextLatitude),
      );

    coordinates.push([toDegrees(nextLongitude), toDegrees(nextLatitude)]);
  }

  return coordinates;
};

export const getMaxOverlayRadius = (
  state: Pick<ProfileMapOverlayState, "rangeRadius" | "accuracyRadius">,
): number => Math.max(state.rangeRadius, state.accuracyRadius, 0);

const pushCircleFeatures = (
  features: OverlayFeature[],
  {
    kind,
    labelKind,
    label,
    center,
    radius,
    showLabel,
    arcStart,
    arcEnd,
  }: {
    kind: "range-circle" | "accuracy-circle";
    labelKind: "range-label-arc" | "accuracy-label-arc";
    label: string;
    center: CircleCenter | null;
    radius: number;
    showLabel: boolean;
    arcStart: number;
    arcEnd: number;
  },
) => {
  if (!center || radius <= 0) {
    return;
  }

  features.push({
    type: "Feature",
    properties: { kind },
    geometry: {
      type: "Polygon",
      coordinates: [[...createCircleCoordinates(center, radius)]],
    },
  });

  if (!showLabel) {
    return;
  }

  features.push({
    type: "Feature",
    properties: { kind: labelKind, label: label.toUpperCase() },
    geometry: {
      type: "LineString",
      coordinates: createArcCoordinates({
        center,
        radiusMeters: radius,
        startBearingDegrees: arcStart,
        endBearingDegrees: arcEnd,
      }),
    },
  });
};

export const buildMapOverlayData = ({
  draft,
  tracePoints,
  rangeRadius,
  rangeCenter,
  accuracyRadius,
  accuracyCenter,
  showRangeLabel,
  showAccuracyLabel,
  rangeLabel,
  accuracyLabel,
}: ProfileMapOverlayState): OverlayFeatureCollection => {
  const features: OverlayFeature[] = [];

  pushCircleFeatures(features, {
    kind: "range-circle",
    labelKind: "range-label-arc",
    label: rangeLabel,
    center: rangeCenter ?? draft,
    radius: rangeRadius,
    showLabel: showRangeLabel,
    arcStart: 120,
    arcEnd: 220,
  });

  pushCircleFeatures(features, {
    kind: "accuracy-circle",
    labelKind: "accuracy-label-arc",
    label: accuracyLabel,
    center: accuracyCenter ?? draft,
    radius: accuracyRadius,
    showLabel: showAccuracyLabel,
    arcStart: -25,
    arcEnd: 75,
  });

  if (tracePoints.length > 1) {
    features.push({
      type: "Feature",
      properties: { kind: "trace-line" },
      geometry: {
        type: "LineString",
        coordinates: tracePoints.map((point) => [point.longitude, point.latitude]),
      },
    });
  }

  return { type: "FeatureCollection", features };
};

const textLayout = {
  "symbol-placement": "line-center",
  "text-field": ["get", "label"],
  "text-font": ["Noto Sans Bold"],
  "text-size": 14,
  "text-letter-spacing": 0.06,
  "symbol-spacing": 500,
  "text-allow-overlap": true,
  "text-ignore-placement": true,
  "text-keep-upright": true,
} satisfies NonNullable<StyleSpecification["layers"]>[number]["layout"];

export const createMapOverlayLayers = (
  palette: ProfileMapOverlayPalette,
): Array<AddLayerObject & { id: string }> => [
  {
    id: "profile-draft-accuracy-fill",
    type: "fill",
    source: "profile-draft-overlay",
    filter: ["==", ["get", "kind"], "accuracy-circle"],
    paint: {
      "fill-color": palette.accuracyColor,
      "fill-opacity": 0.1,
    },
  },
  {
    id: "profile-draft-accuracy-line",
    type: "line",
    source: "profile-draft-overlay",
    filter: ["==", ["get", "kind"], "accuracy-circle"],
    paint: {
      "line-color": palette.accuracyColor,
      "line-width": 3,
      "line-opacity": 0.55,
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
  },
  {
    id: "profile-draft-range-line",
    type: "line",
    source: "profile-draft-overlay",
    filter: ["==", ["get", "kind"], "range-circle"],
    paint: {
      "line-color": palette.rangeColor,
      "line-width": 3,
      "line-dasharray": [0.01, 2.4],
      "line-opacity": 1,
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
  },
  {
    id: "profile-draft-trace-line",
    type: "line",
    source: "profile-draft-overlay",
    filter: ["==", ["get", "kind"], "trace-line"],
    paint: {
      "line-color": palette.traceColor,
      "line-width": 4,
      "line-opacity": 0.82,
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
  },
  {
    id: "profile-draft-range-label",
    type: "symbol",
    source: "profile-draft-overlay",
    filter: ["==", ["get", "kind"], "range-label-arc"],
    layout: textLayout,
    paint: {
      "text-color": palette.textColor,
      "text-halo-color": palette.textHaloColor,
      "text-halo-width": 1,
      "text-halo-blur": 0,
      "text-translate": [-8, 8],
    },
  },
  {
    id: "profile-draft-accuracy-label",
    type: "symbol",
    source: "profile-draft-overlay",
    filter: ["==", ["get", "kind"], "accuracy-label-arc"],
    layout: textLayout,
    paint: {
      "text-color": palette.textColor,
      "text-halo-color": palette.textHaloColor,
      "text-halo-width": 1,
      "text-halo-blur": 0,
      "text-translate": [8, -8],
    },
  },
];
