/**
 * WebGL fingerprint patch.
 *
 * Two independent modes:
 * - **Suppression** (`suppressDebugInfo`): hides `WEBGL_debug_renderer_info`
 *   from `getExtension()` and `getSupportedExtensions()`, and makes direct
 *   `getParameter()` probes behave like an unavailable extension. This is the
 *   suppression approach — a legitimate browser configuration that is hard
 *   to detect.
 * - **String spoofing** (`renderer`/`vendor`): returns the resolved GPU strings
 *   from `getParameter()`.
 *
 * If `readPixelsNoiseSeed` is present, successful `readPixels()` calls also get
 * a tiny deterministic perturbation so rendered-pixel hashes drift per domain
 * rule while preserving native argument validation and GL errors.
 *
 * All modes can be active simultaneously when runtime settings enable them.
 */

import {
  createLogger,
  createOnceLogger,
  type RuntimeDebugSnapshot,
} from "@privacy-brand/refract-browser/common/debug-logger";
import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
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
import {
  inspectPatchAnchors,
  markPatchAnchor,
} from "@privacy-brand/refract-core/runtime/patch-marker";

import type { WebGLIntegrityOwnership } from "@/injection/main/surface-integrity";
import type { RuntimeSnapshot } from "@/shared/types";
let currentFingerprintState: RuntimeSnapshot["fingerprint"] | undefined;
let currentDebugSnapshot: RuntimeDebugSnapshot = null;
const WEBGL_PATCH_MARKER_KEY = `${__PT_SHIM_GUARD_KEY__}:webgl`;
const pendingWebGLErrors = new WeakMap<object, number[]>();
const logWebGL = createLogger(() => currentDebugSnapshot, "WebGL");
const logWebGLOnce = createOnceLogger(() => currentDebugSnapshot, "WebGL");

const getCurrentFingerprint = (): RuntimeSnapshot["fingerprint"] | undefined =>
  currentFingerprintState;

const getCurrentWebGLConfig = ():
  NonNullable<RuntimeSnapshot["fingerprint"]>["webGL"] | undefined => {
  const fingerprint = getCurrentFingerprint();
  if (!isFpSurfaceEnabled(fingerprint, "webGL")) {
    return undefined;
  }

  return fingerprint?.webGL;
};

const patchReadPixels = (
  proto: {
    getError: () => number;
    getParameter: (pname: number) => unknown;
    getSupportedExtensions: () => string[] | null;
    readPixels: (...args: unknown[]) => void;
  },
  webGL2: boolean,
): boolean => {
  const currentReadPixels = proto.readPixels;
  const anchorState = inspectPatchAnchors(WEBGL_PATCH_MARKER_KEY, [
    { fn: currentReadPixels, name: "readPixels" },
  ]);
  if (anchorState === "installed") {
    return true;
  }
  if (anchorState === "conflict") {
    throw new Error("Conflicting WebGL.readPixels patch anchor");
  }

  const nativeReadPixels = currentReadPixels as (...args: unknown[]) => void;
  const nativeGetError = proto.getError;
  const nativeGetParameter = proto.getParameter;
  const nativeExtensions = proto.getSupportedExtensions;

  const queueErrors = (context: object, errors: readonly number[]): void => {
    if (errors.length === 0) {
      return;
    }
    const queued = pendingWebGLErrors.get(context) ?? [];
    queued.push(...errors);
    pendingWebGLErrors.set(context, queued);
  };

  const patchedReadPixels = {
    readPixels(this: WebGLRenderingContext, ...args: unknown[]): void {
      const fingerprint = getCurrentFingerprint();
      if (!isFpSurfaceEnabled(fingerprint, "webGL")) {
        Reflect.apply(nativeReadPixels, this, args);
        return;
      }

      const currentSeed = fingerprint?.webGL?.readPixelsNoiseSeed;
      if (currentSeed === undefined) {
        Reflect.apply(nativeReadPixels, this, args);
        return;
      }

      // Native readPixels validates its receiver before converting arguments.
      // Use another receiver-validating WebGL intrinsic first so an illegal
      // receiver cannot trigger page-controlled valueOf()/toString().
      try {
        Reflect.apply(nativeExtensions, this, []);
      } catch (receiverError) {
        Reflect.apply(nativeReadPixels, this, []);
        throw receiverError;
      }
      const nativeArgs = normalizeReadPixelsArgs(args);
      const capturedCall = captureReadPixelsCall(
        nativeArgs,
        getReadPixelsPackState(this, nativeGetParameter, webGL2),
      );
      if (capturedCall === null) {
        Reflect.apply(nativeReadPixels, this, nativeArgs);
        return;
      }
      const callShape = getReadPixelsCallShape(nativeArgs);

      const previousErrors = drainNativeWebGLErrors(this, nativeGetError);
      try {
        Reflect.apply(nativeReadPixels, this, nativeArgs);
      } catch (error) {
        queueErrors(this, [
          ...previousErrors,
          ...drainNativeWebGLErrors(this, nativeGetError),
        ]);
        throw error;
      }

      const readPixelsErrors = drainNativeWebGLErrors(this, nativeGetError);
      queueErrors(this, [...previousErrors, ...readPixelsErrors]);
      if (readPixelsErrors.length > 0) {
        return;
      }

      if (!perturbCapturedPixels(capturedCall, currentSeed, callShape)) return;
      markSurfaceUsed("webGL", "webGL.readPixels");
      logWebGLOnce("readPixels", [callShape], {
        byteLength: capturedCall.destination.byteLength,
      });
    },
  }.readPixels;

  const maskedReadPixels = maskAsNative(
    patchedReadPixels,
    createNativeSource("readPixels"),
    nativeReadPixels.length,
  );
  markPatchAnchor(maskedReadPixels, WEBGL_PATCH_MARKER_KEY, "readPixels");
  Object.defineProperty(proto, "readPixels", {
    configurable: true,
    writable: true,
    value: maskedReadPixels,
  });
  return true;
};

const ensureReadPixelsPatch = (
  targetGlobal: typeof globalThis = globalThis,
): Pick<WebGLIntegrityOwnership, "webGL1ReadPixels" | "webGL2ReadPixels"> => {
  const ownership = {
    webGL1ReadPixels: false,
    webGL2ReadPixels: false,
  };
  const fingerprint = getCurrentFingerprint();
  if (!isFpSurfaceEnabled(fingerprint, "webGL")) {
    return ownership;
  }

  if (fingerprint?.webGL?.readPixelsNoiseSeed === undefined) {
    return ownership;
  }

  if (typeof targetGlobal.WebGLRenderingContext !== "undefined") {
    ownership.webGL1ReadPixels = patchReadPixels(
      targetGlobal.WebGLRenderingContext.prototype as unknown as {
        getError: () => number;
        getParameter: (pname: number) => unknown;
        getSupportedExtensions: () => string[] | null;
        readPixels: (...args: unknown[]) => void;
      },
      false,
    );
  }

  if (typeof targetGlobal.WebGL2RenderingContext !== "undefined") {
    ownership.webGL2ReadPixels = patchReadPixels(
      targetGlobal.WebGL2RenderingContext.prototype as unknown as {
        getError: () => number;
        getParameter: (pname: number) => unknown;
        getSupportedExtensions: () => string[] | null;
        readPixels: (...args: unknown[]) => void;
      },
      true,
    );
  }
  return ownership;
};

export const syncWebGLState = (
  snapshot: RuntimeSnapshot,
  targetGlobal: typeof globalThis = globalThis,
): Pick<WebGLIntegrityOwnership, "webGL1ReadPixels" | "webGL2ReadPixels"> => {
  currentFingerprintState = snapshot.fingerprint;
  currentDebugSnapshot = snapshot;
  return ensureReadPixelsPatch(targetGlobal);
};

const patchGetExtension = (
  proto: { getExtension: (name: string) => unknown },
  assertValidReceiver: (context: WebGLRenderingContext) => void,
): void => {
  const nativeGetExtension = proto.getExtension;

  const patchedGetExtension = {
    getExtension(this: WebGLRenderingContext, name: string): unknown {
      assertValidReceiver(this);
      if (
        getCurrentWebGLConfig()?.suppressDebugInfo === true &&
        name === DEBUG_RENDERER_INFO_EXT
      ) {
        markSurfaceUsed("webGL", "webGL.getExtension");
        logWebGLOnce("getExtension [suppressed]", [name], null);
        return null;
      }
      return Reflect.apply(nativeGetExtension, this, [name]);
    },
  }.getExtension;

  Object.defineProperty(proto, "getExtension", {
    configurable: true,
    writable: true,
    value: maskAsNative(patchedGetExtension, createNativeSource("getExtension"), 1),
  });
};

const patchSupportedExtensions = (proto: {
  getSupportedExtensions: () => string[] | null;
}): void => {
  const nativeExtensions = proto.getSupportedExtensions;

  const patchedExtensions = {
    getSupportedExtensions(this: WebGLRenderingContext): string[] | null {
      const result = Reflect.apply(nativeExtensions, this, []) as string[] | null;
      if (result === null) return null;
      if (getCurrentWebGLConfig()?.suppressDebugInfo !== true) {
        return result;
      }
      const filtered = result.filter((ext: string) => ext !== DEBUG_RENDERER_INFO_EXT);
      markSurfaceUsed("webGL", "webGL.getSupportedExtensions");
      logWebGLOnce("getSupportedExtensions [filtered]", [], {
        before: result.length,
        after: filtered.length,
      });
      return filtered;
    },
  }.getSupportedExtensions;

  Object.defineProperty(proto, "getSupportedExtensions", {
    configurable: true,
    writable: true,
    value: maskAsNative(
      patchedExtensions,
      createNativeSource("getSupportedExtensions"),
      0,
    ),
  });
};

const patchGetParameter = (
  pendingErrors: WeakMap<object, number[]>,
  proto: { getParameter: (pname: number) => unknown },
  nativeGetError: () => number,
  assertValidReceiver: (context: WebGLRenderingContext) => void,
): void => {
  const nativeGetParameter = proto.getParameter;

  const patchedGetParameter = {
    getParameter(this: WebGLRenderingContext, pname: number): unknown {
      assertValidReceiver(this);
      const currentConfig = getCurrentWebGLConfig();
      if (
        currentConfig?.suppressDebugInfo === true &&
        (pname === UNMASKED_RENDERER_WEBGL || pname === UNMASKED_VENDOR_WEBGL)
      ) {
        markSurfaceUsed("webGL", "webGL.getParameter");
        logWebGLOnce("getParameter [suppressed-debug-info]", [pname], null);
        return queueWebGLInvalidEnum(this, nativeGetError, pendingErrors);
      }

      if (pname === UNMASKED_RENDERER_WEBGL && currentConfig?.renderer) {
        markSurfaceUsed("webGL", "webGL.getParameter");
        logWebGLOnce("getParameter [renderer]", [pname], currentConfig.renderer);
        return currentConfig.renderer;
      }
      if (pname === UNMASKED_VENDOR_WEBGL && currentConfig?.vendor) {
        markSurfaceUsed("webGL", "webGL.getParameter");
        logWebGLOnce("getParameter [vendor]", [pname], currentConfig.vendor);
        return currentConfig.vendor;
      }
      return Reflect.apply(nativeGetParameter, this, [pname]);
    },
  }.getParameter;

  const maskedGetParameter = maskAsNative(
    patchedGetParameter,
    createNativeSource("getParameter"),
    1,
  );
  markPatchAnchor(maskedGetParameter, WEBGL_PATCH_MARKER_KEY, "getParameter");
  Object.defineProperty(proto, "getParameter", {
    configurable: true,
    writable: true,
    value: maskedGetParameter,
  });
};

const patchGetError = (
  pendingErrors: WeakMap<object, number[]>,
  proto: { getError: () => number },
  assertValidReceiver: (context: WebGLRenderingContext) => void,
): void => {
  const nativeGetError = proto.getError;

  const patchedGetError = {
    getError(this: WebGLRenderingContext): number {
      assertValidReceiver(this);
      const queuedErrors = pendingErrors.get(this);
      if (queuedErrors !== undefined && queuedErrors.length > 0) {
        const pendingError = queuedErrors.shift()!;
        if (queuedErrors.length === 0) {
          pendingErrors.delete(this);
        }
        return pendingError;
      }

      return Reflect.apply(nativeGetError, this, []) as number;
    },
  }.getError;

  Object.defineProperty(proto, "getError", {
    configurable: true,
    writable: true,
    value: maskAsNative(patchedGetError, createNativeSource("getError"), 0),
  });
};

const patchPrototype = (
  proto: WebGLRenderingContext & { getError: () => number },
): boolean => {
  const anchorState = inspectPatchAnchors(WEBGL_PATCH_MARKER_KEY, [
    { fn: proto.getParameter, name: "getParameter" },
  ]);
  if (anchorState === "installed") {
    return true;
  }
  if (anchorState === "conflict") {
    throw new Error("Conflicting WebGL patch anchor");
  }

  const pendingErrors = pendingWebGLErrors;
  const nativeExtensions = proto.getSupportedExtensions;
  const nativeGetError = proto.getError;
  const assertValidReceiver = (context: WebGLRenderingContext): void => {
    Reflect.apply(nativeExtensions, context, []);
  };

  patchGetExtension(proto, assertValidReceiver);
  patchSupportedExtensions(proto);
  patchGetError(pendingErrors, proto, assertValidReceiver);
  patchGetParameter(pendingErrors, proto, nativeGetError, assertValidReceiver);
  return true;
};

export const installWebGLPatch = (
  snapshot: RuntimeSnapshot,
  targetGlobal: typeof globalThis = globalThis,
): WebGLIntegrityOwnership => {
  const readPixelsOwnership = syncWebGLState(snapshot, targetGlobal);
  const ownership: WebGLIntegrityOwnership = {
    webGL1Common: false,
    webGL2Common: false,
    ...readPixelsOwnership,
  };
  const targetPrototypes = [
    targetGlobal.WebGLRenderingContext?.prototype,
    targetGlobal.WebGL2RenderingContext?.prototype,
  ].filter((prototype): prototype is WebGLRenderingContext => Boolean(prototype));
  const anchorStates = targetPrototypes.map((prototype) =>
    inspectPatchAnchors(WEBGL_PATCH_MARKER_KEY, [
      { fn: prototype.getParameter, name: "getParameter" },
    ]),
  );
  if (anchorStates.length > 0 && anchorStates.every((state) => state === "installed")) {
    ownership.webGL1Common = typeof targetGlobal.WebGLRenderingContext !== "undefined";
    ownership.webGL2Common = typeof targetGlobal.WebGL2RenderingContext !== "undefined";
    return ownership;
  }
  if (anchorStates.some((state) => state !== "absent")) {
    throw new Error("Conflicting or incomplete WebGL patch anchors");
  }
  const webGLConfig = getCurrentWebGLConfig();
  if (!webGLConfig) return ownership;

  logWebGL("install", [], {
    suppressDebugInfo: webGLConfig.suppressDebugInfo ?? false,
    renderer: webGLConfig.renderer ?? null,
    vendor: webGLConfig.vendor ?? null,
    hasReadPixelsNoise: webGLConfig.readPixelsNoiseSeed !== undefined,
  });

  // Patch prototypes directly — no need to create canvas instances.
  if (typeof targetGlobal.WebGLRenderingContext !== "undefined") {
    ownership.webGL1Common = patchPrototype(
      targetGlobal.WebGLRenderingContext.prototype,
    );
  }

  if (typeof targetGlobal.WebGL2RenderingContext !== "undefined") {
    ownership.webGL2Common = patchPrototype(
      targetGlobal.WebGL2RenderingContext.prototype as unknown as WebGLRenderingContext,
    );
  }
  return ownership;
};
