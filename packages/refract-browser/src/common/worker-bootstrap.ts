/**
 * Generates inline worker bootstraps that replay the critical spoofing runtime
 * inside `Worker` and `SharedWorker` globals before the original script loads.
 */

import { safeJsonStringify } from "@privacy-brand/refract-core/runtime/safe-json";
import {
  COMPRESSED_WORKER_RUNTIME_SOURCE,
  WORKER_RUNTIME_SOURCE_BYTE_LENGTH,
} from "@privacy-brand/refract-worker";

import { applySnapshotFencing } from "@/shared/domain-fencing";
import type { RuntimeSnapshot } from "@/shared/types";

let workerRuntimeSource: string | undefined;

// Capture decoder intrinsics at document_start. Page code may replace these
// globals before constructing its first Worker, but must not enter Privacy Thing's
// bootstrap generation path.
const NativeTextDecoder = TextDecoder;
const NativeUint8Array = Uint8Array;
const nativeAtob = globalThis.atob;
const nativeCharCodeAt = String.prototype.charCodeAt;
const nativeDecode = TextDecoder.prototype.decode;
const nativeReflectApply = Reflect.apply;

const getWorkerRuntimeSource = (): string => {
  if (workerRuntimeSource !== undefined) {
    return workerRuntimeSource;
  }

  const binary = nativeReflectApply(nativeAtob, globalThis, [
    COMPRESSED_WORKER_RUNTIME_SOURCE,
  ]) as string;
  const compressed = new NativeUint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    compressed[index] = nativeReflectApply(nativeCharCodeAt, binary, [index]) as number;
  }
  const output = new NativeUint8Array(WORKER_RUNTIME_SOURCE_BYTE_LENGTH);
  let outputPosition = 0;
  let position = 0;
  while (position < compressed.length) {
    const flags = compressed[position++]!;
    for (let bit = 0; bit < 8 && position < compressed.length; bit += 1) {
      if ((flags & (1 << bit)) === 0) {
        output[outputPosition++] = compressed[position++]!;
        continue;
      }

      const prefix = compressed[position++]!;
      const suffix = compressed[position++]!;
      const compact = prefix >> 7;
      const full = 1 - compact;
      const offset = ((compact * ((prefix >> 3) & 0x0f) + full * prefix) << 8) | suffix;
      const length =
        compact * ((prefix & 0x07) + 4) + full * (compressed[position]! + 3);
      position += full;
      const matchStart = outputPosition - offset;
      for (let index = 0; index < length; index += 1) {
        output[outputPosition++] = output[matchStart + index]!;
      }
    }
  }

  workerRuntimeSource = nativeReflectApply(nativeDecode, new NativeTextDecoder(), [
    output,
  ]) as string;
  return workerRuntimeSource;
};

/**
 * Serializes runtime state for inline worker bootstraps while keeping the
 * generated source safe to embed inside a script string.
 */
const serializeSnapshot = (snapshot: RuntimeSnapshot): string =>
  safeJsonStringify(
    applySnapshotFencing(
      snapshot,
      typeof location === "object" && location ? location.hostname : "",
    ),
  );

/**
 * Wraps a worker URL with a small bootstrap that installs spoofed runtime
 * primitives before the original worker code starts executing.
 */
export type WorkerSourceOptions = {
  snapshot: RuntimeSnapshot;
  workerUrl: string;
  workerType: "classic" | "module";
  inlineSource?: string | undefined;
  sharedWorkerName?: string | undefined;
};

export const createWorkerSource = ({
  snapshot,
  workerUrl,
  workerType,
  inlineSource,
  sharedWorkerName,
}: WorkerSourceOptions): string => {
  const serializedSnapshot = serializeSnapshot(snapshot);
  const runtimeSource = getWorkerRuntimeSource();
  const serializedWorkerUrl = safeJsonStringify(workerUrl);
  const serializedWorkerName =
    sharedWorkerName === undefined ? null : safeJsonStringify(sharedWorkerName);
  const runtimeInstall = `(${runtimeSource})(
    Object.freeze(${serializedSnapshot}),
    ${serializedWorkerUrl},
    ${safeJsonStringify(__PT_LOG_EVENT_TYPE__)},
    ${safeJsonStringify(__PT_SHIM_GUARD_KEY__)},
    ${safeJsonStringify(__PT_WORKER_ACK_TYPE__)}
  );`;
  const sharedWorkerNamePrelude = serializedWorkerName
    ? `
  try {
    Object.defineProperty(globalThis, "name", {
      configurable: true,
      get: () => ${serializedWorkerName},
    });
  } catch { /* Native worker name remains available when it cannot be shadowed. */ }
`
    : "";

  // Inline path: splice the original worker source straight into the bootstrap so
  // it never calls importScripts()/fetch() on a blob: URL. A strict page CSP whose
  // script-src/connect-src omits blob: (e.g. Cloudflare challenge pages) blocks
  // those sub-resource loads and breaks the wrapped worker — and the failure is
  // async, so the constructor cannot fall back. When the caller captured the
  // original source at Blob construction we avoid the sub-resource load entirely.
  //
  // The original source MUST run at the worker's global scope so its top-level
  // `var`/`function` declarations stay global (matching importScripts() semantics).
  // The spoof runtime therefore runs first inside a self-invoking setup block that
  // installs its global getters synchronously, and the original source follows it
  // at top level — never nested inside the setup closure.
  if (inlineSource !== undefined && workerType === "classic") {
    return `
(() => {
  ${sharedWorkerNamePrelude}
  ${runtimeInstall}
})();
${inlineSource}
`;
  }

  // Classic workers try importScripts first and fall back to a synchronous
  // XHR + blob URL when the direct import is blocked by a restrictive
  // worker-src CSP (e.g. "worker-src blob:"). The XHR is subject to
  // connect-src rather than worker-src, so the fetched content can be
  // re-served as a blob: URL that the CSP does allow.
  //
  // Module workers use dynamic import() with the same XHR blob fallback and
  // top-level await, keeping module evaluation pending until the original module
  // has installed its handlers. importScripts() is not available there.
  const classicImport = `try {
  importScripts(${serializedWorkerUrl});
} catch (__gwErr) {
  (function() {
    var __xhr = new XMLHttpRequest();
    __xhr.open("GET", ${serializedWorkerUrl}, false);
    try { __xhr.send(); } catch (_) { throw __gwErr; }
    if (__xhr.status >= 200 && __xhr.status < 300) {
      var __blob = new Blob([__xhr.responseText], { type: "text/javascript" });
      var __blobUrl = URL.createObjectURL(__blob);
      try { importScripts(__blobUrl); } finally { URL.revokeObjectURL(__blobUrl); }
    } else {
      throw __gwErr;
    }
  })();
}`;

  const moduleImport = `try {
  await import(${serializedWorkerUrl});
} catch (__gwErr) {
  var __xhr = new XMLHttpRequest();
  __xhr.open("GET", ${serializedWorkerUrl}, false);
  try { __xhr.send(); } catch (_) { throw __gwErr; }
  if (__xhr.status >= 200 && __xhr.status < 300) {
    var __blob = new Blob([__xhr.responseText], { type: "text/javascript" });
    var __blobUrl = URL.createObjectURL(__blob);
    try { await import(__blobUrl); } finally { URL.revokeObjectURL(__blobUrl); }
  } else {
    throw __gwErr;
  }
}`;

  if (workerType === "module") {
    // Keep module evaluation pending until the original module installs its
    // handlers. An async IIFE would finish the bootstrap module immediately and
    // let queued message/connect events run while dynamic import was unresolved.
    return `
${sharedWorkerNamePrelude}
${runtimeInstall}
${moduleImport}
`;
  }

  return `
(() => {
  ${sharedWorkerNamePrelude}
  ${runtimeInstall}
  ${classicImport}
})()
`;
};
