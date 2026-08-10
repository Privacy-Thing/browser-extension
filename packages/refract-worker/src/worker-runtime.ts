import "@privacy-brand/refract-core/runtime/primordials";

import { isFpSurfaceEnabled } from "@privacy-brand/refract-core/fingerprint/surface-guards";

import { installWorkerAudioPatch } from "./worker-audio";
import { installWorkerCanvasPatch } from "./worker-canvas";
import { installWorkerGeo } from "./worker-geo-patch";
import { installWorkerLocation } from "./worker-location";
import {
  installWorkerClientHints,
  installWorkerNavigator,
} from "./worker-navigator-patches";
import {
  createWorkerSupport,
  finalizeWorkerIntegrity,
  type WorkerRuntimeSupport,
} from "./worker-runtime-support";
import { installWorkerTime } from "./worker-time-patches";
import { installWorkerWebGL } from "./worker-webgl-patch";

import type { RuntimeSnapshot } from "@/shared/types";
import { createWorkerAckMessage } from "@/shared/worker-bootstrap-ack";

declare const __RF_WORKER_SNAPSHOT__: RuntimeSnapshot | undefined;
declare const __REFRACT_WORKER_URL__: string;
declare const __RF_WORKER_LOG_TYPE__: string;
declare const __RF_WORKER_GUARD__: string;
declare const __RF_WORKER_ACK__: string;

const registerCanvas = (support: WorkerRuntimeSupport): void => {
  for (const [target, methods] of [
    [
      (globalThis as any).OffscreenCanvas?.prototype,
      ["convertToBlob", "getContext", "height", "width"],
    ],
    [
      (globalThis as any).OffscreenCanvasRenderingContext2D?.prototype,
      ["getImageData", "putImageData"],
    ],
  ] as const) {
    if (!target) continue;
    for (const key of methods) {
      support.register({
        target,
        key,
        surfaceId: "canvas",
        methodId: key === "getImageData" ? "canvas.getImageData" : undefined,
      });
    }
  }
};

const registerAudio = (support: WorkerRuntimeSupport): void => {
  const prototype = (globalThis as any).AudioBuffer?.prototype;
  if (!prototype) return;
  for (const key of ["copyFromChannel", "copyToChannel", "getChannelData"] as const) {
    support.register({
      target: prototype,
      key,
      surfaceId: "audio",
      methodId: key === "getChannelData" ? "audio.getChannelData" : undefined,
    });
  }
};

const installWorkerRuntime = (snapshot: RuntimeSnapshot): void => {
  const support = createWorkerSupport(snapshot, __RF_WORKER_LOG_TYPE__);
  if (__REFRACT_WORKER_URL__) installWorkerLocation(__REFRACT_WORKER_URL__);
  installWorkerNavigator(snapshot, support);
  installWorkerClientHints(snapshot, support);
  installWorkerTime(snapshot, support);
  installWorkerGeo(snapshot, support);
  installWorkerWebGL(snapshot, support);
  installWorkerCanvasPatch(snapshot, support.loggers.canvas);
  installWorkerAudioPatch(snapshot, support.loggers.audio);
  if (isFpSurfaceEnabled(snapshot.fingerprint, "canvas")) registerCanvas(support);
  if (isFpSurfaceEnabled(snapshot.fingerprint, "audio")) registerAudio(support);
  finalizeWorkerIntegrity(support, __RF_WORKER_GUARD__, __RF_WORKER_ACK__);

  // Dedicated workers acknowledge before the original script starts. Shared
  // workers use the background rewrite model and have no parent ack listener.
  if (!support.isSharedWorker()) {
    try {
      globalThis.postMessage(
        createWorkerAckMessage(__RF_WORKER_GUARD__, __RF_WORKER_ACK__),
      );
    } catch {
      // The parent timeout reports bootstrap failure.
    }
  }
};

if (__RF_WORKER_SNAPSHOT__) installWorkerRuntime(__RF_WORKER_SNAPSHOT__);
