import {
  SurfaceReasonCodeSchema,
  type SurfaceAssessment,
  type SurfaceAttention,
  type SurfaceEnforcementKind,
  type SurfaceInstallationState,
  type SurfaceIntegrityState,
  type SurfaceMethodQueryCounts,
  type SurfacePolicyState,
  type SurfaceProtectionReason,
  type ProtectionReasonSeverity,
  type ProtectionReasonSource,
  type SurfaceQueryCounts,
  type SurfaceReasonCode,
} from "@privacy-brand/xray-protocol";

import { getWebRtcPolicyConfirmed } from "@/background/privacy";
import type {
  SurfaceEvidenceByRealm,
  SurfaceRealmEvidence,
} from "@/background/surface-evidence-tracker";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  isSurfaceSupported,
  SURFACE_GROUP_ORDER,
  SPOOFING_SURFACES,
  type SpoofingBrowserTarget,
  type SpoofingSurfaceKey,
} from "@/shared/spoofing-surfaces";
import { resolveSurfaceState } from "@/shared/surface-assessments";
import type {
  XRayAccessedCategories,
  PopupEffectiveSource,
  PopupSurfaceCounts,
  PopupSurfaceGroupState,
  RuntimeSnapshot,
} from "@/shared/types";

export type SurfaceAttentionByKey = Partial<
  Record<SpoofingSurfaceKey, SurfaceAttention>
>;

const createProtectionCounts = (): PopupSurfaceCounts => ({
  "not-applicable": 0,
  "native-by-policy": 0,
  unrecoverable: 0,
  degraded: 0,
  pending: 0,
  repaired: 0,
  "browser-enforced": 0,
  protected: 0,
  unknown: 0,
});

const resolveGroupState = (
  assessments: readonly SurfaceAssessment[],
): PopupSurfaceGroupState => {
  const states = assessments
    .map((assessment) => assessment.presentation)
    .filter((state) => state !== "not-applicable");
  if (states.length > 0 && states.every((state) => state === "protected"))
    return "protected";
  if (states.length > 0 && states.every((state) => state === "native-by-policy")) {
    return "native-by-policy";
  }
  if (states.length > 0 && states.every((state) => state === "pending")) {
    return "pending";
  }
  return "mixed";
};

const resolveSharedWorkerMode = (
  snapshot: RuntimeSnapshot,
): "native" | "spoof" | "strict" => {
  if (snapshot.sharedWorkerHandlingMode) return snapshot.sharedWorkerHandlingMode;
  return snapshot.sharedWorkerCompatibilityMode === false ? "spoof" : "native";
};

/**
 * Resolves the Policy axis (protect/block/native/not-applicable) from
 * configuration intent alone — the same inputs the legacy flat resolver used.
 * This says nothing about whether protection actually installed or stayed
 * intact; that's the Installation/Integrity axes below.
 */
const resolveSnapshotPolicy = (
  key: SpoofingSurfaceKey,
  snapshot: RuntimeSnapshot,
): SurfacePolicyState => {
  switch (key) {
    case "geolocation":
      return snapshot.geolocationEnabled === false ? "native" : "protect";
    case "timeLocale":
      return snapshot.timeLocaleEnabled === false ? "native" : "protect";
    case "worker":
      return resolveSharedWorkerMode(snapshot) === "native" ? "native" : "protect";
    case "serviceWorker":
      return snapshot.blockServiceWorkerRegistration === true ? "block" : "native";
    case "sharedWorker":
      return resolveSharedWorkerMode(snapshot) === "native" ? "native" : "protect";
    default:
      if (!snapshot.fingerprint) return "native";
      return snapshot.fingerprint.spoofingToggles?.[key] === false
        ? "native"
        : "protect";
  }
};

// Worst-of ordering across realms (#111): a single degraded/unrecoverable
// realm must prevent a fully protected tab result.
const INTEGRITY_RANK: Record<SurfaceIntegrityState, number> = {
  unrecoverable: 5,
  degraded: 4,
  unconfirmed: 3,
  repaired: 2,
  intact: 1,
  "not-applicable": 0,
};

const worstIntegrity = (
  realmEvidence: readonly SurfaceRealmEvidence[],
): SurfaceIntegrityState | null => {
  let worst: SurfaceIntegrityState | null = null;
  for (const realm of realmEvidence) {
    if (realm.integrity === undefined) continue;
    if (worst === null || INTEGRITY_RANK[realm.integrity] > INTEGRITY_RANK[worst]) {
      worst = realm.integrity;
    }
  }
  return worst;
};

const reasonSourceForRealm = (realmId: string): ProtectionReasonSource => {
  if (realmId === "dnr") return "dnr";
  if (realmId === "browser-privacy:webrtc") return "browser-privacy";
  if (realmId === "worker" || realmId.startsWith("worker")) return "worker";
  return "integrity";
};

const reasonSeverityFor = (
  integrity: SurfaceIntegrityState | undefined,
  installation: SurfaceInstallationState | undefined,
): ProtectionReasonSeverity => {
  if (integrity === "unrecoverable") return "critical";
  if (integrity === "degraded" || installation === "failed") return "warning";
  return "info";
};

const KNOWN_REASON_CODES: ReadonlySet<string> = new Set(
  SurfaceReasonCodeSchema.options,
);

/**
 * Maps a realm's evidence to a canonical, versioned reason code
 * ({@link SurfaceReasonCodeSchema}). A registry-provided `reasonCode` that is
 * already in the dictionary passes through; anything else falls back to a
 * status-derived code so the protocol field stays a validated enum.
 */
const canonicalReasonCode = (realm: SurfaceRealmEvidence): SurfaceReasonCode => {
  if (realm.reasonCode !== undefined && KNOWN_REASON_CODES.has(realm.reasonCode)) {
    return realm.reasonCode as SurfaceReasonCode;
  }
  if (realm.integrity === "unrecoverable") return "integrity-unrecoverable";
  if (realm.integrity === "repaired") return "integrity-repaired";
  if (realm.integrity === "unconfirmed") return "integrity-unconfirmed";
  if (realm.installation === "failed") return "installation-failed";
  if (realm.installation === "pending") return "installation-pending";
  return "unknown";
};

/**
 * Structured, per-realm reasons behind an assessment (#111). Each realm that
 * reported a non-default signal contributes one reason, plus the coarse
 * boolean failure and the browser-wide webRTC policy mismatch. Reason `code`s
 * are stable protocol identifiers, not UI copy.
 */
const buildReasons = (
  realmEvidence: readonly SurfaceRealmEvidence[],
  coarse: { failed: boolean; webRtcPolicyMismatch: boolean; observedAt: number },
): SurfaceProtectionReason[] => {
  const reasons: SurfaceProtectionReason[] = [];
  for (const realm of realmEvidence) {
    const notable =
      (realm.integrity !== undefined &&
        realm.integrity !== "intact" &&
        realm.integrity !== "not-applicable") ||
      realm.installation === "pending" ||
      realm.installation === "failed";
    if (!notable) continue;
    reasons.push({
      code: canonicalReasonCode(realm),
      source: reasonSourceForRealm(realm.realmId),
      severity: reasonSeverityFor(realm.integrity, realm.installation),
      realmId: realm.realmId,
      ...(realm.frameId !== undefined ? { frameId: realm.frameId } : {}),
      ...(realm.attemptId !== undefined ? { attemptId: realm.attemptId } : {}),
      observedAt: realm.observedAt,
    });
  }
  if (coarse.failed) {
    reasons.push({
      code: "runtime-surface-failed",
      source: "runtime",
      severity: "warning",
      observedAt: coarse.observedAt,
    });
  }
  if (coarse.webRtcPolicyMismatch) {
    reasons.push({
      code: "webrtc-policy-mismatch",
      source: "browser-privacy",
      severity: "warning",
      realmId: "browser-privacy:webrtc",
      observedAt: coarse.observedAt,
    });
  }
  return reasons;
};

const resolvePolicy = ({
  key,
  source,
  snapshot,
  runtimeExpected,
}: {
  key: SpoofingSurfaceKey;
  source: PopupEffectiveSource;
  snapshot: RuntimeSnapshot | null;
  runtimeExpected: boolean;
}): SurfacePolicyState => {
  if (source === "trusted-site" || source === "none" || !runtimeExpected) {
    return "native";
  }
  // No snapshot yet is a timing gap, not a policy decision — optimistically
  // assume the surface's catalog default while Installation stays `pending`
  // (see buildSurfaceAssessments below), so `pending` outranks `protected` in
  // the presentation precedence instead of prematurely showing either.
  if (!snapshot) {
    const surface = SPOOFING_SURFACES.find((candidate) => candidate.key === key);
    return surface?.defaultEnabled === false ? "native" : "protect";
  }
  return resolveSnapshotPolicy(key, snapshot);
};

export const buildSurfaceAssessments = ({
  source,
  snapshot,
  runtimeExpected,
  accessedCategories = {},
  failedCategories = {},
  evidenceByRealm = {},
  queryCounts = {},
  methodCounts = {},
  attentionBySurface = {},
  browserTarget = BUILD_BROWSER_TARGET,
  webRtcPolicyConfirmed = getWebRtcPolicyConfirmed(),
}: {
  source: PopupEffectiveSource;
  snapshot: RuntimeSnapshot | null;
  runtimeExpected: boolean;
  accessedCategories?: XRayAccessedCategories;
  /**
   * Per-tab coarse confirmed-failure signal from the legacy `markSurfaceFailed`
   * boolean channel (a surface "ran native" — Worker native-fallback, DNR
   * mismatch). Folds into `evidence.integrity: "degraded"`.
   */
  failedCategories?: XRayAccessedCategories;
  /**
   * Per-realm axis evidence from the richer `markSurfaceEvidence` channel
   * (#111): the descriptor-integrity registry's per-realm intact/repaired/
   * unconfirmed/unrecoverable results and Worker/DNR/WebRTC pending signals.
   * The worst integrity across realms wins, and a still-`pending` realm keeps
   * the surface `pending` rather than prematurely `protected`.
   */
  evidenceByRealm?: SurfaceEvidenceByRealm;
  queryCounts?: SurfaceQueryCounts;
  methodCounts?: SurfaceMethodQueryCounts;
  attentionBySurface?: SurfaceAttentionByKey;
  browserTarget?: SpoofingBrowserTarget;
  /**
   * `false` means the browser-wide WebRTC IP-handling policy readback did not
   * match what was requested (a genuine enforcement failure). `null` means
   * "not yet confirmed" — missing evidence, not a failure — and must not
   * downgrade the surface (#111). Unlike `failedCategories`, this is a global
   * (non-per-tab) setting, so it only ever affects the `webRTC` surface.
   */
  webRtcPolicyConfirmed?: boolean | null;
}): SurfaceAssessment[] =>
  SPOOFING_SURFACES.map((surface) => {
    const applicable = isSurfaceSupported(surface, browserTarget);
    const surfaceMethodCounts: SurfaceMethodQueryCounts = {};
    for (const method of surface.methods) {
      const count = methodCounts[method.id];
      if (count !== undefined) surfaceMethodCounts[method.id] = count;
    }
    const attention = applicable ? attentionBySurface[surface.key] : undefined;
    const failed = failedCategories[surface.key] === true;
    const webRtcPolicyMismatch =
      surface.key === "webRTC" && webRtcPolicyConfirmed === false;
    const anyFailure = failed || webRtcPolicyMismatch;
    const realmEvidence = (applicable ? evidenceByRealm[surface.key] : undefined) ?? [];
    const realmReportsPending = realmEvidence.some(
      (realm) => realm.installation === "pending",
    );
    const realmReportsFailed = realmEvidence.some(
      (realm) => realm.installation === "failed",
    );
    // A realm-observed failure (an installed realm that failed, or a
    // descriptor/DNR realm that went degraded/unrecoverable) is a real page
    // activity failure. The browser-wide webRTC policy mismatch is deliberately
    // NOT one: it degrades presentation but carries no per-realm evidence, so it
    // stays out of `activity.failed` (a page-observed-API axis).
    const realmReportsFailure = realmEvidence.some(
      (realm) =>
        realm.installation === "failed" ||
        realm.integrity === "unrecoverable" ||
        realm.integrity === "degraded",
    );
    const worstRealmIntegrity = worstIntegrity(realmEvidence);

    const policy: SurfacePolicyState = applicable
      ? resolvePolicy({ key: surface.key, source, snapshot, runtimeExpected })
      : "not-applicable";

    const resolveInstallation = (): SurfaceInstallationState => {
      if (!applicable || policy === "native") return "not-expected";
      if (realmReportsFailed) return "failed";
      if (!snapshot || realmReportsPending) return "pending";
      return "installed";
    };
    const installation = resolveInstallation();

    // Integrity is the worst of: the coarse boolean "ran native" (→ degraded),
    // and the per-realm descriptor-integrity registry results (intact/repaired/
    // unconfirmed/unrecoverable).
    //
    // webRTC is special: its protection of record against local-IP leakage is
    // the browser's webRTCIPHandlingPolicy, not its (also-patched, also-tracked)
    // JS descriptors. A confirmed policy readback therefore resolves to
    // `not-applicable` so the surface presents as `browser-enforced` (the browser
    // layer is doing the work); a mismatch is `degraded`; a not-yet-confirmed
    // readback falls back to the intact JS layer (`protected`) rather than
    // flashing pending on every load. Descriptor tampering (a used realm going
    // unrecoverable) still overrides via the worst-of fold below.
    const resolveBaseIntegrity = (): SurfaceIntegrityState => {
      if (surface.key === "webRTC") {
        if (failed) return "degraded";
        if (webRtcPolicyConfirmed === true) return "not-applicable";
        if (webRtcPolicyConfirmed === false) return "degraded";
        return "intact";
      }
      return anyFailure ? "degraded" : "intact";
    };
    const resolveIntegrity = (): SurfaceIntegrityState => {
      if (!applicable || installation !== "installed") return "not-applicable";
      const base = resolveBaseIntegrity();
      if (worstRealmIntegrity === null) return base;
      return INTEGRITY_RANK[worstRealmIntegrity] >= INTEGRITY_RANK[base]
        ? worstRealmIntegrity
        : base;
    };
    const integrity = resolveIntegrity();

    const enforcement: SurfaceEnforcementKind = applicable
      ? (surface.enforcementKind as SurfaceEnforcementKind)
      : "none";

    const evidence = {
      policy,
      installation,
      integrity,
      enforcement,
      reasons: applicable
        ? buildReasons(realmEvidence, {
            failed,
            webRtcPolicyMismatch,
            observedAt: Date.now(),
          })
        : [],
    };

    const assessment: SurfaceAssessment = {
      key: surface.key,
      group: surface.group,
      applicability: applicable ? "applicable" : "not-applicable",
      evidence,
      activity: {
        accessed: accessedCategories[surface.key] === true,
        failed: failed || realmReportsFailure,
        queryCount: queryCounts[surface.key] ?? 0,
        methodCounts: surfaceMethodCounts,
      },
      ...(attention ? { attention } : {}),
      presentation: "unknown",
    };
    assessment.presentation = resolveSurfaceState(assessment);
    return assessment;
  });

export const aggregateAssessments = (assessments: readonly SurfaceAssessment[]) => {
  const groups = SURFACE_GROUP_ORDER.map((key) => {
    const surfaces = assessments.filter((assessment) => assessment.group === key);
    const counts = createProtectionCounts();
    let attentionCount = 0;
    for (const surface of surfaces) {
      counts[surface.presentation] += 1;
      if (surface.attention) attentionCount += 1;
    }
    return {
      key,
      state: resolveGroupState(surfaces),
      counts,
      attentionCount,
      surfaces,
    };
  });
  const counts = createProtectionCounts();
  let attentionCount = 0;
  for (const group of groups) {
    for (const state of Object.keys(counts) as Array<keyof PopupSurfaceCounts>) {
      counts[state] += group.counts[state];
    }
    attentionCount += group.attentionCount;
  }
  return { groups, counts, attentionCount };
};
