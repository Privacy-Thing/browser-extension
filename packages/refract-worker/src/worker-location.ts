import { defineNativeGetter } from "@privacy-brand/refract-core/native/native-getter";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";

declare const WorkerLocation: any;

export const installWorkerLocation = (originalUrl: string): void => {
  const parsed = new URL(originalUrl);

  if (typeof WorkerLocation !== "undefined") {
    const target = WorkerLocation.prototype;
    defineNativeGetter(target, "href", () => parsed.href);
    defineNativeGetter(target, "origin", () => parsed.origin);
    defineNativeGetter(target, "protocol", () => parsed.protocol);
    defineNativeGetter(target, "host", () => parsed.host);
    defineNativeGetter(target, "hostname", () => parsed.hostname);
    defineNativeGetter(target, "port", () => parsed.port);
    defineNativeGetter(target, "pathname", () => parsed.pathname);
    defineNativeGetter(target, "search", () => parsed.search);
    defineNativeGetter(target, "hash", () => parsed.hash);

    Object.defineProperty(target, "toString", {
      configurable: true,
      value: maskAsNative(function toString() {
        return parsed.href;
      }, createNativeSource("toString")),
    });
  }

  const workerGlobal = self as typeof self & {
    importScripts?: (...urls: string[]) => void;
  };

  if (typeof workerGlobal.importScripts === "function") {
    const nativeImportScripts = workerGlobal.importScripts;
    workerGlobal.importScripts = maskAsNative(function importScripts(
      this: unknown,
      ...urls: string[]
    ) {
      const absoluteUrls = urls.map((url) => new URL(url, parsed.href).toString());
      return Reflect.apply(nativeImportScripts, this, absoluteUrls);
    }, createNativeSource("importScripts"));
  }

  if (typeof self.fetch === "function") {
    const nativeFetch = self.fetch;
    self.fetch = maskAsNative(function fetch(
      this: unknown,
      input: RequestInfo | URL,
      init?: RequestInit,
    ) {
      let targetReq: RequestInfo | URL = input;
      if (typeof input === "string") {
        targetReq = new URL(input, parsed.href).toString();
      } else if (input instanceof URL) {
        targetReq = new URL(input.href, parsed.href).toString();
      } else if (typeof Request !== "undefined" && input instanceof Request) {
        const absoluteUrl = new URL(input.url, parsed.href).toString();
        targetReq = new Request(absoluteUrl, input);
      }
      return Reflect.apply(nativeFetch, this, [targetReq, init]);
    }, createNativeSource("fetch"));
  }

  // Resolve a string/URL against the real worker URL. Absolute inputs ignore the
  // base, so only genuinely relative URLs are repaired.
  const resolveAgainstWorker = (url: string | URL): string =>
    new URL(typeof url === "string" ? url : url.href, parsed.href).toString();

  // XMLHttpRequest.open: the proven failure surface. Inside a blob: worker a
  // relative `open()` URL resolves against the blob base and throws
  // "Invalid URL", so the page's worker retries forever. Rewrite the URL while
  // preserving the optional async/user/password arguments.
  if (
    typeof XMLHttpRequest !== "undefined" &&
    typeof XMLHttpRequest.prototype.open === "function"
  ) {
    const nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = maskAsNative(function open(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      return Reflect.apply(nativeOpen, this, [
        method,
        resolveAgainstWorker(url),
        ...rest,
      ]);
    }, createNativeSource("open"));
  }

  // WebSocket / EventSource carry the same relative-base hazard. Wrap their
  // constructors so a relative first argument resolves against the real worker
  // URL before the native parser sees it (new URL normalizes http(s)→ the
  // WebSocket constructor accepts the result).
  const patchUrlConstructor = <T>(name: "WebSocket" | "EventSource"): void => {
    const workerGlobalAny = self as unknown as Record<string, unknown>;
    const Native = workerGlobalAny[name] as
      (new (url: string | URL, opts?: T) => unknown) | undefined;
    if (typeof Native !== "function") {
      return;
    }

    const Patched = function (this: unknown, url: string | URL, opts?: T) {
      return Reflect.construct(
        Native,
        opts === undefined
          ? [resolveAgainstWorker(url)]
          : [resolveAgainstWorker(url), opts],
        new.target ?? Patched,
      );
    } as unknown as typeof Native;

    Object.defineProperty(Patched, "prototype", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: (Native as unknown as { prototype: unknown }).prototype,
    });

    // Carry over readyState constants and any other static properties.
    for (const key of Object.getOwnPropertyNames(Native)) {
      if (key === "prototype" || key === "length" || key === "name") {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(Native, key);
      if (descriptor) {
        Object.defineProperty(Patched, key, descriptor);
      }
    }

    workerGlobalAny[name] = maskAsNative(
      Patched,
      createNativeSource(name),
      (Native as unknown as { length: number }).length,
    );
  };

  patchUrlConstructor("WebSocket");
  patchUrlConstructor("EventSource");
};
