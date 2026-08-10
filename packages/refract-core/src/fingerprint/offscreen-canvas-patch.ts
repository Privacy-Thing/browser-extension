import { createNativeSource, maskAsNative } from "../native/native-mask";

import {
  getCanvasContentState,
  isCanvasKnownBlank,
  isCanvasMutationNoOp,
  markCanvasBlank,
  markCanvasContentBlank,
  markCanvasContentDirty,
} from "./canvas-content-state";
import {
  createExportMutation,
  isImageDataTransparent,
  perturbCanvasImageData,
} from "./canvas-noise";
import {
  createCanvasReadTracker,
  type CanvasReadbackTracker,
} from "./canvas-readback-tracker";

export type OffscreenNoiseLogger = (
  event: string,
  args: readonly unknown[],
  meta: Record<string, unknown>,
) => void;

type NativePutInput = {
  argumentCount: number;
  context: OffscreenCanvasRenderingContext2D;
  dirtyHeight: number | undefined;
  dirtyWidth: number | undefined;
  dirtyX: number | undefined;
  dirtyY: number | undefined;
  dx: number;
  dy: number;
  imageData: ImageData;
};

const mutationMethods = [
  "drawImage",
  "drawFocusIfNeeded",
  "fillRect",
  "strokeRect",
  "clearRect",
  "fillText",
  "strokeText",
  "fill",
  "stroke",
] as const;

const pathMethods = [
  "arc",
  "arcTo",
  "bezierCurveTo",
  "ellipse",
  "lineTo",
  "quadraticCurveTo",
  "rect",
  "roundRect",
] as const;

const patchedOffscreenProtos = new WeakSet<object>();

class OffscreenPatch {
  readonly #canvasCtor: typeof OffscreenCanvas;
  readonly #canvasPrototype: OffscreenCanvas;
  readonly #contextPrototype: OffscreenCanvasRenderingContext2D;
  readonly #contextsWithPath = new WeakSet<object>();
  readonly #contextByCanvas = new WeakMap<object, object>();
  readonly #nativeDrawImage: OffscreenCanvasRenderingContext2D["drawImage"];
  readonly #nativeGetContext: OffscreenCanvas["getContext"];
  readonly #nativeGetImageData: OffscreenCanvasRenderingContext2D["getImageData"];
  readonly #nativeGlobalAlphaGetter: PropertyDescriptor["get"];
  readonly #nativePutImageData: OffscreenCanvasRenderingContext2D["putImageData"];
  readonly #logger: OffscreenNoiseLogger | undefined;
  readonly #seed: number;
  readonly #targetGlobal: typeof globalThis;
  readonly #tracker: CanvasReadbackTracker<OffscreenCanvas>;

  constructor(
    seed: number,
    logger: OffscreenNoiseLogger | undefined,
    targetGlobal: typeof globalThis,
    constructors: readonly [
      typeof OffscreenCanvas,
      typeof OffscreenCanvasRenderingContext2D,
    ],
  ) {
    this.#seed = seed;
    this.#logger = logger;
    this.#targetGlobal = targetGlobal;
    this.#canvasCtor = constructors[0];
    this.#canvasPrototype = this.#canvasCtor.prototype;
    this.#contextPrototype = constructors[1].prototype;
    this.#nativeDrawImage = this.#contextPrototype.drawImage;
    this.#nativeGetContext = this.#canvasPrototype.getContext;
    this.#nativeGetImageData = this.#contextPrototype.getImageData;
    this.#nativePutImageData = this.#contextPrototype.putImageData;
    this.#nativeGlobalAlphaGetter = Object.getOwnPropertyDescriptor(
      this.#contextPrototype,
      "globalAlpha",
    )?.get;
    this.#tracker = createCanvasReadTracker<OffscreenCanvas>(
      () => seed,
      () => 1,
    );
  }

  install(): void {
    this.#patchGetContext();
    this.#logger?.("install", [], { seed: this.#seed });
    this.#patchPutImageData();
    this.#patchGetImageData();
    for (const property of mutationMethods) this.#patchMutationMethod(property);
    this.#patchMutationMethod("reset", true);
    this.#patchPathMethod("beginPath", true);
    for (const property of pathMethods) this.#patchPathMethod(property);
    this.#patchSizeSetter("width");
    this.#patchSizeSetter("height");
    this.#patchConvertToBlob();
  }

  #patchGetContext(): void {
    const patch = this;
    const patchedGetContext = {
      getContext(
        this: OffscreenCanvas,
        contextId: OffscreenRenderingContextId,
        options?: unknown,
      ): OffscreenRenderingContext | null {
        const context =
          options === undefined
            ? Reflect.apply(patch.#nativeGetContext, this, [contextId])
            : Reflect.apply(patch.#nativeGetContext, this, [contextId, options]);
        if (context !== null && contextId !== "2d") {
          markCanvasContentDirty(this);
        } else if (context !== null) {
          patch.#contextByCanvas.set(this, context);
          markCanvasBlank(this);
        }
        return context;
      },
    }.getContext;
    Object.defineProperty(this.#canvasPrototype, "getContext", {
      configurable: true,
      writable: true,
      value: maskAsNative(
        patchedGetContext,
        createNativeSource("getContext"),
        this.#nativeGetContext.length,
      ),
    });
  }

  #getNativeGlobalAlpha(
    context: OffscreenCanvasRenderingContext2D,
  ): number | undefined {
    if (!this.#nativeGlobalAlphaGetter) return undefined;
    try {
      return Reflect.apply(this.#nativeGlobalAlphaGetter, context, []) as number;
    } catch {
      return undefined;
    }
  }

  #patchMutationMethod(property: string, clearsBitmap = false): void {
    const nativeMethod = (this.#contextPrototype as unknown as Record<string, unknown>)[
      property
    ];
    if (typeof nativeMethod !== "function") return;
    const patch = this;
    const wrapper = {
      [property](this: OffscreenCanvasRenderingContext2D, ...args: unknown[]): unknown {
        const result = Reflect.apply(nativeMethod, this, args);
        const canvas = this.canvas;
        patch.#contextByCanvas.set(canvas, this);
        patch.#tracker[1](canvas);
        if (clearsBitmap) {
          patch.#contextsWithPath.delete(this);
          markCanvasContentBlank(canvas);
        } else if (
          !isCanvasMutationNoOp(property, args, {
            currentPathEmpty: !patch.#contextsWithPath.has(this),
            globalAlpha: patch.#getNativeGlobalAlpha(this),
          }) &&
          (property !== "clearRect" || getCanvasContentState(canvas) === "dirty")
        ) {
          markCanvasContentDirty(canvas);
        }
        return result;
      },
    }[property]!;
    this.#defineMethod(property, wrapper, nativeMethod.length);
  }

  #patchPathMethod(property: string, clearsPath = false): void {
    const nativeMethod = (this.#contextPrototype as unknown as Record<string, unknown>)[
      property
    ];
    if (typeof nativeMethod !== "function") return;
    const patch = this;
    const wrapper = {
      [property](this: OffscreenCanvasRenderingContext2D, ...args: unknown[]): unknown {
        const result = Reflect.apply(nativeMethod, this, args);
        patch.#contextByCanvas.set(this.canvas, this);
        if (clearsPath) patch.#contextsWithPath.delete(this);
        else patch.#contextsWithPath.add(this);
        return result;
      },
    }[property]!;
    this.#defineMethod(property, wrapper, nativeMethod.length);
  }

  #defineMethod(property: string, value: Function, length: number): void {
    Object.defineProperty(this.#contextPrototype, property, {
      configurable: true,
      writable: true,
      value: maskAsNative(value, createNativeSource(property), length),
    });
  }

  #patchSizeSetter(property: "width" | "height"): void {
    const descriptor = Object.getOwnPropertyDescriptor(this.#canvasPrototype, property);
    if (!descriptor?.set) return;
    const nativeSetter = descriptor.set;
    const patch = this;
    const patchedSetter = maskAsNative(
      {
        set(this: OffscreenCanvas, value: number): void {
          Reflect.apply(nativeSetter, this, [value]);
          patch.#tracker[1](this);
          const context = patch.#contextByCanvas.get(this);
          if (context) patch.#contextsWithPath.delete(context);
          markCanvasContentBlank(this);
        },
      }.set,
      nativeSetter.toString(),
      nativeSetter.length,
    );
    const nextDescriptor: PropertyDescriptor = { set: patchedSetter };
    if (descriptor.configurable !== undefined)
      nextDescriptor.configurable = descriptor.configurable;
    if (descriptor.enumerable !== undefined)
      nextDescriptor.enumerable = descriptor.enumerable;
    if (descriptor.get !== undefined) nextDescriptor.get = descriptor.get;
    Object.defineProperty(this.#canvasPrototype, property, nextDescriptor);
  }

  #applyNativePut(input: NativePutInput): void {
    const args: unknown[] = [input.imageData, input.dx, input.dy];
    if (input.argumentCount > 3) args.push(input.dirtyX);
    if (input.argumentCount > 4) args.push(input.dirtyY);
    if (input.argumentCount > 5) args.push(input.dirtyWidth);
    if (input.argumentCount > 6) args.push(input.dirtyHeight);
    Reflect.apply(this.#nativePutImageData, input.context, args);
  }

  #patchPutImageData(): void {
    if (typeof this.#nativePutImageData !== "function") return;
    const patch = this;
    const patchedPutImageData = {
      // eslint-disable-next-line max-params -- Preserve the native Web API overload.
      putImageData(
        this: OffscreenCanvasRenderingContext2D,
        imageData: ImageData,
        dx: number,
        dy: number,
        dirtyX?: number,
        dirtyY?: number,
        dirtyWidth?: number,
        dirtyHeight?: number,
      ): void {
        patch.#applyNativePut({
          argumentCount: arguments.length,
          context: this,
          dirtyHeight,
          dirtyWidth,
          dirtyX,
          dirtyY,
          dx,
          dy,
          imageData,
        });
        if (
          getCanvasContentState(this.canvas) !== "blank" ||
          !isImageDataTransparent(imageData)
        ) {
          markCanvasContentDirty(this.canvas);
        }
        const write = [
          this.canvas,
          imageData,
          dx,
          dy,
          dirtyX,
          dirtyY,
          dirtyWidth,
          dirtyHeight,
        ] as const;
        if (patch.#tracker[0](write)) {
          patch.#tracker[4](write);
        } else {
          patch.#tracker[1](this.canvas);
        }
      },
    }.putImageData;
    this.#defineMethod(
      "putImageData",
      patchedPutImageData,
      this.#nativePutImageData.length,
    );
  }

  #patchGetImageData(): void {
    if (typeof this.#nativeGetImageData !== "function") return;
    const patch = this;
    const patchedGetImageData = {
      // eslint-disable-next-line max-params -- Preserve the native Web API overload.
      getImageData(
        this: OffscreenCanvasRenderingContext2D,
        sx: number,
        sy: number,
        sw: number,
        sh: number,
        settings?: ImageDataSettings,
      ): ImageData {
        const imageData = settings
          ? Reflect.apply(patch.#nativeGetImageData, this, [sx, sy, sw, sh, settings])
          : Reflect.apply(patch.#nativeGetImageData, this, [sx, sy, sw, sh]);
        if (isImageDataTransparent(imageData)) return imageData;
        markCanvasContentDirty(this.canvas);
        const read = [this.canvas, imageData, sx, sy] as const;
        if (patch.#tracker[2](read)) {
          patch.#tracker[3](read);
          return imageData;
        }
        const perturbed = perturbCanvasImageData(imageData, patch.#seed);
        patch.#tracker[3]([this.canvas, perturbed, sx, sy]);
        return perturbed;
      },
    }.getImageData;
    this.#defineMethod(
      "getImageData",
      patchedGetImageData,
      this.#nativeGetImageData.length,
    );
  }

  #isReadbackError(error: unknown): boolean {
    if (!(error instanceof this.#targetGlobal.Error)) return false;
    return error.name === "SecurityError" || error.name === "IndexSizeError";
  }

  #createExportCanvas(source: OffscreenCanvas): OffscreenCanvas | null {
    const copy = new this.#canvasCtor(source.width, source.height);
    if (copy.width === 0 || copy.height === 0) return copy;
    const context = Reflect.apply(this.#nativeGetContext, copy, [
      "2d",
      { willReadFrequently: true },
    ]) as OffscreenCanvasRenderingContext2D | null;
    if (!context) return null;
    try {
      Reflect.apply(this.#nativeDrawImage, context, [source, 0, 0]);
      const mutation = createExportMutation({
        width: copy.width,
        height: copy.height,
        seed: this.#seed,
        readImageData: (x, y, width, height) =>
          Reflect.apply(this.#nativeGetImageData, context, [
            x,
            y,
            width,
            height,
          ]) as ImageData,
        sourceKnownBlank: isCanvasKnownBlank(source),
      });
      if (mutation) {
        Reflect.apply(this.#nativePutImageData, context, [
          mutation.imageData,
          mutation.x,
          mutation.y,
        ]);
      }
      return copy;
    } catch (error) {
      return this.#isReadbackError(error) ? copy : null;
    }
  }

  #patchConvertToBlob(): void {
    const nativeConvertToBlob = this.#canvasPrototype.convertToBlob;
    if (typeof nativeConvertToBlob !== "function") return;
    const patch = this;
    const patchedConvertToBlob = {
      convertToBlob(
        this: OffscreenCanvas,
        options?: ImageEncodeOptions,
      ): Promise<Blob> {
        const exportCanvas = patch.#createExportCanvas(this) ?? this;
        return Reflect.apply(nativeConvertToBlob, exportCanvas, [options]);
      },
    }.convertToBlob;
    Object.defineProperty(this.#canvasPrototype, "convertToBlob", {
      configurable: true,
      writable: true,
      value: maskAsNative(
        patchedConvertToBlob,
        createNativeSource("convertToBlob"),
        nativeConvertToBlob.length,
      ),
    });
  }
}

/** Installs the shared OffscreenCanvas noise layer in a document or worker realm. */
export const installOffscreenNoise = (
  seed: number,
  logger?: OffscreenNoiseLogger,
  targetGlobal: typeof globalThis = globalThis,
): boolean => {
  const canvasCtor = targetGlobal.OffscreenCanvas;
  const contextCtor = targetGlobal.OffscreenCanvasRenderingContext2D;
  if (!canvasCtor || !contextCtor) return false;
  if (patchedOffscreenProtos.has(contextCtor.prototype)) return true;
  patchedOffscreenProtos.add(contextCtor.prototype);
  new OffscreenPatch(seed, logger, targetGlobal, [canvasCtor, contextCtor]).install();
  return true;
};
