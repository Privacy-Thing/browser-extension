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

export const recordSurfaceEvidence = (
  tabId: number,
  category: XRaySurfaceCategory,
  evidence: SurfaceRealmEvidence,
): void => {
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
  // Monotonic per realm — a realm's newest report (higher observedAt, e.g. a
  // repaired descriptor superseding an earlier unconfirmed one) wins, and a
  // stale/out-of-order older report is ignored rather than clobbering it.
  const existing = realmMap.get(evidence.realmId);
  if (existing && existing.observedAt > evidence.observedAt) {
    return;
  }
  realmMap.set(evidence.realmId, evidence);
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
};
