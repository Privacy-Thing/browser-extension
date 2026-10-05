import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";
import type { DiagnosticReport } from "@privacy-brand/xray-protocol/diagnostic-report";

import type { EXTENSION_COMMAND_TYPES } from "./extension-contract";
import type { WorkerTestKind } from "./host-protection-pause";
import type { WorkerPolicyException } from "./worker-policy-exceptions";

export type WorkerTestSession = {
  id: string;
  hostname: string;
  kind: WorkerTestKind;
  expiresAt: number;
  phase: "testing" | "helped" | "failed" | "cancelled" | "expired" | "saved";
  configurationFingerprint: string;
  before: DiagnosticReport;
  after: DiagnosticReport | null;
};
export type WorkerTestCandidate = {
  kind: WorkerTestKind;
  evidence: "observed" | "missing" | "stale";
};
export type WorkerTestState = {
  savedException?: WorkerPolicyException;
  ok: true;
  session: WorkerTestSession | null;
  candidates: WorkerTestCandidate[];
  blocked: "unsupported" | "trusted" | "inactive" | "pause" | "reload" | null;
  reloadRequired: boolean;
};
export type WorkerTestResponse = WorkerTestState | { ok: false; error: string };
export type WorkerTestCommand =
  | {
      type: typeof EXTENSION_COMMAND_TYPES.getWorkerTest;
      tabId?: number | undefined;
      hostname: string;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.startWorkerTest;
      tabId?: number | undefined;
      hostname: string;
      kind: WorkerTestKind;
    }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.finishWorkerTest;
      tabId?: number | undefined;
      hostname: string;
      id: string;
      action: "helped" | "failed" | "cancel" | "save";
    };

/** A configured policy is a candidate, not proof that it broke this website. */
export const workerTestCandidates = (
  state: GetXRayStateResponse | null,
  now: number,
): WorkerTestCandidate[] => {
  if (!state?.ok || !state.snapshot) return [];
  const kinds: WorkerTestKind[] = [];
  if (state.snapshot.blockServiceWorkerRegistration === true)
    kinds.push("service-worker");
  if (
    state.snapshot.sharedWorkerHandlingMode === "spoof" ||
    state.snapshot.sharedWorkerHandlingMode === "strict"
  )
    kinds.push("shared-worker");
  return kinds.map((kind) => {
    const row = state.assessments.find(
      (item) =>
        item.key === (kind === "service-worker" ? "serviceWorker" : "sharedWorker"),
    );
    const observedAt = row?.evidence.observedAt;
    const hasEvidence =
      row &&
      (row.activity.queryCount > 0 ||
        row.activity.failed ||
        row.evidence.reasons.some((reason) => reason.realmId));
    return {
      kind,
      evidence: getEvidence(Boolean(hasEvidence), observedAt, now),
    };
  });
};

const getEvidence = (
  hasEvidence: boolean,
  observedAt: number | undefined,
  now: number,
): WorkerTestCandidate["evidence"] => {
  if (!hasEvidence || observedAt === undefined || observedAt > now) return "missing";
  return now - observedAt > 5 * 60_000 ? "stale" : "observed";
};
