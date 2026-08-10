import {
  isWorkerAckMessage,
  isWorkerEvidenceMessage,
  WORKER_ACK_TIMEOUT_MS,
  type WorkerIntegrityStatus,
} from "@/shared/worker-bootstrap-ack";

export type WorkerAckOptions = {
  guard: string;
  /** Called if no ack arrives before the timeout — feeds `markSurfaceFailed`. */
  onBootstrapFailed: () => void;
  timeoutMs?: number;
  /**
   * Forwards the worker-thread's own `SurfaceIntegrityRegistry` results
   * (#111/#112 — a worker has no `document` to dispatch through). Carries the
   * full per-realm status, mirroring the document-side `markSurfaceEvidence`
   * channel. Independent of the bootstrap ack/timeout: can fire before, after,
   * or without an ack ever arriving.
   */
  onIntegrityEvidence?: (evidence: {
    surfaceId: string;
    status: WorkerIntegrityStatus;
    realmId: string;
    reasonCode?: string;
  }) => void;
};

/**
 * Attaches a private, page-invisible listener that resolves a dedicated
 * Worker's bootstrap attempt to confirmed (ack arrives) or failed (timeout
 * fires first) — never both, and never neither. `new Worker()` must return
 * synchronously, so this can only resolve the outcome asynchronously; a page
 * that constructs the worker sees no behavior change either way.
 *
 * Uses the same `stopImmediatePropagation` privacy mitigation
 * `attachWorkerLogRelay` already relies on (effective because this
 * listener attaches before the page can add its own) — an accepted,
 * already-shipped risk posture in this codebase, not a new one.
 */
export const attachWorkerAckRelay = (
  worker: Worker,
  {
    guard,
    onBootstrapFailed,
    timeoutMs = WORKER_ACK_TIMEOUT_MS,
    onIntegrityEvidence,
  }: WorkerAckOptions,
): void => {
  let settled = false;

  const timerId = setTimeout(() => {
    if (settled) return;
    settled = true;
    onBootstrapFailed();
  }, timeoutMs);

  const settle = (): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timerId);
  };

  worker.addEventListener("message", (event) => {
    const messageEvent = event as MessageEvent<unknown>;
    const data = messageEvent.data;

    // Independent of the ack/timeout settlement below — an integrity result
    // can arrive before, after, or without a bootstrap ack ever arriving.
    if (isWorkerEvidenceMessage(data, guard, __PT_WORKER_ACK_TYPE__)) {
      messageEvent.stopImmediatePropagation();
      onIntegrityEvidence?.({
        surfaceId: data.surfaceId,
        status: data.status,
        realmId: data.realmId,
        ...(data.reasonCode ? { reasonCode: data.reasonCode } : {}),
      });
      return;
    }

    if (settled) return;
    if (!isWorkerAckMessage(data, guard, __PT_WORKER_ACK_TYPE__)) {
      return;
    }
    messageEvent.stopImmediatePropagation();
    settle();
  });

  // A worker torn down before the ack arrives must not leak its timer or
  // report a spurious failure for a page that closed it deliberately.
  const nativeTerminate = worker.terminate.bind(worker);
  worker.terminate = (): void => {
    settle();
    nativeTerminate();
  };
};
