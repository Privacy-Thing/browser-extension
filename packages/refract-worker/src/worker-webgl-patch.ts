import { isFpSurfaceEnabled } from "@privacy-brand/refract-core/fingerprint/surface-guards";
import {
  DEBUG_RENDERER_INFO_EXT,
  drainNativeWebGLErrors,
  queueWebGLInvalidEnum,
  UNMASKED_RENDERER_WEBGL,
  UNMASKED_VENDOR_WEBGL,
} from "@privacy-brand/refract-core/fingerprint/webgl-error";
import {
  captureReadPixelsCall,
  getReadPixelsPackState,
  getReadPixelsCallShape,
  normalizeReadPixelsArgs,
  perturbCapturedPixels,
} from "@privacy-brand/refract-core/fingerprint/webgl-readback-noise";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";

import type { WorkerRuntimeSupport } from "./worker-runtime-support";

import type { RuntimeSnapshot } from "@/shared/types";

type WebGLConfig = NonNullable<NonNullable<RuntimeSnapshot["fingerprint"]>["webGL"]>;

type ReadPixelsNatives = {
  getError: () => number;
  getParameter: (pname: number) => unknown;
  getSupportedExtensions: () => string[] | null;
};

class WorkerWebGLPatch {
  readonly #config: WebGLConfig;
  readonly #hasNoise: boolean;
  readonly #hasSpoofedStrings: boolean;
  readonly #hasSuppression: boolean;
  readonly #noiseSeed: number | undefined;
  readonly #pendingErrors = new WeakMap<any, number[]>();
  readonly #support: WorkerRuntimeSupport;

  constructor(config: WebGLConfig, support: WorkerRuntimeSupport) {
    this.#config = config;
    this.#support = support;
    this.#hasSuppression = config.suppressDebugInfo === true;
    this.#hasSpoofedStrings = !!(config.renderer || config.vendor);
    this.#noiseSeed = config.readPixelsNoiseSeed;
    this.#hasNoise = typeof this.#noiseSeed === "number";
  }

  install(): void {
    this.#support.loggers.webGL("install", [], {
      suppressDebugInfo: this.#hasSuppression,
      renderer: this.#config.renderer ?? null,
      vendor: this.#config.vendor ?? null,
      hasReadPixelsNoise: this.#hasNoise,
    });
    if (!this.#hasSuppression && !this.#hasSpoofedStrings && !this.#hasNoise) {
      return;
    }
    if (typeof WebGLRenderingContext !== "undefined") {
      this.#patchPrototype(WebGLRenderingContext.prototype, false);
    }
    if (typeof WebGL2RenderingContext !== "undefined") {
      this.#patchPrototype(WebGL2RenderingContext.prototype, true);
    }
  }

  #assertReceiver(nativeExtensions: any, context: any): void {
    if (typeof nativeExtensions === "function") {
      Reflect.apply(nativeExtensions, context, []);
    }
  }

  #patchGetExtension(proto: any): void {
    const nativeGetExtension = proto.getExtension;
    const nativeExtensions = proto.getSupportedExtensions;
    if (typeof nativeGetExtension !== "function") return;
    const patch = this;
    Object.defineProperty(proto, "getExtension", {
      configurable: true,
      writable: true,
      value: maskAsNative(
        {
          getExtension(this: any, name: string) {
            patch.#assertReceiver(nativeExtensions, this);
            if (name === DEBUG_RENDERER_INFO_EXT) {
              patch.#support.loggers.webGLOnce(
                "getExtension [suppressed]",
                [name],
                null,
              );
              return null;
            }
            return Reflect.apply(nativeGetExtension, this, [name]);
          },
        }.getExtension,
        createNativeSource("getExtension"),
        1,
      ),
    });
  }

  #patchSupportedExtensions(proto: any): void {
    const nativeExtensions = proto.getSupportedExtensions;
    if (typeof nativeExtensions !== "function") return;
    const patch = this;
    Object.defineProperty(proto, "getSupportedExtensions", {
      configurable: true,
      writable: true,
      value: maskAsNative(
        function getSupportedExtensions(this: any) {
          const result = Reflect.apply(nativeExtensions, this, []) as string[] | null;
          if (result === null) return null;
          const filtered = result.filter(
            (extension) => extension !== DEBUG_RENDERER_INFO_EXT,
          );
          patch.#support.loggers.webGLOnce("getSupportedExtensions [filtered]", [], {
            before: result.length,
            after: filtered.length,
          });
          return filtered;
        },
        createNativeSource("getSupportedExtensions"),
        0,
      ),
    });
  }

  #patchGetParameter(proto: any): void {
    const nativeGetParameter = proto.getParameter;
    const nativeGetError = proto.getError;
    const nativeExtensions = proto.getSupportedExtensions;
    if (typeof nativeGetParameter !== "function") return;
    const patch = this;
    Object.defineProperty(proto, "getParameter", {
      configurable: true,
      writable: true,
      value: maskAsNative(
        {
          getParameter(this: any, pname: number) {
            patch.#assertReceiver(nativeExtensions, this);
            if (
              patch.#hasSuppression &&
              (pname === UNMASKED_RENDERER_WEBGL || pname === UNMASKED_VENDOR_WEBGL)
            ) {
              patch.#support.loggers.webGLOnce(
                "getParameter [suppressed-debug-info]",
                [pname],
                null,
              );
              return queueWebGLInvalidEnum(this, nativeGetError, patch.#pendingErrors);
            }
            if (pname === UNMASKED_RENDERER_WEBGL && patch.#config.renderer) {
              patch.#support.loggers.webGLOnce(
                "getParameter [renderer]",
                [pname],
                patch.#config.renderer,
              );
              return patch.#config.renderer;
            }
            if (pname === UNMASKED_VENDOR_WEBGL && patch.#config.vendor) {
              patch.#support.loggers.webGLOnce(
                "getParameter [vendor]",
                [pname],
                patch.#config.vendor,
              );
              return patch.#config.vendor;
            }
            return Reflect.apply(nativeGetParameter, this, [pname]);
          },
        }.getParameter,
        createNativeSource("getParameter"),
        1,
      ),
    });
  }

  #patchGetError(proto: any): void {
    const nativeGetError = proto.getError;
    const nativeExtensions = proto.getSupportedExtensions;
    if (typeof nativeGetError !== "function") return;
    const patch = this;
    Object.defineProperty(proto, "getError", {
      configurable: true,
      writable: true,
      value: maskAsNative(
        {
          getError(this: any) {
            patch.#assertReceiver(nativeExtensions, this);
            const queuedErrors = patch.#pendingErrors.get(this);
            if (queuedErrors !== undefined && queuedErrors.length > 0) {
              const pendingError = queuedErrors.shift();
              if (queuedErrors.length === 0) patch.#pendingErrors.delete(this);
              return pendingError;
            }
            return Reflect.apply(nativeGetError, this, []);
          },
        }.getError,
        createNativeSource("getError"),
        0,
      ),
    });
  }

  #queueErrors(context: any, errors: readonly number[]): void {
    if (errors.length === 0) return;
    const queued = this.#pendingErrors.get(context) ?? [];
    queued.push(...errors);
    this.#pendingErrors.set(context, queued);
  }

  #patchReadPixels(proto: any, webGL2: boolean, natives: ReadPixelsNatives): void {
    if (!this.#hasNoise) return;
    const nativeReadPixels = proto.readPixels;
    if (typeof nativeReadPixels !== "function") return;
    const patch = this;
    Object.defineProperty(proto, "readPixels", {
      configurable: true,
      writable: true,
      value: maskAsNative(
        function readPixels(this: any, ...args: any[]) {
          try {
            Reflect.apply(natives.getSupportedExtensions, this, []);
          } catch (receiverError) {
            Reflect.apply(nativeReadPixels, this, []);
            throw receiverError;
          }
          const nativeArgs = normalizeReadPixelsArgs(args);
          const captured = captureReadPixelsCall(
            nativeArgs,
            getReadPixelsPackState(this, natives.getParameter, webGL2),
          );
          if (captured === null) {
            Reflect.apply(nativeReadPixels, this, nativeArgs);
            return;
          }
          const shape = getReadPixelsCallShape(nativeArgs);
          const previousErrors = drainNativeWebGLErrors(this, natives.getError);
          try {
            Reflect.apply(nativeReadPixels, this, nativeArgs);
          } catch (error) {
            patch.#queueErrors(this, [
              ...previousErrors,
              ...drainNativeWebGLErrors(this, natives.getError),
            ]);
            throw error;
          }
          const readErrors = drainNativeWebGLErrors(this, natives.getError);
          patch.#queueErrors(this, [...previousErrors, ...readErrors]);
          if (readErrors.length > 0) return;
          if (!perturbCapturedPixels(captured, patch.#noiseSeed!, shape)) return;
          patch.#support.loggers.webGLOnce("readPixels", [shape], {
            byteLength: captured.destination.byteLength,
          });
        },
        createNativeSource("readPixels"),
        nativeReadPixels.length,
      ),
    });
  }

  #patchPrototype(proto: any, webGL2: boolean): void {
    if (!proto) return;
    const natives = {
      getError: proto.getError,
      getParameter: proto.getParameter,
      getSupportedExtensions: proto.getSupportedExtensions,
    };
    if (this.#hasSuppression) {
      this.#patchGetExtension(proto);
      this.#patchSupportedExtensions(proto);
    }
    if (this.#hasSuppression || this.#hasNoise) this.#patchGetError(proto);
    if (this.#hasSuppression || this.#hasSpoofedStrings) {
      this.#patchGetParameter(proto);
    }
    if (this.#hasNoise) this.#patchReadPixels(proto, webGL2, natives);
  }
}

const registerWebGL = (support: WorkerRuntimeSupport): void => {
  const methods = {
    getError: undefined,
    getExtension: "webGL.getExtension",
    getParameter: "webGL.getParameter",
    getSupportedExtensions: "webGL.getSupportedExtensions",
    readPixels: "webGL.readPixels",
  } as const;
  for (const prototype of [
    (globalThis as any).WebGLRenderingContext?.prototype,
    (globalThis as any).WebGL2RenderingContext?.prototype,
  ]) {
    if (!prototype) continue;
    for (const key of Object.keys(methods) as Array<keyof typeof methods>) {
      support.register({
        target: prototype,
        key,
        surfaceId: "webGL",
        methodId: methods[key],
      });
    }
  }
};

export const installWorkerWebGL = (
  snapshot: RuntimeSnapshot,
  support: WorkerRuntimeSupport,
): void => {
  const config = snapshot.fingerprint?.webGL;
  if (!config || !isFpSurfaceEnabled(snapshot.fingerprint, "webGL")) return;
  new WorkerWebGLPatch(config, support).install();
  registerWebGL(support);
};
