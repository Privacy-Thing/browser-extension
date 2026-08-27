import {
  MAX_SYNC_EXPORT_PIXELS,
  getCanvasMutationBudget,
  isImageDataTransparent,
  perturbCanvasImageData,
} from "@privacy-brand/refract-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installCanvasPatch } from "@/injection/main/canvas-patch";
import type { RuntimeSnapshot } from "@/shared/types";

const ORIGINAL_RGBA = [100, 150, 200, 255] as const;
const createdExportCanvases: MockHTMLCanvasElement[] = [];

class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: PredefinedColorSpace = "srgb";

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = 100;
      this.data[i + 1] = 150;
      this.data[i + 2] = 200;
      this.data[i + 3] = 255;
    }
  }
}

const createFilledImageData = (width: number, height: number): MockImageData =>
  new MockImageData(width, height);

const cloneImageData = (imageData: MockImageData): MockImageData => {
  const clone = new MockImageData(imageData.width, imageData.height);
  clone.data.set(imageData.data);
  return clone;
};

const cropImageData = (
  imageData: MockImageData,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): MockImageData => {
  const cropped = new MockImageData(sw, sh);
  cropped.data.fill(0);

  for (let row = 0; row < sh; row += 1) {
    for (let column = 0; column < sw; column += 1) {
      const sourceX = sx + column;
      const sourceY = sy + row;
      if (
        sourceX < 0 ||
        sourceX >= imageData.width ||
        sourceY < 0 ||
        sourceY >= imageData.height
      ) {
        continue;
      }

      const sourceOffset = (sourceY * imageData.width + sourceX) * 4;
      const targetOffset = (row * sw + column) * 4;
      cropped.data[targetOffset] = imageData.data[sourceOffset]!;
      cropped.data[targetOffset + 1] = imageData.data[sourceOffset + 1]!;
      cropped.data[targetOffset + 2] = imageData.data[sourceOffset + 2]!;
      cropped.data[targetOffset + 3] = imageData.data[sourceOffset + 3]!;
    }
  }

  return cropped;
};

const writeImageData = (
  target: MockImageData,
  imageData: MockImageData,
  dx: number,
  dy: number,
  dirtyX = 0,
  dirtyY = 0,
  dirtyWidth = imageData.width,
  dirtyHeight = imageData.height,
): void => {
  for (let row = 0; row < dirtyHeight; row += 1) {
    for (let column = 0; column < dirtyWidth; column += 1) {
      const sourceX = dirtyX + column;
      const sourceY = dirtyY + row;
      const targetX = dx + column;
      const targetY = dy + row;
      if (
        sourceX < 0 ||
        sourceX >= imageData.width ||
        sourceY < 0 ||
        sourceY >= imageData.height ||
        targetX < 0 ||
        targetX >= target.width ||
        targetY < 0 ||
        targetY >= target.height
      ) {
        continue;
      }

      const sourceOffset = (sourceY * imageData.width + sourceX) * 4;
      const targetOffset = (targetY * target.width + targetX) * 4;
      target.data[targetOffset] = imageData.data[sourceOffset]!;
      target.data[targetOffset + 1] = imageData.data[sourceOffset + 1]!;
      target.data[targetOffset + 2] = imageData.data[sourceOffset + 2]!;
      target.data[targetOffset + 3] = imageData.data[sourceOffset + 3]!;
    }
  }
};

const collectMutatedRgbOffsets = (data: Uint8ClampedArray): number[] => {
  const mutatedOffsets: number[] = [];

  for (let index = 0; index < data.length; index += 4) {
    for (let channelOffset = 0; channelOffset < 3; channelOffset += 1) {
      if (data[index + channelOffset] !== ORIGINAL_RGBA[channelOffset]) {
        mutatedOffsets.push(index + channelOffset);
      }
    }
  }

  return mutatedOffsets;
};

const collectAlphaOffsets = (data: Uint8ClampedArray): number[] => {
  const mutatedOffsets: number[] = [];

  for (let index = 3; index < data.length; index += 4) {
    if (data[index] !== ORIGINAL_RGBA[3]) {
      mutatedOffsets.push(index);
    }
  }

  return mutatedOffsets;
};

const createExpectedNoise = (
  width: number,
  height: number,
  seed: number,
): Uint8ClampedArray => {
  const imageData = createFilledImageData(width, height);
  return perturbCanvasImageData(imageData as unknown as ImageData, seed).data.slice();
};

/**
 * Minimal CanvasRenderingContext2D mock. getImageData returns a MockImageData
 * and putImageData records the last write.
 */
class MockCanvasContext2D {
  private canvas_: MockHTMLCanvasElement | null = null;
  private storedData: MockImageData | null = null;
  private failure: Error | null = null;
  private alpha = 1;
  private pathHasArea = false;
  readonly readRequests: Array<[number, number, number, number]> = [];

  get globalAlpha(): number {
    return this.alpha;
  }

  set globalAlpha(value: number) {
    this.alpha = value;
  }

  attachCanvas(canvas: MockHTMLCanvasElement): void {
    this.canvas_ = canvas;
  }

  failReadbackWith(error: Error | null): void {
    this.failure = error;
  }

  getReadbackFailure(): Error | null {
    return this.failure;
  }

  getImageData(
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    _settings?: ImageDataSettings,
  ): MockImageData {
    if (!(this instanceof MockCanvasContext2D)) {
      throw new TypeError("Illegal invocation");
    }
    if (this.failure) {
      throw this.failure;
    }

    this.readRequests.push([sx, sy, sw, sh]);

    return this.readRawImageData(sx, sy, sw, sh);
  }

  clearReadRequests(): void {
    this.readRequests.length = 0;
  }

  putImageData(
    imageData: MockImageData,
    dx: number,
    dy: number,
    dirtyX?: number,
    dirtyY?: number,
    dirtyWidth?: number,
    dirtyHeight?: number,
  ): void {
    if (!(this instanceof MockCanvasContext2D)) {
      throw new TypeError("Illegal invocation");
    }
    const next = cloneImageData(
      this.storedData ??
        createFilledImageData(
          this.canvas_?.width ?? imageData.width,
          this.canvas_?.height ?? imageData.height,
        ),
    );
    writeImageData(next, imageData, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight);
    this.storedData = next;
  }

  drawImage(source: MockHTMLCanvasElement): void {
    const sourceContext = source.getRawContextForDraw();
    this.failure = sourceContext.getReadbackFailure();
    this.storedData = sourceContext.readRawImageData(0, 0, source.width, source.height);
  }

  fillRect(_x: number, _y: number, _width: number, _height: number): void {
    if (_width === 0 || _height === 0 || this.globalAlpha === 0) {
      return;
    }
    const next = createFilledImageData(
      this.canvas_?.width ?? 1,
      this.canvas_?.height ?? 1,
    );
    for (let index = 0; index < next.data.length; index += 4) {
      next.data[index] = 25;
      next.data[index + 1] = 50;
      next.data[index + 2] = 75;
      next.data[index + 3] = 255;
    }
    this.storedData = next;
  }

  beginPath(): void {
    this.pathHasArea = false;
  }

  rect(_x: number, _y: number, width: number, height: number): void {
    if (width !== 0 && height !== 0) {
      this.pathHasArea = true;
    }
  }

  fill(): void {
    if (this.pathHasArea) {
      this.fillRect(0, 0, 1, 1);
    }
  }

  clearRect(_x: number, _y: number, width: number, height: number): void {
    if (width === 0 || height === 0) {
      return;
    }
    this.storedData = new MockImageData(
      this.canvas_?.width ?? 1,
      this.canvas_?.height ?? 1,
    );
  }

  replaceStoredData(imageData: MockImageData): void {
    this.storedData = cloneImageData(imageData);
  }

  readRawImageData(sx: number, sy: number, sw: number, sh: number): MockImageData {
    const source =
      this.storedData ??
      createFilledImageData(this.canvas_?.width ?? sw, this.canvas_?.height ?? sh);
    return cropImageData(source, sx, sy, sw, sh);
  }

  get canvas(): MockHTMLCanvasElement | null {
    return this.canvas_;
  }
}

class MockHTMLCanvasElement {
  private widthValue = 10;
  private heightValue = 10;
  private ctx: MockCanvasContext2D | null = new MockCanvasContext2D();
  private contextKind: "2d" | "webgl" | null = null;
  private readonly webglContext = {};
  private exportFailure: Error | null = null;
  exportCalls = 0;
  readonly ownerDocument = {
    createElement: (_name: string): MockHTMLCanvasElement => {
      const canvas = new MockHTMLCanvasElement();
      createdExportCanvases.push(canvas);
      return canvas;
    },
  };

  constructor() {
    this.ctx?.attachCanvas(this);
  }

  get width(): number {
    if (!(this instanceof MockHTMLCanvasElement)) {
      throw new TypeError("Invalid width receiver");
    }
    return this.widthValue;
  }

  set width(value: number) {
    if (!(this instanceof MockHTMLCanvasElement)) {
      throw new TypeError("Illegal invocation");
    }
    this.widthValue = value;
  }

  get height(): number {
    if (!(this instanceof MockHTMLCanvasElement)) {
      throw new TypeError("Illegal invocation");
    }
    return this.heightValue;
  }

  set height(value: number) {
    if (!(this instanceof MockHTMLCanvasElement)) {
      throw new TypeError("Illegal invocation");
    }
    this.heightValue = value;
  }

  setContext(context: MockCanvasContext2D | null): void {
    this.ctx = context;
    this.contextKind = context ? "2d" : null;
    this.ctx?.attachCanvas(this);
  }

  getContext(type: "2d"): MockCanvasContext2D | null;
  getContext(type: "webgl"): object | null;
  getContext(type: string): MockCanvasContext2D | object | null {
    if (type !== "2d" && type !== "webgl") {
      return null;
    }
    if (this.contextKind !== null && this.contextKind !== type) {
      return null;
    }
    this.contextKind = type;
    return type === "2d" ? this.ctx : this.webglContext;
  }

  getRawContextForDraw(): MockCanvasContext2D {
    if (!this.ctx) {
      throw new Error("Source pixel storage unavailable");
    }
    return this.ctx;
  }

  failExportWith(error: Error | null): void {
    this.exportFailure = error;
  }

  serializeRawPixels(): string {
    const imageData = this.ctx?.readRawImageData(0, 0, this.width, this.height);
    return Array.from(imageData?.data ?? []).join(",");
  }

  toDataURL(_type?: string, _quality?: unknown): string {
    if (!(this instanceof MockHTMLCanvasElement)) {
      throw new TypeError("Invalid toDataURL receiver");
    }
    this.exportCalls += 1;

    if (this.exportFailure) {
      throw this.exportFailure;
    }
    if (this.ctx?.getReadbackFailure()?.name === "SecurityError") {
      throw this.ctx.getReadbackFailure();
    }

    return `data:image/mock;base64,${this.serializeRawPixels()}`;
  }

  toBlob(callback: BlobCallback, _type?: string, _quality?: unknown): void {
    if (!(this instanceof MockHTMLCanvasElement)) {
      throw new TypeError("Invalid toBlob receiver");
    }
    this.exportCalls += 1;

    if (this.exportFailure) {
      throw this.exportFailure;
    }
    if (this.ctx?.getReadbackFailure()?.name === "SecurityError") {
      throw this.ctx.getReadbackFailure();
    }

    callback(new Blob([this.serializeRawPixels()]));
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
    canvasNoiseSeed: 42,
    ...overrides,
  },
});

describe("installCanvasPatch", () => {
  let originalGetImageData: typeof MockCanvasContext2D.prototype.getImageData;
  let originalPutImageData: typeof MockCanvasContext2D.prototype.putImageData;
  let originalToDataURL: typeof MockHTMLCanvasElement.prototype.toDataURL;
  let originalToBlob: typeof MockHTMLCanvasElement.prototype.toBlob;

  beforeEach(() => {
    createdExportCanvases.length = 0;
    originalGetImageData = MockCanvasContext2D.prototype.getImageData;
    originalPutImageData = MockCanvasContext2D.prototype.putImageData;
    originalToDataURL = MockHTMLCanvasElement.prototype.toDataURL;
    originalToBlob = MockHTMLCanvasElement.prototype.toBlob;

    vi.stubGlobal("CanvasRenderingContext2D", MockCanvasContext2D);
    vi.stubGlobal("HTMLCanvasElement", MockHTMLCanvasElement);
  });

  afterEach(() => {
    MockCanvasContext2D.prototype.getImageData =
      originalGetImageData as typeof MockCanvasContext2D.prototype.getImageData;
    MockCanvasContext2D.prototype.putImageData =
      originalPutImageData as typeof MockCanvasContext2D.prototype.putImageData;
    MockHTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    MockHTMLCanvasElement.prototype.toBlob = originalToBlob;
    vi.unstubAllGlobals();
  });

  it("uses a small deterministic RGB mutation budget and nudges each mutated pixel's alpha", () => {
    installCanvasPatch(buildSnapshot());

    const ctx = new MockCanvasContext2D();
    const width = 64;
    const height = 64;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const mutatedOffsets = collectMutatedRgbOffsets(data);
    expect(mutatedOffsets).toHaveLength(getCanvasMutationBudget(width, height));

    // Alpha of each mutated pixel is nudged too, so fully transparent canvases
    // (alpha = 0) still produce seed-dependent output instead of being discarded
    // by premultiplied alpha. The set of pixels with alpha changes must match the
    // set of pixels with RGB changes.
    const mutatedRgbPixels = new Set(
      mutatedOffsets.map((offset) => Math.floor(offset / 4)),
    );
    const mutatedAlphaPixels = new Set(
      collectAlphaOffsets(data).map((offset) => Math.floor(offset / 4)),
    );
    expect(mutatedAlphaPixels).toEqual(mutatedRgbPixels);

    // Verify perturbation is only ±1 across all channels including alpha.
    for (let i = 0; i < data.length; i += 4) {
      expect(Math.abs(data[i]! - ORIGINAL_RGBA[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(data[i + 1]! - ORIGINAL_RGBA[1])).toBeLessThanOrEqual(1);
      expect(Math.abs(data[i + 2]! - ORIGINAL_RGBA[2])).toBeLessThanOrEqual(1);
      expect(Math.abs(data[i + 3]! - ORIGINAL_RGBA[3])).toBeLessThanOrEqual(1);
    }

    expect(Array.from(data)).toEqual(
      Array.from(createExpectedNoise(width, height, 42)),
    );
  });

  it("leaves a fully transparent canvas native (skips zero-entropy blank)", () => {
    installCanvasPatch(buildSnapshot());

    const width = 16;
    const height = 16;
    const ctx = new MockCanvasContext2D();
    const transparent = new MockImageData(width, height);
    transparent.data.fill(0);
    ctx.replaceStoredData(transparent);

    // A blank/transparent canvas must read back native (all zeros) so every realm
    // — including unreachable detached frames (CreepJS's "dead" iframe) — agrees.
    // No noise is applied; noising a zero-entropy surface only creates a
    // detectable cross-realm mismatch.
    const result = ctx.getImageData(0, 0, width, height);
    expect(Array.from(result.data)).toEqual(
      Array.from(new Uint8ClampedArray(width * height * 4)),
    );
  });

  it("detects fully transparent image data", () => {
    const transparent = new MockImageData(4, 4);
    transparent.data.fill(0);
    expect(isImageDataTransparent(transparent as unknown as ImageData)).toBe(true);

    const oneOpaquePixel = new MockImageData(4, 4);
    oneOpaquePixel.data.fill(0);
    oneOpaquePixel.data[3] = 255;
    expect(isImageDataTransparent(oneOpaquePixel as unknown as ImageData)).toBe(false);
  });

  it("produces deterministic noise for the same seed", () => {
    installCanvasPatch(buildSnapshot());

    const ctx1 = new MockCanvasContext2D();
    const data1 = ctx1.getImageData(0, 0, 64, 64).data.slice();

    const ctx2 = new MockCanvasContext2D();
    const data2 = ctx2.getImageData(0, 0, 64, 64).data.slice();

    expect(data1).toEqual(data2);
  });

  it("changes the deterministic mutation plan when geometry changes", () => {
    installCanvasPatch(buildSnapshot());

    const ctx = new MockCanvasContext2D();
    const smallData = ctx.getImageData(0, 0, 32, 32).data.slice();
    const largeData = ctx.getImageData(0, 0, 64, 64).data.slice();

    expect(smallData).not.toEqual(largeData);
  });

  it("exports a perturbed copy without changing source pixels", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const before = canvas.serializeRawPixels();
    const exported = canvas.toDataURL();

    expect(canvas.serializeRawPixels()).toBe(before);
    expect(exported).not.toBe(`data:image/mock;base64,${before}`);
    expect(createdExportCanvases).toHaveLength(1);
  });

  it("uses one bounded pixel for a dirty large canvas", () => {
    MockHTMLCanvasElement.prototype.toDataURL = function (
      this: MockHTMLCanvasElement,
    ): string {
      this.exportCalls += 1;
      return "data:image/mock;base64,large";
    };
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    canvas.width = MAX_SYNC_EXPORT_PIXELS + 1;
    canvas.height = 1;
    canvas.getContext("2d")?.fillRect(0, 0, 1, 1);
    expect(canvas.toDataURL()).toBe("data:image/mock;base64,large");
    const exportContext = createdExportCanvases[0]?.getContext("2d");
    expect(exportContext?.readRequests).toEqual([[42, 0, 1, 1]]);
  });

  it("keeps a large transparent export copy fully transparent", () => {
    MockHTMLCanvasElement.prototype.toDataURL = function (
      this: MockHTMLCanvasElement,
    ): string {
      this.exportCalls += 1;
      return "data:image/mock;base64,large-blank";
    };
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    canvas.width = MAX_SYNC_EXPORT_PIXELS + 1;
    canvas.height = 1;
    const transparent = new MockImageData(canvas.width, canvas.height);
    transparent.data.fill(0);
    canvas.getRawContextForDraw().replaceStoredData(transparent);

    expect(canvas.toDataURL()).toBe("data:image/mock;base64,large-blank");
    const exportContext = createdExportCanvases[0]?.getContext("2d");
    expect(exportContext?.readRequests).toEqual([]);
    expect(Array.from(exportContext?.readRawImageData(42, 0, 1, 1).data ?? [])).toEqual(
      [0, 0, 0, 0],
    );
  });

  it("keeps a large canvas native after certain zero-area drawing no-ops", () => {
    MockHTMLCanvasElement.prototype.toDataURL = function (
      this: MockHTMLCanvasElement,
    ): string {
      this.exportCalls += 1;
      return "data:image/mock;base64,large-no-op";
    };
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    canvas.width = MAX_SYNC_EXPORT_PIXELS + 1;
    canvas.height = 1;
    const transparent = new MockImageData(canvas.width, canvas.height);
    transparent.data.fill(0);
    canvas.getRawContextForDraw().replaceStoredData(transparent);
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, 0, 0);
    context?.fillRect(0, 0, 0, 0);
    if (context) {
      context.globalAlpha = 0;
      context.fillRect(0, 0, 10, 10);
      context.globalAlpha = 1;
      context.beginPath();
      context.fill();
    }

    expect(canvas.toDataURL()).toBe("data:image/mock;base64,large-no-op");
    const exportContext = createdExportCanvases[0]?.getContext("2d");
    expect(exportContext?.readRequests).toEqual([]);
    expect(Array.from(exportContext?.readRawImageData(42, 0, 1, 1).data ?? [])).toEqual(
      [0, 0, 0, 0],
    );
  });

  it("marks a filled non-empty path dirty after an empty-path no-op", () => {
    MockHTMLCanvasElement.prototype.toDataURL = function (
      this: MockHTMLCanvasElement,
    ): string {
      this.exportCalls += 1;
      return "data:image/mock;base64,large-path";
    };
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    canvas.width = MAX_SYNC_EXPORT_PIXELS + 1;
    canvas.height = 1;
    const transparent = new MockImageData(canvas.width, canvas.height);
    transparent.data.fill(0);
    canvas.getRawContextForDraw().replaceStoredData(transparent);
    const context = canvas.getContext("2d");
    context?.beginPath();
    context?.fill();
    context?.rect(0, 0, 1, 1);
    context?.fill();

    expect(canvas.toDataURL()).toBe("data:image/mock;base64,large-path");
    expect(createdExportCanvases[0]?.getContext("2d")?.readRequests).toEqual([
      [42, 0, 1, 1],
    ]);
  });

  it("noises JPEG at a visible sparse pixel instead of a transparent seed pixel", () => {
    MockHTMLCanvasElement.prototype.toDataURL = function (
      this: MockHTMLCanvasElement,
    ): string {
      this.exportCalls += 1;
      return "data:image/mock;base64,large-sparse";
    };
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    canvas.width = MAX_SYNC_EXPORT_PIXELS + 1;
    canvas.height = 1;
    canvas.getContext("2d")?.fillRect(0, 0, 1, 1);
    const sparse = new MockImageData(canvas.width, canvas.height);
    sparse.data.fill(0);
    sparse.data[MAX_SYNC_EXPORT_PIXELS * 4 + 3] = 255;
    canvas.getRawContextForDraw().replaceStoredData(sparse);

    expect(canvas.toDataURL("image/jpeg")).toBe("data:image/mock;base64,large-sparse");
    const exportContext = createdExportCanvases[0]?.getContext("2d");
    expect(exportContext?.readRequests).toEqual([[42, 0, 1, 1]]);
    expect(Array.from(exportContext?.readRawImageData(42, 0, 1, 1).data ?? [])).toEqual(
      [16, 16, 16, 255],
    );
  });

  it("exports a perturbed Blob copy without changing source pixels", async () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const before = canvas.serializeRawPixels();
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!)),
    );

    expect(canvas.serializeRawPixels()).toBe(before);
    expect(await blob.text()).not.toBe(before);
  });

  it("keeps repeated non-destructive exports stable", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const result1 = canvas.toDataURL();
    const result2 = canvas.toDataURL();

    expect(result1).toBe(result2);
    expect(createdExportCanvases).toHaveLength(2);
  });

  it("does not lock an untouched source canvas to a 2D context during export", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    canvas.toDataURL();

    expect(canvas.getContext("webgl")).not.toBeNull();
  });

  it("copies and noises an existing WebGL canvas without changing its source pixels", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    canvas.getRawContextForDraw().fillRect(0, 0, canvas.width, canvas.height);
    expect(canvas.getContext("webgl")).not.toBeNull();
    const before = canvas.serializeRawPixels();

    const exported = canvas.toDataURL();

    expect(exported).not.toBe(`data:image/mock;base64,${before}`);
    expect(canvas.serializeRawPixels()).toBe(before);
  });

  it("does not stack canvas exports when reinstalled and uses the latest seed", () => {
    installCanvasPatch(buildSnapshot({ canvasNoiseSeed: 42 }));

    const patchedToDataURL = MockHTMLCanvasElement.prototype.toDataURL;
    const firstCanvas = new MockHTMLCanvasElement();
    const firstExpected = `data:image/mock;base64,${Array.from(
      createExpectedNoise(firstCanvas.width, firstCanvas.height, 42),
    ).join(",")}`;

    expect(firstCanvas.toDataURL()).toBe(firstExpected);

    installCanvasPatch(buildSnapshot({ canvasNoiseSeed: 84 }));

    expect(MockHTMLCanvasElement.prototype.toDataURL).toBe(patchedToDataURL);

    const secondCanvas = new MockHTMLCanvasElement();
    const secondExpected = `data:image/mock;base64,${Array.from(
      createExpectedNoise(secondCanvas.width, secondCanvas.height, 84),
    ).join(",")}`;

    expect(secondCanvas.toDataURL()).toBe(secondExpected);
    expect(secondCanvas.toDataURL()).not.toBe(firstExpected);
  });

  it("keeps export bytes aligned with a noisy readback while leaving raw pixels native", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const exported = canvas.toDataURL();
    const ctx = canvas.getContext("2d");

    expect(ctx).not.toBeNull();
    if (!ctx) {
      throw new Error("Expected 2D context");
    }

    const readback = Array.from(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    ).join(",");

    expect(exported).toBe(`data:image/mock;base64,${readback}`);
    expect(canvas.serializeRawPixels()).not.toBe(readback);
  });

  it("preserves fresh self-write parity before any export seeds a canvas cache", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const ctx = canvas.getContext("2d");

    expect(ctx).not.toBeNull();
    if (!ctx) {
      throw new Error("Expected 2D context");
    }

    const firstReadback = ctx.getImageData(2, 3, 4, 5);
    ctx.putImageData(firstReadback, 2, 3);
    ctx.clearReadRequests();

    const secondReadback = ctx.getImageData(2, 3, 4, 5);
    const rawSubRect = ctx.readRawImageData(2, 3, 4, 5);

    expect(Array.from(secondReadback.data)).toEqual(Array.from(firstReadback.data));
    expect(Array.from(secondReadback.data)).toEqual(Array.from(rawSubRect.data));
    expect(ctx.readRequests).toEqual([[2, 3, 4, 5]]);
  });

  it("keeps parent round-trip metadata valid while another realm is installed", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const ctx = canvas.getContext("2d");
    expect(ctx).not.toBeNull();
    if (!ctx) {
      throw new Error("Expected 2D context");
    }
    const firstReadback = ctx.getImageData(2, 3, 4, 5);

    class ChildCanvasContext2D extends MockCanvasContext2D {}
    class ChildHTMLCanvasElement extends MockHTMLCanvasElement {}
    installCanvasPatch(buildSnapshot(), {
      CanvasRenderingContext2D: ChildCanvasContext2D,
      HTMLCanvasElement: ChildHTMLCanvasElement,
    } as unknown as typeof globalThis);

    ctx.putImageData(firstReadback, 2, 3);
    const secondReadback = ctx.getImageData(2, 3, 4, 5);
    expect(Array.from(secondReadback.data)).toEqual(Array.from(firstReadback.data));
  });

  it("preserves fresh self-write parity for edge-overlapping rects before any export seeds a canvas cache", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const ctx = canvas.getContext("2d");

    expect(ctx).not.toBeNull();
    if (!ctx) {
      throw new Error("Expected 2D context");
    }

    const firstReadback = ctx.getImageData(-2, -1, 6, 5);
    ctx.putImageData(firstReadback, -2, -1);
    ctx.clearReadRequests();

    const secondReadback = ctx.getImageData(-2, -1, 6, 5);
    const rawSubRect = ctx.readRawImageData(-2, -1, 6, 5);

    expect(Array.from(secondReadback.data)).toEqual(Array.from(firstReadback.data));
    expect(Array.from(secondReadback.data)).toEqual(Array.from(rawSubRect.data));
    expect(ctx.readRequests).toEqual([[-2, -1, 6, 5]]);
  });

  it("does not cache a fully out-of-bounds fresh self-write rect", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const ctx = canvas.getContext("2d");

    expect(ctx).not.toBeNull();
    if (!ctx) {
      throw new Error("Expected 2D context");
    }

    const firstReadback = ctx.getImageData(-100, -100, 10, 10);
    ctx.putImageData(firstReadback, -100, -100);
    ctx.clearReadRequests();

    const secondReadback = ctx.getImageData(-100, -100, 10, 10);
    const rawSubRect = ctx.readRawImageData(-100, -100, 10, 10);

    // A fully out-of-bounds rect is all-transparent (zero entropy), so it is left
    // native (not perturbed, not cached) — each read hits the native readback.
    expect(Array.from(secondReadback.data)).toEqual(Array.from(firstReadback.data));
    expect(Array.from(secondReadback.data)).toEqual(Array.from(rawSubRect.data));
    expect(ctx.readRequests).toEqual([[-100, -100, 10, 10]]);
  });

  it("preserves multiple fresh self-written rects on the same canvas before export", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const ctx = canvas.getContext("2d");

    expect(ctx).not.toBeNull();
    if (!ctx) {
      throw new Error("Expected 2D context");
    }

    const firstRectReadback = ctx.getImageData(2, 3, 4, 5);
    ctx.putImageData(firstRectReadback, 2, 3);

    const secondRectReadback = ctx.getImageData(0, 0, 2, 2);
    ctx.putImageData(secondRectReadback, 0, 0);

    ctx.clearReadRequests();

    const rereadFirstRect = ctx.getImageData(2, 3, 4, 5);
    const rawFirstRect = ctx.readRawImageData(2, 3, 4, 5);

    expect(Array.from(rereadFirstRect.data)).toEqual(
      Array.from(firstRectReadback.data),
    );
    expect(Array.from(rereadFirstRect.data)).toEqual(Array.from(rawFirstRect.data));
    expect(ctx.readRequests).toEqual([[2, 3, 4, 5]]);
  });

  it("invalidates an older overlapping fresh self-written rect when a newer overlapping rect is promoted", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const ctx = canvas.getContext("2d");

    expect(ctx).not.toBeNull();
    if (!ctx) {
      throw new Error("Expected 2D context");
    }

    const firstRectReadback = ctx.getImageData(2, 3, 4, 5);
    ctx.putImageData(firstRectReadback, 2, 3);

    const overlappingRectReadback = ctx.getImageData(4, 5, 4, 5);
    ctx.putImageData(overlappingRectReadback, 4, 5);

    ctx.clearReadRequests();

    const rawFirstRect = ctx.readRawImageData(2, 3, 4, 5);
    const rereadFirstRect = ctx.getImageData(2, 3, 4, 5);

    expect(Array.from(rereadFirstRect.data)).not.toEqual(Array.from(rawFirstRect.data));
    expect(Array.from(rereadFirstRect.data)).not.toEqual(
      Array.from(firstRectReadback.data),
    );
    expect(ctx.readRequests).toEqual([[2, 3, 4, 5]]);
  });

  it("exports the current redraw without retaining stale copy state", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const ctx = canvas.getContext("2d");

    expect(ctx).not.toBeNull();
    if (!ctx) {
      throw new Error("Expected 2D context");
    }

    const firstExport = canvas.toDataURL();

    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const rawAfterRedraw = canvas.serializeRawPixels();

    const secondExport = canvas.toDataURL();
    expect(secondExport).not.toBe(firstExport);
    expect(secondExport).not.toBe(`data:image/mock;base64,${rawAfterRedraw}`);
  });

  it("leaves zero-size canvases on native export/readback semantics", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    canvas.width = 0;
    canvas.height = 0;

    expect(canvas.toDataURL()).toBe("data:image/mock;base64,");
    expect(() => canvas.toBlob(() => {})).not.toThrow();
  });

  it("preserves native SecurityError semantics for a tainted source", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const ctx = canvas.getContext("2d");
    const readbackError = new DOMException(
      "The canvas has been tainted",
      "SecurityError",
    );
    ctx?.failReadbackWith(readbackError);

    expect(() => canvas.toDataURL()).toThrow(readbackError);
    expect(canvas.serializeRawPixels()).toBe(
      createFilledImageData(canvas.width, canvas.height).data.join(","),
    );
  });

  it("skips perturbation when 2D context is unavailable", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    canvas.setContext(null);

    expect(canvas.toDataURL()).toBe("data:image/mock;base64,");
    expect(() => canvas.toBlob(() => {})).not.toThrow();
  });

  it("retries perturbation after a recoverable readback failure", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const ctx = canvas.getContext("2d");
    ctx?.failReadbackWith(
      new DOMException("Origin-clean check failed", "SecurityError"),
    );

    expect(() => canvas.toDataURL()).toThrowError("Origin-clean check failed");

    ctx?.failReadbackWith(null);

    expect(() => canvas.toDataURL()).not.toThrow();

    const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData?.data;
    expect(data).toBeDefined();
    expect(data ? collectMutatedRgbOffsets(data).length : 0).toBe(
      getCanvasMutationBudget(10, 10),
    );
  });

  it("preserves the native three-argument putImageData overload during export", () => {
    MockCanvasContext2D.prototype.putImageData = function (
      this: MockCanvasContext2D,
      imageData: MockImageData,
      dx: number,
      dy: number,
      dirtyX?: number,
      dirtyY?: number,
      dirtyWidth?: number,
      dirtyHeight?: number,
    ): void {
      if (
        arguments.length === 7 &&
        (dirtyX === undefined ||
          dirtyY === undefined ||
          dirtyWidth === undefined ||
          dirtyHeight === undefined)
      ) {
        throw new TypeError("strict overload");
      }

      return originalPutImageData.call(
        this,
        imageData,
        dx,
        dy,
        dirtyX,
        dirtyY,
        dirtyWidth,
        dirtyHeight,
      );
    };

    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();

    expect(() => canvas.toDataURL()).not.toThrow();
  });

  it("preserves explicit seven-argument putImageData overload semantics", () => {
    MockCanvasContext2D.prototype.putImageData = function (
      this: MockCanvasContext2D,
      imageData: MockImageData,
      dx: number,
      dy: number,
      dirtyX?: number,
      dirtyY?: number,
      dirtyWidth?: number,
      dirtyHeight?: number,
    ): void {
      if (
        arguments.length === 7 &&
        (dirtyX === undefined ||
          dirtyY === undefined ||
          dirtyWidth === undefined ||
          dirtyHeight === undefined)
      ) {
        throw new TypeError("strict overload");
      }

      return originalPutImageData.call(
        this,
        imageData,
        dx,
        dy,
        dirtyX,
        dirtyY,
        dirtyWidth,
        dirtyHeight,
      );
    };

    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Expected 2D canvas context");
    }
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    expect(() =>
      ctx.putImageData(imageData, 0, 0, undefined, undefined, undefined, undefined),
    ).toThrow("strict overload");
  });

  it("falls back to the native source export after an unexpected copy readback failure", () => {
    installCanvasPatch(buildSnapshot());

    const canvas = new MockHTMLCanvasElement();
    const ctx = canvas.getContext("2d");
    ctx?.failReadbackWith(new Error("boom"));

    expect(canvas.toDataURL()).toBe(
      `data:image/mock;base64,${canvas.serializeRawPixels()}`,
    );
  });

  it("skips patching when canvas toggle is disabled", () => {
    installCanvasPatch(
      buildSnapshot({
        canvasNoiseSeed: 42,
        spoofingToggles: { canvas: false },
      }),
    );

    const ctx = new MockCanvasContext2D();
    const imageData = ctx.getImageData(0, 0, 10, 10);
    const data = imageData.data;

    expect(Array.from(data)).toEqual(Array.from(createFilledImageData(10, 10).data));
  });

  it("skips gracefully when canvasNoiseSeed is absent", () => {
    const snapshot = buildSnapshot();
    delete snapshot.fingerprint?.canvasNoiseSeed;

    expect(installCanvasPatch(snapshot)).toEqual({
      htmlCanvas: false,
      context2D: false,
      offscreenCanvas: false,
      offscreenContext2D: false,
    });

    const ctx = new MockCanvasContext2D();
    const data = ctx.getImageData(0, 0, 10, 10).data;
    expect(data[0]).toBe(100);
  });

  it("masks patched functions with [native code] toString", () => {
    installCanvasPatch(buildSnapshot());

    expect(MockCanvasContext2D.prototype.getImageData.toString()).toContain(
      "[native code]",
    );
    expect(MockHTMLCanvasElement.prototype.toDataURL.toString()).toContain(
      "[native code]",
    );
    expect(MockHTMLCanvasElement.prototype.toBlob.toString()).toContain(
      "[native code]",
    );
  });

  it("repairs the complete Canvas anchor set after one method is removed", () => {
    installCanvasPatch(buildSnapshot());
    const installed = {
      getImageData: MockCanvasContext2D.prototype.getImageData,
      toBlob: MockHTMLCanvasElement.prototype.toBlob,
      toDataURL: MockHTMLCanvasElement.prototype.toDataURL,
    };

    Object.defineProperty(MockHTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: originalToDataURL,
    });
    installCanvasPatch(buildSnapshot());

    expect(MockCanvasContext2D.prototype.getImageData).toBe(installed.getImageData);
    expect(MockHTMLCanvasElement.prototype.toDataURL).toBe(installed.toDataURL);
    expect(MockHTMLCanvasElement.prototype.toBlob).toBe(installed.toBlob);
  });

  it("treats replacement of all three Canvas anchors as tampering when prototypes are unchanged", () => {
    installCanvasPatch(buildSnapshot());
    const installed = {
      getImageData: MockCanvasContext2D.prototype.getImageData,
      toBlob: MockHTMLCanvasElement.prototype.toBlob,
      toDataURL: MockHTMLCanvasElement.prototype.toDataURL,
    };
    const sentinelToDataURL = () => "data:,parent-poison";
    Object.defineProperty(MockCanvasContext2D.prototype, "getImageData", {
      configurable: true,
      writable: true,
      value: originalGetImageData,
    });
    Object.defineProperty(MockHTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: sentinelToDataURL,
    });
    Object.defineProperty(MockHTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      writable: true,
      value: originalToBlob,
    });

    installCanvasPatch(buildSnapshot());

    expect(MockCanvasContext2D.prototype.getImageData).toBe(installed.getImageData);
    expect(MockHTMLCanvasElement.prototype.toDataURL).toBe(installed.toDataURL);
    expect(MockHTMLCanvasElement.prototype.toBlob).toBe(installed.toBlob);

    const canvas = new MockHTMLCanvasElement();
    const expected = `data:image/mock;base64,${Array.from(
      createExpectedNoise(canvas.width, canvas.height, 42),
    ).join(",")}`;
    expect(canvas.toDataURL()).toBe(expected);
    expect(canvas.toDataURL()).not.toBe("data:,parent-poison");
  });

  it("does not adopt a non-configurable Canvas sentinel as a new native baseline", () => {
    class IsolatedCanvas {
      toDataURL(): string {
        return "data:,isolated-native";
      }

      toBlob(callback: BlobCallback): void {
        callback(new Blob());
      }
    }

    class IsolatedContext {
      getImageData(): ImageData {
        return {
          data: new Uint8ClampedArray(4),
          width: 1,
          height: 1,
          colorSpace: "srgb",
        } as ImageData;
      }
    }

    const isolatedGetImageData = IsolatedContext.prototype.getImageData;
    const isolatedToBlob = IsolatedCanvas.prototype.toBlob;
    const isolatedGlobal = {
      HTMLCanvasElement: IsolatedCanvas,
      CanvasRenderingContext2D: IsolatedContext,
    } as unknown as typeof globalThis;

    installCanvasPatch(buildSnapshot(), isolatedGlobal);
    const installed = {
      getImageData: IsolatedContext.prototype.getImageData,
      toBlob: IsolatedCanvas.prototype.toBlob,
      toDataURL: IsolatedCanvas.prototype.toDataURL,
    };
    const sentinelToDataURL = () => "data:,parent-poison";
    Object.defineProperty(IsolatedCanvas.prototype, "toDataURL", {
      configurable: false,
      writable: true,
      value: sentinelToDataURL,
    });
    Object.defineProperty(IsolatedContext.prototype, "getImageData", {
      configurable: true,
      writable: true,
      value: isolatedGetImageData,
    });
    Object.defineProperty(IsolatedCanvas.prototype, "toBlob", {
      configurable: true,
      writable: true,
      value: isolatedToBlob,
    });

    installCanvasPatch(buildSnapshot(), isolatedGlobal);

    expect(IsolatedContext.prototype.getImageData).toBe(installed.getImageData);
    expect(IsolatedCanvas.prototype.toBlob).toBe(installed.toBlob);
    expect(IsolatedCanvas.prototype.toDataURL).toBe(sentinelToDataURL);
    expect(MockHTMLCanvasElement.prototype.toDataURL).toBe(originalToDataURL);
  });

  it("does not expose its installation registry through poisoned WeakMap methods", () => {
    installCanvasPatch(buildSnapshot());
    const nativeGet = WeakMap.prototype.get;
    const nativeSet = WeakMap.prototype.set;
    const nativeDelete = WeakMap.prototype.delete;
    const observed: unknown[] = [];
    WeakMap.prototype.get = function (key: object) {
      observed.push(this, key);
      return Reflect.apply(nativeGet, this, [key]);
    };
    WeakMap.prototype.set = function (key: object, value: unknown) {
      observed.push(this, key, value);
      return Reflect.apply(nativeSet, this, [key, value]);
    };
    WeakMap.prototype.delete = function (key: object) {
      observed.push(this, key);
      return Reflect.apply(nativeDelete, this, [key]);
    };

    try {
      Object.defineProperties(MockCanvasContext2D.prototype, {
        getImageData: {
          configurable: true,
          writable: true,
          value: originalGetImageData,
        },
      });
      Object.defineProperties(MockHTMLCanvasElement.prototype, {
        toDataURL: { configurable: true, writable: true, value: originalToDataURL },
        toBlob: { configurable: true, writable: true, value: originalToBlob },
      });
      installCanvasPatch(buildSnapshot());
    } finally {
      WeakMap.prototype.get = nativeGet;
      WeakMap.prototype.set = nativeSet;
      WeakMap.prototype.delete = nativeDelete;
    }

    expect(observed).toEqual([]);
  });

  it("preserves native-like descriptor, name, and length shape for patched canvas methods", () => {
    installCanvasPatch(buildSnapshot());

    const getImageDataDescriptor = Object.getOwnPropertyDescriptor(
      MockCanvasContext2D.prototype,
      "getImageData",
    );
    const toDataURLDescriptor = Object.getOwnPropertyDescriptor(
      MockHTMLCanvasElement.prototype,
      "toDataURL",
    );
    const toBlobDescriptor = Object.getOwnPropertyDescriptor(
      MockHTMLCanvasElement.prototype,
      "toBlob",
    );

    expect(getImageDataDescriptor).toMatchObject({
      configurable: true,
      enumerable: false,
      writable: true,
    });
    expect(toDataURLDescriptor).toMatchObject({
      configurable: true,
      enumerable: false,
      writable: true,
    });
    expect(toBlobDescriptor).toMatchObject({
      configurable: true,
      enumerable: false,
      writable: true,
    });

    expect(MockCanvasContext2D.prototype.getImageData.name).toBe("getImageData");
    expect(MockCanvasContext2D.prototype.getImageData.length).toBe(4);
    expect(MockHTMLCanvasElement.prototype.toDataURL.name).toBe("toDataURL");
    expect(MockHTMLCanvasElement.prototype.toDataURL.length).toBe(0);
    expect(MockHTMLCanvasElement.prototype.toBlob.name).toBe("toBlob");
    expect(MockHTMLCanvasElement.prototype.toBlob.length).toBe(1);
  });

  it("preserves native receiver validation before inspecting forged canvas values", () => {
    installCanvasPatch(buildSnapshot());

    let inspected = false;
    const forgedCanvas = {
      get ownerDocument() {
        inspected = true;
        return new MockHTMLCanvasElement().ownerDocument;
      },
      get width() {
        inspected = true;
        return 10;
      },
      get height() {
        inspected = true;
        return 10;
      },
    };
    const forgedContext = {};
    const imageData = createFilledImageData(1, 1);

    expect(() =>
      Reflect.apply(
        MockCanvasContext2D.prototype.getImageData,
        forgedContext,
        [0, 0, 1, 1],
      ),
    ).toThrowError(new TypeError("Illegal invocation"));
    expect(() =>
      Reflect.apply(MockCanvasContext2D.prototype.putImageData, forgedContext, [
        imageData,
        0,
        0,
      ]),
    ).toThrowError(new TypeError("Illegal invocation"));
    expect(() =>
      Reflect.apply(MockHTMLCanvasElement.prototype.toDataURL, forgedCanvas, []),
    ).toThrowError(new TypeError("Invalid toDataURL receiver"));
    expect(() =>
      Reflect.apply(MockHTMLCanvasElement.prototype.toBlob, forgedCanvas, [vi.fn()]),
    ).toThrowError(new TypeError("Invalid toBlob receiver"));
    expect(inspected).toBe(false);
  });
});
