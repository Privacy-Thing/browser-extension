declare module "maplibre-gl/dist/maplibre-gl-csp.js" {
  import type maplibregl from "maplibre-gl";

  const runtime: typeof maplibregl;
  export default runtime;
}

declare module "maplibre-gl/dist/maplibre-gl-csp-worker.js?url" {
  const workerUrl: string;
  export default workerUrl;
}
