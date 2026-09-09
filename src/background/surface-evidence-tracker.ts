import type {
  SurfaceInstallationState,
  SurfaceIntegrityState,
  XRaySurfaceCategory,
} from "@/shared/types";

/**
 * One realm's latest per-surface axis evidence (#111 / P0-05). `realmId`
 * distinguishes the top document, each same-origin iframe, each dedicated
 * Worker, DNR, and the browser-privacy layer, so the background can fold the
 * worst current outcome across realms instead of collapsing everything into a
 * single tab-wide boolean.
 */
export type SurfaceRealmEvidence = {
  realmId: string;
  /** Browser frame id the evidence originated from (from the message sender). */
  frameId?: string;
  /** Per-construction Worker attempt id, when the evidence is about a Worker. */
  attemptId?: string;
  /** Descriptor/API check whose current result contributes to this realm. */
  methodId?: string;
  installation?: SurfaceInstallationState;
  integrity?: SurfaceIntegrityState;
  reasonCode?: string;
  observedAt: number;
};

export type SurfaceEvidenceByRealm = Partial<
  Record<XRaySurfaceCategory, SurfaceRealmEvidence[]>
>;

// tabId -> category -> realmId -> latest evidence.
const tabEvidenceMap = new Map<
  number,
  Map<XRaySurfaceCategory, Map<string, SurfaceRealmEvidence>>
>();

// tabId -> category -> realmId -> methodId -> latest descriptor result.
const integrityByMethodMap = new Map<
  number,
  Map<XRaySurfaceCategory, Map<string, Map<string, SurfaceRealmEvidence>>>
>();

const INTEGRITY_RANK: Record<NonNullable<SurfaceRealmEvidence["integrity"]>, number> = {
  unrecoverable: 4,
  degraded: 4,
  unconfirmed: 3,
  repaired: 2,
  intact: 1,
  "not-applicable": 0,
};

type AggregatedMethodEvidence = {
  evidence: SurfaceRealmEvidence;
  /** Whether this report superseded the stored result for its own method. */
  methodResultChanged: boolean;
};

const aggregateMethodIntegrity = (
  tabId: number,
  category: XRaySurfaceCategory,
  evidence: SurfaceRealmEvidence,
): AggregatedMethodEvidence => {
  if (!evidence.methodId || !evidence.integrity) {
    return { evidence, methodResultChanged: false };
  }
  let categoryMap = integrityByMethodMap.get(tabId);
  if (!categoryMap) {
    categoryMap = new Map();
    integrityByMethodMap.set(tabId, categoryMap);
  }
  let realmMap = categoryMap.get(category);
  if (!realmMap) {
    realmMap = new Map();
    categoryMap.set(category, realmMap);
  }
  let methodMap = realmMap.get(evidence.realmId);
  if (!methodMap) {
    methodMap = new Map();
    realmMap.set(evidence.realmId, methodMap);
  }
  const current = methodMap.get(evidence.methodId);
  const methodResultChanged = !current || current.observedAt <= evidence.observedAt;
  if (methodResultChanged) {
    methodMap.set(evidence.methodId, evidence);
  }
  // The incoming result can be stale and therefore absent from `methodMap`.
  // Seed the fold with the retained current result so a rejected report cannot
  // change the aggregate merely by arriving late.
  let worst = methodMap.get(evidence.methodId) ?? evidence;
  for (const candidate of methodMap.values()) {
    const rank =
      INTEGRITY_RANK[candidate.integrity!] - INTEGRITY_RANK[worst.integrity!];
    if (
      rank > 0 ||
      (rank === 0 && (candidate.reasonCode ?? "") < (worst.reasonCode ?? ""))
    ) {
      worst = candidate;
    }
  }
  const currentEvidence = { ...evidence };
  delete currentEvidence.reasonCode;
  return {
    evidence: {
      ...currentEvidence,
      ...(worst.integrity ? { integrity: worst.integrity } : {}),
      ...(worst.reasonCode ? { reasonCode: worst.reasonCode } : {}),
    },
    methodResultChanged,
  };
};

export const recordSurfaceEvidence = (
  tabId: number,
  category: XRaySurfaceCategory,
  evidence: SurfaceRealmEvidence,
): void => {
  const { evidence: aggregated, methodResultChanged } = aggregateMethodIntegrity(
    tabId,
    category,
    evidence,
  );
  let categoryMap = tabEvidenceMap.get(tabId);
  if (!categoryMap) {
    categoryMap = new Map();
    tabEvidenceMap.set(tabId, categoryMap);
  }
  let realmMap = categoryMap.get(category);
  if (!realmMap) {
    realmMap = new Map();
    categoryMap.set(category, realmMap);
  }
  // Method reports are ordered only against the previous result for that
  // method. A valid recovery may have an earlier timestamp than another
  // method's last check, and must still refresh the folded realm result.
  if (evidence.methodId && evidence.integrity) {
    if (methodResultChanged) realmMap.set(aggregated.realmId, aggregated);
    return;
  }
  // Non-method evidence remains monotonic per realm — a stale/out-of-order
  // report is ignored rather than clobbering the newest result.
  const existing = realmMap.get(aggregated.realmId);
  if (existing && existing.observedAt > aggregated.observedAt) {
    return;
  }
  realmMap.set(aggregated.realmId, aggregated);
};

export const getRealmEvidence = (tabId: number): SurfaceEvidenceByRealm => {
  const categoryMap = tabEvidenceMap.get(tabId);
  if (!categoryMap || categoryMap.size === 0) {
    return {};
  }
  const result: SurfaceEvidenceByRealm = {};
  for (const [category, realmMap] of categoryMap.entries()) {
    if (realmMap.size > 0) {
      result[category] = [...realmMap.values()];
    }
  }
  return result;
};

export const clearSurfaceEvidence = (tabId: number): void => {
  tabEvidenceMap.delete(tabId);
  integrityByMethodMap.delete(tabId);
};
