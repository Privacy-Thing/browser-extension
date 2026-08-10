import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";

import { createWorkerSource } from "@privacy-brand/refract-browser/common/worker-bootstrap";
import { WORKER_WEBGL_SOURCE } from "@privacy-brand/refract-browser/common/worker-webgl-inline";
import {
  getCanvasMutationBudget,
  getCanvasRgbaOffsets,
  perturbCanvasImageData,
} from "@privacy-brand/refract-core";
import type { RuntimeSnapshot } from "@privacy-brand/refract-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getTimeZoneOffsetMinutes } from "@/shared/time-zone-offset";

const ORIGINAL_RGBA = [100, 150, 200, 255] as const;
const ORIGINAL_DATE = globalThis.Date;
const NATIVE_DATE_DESCRIPTORS = Object.getOwnPropertyDescriptors(
  ORIGINAL_DATE.prototype,
);
const NATIVE_DATE_TIME_FORMAT = Intl.DateTimeFormat;
const NATIVE_RESOLVED_DESC = Object.getOwnPropertyDescriptor(
  NATIVE_DATE_TIME_FORMAT.prototype,
  "resolvedOptions",
);
const NATIVE_OBJECT_DESCS = {
  language: Object.getOwnPropertyDescriptor(Object.prototype, "language"),
  languages: Object.getOwnPropertyDescriptor(Object.prototype, "languages"),
} as const;
const UNMASKED_VENDOR_WEBGL = 0x9245;
const UNMASKED_RENDERER_WEBGL = 0x9246;
const INVALID_ENUM = 0x0500;
const RGBA = 0x1908;
const UNSIGNED_BYTE = 0x1401;
const FLOAT = 0x1406;
const INVALID_OPERATION = 0x0502;
const FLOAT_DELTA = 1 / 65_536;

const fillReadPixelsView = (pixels: ArrayBufferView): void => {
  const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index * 17 + 23) & 0xff;
  }
};

const snapshot: RuntimeSnapshot = {
  geo: {
    latitude: 52.2297,
    longitude: 21.0122,
    accuracy: 25,
    noiseRadius: 50,
  },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl",
  },
  date: {
    baseEpochMs: 1,
    offsetMs: 3_600_000,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [60, 500],
};

const readMockExportPayload = async (blob: Blob): Promise<string> => blob.text();

const hashWorkerSource = (source: string): string =>
  createHash("sha256").update(source).digest("hex");

type OffscreenContextLike = {
  canvas: MockOffscreenCanvas;
  readRawImageData(sx: number, sy: number, sw: number, sh: number): MockImageData;
  getImageData(
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    settings?: ImageDataSettings,
  ): MockImageData;
  drawImage(source: MockOffscreenCanvas, dx: number, dy: number): void;
  putImageData(imageData: MockImageData, dx: number, dy: number): void;
};

class MockImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);

    for (let index = 0; index < this.data.length; index += 4) {
      this.data[index] = 100;
      this.data[index + 1] = 150;
      this.data[index + 2] = 200;
      this.data[index + 3] = 255;
    }
  }
}

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

const createCanvasNoise = (
  width: number,
  height: number,
  seed: number,
): Uint8ClampedArray => {
  const imageData = new MockImageData(width, height);
  return perturbCanvasImageData(imageData as unknown as ImageData, seed).data.slice();
};

const findUntrackedPixel = (
  width: number,
  height: number,
  seed: number,
): [number, number] => {
  const trackedPixels = new Set(
    getCanvasRgbaOffsets(width, height, seed).map((rgbaOffset) =>
      Math.floor(rgbaOffset / 4),
    ),
  );

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    if (!trackedPixels.has(pixelIndex)) {
      return [pixelIndex % width, Math.floor(pixelIndex / width)];
    }
  }

  throw new Error("Expected at least one untracked pixel");
};

class MockOffscreenContext implements OffscreenContextLike {
  canvas: MockOffscreenCanvas;
  private storedData: MockImageData | null = null;
  private failure: Error | null = null;
  private alpha = 1;
  private pathHasArea = false;
  readonly readRequests: Array<[number, number, number, number]> = [];

  constructor(canvas: MockOffscreenCanvas) {
    this.canvas = canvas;
  }

  get globalAlpha(): number {
    return this.alpha;
  }

  set globalAlpha(value: number) {
    this.alpha = value;
  }

  failReadbackWith(error: Error | null): void {
    this.failure = error;
  }

  getImageData(
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    _settings?: ImageDataSettings,
  ): MockImageData {
    if (this.failure) {
      throw this.failure;
    }

    this.readRequests.push([sx, sy, sw, sh]);

    return this.readRawImageData(sx, sy, sw, sh);
  }

  clearReadRequests(): void {
    this.readRequests.length = 0;
  }

  readRawImageData(sx: number, sy: number, sw: number, sh: number): MockImageData {
    const source =
      this.storedData ?? new MockImageData(this.canvas.width, this.canvas.height);
    return cropImageData(source, sx, sy, sw, sh);
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
    const next = cloneImageData(
      this.storedData ?? new MockImageData(this.canvas.width, this.canvas.height),
    );
    writeImageData(next, imageData, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight);
    this.storedData = next;
  }

  drawImage(source: MockOffscreenCanvas, _dx: number, _dy: number): void {
    const sourceContext = source.getContext("2d");
    if (sourceContext) {
      this.storedData = sourceContext.readRawImageData(
        0,
        0,
        source.width,
        source.height,
      );
    }
  }

  fillRect(_x: number, _y: number, _width: number, _height: number): void {
    if (_width === 0 || _height === 0 || this.globalAlpha === 0) {
      return;
    }
    const next = new MockImageData(this.canvas.width, this.canvas.height);
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

  replaceStoredData(imageData: MockImageData): void {
    this.storedData = cloneImageData(imageData);
  }

  serializeRawPixels(): string {
    return Array.from(
      this.storedData?.data ??
        new MockImageData(this.canvas.width, this.canvas.height).data,
    ).join(",");
  }
}

class MockOffscreenCanvas {
  width: number;
  height: number;
  private readonly ctx: MockOffscreenContext;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ctx = new MockOffscreenContext(this);
  }

  getContext(type: string): MockOffscreenContext | null {
    return type === "2d" ? this.ctx : null;
  }

  async convertToBlob(): Promise<Blob> {
    return new Blob([this.ctx.serializeRawPixels()]);
  }
}

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

    return { name };
  }

  getSupportedExtensions(): string[] {
    if (!(this instanceof MockWebGLContext)) {
      throw new TypeError("getSupportedExtensions: Illegal invocation");
    }
    return ["OES_texture_float", "WEBGL_debug_renderer_info"];
  }

  getParameter(pname: number): unknown {
    if (!(this instanceof MockWebGLContext)) {
      throw new TypeError("Illegal invocation");
    }
    if (pname === UNMASKED_RENDERER_WEBGL) {
      return "Real Worker Renderer";
    }

    if (pname === UNMASKED_VENDOR_WEBGL) {
      return "Real Worker Vendor";
    }

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

class MockZeroReadbackContext extends MockWebGLContext {
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

class MockFailedContext extends MockWebGLContext {
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

class MockFloatReadbackContext extends MockWebGLContext {
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

const installWorkerInTest = (workerSnapshot: RuntimeSnapshot): void => {
  const source = createWorkerSource({
    snapshot: workerSnapshot,
    workerUrl: "https://example.com/worker.js",
    workerType: "classic",
  });
  // Strip the worker script import section (try/catch+XHR fallback or plain importScripts).
  const tryStart = source.lastIndexOf("\n  try {\n  importScripts(");
  const plainStart = source.lastIndexOf(
    '\n  importScripts("https://example.com/worker.js");',
  );
  const cutAt = tryStart >= 0 ? tryStart : plainStart;
  const bootstrapOnlySource =
    cutAt >= 0 ? source.slice(0, cutAt) + "\n})();\n" : source;
  const runner = new Function(bootstrapOnlySource);
  runner();
};

type WorkerTestGlobal = typeof globalThis & {
  self?: typeof globalThis;
  importScripts?: (...urls: string[]) => void;
  OffscreenCanvas?: typeof MockOffscreenCanvas;
  OffscreenCanvasRenderingContext2D?: typeof MockOffscreenContext;
  WebGLRenderingContext?: typeof MockWebGLContext;
  navigator?: Navigator;
};

type WorkerTestGlobalKey =
  | "self"
  | "navigator"
  | "importScripts"
  | "OffscreenCanvas"
  | "OffscreenCanvasRenderingContext2D"
  | "WebGLRenderingContext";

type WorkerGlobalOverrides = Partial<{
  self: typeof globalThis;
  navigator: Navigator | Record<string, never>;
  importScripts: (...urls: string[]) => void;
  OffscreenCanvas: typeof MockOffscreenCanvas;
  OffscreenCanvasRenderingContext2D: typeof MockOffscreenContext;
  WebGLRenderingContext: typeof MockWebGLContext;
}>;

const WORKER_GLOBAL_KEYS: WorkerTestGlobalKey[] = [
  "self",
  "navigator",
  "importScripts",
  "OffscreenCanvas",
  "OffscreenCanvasRenderingContext2D",
  "WebGLRenderingContext",
];

const restoreDateIntlGlobals = (): void => {
  Object.defineProperty(globalThis, "Date", {
    configurable: true,
    value: ORIGINAL_DATE,
  });
  for (const [key, descriptor] of Object.entries(NATIVE_DATE_DESCRIPTORS)) {
    if (descriptor) {
      Object.defineProperty(ORIGINAL_DATE.prototype, key, descriptor);
    }
  }

  Object.defineProperty(Intl, "DateTimeFormat", {
    configurable: true,
    value: NATIVE_DATE_TIME_FORMAT,
  });
  if (NATIVE_RESOLVED_DESC) {
    Object.defineProperty(
      NATIVE_DATE_TIME_FORMAT.prototype,
      "resolvedOptions",
      NATIVE_RESOLVED_DESC,
    );
  }

  for (const [key, descriptor] of Object.entries(NATIVE_OBJECT_DESCS)) {
    if (descriptor) {
      Object.defineProperty(Object.prototype, key, descriptor);
    } else {
      Reflect.deleteProperty(Object.prototype, key);
    }
  }
};

const restoreWorkerGlobal = (
  testGlobal: WorkerTestGlobal,
  key: WorkerTestGlobalKey,
  originalValue: WorkerTestGlobal[WorkerTestGlobalKey],
): void => {
  if (originalValue === undefined) {
    delete testGlobal[key];
    return;
  }

  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: key === "importScripts",
    value: originalValue,
  });
};

const withWorkerTestGlobals = async (
  overrides: WorkerGlobalOverrides,
  run: () => void | Promise<void>,
): Promise<void> => {
  const testGlobal = globalThis as WorkerTestGlobal;
  const originals = Object.fromEntries(
    WORKER_GLOBAL_KEYS.map((key) => [key, testGlobal[key]]),
  ) as Record<WorkerTestGlobalKey, WorkerTestGlobal[WorkerTestGlobalKey]>;

  try {
    Object.defineProperty(globalThis, "self", {
      configurable: true,
      value: overrides.self ?? globalThis,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: overrides.navigator ?? {},
    });
    Object.defineProperty(globalThis, "importScripts", {
      configurable: true,
      writable: true,
      value: overrides.importScripts ?? (() => {}),
    });

    for (const key of WORKER_GLOBAL_KEYS) {
      if (
        key === "self" ||
        key === "navigator" ||
        key === "importScripts" ||
        !(key in overrides)
      ) {
        continue;
      }

      Object.defineProperty(globalThis, key, {
        configurable: true,
        value: overrides[key],
      });
    }

    await run();
  } finally {
    restoreDateIntlGlobals();
    for (const key of WORKER_GLOBAL_KEYS) {
      restoreWorkerGlobal(testGlobal, key, originals[key]);
    }
  }
};

describe("createWorkerSource", () => {
  let originalGetImageData: typeof MockOffscreenContext.prototype.getImageData;
  let originalPutImageData: typeof MockOffscreenContext.prototype.putImageData;
  let originalConvertToBlob: typeof MockOffscreenCanvas.prototype.convertToBlob;
  let nativeWebGLExtension: typeof MockWebGLContext.prototype.getExtension;
  let nativeWebGLExtensions: typeof MockWebGLContext.prototype.getSupportedExtensions;
  let nativeWebGLParameter: typeof MockWebGLContext.prototype.getParameter;
  let originalWebGLGetError: typeof MockWebGLContext.prototype.getError;

  beforeEach(() => {
    originalGetImageData = MockOffscreenContext.prototype.getImageData;
    originalPutImageData = MockOffscreenContext.prototype.putImageData;
    originalConvertToBlob = MockOffscreenCanvas.prototype.convertToBlob;
    nativeWebGLExtension = MockWebGLContext.prototype.getExtension;
    nativeWebGLExtensions = MockWebGLContext.prototype.getSupportedExtensions;
    nativeWebGLParameter = MockWebGLContext.prototype.getParameter;
    originalWebGLGetError = MockWebGLContext.prototype.getError;
  });

  afterEach(() => {
    MockOffscreenContext.prototype.getImageData = originalGetImageData;
    MockOffscreenContext.prototype.putImageData = originalPutImageData;
    MockOffscreenCanvas.prototype.convertToBlob = originalConvertToBlob;
    MockWebGLContext.prototype.getExtension = nativeWebGLExtension;
    MockWebGLContext.prototype.getSupportedExtensions = nativeWebGLExtensions;
    MockWebGLContext.prototype.getParameter = nativeWebGLParameter;
    MockWebGLContext.prototype.getError = originalWebGLGetError;
  });

  it("keeps snapshot data out of public globals and imports module workers", () => {
    const source = createWorkerSource({
      snapshot: snapshot,
      workerUrl: "https://example.com/worker.js",
      workerType: "module",
    });

    expect(source).not.toContain("__PT_RUNTIME__");
    expect(source).toContain("Object.freeze(");
    expect(source).not.toContain("globalThis.__pt");
    expect(source).not.toContain("__REFRACT_WORKER_");
    expect(source).toContain('import("https://example.com/worker.js")');
    expect(source).toContain('await import("https://example.com/worker.js")');
    expect(source).not.toContain("(async () =>");
  });

  it("does not pass the private snapshot through page-owned serializers", () => {
    const privateSnapshot = { ...snapshot, authKey: "worker-private-auth-key" };
    const nativeStringify = JSON.stringify;
    const nativeReplace = String.prototype.replace;
    let leakedSnapshot: unknown;
    let leakedSerializedSnapshot: string | undefined;
    JSON.stringify = function (
      this: JSON,
      value: unknown,
      ...args: unknown[]
    ): string | undefined {
      if (
        (value as { authKey?: unknown } | null)?.authKey === privateSnapshot.authKey
      ) {
        leakedSnapshot = value;
      }
      return Reflect.apply(nativeStringify, this, [value, ...args]) as
        string | undefined;
    } as typeof JSON.stringify;
    String.prototype.replace = function (
      this: string,
      searchValue: string | RegExp,
      replaceValue: string,
    ): string {
      const value = String(this);
      if (value.includes(privateSnapshot.authKey)) {
        leakedSerializedSnapshot = value;
      }
      return Reflect.apply(nativeReplace, this, [searchValue, replaceValue]);
    } as typeof String.prototype.replace;

    try {
      const source = createWorkerSource({
        snapshot: privateSnapshot,
        workerUrl: "https://example.com/worker.js",
        workerType: "classic",
      });
      expect(source).toContain(privateSnapshot.authKey);
    } finally {
      JSON.stringify = nativeStringify;
      String.prototype.replace = nativeReplace;
    }

    expect(leakedSnapshot).toBeUndefined();
    expect(leakedSerializedSnapshot).toBeUndefined();
  });

  it("keeps generated worker bootstrap output stable", () => {
    const classicSource = createWorkerSource({
      snapshot: snapshot,
      workerUrl: "https://example.com/worker.js",
      workerType: "classic",
    });
    const classicSourceRepeat = createWorkerSource({
      snapshot: snapshot,
      workerUrl: "https://example.com/worker.js",
      workerType: "classic",
    });
    const moduleSource = createWorkerSource({
      snapshot: snapshot,
      workerUrl: "https://example.com/worker.js",
      workerType: "module",
    });
    const moduleSourceRepeat = createWorkerSource({
      snapshot: snapshot,
      workerUrl: "https://example.com/worker.js",
      workerType: "module",
    });

    expect(classicSource).toBe(classicSourceRepeat);
    expect(moduleSource).toBe(moduleSourceRepeat);
    expect(classicSource).not.toBe(moduleSource);
    expect(hashWorkerSource(classicSource)).not.toBe(hashWorkerSource(moduleSource));
  });

  it("keeps the generated worker native-mask registry out of public symbols", () => {
    const source = createWorkerSource({
      snapshot: snapshot,
      workerUrl: "https://example.com/worker.js",
      workerType: "classic",
    });

    expect(source).not.toContain("native-sources");
  });

  it("keeps the inline WebGL mirror parsable and type preserving", () => {
    expect(() => new Function(WORKER_WEBGL_SOURCE)).not.toThrow();
    expect(WORKER_WEBGL_SOURCE).toContain("getReadPixelsPackState");
    expect(WORKER_WEBGL_SOURCE).toContain("typedArrayBufferGetter");
    expect(WORKER_WEBGL_SOURCE).toContain("normalizeReadPixelsArgs");
    expect(WORKER_WEBGL_SOURCE).toContain("toWebIDLUint32");
    expect(WORKER_WEBGL_SOURCE).toContain("Float32Array");
    expect(WORKER_WEBGL_SOURCE).not.toContain("beforeBytes");
    expect(WORKER_WEBGL_SOURCE).not.toContain("value.subarray");
  });

  it("wraps classic worker import in try/catch with XHR blob fallback for worker-src blob: CSP", () => {
    const source = createWorkerSource({
      snapshot: snapshot,
      workerUrl: "https://example.com/worker.js",
      workerType: "classic",
    });

    expect(source).toContain('importScripts("https://example.com/worker.js")');
    expect(source).toContain("catch (");
    expect(source).toContain("XMLHttpRequest");
    expect(source).toContain("URL.createObjectURL");
    expect(source).toContain("URL.revokeObjectURL");
    // Module evaluation remains pending via top-level await until either the
    // original import or its XHR/blob fallback has installed message handlers.
    const moduleSource = createWorkerSource({
      snapshot: snapshot,
      workerUrl: "https://example.com/worker.js",
      workerType: "module",
    });
    expect(moduleSource).toContain("XMLHttpRequest");
    expect(moduleSource).toContain('await import("https://example.com/worker.js")');
    expect(moduleSource).not.toContain("(async () =>");
  });

  it("inlines captured classic worker source instead of importing the blob URL", () => {
    const workerUrl = "blob:https://example.com/8754ff3e";
    const inlineSource = "self.__PT_INLINE_MARKER__ = navigator.languages;";
    const source = createWorkerSource({
      snapshot: snapshot,
      workerUrl: workerUrl,
      workerType: "classic",
      inlineSource: inlineSource,
    });

    // The original source is spliced in verbatim and runs after the spoof setup,
    // so its global getters (navigator.languages) see the installed patches.
    const snapshotIndex = source.indexOf("Object.freeze(");
    const inlineIndex = source.indexOf(inlineSource);
    expect(snapshotIndex).toBeGreaterThanOrEqual(0);
    expect(inlineIndex).toBeGreaterThan(snapshotIndex);
    // The original URL is passed lexically for relative-URL repair.
    expect(source).toContain(JSON.stringify(workerUrl));
    expect(source).not.toContain("globalThis.__pt");
    // Crucially: no importScripts()/fetch() of the worker URL — nothing for a
    // strict script-src/connect-src (without blob:) to block.
    expect(source).not.toContain(`importScripts(${JSON.stringify(workerUrl)})`);
    expect(source).not.toContain(`__xhr.open("GET", ${JSON.stringify(workerUrl)}`);
    expect(source).not.toContain(`await import(${JSON.stringify(workerUrl)})`);
  });

  it("keeps the import path for module workers even when an inline source is supplied", () => {
    const workerUrl = "blob:https://example.com/abc";
    const source = createWorkerSource({
      snapshot: snapshot,
      workerUrl: workerUrl,
      workerType: "module",
      inlineSource: "self.__SHOULD_NOT_INLINE__ = 1;",
    });

    expect(source).toContain(`await import(${JSON.stringify(workerUrl)})`);
    expect(source).not.toContain("self.__SHOULD_NOT_INLINE__ = 1;");
  });

  it("preserves native illegal-invocation behavior for worker geolocation methods", async () => {
    try {
      const geolocation = {} as Geolocation;

      await withWorkerTestGlobals(
        {
          navigator: { geolocation } as Navigator,
        },
        () => {
          installWorkerInTest(snapshot);

          const detachedGetPosition = geolocation.getCurrentPosition;
          const detachedWatchPosition = geolocation.watchPosition;
          const detachedClearWatch = geolocation.clearWatch;

          expect(() => detachedGetPosition(vi.fn())).toThrowError(
            new TypeError("Illegal invocation"),
          );
          expect(() => detachedWatchPosition(vi.fn())).toThrowError(
            new TypeError("Illegal invocation"),
          );
          expect(() => detachedClearWatch(1)).toThrowError(
            new TypeError("Illegal invocation"),
          );
        },
      );
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("serializes worker geolocation positions and coordinates", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const geolocation = {} as Geolocation;
      const successCallback = vi.fn();
      vi.spyOn(Math, "random").mockReturnValue(0);

      await withWorkerTestGlobals({ navigator: { geolocation } as Navigator }, () => {
        installWorkerInTest(snapshot);
        geolocation.getCurrentPosition(successCallback);
        vi.advanceTimersByTime(10);

        const position = successCallback.mock.calls[0]?.[0] as GeolocationPosition;
        expect(position.toJSON()).toEqual({
          timestamp: position.timestamp,
          coords: position.coords.toJSON(),
        });
        expect(JSON.parse(JSON.stringify(position))).toEqual(position.toJSON());
      });
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("honors worker geolocation timeout and reentrant clearWatch", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const geolocation = {} as Geolocation;
      const successCallback = vi.fn();
      let watchId = 0;
      const errorCallback = vi.fn((_error: GeolocationPositionError) =>
        geolocation.clearWatch(watchId),
      );
      vi.spyOn(Math, "random").mockReturnValue(0);

      await withWorkerTestGlobals({ navigator: { geolocation } as Navigator }, () => {
        installWorkerInTest(snapshot);
        watchId = geolocation.watchPosition(successCallback, errorCallback, {
          timeout: 0,
        });
        vi.runOnlyPendingTimers();
        vi.advanceTimersByTime(10_000);

        expect(successCallback).not.toHaveBeenCalled();
        expect(errorCallback).toHaveBeenCalledTimes(1);
        expect(errorCallback.mock.calls[0]?.[0].code).toBe(3);
        expect(vi.getTimerCount()).toBe(0);
      });
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("returns a fresh worker cached position before applying timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const geolocation = {} as Geolocation;
      const firstSuccess = vi.fn();
      const cachedSuccess = vi.fn();
      const errorCallback = vi.fn();
      vi.spyOn(Math, "random").mockReturnValue(0);

      await withWorkerTestGlobals({ navigator: { geolocation } as Navigator }, () => {
        installWorkerInTest(snapshot);
        geolocation.getCurrentPosition(firstSuccess, errorCallback, {
          maximumAge: 60_000,
          timeout: 10_000,
        });
        vi.runOnlyPendingTimers();
        geolocation.getCurrentPosition(cachedSuccess, errorCallback, {
          maximumAge: 60_000,
          timeout: 0,
        });
        vi.runOnlyPendingTimers();

        expect(cachedSuccess).toHaveBeenCalledWith(firstSuccess.mock.calls[0]?.[0]);
        expect(errorCallback).not.toHaveBeenCalled();
      });
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("returns a fresh worker cached position to watchPosition before timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const geolocation = {} as Geolocation;
      const firstSuccess = vi.fn();
      const watchSuccess = vi.fn();
      const errorCallback = vi.fn();
      vi.spyOn(Math, "random").mockReturnValue(0);

      await withWorkerTestGlobals({ navigator: { geolocation } as Navigator }, () => {
        installWorkerInTest(snapshot);
        geolocation.getCurrentPosition(firstSuccess, errorCallback, {
          timeout: 10_000,
        });
        vi.runOnlyPendingTimers();
        const watchId = geolocation.watchPosition(watchSuccess, errorCallback, {
          maximumAge: 60_000,
          timeout: 0,
        });
        vi.runOnlyPendingTimers();

        expect(watchSuccess).toHaveBeenCalledWith(firstSuccess.mock.calls[0]?.[0]);
        expect(errorCallback).not.toHaveBeenCalled();
        geolocation.clearWatch(watchId);
      });
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("does not install worker geolocation methods when spoofing is disabled", async () => {
    try {
      const geolocation = {} as Geolocation;

      await withWorkerTestGlobals(
        {
          navigator: { geolocation } as Navigator,
        },
        () => {
          installWorkerInTest({
            ...snapshot,
            geolocationEnabled: false,
          });

          expect("getCurrentPosition" in geolocation).toBe(false);
          expect("watchPosition" in geolocation).toBe(false);
          expect("clearWatch" in geolocation).toBe(false);
        },
      );
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("does not emit worker watch updates while the document stays hidden", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const geolocation = {} as Geolocation;
      const targetDocument = { visibilityState: "visible" as DocumentVisibilityState };
      const successCallback = vi.fn();
      const originalDocument = (
        globalThis as typeof globalThis & { document?: Document }
      ).document;
      vi.spyOn(Math, "random").mockReturnValue(0);

      await withWorkerTestGlobals(
        {
          navigator: { geolocation } as Navigator,
        },
        () => {
          try {
            Object.defineProperty(globalThis, "document", {
              configurable: true,
              value: targetDocument,
            });

            installWorkerInTest({
              ...snapshot,
              watchPositionDelay: [50, 50],
            });

            const watchId = geolocation.watchPosition(successCallback);

            // getCallbackDelay() = 10ms with Math.random = 0
            vi.advanceTimersByTime(10);
            expect(successCallback).toHaveBeenCalledTimes(1);

            targetDocument.visibilityState = "hidden";
            // getNextWatchDelay() = 50 000ms; advance well past it while hidden
            vi.advanceTimersByTime(100);
            expect(successCallback).toHaveBeenCalledTimes(1);

            geolocation.clearWatch(watchId);
          } finally {
            if (originalDocument === undefined) {
              delete (globalThis as typeof globalThis & { document?: Document })
                .document;
            } else {
              Object.defineProperty(globalThis, "document", {
                configurable: true,
                value: originalDocument,
              });
            }
          }
        },
      );
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("waits for cached-position expiry before the second worker watch update", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const geolocation = {} as Geolocation;
      const successCallback = vi.fn();
      vi.spyOn(Math, "random").mockReturnValue(0);

      await withWorkerTestGlobals(
        {
          navigator: { geolocation } as Navigator,
        },
        () => {
          installWorkerInTest({
            ...snapshot,
            watchPositionDelay: [1, 1],
          });

          const watchId = geolocation.watchPosition(successCallback);

          // getCallbackDelay() = 10ms with Math.random = 0
          vi.advanceTimersByTime(10);
          expect(successCallback).toHaveBeenCalledTimes(1);

          // getNextWatchDelay() = 1 000ms; cache still valid at midpoint
          vi.advanceTimersByTime(500);
          expect(successCallback).toHaveBeenCalledTimes(1);

          // advance past cache expiry (10 + 1 000 = 1 010ms total)
          vi.advanceTimersByTime(510);
          expect(successCallback).toHaveBeenCalledTimes(2);

          geolocation.clearWatch(watchId);
        },
      );
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("patches WorkerNavigator getters instead of redefining the global navigator", () => {
    const source = createWorkerSource({
      snapshot: {
        ...snapshot,
        fingerprint: {
          hardwareConcurrency: 8,
          deviceMemory: 8,
          maxTouchPoints: 5,
          platform: "Win32",
          userAgent: "Mozilla/5.0 Chrome/139.0.7201.45",
          vendor: "Google Inc.",
          appVersion: "5.0 Chrome/139.0.7201.45",
        },
      },
      workerUrl: "https://example.com/worker.js",
      workerType: "classic",
    });

    expect(source).toContain("WorkerNavigator");
    expect(source).toContain("deviceMemory");
    expect(source).toContain("maxTouchPoints");
    expect(source).not.toContain("__PT_RUNTIME__");
  });

  it("patches worker userAgentData client hints when fingerprint hints are available", () => {
    const source = createWorkerSource({
      snapshot: {
        ...snapshot,
        fingerprint: {
          clientHints: {
            brands: [{ brand: "Google Chrome", version: "139" }],
            fullVersionList: [{ brand: "Google Chrome", version: "139.0.7201.45" }],
            platform: "macOS",
            platformVersion: "15.4.0",
            architecture: "arm",
            bitness: "64",
            mobile: false,
            wow64: false,
          },
        },
      },
      workerUrl: "https://example.com/worker.js",
      workerType: "classic",
    });

    expect(source).toContain("userAgentData");
    expect(source).toContain("getHighEntropyValues");
    expect(source).toContain("toJSON");
    expect(source).not.toContain("__vite_ssr_import_");
  });

  it("limits worker AudioBuffer perturbation to a sparse mutation budget", () => {
    const source = createWorkerSource({
      snapshot: {
        ...snapshot,
        fingerprint: {
          audioNoiseSeed: 12345,
        },
      },
      workerUrl: "https://example.com/worker.js",
      workerType: "classic",
    });

    expect(source).toContain("AudioBuffer");
    expect(source).toContain("getChannelData");
  });

  it("keeps worker Date stringification and timezone math coherent", async () => {
    const baseEpochMs = ORIGINAL_DATE.parse("2026-07-15T12:00:00.000Z");
    const localOffsetMinutes = new ORIGINAL_DATE(baseEpochMs).getTimezoneOffset();
    const targetOffsetMinutes = getTimeZoneOffsetMinutes(
      "America/Los_Angeles",
      baseEpochMs,
    );

    await withWorkerTestGlobals({}, () => {
      installWorkerInTest({
        ...snapshot,
        locale: {
          language: "en",
          languages: ["en", "pl"],
          formattingLanguage: "pl",
          formattingLanguages: ["pl", "en-US"],
          timeZone: "America/Los_Angeles",
          acceptLanguage: "en,pl",
        },
        date: {
          baseEpochMs,
          offsetMs: (localOffsetMinutes - targetOffsetMinutes) * 60_000,
          timeZone: "America/Los_Angeles",
        },
      });

      const computeTimezoneOffset = (dateValue: Date): number => {
        const date = dateValue.getDate();
        const month = dateValue.getMonth();
        const year = dateValue.toString().split(" ")[3];
        const format = (value: number): string =>
          `${value}`.length === 1 ? `0${value}` : `${value}`;
        const dateString = `${month + 1}/${format(date)}/${year}`;
        const dateStringUTC = `${year}-${format(month + 1)}-${format(date)}`;
        const utc = Date.parse(String(new Date(dateString)));
        const now = +new Date(dateStringUTC);
        return Number(((utc - now) / 60000).toFixed(0));
      };

      const sample = new Date("2026-07-15T12:00:00.000Z");
      expect(sample.getTimezoneOffset()).toBe(420);
      expect(sample.toString()).toContain("GMT-0700");
      expect(sample.toString()).toContain("Pacific Daylight Time");
      expect(Date.parse("02/31/2026")).toBe(new Date(2026, 1, 31).getTime());
      expect(computeTimezoneOffset(sample)).toBe(420);
    });
  });

  it("keeps worker Date and server timestamps on the same absolute epoch", async () => {
    const baseEpochMs = ORIGINAL_DATE.parse("2026-07-15T02:50:59.000Z");
    const nowSpy = vi.spyOn(ORIGINAL_DATE, "now").mockReturnValue(baseEpochMs);
    try {
      await withWorkerTestGlobals({}, () => {
        installWorkerInTest({
          ...snapshot,
          locale: {
            ...snapshot.locale,
            timeZone: "America/Toronto",
          },
          date: {
            baseEpochMs,
            offsetMs: -6 * 3_600_000,
            timeZone: "America/Toronto",
          },
        });

        const liveSince = ORIGINAL_DATE.parse("2026-07-15T01:30:23.000Z");
        expect(Date.now()).toBe(baseEpochMs);
        expect(new Date().getTime()).toBe(baseEpochMs);
        expect(Math.floor((Date.now() - liveSince) / 1000)).toBe(4_836);
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("keeps worker Date locale methods and getters coherent with the spoofed timezone", async () => {
    const baseEpochMs = ORIGINAL_DATE.parse("2026-12-31T23:30:00.000Z");
    const localOffsetMinutes = new ORIGINAL_DATE(baseEpochMs).getTimezoneOffset();
    const targetOffsetMinutes = getTimeZoneOffsetMinutes(
      "Pacific/Auckland",
      baseEpochMs,
    );

    await withWorkerTestGlobals({}, () => {
      installWorkerInTest({
        ...snapshot,
        locale: {
          language: "en-NZ",
          languages: ["en-NZ", "en"],
          timeZone: "Pacific/Auckland",
          acceptLanguage: "en-NZ,en",
        },
        date: {
          baseEpochMs,
          offsetMs: (localOffsetMinutes - targetOffsetMinutes) * 60_000,
          timeZone: "Pacific/Auckland",
        },
      });

      const sample = new Date("2026-12-31T23:30:00.000Z");

      expect(sample.getFullYear()).toBe(2027);
      expect(sample.getMonth()).toBe(0);
      expect(sample.getDate()).toBe(1);
      expect(sample.getHours()).toBe(12);
      expect(sample.getMinutes()).toBe(30);
      expect(sample.getSeconds()).toBe(0);
      expect(sample.toLocaleDateString()).toBe(
        new NATIVE_DATE_TIME_FORMAT("en-NZ", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          timeZone: "Pacific/Auckland",
        }).format(new ORIGINAL_DATE("2026-12-31T23:30:00.000Z")),
      );
      expect(sample.toLocaleTimeString("en-NZ", { hour12: false })).toBe(
        new NATIVE_DATE_TIME_FORMAT("en-NZ", {
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: false,
          timeZone: "Pacific/Auckland",
        }).format(new ORIGINAL_DATE("2026-12-31T23:30:00.000Z")),
      );
      expect(sample.toLocaleString("en-NZ", { hour12: false })).toBe(
        new NATIVE_DATE_TIME_FORMAT("en-NZ", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: false,
          timeZone: "Pacific/Auckland",
        }).format(new ORIGINAL_DATE("2026-12-31T23:30:00.000Z")),
      );
    });
  });

  it("uses locale.timeZone as the worker Date timezone source", async () => {
    const baseEpochMs = ORIGINAL_DATE.parse("2026-01-15T12:00:00.000Z");
    const localOffsetMinutes = new ORIGINAL_DATE(baseEpochMs).getTimezoneOffset();
    const targetOffsetMinutes = getTimeZoneOffsetMinutes("Europe/Paris", baseEpochMs);

    await withWorkerTestGlobals({}, () => {
      installWorkerInTest({
        ...snapshot,
        locale: {
          language: "en",
          languages: ["en", "pl"],
          formattingLanguage: "pl",
          formattingLanguages: ["pl", "en-US"],
          timeZone: "America/Los_Angeles",
          acceptLanguage: "en,pl",
        },
        date: {
          baseEpochMs,
          offsetMs: (localOffsetMinutes - targetOffsetMinutes) * 60_000,
          timeZone: "Europe/Paris",
        },
      });

      const utcMidnightMs = ORIGINAL_DATE.UTC(2026, 0, 15, 0, 0, 0, 0);
      const expected =
        utcMidnightMs +
        getTimeZoneOffsetMinutes("Europe/Paris", utcMidnightMs) * 60_000;
      const localeDriven =
        utcMidnightMs +
        getTimeZoneOffsetMinutes("America/Los_Angeles", utcMidnightMs) * 60_000;

      expect(Date.parse("01/15/2026")).toBe(localeDriven);
      expect(Date.parse("01/15/2026")).not.toBe(expected);
    });
  });

  it("matches main-thread locale defaults for worker navigator and Intl patches", async () => {
    const baseEpochMs = ORIGINAL_DATE.parse("2026-07-15T12:00:00.000Z");
    const localOffsetMinutes = new ORIGINAL_DATE(baseEpochMs).getTimezoneOffset();
    const targetOffsetMinutes = getTimeZoneOffsetMinutes(
      "America/Los_Angeles",
      baseEpochMs,
    );
    class MockWorkerNavigator {}
    const workerNavigator = Object.create(
      MockWorkerNavigator.prototype,
    ) as Navigator & {
      language: string;
      languages: string[];
    };
    const workerGlobal = globalThis as typeof globalThis & {
      WorkerNavigator?: typeof MockWorkerNavigator;
    };
    const originalWorkerNavigator = workerGlobal.WorkerNavigator;

    Object.defineProperty(workerGlobal, "WorkerNavigator", {
      configurable: true,
      value: MockWorkerNavigator,
    });

    try {
      await withWorkerTestGlobals({ navigator: workerNavigator }, () => {
        installWorkerInTest({
          ...snapshot,
          locale: {
            language: "en",
            languages: ["en", "pl"],
            formattingLanguage: "pl",
            formattingLanguages: ["pl", "en-US"],
            timeZone: "America/Los_Angeles",
            acceptLanguage: "en,pl",
          },
          date: {
            baseEpochMs,
            offsetMs: (localOffsetMinutes - targetOffsetMinutes) * 60_000,
            timeZone: "America/Los_Angeles",
          },
        });

        const languageGetter = Object.getOwnPropertyDescriptor(
          MockWorkerNavigator.prototype,
          "language",
        )?.get;
        const languagesGetter = Object.getOwnPropertyDescriptor(
          MockWorkerNavigator.prototype,
          "languages",
        )?.get;

        expect(languageGetter?.call(workerNavigator)).toBe("en");
        expect(languagesGetter?.call(workerNavigator)).toEqual(["en", "pl"]);

        const defaultFormatter = new Intl.DateTimeFormat(undefined, {
          dateStyle: "full",
          timeStyle: "long",
        });
        expect(defaultFormatter.resolvedOptions().locale).toBe("pl");
        expect(defaultFormatter.resolvedOptions().timeZone).toBe("America/Los_Angeles");

        const explicitZoneFormatter = new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "full",
          timeStyle: "long",
          timeZone: "America/New_York",
        });
        expect(explicitZoneFormatter.resolvedOptions().locale).toBe("fr-FR");
        expect(explicitZoneFormatter.resolvedOptions().timeZone).toBe(
          "America/New_York",
        );

        expect(new Intl.NumberFormat().resolvedOptions().locale).toBe("pl");
        expect(new Intl.Collator().resolvedOptions().locale).toBe("pl");
        expect(new Intl.RelativeTimeFormat().resolvedOptions().locale).toBe("pl");

        if ("PluralRules" in Intl) {
          expect(new Intl.PluralRules().resolvedOptions().locale).toBe("pl");
        }

        if ("ListFormat" in Intl) {
          expect(new Intl.ListFormat().resolvedOptions().locale).toBe("pl");
        }

        if ("DisplayNames" in Intl) {
          expect(
            new Intl.DisplayNames(undefined, { type: "region" }).resolvedOptions()
              .locale,
          ).toBe("pl");
        }

        if ("Segmenter" in Intl) {
          expect(new Intl.Segmenter().resolvedOptions().locale).toBe("pl");
        }

        const currentDate = new Date();
        const formatter = new Intl.DateTimeFormat("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "America/Los_Angeles",
        });
        const expectedParts = new NATIVE_DATE_TIME_FORMAT("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "America/Los_Angeles",
        }).formatToParts(new ORIGINAL_DATE(+currentDate));

        expect(formatter.formatToParts(currentDate)).toEqual(expectedParts);
      });
    } finally {
      if (originalWorkerNavigator) {
        Object.defineProperty(workerGlobal, "WorkerNavigator", {
          configurable: true,
          value: originalWorkerNavigator,
        });
      } else {
        delete workerGlobal.WorkerNavigator;
      }
    }
  });

  it("patches worker WebGL suppression in simple mode", () => {
    const source = createWorkerSource({
      snapshot: {
        ...snapshot,
        fingerprint: {
          webGL: { suppressDebugInfo: true, readPixelsNoiseSeed: 42 },
        },
      },
      workerUrl: "https://example.com/worker.js",
      workerType: "classic",
    });

    expect(source).toContain("WEBGL_debug_renderer_info");
    expect(source).toContain("WebGLRenderingContext");
    expect(source).toContain("WebGL2RenderingContext");
    expect(source).toContain("readPixels");
  });

  it("patches worker WebGL renderer and vendor spoofing", () => {
    const source = createWorkerSource({
      snapshot: {
        ...snapshot,
        fingerprint: {
          webGL: {
            renderer: "Spoofed Worker GPU",
            vendor: "Spoofed Worker Vendor",
            readPixelsNoiseSeed: 42,
          },
        },
      },
      workerUrl: "https://example.com/worker.js",
      workerType: "classic",
    });

    expect(source).toContain("UNMASKED_RENDERER_WEBGL");
    expect(source).toContain("UNMASKED_VENDOR_WEBGL");
    expect(source).toContain("renderer");
    expect(source).toContain("vendor");
  });

  it("returns INVALID_ENUM for worker debug renderer parameter probes in suppression mode", async () => {
    await withWorkerTestGlobals(
      {
        WebGLRenderingContext: MockWebGLContext,
      },
      () => {
        installWorkerInTest({
          ...snapshot,
          fingerprint: {
            webGL: { suppressDebugInfo: true },
          },
        });

        const context = new MockWebGLContext();

        expect(context.getExtension("WEBGL_debug_renderer_info")).toBeNull();
        expect(context.getSupportedExtensions()).not.toContain(
          "WEBGL_debug_renderer_info",
        );
        expect(context.getParameter(UNMASKED_VENDOR_WEBGL)).toBeNull();
        expect(context.getError()).toBe(INVALID_ENUM);
        expect(context.getError()).toBe(0);
        expect(context.getParameter(UNMASKED_RENDERER_WEBGL)).toBeNull();
        expect(context.getError()).toBe(INVALID_ENUM);
      },
    );
  });

  it("preserves worker native WebGL error FIFO ordering before queued synthetic INVALID_ENUM", async () => {
    await withWorkerTestGlobals(
      {
        WebGLRenderingContext: MockWebGLContext,
      },
      () => {
        installWorkerInTest({
          ...snapshot,
          fingerprint: {
            webGL: { suppressDebugInfo: true },
          },
        });

        const context = new MockWebGLContext();
        context.queueError(0x0501);

        expect(context.getParameter(UNMASKED_VENDOR_WEBGL)).toBeNull();
        expect(context.getError()).toBe(0x0501);
        expect(context.getError()).toBe(INVALID_ENUM);
        expect(context.getError()).toBe(0);
      },
    );
  });

  it("perturbs worker readPixels output deterministically", async () => {
    await withWorkerTestGlobals(
      {
        WebGLRenderingContext: MockWebGLContext,
      },
      () => {
        installWorkerInTest({
          ...snapshot,
          fingerprint: {
            webGL: {
              suppressDebugInfo: true,
              readPixelsNoiseSeed: 42,
            },
          },
        });

        const baseline = new Uint8Array(16);
        fillReadPixelsView(baseline);

        const first = new Uint8Array(16);
        const second = new Uint8Array(16);
        const context = new MockWebGLContext();

        context.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, first);
        context.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, second);

        expect(first).toEqual(second);
        expect(first).not.toEqual(baseline);
      },
    );
  });

  it("perturbs an identical zero readback in the generated worker runtime", async () => {
    await withWorkerTestGlobals(
      { WebGLRenderingContext: MockZeroReadbackContext },
      () => {
        installWorkerInTest({
          ...snapshot,
          fingerprint: { webGL: { readPixelsNoiseSeed: 42 } },
        });

        const pixels = new Uint8Array(16);
        new MockZeroReadbackContext().readPixels(
          0,
          0,
          2,
          2,
          RGBA,
          UNSIGNED_BYTE,
          pixels,
        );

        expect(pixels).not.toEqual(new Uint8Array(16));
      },
    );
  });

  it("preserves typed float noise in the generated worker runtime", async () => {
    await withWorkerTestGlobals(
      { WebGLRenderingContext: MockFloatReadbackContext },
      () => {
        installWorkerInTest({
          ...snapshot,
          fingerprint: { webGL: { readPixelsNoiseSeed: 42 } },
        });

        const pixels = new Float32Array(16);
        new MockFloatReadbackContext().readPixels(0, 0, 2, 2, RGBA, FLOAT, pixels);

        const changed = pixels.filter((value) => value !== 0.5);
        expect(changed.length).toBeGreaterThan(0);
        for (const value of changed) {
          expect(Math.abs(value - 0.5)).toBeCloseTo(FLOAT_DELTA);
        }
      },
    );
  });

  it("noises foreign-realm typed arrays in the generated worker runtime", async () => {
    await withWorkerTestGlobals({ WebGLRenderingContext: MockWebGLContext }, () => {
      installWorkerInTest({
        ...snapshot,
        fingerprint: { webGL: { readPixelsNoiseSeed: 42 } },
      });

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
  });

  it("applies WebIDL conversion to worker readPixels dimensions", async () => {
    await withWorkerTestGlobals({ WebGLRenderingContext: MockWebGLContext }, () => {
      installWorkerInTest({
        ...snapshot,
        fingerprint: { webGL: { readPixelsNoiseSeed: 42 } },
      });

      const pixels = new Uint8Array(16);
      const context = new MockWebGLContext();
      Reflect.apply(context.readPixels, context, [
        0,
        0,
        "2",
        "2",
        RGBA,
        UNSIGNED_BYTE,
        pixels,
      ]);

      const baseline = new Uint8Array(16);
      fillReadPixelsView(baseline);
      expect(pixels).not.toEqual(baseline);
    });
  });

  it("coerces worker readPixels object dimensions exactly once", async () => {
    await withWorkerTestGlobals({ WebGLRenderingContext: MockWebGLContext }, () => {
      installWorkerInTest({
        ...snapshot,
        fingerprint: { webGL: { readPixelsNoiseSeed: 42 } },
      });

      let widthCoercions = 0;
      const pixels = new Uint8Array(16);
      const context = new MockWebGLContext();
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
      ]);

      const baseline = new Uint8Array(16);
      fillReadPixelsView(baseline);
      expect(widthCoercions).toBe(1);
      expect(pixels).not.toEqual(baseline);
    });
  });

  it("validates the worker readPixels receiver before object coercion", async () => {
    await withWorkerTestGlobals({ WebGLRenderingContext: MockWebGLContext }, () => {
      installWorkerInTest({
        ...snapshot,
        fingerprint: { webGL: { readPixelsNoiseSeed: 42 } },
      });

      let coercions = 0;
      expect(() =>
        Reflect.apply(MockWebGLContext.prototype.readPixels, {}, [
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
        ]),
      ).toThrow("readPixels: Illegal invocation");
      expect(coercions).toBe(0);
    });
  });

  it("keeps failed worker readback native and preserves the GL error", async () => {
    await withWorkerTestGlobals({ WebGLRenderingContext: MockFailedContext }, () => {
      installWorkerInTest({
        ...snapshot,
        fingerprint: { webGL: { readPixelsNoiseSeed: 42 } },
      });

      const pixels = new Uint8Array(16).fill(0xaa);
      const context = new MockFailedContext();
      context.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, pixels);

      expect(pixels).toEqual(new Uint8Array(16).fill(0xaa));
      expect(context.getError()).toBe(INVALID_OPERATION);
      expect(context.getError()).toBe(0);
    });
  });

  it("preserves worker illegal invocation receiver checks for suppression fast paths", async () => {
    await withWorkerTestGlobals(
      {
        WebGLRenderingContext: MockWebGLContext,
      },
      () => {
        installWorkerInTest({
          ...snapshot,
          fingerprint: {
            webGL: { suppressDebugInfo: true },
          },
        });

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
      },
    );
  });

  it("adds OffscreenCanvas convertToBlob export parity when worker canvas spoofing is enabled", () => {
    const source = createWorkerSource({
      snapshot: {
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      },
      workerUrl: "https://example.com/worker.js",
      workerType: "classic",
    });

    expect(source).toContain("convertToBlob");
    expect(source).toContain("getImageData");
    expect(source).toContain("putImageData");
    expect(source).toContain("1024");
    expect(source).toContain("1048576");
  });

  it("keeps worker OffscreenCanvas readback and export aligned with the lightweight mutation budget", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      const nativeGetImageDataLength =
        MockOffscreenContext.prototype.getImageData.length;

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      expect(MockOffscreenContext.prototype.getImageData.length).toBe(
        nativeGetImageDataLength,
      );

      const canvas = new MockOffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }

      const readback = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      expect(collectMutatedRgbOffsets(readback)).toHaveLength(
        getCanvasMutationBudget(64, 64),
      );
      expect(Array.from(readback)).toEqual(Array.from(createCanvasNoise(64, 64, 42)));

      const blob = await canvas.convertToBlob();
      const exportPayload = await readMockExportPayload(blob);
      expect(exportPayload).toBe(Array.from(createCanvasNoise(64, 64, 42)).join(","));

      const laterReadback = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      expect(Array.from(laterReadback).join(",")).toBe(exportPayload);
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("keeps a large blank worker canvas native after alpha-zero and empty-path draws", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(2048, 513);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }
      const transparent = new MockImageData(canvas.width, canvas.height);
      transparent.data.fill(0);
      ctx.replaceStoredData(transparent);
      ctx.globalAlpha = 0;
      ctx.fillRect(0, 0, 10, 10);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.fill();

      await canvas.convertToBlob();

      expect(ctx.readRequests).toEqual([]);
      expect(Array.from(ctx.readRawImageData(42, 0, 1, 1).data)).toEqual([0, 0, 0, 0]);
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("keeps worker OffscreenCanvas sub-rect noise stable across non-destructive export", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }

      const rawBeforeExport = ctx.readRawImageData(2, 3, 4, 5);
      const readbackBeforeExport = ctx.getImageData(2, 3, 4, 5);
      await canvas.convertToBlob();
      ctx.clearReadRequests();

      const rawAfterExport = ctx.readRawImageData(2, 3, 4, 5);
      const readbackAfterExport = ctx.getImageData(2, 3, 4, 5);

      expect(Array.from(rawAfterExport.data)).toEqual(Array.from(rawBeforeExport.data));
      expect(Array.from(readbackAfterExport.data)).toEqual(
        Array.from(readbackBeforeExport.data),
      );
      expect(Array.from(readbackAfterExport.data)).not.toEqual(
        Array.from(rawAfterExport.data),
      );
      expect(ctx.readRequests).toEqual([[2, 3, 4, 5]]);
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("keeps partially out-of-bounds worker readback stable across non-destructive export", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }

      const rawBeforeExport = ctx.readRawImageData(-2, -1, 6, 5);
      const readbackBeforeExport = ctx.getImageData(-2, -1, 6, 5);
      await canvas.convertToBlob();
      ctx.clearReadRequests();

      const rawAfterExport = ctx.readRawImageData(-2, -1, 6, 5);
      const readbackAfterExport = ctx.getImageData(-2, -1, 6, 5);

      expect(Array.from(rawAfterExport.data)).toEqual(Array.from(rawBeforeExport.data));
      expect(Array.from(readbackAfterExport.data)).toEqual(
        Array.from(readbackBeforeExport.data),
      );
      expect(Array.from(readbackAfterExport.data)).not.toEqual(
        Array.from(rawAfterExport.data),
      );
      expect(ctx.readRequests).toEqual([[-2, -1, 6, 5]]);
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("invalidates worker cached parity after redraw even when requested pixel was not tracked by export cache", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }

      const [pixelX, pixelY] = findUntrackedPixel(canvas.width, canvas.height, 42);

      await canvas.convertToBlob();
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearReadRequests();

      const rawSubRect = ctx.readRawImageData(pixelX, pixelY, 1, 1);
      const readbackSubRect = ctx.getImageData(pixelX, pixelY, 1, 1);

      expect(Array.from(readbackSubRect.data)).not.toEqual(Array.from(rawSubRect.data));
      expect(ctx.readRequests).toEqual([[pixelX, pixelY, 1, 1]]);
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("preserves worker cached parity for no-op self putImageData writes of already-perturbed readback", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }

      await canvas.convertToBlob();

      const firstReadback = ctx.getImageData(2, 3, 4, 5);
      ctx.putImageData(firstReadback, 2, 3);
      ctx.clearReadRequests();

      const secondReadback = ctx.getImageData(2, 3, 4, 5);
      const rawSubRect = ctx.readRawImageData(2, 3, 4, 5);

      expect(Array.from(secondReadback.data)).toEqual(Array.from(firstReadback.data));
      expect(Array.from(secondReadback.data)).toEqual(Array.from(rawSubRect.data));
      expect(ctx.readRequests).toEqual([[2, 3, 4, 5]]);
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("preserves explicit worker seven-argument putImageData overload semantics", () => {
    MockOffscreenContext.prototype.putImageData = function (
      this: MockOffscreenContext,
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

    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(16, 16);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }
      const imageData = ctx.getImageData(0, 0, 4, 4);

      expect(() =>
        ctx.putImageData(imageData, 0, 0, undefined, undefined, undefined, undefined),
      ).toThrow("strict overload");
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("preserves fresh worker self-write parity before any export seeds a canvas cache", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }

      const firstReadback = ctx.getImageData(2, 3, 4, 5);
      ctx.putImageData(firstReadback, 2, 3);
      ctx.clearReadRequests();

      const secondReadback = ctx.getImageData(2, 3, 4, 5);
      const rawSubRect = ctx.readRawImageData(2, 3, 4, 5);

      expect(Array.from(secondReadback.data)).toEqual(Array.from(firstReadback.data));
      expect(Array.from(secondReadback.data)).toEqual(Array.from(rawSubRect.data));
      expect(ctx.readRequests).toEqual([[2, 3, 4, 5]]);
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("preserves fresh worker self-write parity for edge-overlapping rects before any export seeds a canvas cache", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }

      const firstReadback = ctx.getImageData(-2, -1, 6, 5);
      ctx.putImageData(firstReadback, -2, -1);
      ctx.clearReadRequests();

      const secondReadback = ctx.getImageData(-2, -1, 6, 5);
      const rawSubRect = ctx.readRawImageData(-2, -1, 6, 5);

      expect(Array.from(secondReadback.data)).toEqual(Array.from(firstReadback.data));
      expect(Array.from(secondReadback.data)).toEqual(Array.from(rawSubRect.data));
      expect(ctx.readRequests).toEqual([[-2, -1, 6, 5]]);
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("does not cache a fully out-of-bounds fresh worker self-write rect", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }

      const firstReadback = ctx.getImageData(-100, -100, 10, 10);
      ctx.putImageData(firstReadback, -100, -100);
      ctx.clearReadRequests();

      const secondReadback = ctx.getImageData(-100, -100, 10, 10);
      const rawSubRect = ctx.readRawImageData(-100, -100, 10, 10);

      // A fully out-of-bounds rect is all-transparent (zero entropy), so it is
      // left native (not perturbed, not cached) — each read hits native readback.
      expect(Array.from(secondReadback.data)).toEqual(Array.from(firstReadback.data));
      expect(Array.from(secondReadback.data)).toEqual(Array.from(rawSubRect.data));
      expect(ctx.readRequests).toEqual([[-100, -100, 10, 10]]);
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("preserves multiple fresh worker self-written rects on the same canvas before export", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
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
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("invalidates an older overlapping fresh worker self-written rect when a newer overlapping rect is promoted", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }

      const firstRectReadback = ctx.getImageData(2, 3, 4, 5);
      ctx.putImageData(firstRectReadback, 2, 3);

      const overlappingRectReadback = ctx.getImageData(4, 5, 4, 5);
      ctx.putImageData(overlappingRectReadback, 4, 5);

      ctx.clearReadRequests();

      const rawFirstRect = ctx.readRawImageData(2, 3, 4, 5);
      const rereadFirstRect = ctx.getImageData(2, 3, 4, 5);

      expect(Array.from(rereadFirstRect.data)).not.toEqual(
        Array.from(rawFirstRect.data),
      );
      expect(Array.from(rereadFirstRect.data)).not.toEqual(
        Array.from(firstRectReadback.data),
      );
      expect(ctx.readRequests).toEqual([[2, 3, 4, 5]]);
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("does not preserve worker cache for stale self putImageData writes from an older perturbed generation", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }

      await canvas.convertToBlob();
      const staleReadback = ctx.getImageData(2, 3, 4, 5);

      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await canvas.convertToBlob();

      ctx.putImageData(staleReadback, 2, 3);
      ctx.clearReadRequests();

      const rawSubRect = ctx.readRawImageData(2, 3, 4, 5);
      const nextReadback = ctx.getImageData(2, 3, 4, 5);

      expect(Array.from(rawSubRect.data)).toEqual(Array.from(staleReadback.data));
      expect(Array.from(nextReadback.data)).not.toEqual(Array.from(staleReadback.data));
      expect(Array.from(nextReadback.data)).not.toEqual(Array.from(rawSubRect.data));
      expect(ctx.readRequests).toEqual([[2, 3, 4, 5]]);
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("re-perturbs worker OffscreenCanvas exports after a redraw instead of trusting stale canvas identity cache", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
        },
      });

      const canvas = new MockOffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
      if (!ctx) {
        throw new Error("Expected 2D OffscreenCanvas context");
      }

      const firstExport = await readMockExportPayload(await canvas.convertToBlob());

      ctx.replaceStoredData(new MockImageData(canvas.width, canvas.height));
      const rawAfterRedraw = ctx.serializeRawPixels();

      const secondExport = await readMockExportPayload(await canvas.convertToBlob());
      const secondReadback = Array.from(
        ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      ).join(",");

      expect(secondExport).toBe(firstExport);
      expect(secondExport).not.toBe(rawAfterRedraw);
      expect(secondReadback).toBe(secondExport);
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });

  it("guards OffscreenCanvas convertToBlob parity behind the worker canvas toggle", () => {
    const source = createWorkerSource({
      snapshot: {
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
          spoofingToggles: {
            canvas: false,
          },
        },
      },
      workerUrl: "https://example.com/worker.js",
      workerType: "classic",
    });

    expect(source).toContain("canvas");
    expect(source).toContain("OffscreenCanvas");
    expect(source).toContain("convertToBlob");
  });

  it("leaves worker OffscreenCanvas behavior native when the canvas toggle is disabled", async () => {
    const testGlobal = globalThis as WorkerTestGlobal;
    const originalSelf = testGlobal.self;
    const originalOffscreenCanvas = testGlobal.OffscreenCanvas;
    const nativeOffscreenContext = testGlobal.OffscreenCanvasRenderingContext2D;
    const originalNavigator = testGlobal.navigator;
    const originalImportScripts = testGlobal.importScripts;

    try {
      Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "importScripts", {
        configurable: true,
        writable: true,
        value: () => {},
      });
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: MockOffscreenCanvas,
      });
      Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
        configurable: true,
        value: MockOffscreenContext,
      });

      const nativeGetImageData = MockOffscreenContext.prototype.getImageData;
      const nativeConvertToBlob = MockOffscreenCanvas.prototype.convertToBlob;

      installWorkerInTest({
        ...snapshot,
        fingerprint: {
          canvasNoiseSeed: 42,
          spoofingToggles: {
            canvas: false,
          },
        },
      });

      expect(MockOffscreenContext.prototype.getImageData).toBe(nativeGetImageData);
      expect(MockOffscreenCanvas.prototype.convertToBlob).toBe(nativeConvertToBlob);

      const canvas = new MockOffscreenCanvas(2, 2);
      const blob = await canvas.convertToBlob();
      expect(await readMockExportPayload(blob)).toBe(
        canvas.getContext("2d")?.serializeRawPixels(),
      );
    } finally {
      if (originalSelf === undefined) {
        delete testGlobal.self;
      } else {
        Object.defineProperty(globalThis, "self", {
          configurable: true,
          value: originalSelf,
        });
      }

      if (originalNavigator === undefined) {
        delete testGlobal.navigator;
      } else {
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: originalNavigator,
        });
      }

      if (originalImportScripts === undefined) {
        delete testGlobal.importScripts;
      } else {
        Object.defineProperty(globalThis, "importScripts", {
          configurable: true,
          writable: true,
          value: originalImportScripts,
        });
      }

      if (originalOffscreenCanvas === undefined) {
        delete testGlobal.OffscreenCanvas;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvas", {
          configurable: true,
          value: originalOffscreenCanvas,
        });
      }

      if (nativeOffscreenContext === undefined) {
        delete testGlobal.OffscreenCanvasRenderingContext2D;
      } else {
        Object.defineProperty(globalThis, "OffscreenCanvasRenderingContext2D", {
          configurable: true,
          value: nativeOffscreenContext,
        });
      }
    }
  });
});
