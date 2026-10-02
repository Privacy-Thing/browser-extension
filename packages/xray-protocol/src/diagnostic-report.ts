import { z } from "zod";

import {
  ApplicabilitySchema,
  EnforcementKindSchema,
  type GetXRayStateResponse,
  type SurfaceAssessment,
  InstallationStateSchema,
  IntegrityStateSchema,
  PresentationStateSchema,
  ReasonSeveritySchema,
  ReasonSourceSchema,
  SharedWorkerStatusSchema,
  SurfaceMethodIdSchema,
  SurfacePolicyStateSchema,
  SurfaceReasonCodeSchema,
  XRayCategorySchema,
} from "./index";

export const REPORT_SCHEMA_VERSION = 1;
export const EVIDENCE_MAX_AGE_MS = 5 * 60 * 1000;
export const REPORT_MAX_BYTES = 128 * 1024;
const MAX_REASONS = 16;
const timestamp = z.number().int().nonnegative().max(8_640_000_000_000_000);
const counter = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const sourceSchema = z.enum([
  "trusted-site",
  "rule",
  "container",
  "fallback",
  "none",
  "unknown",
]);
const reportReasonSchema = z.enum([
  "state-unavailable",
  "unsupported-tab",
  "missing-evidence",
  "stale-evidence",
  "incomplete-measurement",
  "invalid-data",
  "evidence-truncated",
]);
const configSurfaceSchema = z
  .object({
    id: XRayCategorySchema,
    applicability: ApplicabilitySchema,
    policy: SurfacePolicyStateSchema,
    enforcement: EnforcementKindSchema,
  })
  .strict();
const assessmentSchema = z
  .object({
    id: XRayCategorySchema,
    presentation: PresentationStateSchema,
    installation: InstallationStateSchema,
    integrity: IntegrityStateSchema,
  })
  .strict();
const reasonSchema = z
  .object({
    code: SurfaceReasonCodeSchema,
    source: ReasonSourceSchema,
    severity: ReasonSeveritySchema,
    observedAt: timestamp.nullable(),
  })
  .strict();
const observationSchema = z
  .object({
    id: XRayCategorySchema,
    availability: z.enum(["available", "missing", "stale", "unsupported"]),
    observedAt: timestamp.nullable(),
    activity: z
      .object({
        accessed: z.boolean(),
        failed: z.boolean(),
        queryCount: counter,
        methods: z
          .array(z.object({ id: SurfaceMethodIdSchema, count: counter }).strict())
          .max(SurfaceMethodIdSchema.options.length),
      })
      .strict(),
    reasons: z.array(reasonSchema).max(MAX_REASONS),
  })
  .strict();

// Only host syntax is accepted: URL paths, credentials, ports and query strings
// cannot become optional site data. URL supplies IDNA and lowercase normalization.
export const normalizeDiagnosticHost = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length > 253) return null;
  const ipv6 = /^\[[0-9a-f:.]+\]$/i.test(value);
  if (!ipv6 && !/^[a-z0-9.\-\u0080-\uffff]+$/i.test(value)) return null;
  try {
    const host = new URL(`https://${value}`).hostname.replace(/\.$/, "");
    if (ipv6) return host;
    if (
      !host ||
      host.length > 253 ||
      !host
        .split(".")
        .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    )
      return null;
    return host;
  } catch {
    return null;
  }
};
export const normalizeReportPattern = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const wildcard = value.startsWith("*.");
  const host = normalizeDiagnosticHost(wildcard ? value.slice(2) : value);
  if (!host || (wildcard && host.startsWith("["))) return null;
  return `${wildcard ? "*." : ""}${host}`;
};
const hostSchema = z
  .string()
  .refine((value) => normalizeDiagnosticHost(value) === value);
const patternSchema = z
  .string()
  .refine((value) => normalizeReportPattern(value) === value);

/** Every exported object is strict, including optional site data and nested rows. */
export const DiagnosticReportSchema = z
  .object({
    schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
    generatedAt: timestamp,
    extension: z
      .object({
        version: z
          .string()
          .regex(/^\d{1,5}(?:\.\d{1,5}){2,3}$/)
          .nullable(),
        channel: z.enum(["release", "beta", "local"]),
      })
      .strict(),
    browser: z
      .object({
        family: z.enum(["chromium", "firefox", "unknown"]),
        majorVersion: z.number().int().positive().max(9999).nullable(),
      })
      .strict(),
    evidenceProtocolVersion: counter.nullable(),
    status: z.enum(["complete", "partial"]),
    reasonCodes: z.array(reportReasonSchema).max(reportReasonSchema.options.length),
    configuration: z
      .object({
        source: sourceSchema,
        runtimeConfigured: z.boolean().nullable(),
        surfaces: z.array(configSurfaceSchema).max(XRayCategorySchema.options.length),
      })
      .strict(),
    // Assessments can include inferred installation/integrity. They are deliberately
    // separate from actual observations, even if their presentation is "protected".
    assessment: z.array(assessmentSchema).max(XRayCategorySchema.options.length),
    observedEvidence: z
      .object({
        collection: z.enum(["ready", "pending", "unavailable"]),
        staleAfterMs: z.literal(EVIDENCE_MAX_AGE_MS),
        sharedWorkerStatus: SharedWorkerStatusSchema.nullable(),
        surfaces: z.array(observationSchema).max(XRayCategorySchema.options.length),
      })
      .strict(),
    site: z
      .object({ hostname: hostSchema.nullable(), pattern: patternSchema.nullable() })
      .strict()
      .optional(),
  })
  .strict();
export type DiagnosticReport = z.infer<typeof DiagnosticReportSchema>;

export type DiagnosticReportInput = {
  state: GetXRayStateResponse | null;
  generatedAt: number;
  extension: DiagnosticReport["extension"];
  browser: DiagnosticReport["browser"];
  collectionPending: boolean;
  includeSiteData?: boolean;
};

type AddReason = (code: z.infer<typeof reportReasonSchema>) => void;
type ReadyState = Extract<GetXRayStateResponse, { ok: true }>;

const collectionState = (state: ReadyState | null, pending: boolean) => {
  if (!state) return "unavailable" as const;
  return pending ? ("pending" as const) : ("ready" as const);
};
const observationTime = (value: unknown, generatedAt: number): number | null => {
  const parsed = timestamp.safeParse(value);
  return parsed.success && parsed.data <= generatedAt ? parsed.data : null;
};
const evidenceAvailability = (
  row: SurfaceAssessment,
  observedAt: number | null,
  generatedAt: number,
): z.infer<typeof observationSchema>["availability"] => {
  if (row.applicability === "not-applicable") return "unsupported";
  if (observedAt === null) return "missing";
  return generatedAt - observedAt > EVIDENCE_MAX_AGE_MS ? "stale" : "available";
};
const projectReasons = (
  row: SurfaceAssessment,
  generatedAt: number,
  addReason: AddReason,
) => {
  const reasons: z.infer<typeof reasonSchema>[] = [];
  for (const reason of row.evidence.reasons.slice(0, MAX_REASONS)) {
    const safe = reasonSchema.safeParse({
      code: SurfaceReasonCodeSchema.safeParse(reason.code).data ?? "unknown",
      source: reason.source,
      severity: reason.severity,
      // Coarse failures are stamped at resolution, rather than observation.
      observedAt: reason.realmId
        ? observationTime(reason.observedAt, generatedAt)
        : null,
    });
    if (safe.success) reasons.push(safe.data);
    else addReason("invalid-data");
  }
  if (row.evidence.reasons.length > MAX_REASONS) addReason("evidence-truncated");
  return reasons;
};
const methodMatchesSurface = (
  id: string,
  surface: SurfaceAssessment["key"],
): boolean => {
  if (surface === "timeLocale") return /^(date|intl|temporal)\./.test(id);
  return id.startsWith(`${surface}.`);
};

const projectMethods = (row: SurfaceAssessment, addReason: AddReason) => {
  const methods: z.infer<typeof observationSchema>["activity"]["methods"] = [];
  for (const id of SurfaceMethodIdSchema.options) {
    if (!methodMatchesSurface(id, row.key)) continue;
    const value = row.activity.methodCounts[id];
    if (value === undefined) continue;
    const count = counter.safeParse(value);
    if (count.success) methods.push({ id, count: count.data });
    else addReason("invalid-data");
  }
  return methods;
};
const projectObservation = (
  row: SurfaceAssessment,
  generatedAt: number,
  addReason: AddReason,
) => {
  const observedAt = observationTime(
    row.evidence.observedAt ?? row.evidence.confirmedAt,
    generatedAt,
  );
  const availability = evidenceAvailability(row, observedAt, generatedAt);
  if (
    row.evidence.installation === "pending" ||
    row.evidence.integrity === "unconfirmed"
  )
    addReason("incomplete-measurement");
  if (availability === "missing") addReason("missing-evidence");
  if (availability === "stale") addReason("stale-evidence");
  return observationSchema.safeParse({
    id: row.key,
    availability,
    observedAt,
    activity: {
      accessed: row.activity.accessed,
      failed: row.activity.failed,
      queryCount: row.activity.queryCount,
      methods: projectMethods(row, addReason),
    },
    reasons: projectReasons(row, generatedAt, addReason),
  });
};
const projectSurfaces = (
  state: ReadyState | null,
  report: DiagnosticReport,
  addReason: AddReason,
) => {
  const seen = new Set<string>();
  for (const row of state?.assessments ?? []) {
    const configuration = configSurfaceSchema.safeParse({
      id: row.key,
      applicability: row.applicability,
      policy: row.evidence?.policy,
      enforcement: row.evidence?.enforcement,
    });
    const assessment = assessmentSchema.safeParse({
      id: row.key,
      presentation: row.presentation,
      installation: row.evidence?.installation,
      integrity: row.evidence?.integrity,
    });
    if (!configuration.success || !assessment.success || seen.has(row.key)) {
      addReason("invalid-data");
      continue;
    }
    seen.add(row.key);
    report.configuration.surfaces.push(configuration.data);
    report.assessment.push(assessment.data);
    const observation = projectObservation(row, report.generatedAt, addReason);
    if (observation.success) report.observedEvidence.surfaces.push(observation.data);
    else addReason("invalid-data");
  }
  if (state && seen.size < XRayCategorySchema.options.length)
    addReason("incomplete-measurement");
};
const projectSite = (
  state: ReadyState | null,
): NonNullable<DiagnosticReport["site"]> => {
  const winningPattern = state?.explanation?.steps.find(
    (step) =>
      step.status === "won" &&
      (step.source === "trusted-site" ||
        step.source === "exact-rule" ||
        step.source === "suffix-rule"),
  )?.pattern;
  return {
    hostname: normalizeDiagnosticHost(state?.hostname),
    pattern: normalizeReportPattern(winningPattern ?? state?.rulePattern),
  };
};

/** Projects rich X-Ray state; no spread, snapshot serialization or free text. */
export const buildDiagnosticReport = (
  input: DiagnosticReportInput,
): DiagnosticReport => {
  const state = input.state?.ok ? input.state : null;
  const report: DiagnosticReport = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: timestamp.parse(input.generatedAt),
    extension: DiagnosticReportSchema.shape.extension.parse({
      version: input.extension.version,
      channel: input.extension.channel,
    }),
    browser: DiagnosticReportSchema.shape.browser.parse({
      family: input.browser.family,
      majorVersion: input.browser.majorVersion,
    }),
    evidenceProtocolVersion:
      counter.safeParse(state?.evidenceProtocolVersion).data ?? null,
    status: "complete",
    reasonCodes: [],
    configuration: {
      source:
        sourceSchema.safeParse(state?.explanation?.winningSource).data ?? "unknown",
      runtimeConfigured: state ? state.snapshot !== null : null,
      surfaces: [],
    },
    assessment: [],
    observedEvidence: {
      collection: collectionState(state, input.collectionPending),
      staleAfterMs: EVIDENCE_MAX_AGE_MS,
      sharedWorkerStatus:
        SharedWorkerStatusSchema.safeParse(state?.sharedWorkerStatus).data ?? null,
      surfaces: [],
    },
  };
  const addReason: AddReason = (code) => {
    report.status = "partial";
    if (!report.reasonCodes.includes(code)) report.reasonCodes.push(code);
  };
  if (!state) addReason("state-unavailable");
  if (state && !state.hostname) addReason("unsupported-tab");
  if (input.collectionPending) addReason("incomplete-measurement");
  projectSurfaces(state, report, addReason);
  if (input.includeSiteData === true) report.site = projectSite(state);
  return DiagnosticReportSchema.parse(report);
};

const reportBrowserFamily = (
  firefox: boolean,
  chromium: boolean,
): DiagnosticReport["browser"]["family"] => {
  if (firefox) return "firefox";
  return chromium ? "chromium" : "unknown";
};

export const reportBrowserFromUA = (userAgent: string): DiagnosticReport["browser"] => {
  const firefox = /Firefox\/(\d{1,4})\b/.exec(userAgent);
  const chromium = /(?:Chrome|Chromium|Edg|OPR)\/(\d{1,4})\b/.exec(userAgent);
  const match = firefox ?? chromium;
  const major = match ? Number(match[1]) : null;
  return {
    family: reportBrowserFamily(Boolean(firefox), Boolean(chromium)),
    majorVersion: major && major > 0 ? major : null,
  };
};

const bounded = (value: string): string => {
  if (new TextEncoder().encode(value).length > REPORT_MAX_BYTES)
    throw new Error("diagnostic-report-too-large");
  return value;
};
export const serializeDiagnosticJson = (report: DiagnosticReport): string =>
  bounded(JSON.stringify(DiagnosticReportSchema.parse(report), null, 2) + "\n");

// Flatten only the validated report, making the text a readable, lossless view
// of the same fields. Strict parsing also rejects mutations before downloading.
export const serializeDiagnosticText = (report: DiagnosticReport): string => {
  const lines: string[] = [];
  const visit = (value: unknown, path: string) => {
    if (value !== null && typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length === 0) lines.push(`${path}: []`);
      for (const [key, child] of entries) visit(child, path ? `${path}.${key}` : key);
    } else {
      lines.push(`${path}: ${String(value)}`);
    }
  };
  visit(DiagnosticReportSchema.parse(report), "");
  return bounded(lines.join("\n") + "\n");
};
