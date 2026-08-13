import type { SurfaceMethodQueryCounts, XRaySurfaceCategory } from "@/shared/types";

const nativeArrayIsArray = Array.isArray;
const nativeNumberIsFinite = Number.isFinite;
const nativeObjectValues = Object.values;

/**
 * Private worker → parent acknowledgement that the Refract runtime finished
 * installing inside a constructed Worker before the original page script
 * executes (#110). A successfully *constructed* Worker previously implied
 * nothing about whether spoofing actually installed — this closes that gap
 * without blocking the (necessarily synchronous) `new Worker()` return: the
 * parent starts a bounded wait and only downgrades the surface if the ack
 * never arrives.
 *
 * Kept structurally open (`kind` discriminant) so a future integrity-result
 * variant (#111/#112 — the worker-thread `SurfaceIntegrityRegistry`, which
 * has no `document` to dispatch through) can reuse the same channel instead
 * of inventing a second one.
 */
export const WORKER_ACK_TIMEOUT_MS = 1500;

export type WorkerAckMessage = {
  type: string;
  guard: string;
  kind: "bootstrap-confirmed";
};

export const createWorkerAckMessage = (
  guard: string,
  messageType: string,
): WorkerAckMessage => ({
  type: messageType,
  guard,
  kind: "bootstrap-confirmed",
});

/**
 * `guard` is the build-time guard key (see `SHIM_GUARD_KEY`) — not a secret,
 * but enough that a page can't trivially forge this exact private message
 * shape without reading the extension's own bundled source first.
 */
export const isWorkerAckMessage = (
  data: unknown,
  guard: string,
  messageType: string,
): data is WorkerAckMessage => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  return (
    candidate.type === messageType &&
    candidate.guard === guard &&
    candidate.kind === "bootstrap-confirmed"
  );
};

/**
 * The worker-thread's own `SurfaceIntegrityRegistry` (#111/#112) has no
 * `document` to dispatch through — this reuses the same private channel
 * instead of inventing a second one. Carries the full per-realm integrity
 * `status` (not just `unrecoverable`) so the parent can distinguish
 * repaired/unconfirmed/unrecoverable results the same way the document-side
 * `markSurfaceEvidence` channel does.
 */
export type WorkerIntegrityStatus = "repaired" | "unconfirmed" | "unrecoverable";

export type WorkerEvidenceMessage = {
  type: string;
  guard: string;
  kind: "integrity-evidence";
  surfaceId: string;
  status: WorkerIntegrityStatus;
  realmId: string;
  reasonCode?: string;
};

export type WorkerEvidenceInput = {
  guard: string;
  messageType: string;
  surfaceId: string;
  status: WorkerIntegrityStatus;
  realmId: string;
  reasonCode?: string;
};

export const createWorkerEvidence = ({
  guard,
  messageType,
  surfaceId,
  status,
  realmId,
  reasonCode,
}: WorkerEvidenceInput): WorkerEvidenceMessage => ({
  type: messageType,
  guard,
  kind: "integrity-evidence",
  surfaceId,
  status,
  realmId,
  ...(reasonCode ? { reasonCode } : {}),
});

export const isWorkerEvidenceMessage = (
  data: unknown,
  guard: string,
  messageType: string,
): data is WorkerEvidenceMessage => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  return (
    candidate.type === messageType &&
    candidate.guard === guard &&
    candidate.kind === "integrity-evidence" &&
    typeof candidate.surfaceId === "string" &&
    (candidate.status === "repaired" ||
      candidate.status === "unconfirmed" ||
      candidate.status === "unrecoverable") &&
    typeof candidate.realmId === "string"
  );
};

export type WorkerUsageMessage = {
  type: string;
  guard: string;
  kind: "surface-usage";
  categories: XRaySurfaceCategory[];
  counts: Partial<Record<XRaySurfaceCategory, number>>;
  methodCounts: SurfaceMethodQueryCounts;
};

type WorkerUsageInput = Omit<WorkerUsageMessage, "kind" | "type"> & {
  messageType: string;
};

export const createWorkerUsageMessage = ({
  guard,
  messageType,
  categories,
  counts,
  methodCounts,
}: WorkerUsageInput): WorkerUsageMessage => ({
  type: messageType,
  guard,
  kind: "surface-usage",
  categories,
  counts,
  methodCounts,
});

const isCountRecord = (value: unknown): value is Record<string, number> => {
  if (typeof value !== "object" || value === null || nativeArrayIsArray(value)) {
    return false;
  }
  const counts = nativeObjectValues(value);
  for (let index = 0; index < counts.length; index += 1) {
    const count = counts[index];
    if (typeof count !== "number" || !nativeNumberIsFinite(count) || count < 0) {
      return false;
    }
  }
  return true;
};

const isStringArray = (value: unknown): value is string[] => {
  if (!nativeArrayIsArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (typeof value[index] !== "string") return false;
  }
  return true;
};

export const isWorkerUsageMessage = (
  data: unknown,
  guard: string,
  messageType: string,
): data is WorkerUsageMessage => {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return (
    candidate.type === messageType &&
    candidate.guard === guard &&
    candidate.kind === "surface-usage" &&
    isStringArray(candidate.categories) &&
    isCountRecord(candidate.counts) &&
    isCountRecord(candidate.methodCounts)
  );
};
