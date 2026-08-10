import type {
  SurfaceAssessment,
  SurfaceMethodQueryCounts,
  SurfacePresentationState,
  SurfaceQueryCounts,
} from "@privacy-brand/xray-protocol";

import type { XRayAccessedCategories } from "@/shared/types";

/**
 * The one place `presentation` is computed from `evidence` (GitHub #111 /
 * P0-05). Every UI consumer reads `assessment.presentation` directly instead
 * of re-deriving it — this function must never be duplicated elsewhere.
 *
 * `attention` (a pending suggestion/notification) is deliberately NOT
 * consulted here: it stays a fully independent axis, layered on top by UI
 * as a separate badge, so a surface's real protection state is never hidden
 * behind an unrelated suggestion banner.
 *
 * Precedence (highest wins): not-applicable > native-by-policy >
 * unrecoverable > degraded > pending > repaired > browser-enforced >
 * protected > unknown.
 */
export const resolveSurfaceState = (
  assessment: SurfaceAssessment,
): SurfacePresentationState => {
  const { applicability, evidence } = assessment;
  if (applicability === "not-applicable") return "not-applicable";
  if (evidence.policy === "native") return "native-by-policy";
  if (evidence.integrity === "unrecoverable") return "unrecoverable";
  if (evidence.integrity === "degraded") return "degraded";
  if (evidence.installation === "pending" || evidence.integrity === "unconfirmed") {
    return "pending";
  }
  if (evidence.integrity === "repaired") return "repaired";

  const policyRequiresProtection =
    evidence.policy === "protect" || evidence.policy === "block";

  // A surface with no descriptor-level integrity concept (e.g. webRTC, which
  // has no SurfaceIntegrityRegistry anchor) but a confirmed non-JS enforcement
  // layer (DNR/browser-privacy readback) is protected below page JavaScript —
  // this must never be conflated with `protected`, which implies an intact
  // JS descriptor.
  if (
    policyRequiresProtection &&
    evidence.installation === "installed" &&
    evidence.integrity === "not-applicable" &&
    evidence.enforcement !== "javascript" &&
    evidence.enforcement !== "none"
  ) {
    return "browser-enforced";
  }

  if (
    policyRequiresProtection &&
    evidence.installation === "installed" &&
    evidence.integrity === "intact"
  ) {
    return "protected";
  }
  return "unknown";
};

/** Derives transitional XRay fields from the assessment activity axis. */
export const deriveLegacyXRayActivity = (
  assessments: readonly SurfaceAssessment[],
): {
  accessedCategories: XRayAccessedCategories;
  failedCategories: XRayAccessedCategories;
  queryCounts: SurfaceQueryCounts;
  methodCounts: SurfaceMethodQueryCounts;
} => {
  const accessedCategories: XRayAccessedCategories = {};
  const failedCategories: XRayAccessedCategories = {};
  const queryCounts: SurfaceQueryCounts = {};
  const methodCounts: SurfaceMethodQueryCounts = {};
  for (const assessment of assessments) {
    if (assessment.activity.accessed) accessedCategories[assessment.key] = true;
    if (assessment.activity.failed) failedCategories[assessment.key] = true;
    if (assessment.activity.queryCount > 0) {
      queryCounts[assessment.key] = assessment.activity.queryCount;
    }
    Object.assign(methodCounts, assessment.activity.methodCounts);
  }
  return { accessedCategories, failedCategories, queryCounts, methodCounts };
};
