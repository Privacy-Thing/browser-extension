import type maplibreglType from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";
import maplibreglRuntime from "maplibre-gl/dist/maplibre-gl-csp.js";

const maplibregl = maplibreglRuntime as typeof maplibreglType;

const resolvedWorkerUrl =
  typeof globalThis.location?.href === "string"
    ? new URL(maplibreWorkerUrl, globalThis.location.href).toString()
    : maplibreWorkerUrl;

maplibregl.setWorkerUrl(resolvedWorkerUrl);

export default maplibregl;
export type { AddLayerObject, GeoJSONSource } from "maplibre-gl";
