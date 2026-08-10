import { installOffscreenNoise } from "@privacy-brand/refract-core/fingerprint/offscreen-canvas-patch";
import { isFpSurfaceEnabled } from "@privacy-brand/refract-core/fingerprint/surface-guards";

// OffscreenCanvas fingerprint noise is single-sourced in
// @privacy-brand/refract-core `installOffscreenNoise` and shared with the
// document MAIN-world runtime — see CLAUDE.md shared-injection-core invariant #9.
export const installWorkerCanvasPatch = (snapshot: any, logger: any): void => {
  const canvasSeed = snapshot.fingerprint?.canvasNoiseSeed;
  if (canvasSeed === undefined || !isFpSurfaceEnabled(snapshot.fingerprint, "canvas")) {
    return;
  }

  installOffscreenNoise(canvasSeed, logger);
};
