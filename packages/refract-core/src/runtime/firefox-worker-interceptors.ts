import { createWorkerSource } from "@privacy-brand/refract-browser/common/worker-bootstrap";
import { attachWorkerAckRelay } from "@privacy-brand/refract-browser/common/worker-bootstrap-ack-relay";
import { constructRevokedBlob } from "@privacy-brand/refract-browser/common/worker-construction";
import { attachWorkerLogRelay } from "@privacy-brand/refract-browser/common/worker-runtime-log-relay";
import { attachWorkerUsageRelay } from "@privacy-brand/refract-browser/common/worker-surface-usage-relay";

import { defineNativeGetter } from "../native/native-getter";
import { createNativeSource, maskAsNative } from "../native/native-mask";
import type { RuntimeSnapshot } from "../types/snapshot";

import { inspectPatchAnchors, markPatchAnchor } from "./patch-marker";

type FxWorkerOptions = {
  buildRuntimeSnapshot: () => RuntimeSnapshot | null;
  syncBootstrapState: () => void;
  shouldBlockServiceWorker: () => boolean;
  emitWorkerCompatSignal: (
    workerKind: "Worker" | "SharedWorker",
    url: string,
    phase: "bootstrap" | "constructor",
  ) => void;
  /**
   * Owns ServiceWorker.register patching too when true (default, preserves
   * prior behavior/existing tests). Set to `false` when the caller already
   * has its own ServiceWorker.register patch with richer coverage (surface
   * usage tracking, debug logging, integrity anchoring) — installing both
   * would duplicate/conflict on the same guard key.
   */
  patchServiceWorker?: boolean;
  /**
   * Dedicated Worker shares SharedWorker's Strict/Native/Spoof policy — see
   * the identically-named helper in src/injection/main/index.ts. Only gates
   * the two *real* degrade paths (CSP-blocked construction, CSP-blocked
   * bootstrap); a `null` snapshot (no data yet — a timing race, not a
   * failure) always falls back to native regardless of mode.
   */
  resolveWorkerMode: () => "native" | "spoof" | "strict";
  /**
   * Feeds the existing surface-failure channel so X-Ray/popup stop showing
   * `Protected` for a page that used an unspoofed Worker (#111). Must not be
   * called for the `null`-snapshot native-by-policy path — that's a timing
   * race, not a protection regression.
   */
  markWorkerSurfaceFailed: () => void;
  /**
   * Feeds the worker-thread's own integrity-registry results (#111/#112) —
   * independent of `markWorkerSurfaceFailed` above, which only covers the
   * injection-time construction gap, not descriptor tampering inside an
   * already-running worker. Carries the full per-realm status.
   */
  markIntegrityEvidence?: (evidence: {
    surfaceId: string;
    status: "repaired" | "unconfirmed" | "unrecoverable";
    realmId: string;
    attemptId?: string;
    reasonCode?: string;
  }) => void;
};

const createWorkerBlockedError = (scriptURL: string | URL): Error => {
  const message = `Worker script ${String(scriptURL)} was blocked by Privacy Thing strict mode because spoofing could not be confirmed.`;
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, "SecurityError");
  }
  const error = new Error(message);
  error.name = "SecurityError";
  return error;
};

const isCspBlockedError = (error: unknown): error is Error =>
  error instanceof Error &&
  (error.name === "SecurityError" ||
    error.name === "NetworkError" ||
    /content security policy|content-security-policy/i.test(error.message) ||
    (/worker/i.test(error.message) && /blocked/i.test(error.message)));

const isWorkerBootstrapFailure = (event: Event): boolean => {
  if (event.type === "error" && !(event instanceof ErrorEvent)) {
    return true;
  }

  if (!(event instanceof ErrorEvent)) {
    return false;
  }

  if (!event.message) {
    return true;
  }

  const message = `${event.message} ${event.filename}`.toLowerCase();
  return (
    message.includes("error during worker initialization") ||
    message.includes("failed to execute 'importscripts'") ||
    (message.includes("blob:") && message.includes("worker"))
  );
};

const buildBlockedRegError = (scope: string, url: string): DOMException =>
  new DOMException(
    `Failed to register/update a ServiceWorker for scope ('${scope}'): ` +
      `The operation is insecure for script ('${url}').`,
    "SecurityError",
  );

type WorkerBootstrap = {
  bootstrapUrl: string;
  snapshot: RuntimeSnapshot;
};

const createBootstrapBlobUrl = (
  options: FxWorkerOptions,
  scriptURL: string | URL,
  workerType: "classic" | "module",
): WorkerBootstrap | null => {
  const snapshot = options.buildRuntimeSnapshot();
  if (!snapshot) return null;
  const workerUrl =
    scriptURL instanceof URL
      ? scriptURL.toString()
      : new URL(scriptURL, globalThis.location.href).toString();
  const blobSource = createWorkerSource({ snapshot, workerUrl, workerType });
  const blob = new Blob([blobSource], { type: "text/javascript" });
  return { bootstrapUrl: URL.createObjectURL(blob), snapshot };
};

type WorkerRelayInput = {
  options: FxWorkerOptions;
  worker: Worker;
  snapshot: RuntimeSnapshot;
  attemptId: string;
  sourceId: string;
  scriptURL: string | URL;
};

const attachWorkerRelays = ({
  options,
  worker,
  snapshot,
  attemptId,
  sourceId,
  scriptURL,
}: WorkerRelayInput): void => {
  attachWorkerLogRelay(snapshot, worker);
  attachWorkerUsageRelay(worker, {
    guard: __PT_SHIM_GUARD_KEY__,
    sourceId,
  });
  attachWorkerAckRelay(worker, {
    guard: __PT_SHIM_GUARD_KEY__,
    onBootstrapFailed: options.markWorkerSurfaceFailed,
    ...(options.markIntegrityEvidence
      ? {
          onIntegrityEvidence: (evidence) =>
            options.markIntegrityEvidence?.({ ...evidence, attemptId }),
        }
      : {}),
  });
  worker.addEventListener(
    "error",
    (event) => {
      if (!isWorkerBootstrapFailure(event)) return;
      // The worker was already returned, so only report this late degrade.
      options.emitWorkerCompatSignal("Worker", String(scriptURL), "bootstrap");
      options.markWorkerSurfaceFailed();
    },
    { once: true },
  );
};

const createPatchedWorker = (
  options: FxWorkerOptions,
  NativeWorker: typeof Worker,
): typeof Worker => {
  let attemptCounter = 0;
  return function (
    this: Worker,
    scriptURL: string | URL,
    workerOptions?: WorkerOptions,
  ): Worker {
    if (options.resolveWorkerMode() === "native") {
      return new NativeWorker(scriptURL, workerOptions);
    }
    const workerType = workerOptions?.type === "module" ? "module" : "classic";
    const bootstrap = createBootstrapBlobUrl(options, scriptURL, workerType);
    if (!bootstrap) return new NativeWorker(scriptURL, workerOptions);
    try {
      const worker = constructRevokedBlob(
        bootstrap.bootstrapUrl,
        URL.revokeObjectURL.bind(URL),
        (url) => new NativeWorker(url, workerOptions),
      );
      const sequence = ++attemptCounter;
      attachWorkerRelays({
        options,
        worker,
        snapshot: bootstrap.snapshot,
        attemptId: `worker-${sequence}`,
        sourceId: `worker:${sequence}`,
        scriptURL,
      });
      return worker;
    } catch (error) {
      if (!isCspBlockedError(error)) throw error;
      if (options.resolveWorkerMode() === "strict") {
        throw createWorkerBlockedError(scriptURL);
      }
      options.emitWorkerCompatSignal("Worker", String(scriptURL), "constructor");
      options.markWorkerSurfaceFailed();
      return new NativeWorker(scriptURL, workerOptions);
    }
  } as unknown as typeof Worker;
};

const installDedicatedWorker = (options: FxWorkerOptions): void => {
  const workerAnchors =
    typeof Worker === "function" ? [{ fn: Worker, name: "Worker" }] : [];
  const anchorState = inspectPatchAnchors(__PT_WORKER_PATCH_GUARD_KEY__, workerAnchors);
  if (anchorState === "conflict") {
    throw new Error("Worker patch anchor conflict");
  }
  if (anchorState !== "absent" || typeof Worker === "undefined") return;
  const NativeWorker = Worker;
  const PatchedWorker = createPatchedWorker(options, NativeWorker);
  Object.defineProperty(PatchedWorker, "prototype", {
    configurable: false,
    enumerable: false,
    value: NativeWorker.prototype,
    writable: false,
  });
  markPatchAnchor(PatchedWorker, __PT_WORKER_PATCH_GUARD_KEY__, "Worker");
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: maskAsNative(PatchedWorker, createNativeSource("Worker"), 1),
  });
  // SharedWorker remains native because Blob URLs break cross-tab deduplication.
};

const patchServiceWorkerReg = (
  options: FxWorkerOptions,
  containerPrototype: ServiceWorkerContainer,
): void => {
  const registerAnchorState = inspectPatchAnchors(__PT_SW_PATCH_GUARD_KEY__, [
    { fn: containerPrototype.register, name: "register" },
  ]);
  if (registerAnchorState === "installed") {
    return;
  }
  if (registerAnchorState === "conflict") {
    throw new Error("ServiceWorker register patch anchor conflict");
  }

  const NativeRegister = containerPrototype.register;
  const PatchedRegister = maskAsNative(function (
    this: ServiceWorkerContainer,
    scriptURL: string | URL,
    ...rest: [RegistrationOptions?]
  ): Promise<ServiceWorkerRegistration> {
    options.syncBootstrapState();
    if (!options.shouldBlockServiceWorker()) {
      return Reflect.apply(NativeRegister, this, [scriptURL, ...rest]);
    }

    const url = String(scriptURL);
    const scope = rest[0]?.scope ?? "/";
    return Promise.reject(buildBlockedRegError(scope, url));
  }, createNativeSource("register"));

  markPatchAnchor(PatchedRegister, __PT_SW_PATCH_GUARD_KEY__, "register");

  Object.defineProperty(containerPrototype, "register", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: PatchedRegister,
  });
};

const maybePatchServiceWorker = (
  options: FxWorkerOptions,
  container: Navigator["serviceWorker"] | null | undefined,
): Navigator["serviceWorker"] | undefined => {
  if (!container) return undefined;
  const containerPrototype = Object.getPrototypeOf(
    container,
  ) as ServiceWorkerContainer | null;
  if (!containerPrototype || typeof containerPrototype.register !== "function") {
    return container;
  }
  patchServiceWorkerReg(options, containerPrototype);
  return container;
};

const installServiceWorker = (options: FxWorkerOptions): void => {
  if (
    options.patchServiceWorker === false ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof ServiceWorkerContainer === "undefined"
  ) {
    return;
  }
  const nativeDescriptor = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    "serviceWorker",
  );
  const nativeGetter = nativeDescriptor?.get as
    ((this: Navigator) => Navigator["serviceWorker"]) | undefined;
  if (nativeGetter) {
    const getPatchedServiceWorker = function (
      this: Navigator,
    ): Navigator["serviceWorker"] {
      const nativeContainer = Reflect.apply(nativeGetter, this, []);
      return maybePatchServiceWorker(options, nativeContainer) ?? nativeContainer;
    };
    defineNativeGetter(Navigator.prototype, "serviceWorker", getPatchedServiceWorker, {
      nativeGetter,
    });
  }
  try {
    maybePatchServiceWorker(options, navigator.serviceWorker);
  } catch {
    // Ignore serviceWorker getter failures during early bootstrap.
  }
};

export const installFxWorkers = (options: FxWorkerOptions): void => {
  installDedicatedWorker(options);
  installServiceWorker(options);
};
