import { attachWorkerAckRelay } from "@privacy-brand/refract-browser/common/worker-bootstrap-ack-relay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WORKER_ACK_TYPE } from "@/shared/build-id-test-values";

const GUARD = "test-guard-key";

type MockWorker = {
  addEventListener: (type: string, handler: (event: Event) => void) => void;
  terminate: () => void;
};

const createMockWorker = (): {
  worker: MockWorker;
  nativeTerminate: ReturnType<typeof vi.fn>;
  emit: (event: Event) => void;
} => {
  let handler: ((event: Event) => void) | undefined;
  const nativeTerminate = vi.fn();
  const worker: MockWorker = {
    addEventListener: vi.fn((_type, nextHandler) => {
      handler = nextHandler;
    }),
    terminate: nativeTerminate,
  };
  return {
    worker,
    nativeTerminate,
    emit: (event: Event) => handler?.(event),
  };
};

const ackEvent = (guard: string = GUARD): Event =>
  ({
    data: { type: WORKER_ACK_TYPE, guard, kind: "bootstrap-confirmed" },
    stopImmediatePropagation: vi.fn(),
  }) as unknown as Event;

const integrityEvidenceEvent = (
  surfaceId: string,
  status: "repaired" | "unconfirmed" | "unrecoverable" = "unrecoverable",
  guard: string = GUARD,
): Event =>
  ({
    data: {
      type: WORKER_ACK_TYPE,
      guard,
      kind: "integrity-evidence",
      surfaceId,
      status,
      realmId: "worker",
    },
    stopImmediatePropagation: vi.fn(),
  }) as unknown as Event;

describe("worker-bootstrap-ack-relay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears the timeout and hides the message from the page when a matching ack arrives", () => {
    const { worker, emit } = createMockWorker();
    const onBootstrapFailed = vi.fn();

    attachWorkerAckRelay(worker as unknown as Worker, {
      guard: GUARD,
      onBootstrapFailed,
    });

    const event = ackEvent();
    emit(event);

    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(10_000);
    expect(onBootstrapFailed).not.toHaveBeenCalled();
  });

  it("reports bootstrap failure when no ack arrives before the timeout", () => {
    const { worker } = createMockWorker();
    const onBootstrapFailed = vi.fn();

    attachWorkerAckRelay(worker as unknown as Worker, {
      guard: GUARD,
      onBootstrapFailed,
      timeoutMs: 1500,
    });

    vi.advanceTimersByTime(1499);
    expect(onBootstrapFailed).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onBootstrapFailed).toHaveBeenCalledOnce();
  });

  it("ignores messages with a mismatched guard, still allowing a later valid ack to settle", () => {
    const { worker, emit } = createMockWorker();
    const onBootstrapFailed = vi.fn();

    attachWorkerAckRelay(worker as unknown as Worker, {
      guard: GUARD,
      onBootstrapFailed,
    });

    const forged = ackEvent("wrong-guard");
    emit(forged);
    expect(forged.stopImmediatePropagation).not.toHaveBeenCalled();

    const real = ackEvent();
    emit(real);
    expect(real.stopImmediatePropagation).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(10_000);
    expect(onBootstrapFailed).not.toHaveBeenCalled();
  });

  it("does not report failure for a worker terminated before the ack or timeout, and still terminates natively", () => {
    const { worker, nativeTerminate } = createMockWorker();
    const onBootstrapFailed = vi.fn();

    attachWorkerAckRelay(worker as unknown as Worker, {
      guard: GUARD,
      onBootstrapFailed,
    });

    worker.terminate();
    expect(nativeTerminate).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(10_000);
    expect(onBootstrapFailed).not.toHaveBeenCalled();
  });

  it("does not call the native terminate twice or resurface failure once already settled by an ack", () => {
    const { worker, nativeTerminate, emit } = createMockWorker();
    const onBootstrapFailed = vi.fn();

    attachWorkerAckRelay(worker as unknown as Worker, {
      guard: GUARD,
      onBootstrapFailed,
    });

    emit(ackEvent());
    worker.terminate();

    expect(nativeTerminate).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10_000);
    expect(onBootstrapFailed).not.toHaveBeenCalled();
  });

  it("forwards an integrity-evidence message to onIntegrityEvidence and hides it from the page", () => {
    const { worker, emit } = createMockWorker();
    const onIntegrityEvidence = vi.fn();

    attachWorkerAckRelay(worker as unknown as Worker, {
      guard: GUARD,
      onBootstrapFailed: vi.fn(),
      onIntegrityEvidence,
    });

    const event = integrityEvidenceEvent("webGL", "repaired");
    emit(event);

    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(onIntegrityEvidence).toHaveBeenCalledExactlyOnceWith({
      surfaceId: "webGL",
      status: "repaired",
      realmId: "worker",
    });
  });

  it("does not let an integrity-evidence message resolve the separate bootstrap-ack timeout", () => {
    const { worker, emit } = createMockWorker();
    const onBootstrapFailed = vi.fn();

    attachWorkerAckRelay(worker as unknown as Worker, {
      guard: GUARD,
      onBootstrapFailed,
      onIntegrityEvidence: vi.fn(),
    });

    emit(integrityEvidenceEvent("webGL"));
    // The worker never actually acked its bootstrap — the timeout must still
    // fire on schedule; an integrity message must not settle it as a side effect.
    vi.advanceTimersByTime(1500);
    expect(onBootstrapFailed).toHaveBeenCalledOnce();
  });

  it("still forwards an integrity-evidence message after the bootstrap ack already settled", () => {
    const { worker, emit } = createMockWorker();
    const onBootstrapFailed = vi.fn();
    const onIntegrityEvidence = vi.fn();

    attachWorkerAckRelay(worker as unknown as Worker, {
      guard: GUARD,
      onBootstrapFailed,
      onIntegrityEvidence,
    });

    emit(ackEvent());
    emit(integrityEvidenceEvent("canvas", "unrecoverable"));

    expect(onIntegrityEvidence).toHaveBeenCalledExactlyOnceWith({
      surfaceId: "canvas",
      status: "unrecoverable",
      realmId: "worker",
    });
  });

  it("ignores an integrity-evidence message with a mismatched guard", () => {
    const { worker, emit } = createMockWorker();
    const onIntegrityEvidence = vi.fn();

    attachWorkerAckRelay(worker as unknown as Worker, {
      guard: GUARD,
      onBootstrapFailed: vi.fn(),
      onIntegrityEvidence,
    });

    const forged = integrityEvidenceEvent("webGL", "unrecoverable", "wrong-guard");
    emit(forged);

    expect(forged.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(onIntegrityEvidence).not.toHaveBeenCalled();
  });
});
