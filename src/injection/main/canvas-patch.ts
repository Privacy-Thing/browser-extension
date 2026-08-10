/**
 * Canvas fingerprint spoofing patch.
 *
 * Injects subtle, deterministic noise into `HTMLCanvasElement.toDataURL()`,
 * `toBlob()`, and `CanvasRenderingContext2D.getImageData()` so that canvas
 * fingerprints differ from the host device while remaining stable for a given
 * runtime seed.
 *
 * `canvasNoiseSeed` controls a deterministic, geometry-keyed mutation plan.
 * Export methods copy the source into a temporary 2D canvas and mutate only
 * that copy. Direct readbacks keep their existing state tracking so repeated
 * reads remain stable without writing fingerprint noise into the source.
 */

import {
  createLogger,
  createOnceLogger,
  type RuntimeDebugSnapshot,
} from "@privacy-brand/refract-browser/common/debug-logger";
import { installOffscreenNoise } from "@privacy-brand/refract-core/fingerprint/offscreen-canvas-patch";
import { isFpSurfaceEnabled } from "@privacy-brand/refract-core/fingerprint/surface-guards";
import { inspectPatchAnchors } from "@privacy-brand/refract-core/runtime/patch-marker";
import {
  createPrivateWeakMap,
  privateDefineProperties,
  privateWeakMapDelete,
  privateWeakMapGet,
  privateWeakMapSet,
} from "@privacy-brand/refract-core/runtime/primordials";

import { installCanvasMethods } from "@/injection/main/canvas-patch-installer";
import type { CanvasIntegrityOwnership } from "@/injection/main/surface-integrity";
import type { RuntimeSnapshot } from "@/shared/types";

const CANVAS_PATCH_MARKER_KEY = `${__PT_SHIM_GUARD_KEY__}:canvas`;

type CanvasRuntimeState = {
  debugSnapshot: RuntimeDebugSnapshot;
  seed: number | undefined;
  stateVersion: number;
};

type CanvasInstallation = {
  canvasPrototype: object;
  contextPrototype: object;
  getImageData: Function;
  runtimeState: CanvasRuntimeState;
  toBlob: Function;
  toDataURL: Function;
};

const canvasInstallations = createPrivateWeakMap<object, CanvasInstallation>();

type CanvasSyncInput = {
  canvasPrototype: object;
  contextPrototype: object;
  currentGetImageData: Function;
  currentToBlob: Function;
  currentToDataURL: Function;
  nextSeed: number | undefined;
  snapshot: RuntimeSnapshot;
  targetGlobal: object;
};

const resolveCanvasSeed = (
  fingerprint: RuntimeSnapshot["fingerprint"] | undefined,
): number | undefined => {
  if (!isFpSurfaceEnabled(fingerprint, "canvas")) {
    return undefined;
  }

  return fingerprint?.canvasNoiseSeed;
};

const noCanvasOwnership = (): CanvasIntegrityOwnership => ({
  htmlCanvas: false,
  context2D: false,
  offscreenCanvas: false,
  offscreenContext2D: false,
});

const syncCanvasInstall = (input: CanvasSyncInput): boolean => {
  const {
    canvasPrototype,
    contextPrototype,
    currentGetImageData,
    currentToBlob,
    currentToDataURL,
    nextSeed,
    snapshot,
    targetGlobal,
  } = input;
  const existingInstallation = privateWeakMapGet(canvasInstallations, targetGlobal);
  if (!existingInstallation) {
    return false;
  }
  if (
    existingInstallation.canvasPrototype !== canvasPrototype ||
    existingInstallation.contextPrototype !== contextPrototype
  ) {
    privateWeakMapDelete(canvasInstallations, targetGlobal);
    return false;
  }
  const changedAnchorCount =
    (currentGetImageData !== existingInstallation.getImageData ? 1 : 0) +
    (currentToDataURL !== existingInstallation.toDataURL ? 1 : 0) +
    (currentToBlob !== existingInstallation.toBlob ? 1 : 0);
  if (changedAnchorCount === 3) {
    // A replaced prototype baseline (navigation/test realm reset) is a new
    // installation. Do not copy closures from the previous document into it.
    privateWeakMapDelete(canvasInstallations, targetGlobal);
    return false;
  }
  if (changedAnchorCount > 0) {
    privateDefineProperties(contextPrototype, {
      getImageData: {
        configurable: true,
        writable: true,
        value: existingInstallation.getImageData,
      },
    });
    privateDefineProperties(canvasPrototype, {
      toDataURL: {
        configurable: true,
        writable: true,
        value: existingInstallation.toDataURL,
      },
      toBlob: {
        configurable: true,
        writable: true,
        value: existingInstallation.toBlob,
      },
    });
  }
  existingInstallation.runtimeState.debugSnapshot = snapshot;
  if (existingInstallation.runtimeState.seed !== nextSeed) {
    existingInstallation.runtimeState.seed = nextSeed;
    existingInstallation.runtimeState.stateVersion += 1;
  }
  return true;
};

export const installCanvasPatch = (
  snapshot: RuntimeSnapshot,
  targetGlobal: typeof globalThis = globalThis,
): CanvasIntegrityOwnership => {
  const HTMLCanvasCtor = targetGlobal.HTMLCanvasElement;
  const Canvas2DCtor = targetGlobal.CanvasRenderingContext2D;
  if (!HTMLCanvasCtor || !Canvas2DCtor) {
    return noCanvasOwnership();
  }
  const canvasPrototype = HTMLCanvasCtor.prototype;
  const contextPrototype = Canvas2DCtor.prototype;
  const currentGetImageData = contextPrototype.getImageData;
  const nextSeed = resolveCanvasSeed(snapshot.fingerprint);

  if (
    syncCanvasInstall({
      targetGlobal,
      canvasPrototype,
      contextPrototype,
      currentGetImageData,
      currentToDataURL: canvasPrototype.toDataURL,
      currentToBlob: canvasPrototype.toBlob,
      nextSeed,
      snapshot,
    })
  ) {
    if (nextSeed === undefined) {
      return noCanvasOwnership();
    }
    try {
      const offscreen = installOffscreenNoise(nextSeed, undefined, targetGlobal);
      return {
        htmlCanvas: true,
        context2D: true,
        offscreenCanvas: offscreen,
        offscreenContext2D: offscreen,
      };
    } catch {
      return {
        htmlCanvas: true,
        context2D: true,
        offscreenCanvas: false,
        offscreenContext2D: false,
      };
    }
  }

  const seed = nextSeed;
  if (seed === undefined) {
    return noCanvasOwnership();
  }

  const runtimeState: CanvasRuntimeState = {
    debugSnapshot: snapshot,
    seed,
    stateVersion: 1,
  };
  const getCurrentCanvasSeed = (): number | undefined => runtimeState.seed;
  const logCanvas = createLogger(() => runtimeState.debugSnapshot, "Canvas");
  const logCanvasOnce = createOnceLogger(() => runtimeState.debugSnapshot, "Canvas");
  const installOffscreen = (): boolean => {
    try {
      return installOffscreenNoise(seed, undefined, targetGlobal);
    } catch (error) {
      logCanvas("offscreen-install-failed", [], {
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };
  const installedOwnership = (offscreen: boolean): CanvasIntegrityOwnership => ({
    htmlCanvas: true,
    context2D: true,
    offscreenCanvas: offscreen,
    offscreenContext2D: offscreen,
  });

  logCanvas("install", [], {
    seed,
    stateVersion: runtimeState.stateVersion,
  });

  const anchorState = inspectPatchAnchors(CANVAS_PATCH_MARKER_KEY, [
    { fn: currentGetImageData, name: "getImageData" },
    { fn: canvasPrototype.toDataURL, name: "toDataURL" },
    { fn: canvasPrototype.toBlob, name: "toBlob" },
  ]);
  if (anchorState === "installed") {
    return installedOwnership(installOffscreen());
  }
  if (anchorState === "conflict") {
    throw new Error("Conflicting Canvas patch anchors");
  }

  const installed = installCanvasMethods({
    canvasPrototype,
    contextPrototype,
    getSeed: getCurrentCanvasSeed,
    getStateVersion: () => runtimeState.stateVersion,
    logOnce: logCanvasOnce,
    markerKey: CANVAS_PATCH_MARKER_KEY,
  });
  privateWeakMapSet(canvasInstallations, targetGlobal, {
    canvasPrototype,
    contextPrototype,
    getImageData: installed.getImageData,
    runtimeState,
    toBlob: installed.toBlob,
    toDataURL: installed.toDataURL,
  });
  return installedOwnership(installOffscreen());
};
