import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import {
  getCanvasContentState,
  isCanvasKnownBlank,
  isCanvasMutationNoOp,
  markCanvasBlank,
  markCanvasContentBlank,
  markCanvasContentDirty,
} from "@privacy-brand/refract-core/fingerprint/canvas-content-state";
import { isCanvasReadbackError } from "@privacy-brand/refract-core/fingerprint/canvas-error-handling";
import {
  createExportMutation,
  isImageDataTransparent,
  perturbCanvasImageData,
} from "@privacy-brand/refract-core/fingerprint/canvas-noise";
import {
  createCanvasReadTracker,
  type CanvasReadbackTracker,
} from "@privacy-brand/refract-core/fingerprint/canvas-readback-tracker";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import { markPatchAnchor } from "@privacy-brand/refract-core/runtime/patch-marker";

type RuntimeLogger = (
  event: string,
  args: unknown[],
  meta?: Record<string, unknown>,
) => void;

export type CanvasInstallOptions = {
  canvasPrototype: HTMLCanvasElement;
  contextPrototype: CanvasRenderingContext2D;
  getSeed(): number | undefined;
  getStateVersion(): number;
  logOnce: RuntimeLogger;
  markerKey: string;
};

export type CanvasInstallResult = {
  getImageData: Function;
  toBlob: Function;
  toDataURL: Function;
};

type NativePutInput = {
  argumentCount: number;
  context: CanvasRenderingContext2D;
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

class CanvasPatchInstaller {
  readonly #contextByCanvas = new WeakMap<object, object>();
  readonly #contextsWithPath = new WeakSet<object>();
  readonly #nativeDrawImage: CanvasRenderingContext2D["drawImage"];
  readonly #nativeGetContext: HTMLCanvasElement["getContext"];
  readonly #nativeGetImageData: CanvasRenderingContext2D["getImageData"];
  readonly #nativeGlobalAlphaGetter: PropertyDescriptor["get"];
  readonly #nativePutImageData: CanvasRenderingContext2D["putImageData"];
  readonly #nativeWidthGetter: PropertyDescriptor["get"];
  readonly #options: CanvasInstallOptions;
  readonly #tracker: CanvasReadbackTracker<HTMLCanvasElement>;

  constructor(options: CanvasInstallOptions) {
    this.#options = options;
    this.#nativeGetContext = options.canvasPrototype.getContext;
    this.#nativeDrawImage = options.contextPrototype.drawImage;
    this.#nativeGetImageData = options.contextPrototype.getImageData;
    this.#nativePutImageData = options.contextPrototype.putImageData;
    this.#nativeGlobalAlphaGetter = Object.getOwnPropertyDescriptor(
      options.contextPrototype,
      "globalAlpha",
    )?.get;
    this.#nativeWidthGetter = Object.getOwnPropertyDescriptor(
      options.canvasPrototype,
      "width",
    )?.get;
    this.#tracker = createCanvasReadTracker<HTMLCanvasElement>(
      options.getSeed,
      options.getStateVersion,
    );
  }

  install(): CanvasInstallResult {
    this.#patchGetContext();
    this.#patchPutImageData();
    const getImageData = this.#patchGetImageData();
    for (const property of mutationMethods) this.#patchMutationMethod(property);
    this.#patchMutationMethod("reset", true);
    this.#patchPathMethod("beginPath", true);
    for (const property of pathMethods) this.#patchPathMethod(property);
    this.#patchSizeSetter("width");
    this.#patchSizeSetter("height");
    const { toBlob, toDataURL } = this.#patchExports();
    return { getImageData, toBlob, toDataURL };
  }

  #patchGetContext(): void {
    const installer = this;
    const seenCanvases = new WeakSet<HTMLCanvasElement>();
    const patchedGetContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      options?: unknown,
    ): RenderingContext | null {
      if (contextId === "2d" && !seenCanvases.has(this)) {
        seenCanvases.add(this);
        const opts = (
          typeof options === "object" && options !== null ? options : {}
        ) as CanvasRenderingContext2DSettings;
        if (opts.willReadFrequently === undefined) {
          const context = Reflect.apply(installer.#nativeGetContext, this, [
            contextId,
            { ...opts, willReadFrequently: true },
          ]);
          if (context !== null) {
            installer.#contextByCanvas.set(this, context);
            markCanvasBlank(this);
            return context;
          }
        }
      }
      const context =
        options !== undefined
          ? Reflect.apply(installer.#nativeGetContext, this, [contextId, options])
          : Reflect.apply(installer.#nativeGetContext, this, [contextId]);
      if (context !== null && contextId !== "2d") {
        markCanvasContentDirty(this);
      } else if (context !== null) {
        installer.#contextByCanvas.set(this, context);
        markCanvasBlank(this);
      }
      return context;
    };
    Object.defineProperty(this.#options.canvasPrototype, "getContext", {
      configurable: true,
      writable: true,
      value: maskAsNative(
        patchedGetContext,
        createNativeSource("getContext"),
        this.#nativeGetContext.length,
      ),
    });
  }

  #getNativeGlobalAlpha(context: CanvasRenderingContext2D): number | undefined {
    if (!this.#nativeGlobalAlphaGetter) return undefined;
    try {
      return Reflect.apply(this.#nativeGlobalAlphaGetter, context, []) as number;
    } catch {
      return undefined;
    }
  }

  #patchMutationMethod(
    property: keyof CanvasRenderingContext2D,
    clearsBitmap = false,
  ): void {
    const nativeMethod = this.#options.contextPrototype[property];
    if (typeof nativeMethod !== "function") return;
    const installer = this;
    const patchedMethod = function (
      this: CanvasRenderingContext2D,
      ...args: unknown[]
    ): unknown {
      const result = Reflect.apply(nativeMethod, this, args);
      const canvas = this.canvas;
      if (!canvas || typeof canvas !== "object") return result;
      installer.#contextByCanvas.set(canvas, this);
      installer.#tracker[1](canvas);
      if (clearsBitmap) {
        installer.#contextsWithPath.delete(this);
        markCanvasContentBlank(canvas);
      } else if (
        !isCanvasMutationNoOp(String(property), args, {
          currentPathEmpty: !installer.#contextsWithPath.has(this),
          globalAlpha: installer.#getNativeGlobalAlpha(this),
        }) &&
        (property !== "clearRect" || getCanvasContentState(canvas) === "dirty")
      ) {
        markCanvasContentDirty(canvas);
      }
      return result;
    };
    this.#defineContextMethod(property, patchedMethod, nativeMethod.length);
  }

  #patchPathMethod(property: keyof CanvasRenderingContext2D, clearsPath = false): void {
    const nativeMethod = this.#options.contextPrototype[property];
    if (typeof nativeMethod !== "function") return;
    const installer = this;
    const patchedMethod = function (
      this: CanvasRenderingContext2D,
      ...args: unknown[]
    ): unknown {
      const result = Reflect.apply(nativeMethod, this, args);
      const canvas = this.canvas;
      if (canvas && typeof canvas === "object") {
        installer.#contextByCanvas.set(canvas, this);
      }
      if (clearsPath) installer.#contextsWithPath.delete(this);
      else installer.#contextsWithPath.add(this);
      return result;
    };
    this.#defineContextMethod(property, patchedMethod, nativeMethod.length);
  }

  #defineContextMethod(property: PropertyKey, value: Function, length: number): void {
    Object.defineProperty(this.#options.contextPrototype, property, {
      configurable: true,
      writable: true,
      value: maskAsNative(value, createNativeSource(String(property)), length),
    });
  }

  #patchSizeSetter(property: "width" | "height"): void {
    const descriptor = Object.getOwnPropertyDescriptor(
      this.#options.canvasPrototype,
      property,
    );
    if (!descriptor?.set) return;
    const nativeSetter = descriptor.set;
    const installer = this;
    Object.defineProperty(this.#options.canvasPrototype, property, {
      configurable: descriptor.configurable ?? true,
      enumerable: descriptor.enumerable ?? false,
      ...(descriptor.get ? { get: descriptor.get } : {}),
      set: maskAsNative(
        function (this: HTMLCanvasElement, value: number): void {
          Reflect.apply(nativeSetter, this, [value]);
          installer.#tracker[1](this);
          const context = installer.#contextByCanvas.get(this);
          if (context) installer.#contextsWithPath.delete(context);
          markCanvasContentBlank(this);
        },
        nativeSetter.toString(),
        nativeSetter.length,
      ),
    });
  }

  #applyNativePut(input: NativePutInput): void {
    const args: [ImageData, number, number, number?, number?, number?, number?] = [
      input.imageData,
      input.dx,
      input.dy,
    ];
    if (input.argumentCount > 3) args.push(input.dirtyX);
    if (input.argumentCount > 4) args.push(input.dirtyY);
    if (input.argumentCount > 5) args.push(input.dirtyWidth);
    if (input.argumentCount > 6) args.push(input.dirtyHeight);
    Reflect.apply(this.#nativePutImageData, input.context, args);
  }

  #patchPutImageData(): void {
    if (typeof this.#nativePutImageData !== "function") return;
    const installer = this;
    // eslint-disable-next-line max-params -- Preserve the native Web API overload.
    const patchedPutImageData = function (
      this: CanvasRenderingContext2D,
      imageData: ImageData,
      dx: number,
      dy: number,
      dirtyX?: number,
      dirtyY?: number,
      dirtyWidth?: number,
      dirtyHeight?: number,
    ): void {
      installer.#applyNativePut({
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
      const canvas = this.canvas;
      if (!canvas || typeof canvas !== "object") return;
      installer.#contextByCanvas.set(canvas, this);
      if (
        getCanvasContentState(canvas) !== "blank" ||
        !isImageDataTransparent(imageData)
      ) {
        markCanvasContentDirty(canvas);
      }
      const write = [
        canvas,
        imageData,
        dx,
        dy,
        dirtyX,
        dirtyY,
        dirtyWidth,
        dirtyHeight,
      ] as const;
      if (installer.#tracker[0](write)) installer.#tracker[4](write);
      else installer.#tracker[1](canvas);
    };
    this.#defineContextMethod(
      "putImageData",
      patchedPutImageData,
      this.#nativePutImageData.length,
    );
  }

  #patchGetImageData(): Function {
    const installer = this;
    const patchedGetImageData = {
      // eslint-disable-next-line max-params -- Preserve the native Web API overload.
      getImageData(
        this: CanvasRenderingContext2D,
        sx: number,
        sy: number,
        sw: number,
        sh: number,
        settings?: ImageDataSettings,
      ): ImageData {
        const imageData = settings
          ? Reflect.apply(installer.#nativeGetImageData, this, [
              sx,
              sy,
              sw,
              sh,
              settings,
            ])
          : Reflect.apply(installer.#nativeGetImageData, this, [sx, sy, sw, sh]);
        if (isImageDataTransparent(imageData)) return imageData;
        const canvas = this.canvas;
        const read = [canvas, imageData, sx, sy] as const;
        if (canvas && typeof canvas === "object") {
          installer.#contextByCanvas.set(canvas, this);
          markCanvasContentDirty(canvas);
          if (installer.#tracker[2](read)) {
            installer.#tracker[3](read);
            return imageData;
          }
        }
        const seed = installer.#options.getSeed();
        const perturbed =
          seed === undefined ? imageData : perturbCanvasImageData(imageData, seed);
        if (canvas && typeof canvas === "object") {
          installer.#tracker[3]([canvas, perturbed, sx, sy]);
        }
        markSurfaceUsed("canvas", "canvas.getImageData");
        installer.#options.logOnce("getImageData", [sx, sy, sw, sh], {
          height: perturbed.height,
          width: perturbed.width,
        });
        return perturbed;
      },
    }.getImageData;
    const masked = maskAsNative(
      patchedGetImageData,
      createNativeSource("getImageData"),
      4,
    );
    markPatchAnchor(masked, this.#options.markerKey, "getImageData");
    Object.defineProperty(this.#options.contextPrototype, "getImageData", {
      configurable: true,
      writable: true,
      value: masked,
    });
    return masked;
  }

  #createExportCanvas(source: HTMLCanvasElement): HTMLCanvasElement | null {
    const seed = this.#options.getSeed();
    if (seed === undefined) return null;
    const copy = source.ownerDocument.createElement("canvas");
    copy.width = source.width;
    copy.height = source.height;
    if (copy.width === 0 || copy.height === 0) return copy;
    const context = Reflect.apply(this.#nativeGetContext, copy, [
      "2d",
      { willReadFrequently: true },
    ]) as CanvasRenderingContext2D | null;
    if (!context) return null;
    try {
      Reflect.apply(this.#nativeDrawImage, context, [source, 0, 0]);
      const mutation = createExportMutation({
        width: copy.width,
        height: copy.height,
        seed,
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
      return isCanvasReadbackError(error) ? copy : null;
    }
  }

  #hasValidCanvasReceiver(canvas: HTMLCanvasElement): boolean {
    if (!this.#nativeWidthGetter) return true;
    try {
      Reflect.apply(this.#nativeWidthGetter, canvas, []);
      return true;
    } catch {
      return false;
    }
  }

  #patchExports(): Pick<CanvasInstallResult, "toBlob" | "toDataURL"> {
    const nativeToDataURL = this.#options.canvasPrototype.toDataURL;
    const nativeToBlob = this.#options.canvasPrototype.toBlob;
    const installer = this;
    const patchedToDataURL = {
      toDataURL(this: HTMLCanvasElement, type?: string, quality?: unknown): string {
        if (!installer.#hasValidCanvasReceiver(this)) {
          return Reflect.apply(nativeToDataURL, this, [type, quality]);
        }
        const exportCanvas = installer.#createExportCanvas(this) ?? this;
        markSurfaceUsed("canvas", "canvas.toDataURL");
        const dataUrl = Reflect.apply(nativeToDataURL, exportCanvas, [type, quality]);
        installer.#options.logOnce("toDataURL", [type, quality], {
          height: this.height,
          length: dataUrl.length,
          width: this.width,
        });
        return dataUrl;
      },
    }.toDataURL;
    const patchedToBlob = {
      toBlob(
        this: HTMLCanvasElement,
        callback: BlobCallback,
        type?: string,
        quality?: unknown,
      ): void {
        if (!installer.#hasValidCanvasReceiver(this)) {
          return Reflect.apply(nativeToBlob, this, [callback, type, quality]);
        }
        const exportCanvas = installer.#createExportCanvas(this) ?? this;
        markSurfaceUsed("canvas", "canvas.toBlob");
        installer.#options.logOnce("toBlob", [type, quality], {
          height: this.height,
          width: this.width,
        });
        return Reflect.apply(nativeToBlob, exportCanvas, [callback, type, quality]);
      },
    }.toBlob;
    const toDataURL = this.#maskExport("toDataURL", patchedToDataURL, 0);
    const toBlob = this.#maskExport("toBlob", patchedToBlob, 1);
    return { toBlob, toDataURL };
  }

  #maskExport(property: "toBlob" | "toDataURL", fn: Function, length: number) {
    const masked = maskAsNative(fn, createNativeSource(property), length);
    markPatchAnchor(masked, this.#options.markerKey, property);
    Object.defineProperty(this.#options.canvasPrototype, property, {
      configurable: true,
      writable: true,
      value: masked,
    });
    return masked;
  }
}

export const installCanvasMethods = (
  options: CanvasInstallOptions,
): CanvasInstallResult => new CanvasPatchInstaller(options).install();
