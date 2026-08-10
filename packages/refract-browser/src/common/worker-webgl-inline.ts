import { WEBGL_ERROR_SOURCE } from "@privacy-brand/refract-core/fingerprint/webgl-error";
import { WEBGL_NOISE_SOURCE } from "@privacy-brand/refract-core/fingerprint/webgl-readback-noise";

export const WORKER_WEBGL_SOURCE = `  const installWebGLPatch = () => {
    const webGLConfig = snapshot.fingerprint?.webGL;
    if (!webGLConfig || !isFpSurfaceEnabled(snapshot.fingerprint, "webGL")) {
      return;
    }

    const logWebGL = createWorkerLogger("WebGL");
    const logWebGLOnce = createWorkerOnceLogger("WebGL");
    logWebGL("install", [], {
      suppressDebugInfo: webGLConfig.suppressDebugInfo === true,
      renderer: webGLConfig.renderer ?? null,
      vendor: webGLConfig.vendor ?? null,
      hasReadPixelsNoise: typeof webGLConfig.readPixelsNoiseSeed === "number"
    });

    const hasSuppression = webGLConfig.suppressDebugInfo === true;
    const hasSpoofedStrings = !!(webGLConfig.renderer || webGLConfig.vendor);
    const readPixelsNoiseSeed = webGLConfig.readPixelsNoiseSeed;
    const hasReadPixelsNoise = typeof readPixelsNoiseSeed === "number";
    if (!hasSuppression && !hasSpoofedStrings && !hasReadPixelsNoise) {
      return;
    }

    const pendingErrors = new WeakMap();
${WEBGL_ERROR_SOURCE}

${WEBGL_NOISE_SOURCE}

    const patchGetExtension = (proto) => {
      const nativeGetExtension = proto.getExtension;
      const nativeExtensions = proto.getSupportedExtensions;
      if (typeof nativeGetExtension !== "function") {
        return;
      }

      const assertValidReceiver = (context) => {
        if (typeof nativeExtensions === "function") {
          Reflect.apply(nativeExtensions, context, []);
        }
      };

      Object.defineProperty(proto, "getExtension", {
        configurable: true,
        writable: true,
        value: maskAsNative({ getExtension(name) {
          assertValidReceiver(this);
          if (name === DEBUG_RENDERER_INFO_EXT) {
            logWebGLOnce("getExtension [suppressed]", [name], null);
            return null;
          }

          return Reflect.apply(nativeGetExtension, this, [name]);
        } }.getExtension, createNativeSource("getExtension"), 1)
      });
    };

    const patchSupportedExtensions = (proto) => {
      const nativeExtensions = proto.getSupportedExtensions;
      if (typeof nativeExtensions !== "function") {
        return;
      }

      Object.defineProperty(proto, "getSupportedExtensions", {
        configurable: true,
        writable: true,
        value: maskAsNative({ getSupportedExtensions() {
          const result = Reflect.apply(nativeExtensions, this, []);
          if (result === null) {
            return null;
          }

          const filtered = result.filter((ext) => ext !== DEBUG_RENDERER_INFO_EXT);
          logWebGLOnce("getSupportedExtensions [filtered]", [], {
            before: result.length,
            after: filtered.length
          });
          return filtered;
        } }.getSupportedExtensions, createNativeSource("getSupportedExtensions"), 0)
      });
    };

    const patchGetParameter = (proto) => {
      const nativeGetParameter = proto.getParameter;
      const nativeGetError = proto.getError;
      const nativeExtensions = proto.getSupportedExtensions;
      if (typeof nativeGetParameter !== "function") {
        return;
      }

      const assertValidReceiver = (context) => {
        if (typeof nativeExtensions === "function") {
          Reflect.apply(nativeExtensions, context, []);
        }
      };

      Object.defineProperty(proto, "getParameter", {
        configurable: true,
        writable: true,
        value: maskAsNative({ getParameter(pname) {
          assertValidReceiver(this);
          if (
            hasSuppression &&
            (pname === UNMASKED_RENDERER_WEBGL || pname === UNMASKED_VENDOR_WEBGL)
          ) {
            logWebGLOnce("getParameter [suppressed-debug-info]", [pname], null);
            return queueWebGLInvalidEnum(this, nativeGetError, pendingErrors);
          }

          if (pname === UNMASKED_RENDERER_WEBGL && webGLConfig.renderer) {
            logWebGLOnce("getParameter [renderer]", [pname], webGLConfig.renderer);
            return webGLConfig.renderer;
          }
          if (pname === UNMASKED_VENDOR_WEBGL && webGLConfig.vendor) {
            logWebGLOnce("getParameter [vendor]", [pname], webGLConfig.vendor);
            return webGLConfig.vendor;
          }

          return Reflect.apply(nativeGetParameter, this, [pname]);
        } }.getParameter, createNativeSource("getParameter"), 1)
      });
    };

    const patchGetError = (proto) => {
      const nativeGetError = proto.getError;
      const nativeExtensions = proto.getSupportedExtensions;
      if (typeof nativeGetError !== "function") {
        return;
      }

      const assertValidReceiver = (context) => {
        if (typeof nativeExtensions === "function") {
          Reflect.apply(nativeExtensions, context, []);
        }
      };

      Object.defineProperty(proto, "getError", {
        configurable: true,
        writable: true,
        value: maskAsNative({ getError() {
          assertValidReceiver(this);
          const queuedErrors = pendingErrors.get(this);
          if (queuedErrors !== undefined && queuedErrors.length > 0) {
            const pendingError = queuedErrors.shift();
            if (queuedErrors.length === 0) {
              pendingErrors.delete(this);
            }
            return pendingError;
          }

          return Reflect.apply(nativeGetError, this, []);
        } }.getError, createNativeSource("getError"), 0)
      });
    };

    const patchReadPixels = (
      proto,
      webGL2,
      nativeGetError,
      nativeGetParameter,
      nativeExtensions
    ) => {
      if (!hasReadPixelsNoise) {
        return;
      }

      const nativeReadPixels = proto.readPixels;
      if (typeof nativeReadPixels !== "function") {
        return;
      }

      Object.defineProperty(proto, "readPixels", {
        configurable: true,
        writable: true,
        value: maskAsNative({ readPixels(...args) {
          try {
            Reflect.apply(nativeExtensions, this, []);
          } catch (receiverError) {
            Reflect.apply(nativeReadPixels, this, []);
            throw receiverError;
          }
          const nativeArgs = normalizeReadPixelsArgs(args);
          const capturedCall = captureReadPixelsCall(
            nativeArgs,
            getReadPixelsPackState(this, nativeGetParameter, webGL2)
          );
          if (capturedCall === null) {
            Reflect.apply(nativeReadPixels, this, nativeArgs);
            return;
          }
          const callShape = getReadPixelsCallShape(nativeArgs);

          const queueErrors = (errors) => {
            if (errors.length === 0) return;
            const queued = pendingErrors.get(this) ?? [];
            queued.push(...errors);
            pendingErrors.set(this, queued);
          };
          const previousErrors = drainNativeWebGLErrors(this, nativeGetError);
          try {
            Reflect.apply(nativeReadPixels, this, nativeArgs);
          } catch (error) {
            queueErrors([
              ...previousErrors,
              ...drainNativeWebGLErrors(this, nativeGetError)
            ]);
            throw error;
          }

          const readPixelsErrors = drainNativeWebGLErrors(this, nativeGetError);
          queueErrors([...previousErrors, ...readPixelsErrors]);
          if (readPixelsErrors.length > 0) {
            return;
          }

          if (!perturbCapturedPixels(capturedCall, callShape)) {
            return;
          }
          logWebGLOnce("readPixels", [callShape], {
            byteLength: capturedCall.destination.byteLength
          });
        } }.readPixels, createNativeSource("readPixels"), nativeReadPixels.length)
      });
    };

    const patchPrototype = (proto, webGL2) => {
      if (!proto) {
        return;
      }
      const nativeGetError = proto.getError;
      const nativeGetParameter = proto.getParameter;
      const nativeExtensions = proto.getSupportedExtensions;

        if (hasSuppression) {
          patchGetExtension(proto);
          patchSupportedExtensions(proto);
        }
        if (hasSuppression || hasReadPixelsNoise) {
          patchGetError(proto);
        }

        if (hasSuppression || hasSpoofedStrings) {
          patchGetParameter(proto);
        }
        if (hasReadPixelsNoise) {
          patchReadPixels(
            proto,
            webGL2,
            nativeGetError,
            nativeGetParameter,
            nativeExtensions
          );
        }
      };

    if (typeof WebGLRenderingContext !== "undefined") {
      patchPrototype(WebGLRenderingContext.prototype, false);
    }

    if (typeof WebGL2RenderingContext !== "undefined") {
      patchPrototype(WebGL2RenderingContext.prototype, true);
    }
  };`;
