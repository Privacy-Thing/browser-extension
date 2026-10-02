import * as maplibregl from "maplibre-gl";
// Bundle the worker's shared ESM imports too; a plain ?url would leave them missing.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

const resolvedWorkerUrl =
  typeof globalThis.location?.href === "string"
    ? new URL(maplibreWorkerUrl, globalThis.location.href).toString()
    : maplibreWorkerUrl;

maplibregl.setWorkerUrl(resolvedWorkerUrl);

export default maplibregl;
export type { AddLayerObject, GeoJSONSource } from "maplibre-gl";
