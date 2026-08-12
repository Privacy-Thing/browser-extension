import "maplibre-gl/dist/maplibre-gl.css";

import type maplibreglType from "maplibre-gl";
import type { AddLayerObject, GeoJSONSource } from "maplibre-gl";
import type { MutableRefObject, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { fireAndForget } from "@/shared/async";
import { loadMapStyle } from "@/ui/options/components/map/map-style";
import type * as MapLibreModuleNamespace from "@/ui/options/components/map/maplibre-csp";
import {
  attachMapClickHandler,
  attachMarkerHandlers,
  createMapMarker,
} from "@/ui/options/components/map/profile-map-marker";
import {
  buildMapOverlayData,
  createCircleCoordinates,
  createMapOverlayLayers,
  getMaxOverlayRadius,
  type CircleCenter,
  type DraftCoordinates,
  type ProfileMapOverlayState,
  type TracePoint,
} from "@/ui/options/components/map/profile-map-overlays";
import { useTheme } from "@/ui/shared/ThemeProvider";

type MapLibreModule = typeof MapLibreModuleNamespace;

let mapLibreModulePromise: Promise<MapLibreModule> | null = null;

const loadMapLibreModule = async (): Promise<MapLibreModule> => {
  mapLibreModulePromise ??= import("@/ui/options/components/map/maplibre-csp");
  return mapLibreModulePromise;
};

export type ReadOnlyViewportMode = "fit-trace" | "follow-marker";

type OverlayState = ProfileMapOverlayState & {
  readOnly: boolean;
  readOnlyViewportMode: ReadOnlyViewportMode;
};

const OVERLAY_SOURCE_ID = "profile-draft-overlay";
const DEFAULT_CENTER: DraftCoordinates = { latitude: 20, longitude: 0 };
const FOLLOW_MARKER_MIN_ZOOM = 16;

const createCircleBounds = (
  center: CircleCenter,
  radiusMeters: number,
  maplibregl: MapLibreModule["default"],
): maplibreglType.LngLatBounds => {
  const bounds = new maplibregl.LngLatBounds();
  for (const coordinate of createCircleCoordinates(center, radiusMeters, 32)) {
    bounds.extend(coordinate);
  }
  return bounds;
};

const fitTraceBounds = (
  maplibregl: MapLibreModule["default"],
  map: maplibreglType.Map,
  tracePoints: TracePoint[],
): void => {
  const bounds = new maplibregl.LngLatBounds();
  for (const point of tracePoints) {
    bounds.extend([point.longitude, point.latitude]);
  }

  map.fitBounds(bounds, {
    padding: 24,
    maxZoom: 18,
    duration: 0,
  });
  map.setZoom(Math.max(0, map.getZoom() - 1));
};

const getFollowMarkerZoom = (map: maplibreglType.Map): number =>
  Math.max(FOLLOW_MARKER_MIN_ZOOM, map.getZoom());

const syncReadOnlyViewport = ({
  maplibregl,
  map,
  state,
  hasReadOnlyViewportRef,
  forceReset = false,
}: {
  maplibregl: MapLibreModule["default"];
  map: maplibreglType.Map;
  state: OverlayState;
  hasReadOnlyViewportRef: { current: boolean };
  forceReset?: boolean;
}): void => {
  if (!state.draft) {
    return;
  }

  if (forceReset) {
    hasReadOnlyViewportRef.current = false;
  }

  const center: [number, number] = [state.draft.longitude, state.draft.latitude];

  if (state.readOnlyViewportMode === "fit-trace" && state.tracePoints.length > 1) {
    fitTraceBounds(maplibregl, map, state.tracePoints);
    hasReadOnlyViewportRef.current = true;
    return;
  }

  if (!hasReadOnlyViewportRef.current) {
    if (state.readOnlyViewportMode === "follow-marker") {
      map.jumpTo({
        center,
        zoom: getFollowMarkerZoom(map),
      });
      hasReadOnlyViewportRef.current = true;
      return;
    }

    const focusRadius = getMaxOverlayRadius(state);
    if (focusRadius > 0) {
      map.fitBounds(
        createCircleBounds(state.draft, Math.max(focusRadius * 2.5, 45), maplibregl),
        {
          padding: 20,
          maxZoom: 18,
          duration: 0,
        },
      );
    } else {
      const currentZoom = map.getZoom();
      map.jumpTo({
        center,
        zoom: currentZoom < 13 ? 13 : currentZoom,
      });
    }
    hasReadOnlyViewportRef.current = true;
    return;
  }

  if (state.readOnlyViewportMode === "follow-marker") {
    map.stop();
    map.easeTo({
      center,
      zoom: getFollowMarkerZoom(map),
      duration: 900,
      essential: true,
    });
    return;
  }

  map.jumpTo({ center });
};

const ensureOverlayLayers = (
  map: maplibreglType.Map,
  palette: ReturnType<typeof resolveOverlayPalette>,
): void => {
  if (!map.getSource(OVERLAY_SOURCE_ID)) {
    map.addSource(OVERLAY_SOURCE_ID, {
      type: "geojson",
      data: buildMapOverlayData({
        draft: null,
        tracePoints: [],
        rangeRadius: 0,
        accuracyRadius: 0,
        rangeCenter: undefined,
        accuracyCenter: undefined,
        showRangeLabel: true,
        showAccuracyLabel: true,
        rangeLabel: "Range",
        accuracyLabel: "Accuracy",
      }),
    });
  }

  const addLayerIfMissing = (layer: AddLayerObject & { id: string }) => {
    if (!map.getLayer(layer.id)) {
      map.addLayer(layer);
    }
  };

  for (const layer of createMapOverlayLayers(palette)) {
    addLayerIfMissing(layer);
  }
};

const getOverlaySource = (map: maplibreglType.Map): GeoJSONSource | null => {
  const source = map.getSource(OVERLAY_SOURCE_ID);
  return source ? (source as GeoJSONSource) : null;
};

const resolveColorToken = (name: string, fallback: string): string => {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value ? `hsl(${value})` : fallback;
};

const resolveOverlayPalette = () => ({
  accuracyColor: resolveColorToken("--primary", "#0e7a65"),
  rangeColor: resolveColorToken("--primary", "#0e7a65"),
  traceColor: resolveColorToken("--primary", "#0e7a65"),
  textColor: resolveColorToken("--foreground", "#111827"),
  textHaloColor: resolveColorToken("--background", "#ffffff"),
});

const requestMapResize = (map: maplibreglType.Map | null): void => {
  requestAnimationFrame(() => map?.resize());
};

type MapRefs = {
  map: MutableRefObject<maplibreglType.Map | null>;
  marker: MutableRefObject<maplibreglType.Marker | null>;
  move: MutableRefObject<(latitude: number, longitude: number) => void>;
  state: MutableRefObject<OverlayState>;
  viewport: MutableRefObject<boolean>;
};

const setOverlayData = (
  map: maplibreglType.Map,
  stateRef: MapRefs["state"],
  nextDraft?: DraftCoordinates | null,
): void => {
  const source = getOverlaySource(map);
  if (!source) return;
  source.setData(
    buildMapOverlayData({
      ...stateRef.current,
      draft: nextDraft === undefined ? stateRef.current.draft : nextDraft,
    }),
  );
};

const syncEditableViewport = ({
  map,
  runtime,
  state,
}: {
  map: maplibreglType.Map;
  runtime: MapLibreModule["default"];
  state: OverlayState;
}): void => {
  if (!state.draft) return;
  const center: [number, number] = [state.draft.longitude, state.draft.latitude];
  const focusRadius = getMaxOverlayRadius(state);
  if (focusRadius > 0) {
    map.fitBounds(
      createCircleBounds(state.draft, Math.max(focusRadius * 2.5, 45), runtime),
      { padding: 20, maxZoom: 18, duration: 0 },
    );
    return;
  }
  const currentZoom = map.getZoom();
  map.jumpTo({ center, zoom: currentZoom < 11 ? 11 : currentZoom });
};

const syncMapViewport = ({
  forceReset = false,
  map,
  nextDraft,
  refs,
  runtime,
}: {
  forceReset?: boolean;
  map: maplibreglType.Map;
  nextDraft?: DraftCoordinates | null;
  refs: MapRefs;
  runtime: MapLibreModule["default"];
}): void => {
  const state = {
    ...refs.state.current,
    draft: nextDraft === undefined ? refs.state.current.draft : nextDraft,
  };
  if (!state.draft) return;
  if (state.readOnly) {
    syncReadOnlyViewport({
      maplibregl: runtime,
      map,
      state,
      hasReadOnlyViewportRef: refs.viewport,
      forceReset,
    });
    return;
  }
  refs.viewport.current = false;
  syncEditableViewport({ map, runtime, state });
};

type MapInitOptions = {
  container: HTMLDivElement;
  draft: DraftCoordinates | null;
  isDisposed: () => boolean;
  readOnly: boolean;
  refs: MapRefs;
  theme: Parameters<typeof loadMapStyle>[0];
};

const initializeMap = async (
  options: MapInitOptions,
): Promise<maplibreglType.Map | null> => {
  delete options.container.dataset.mapReady;
  const [mapModule, style] = await Promise.all([
    loadMapLibreModule(),
    loadMapStyle(options.theme),
  ]);
  if (options.isDisposed()) return null;

  const runtime = mapModule.default;
  const initialDraft = options.draft ?? DEFAULT_CENTER;
  const map = new runtime.Map({
    container: options.container,
    style,
    center: [initialDraft.longitude, initialDraft.latitude],
    zoom: options.draft && options.draft.latitude !== 0 ? 11 : 2,
    attributionControl: false,
    dragRotate: false,
    maxPitch: 0,
    touchPitch: false,
  });
  map.addControl(new runtime.NavigationControl({ showCompass: false }));
  map.addControl(new runtime.AttributionControl({ compact: true }), "bottom-right");
  map.on("load", () => {
    if (options.isDisposed()) return;
    ensureOverlayLayers(map, resolveOverlayPalette());
    setOverlayData(map, options.refs.state);
    const marker = createMapMarker({
      initialDraft,
      map,
      readOnly: options.readOnly,
      runtime,
    });
    if (!options.readOnly) {
      const updateOverlay = (nextDraft?: DraftCoordinates | null) =>
        setOverlayData(map, options.refs.state, nextDraft);
      attachMarkerHandlers(marker, options.refs.move, updateOverlay);
      attachMapClickHandler(map, marker, options.refs.move, updateOverlay);
    }
    options.refs.marker.current = marker;
    syncMapViewport({ forceReset: true, map, refs: options.refs, runtime });
    requestMapResize(map);
    map.once("idle", () => {
      if (!options.isDisposed()) options.container.dataset.mapReady = "true";
    });
  });
  return map;
};

const updateMapState = ({
  draft,
  readOnly,
  refs,
}: {
  draft: DraftCoordinates | null;
  readOnly: boolean;
  refs: MapRefs;
}): void => {
  const map = refs.map.current;
  if (!map?.isStyleLoaded()) return;
  setOverlayData(map, refs.state);
  if (refs.marker.current && draft) {
    refs.marker.current.setLngLat([draft.longitude, draft.latitude]);
  }
  if (!draft) return;

  fireAndForget(
    loadMapLibreModule().then((mapModule) => {
      if (refs.map.current !== map) return;
      if (readOnly) {
        syncReadOnlyViewport({
          maplibregl: mapModule.default,
          map,
          state: refs.state.current,
          hasReadOnlyViewportRef: refs.viewport,
        });
        return;
      }
      refs.viewport.current = false;
      syncEditableViewport({
        map,
        runtime: mapModule.default,
        state: refs.state.current,
      });
    }),
  );
};

export type ProfileDraftMapProps = {
  draft: DraftCoordinates | null;
  opened: boolean;
  onMove: (latitude: number, longitude: number) => void;
  rangeRadius?: number;
  rangeCenter?: CircleCenter;
  accuracyRadius?: number;
  accuracyCenter?: CircleCenter;
  enabled?: boolean;
  placeholder?: ReactNode;
  readOnly?: boolean;
  readOnlyViewportMode?: ReadOnlyViewportMode;
  tracePoints?: TracePoint[];
  showRangeLabel?: boolean;
  showAccuracyLabel?: boolean;
  rangeLabel?: string;
  accuracyLabel?: string;
};

const useMapLifecycle = ({
  containerRef,
  draft,
  enabled,
  opened,
  readOnly,
  refs,
  theme,
}: {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  draft: DraftCoordinates | null;
  enabled: boolean;
  opened: boolean;
  readOnly: boolean;
  refs: MapRefs;
  theme: Parameters<typeof loadMapStyle>[0];
}): void => {
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !opened || !container) return;
    let disposed = false;
    let mountedMap: maplibreglType.Map | null = null;
    fireAndForget(
      initializeMap({
        container,
        draft,
        isDisposed: () => disposed,
        readOnly,
        refs,
        theme,
      }).then((map) => {
        if (disposed) {
          map?.remove();
          return;
        }
        mountedMap = map;
        refs.map.current = map;
      }),
    );
    return () => {
      disposed = true;
      refs.marker.current?.remove();
      refs.marker.current = null;
      mountedMap?.remove();
      refs.map.current = null;
      refs.viewport.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft intentionally read only at mount to seed the initial map center; re-mounting on draft changes would destroy user interaction state
  }, [enabled, opened, readOnly, theme]);
};

const useMapUpdates = ({
  accuracyCenter,
  accuracyLabel,
  accuracyRadius,
  draft,
  enabled,
  opened,
  rangeCenter,
  rangeLabel,
  rangeRadius,
  readOnly,
  readOnlyViewportMode,
  refs,
  showAccuracyLabel,
  showRangeLabel,
  tracePoints,
}: Required<
  Pick<
    ProfileDraftMapProps,
    | "accuracyLabel"
    | "accuracyRadius"
    | "enabled"
    | "opened"
    | "rangeLabel"
    | "rangeRadius"
    | "readOnly"
    | "readOnlyViewportMode"
    | "showAccuracyLabel"
    | "showRangeLabel"
    | "tracePoints"
  >
> & {
  accuracyCenter: CircleCenter | undefined;
  draft: DraftCoordinates | null;
  rangeCenter: CircleCenter | undefined;
  refs: MapRefs;
}): void => {
  useEffect(() => {
    if (!enabled || !opened) return;
    updateMapState({ draft, readOnly, refs });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft object reference excluded; draft?.latitude and draft?.longitude already cover all meaningful changes including null↔object transitions
  }, [
    draft?.latitude,
    draft?.longitude,
    accuracyCenter?.latitude,
    accuracyCenter?.longitude,
    accuracyRadius,
    enabled,
    opened,
    rangeCenter?.latitude,
    rangeCenter?.longitude,
    rangeLabel,
    rangeRadius,
    readOnly,
    readOnlyViewportMode,
    showAccuracyLabel,
    showRangeLabel,
    tracePoints,
    accuracyLabel,
  ]);

  useEffect(() => {
    if (enabled && opened) requestMapResize(refs.map.current);
  }, [enabled, opened, refs.map]);
};

export const ProfileDraftMap = ({
  draft,
  opened,
  onMove,
  rangeRadius = 0,
  rangeCenter,
  accuracyRadius = 0,
  accuracyCenter,
  enabled = true,
  placeholder = null,
  readOnly = false,
  readOnlyViewportMode = "fit-trace",
  tracePoints = [],
  showRangeLabel = true,
  showAccuracyLabel = true,
  rangeLabel = "Range",
  accuracyLabel = "Accuracy",
}: ProfileDraftMapProps) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibreglType.Map | null>(null);
  const markerRef = useRef<maplibreglType.Marker | null>(null);
  const onMoveRef = useRef(onMove);
  const hasReadOnlyViewportRef = useRef(false);
  const latestStateRef = useRef<OverlayState>({
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
    readOnly,
    readOnlyViewportMode,
  });

  latestStateRef.current = {
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
    readOnly,
    readOnlyViewportMode,
  };
  const refs: MapRefs = {
    map: mapRef,
    marker: markerRef,
    move: onMoveRef,
    state: latestStateRef,
    viewport: hasReadOnlyViewportRef,
  };

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);
  useMapLifecycle({ containerRef, draft, enabled, opened, readOnly, refs, theme });
  useMapUpdates({
    accuracyCenter,
    accuracyLabel,
    accuracyRadius,
    draft,
    enabled,
    opened,
    rangeCenter,
    rangeLabel,
    rangeRadius,
    readOnly,
    readOnlyViewportMode,
    refs,
    showAccuracyLabel,
    showRangeLabel,
    tracePoints,
  });

  if (!enabled) {
    return (
      <div
        id="profile-generator-map"
        className="profile-generator-map gw-map-placeholder"
      >
        {placeholder}
      </div>
    );
  }

  return (
    <div
      id="profile-generator-map"
      className="profile-generator-map"
      ref={containerRef}
    />
  );
};
