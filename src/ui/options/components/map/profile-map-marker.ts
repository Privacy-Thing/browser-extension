import type maplibreglType from "maplibre-gl";
import type { MapMouseEvent } from "maplibre-gl";
import type { MutableRefObject } from "react";

import type * as MapLibreModuleNamespace from "@/ui/options/components/map/maplibre-csp";
import type { DraftCoordinates } from "@/ui/options/components/map/profile-map-overlays";

type MapLibreModule = typeof MapLibreModuleNamespace;

const toDraftCoordinates = (latitude: number, longitude: number): DraftCoordinates => ({
  latitude: Number(latitude.toFixed(6)),
  longitude: Number(longitude.toFixed(6)),
});

export const attachMarkerHandlers = (
  marker: maplibreglType.Marker,
  onMoveRef: MutableRefObject<(latitude: number, longitude: number) => void>,
  setOverlayData: (nextDraft?: DraftCoordinates | null) => void,
): void => {
  marker.on("drag", () => {
    const lngLat = marker.getLngLat();
    setOverlayData({ latitude: lngLat.lat, longitude: lngLat.lng });
  });
  marker.on("dragend", () => {
    const lngLat = marker.getLngLat();
    const nextDraft = toDraftCoordinates(lngLat.lat, lngLat.lng);
    setOverlayData(nextDraft);
    onMoveRef.current(nextDraft.latitude, nextDraft.longitude);
  });
};

export const attachMapClickHandler = (
  map: maplibreglType.Map,
  marker: maplibreglType.Marker,
  onMoveRef: MutableRefObject<(latitude: number, longitude: number) => void>,
  setOverlayData: (nextDraft?: DraftCoordinates | null) => void,
): void => {
  map.on("click", (event: MapMouseEvent) => {
    const nextDraft = toDraftCoordinates(event.lngLat.lat, event.lngLat.lng);
    marker.setLngLat([nextDraft.longitude, nextDraft.latitude]);
    setOverlayData(nextDraft);
    onMoveRef.current(nextDraft.latitude, nextDraft.longitude);
  });
};

export const createMapMarker = ({
  initialDraft,
  map,
  readOnly,
  runtime,
}: {
  initialDraft: DraftCoordinates;
  map: maplibreglType.Map;
  readOnly: boolean;
  runtime: MapLibreModule["default"];
}): maplibreglType.Marker => {
  const pin = document.createElement("div");
  pin.className = "profile-map-pin";
  pin.innerHTML = '<span class="profile-map-pin-dot"></span>';
  return new runtime.Marker({
    element: pin,
    anchor: "center",
    draggable: !readOnly,
  })
    .setLngLat([initialDraft.longitude, initialDraft.latitude])
    .addTo(map);
};
