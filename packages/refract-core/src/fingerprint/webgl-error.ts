export const DEBUG_RENDERER_INFO_EXT = "WEBGL_debug_renderer_info";
export const INVALID_ENUM = 0x0500;
export const UNMASKED_VENDOR_WEBGL = 0x9245;
export const UNMASKED_RENDERER_WEBGL = 0x9246;

export const drainNativeWebGLErrors = (
  context: WebGLRenderingContext | WebGL2RenderingContext,
  nativeGetError: () => number,
): number[] => {
  const drainedErrors: number[] = [];

  while (true) {
    const nativeError = Reflect.apply(nativeGetError, context, []) as number;
    if (nativeError === 0) {
      return drainedErrors;
    }

    drainedErrors.push(nativeError);
  }
};

export const queueWebGLInvalidEnum = (
  context: WebGLRenderingContext | WebGL2RenderingContext,
  nativeGetError: () => number,
  pendingErrors: WeakMap<object, number[]>,
): null => {
  const queuedErrors = pendingErrors.get(context) ?? [];
  queuedErrors.push(...drainNativeWebGLErrors(context, nativeGetError), INVALID_ENUM);
  pendingErrors.set(context, queuedErrors);
  return null;
};

export const WEBGL_ERROR_SOURCE = [
  `    const DEBUG_RENDERER_INFO_EXT = ${JSON.stringify(DEBUG_RENDERER_INFO_EXT)};`,
  `    const INVALID_ENUM = 0x${INVALID_ENUM.toString(16).padStart(4, "0")};`,
  `    const UNMASKED_VENDOR_WEBGL = 0x${UNMASKED_VENDOR_WEBGL.toString(16)};`,
  `    const UNMASKED_RENDERER_WEBGL = 0x${UNMASKED_RENDERER_WEBGL.toString(16)};`,
  "    const drainNativeWebGLErrors = (context, nativeGetError) => {",
  "      const drainedErrors = [];",
  "      while (true) {",
  "        const nativeError = Reflect.apply(nativeGetError, context, []);",
  "        if (nativeError === 0) {",
  "          return drainedErrors;",
  "        }",
  "        drainedErrors.push(nativeError);",
  "      }",
  "    };",
  "    const queueWebGLInvalidEnum = (context, nativeGetError, pendingErrors) => {",
  "      const queuedErrors = pendingErrors.get(context) ?? [];",
  "      queuedErrors.push(...drainNativeWebGLErrors(context, nativeGetError), INVALID_ENUM);",
  "      pendingErrors.set(context, queuedErrors);",
  "      return null;",
  "    };",
].join("\n");
