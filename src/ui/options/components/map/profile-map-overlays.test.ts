import { describe, expect, it } from "vitest";

import {
  buildMapOverlayData,
  createMapOverlayLayers,
} from "@/ui/options/components/map/profile-map-overlays";

const EARTH_RADIUS_METERS = 6_378_137;

const getPaint = (layer: unknown): Record<string, unknown> | undefined => {
  if (!layer || typeof layer !== "object" || !("paint" in layer)) {
    return undefined;
  }

  const paint = layer.paint;
  return paint && typeof paint === "object"
    ? (paint as Record<string, unknown>)
    : undefined;
};

const getLayout = (layer: unknown): Record<string, unknown> | undefined => {
  if (!layer || typeof layer !== "object" || !("layout" in layer)) {
    return undefined;
  }

  const layout = layer.layout;
  return layout && typeof layout === "object"
    ? (layout as Record<string, unknown>)
    : undefined;
};

const distanceMeters = (
  from: { latitude: number; longitude: number },
  to: [number, number],
): number => {
  const toRadians = (value: number): number => (value * Math.PI) / 180;
  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to[1]);
  const latitudeDelta = latitude2 - latitude1;
  const longitudeDelta = toRadians(to[0] - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

describe("profile-map-overlays", () => {
  it("creates only the overlay features that have positive radii", () => {
    const overlay = buildMapOverlayData({
      draft: { latitude: 52.2297, longitude: 21.0122 },
      tracePoints: [],
      rangeRadius: 80,
      accuracyRadius: 0,
      rangeCenter: undefined,
      accuracyCenter: undefined,
      showRangeLabel: true,
      showAccuracyLabel: true,
      rangeLabel: "Range",
      accuracyLabel: "Accuracy",
    });

    expect(overlay.features.map((feature) => feature.properties.kind)).toEqual([
      "range-circle",
      "range-label-arc",
    ]);
  });

  it("creates separate feature kinds for range, accuracy, labels, and trace", () => {
    const overlay = buildMapOverlayData({
      draft: { latitude: 52.2297, longitude: 21.0122 },
      tracePoints: [
        { latitude: 52.2297, longitude: 21.0122 },
        { latitude: 52.23, longitude: 21.02 },
      ],
      rangeRadius: 80,
      accuracyRadius: 25,
      rangeCenter: undefined,
      accuracyCenter: undefined,
      showRangeLabel: true,
      showAccuracyLabel: true,
      rangeLabel: "Range",
      accuracyLabel: "Accuracy",
    });

    expect(overlay.features.map((feature) => feature.properties.kind)).toEqual([
      "range-circle",
      "range-label-arc",
      "accuracy-circle",
      "accuracy-label-arc",
      "trace-line",
    ]);
    expect(
      overlay.features.find((feature) => feature.properties.kind === "range-label-arc")
        ?.properties.label,
    ).toBe("RANGE");
    expect(
      overlay.features.find(
        (feature) => feature.properties.kind === "accuracy-label-arc",
      )?.properties.label,
    ).toBe("ACCURACY");
  });

  it("creates short label arcs on the circle border instead of full rings", () => {
    const overlay = buildMapOverlayData({
      draft: { latitude: 52.2297, longitude: 21.0122 },
      tracePoints: [],
      rangeRadius: 80,
      accuracyRadius: 25,
      rangeCenter: undefined,
      accuracyCenter: undefined,
      showRangeLabel: true,
      showAccuracyLabel: true,
      rangeLabel: "Range",
      accuracyLabel: "Accuracy",
    });

    const rangeCircle = overlay.features.find(
      (feature) => feature.properties.kind === "range-circle",
    );
    const rangeLabelArc = overlay.features.find(
      (feature) => feature.properties.kind === "range-label-arc",
    );
    const rangeCircleCoordinates =
      rangeCircle?.geometry.type === "Polygon"
        ? rangeCircle.geometry.coordinates[0]
        : undefined;
    const rangeLabelCoordinates =
      rangeLabelArc?.geometry.type === "LineString"
        ? rangeLabelArc.geometry.coordinates
        : undefined;

    expect(rangeCircle?.geometry.type).toBe("Polygon");
    expect(rangeLabelArc?.geometry.type).toBe("LineString");
    expect(rangeLabelCoordinates?.length ?? 0).toBeLessThan(
      rangeCircleCoordinates?.length ?? 0,
    );
    expect(
      distanceMeters(
        { latitude: 52.2297, longitude: 21.0122 },
        rangeLabelCoordinates?.[0] ?? [0, 0],
      ),
    ).toBeCloseTo(80, 3);
  });

  it("returns layer styles with the expected dash, opacity, widths, and label color", () => {
    const layers = createMapOverlayLayers({
      accuracyColor: "#112233",
      rangeColor: "#445566",
      traceColor: "#778899",
      textColor: "#101010",
      textHaloColor: "#ffffff",
    });

    const rangeLineLayer = layers.find(
      (layer) => layer.id === "profile-draft-range-line",
    );
    const accuracyFillLayer = layers.find(
      (layer) => layer.id === "profile-draft-accuracy-fill",
    );
    const accuracyLineLayer = layers.find(
      (layer) => layer.id === "profile-draft-accuracy-line",
    );
    const rangeLabelLayer = layers.find(
      (layer) => layer.id === "profile-draft-range-label",
    );
    const accuracyLabelLayer = layers.find(
      (layer) => layer.id === "profile-draft-accuracy-label",
    );

    expect(getPaint(rangeLineLayer)).toMatchObject({
      "line-color": "#445566",
      "line-width": 3,
      "line-dasharray": [0.01, 2.4],
    });
    expect(getPaint(accuracyFillLayer)).toMatchObject({
      "fill-color": "#112233",
      "fill-opacity": 0.1,
    });
    expect(getPaint(accuracyLineLayer)).toMatchObject({
      "line-color": "#112233",
      "line-width": 3,
      "line-opacity": 0.55,
    });
    expect(getPaint(rangeLabelLayer)).toMatchObject({
      "text-color": "#101010",
      "text-halo-blur": 0,
      "text-halo-width": 1,
      "text-translate": [-8, 8],
    });
    expect(getPaint(accuracyLabelLayer)).toMatchObject({
      "text-halo-blur": 0,
      "text-halo-width": 1,
      "text-translate": [8, -8],
    });
    expect(getLayout(rangeLabelLayer)).not.toMatchObject({
      "text-transform": "uppercase",
    });
  });
});
