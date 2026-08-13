import { z } from "zod";

// 1. Surface Categories
export const XRayCategorySchema = z.enum([
  "geolocation",
  "timeLocale",
  "canvas",
  "webGL",
  "audio",
  "navigator",
  "screen",
  "clientHints",
  "battery",
  "webRTC",
  "worker",
  "serviceWorker",
  "sharedWorker",
]);

export type XRaySurfaceCategory = z.infer<typeof XRayCategorySchema>;

/**
 * Stable diagnostic method IDs accepted by Privacy Thing XRay.
 *
 * These values are protocol keys for counters and trace comparison. They are
 * not UI copy and must stay stable across runtime refactors unless the XRay
 * protocol intentionally changes.
 */
export const SurfaceMethodIdSchema = z.enum([
  "geolocation.getCurrentPosition",
  "geolocation.watchPosition",
  "geolocation.clearWatch",
  "geolocation.permissionsQuery",
  "date.constructor",
  "date.now",
  "date.parse",
  "date.getTimezoneOffset",
  "date.toString",
  "date.toLocaleString",
  "intl.constructor",
  "intl.resolvedOptions",
  "intl.DateTimeFormat.format",
  "intl.DateTimeFormat.formatToParts",
  "temporal.Now.instant",
  "temporal.Now.timeZoneId",
  "temporal.Now.plainDateTimeISO",
  "temporal.Now.zonedDateTimeISO",
  "temporal.Now.plainDateISO",
  "temporal.Now.plainTimeISO",
  "temporal.Duration.toLocaleString",
  "temporal.Instant.toLocaleString",
  "temporal.PlainDate.toLocaleString",
  "temporal.PlainDateTime.toLocaleString",
  "temporal.PlainMonthDay.toLocaleString",
  "temporal.PlainTime.toLocaleString",
  "temporal.PlainYearMonth.toLocaleString",
  "temporal.ZonedDateTime.toLocaleString",
  "canvas.getImageData",
  "canvas.toDataURL",
  "canvas.toBlob",
  "webGL.readPixels",
  "webGL.getExtension",
  "webGL.getSupportedExtensions",
  "webGL.getParameter",
  "audio.getFloatFrequencyData",
  "audio.getByteFrequencyData",
  "audio.getFloatTimeDomainData",
  "audio.getByteTimeDomainData",
  "audio.getChannelData",
  "navigator.webdriver",
  "navigator.hardwareConcurrency",
  "navigator.deviceMemory",
  "navigator.maxTouchPoints",
  "navigator.platform",
  "navigator.userAgent",
  "navigator.vendor",
  "navigator.appVersion",
  "screen.width",
  "screen.height",
  "screen.availWidth",
  "screen.availHeight",
  "screen.colorDepth",
  "screen.pixelDepth",
  "screen.devicePixelRatio",
  "clientHints.brands",
  "clientHints.mobile",
  "clientHints.platform",
  "clientHints.toJSON",
  "clientHints.getHighEntropyValues",
  "battery.getBattery",
  "webRTC.constructor",
  "webRTC.createOffer",
  "webRTC.createAnswer",
  "worker.constructor",
  "serviceWorker.register",
  "sharedWorker.constructor",
]);

/** Stable protocol-facing key for one spoofed API method. */
export type SpoofingSurfaceMethodId = z.infer<typeof SurfaceMethodIdSchema>;

export const XRayAccessSchema = z.record(XRayCategorySchema, z.literal(true));

export type XRayAccessedCategories = z.infer<typeof XRayAccessSchema>;

/**
 * Optional per-method XRay counters.
 *
 * `queryCounts` remains the category-level aggregate for compatibility.
 * `methodCounts` is diagnostic detail keyed by stable method IDs.
 */
export type SurfaceMethodQueryCounts = Partial<Record<SpoofingSurfaceMethodId, number>>;

export const SurfaceGroupSchema = z.enum([
  "location-locale",
  "browser-identity",
  "rendering-media",
  "workers",
]);

export type SurfaceGroup = z.infer<typeof SurfaceGroupSchema>;

export const ApplicabilitySchema = z.enum(["applicable", "not-applicable"]);
export type SurfaceApplicability = z.infer<typeof ApplicabilitySchema>;

// Full evidence model (GitHub #111 / P0-05). Policy/Installation/Integrity/
// Enforcement are deliberately independent axes — flattening them into one
// enum hides real combinations (e.g. a hybrid surface can have an intact
// network layer while its JavaScript layer is degraded; neither erases the
// other). `presentation` is the single, background-computed rollup of all of
// them plus `activity`; nothing else in this codebase re-derives it.
export const SurfacePolicyStateSchema = z.enum([
  "protect",
  "block",
  "native",
  "not-applicable",
]);
export type SurfacePolicyState = z.infer<typeof SurfacePolicyStateSchema>;

export const InstallationStateSchema = z.enum([
  "not-expected",
  "pending",
  "installed",
  "failed",
]);
export type SurfaceInstallationState = z.infer<typeof InstallationStateSchema>;

// `degraded` here is broader than SurfaceIntegrityRegistry's own vocabulary
// (intact/repaired/unrecoverable/not-applicable/unconfirmed) — it is
// synthesized by the background builder for cases the descriptor-level
// registry has no concept of, such as a Worker that ran natively or a hybrid
// surface that lost one enforcement layer.
export const IntegrityStateSchema = z.enum([
  "not-applicable",
  "unconfirmed",
  "intact",
  "repaired",
  "degraded",
  "unrecoverable",
]);
export type SurfaceIntegrityState = z.infer<typeof IntegrityStateSchema>;

export const EnforcementKindSchema = z.enum([
  "none",
  "javascript",
  "browser",
  "network",
  "hybrid",
]);
export type SurfaceEnforcementKind = z.infer<typeof EnforcementKindSchema>;

export const ReasonSourceSchema = z.enum([
  "runtime",
  "integrity",
  "worker",
  "dnr",
  "browser-privacy",
  "policy",
  "transport",
]);
export type ProtectionReasonSource = z.infer<typeof ReasonSourceSchema>;

export const ReasonSeveritySchema = z.enum(["info", "warning", "critical"]);
export type ProtectionReasonSeverity = z.infer<typeof ReasonSeveritySchema>;

/**
 * Bump when `SurfaceReasonCodeSchema`, the evidence axes, or their semantics
 * change in a way a consumer must notice. Surfaced on `GetXRayStateResponse`
 * as `evidenceProtocolVersion` so a reader can detect the contract version it
 * is looking at.
 */
export const EVIDENCE_VERSION = 1;

/**
 * Versioned, closed dictionary of stable reason-code identifiers (#111). These
 * are protocol keys, never UI copy. The first block mirrors the descriptor
 * SurfaceIntegrityRegistry's `IntegrityReason` vocabulary; the rest are the
 * background/transport-level producers plus status-derived fallbacks.
 */
export const SurfaceReasonCodeSchema = z.enum([
  // descriptor-integrity registry reasons
  "descriptor-missing",
  "descriptor-replaced",
  "descriptor-flags-changed",
  "prototype-chain-changed",
  "target-not-ready",
  "target-missing",
  "target-non-extensible",
  "hostile-non-configurable",
  "repair-failed",
  "realm-destroyed",
  // status-derived fallbacks (no more specific reason available)
  "integrity-repaired",
  "integrity-unconfirmed",
  "integrity-unrecoverable",
  "installation-pending",
  "installation-failed",
  // background/transport producers
  "runtime-surface-failed",
  "worker-native-fallback",
  "dnr-header-rule-mismatch",
  "webrtc-policy-mismatch",
  "webrtc-policy-confirmed",
  "unknown",
]);
export type SurfaceReasonCode = z.infer<typeof SurfaceReasonCodeSchema>;

export const ProtectionReasonSchema = z.object({
  code: SurfaceReasonCodeSchema,
  source: ReasonSourceSchema,
  severity: ReasonSeveritySchema,
  realmId: z.string().optional(),
  frameId: z.string().optional(),
  attemptId: z.string().optional(),
  observedAt: z.number(),
});
export type SurfaceProtectionReason = z.infer<typeof ProtectionReasonSchema>;

export const ProtectionEvidenceSchema = z.object({
  policy: SurfacePolicyStateSchema,
  installation: InstallationStateSchema,
  integrity: IntegrityStateSchema,
  enforcement: EnforcementKindSchema,
  reasons: z.array(ProtectionReasonSchema),
  confirmedAt: z.number().optional(),
  revision: z.number().optional(),
});
export type ProtectionEvidence = z.infer<typeof ProtectionEvidenceSchema>;

// Precedence (highest wins) when collapsing evidence to one displayed state:
// not-applicable > native-by-policy > unrecoverable > degraded > pending >
// repaired > browser-enforced > protected > unknown.
export const PresentationStateSchema = z.enum([
  "not-applicable",
  "native-by-policy",
  "unrecoverable",
  "degraded",
  "pending",
  "repaired",
  "browser-enforced",
  "protected",
  "unknown",
]);
export type SurfacePresentationState = z.infer<typeof PresentationStateSchema>;

export const SurfaceActivitySchema = z.object({
  accessed: z.boolean(),
  failed: z.boolean(),
  queryCount: z.number().nonnegative(),
  methodCounts: z.record(SurfaceMethodIdSchema, z.number().nonnegative()),
});
export type SurfaceActivity = z.infer<typeof SurfaceActivitySchema>;

export const SurfaceAttentionSchema = z.object({
  reasonKey: z.string(),
  actionTarget: z.string(),
  notificationKind: z.string().optional(),
});
export type SurfaceAttention = z.infer<typeof SurfaceAttentionSchema>;

/**
 * Background-owned assessment shared by XRay and popup projections.
 * `presentation` is computed once (src/shared/surface-assessments.ts) from
 * `evidence` and never re-derived by any UI consumer. `attention` stays a
 * fully independent axis — a pending suggestion/notification does not change
 * `presentation`; UI layers it as a separate badge.
 */
export const SurfaceAssessmentSchema = z
  .object({
    key: XRayCategorySchema,
    group: SurfaceGroupSchema,
    applicability: ApplicabilitySchema,
    evidence: ProtectionEvidenceSchema,
    activity: SurfaceActivitySchema,
    attention: SurfaceAttentionSchema.optional(),
    presentation: PresentationStateSchema,
  })
  .superRefine((assessment, context) => {
    const policyMatches =
      assessment.applicability === "not-applicable"
        ? assessment.evidence.policy === "not-applicable"
        : assessment.evidence.policy !== "not-applicable";
    if (!policyMatches) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence", "policy"],
        message:
          "evidence.policy must be not-applicable exactly when applicability is not-applicable.",
      });
    }

    const presentationMatches =
      assessment.applicability === "not-applicable"
        ? assessment.presentation === "not-applicable"
        : assessment.presentation !== "not-applicable";
    if (!presentationMatches) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["presentation"],
        message:
          "presentation must be not-applicable exactly when applicability is not-applicable.",
      });
    }

    // Defense-in-depth against a future resolver bug — not a substitute for the
    // one precedence function in src/shared/surface-assessments.ts.
    if (assessment.presentation === "protected") {
      const { policy, installation, integrity } = assessment.evidence;
      const policyRequiresProtection = policy === "protect" || policy === "block";
      if (
        !policyRequiresProtection ||
        installation !== "installed" ||
        integrity !== "intact"
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["presentation"],
          message:
            "protected requires policy protect/block, installation installed, integrity intact.",
        });
      }
    }
  });
export type SurfaceAssessment = z.infer<typeof SurfaceAssessmentSchema>;

export const SharedWorkerStatusSchema = z.enum([
  "native-compatibility",
  "blob-wrapper-dedup-disabled",
  "response-rewrite-preserved-identity",
  "response-rewrite-cache-sensitive",
  "module-rewrite-unsupported",
  "identity-conflict",
  "response-rewrite-unavailable",
  "blocked-strict",
  "strict-rewrite-required",
  "strict-blocked-cache-sensitive",
]);

export type SharedWorkerStatus = z.infer<typeof SharedWorkerStatusSchema>;

// 2. Runtime Snapshot
export const RuntimeSnapshotSchema = z.object({
  geo: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number(),
    noiseRadius: z.number(),
  }),
  locale: z.object({
    language: z.string(),
    languages: z.array(z.string()).readonly(),
    timeZone: z.string(),
    acceptLanguage: z.string(),
    formattingLanguage: z.string().optional(),
    formattingLanguages: z.array(z.string()).readonly().optional(),
  }),
  /** Compatibility payload for pre-epoch-fix runtimes. New consumers use locale.timeZone. */
  date: z.object({
    baseEpochMs: z.number(),
    offsetMs: z.number(),
    timeZone: z.string(),
  }),
  debugMode: z.boolean(),
  watchPositionDelay: z.tuple([z.number(), z.number()]),
  sharedWorkerHandlingMode: z.enum(["native", "spoof", "strict"]).optional(),
  sharedWorkerCompatibilityMode: z.boolean().optional(),
  geolocationEnabled: z.boolean().optional(),
  timeLocaleEnabled: z.boolean().optional(),
  temporalApiEnabled: z.boolean().optional(),
  fingerprint: z.any().optional(),
  logEventName: z.string().optional(),
  blockServiceWorkerRegistration: z.boolean().optional(),
  authKey: z.string().optional(),
});

export type RuntimeSnapshot = {
  geo: {
    latitude: number;
    longitude: number;
    accuracy: number;
    noiseRadius: number;
  };
  locale: {
    language: string;
    languages: readonly string[];
    timeZone: string;
    acceptLanguage: string;
    formattingLanguage?: string;
    formattingLanguages?: readonly string[];
  };
  /** @deprecated Compatibility payload for pre-epoch-fix runtimes. */
  date: {
    baseEpochMs: number;
    offsetMs: number;
    timeZone: string;
  };
  debugMode: boolean;
  watchPositionDelay: [number, number];
  sharedWorkerHandlingMode?: "native" | "spoof" | "strict";
  sharedWorkerCompatibilityMode?: boolean;
  geolocationEnabled?: boolean | undefined;
  timeLocaleEnabled?: boolean | undefined;
  temporalApiEnabled?: boolean | undefined;
  fingerprint?: any;
  logEventName?: string;
  blockServiceWorkerRegistration?: boolean;
  authKey?: string;
};

// 3. Rule Resolution Explanation
export const RuleStepSourceSchema = z.enum([
  "trusted-site",
  "exact-rule",
  "suffix-rule",
  "container",
  "fallback",
  "none",
]);

export type RuleResolutionStepSource = z.infer<typeof RuleStepSourceSchema>;

export const RuleStepStatusSchema = z.enum(["won", "skipped", "no-match", "disabled"]);

export type RuleResolutionStepStatus = z.infer<typeof RuleStepStatusSchema>;

export const RuleResolutionStepSchema = z.object({
  source: RuleStepSourceSchema,
  status: RuleStepStatusSchema,
  pattern: z.string().optional(),
  locationId: z.string().nullable().optional(),
});

export type RuleResolutionStep = {
  source: RuleResolutionStepSource;
  status: RuleResolutionStepStatus;
  pattern?: string;
  locationId?: string | null;
};

export const ResolutionExplainSchema = z.object({
  steps: z.array(RuleResolutionStepSchema),
  winningSource: z.enum(["trusted-site", "rule", "container", "fallback", "none"]),
  effectiveLocationId: z.string().nullable(),
});

export type ResolutionExplanation = {
  steps: RuleResolutionStep[];
  winningSource: "trusted-site" | "rule" | "container" | "fallback" | "none";
  effectiveLocationId: string | null;
};

// 4. Responses
export const XRayStateResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    hostname: z.string().nullable(),
    snapshot: RuntimeSnapshotSchema.nullable(),
    evidenceProtocolVersion: z.number().optional(),
    displayedProfileLabel: z.string().nullable(),
    locationId: z.string().nullable(),
    rulePattern: z.string().nullable(),
    assessments: z.array(SurfaceAssessmentSchema),
    accessedCategories: XRayAccessSchema,
    failedCategories: XRayAccessSchema,
    sharedWorkerStatus: SharedWorkerStatusSchema.optional(),
    queryCounts: z.record(XRayCategorySchema, z.number()).optional(),
    methodCounts: z.record(SurfaceMethodIdSchema, z.number()).optional(),
    explanation: ResolutionExplainSchema.nullable(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export type GetXRayStateResponse =
  | {
      ok: true;
      hostname: string | null;
      snapshot: RuntimeSnapshot | null;
      evidenceProtocolVersion?: number;
      displayedProfileLabel: string | null;
      locationId: string | null;
      rulePattern: string | null;
      assessments: SurfaceAssessment[];
      accessedCategories: XRayAccessedCategories;
      failedCategories: XRayAccessedCategories;
      sharedWorkerStatus?: SharedWorkerStatus;
      queryCounts?: SurfaceQueryCounts;
      methodCounts?: SurfaceMethodQueryCounts;
      explanation: ResolutionExplanation | null;
    }
  | {
      ok: false;
      error: string;
    };

// 5. Commands/Messages
export const XRayStateCommandSchema = z.object({
  type: z.literal("pt:get-doctor-state"),
  tabId: z.number().optional(),
});

export type GetXRayStateCommand = z.infer<typeof XRayStateCommandSchema>;

export const UsageCommandSchema = z.object({
  type: z.literal("pt:surface-usage"),
  categories: z.array(XRayCategorySchema),
  sourceId: z.string().min(1).max(128).optional(),
  counts: z.record(XRayCategorySchema, z.number()).optional(),
  methodCounts: z.record(SurfaceMethodIdSchema, z.number()).optional(),
});

export type SurfaceUsageCommand = z.infer<typeof UsageCommandSchema>;

export type SurfaceQueryCounts = Partial<Record<XRaySurfaceCategory, number>>;

/**
 * One realm's report about a single surface (#111 / P0-05). Rides the same
 * `pt:surface-error` channel as the legacy boolean failure signal — when
 * `evidence` is present the background records per-realm axis detail
 * (installation/integrity), when absent it falls back to the coarse
 * "this category failed" behavior.
 */
export const EvidenceReportSchema = z.object({
  realmId: z.string(),
  attemptId: z.string().optional(),
  installation: InstallationStateSchema.optional(),
  integrity: IntegrityStateSchema.optional(),
  reasonCode: z.string().optional(),
});

export type SurfaceEvidenceReport = z.infer<typeof EvidenceReportSchema>;

export const SurfaceErrorSchema = z.object({
  type: z.literal("pt:surface-error"),
  categories: z.array(XRayCategorySchema),
  evidence: EvidenceReportSchema.optional(),
});

export type SurfaceErrorCommand = z.infer<typeof SurfaceErrorSchema>;

export const RequestUsageSchema = z.object({
  type: z.literal("pt:request-surface-usage"),
});

export type RequestUsageCommand = z.infer<typeof RequestUsageSchema>;

export const XRayCommandSchema = z.union([
  XRayStateCommandSchema,
  UsageCommandSchema,
  SurfaceErrorSchema,
  RequestUsageSchema,
]);

export type XRayCommand = z.infer<typeof XRayCommandSchema>;
