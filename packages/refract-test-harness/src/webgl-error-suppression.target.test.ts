import {
  DEBUG_RENDERER_INFO_EXT,
  drainNativeWebGLErrors,
  INVALID_ENUM,
  queueWebGLInvalidEnum,
  UNMASKED_RENDERER_WEBGL,
  UNMASKED_VENDOR_WEBGL,
  WEBGL_ERROR_SOURCE,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

describe("webgl-error-suppression", () => {
  it("exports the expected WebGL debug-info constants", () => {
    expect(DEBUG_RENDERER_INFO_EXT).toBe("WEBGL_debug_renderer_info");
    expect(INVALID_ENUM).toBe(0x0500);
    expect(UNMASKED_VENDOR_WEBGL).toBe(0x9245);
    expect(UNMASKED_RENDERER_WEBGL).toBe(0x9246);
  });

  it("drains native errors until WebGL reports none", () => {
    const nativeErrors = [0x0501, 0x0502, 0];
    const context = {};

    expect(
      drainNativeWebGLErrors(
        context as WebGLRenderingContext,
        () => nativeErrors.shift() ?? 0,
      ),
    ).toEqual([0x0501, 0x0502]);
  });

  it("queues native errors ahead of synthetic INVALID_ENUM", () => {
    const nativeErrors = [0x0501, 0];
    const context = {};
    const pendingErrors = new WeakMap<object, number[]>();

    expect(
      queueWebGLInvalidEnum(
        context as WebGLRenderingContext,
        () => nativeErrors.shift() ?? 0,
        pendingErrors,
      ),
    ).toBeNull();
    expect(pendingErrors.get(context)).toEqual([0x0501, INVALID_ENUM]);
  });

  it("builds worker inline source from the shared suppression helpers", () => {
    expect(WEBGL_ERROR_SOURCE).toContain(
      'const DEBUG_RENDERER_INFO_EXT = "WEBGL_debug_renderer_info";',
    );
    expect(WEBGL_ERROR_SOURCE).toContain("const INVALID_ENUM = 0x0500;");
    expect(WEBGL_ERROR_SOURCE).toContain(
      "const queueWebGLInvalidEnum = (context, nativeGetError, pendingErrors) => {",
    );
  });
});
