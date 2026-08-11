import { createLogger } from "@privacy-brand/refract-browser/common/debug-logger";
import {
  markSurfaceEvidence,
  markSurfaceFailed,
} from "@privacy-brand/refract-browser/common/surface-error-emitter";
import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import { attachWorkerAckRelay } from "@privacy-brand/refract-browser/common/worker-bootstrap-ack-relay";
import { constructRevokedBlob } from "@privacy-brand/refract-browser/common/worker-construction";
import { attachWorkerLogRelay } from "@privacy-brand/refract-browser/common/worker-runtime-log-relay";
import { requireNewTarget } from "@privacy-brand/refract-core/native/constructor-wiring";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import {
  inspectPatchAnchors,
  markPatchAnchor,
} from "@privacy-brand/refract-core/runtime/patch-marker";

import { WorkerBlobStore } from "./worker-blob-store";

import { ExtensionLogLevel } from "@/shared/logging-types";
import type { XRaySurfaceCategory, RuntimeSnapshot } from "@/shared/types";
import {
  WORKER_ATTEMPT_EVENT,
  WORKER_CSP_BLOCKED_EVENT,
  WORKER_STRICT_BLOCKED,
  type WorkerAttemptOutcome,
  type WorkerAttemptReason,
  SW_STRICT_BLOCKED_EVENT,
  type WorkerStrictReason,
} from "@/shared/worker-compatibility";

type ExtendedGlobal = typeof globalThis & {
  SharedWorker?: typeof SharedWorker;
};

type SharedWorkerMode = NonNullable<RuntimeSnapshot["sharedWorkerHandlingMode"]>;

export type WorkerPatchOptions = {
  includeSharedWorker?: boolean;
};

export type WorkerPatchOwnership = {
  sharedWorker: boolean;
  worker: boolean;
};

type WorkerFallbackInput = {
  constructNative(url: string | URL): Worker;
  phase: string;
  reason: WorkerAttemptReason;
  scriptURL: string | URL;
  strictMode: boolean;
};

type SharedFallbackInput = {
  constructorTarget: Function;
  options: string | WorkerOptions | undefined;
  phase: string;
  reason: WorkerStrictReason;
  scriptURL: string | URL;
  strictMode: boolean;
};

export const getWorkerMode = (snapshot: RuntimeSnapshot): SharedWorkerMode =>
  snapshot.sharedWorkerHandlingMode ??
  (snapshot.sharedWorkerCompatibilityMode === false ? "spoof" : "native");

const shouldWrapShared = (snapshot: RuntimeSnapshot): boolean =>
  getWorkerMode(snapshot) !== "native";

const createBlockedError = (
  kind: "Worker" | "SharedWorker",
  scriptURL: string | URL,
): Error => {
  const message = `${kind} script ${String(scriptURL)} was blocked by Privacy Thing strict mode because spoofing could not be confirmed.`;
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, "SecurityError");
  }
  const error = new Error(message);
  error.name = "SecurityError";
  return error;
};

export const isTopOrSameOriginFrame = (): boolean => {
  try {
    return globalThis.parent.location.origin === globalThis.location.origin;
  } catch {
    return false;
  }
};

const isCspBlockedError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === "SecurityError" ||
    error.name === "NetworkError" ||
    message.includes("content security policy") ||
    message.includes("content-security-policy") ||
    (message.includes("worker") && message.includes("blocked"))
  );
};

const isWorkerBootstrapFailure = (event: Event): boolean => {
  if (event.type === "error" && !(event instanceof ErrorEvent)) return true;
  if (!(event instanceof ErrorEvent)) return false;
  if (!event.message) return true;
  const message = `${event.message} ${event.filename}`.toLowerCase();
  return (
    message.includes("error during worker initialization") ||
    message.includes("failed to execute 'importscripts'") ||
    (message.includes("blob:") && message.includes("worker"))
  );
};

class WorkerPatchInstaller {
  readonly #blobStore: WorkerBlobStore;
  #cspBlobBlocked = false;
  #cspImportLatched = false;
  readonly #extendedGlobal = globalThis as ExtendedGlobal;
  readonly #includeShared: boolean;
  readonly #nativeSharedWorker: typeof SharedWorker | undefined;
  readonly #nativeWorker: typeof Worker | undefined;
  readonly #snapshot: RuntimeSnapshot;
  #workerAttemptCounter = 0;
  readonly #workerLogger;

  constructor(snapshot: RuntimeSnapshot, options: WorkerPatchOptions) {
    this.#snapshot = snapshot;
    this.#blobStore = new WorkerBlobStore(snapshot);
    this.#includeShared = options.includeSharedWorker ?? true;
    this.#nativeSharedWorker = this.#extendedGlobal.SharedWorker;
    this.#nativeWorker = typeof Worker === "undefined" ? undefined : Worker;
    this.#workerLogger = createLogger(snapshot, "Worker");
  }

  install(): WorkerPatchOwnership {
    if (!isTopOrSameOriginFrame()) {
      this.#emitWorkerAttempt("native-by-policy", "cross-origin-frame", {
        phase: "cross-origin-frame",
      });
      return { worker: false, sharedWorker: this.#installSharedBlock() };
    }
    const anchors = [
      ...(this.#nativeWorker
        ? [{ fn: this.#nativeWorker as Function, name: "Worker" }]
        : []),
      ...(this.#includeShared &&
      shouldWrapShared(this.#snapshot) &&
      this.#nativeSharedWorker
        ? [
            {
              fn: this.#nativeSharedWorker as Function,
              name: "SharedWorker",
            },
          ]
        : []),
    ];
    const anchorState = inspectPatchAnchors(__PT_WORKER_PATCH_GUARD_KEY__, anchors);
    if (anchorState === "installed") return this.#ownership();
    if (anchorState === "conflict") {
      throw new Error("Conflicting Worker patch anchors");
    }
    this.#blobStore.installHooks();
    this.#installDedicatedWorker();
    this.#installSharedWorker();
    return this.#ownership();
  }

  #ownership(): WorkerPatchOwnership {
    return {
      worker: typeof Worker === "function",
      sharedWorker:
        this.#includeShared &&
        shouldWrapShared(this.#snapshot) &&
        typeof this.#extendedGlobal.SharedWorker === "function",
    };
  }

  #emitSignal(method: string, details?: Record<string, unknown>): void {
    if (!this.#snapshot.logEventName) return;
    try {
      globalThis.postMessage({
        type: __PT_LOG_EVENT_TYPE__,
        eventName: this.#snapshot.logEventName,
        detail: JSON.stringify({
          component: "Worker",
          method,
          level: ExtensionLogLevel.Warn,
          args: [],
          result: details ?? null,
        }),
      });
    } catch {
      // Diagnostics must not break worker construction.
    }
  }

  #emitWorkerAttempt(
    outcome: WorkerAttemptOutcome,
    reason: WorkerAttemptReason,
    details: Record<string, unknown>,
  ): void {
    this.#emitSignal(WORKER_ATTEMPT_EVENT.replace("Worker.", ""), {
      ...details,
      outcome,
      reason,
      workerKind: "Worker",
    });
  }

  #emitWorkerBlocked(
    reason: WorkerAttemptReason,
    details: Record<string, unknown>,
  ): void {
    const attemptId = globalThis.crypto?.randomUUID?.();
    if (!this.#snapshot.authKey || !attemptId) return;
    this.#emitSignal(WORKER_STRICT_BLOCKED.replace("Worker.", ""), {
      ...details,
      authKey: this.#snapshot.authKey,
      attemptId,
      guard: __PT_SHIM_GUARD_KEY__,
      reason,
      workerKind: "Worker",
    });
  }

  #emitSharedBlocked(
    reason: WorkerStrictReason,
    details: Record<string, unknown>,
  ): void {
    const attemptId = globalThis.crypto?.randomUUID?.();
    if (!this.#snapshot.authKey || !attemptId) return;
    this.#emitSignal(SW_STRICT_BLOCKED_EVENT.replace("Worker.", ""), {
      ...details,
      authKey: this.#snapshot.authKey,
      attemptId,
      guard: __PT_SHIM_GUARD_KEY__,
      reason,
      workerKind: "SharedWorker",
    });
  }

  #emitCspBlocked(details: Record<string, unknown>): void {
    this.#emitSignal(WORKER_CSP_BLOCKED_EVENT.replace("Worker.", ""), details);
  }

  #installSharedBlock(): boolean {
    if (!this.#includeShared || getWorkerMode(this.#snapshot) !== "strict") {
      return false;
    }
    const NativeSharedWorker = this.#nativeSharedWorker;
    if (!NativeSharedWorker) return false;
    const anchorState = inspectPatchAnchors(__PT_WORKER_PATCH_GUARD_KEY__, [
      { fn: NativeSharedWorker, name: "SharedWorker" },
    ]);
    if (anchorState === "installed") return true;
    if (anchorState === "conflict") {
      throw new Error("Conflicting SharedWorker patch anchor");
    }
    const installer = this;
    const PatchedSharedWorker = function (
      this: SharedWorker,
      scriptURL: string | URL,
      options?: string | WorkerOptions,
    ): SharedWorker {
      requireNewTarget(NativeSharedWorker, new.target, [scriptURL, options]);
      installer.#emitSharedBlocked("strict-blocked", {
        workerKind: "SharedWorker",
        reason: "strict-blocked",
        url: String(scriptURL),
        phase: "cross-origin-frame",
      });
      throw createBlockedError("SharedWorker", scriptURL);
    } as unknown as typeof SharedWorker;
    this.#publishConstructor(
      "SharedWorker",
      PatchedSharedWorker,
      NativeSharedWorker.prototype,
      this.#extendedGlobal,
    );
    return true;
  }

  #publishConstructor(
    name: "Worker" | "SharedWorker",
    patched: Function,
    prototype: object,
    target: object,
  ): void {
    markPatchAnchor(patched, __PT_WORKER_PATCH_GUARD_KEY__, name);
    Object.defineProperty(patched, "prototype", {
      configurable: false,
      enumerable: false,
      value: prototype,
      writable: false,
    });
    Object.defineProperty(target, name, {
      configurable: true,
      value: maskAsNative(patched, createNativeSource(name), 1),
    });
  }

  #workerFallback(input: WorkerFallbackInput): Worker {
    if (input.strictMode) {
      this.#emitWorkerBlocked(input.reason, {
        phase: input.phase,
        url: String(input.scriptURL),
      });
      throw createBlockedError("Worker", input.scriptURL);
    }
    this.#emitWorkerAttempt("native-fallback", input.reason, {
      phase: input.phase,
      url: String(input.scriptURL),
    });
    markSurfaceFailed("worker");
    return input.constructNative(input.scriptURL);
  }

  #constructWorker(
    scriptURL: string | URL,
    options: WorkerOptions | undefined,
    newTarget: Function | undefined,
  ): Worker {
    const NativeWorker = this.#nativeWorker;
    if (!NativeWorker) {
      throw new Error("Worker constructor is unavailable");
    }
    const constructorTarget = requireNewTarget(NativeWorker, newTarget, [
      scriptURL,
      options,
    ]);
    const constructNative = (url: string | URL): Worker =>
      Reflect.construct(NativeWorker, [url, options], constructorTarget) as Worker;
    markSurfaceUsed("worker", "worker.constructor");
    const strictMode = getWorkerMode(this.#snapshot) === "strict";
    const urlString = String(scriptURL);
    if (urlString.startsWith("data:")) {
      this.#emitWorkerAttempt("native-by-policy", "data-url", {
        phase: "data-url",
        url: urlString,
      });
      return constructNative(scriptURL);
    }
    const fallback = (reason: WorkerAttemptReason, phase: string) =>
      this.#workerFallback({
        constructNative,
        phase,
        reason,
        scriptURL,
        strictMode,
      });
    if (this.#cspBlobBlocked) {
      return fallback("csp-wrapper-blocked", "constructor-latch");
    }
    try {
      const type = options?.type === "module" ? "module" : "classic";
      const blobUrl = this.#blobStore.createBootstrapUrl(
        scriptURL,
        type,
        this.#cspImportLatched,
      );
      if (blobUrl === null) return fallback("csp-import-blocked", "bootstrap-source");
      const worker = constructRevokedBlob(
        blobUrl,
        (url) => this.#blobStore.revokeBootstrapUrl(url),
        constructNative,
      );
      this.#attachDedicatedEvidence(worker, scriptURL);
      return worker;
    } catch (error) {
      if (!isCspBlockedError(error)) throw error;
      this.#cspBlobBlocked = true;
      this.#emitCspBlocked({
        workerKind: "Worker",
        url: String(scriptURL),
        phase: "constructor",
      });
      this.#workerLogger(
        "new Worker [fallback]",
        [String(scriptURL)],
        "CSP blocked blob worker — falling back to unspoofed worker",
      );
      return fallback("csp-wrapper-blocked", "constructor");
    }
  }

  #attachDedicatedEvidence(worker: Worker, scriptURL: string | URL): void {
    const attemptId = `worker-${++this.#workerAttemptCounter}`;
    attachWorkerLogRelay(this.#snapshot, worker);
    attachWorkerAckRelay(worker, {
      guard: __PT_SHIM_GUARD_KEY__,
      onBootstrapFailed: () => markSurfaceFailed("worker"),
      onIntegrityEvidence: (evidence) =>
        markSurfaceEvidence(evidence.surfaceId as XRaySurfaceCategory, {
          realmId: evidence.realmId,
          attemptId,
          integrity: evidence.status,
          ...(evidence.reasonCode ? { reasonCode: evidence.reasonCode } : {}),
        }),
    });
    worker.addEventListener(
      "error",
      (event) => {
        if (!isWorkerBootstrapFailure(event)) return;
        this.#cspImportLatched = true;
        this.#emitCspBlocked({
          workerKind: "Worker",
          url: String(scriptURL),
          phase: "bootstrap",
        });
      },
      { once: true },
    );
  }

  #installDedicatedWorker(): void {
    const NativeWorker = this.#nativeWorker;
    if (!NativeWorker) return;
    const installer = this;
    const PatchedWorker = function (
      this: Worker,
      scriptURL: string | URL,
      options?: WorkerOptions,
    ): Worker {
      return installer.#constructWorker(scriptURL, options, new.target);
    } as unknown as typeof Worker;
    this.#publishConstructor(
      "Worker",
      PatchedWorker,
      NativeWorker.prototype,
      globalThis,
    );
  }

  #sharedFallback(input: SharedFallbackInput): SharedWorker {
    if (input.strictMode) {
      this.#emitSharedBlocked(input.reason, {
        phase: input.phase,
        url: String(input.scriptURL),
      });
      throw createBlockedError("SharedWorker", input.scriptURL);
    }
    return Reflect.construct(
      this.#nativeSharedWorker!,
      [input.scriptURL, input.options as string | WorkerOptions],
      input.constructorTarget,
    ) as SharedWorker;
  }

  #constructSharedWorker(
    scriptURL: string | URL,
    options: string | WorkerOptions | undefined,
    newTarget: Function | undefined,
  ): SharedWorker {
    const NativeSharedWorker = this.#nativeSharedWorker!;
    const constructorTarget = requireNewTarget(NativeSharedWorker, newTarget, [
      scriptURL,
      options,
    ]);
    const constructNative = (url: string | URL): SharedWorker =>
      Reflect.construct(
        NativeSharedWorker,
        [url, options as string | WorkerOptions],
        constructorTarget,
      ) as SharedWorker;
    markSurfaceUsed("sharedWorker", "sharedWorker.constructor");
    const normalizedOptions = typeof options === "string" ? { name: options } : options;
    const type = normalizedOptions?.type === "module" ? "module" : "classic";
    const strictMode = getWorkerMode(this.#snapshot) === "strict";
    const fallback = (reason: WorkerStrictReason, phase: string) =>
      this.#sharedFallback({
        constructorTarget,
        options,
        phase,
        reason,
        scriptURL,
        strictMode,
      });
    if (String(scriptURL).startsWith("data:")) {
      return fallback("strict-blocked", "data-url");
    }
    if (this.#cspBlobBlocked) {
      return fallback("csp-wrapper-blocked", "constructor-latch");
    }
    try {
      const blobUrl = this.#blobStore.createBootstrapUrl(
        scriptURL,
        type,
        this.#cspImportLatched,
      );
      if (blobUrl === null) return fallback("rewrite-unavailable", "bootstrap-source");
      const worker = constructRevokedBlob(
        blobUrl,
        (url) => this.#blobStore.revokeBootstrapUrl(url),
        constructNative,
      );
      this.#attachSharedError(worker, scriptURL, blobUrl, strictMode);
      return worker;
    } catch (error) {
      if (!isCspBlockedError(error)) throw error;
      this.#cspBlobBlocked = true;
      if (strictMode) {
        this.#emitSharedBlocked("csp-wrapper-blocked", {
          phase: "constructor",
          url: String(scriptURL),
        });
      } else {
        this.#emitCspBlocked({
          workerKind: "SharedWorker",
          url: String(scriptURL),
          phase: "constructor",
        });
      }
      this.#workerLogger(
        "new SharedWorker [fallback]",
        [String(scriptURL)],
        "CSP blocked blob worker — falling back to unspoofed worker",
      );
      return fallback("csp-wrapper-blocked", "constructor");
    }
  }

  #attachSharedError(
    worker: SharedWorker,
    scriptURL: string | URL,
    blobUrl: string,
    strictMode: boolean,
  ): void {
    attachWorkerLogRelay(this.#snapshot, worker.port);
    worker.addEventListener(
      "error",
      (event) => {
        if (!isWorkerBootstrapFailure(event)) return;
        this.#cspImportLatched = true;
        if (strictMode) {
          this.#emitSharedBlocked("csp-wrapper-blocked", {
            blockedUri: blobUrl,
            phase: "bootstrap",
            url: String(scriptURL),
          });
        } else {
          this.#emitCspBlocked({
            workerKind: "SharedWorker",
            url: String(scriptURL),
            phase: "bootstrap",
          });
        }
      },
      { once: true },
    );
  }

  #installSharedWorker(): void {
    if (
      !this.#includeShared ||
      !shouldWrapShared(this.#snapshot) ||
      !this.#nativeSharedWorker
    ) {
      return;
    }
    const NativeSharedWorker = this.#nativeSharedWorker;
    const installer = this;
    const PatchedSharedWorker = function (
      this: SharedWorker,
      scriptURL: string | URL,
      options?: string | WorkerOptions,
    ): SharedWorker {
      return installer.#constructSharedWorker(scriptURL, options, new.target);
    } as unknown as typeof SharedWorker;
    this.#publishConstructor(
      "SharedWorker",
      PatchedSharedWorker,
      NativeSharedWorker.prototype,
      this.#extendedGlobal,
    );
  }
}

export const installWorkerPatch = (
  snapshot: RuntimeSnapshot,
  options: WorkerPatchOptions = {},
): WorkerPatchOwnership =>
  getWorkerMode(snapshot) === "native"
    ? { worker: false, sharedWorker: false }
    : new WorkerPatchInstaller(snapshot, options).install();
