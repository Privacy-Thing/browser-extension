import {
  createPrivateSet,
  privateSetAdd,
  privateSetHas,
} from "@privacy-brand/refract-core/runtime/primordials";

import type {
  SurfaceInstallationState,
  SurfaceIntegrityState,
  XRaySurfaceCategory,
} from "@/shared/types";

/** One realm's per-surface axis report (#111). Carried on {@link SURFACE_ERROR_TYPE}. */
export type SurfaceEvidenceReport = {
  realmId: string;
  /** Per-construction Worker attempt id, when the report is about a Worker. */
  attemptId?: string;
  installation?: SurfaceInstallationState;
  integrity?: SurfaceIntegrityState;
  reasonCode?: string;
};

/**
 * Module-scope accumulator for surface categories that failed to initialize.
 * Kept in a closure — never attached to `window` — to avoid observable globals.
 *
 * Each category is emitted at most once per page lifecycle. The CustomEvent
 * is deferred by one tick (`setTimeout(..., 0)`) because init errors can fire
 * during `document_start` — before the content-script `document.addEventListener`
 * relay is live. The zero-tick defer ensures the event fires after the event
 * loop turn in which the relay registers.
 *
 * Transport: `document.dispatchEvent(new CustomEvent(...))` is the proven
 * cross-world channel in both Firefox and Chromium.
 */
const failedCategories = createPrivateSet<XRaySurfaceCategory>();

export const markSurfaceFailed = (category: XRaySurfaceCategory): void => {
  if (privateSetHas(failedCategories, category)) {
    return;
  }

  privateSetAdd(failedCategories, category);

  setTimeout(() => {
    if (typeof document === "undefined") {
      return;
    }

    try {
      document.dispatchEvent(
        new CustomEvent(__PT_SURFACE_ERROR_TYPE__, {
          detail: JSON.stringify({ categories: [category] }),
        }),
      );
    } catch {
      // Ignore dispatch errors — non-critical diagnostic channel
    }
  }, 0);
};

/**
 * Richer sibling of {@link markSurfaceFailed} (#111 / P0-05): reports one
 * realm's per-surface installation/integrity axis detail (not just a boolean
 * failure), so the background can distinguish repaired/unconfirmed/pending/
 * unrecoverable per realm. Not deduped — a realm's status legitimately changes
 * over a page's lifetime (pending → installed, intact → repaired), and the
 * background keeps the latest per realmId.
 */
export const markSurfaceEvidence = (
  category: XRaySurfaceCategory,
  evidence: SurfaceEvidenceReport,
): void => {
  setTimeout(() => {
    if (typeof document === "undefined") {
      return;
    }

    try {
      document.dispatchEvent(
        new CustomEvent(__PT_SURFACE_ERROR_TYPE__, {
          detail: JSON.stringify({ categories: [category], evidence }),
        }),
      );
    } catch {
      // Ignore dispatch errors — non-critical diagnostic channel
    }
  }, 0);
};
