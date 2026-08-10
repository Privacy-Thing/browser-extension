import { runInNewContext } from "node:vm";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installWebGLPatch, syncWebGLState } from "@/injection/main/webgl-patch";
import type { RuntimeSnapshot } from "@/shared/types";

const UNMASKED_VENDOR_WEBGL = 0x9245;
const UNMASKED_RENDERER_WEBGL = 0x9246;
const INVALID_ENUM = 0x0500;
const RGBA = 0x1908;
const UNSIGNED_BYTE = 0x1401;
const FLOAT = 0x1406;
const INVALID_OPERATION = 0x0502;
const FLOAT_DELTA = 1 / 65_536;

const fakeOESExtension = { textureFloat: true };

const fillReadPixelsView = (pixels: ArrayBufferView): void => {
  const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index * 17 + 23) & 0xff;
  }
};

class MockWebGLContext {
  private errorCode = 0;

  queueError(errorCode: number): void {
    this.errorCode = errorCode;
  }

  getExtension(name: string): unknown {
    if (!(this instanceof MockWebGLContext)) {
      throw new TypeError("Illegal invocation");
    }
    if (name === "WEBGL_debug_renderer_info") {
      return { UNMASKED_VENDOR_WEBGL, UNMASKED_RENDERER_WEBGL };
    }
    if (name === "OES_texture_float") return fakeOESExtension;
    return null;
  }

  getSupportedExtensions(): string[] {
    if (!(this instanceof MockWebGLContext)) {
      throw new TypeError("getSupportedExtensions: Illegal invocation");
    }
    return ["OES_texture_float", "WEBGL_debug_renderer_info", "EXT_blend_minmax"];
  }

  getParameter(pname: number): unknown {
    if (!(this instanceof MockWebGLContext)) {
      throw new TypeError("Illegal invocation");
    }
    if (pname === UNMASKED_RENDERER_WEBGL) return "Real Renderer";
    if (pname === UNMASKED_VENDOR_WEBGL) return "Real Vendor";
    return null;
  }

  getError(): number {
    if (!(this instanceof MockWebGLContext)) {
      throw new TypeError("Illegal invocation");
    }
    const nextError = this.errorCode;
    this.errorCode = 0;
    return nextError;
  }

  readPixels(
    _x: number,
    _y: number,
    _width: number,
    _height: number,
    _format: number,
    _type: number,
    pixels: ArrayBufferView,
  ): void {
    if (!(this instanceof MockWebGLContext)) {
      throw new TypeError("readPixels: Illegal invocation");
    }
    fillReadPixelsView(pixels);
  }
}

class MockWebGL2Context {
  private errorCode = 0;

  queueError(errorCode: number): void {
    this.errorCode = errorCode;
  }

  getExtension(name: string): unknown {
    if (!(this instanceof MockWebGL2Context)) {
      throw new TypeError("Illegal invocation");
    }
    if (name === "WEBGL_debug_renderer_info") {
      return { UNMASKED_VENDOR_WEBGL, UNMASKED_RENDERER_WEBGL };
    }
    if (name === "OES_texture_float") return fakeOESExtension;
    return null;
  }

  getSupportedExtensions(): string[] {
    if (!(this instanceof MockWebGL2Context)) {
      throw new TypeError("getSupportedExtensions: Illegal invocation");
    }
    return ["OES_texture_float", "WEBGL_debug_renderer_info", "EXT_blend_minmax"];
  }

  getParameter(pname: number): unknown {
    if (!(this instanceof MockWebGL2Context)) {
      throw new TypeError("Illegal invocation");
    }
    if (pname === UNMASKED_RENDERER_WEBGL) return "Real Renderer GL2";
    if (pname === UNMASKED_VENDOR_WEBGL) return "Real Vendor GL2";
    return null;
  }

  getError(): number {
    if (!(this instanceof MockWebGL2Context)) {
      throw new TypeError("Illegal invocation");
    }
    const nextError = this.errorCode;
    this.errorCode = 0;
    return nextError;
  }

  readPixels(
    _x: number,
    _y: number,
    width: number,
    height: number,
    _format: number,
    _type: number,
    pixels: ArrayBufferView,
    dstOffset?: number,
  ): void {
    if (!(this instanceof MockWebGL2Context)) {
      throw new TypeError("readPixels: Illegal invocation");
    }
    if (dstOffset !== undefined) {
      const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
      const readbackLength = (Number(width) | 0) * (Number(height) | 0) * 4;
      const numericDstOffset = Number(dstOffset) >>> 0;
      for (let index = 0; index < readbackLength; index += 1) {
        bytes[numericDstOffset + index] = (index * 17 + 23) & 0xff;
      }
      return;
    }
    fillReadPixelsView(pixels);
  }
}

class HeapTailWebGLContext extends MockWebGLContext {
  override readPixels(
    _x: number,
    _y: number,
    width: number,
    height: number,
    _format: number,
    _type: number,
    pixels: ArrayBufferView,
  ): void {
    const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
    const readbackLength = width * height * 4;
    for (let index = 0; index < readbackLength; index += 1) {
      bytes[index] = (index * 17 + 23) & 0xff;
    }
  }
}

class ZeroReadbackContext extends MockWebGLContext {
  override readPixels(
    _x: number,
    _y: number,
    _width: number,
    _height: number,
    _format: number,
    _type: number,
    _pixels: ArrayBufferView,
  ): void {
    // Successful transparent-black readback into an already-zero destination.
  }
}

class FailedReadbackContext extends MockWebGLContext {
  override readPixels(
    _x: number,
    _y: number,
    _width: number,
    _height: number,
    _format: number,
    _type: number,
    _pixels: ArrayBufferView,
  ): void {
    this.queueError(INVALID_OPERATION);
  }
}

class FloatReadbackContext extends MockWebGLContext {
  override readPixels(
    _x: number,
    _y: number,
    _width: number,
    _height: number,
    _format: number,
    _type: number,
    pixels: ArrayBufferView,
  ): void {
    (pixels as Float32Array).fill(0.5);
  }
}

const buildSnapshot = (
  overrides?: Partial<RuntimeSnapshot["fingerprint"]>,
): RuntimeSnapshot => ({
  geo: { latitude: 0, longitude: 0, accuracy: 10, noiseRadius: 50 },
  locale: { language: "en", languages: ["en"], timeZone: "UTC", acceptLanguage: "en" },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
  debugMode: false,
  watchPositionDelay: [100, 500],
  fingerprint: {
    webGL: { suppressDebugInfo: true },
    ...overrides,
  },
});

describe("installWebGLPatch", () => {
  let originalGetExtension: typeof MockWebGLContext.prototype.getExtension;
  let nativeExtensions: typeof MockWebGLContext.prototype.getSupportedExtensions;
  let originalGetParameter: typeof MockWebGLContext.prototype.getParameter;
  let originalGetError: typeof MockWebGLContext.prototype.getError;
  let originalReadPixels: typeof MockWebGLContext.prototype.readPixels;
  let originalGetExtension2: typeof MockWebGL2Context.prototype.getExtension;
  let nativeExtensions2: typeof MockWebGL2Context.prototype.getSupportedExtensions;
  let originalGetParameter2: typeof MockWebGL2Context.prototype.getParameter;
  let originalGetError2: typeof MockWebGL2Context.prototype.getError;
  let originalReadPixels2: typeof MockWebGL2Context.prototype.readPixels;

  beforeEach(() => {
    syncWebGLState(buildSnapshot());
    originalGetExtension = MockWebGLContext.prototype.getExtension;
    nativeExtensions = MockWebGLContext.prototype.getSupportedExtensions;
    originalGetParameter = MockWebGLContext.prototype.getParameter;
    originalGetError = MockWebGLContext.prototype.getError;
    originalReadPixels = MockWebGLContext.prototype.readPixels;
    originalGetExtension2 = MockWebGL2Context.prototype.getExtension;
    nativeExtensions2 = MockWebGL2Context.prototype.getSupportedExtensions;
    originalGetParameter2 = MockWebGL2Context.prototype.getParameter;
    originalGetError2 = MockWebGL2Context.prototype.getError;
    originalReadPixels2 = MockWebGL2Context.prototype.readPixels;

    vi.stubGlobal("WebGLRenderingContext", MockWebGLContext);
    vi.stubGlobal("WebGL2RenderingContext", MockWebGL2Context);
  });

  afterEach(() => {
    MockWebGLContext.prototype.getExtension = originalGetExtension;
    MockWebGLContext.prototype.getSupportedExtensions = nativeExtensions;
    MockWebGLContext.prototype.getParameter = originalGetParameter;
    MockWebGLContext.prototype.getError = originalGetError;
    MockWebGLContext.prototype.readPixels = originalReadPixels;
    MockWebGL2Context.prototype.getExtension = originalGetExtension2;
    MockWebGL2Context.prototype.getSupportedExtensions = nativeExtensions2;
    MockWebGL2Context.prototype.getParameter = originalGetParameter2;
    MockWebGL2Context.prototype.getError = originalGetError2;
    MockWebGL2Context.prototype.readPixels = originalReadPixels2;
    syncWebGLState(buildSnapshot());
    vi.unstubAllGlobals();
  });

  it("reports no ownership when fingerprint spoofing is not configured", () => {
    const snapshot = buildSnapshot();
    delete snapshot.fingerprint;

    expect(installWebGLPatch(snapshot)).toEqual({
      webGL1Common: false,
      webGL1ReadPixels: false,
      webGL2Common: false,
      webGL2ReadPixels: false,
    });
  });

  it("owns common methods but not readPixels for renderer-only config", () => {
    expect(
      installWebGLPatch(buildSnapshot({ webGL: { renderer: "Example" } })),
    ).toEqual({
      webGL1Common: true,
      webGL1ReadPixels: false,
      webGL2Common: true,
      webGL2ReadPixels: false,
    });
  });

  it("suppresses WEBGL_debug_renderer_info when suppressDebugInfo is true", () => {
    installWebGLPatch(buildSnapshot({ webGL: { suppressDebugInfo: true } }));

    const ctx = new MockWebGLContext();
    expect(ctx.getExtension("WEBGL_debug_renderer_info")).toBeNull();
    expect(ctx.getExtension("OES_texture_float")).toBe(fakeOESExtension); // passthrough
    expect(ctx.getSupportedExtensions()).not.toContain("WEBGL_debug_renderer_info");
    expect(ctx.getSupportedExtensions()).toContain("OES_texture_float");
    expect(ctx.getSupportedExtensions()).toContain("EXT_blend_minmax");
  });

  it("treats debug renderer parameter probes like unavailable extensions in suppression mode", () => {
    installWebGLPatch(buildSnapshot({ webGL: { suppressDebugInfo: true } }));

    const ctx = new MockWebGLContext();

    expect(ctx.getExtension("WEBGL_debug_renderer_info")).toBeNull();
    expect(ctx.getSupportedExtensions()).not.toContain("WEBGL_debug_renderer_info");
    expect(ctx.getParameter(UNMASKED_VENDOR_WEBGL)).toBeNull();
    expect(ctx.getError()).toBe(INVALID_ENUM);
    expect(ctx.getError()).toBe(0);
    expect(ctx.getParameter(UNMASKED_RENDERER_WEBGL)).toBeNull();
    expect(ctx.getError()).toBe(INVALID_ENUM);
  });

  it("preserves native WebGL error FIFO ordering before queued synthetic INVALID_ENUM", () => {
    installWebGLPatch(buildSnapshot({ webGL: { suppressDebugInfo: true } }));

    const ctx = new MockWebGLContext();
    ctx.queueError(0x0501);

    expect(ctx.getParameter(UNMASKED_VENDOR_WEBGL)).toBeNull();
    expect(ctx.getError()).toBe(0x0501);
    expect(ctx.getError()).toBe(INVALID_ENUM);
    expect(ctx.getError()).toBe(0);
  });

  it("spoofs renderer and vendor strings via getParameter", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: { renderer: "Spoofed GPU", vendor: "Spoofed Vendor" },
      }),
    );

    const ctx = new MockWebGLContext();
    expect(ctx.getParameter(UNMASKED_RENDERER_WEBGL)).toBe("Spoofed GPU");
    expect(ctx.getParameter(UNMASKED_VENDOR_WEBGL)).toBe("Spoofed Vendor");
    expect(ctx.getParameter(0x1234)).toBeNull(); // passthrough for other params
  });

  it("does not patch getExtension in string-spoofing-only mode", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: { renderer: "Spoofed GPU", vendor: "Spoofed Vendor" },
      }),
    );

    const ctx = new MockWebGLContext();
    expect(ctx.getExtension("WEBGL_debug_renderer_info")).not.toBeNull();
    expect(ctx.getSupportedExtensions()).toContain("WEBGL_debug_renderer_info");
  });

  it("keeps suppression semantics authoritative when both modes are active", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
          renderer: "Spoofed GPU",
          vendor: "Spoofed Vendor",
          readPixelsNoiseSeed: 42,
        },
      }),
    );

    const ctx = new MockWebGLContext();
    expect(ctx.getExtension("WEBGL_debug_renderer_info")).toBeNull();
    expect(ctx.getSupportedExtensions()).not.toContain("WEBGL_debug_renderer_info");
    expect(ctx.getParameter(UNMASKED_RENDERER_WEBGL)).toBeNull();
    expect(ctx.getError()).toBe(INVALID_ENUM);
    expect(ctx.getParameter(UNMASKED_VENDOR_WEBGL)).toBeNull();
    expect(ctx.getError()).toBe(INVALID_ENUM);
  });

  it("applies patches to WebGL2RenderingContext.prototype as well", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
          renderer: "Spoofed GPU2",
          vendor: "Spoofed Vendor2",
        },
      }),
    );

    const ctx2 = new MockWebGL2Context();
    expect(ctx2.getExtension("WEBGL_debug_renderer_info")).toBeNull();
    expect(ctx2.getSupportedExtensions()).not.toContain("WEBGL_debug_renderer_info");
    expect(ctx2.getParameter(UNMASKED_RENDERER_WEBGL)).toBeNull();
    expect(ctx2.getError()).toBe(INVALID_ENUM);
    expect(ctx2.getParameter(UNMASKED_VENDOR_WEBGL)).toBeNull();
    expect(ctx2.getError()).toBe(INVALID_ENUM);
  });

  it("skips patching when webGL toggle is disabled", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: { suppressDebugInfo: true },
        spoofingToggles: { webGL: false },
      }),
    );

    const ctx = new MockWebGLContext();
    expect(ctx.getExtension("WEBGL_debug_renderer_info")).not.toBeNull();
    expect(ctx.getSupportedExtensions()).toContain("WEBGL_debug_renderer_info");
    expect(ctx.getParameter(UNMASKED_RENDERER_WEBGL)).toBe("Real Renderer");
  });

  it("skips gracefully when webGL config is absent", () => {
    const snapshot = buildSnapshot();
    delete snapshot.fingerprint?.webGL;

    expect(() => installWebGLPatch(snapshot)).not.toThrow();

    const ctx = new MockWebGLContext();
    expect(ctx.getExtension("WEBGL_debug_renderer_info")).not.toBeNull();
  });

  it("perturbs successful readPixels output deterministically", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
          readPixelsNoiseSeed: 42,
        },
      }),
    );

    const baseline = new Uint8Array(16);
    fillReadPixelsView(baseline);

    const first = new Uint8Array(16);
    const second = new Uint8Array(16);
    const ctx = new MockWebGLContext();

    ctx.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, first);
    ctx.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, second);

    expect(first).toEqual(second);
    expect(first).not.toEqual(baseline);
  });

  it("perturbs a successful zero readback into an already-zero destination", () => {
    vi.stubGlobal("WebGLRenderingContext", ZeroReadbackContext);
    installWebGLPatch(buildSnapshot({ webGL: { readPixelsNoiseSeed: 42 } }));

    const pixels = new Uint8Array(16);
    new ZeroReadbackContext().readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, pixels);

    expect(pixels).not.toEqual(new Uint8Array(16));
  });

  it("preserves Float32Array element-level noise", () => {
    vi.stubGlobal("WebGLRenderingContext", FloatReadbackContext);
    installWebGLPatch(buildSnapshot({ webGL: { readPixelsNoiseSeed: 42 } }));

    const pixels = new Float32Array(16);
    new FloatReadbackContext().readPixels(0, 0, 2, 2, RGBA, FLOAT, pixels);

    const changed = pixels.filter((value) => value !== 0.5);
    expect(changed.length).toBeGreaterThan(0);
    for (const value of changed) {
      expect(Math.abs(value - 0.5)).toBeCloseTo(FLOAT_DELTA);
    }
  });

  it("noises foreign-realm typed arrays without invoking their subarray method", () => {
    installWebGLPatch(buildSnapshot({ webGL: { readPixelsNoiseSeed: 42 } }));
    const pixels = runInNewContext("new Uint8Array(16)") as Uint8Array;
    Object.defineProperty(pixels, "subarray", {
      value: () => {
        throw new Error("page-controlled subarray must not run");
      },
    });

    new MockWebGLContext().readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, pixels);

    const baseline = new Uint8Array(16);
    fillReadPixelsView(baseline);
    expect(new Uint8Array(pixels.buffer)).not.toEqual(baseline);
  });

  it("respects WebIDL-converted string dimensions and WebGL2 dstOffset", () => {
    installWebGLPatch(buildSnapshot({ webGL: { readPixelsNoiseSeed: 42 } }));
    const pixels = new Uint8Array(64).fill(0xaa);
    const context = new MockWebGL2Context();

    Reflect.apply(context.readPixels, context, [
      0,
      0,
      "2",
      "2",
      RGBA,
      UNSIGNED_BYTE,
      pixels,
      "4",
    ]);

    expect(pixels.slice(0, 4)).toEqual(new Uint8Array(4).fill(0xaa));
    expect(pixels.slice(4, 20)).not.toEqual(new Uint8Array(16).fill(0xaa));
    expect(pixels.slice(20)).toEqual(new Uint8Array(44).fill(0xaa));
  });

  it("coerces object dimensions and WebGL2 dstOffset once before native readback", () => {
    installWebGLPatch(buildSnapshot({ webGL: { readPixelsNoiseSeed: 42 } }));
    const pixels = new Uint8Array(64).fill(0xaa);
    const context = new MockWebGL2Context();
    let widthCoercions = 0;
    let offsetCoercions = 0;

    Reflect.apply(context.readPixels, context, [
      0,
      0,
      {
        valueOf: () => {
          widthCoercions += 1;
          return 2;
        },
      },
      new Number(2),
      RGBA,
      UNSIGNED_BYTE,
      pixels,
      {
        valueOf: () => {
          offsetCoercions += 1;
          return 4;
        },
      },
    ]);

    expect(widthCoercions).toBe(1);
    expect(offsetCoercions).toBe(1);
    expect(pixels.slice(0, 4)).toEqual(new Uint8Array(4).fill(0xaa));
    expect(pixels.slice(4, 20)).not.toEqual(new Uint8Array(16).fill(0xaa));
    expect(pixels.slice(20)).toEqual(new Uint8Array(44).fill(0xaa));
  });

  it("validates the readPixels receiver before object argument coercion", () => {
    installWebGLPatch(buildSnapshot({ webGL: { readPixelsNoiseSeed: 42 } }));
    let coercions = 0;

    expect(() =>
      Reflect.apply(MockWebGL2Context.prototype.readPixels, {}, [
        0,
        0,
        {
          valueOf: () => {
            coercions += 1;
            return 2;
          },
        },
        2,
        RGBA,
        UNSIGNED_BYTE,
        new Uint8Array(16),
        0,
      ]),
    ).toThrow("readPixels: Illegal invocation");
    expect(coercions).toBe(0);
  });

  it("does not noise a failed readPixels call and preserves its GL error", () => {
    vi.stubGlobal("WebGLRenderingContext", FailedReadbackContext);
    installWebGLPatch(buildSnapshot({ webGL: { readPixelsNoiseSeed: 42 } }));

    const pixels = new Uint8Array(16).fill(0xaa);
    const ctx = new FailedReadbackContext();
    ctx.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, pixels);

    expect(pixels).toEqual(new Uint8Array(16).fill(0xaa));
    expect(ctx.getError()).toBe(INVALID_OPERATION);
    expect(ctx.getError()).toBe(0);
  });

  it("leaves Emscripten heaps intact for the WebGL2 dstOffset overload", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
          readPixelsNoiseSeed: 42,
        },
      }),
    );

    const heap = new Uint8Array(1024).fill(0xaa);
    const ctx = new MockWebGL2Context();

    ctx.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, heap, 512);

    expect(heap.slice(0, 512)).toEqual(new Uint8Array(512).fill(0xaa));
    expect(heap.slice(528)).toEqual(new Uint8Array(496).fill(0xaa));
    expect(heap.slice(512, 528)).not.toEqual(new Uint8Array(16).fill(0xaa));
  });

  it("leaves oversized Emscripten heap-tail views intact", () => {
    vi.stubGlobal("WebGLRenderingContext", HeapTailWebGLContext);
    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
          readPixelsNoiseSeed: 42,
        },
      }),
    );

    const heapTail = new Uint8Array(64 * 1024).fill(0xaa);
    const ctx = new HeapTailWebGLContext();

    ctx.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, heapTail);

    expect(heapTail.slice(16)).toEqual(new Uint8Array(heapTail.length - 16).fill(0xaa));
  });

  it("leaves readPixels native until a noise seed arrives", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
        },
      }),
    );

    const ctx = new MockWebGLContext();
    expect(ctx.readPixels).toBe(originalReadPixels);
  });

  it("upgrades readPixels perturbation from later runtime state", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
        },
      }),
    );

    syncWebGLState(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
          readPixelsNoiseSeed: 42,
        },
      }),
    );

    const baseline = new Uint8Array(16);
    fillReadPixelsView(baseline);

    const pixels = new Uint8Array(16);
    const ctx = new MockWebGLContext();
    expect(ctx.readPixels).not.toBe(originalReadPixels);

    ctx.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, pixels);

    expect(pixels).not.toEqual(baseline);
  });

  it("does not rewrap WebGL prototypes when reinstalled and uses the latest seed", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
          readPixelsNoiseSeed: 42,
        },
      }),
    );

    const patchedReadPixels = MockWebGLContext.prototype.readPixels;
    const patchedGetParameter = MockWebGLContext.prototype.getParameter;
    const first = new Uint8Array(16);
    const second = new Uint8Array(16);

    new MockWebGLContext().readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, first);

    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
          readPixelsNoiseSeed: 84,
        },
      }),
    );

    expect(MockWebGLContext.prototype.readPixels).toBe(patchedReadPixels);
    expect(MockWebGLContext.prototype.getParameter).toBe(patchedGetParameter);

    new MockWebGLContext().readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, second);

    expect(second).not.toEqual(first);
  });

  it("skips readPixels perturbation when webGL toggle is disabled", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
          readPixelsNoiseSeed: 42,
        },
        spoofingToggles: { webGL: false },
      }),
    );

    const pixels = new Uint8Array(16);
    const baseline = new Uint8Array(16);
    const ctx = new MockWebGLContext();

    fillReadPixelsView(baseline);
    ctx.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, pixels);

    expect(pixels).toEqual(baseline);
  });

  it("masks patched functions with [native code] toString", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
          renderer: "Spoofed GPU",
          vendor: "Spoofed Vendor",
          readPixelsNoiseSeed: 42,
        },
      }),
    );

    expect(MockWebGLContext.prototype.getExtension.toString()).toContain(
      "[native code]",
    );
    expect(MockWebGLContext.prototype.getSupportedExtensions.toString()).toContain(
      "[native code]",
    );
    expect(MockWebGLContext.prototype.getParameter.toString()).toContain(
      "[native code]",
    );
  });

  it("preserves native-like descriptor, name, and length shape for patched WebGL methods", () => {
    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
          renderer: "Spoofed GPU",
          vendor: "Spoofed Vendor",
          readPixelsNoiseSeed: 42,
        },
      }),
    );

    const getExtensionDescriptor = Object.getOwnPropertyDescriptor(
      MockWebGLContext.prototype,
      "getExtension",
    );
    const supportedExtensionsDesc = Object.getOwnPropertyDescriptor(
      MockWebGLContext.prototype,
      "getSupportedExtensions",
    );
    const getParameterDescriptor = Object.getOwnPropertyDescriptor(
      MockWebGLContext.prototype,
      "getParameter",
    );
    const getErrorDescriptor = Object.getOwnPropertyDescriptor(
      MockWebGLContext.prototype,
      "getError",
    );
    const readPixelsDescriptor = Object.getOwnPropertyDescriptor(
      MockWebGLContext.prototype,
      "readPixels",
    );

    expect(getExtensionDescriptor).toMatchObject({
      configurable: true,
      enumerable: false,
      writable: true,
    });
    expect(supportedExtensionsDesc).toMatchObject({
      configurable: true,
      enumerable: false,
      writable: true,
    });
    expect(getParameterDescriptor).toMatchObject({
      configurable: true,
      enumerable: false,
      writable: true,
    });
    expect(getErrorDescriptor).toMatchObject({
      configurable: true,
      enumerable: false,
      writable: true,
    });
    expect(readPixelsDescriptor).toMatchObject({
      configurable: true,
      enumerable: false,
      writable: true,
    });

    expect(MockWebGLContext.prototype.getExtension.name).toBe("getExtension");
    expect(MockWebGLContext.prototype.getExtension.length).toBe(1);
    expect(MockWebGLContext.prototype.getSupportedExtensions.name).toBe(
      "getSupportedExtensions",
    );
    expect(MockWebGLContext.prototype.getSupportedExtensions.length).toBe(0);
    expect(MockWebGLContext.prototype.getParameter.name).toBe("getParameter");
    expect(MockWebGLContext.prototype.getParameter.length).toBe(1);
    expect(MockWebGLContext.prototype.getError.name).toBe("getError");
    expect(MockWebGLContext.prototype.getError.length).toBe(0);
    expect(MockWebGLContext.prototype.readPixels.name).toBe("readPixels");
    expect(MockWebGLContext.prototype.readPixels.length).toBe(7);
  });

  it("preserves native failure behavior for unrelated WebGL calls", () => {
    class ThrowingWebGLContext extends MockWebGLContext {
      override getExtension(name: string): unknown {
        if (name === "OES_texture_float") {
          throw new Error("extension boom");
        }

        return super.getExtension(name);
      }

      override getParameter(pname: number): unknown {
        if (pname === 0x1234) {
          throw new Error("parameter boom");
        }

        return super.getParameter(pname);
      }
    }

    const nativeThrowingExtension = ThrowingWebGLContext.prototype.getExtension;
    const nativeThrowingExtensions =
      ThrowingWebGLContext.prototype.getSupportedExtensions;
    const nativeThrowingParameter = ThrowingWebGLContext.prototype.getParameter;

    vi.stubGlobal("WebGLRenderingContext", ThrowingWebGLContext);

    installWebGLPatch(
      buildSnapshot({
        webGL: {
          suppressDebugInfo: true,
          renderer: "Spoofed GPU",
          vendor: "Spoofed Vendor",
        },
      }),
    );

    const ctx = new ThrowingWebGLContext();

    expect(() => ctx.getExtension("OES_texture_float")).toThrow("extension boom");
    expect(() => ctx.getParameter(0x1234)).toThrow("parameter boom");

    ThrowingWebGLContext.prototype.getExtension = nativeThrowingExtension;
    ThrowingWebGLContext.prototype.getSupportedExtensions = nativeThrowingExtensions;
    ThrowingWebGLContext.prototype.getParameter = nativeThrowingParameter;
  });

  it("preserves illegal invocation receiver checks for suppression fast paths", () => {
    installWebGLPatch(
      buildSnapshot({ webGL: { suppressDebugInfo: true, readPixelsNoiseSeed: 42 } }),
    );

    expect(() =>
      MockWebGLContext.prototype.getExtension.call({}, "WEBGL_debug_renderer_info"),
    ).toThrow("Illegal invocation");
    expect(() =>
      MockWebGLContext.prototype.getParameter.call({}, UNMASKED_VENDOR_WEBGL),
    ).toThrow("Illegal invocation");
    expect(() => MockWebGLContext.prototype.getError.call({})).toThrow(
      "Illegal invocation",
    );
    expect(() =>
      MockWebGLContext.prototype.readPixels.call(
        {},
        0,
        0,
        1,
        1,
        RGBA,
        UNSIGNED_BYTE,
        new Uint8Array(4),
      ),
    ).toThrow("Illegal invocation");
  });
});
