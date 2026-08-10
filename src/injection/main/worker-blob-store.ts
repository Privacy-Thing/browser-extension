import { createWorkerSource } from "@privacy-brand/refract-browser/common/worker-bootstrap";
import { requireNewTarget } from "@privacy-brand/refract-core/native/constructor-wiring";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";

import type { RuntimeSnapshot } from "@/shared/types";

export class WorkerBlobStore {
  readonly #blobSourceText = new WeakMap<Blob, string>();
  readonly #blobUrlCache = new Map<string, Blob>();
  readonly #nativeBlob = Blob;
  readonly #nativeCreateUrl = URL.createObjectURL;
  readonly #nativeRevokeUrl = URL.revokeObjectURL;
  readonly #snapshot: RuntimeSnapshot;

  constructor(snapshot: RuntimeSnapshot) {
    this.#snapshot = snapshot;
  }

  installHooks(): void {
    const store = this;
    const patchedCreateUrl = (object: Blob | MediaSource): string => {
      const url = Reflect.apply(store.#nativeCreateUrl, URL, [object]) as string;
      if (object instanceof Blob) store.#cacheBlobUrl(url, object);
      return url;
    };
    const patchedRevokeUrl = (url: string): void => {
      store.#blobUrlCache.delete(url);
      Reflect.apply(store.#nativeRevokeUrl, URL, [url]);
    };
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: maskAsNative(patchedCreateUrl, createNativeSource("createObjectURL"), 1),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: maskAsNative(patchedRevokeUrl, createNativeSource("revokeObjectURL"), 1),
    });
    this.#installBlobConstructor();
  }

  createBootstrapUrl(
    scriptURL: string | URL,
    workerType: "classic" | "module",
    avoidImportPath: boolean,
  ): string | null {
    const originalUrl =
      scriptURL instanceof URL
        ? scriptURL.toString()
        : new URL(scriptURL, globalThis.location.href).toString();
    if (workerType === "classic" && originalUrl.startsWith("blob:")) {
      const cachedBlob = this.#getBlobUrl(originalUrl);
      const inlineSource = cachedBlob
        ? this.#blobSourceText.get(cachedBlob)
        : undefined;
      if (inlineSource !== undefined) {
        return this.#buildBootstrapUrl(
          createWorkerSource({
            snapshot: this.#snapshot,
            workerUrl: originalUrl,
            workerType,
            inlineSource,
          }),
        );
      }
    }
    if (avoidImportPath) return null;
    let workerUrl = originalUrl;
    if (workerUrl.startsWith("blob:")) {
      const cachedBlob = this.#getBlobUrl(workerUrl);
      if (cachedBlob) {
        workerUrl = Reflect.apply(this.#nativeCreateUrl, URL, [cachedBlob]) as string;
      }
    }
    return this.#buildBootstrapUrl(
      createWorkerSource({
        snapshot: this.#snapshot,
        workerUrl,
        workerType,
      }),
    );
  }

  revokeBootstrapUrl(url: string): void {
    Reflect.apply(this.#nativeRevokeUrl, URL, [url]);
  }

  #installBlobConstructor(): void {
    const store = this;
    const NativeBlob = this.#nativeBlob;
    const PatchedBlob = function (
      this: Blob,
      parts?: BlobPart[],
      options?: BlobPropertyBag,
    ): Blob {
      const constructorTarget = requireNewTarget(NativeBlob, new.target, [
        parts,
        options,
      ]);
      const blob = Reflect.construct(
        NativeBlob,
        [(parts ?? []) as BlobPart[], options],
        constructorTarget,
      ) as Blob;
      store.#captureSource(blob, parts, options);
      return blob;
    } as unknown as typeof Blob;
    Object.defineProperty(PatchedBlob, "prototype", {
      configurable: false,
      enumerable: false,
      value: NativeBlob.prototype,
      writable: false,
    });
    Object.defineProperty(globalThis, "Blob", {
      configurable: true,
      writable: true,
      value: maskAsNative(PatchedBlob, createNativeSource("Blob"), NativeBlob.length),
    });
  }

  #cacheBlobUrl(url: string, blob: Blob): void {
    this.#blobUrlCache.delete(url);
    this.#blobUrlCache.set(url, blob);
    if (this.#blobUrlCache.size > 128) {
      const oldest = this.#blobUrlCache.keys().next().value;
      if (oldest !== undefined) this.#blobUrlCache.delete(oldest);
    }
  }

  #getBlobUrl(url: string): Blob | undefined {
    const blob = this.#blobUrlCache.get(url);
    if (blob !== undefined) this.#cacheBlobUrl(url, blob);
    return blob;
  }

  #captureSource(
    blob: Blob,
    parts: BlobPart[] | undefined,
    options: BlobPropertyBag | undefined,
  ): void {
    try {
      const type = (options?.type ?? "").toLowerCase();
      if (
        (type === "" || type.includes("javascript") || type.includes("ecmascript")) &&
        Array.isArray(parts) &&
        parts.length > 0 &&
        parts.every((part) => typeof part === "string")
      ) {
        this.#blobSourceText.set(blob, (parts as string[]).join(""));
      }
    } catch {
      // Capture is best effort; the import path remains available.
    }
  }

  #buildBootstrapUrl(source: string): string {
    const blob = new this.#nativeBlob([source], { type: "text/javascript" });
    return Reflect.apply(this.#nativeCreateUrl, URL, [blob]) as string;
  }
}
