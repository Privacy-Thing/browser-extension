import type {
  SurfacePresentationState,
  SurfaceQueryCounts,
} from "@privacy-brand/xray-protocol";

import {
  aggregateAssessments,
  buildSurfaceAssessments,
  type SurfaceAttentionByKey,
} from "@/background/surface-assessments";
import type { SurfaceEvidenceByRealm } from "@/background/surface-evidence-tracker";
import { SPOOFING_SURFACES, type SpoofingSurfaceKey } from "@/shared/spoofing-surfaces";
import type {
  XRayAccessedCategories,
  PopupEffectiveSource,
  PopupEffectiveSummary,
  PopupNotificationKind,
  PopupPolicyNoticeKind,
  PopupResolutionState,
  PopupSiteSuggestion,
  RuntimeSnapshot,
  SurfaceMethodQueryCounts,
} from "@/shared/types";

const isActiveSuggestion = (suggestion: PopupSiteSuggestion): boolean =>
  suggestion.status === "pending";

const findSurfaceWarning = (
  key: SpoofingSurfaceKey,
  suggestions: readonly PopupSiteSuggestion[],
): PopupSiteSuggestion | undefined =>
  suggestions.find(
    (suggestion) =>
      (key === "worker" && suggestion.kind === "worker-csp-relaxation") ||
      (key === "sharedWorker" &&
        suggestion.kind === "shared-worker-injection-relaxation"),
  );

type PopupPolicySurfaceNotice = {
  kind: PopupPolicyNoticeKind;
  surfaceKey: Extract<SpoofingSurfaceKey, "serviceWorker" | "sharedWorker">;
};

const POLICY_SURFACE_NOTICES: Record<PopupPolicyNoticeKind, PopupPolicySurfaceNotice> =
  {
    "service-worker-block": {
      kind: "service-worker-block",
      surfaceKey: "serviceWorker",
    },
    "shared-worker-strict": {
      kind: "shared-worker-strict",
      surfaceKey: "sharedWorker",
    },
  };

const getStoredPolicyNotices = (
  kinds: ReadonlySet<PopupNotificationKind>,
): PopupPolicySurfaceNotice[] => {
  const notices: PopupPolicySurfaceNotice[] = [];
  for (const kind of Object.keys(POLICY_SURFACE_NOTICES) as PopupPolicyNoticeKind[]) {
    if (kinds.has(kind) && !notices.some((notice) => notice.kind === kind)) {
      notices.push(POLICY_SURFACE_NOTICES[kind]);
    }
  }
  return notices;
};

export const getApplicableNotices = ({
  snapshot,
  active,
  suggestions = [],
}: {
  snapshot: RuntimeSnapshot | null;
  active: boolean;
  suggestions?: readonly PopupSiteSuggestion[];
}): PopupPolicySurfaceNotice[] => {
  if (!active || !snapshot) return [];

  const notices: PopupPolicySurfaceNotice[] = [];
  if (snapshot.blockServiceWorkerRegistration === true) {
    notices.push({
      kind: "service-worker-block",
      surfaceKey: "serviceWorker",
    });
  }
  if (
    snapshot.sharedWorkerHandlingMode === "strict" &&
    !suggestions.some(
      (suggestion) =>
        suggestion.kind === "shared-worker-injection-relaxation" &&
        isActiveSuggestion(suggestion),
    )
  ) {
    notices.push({
      kind: "shared-worker-strict",
      surfaceKey: "sharedWorker",
    });
  }
  return notices;
};

export const getPopupPolicyNotices = ({
  snapshot,
  active,
  accessedCategories,
  suggestions = [],
}: {
  snapshot: RuntimeSnapshot | null;
  active: boolean;
  accessedCategories: XRayAccessedCategories;
  suggestions?: readonly PopupSiteSuggestion[];
}): PopupPolicySurfaceNotice[] =>
  getApplicableNotices({
    snapshot,
    active,
    suggestions,
  }).filter((notice) => accessedCategories[notice.surfaceKey] === true);

const resolveResolutionState = ({
  source,
  panicMode,
  supported,
  enabled,
  surfaces,
}: {
  source: PopupEffectiveSource;
  panicMode: boolean;
  supported: boolean;
  enabled: boolean | null;
  surfaces: PopupEffectiveSummary["surfaceSummary"]["surfaces"];
}): PopupResolutionState => {
  if (panicMode) return "panic";
  if (!supported) return "unsupported";
  if (source === "trusted-site") return "trusted";
  if (enabled === false) return "disabled";
  if (source === "none") return "unconfigured";

  // `browser-enforced`/`repaired` are both legitimately-protected outcomes
  // (#111) — a surface confirmed by DNR/browser-privacy readback or one that
  // self-healed after tampering is not "unconfigured".
  const isProtectedLike = (presentation: SurfacePresentationState): boolean =>
    presentation === "protected" ||
    presentation === "browser-enforced" ||
    presentation === "repaired";
  const protectedCount = surfaces.filter((surface) =>
    isProtectedLike(surface.presentation),
  ).length;
  if (protectedCount === 0) return "unconfigured";
  const locationProtected = surfaces.some(
    (surface) =>
      (surface.key === "geolocation" || surface.key === "timeLocale") &&
      isProtectedLike(surface.presentation),
  );
  return locationProtected ? "active" : "protections";
};

type SummaryPriority =
  PopupEffectiveSummary["surfaceSummary"]["highestPriorityAttention"];

const getPriorityAttention = (
  suggestions: readonly PopupSiteSuggestion[],
  policyNotices: readonly PopupPolicySurfaceNotice[],
  activeOnly: boolean,
): SummaryPriority => {
  const matches = (suggestion: PopupSiteSuggestion): boolean =>
    !activeOnly || isActiveSuggestion(suggestion);
  const workerSuggestion = suggestions.find(
    (suggestion) =>
      suggestion.kind === "shared-worker-injection-relaxation" && matches(suggestion),
  );
  if (workerSuggestion) {
    return {
      kind: workerSuggestion.kind,
      group: "workers",
      surfaceKey: "sharedWorker",
      reasonKey: "shared-worker-runtime-warning",
      actionTarget: "notification-list",
    };
  }
  const cspSuggestion = suggestions.find(
    (suggestion) => suggestion.kind === "worker-csp-relaxation" && matches(suggestion),
  );
  if (cspSuggestion) {
    return {
      kind: cspSuggestion.kind,
      group: "workers",
      surfaceKey: "worker",
      reasonKey: "worker-runtime-warning",
      actionTarget: "notification-list",
    };
  }
  const policyNotice = policyNotices[0];
  return policyNotice
    ? {
        kind: policyNotice.kind,
        group: "workers",
        surfaceKey: policyNotice.surfaceKey,
        reasonKey: policyNotice.kind,
        actionTarget: "notification-list",
      }
    : null;
};

const mergePolicyNotices = ({
  kinds,
  detected,
  storedKinds,
}: {
  kinds: ReadonlySet<PopupNotificationKind>;
  detected: readonly PopupPolicySurfaceNotice[];
  storedKinds: ReadonlySet<PopupNotificationKind>;
}): PopupPolicySurfaceNotice[] =>
  Array.from(
    new Map([
      ...detected
        .filter((notice) => kinds.has(notice.kind))
        .map((notice) => [notice.kind, notice] as const),
      ...getStoredPolicyNotices(
        new Set([...kinds].filter((kind) => storedKinds.has(kind))),
      ).map((notice) => [notice.kind, notice] as const),
    ]).values(),
  );

const buildSurfaceAttention = ({
  actionableSuggestions,
  contextualSuggestions,
  policyNotices,
  contextualPolicyNotices,
}: {
  actionableSuggestions: readonly PopupSiteSuggestion[];
  contextualSuggestions: readonly PopupSiteSuggestion[];
  policyNotices: readonly PopupPolicySurfaceNotice[];
  contextualPolicyNotices: readonly PopupPolicySurfaceNotice[];
}): SurfaceAttentionByKey => {
  const attentionBySurface: SurfaceAttentionByKey = {};
  for (const { key } of SPOOFING_SURFACES) {
    const attentionNotification =
      findSurfaceWarning(key, actionableSuggestions) ??
      policyNotices.find((notice) => notice.surfaceKey === key);
    const contextNotification =
      attentionNotification ??
      findSurfaceWarning(key, contextualSuggestions) ??
      contextualPolicyNotices.find((notice) => notice.surfaceKey === key);
    if (contextNotification) {
      attentionBySurface[key] = {
        reasonKey: contextNotification.kind,
        actionTarget: "notification-list",
        notificationKind: contextNotification.kind,
      };
    }
  }
  return attentionBySurface;
};

const buildSummaryResult = ({
  generation,
  source,
  pattern,
  enabled,
  editable,
  toggleable,
  panicMode,
  supported,
  surfaces,
  groups,
  counts,
  attentionCount,
  highestPriorityAttention,
  highestPriorityContext,
}: {
  generation: number;
  source: PopupEffectiveSource;
  pattern: string | null;
  enabled: boolean | null;
  editable: boolean;
  toggleable: boolean;
  panicMode: boolean;
  supported: boolean;
  surfaces: PopupEffectiveSummary["surfaceSummary"]["surfaces"];
  groups: PopupEffectiveSummary["surfaceSummary"]["groups"];
  counts: PopupEffectiveSummary["surfaceSummary"]["counts"];
  attentionCount: number;
  highestPriorityAttention: SummaryPriority;
  highestPriorityContext: SummaryPriority;
}): PopupEffectiveSummary => ({
  generation,
  resolutionContext: {
    source,
    state: resolveResolutionState({ source, panicMode, supported, enabled, surfaces }),
    pattern,
    editable,
    toggleable,
  },
  surfaceSummary: {
    catalogSize: SPOOFING_SURFACES.length,
    complete:
      surfaces.length === SPOOFING_SURFACES.length &&
      new Set(surfaces.map((surface) => surface.key)).size === SPOOFING_SURFACES.length,
    counts,
    attentionCount,
    groups,
    surfaces,
    highestPriorityException:
      surfaces.find((surface) => surface.presentation === "unknown") ?? null,
    highestPriorityAttention,
    highestPriorityContext,
  },
});

const isRuntimeExpected = ({
  supported,
  panicMode,
  source,
  enabled,
}: {
  supported: boolean;
  panicMode: boolean;
  source: PopupEffectiveSource;
  enabled: boolean | null;
}): boolean =>
  supported &&
  !panicMode &&
  source !== "trusted-site" &&
  source !== "none" &&
  enabled !== false;

const filterSuggestions = ({
  suggestions,
  expectRuntime,
  attentionKinds,
  contextKinds,
}: {
  suggestions: readonly PopupSiteSuggestion[];
  expectRuntime: boolean;
  attentionKinds: ReadonlySet<PopupNotificationKind>;
  contextKinds: ReadonlySet<PopupNotificationKind>;
}) => {
  const contextual = expectRuntime
    ? suggestions.filter((suggestion) => contextKinds.has(suggestion.kind))
    : [];
  const detected = expectRuntime ? suggestions.filter(isActiveSuggestion) : [];
  return {
    contextual,
    detected,
    actionable: detected.filter((suggestion) => attentionKinds.has(suggestion.kind)),
  };
};

const createKindSets = (
  attentionKinds: readonly PopupNotificationKind[],
  contextKinds: readonly PopupNotificationKind[],
  storedKinds: readonly PopupNotificationKind[],
) => ({
  attentionKindSet: new Set(attentionKinds),
  contextKindSet: new Set(contextKinds),
  storedKindSet: new Set(storedKinds),
});

const buildPolicySets = ({
  snapshot,
  expectRuntime,
  accessedCategories,
  detectedSuggestions,
  attentionKinds,
  contextKinds,
  storedKinds,
}: {
  snapshot: RuntimeSnapshot | null;
  expectRuntime: boolean;
  accessedCategories: XRayAccessedCategories;
  detectedSuggestions: readonly PopupSiteSuggestion[];
  attentionKinds: ReadonlySet<PopupNotificationKind>;
  contextKinds: ReadonlySet<PopupNotificationKind>;
  storedKinds: ReadonlySet<PopupNotificationKind>;
}) => {
  const detected = getPopupPolicyNotices({
    snapshot,
    active: expectRuntime,
    accessedCategories,
    suggestions: detectedSuggestions,
  });
  return {
    policyNotices: mergePolicyNotices({
      kinds: attentionKinds,
      detected,
      storedKinds,
    }),
    contextualPolicyNotices: mergePolicyNotices({
      kinds: contextKinds,
      detected,
      storedKinds,
    }),
  };
};

export const buildEffectiveSummary = ({
  generation,
  source,
  pattern,
  enabled,
  editable,
  toggleable,
  panicMode,
  supported,
  snapshot,
  suggestions,
  accessedCategories = {},
  failedCategories = {},
  evidenceByRealm = {},
  queryCounts = {},
  methodCounts = {},
  runtimeExpected,
  attentionKinds,
  contextNotificationKinds = attentionKinds,
  storedNotificationKinds = [],
}: {
  generation: number;
  source: PopupEffectiveSource;
  pattern: string | null;
  enabled: boolean | null;
  editable: boolean;
  toggleable: boolean;
  panicMode: boolean;
  supported: boolean;
  snapshot: RuntimeSnapshot | null;
  suggestions: readonly PopupSiteSuggestion[];
  accessedCategories?: XRayAccessedCategories;
  failedCategories?: XRayAccessedCategories;
  evidenceByRealm?: SurfaceEvidenceByRealm;
  queryCounts?: SurfaceQueryCounts;
  methodCounts?: SurfaceMethodQueryCounts;
  runtimeExpected?: boolean;
  attentionKinds: readonly PopupNotificationKind[];
  contextNotificationKinds?: readonly PopupNotificationKind[];
  storedNotificationKinds?: readonly PopupNotificationKind[];
}): PopupEffectiveSummary => {
  const expectRuntime =
    runtimeExpected ??
    isRuntimeExpected({
      supported,
      panicMode,
      source,
      enabled,
    });
  const { attentionKindSet, contextKindSet, storedKindSet } = createKindSets(
    attentionKinds,
    contextNotificationKinds,
    storedNotificationKinds,
  );
  const {
    contextual: contextualSuggestions,
    detected: detectedSuggestions,
    actionable: actionableSuggestions,
  } = filterSuggestions({
    suggestions,
    expectRuntime,
    attentionKinds: attentionKindSet,
    contextKinds: contextKindSet,
  });
  const { policyNotices, contextualPolicyNotices } = buildPolicySets({
    snapshot,
    expectRuntime,
    accessedCategories,
    detectedSuggestions,
    attentionKinds: attentionKindSet,
    contextKinds: contextKindSet,
    storedKinds: storedKindSet,
  });
  const attentionBySurface = buildSurfaceAttention({
    actionableSuggestions,
    contextualSuggestions,
    policyNotices,
    contextualPolicyNotices,
  });
  const surfaces = buildSurfaceAssessments({
    source,
    snapshot,
    runtimeExpected: expectRuntime,
    accessedCategories,
    failedCategories,
    evidenceByRealm,
    queryCounts,
    methodCounts,
    attentionBySurface,
  });
  const { groups, counts, attentionCount } = aggregateAssessments(surfaces);
  const highestPriorityAttention = getPriorityAttention(
    actionableSuggestions,
    policyNotices,
    true,
  );
  const highestPriorityContext = getPriorityAttention(
    contextualSuggestions,
    contextualPolicyNotices,
    false,
  );

  return buildSummaryResult({
    generation,
    source,
    pattern,
    enabled,
    editable,
    toggleable,
    panicMode,
    supported,
    surfaces,
    groups,
    counts,
    attentionCount,
    highestPriorityAttention,
    highestPriorityContext,
  });
};
