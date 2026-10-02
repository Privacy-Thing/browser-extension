import { describe, expect, it } from "vitest";

import {
  buildDiagnosticReport,
  EVIDENCE_MAX_AGE_MS,
  REPORT_MAX_BYTES,
  DiagnosticReportSchema,
  reportBrowserFromUA,
  normalizeDiagnosticHost,
  normalizeReportPattern,
  serializeDiagnosticJson,
  serializeDiagnosticText,
  type DiagnosticReportInput,
} from "./diagnostic-report";

import {
  type GetXRayStateResponse,
  type SurfaceAssessment,
  XRayCategorySchema,
  SurfaceMethodIdSchema,
} from "./index";

const HOST = "private.example.test";
const SECRET = "NEVER-EXPORT-THIS";
const NOW = 1_800_000_000_000;
const row = (key: SurfaceAssessment["key"]): SurfaceAssessment => ({
  key,
  group: "rendering-media",
  applicability: "applicable",
  evidence: {
    policy: "protect",
    installation: "installed",
    integrity: "intact",
    enforcement: "javascript",
    reasons: [],
    observedAt: NOW - 1000,
  },
  activity: {
    accessed: true,
    failed: false,
    queryCount: 2,
    methodCounts: { "canvas.toDataURL": 2 },
  },
  presentation: "protected",
});
const fixture = (): Extract<GetXRayStateResponse, { ok: true }> => ({
  ok: true,
  hostname: HOST,
  displayedProfileLabel: HOST,
  locationId: HOST,
  rulePattern: `*.${HOST}`,
  evidenceProtocolVersion: 1,
  snapshot: {
    geo: {
      latitude: 51.1234567,
      longitude: 21.9876543,
      accuracy: 10,
      noiseRadius: 200,
    },
    locale: { language: HOST, languages: [HOST], timeZone: HOST, acceptLanguage: HOST },
    date: { baseEpochMs: NOW, offsetMs: 0, timeZone: HOST },
    debugMode: true,
    watchPositionDelay: [60, 500],
    authKey: SECRET,
    fingerprint: {
      userAgent: HOST,
      seed: SECRET,
      apiKey: SECRET,
      nested: { logs: [HOST] },
    },
  },
  assessments: XRayCategorySchema.options.map(row),
  accessedCategories: {},
  failedCategories: {},
  explanation: {
    winningSource: "rule",
    effectiveLocationId: HOST,
    steps: [
      { source: "trusted-site", status: "no-match", pattern: HOST, locationId: HOST },
      { source: "suffix-rule", status: "won", pattern: `*.${HOST}`, locationId: HOST },
    ],
  },
});
const input = (
  state: GetXRayStateResponse | null = fixture(),
): DiagnosticReportInput => ({
  state,
  generatedAt: NOW,
  extension: { version: "0.9.3.10", channel: "local" },
  browser: { family: "chromium", majorVersion: 141 },
  collectionPending: false,
});
const both = (report: ReturnType<typeof buildDiagnosticReport>) => [
  serializeDiagnosticJson(report),
  serializeDiagnosticText(report),
];

describe("local diagnostic report privacy boundary", () => {
  it.each([false, true])(
    "projects only closed fields, includeSiteData=%s",
    (includeSiteData) => {
      const state = fixture();
      Object.assign(state, {
        logs: [HOST, SECRET],
        error: `https://${HOST}/account?key=${SECRET}`,
        seed: SECRET,
      });
      Object.assign(state.explanation!, { explanation: HOST, name: HOST });
      const first = state.assessments[0]!;
      Object.assign(first, { profileName: HOST, snapshot: state.snapshot });
      Object.assign(first.activity.methodCounts, { [HOST]: 99 });
      Object.assign(first.evidence, { error: HOST, authKey: SECRET });
      first.evidence.reasons = [
        {
          code: "descriptor-replaced",
          source: "integrity",
          severity: "warning",
          observedAt: NOW - 1000,
          realmId: HOST,
          frameId: HOST,
          attemptId: HOST,
        },
      ];
      Object.assign(first.evidence.reasons[0]!, {
        explanation: HOST,
        nested: { apiKey: SECRET },
      });
      const report = buildDiagnosticReport({ ...input(state), includeSiteData });
      for (const output of both(report)) {
        expect(output).not.toContain(SECRET);
        expect(output).not.toContain("51.1234567");
        expect(output).not.toContain("21.9876543");
        expect(output).not.toContain("https://");
        expect(output).not.toContain("locationId");
        expect(output).not.toContain("profileName");
        expect(output).not.toContain("explanation");
        expect(output).not.toContain("realmId");
        expect(output).not.toContain("logs");
        if (!includeSiteData) expect(output).not.toContain(HOST);
      }
      if (includeSiteData) {
        expect(report.site).toEqual({ hostname: HOST, pattern: `*.${HOST}` });
        const { site: _site, ...redacted } = report;
        expect(JSON.stringify(redacted)).not.toContain(HOST);
      } else expect(report).not.toHaveProperty("site");
    },
  );

  it("exports only the winning Trusted Site pattern", () => {
    const state = fixture();
    state.snapshot = null;
    state.explanation!.winningSource = "trusted-site";
    state.explanation!.steps = [
      {
        source: "trusted-site",
        status: "won",
        pattern: `*.${HOST}`,
        locationId: SECRET,
      },
    ];
    const report = buildDiagnosticReport({ ...input(state), includeSiteData: true });
    expect(report.configuration).toMatchObject({
      source: "trusted-site",
      runtimeConfigured: false,
    });
    expect(report.site?.pattern).toBe(`*.${HOST}`);
    expect(both(report).join()).not.toContain(SECRET);
  });

  it.each(["none", "container", "fallback"] as const)(
    "keeps %s as an enum without configuration IDs",
    (source) => {
      const state = fixture();
      state.explanation!.winningSource = source;
      const report = buildDiagnosticReport(input(state));
      expect(report.configuration.source).toBe(source);
      expect(both(report).join()).not.toContain(HOST);
    },
  );

  it("represents degraded, unsupported, missing and stale observations separately from assessments", () => {
    const state = fixture();
    const [degraded, unsupported, missing, stale] = state.assessments;
    degraded!.presentation = "degraded";
    degraded!.evidence.integrity = "degraded";
    unsupported!.applicability = "not-applicable";
    unsupported!.evidence.policy = "not-applicable";
    unsupported!.presentation = "not-applicable";
    delete missing!.evidence.observedAt;
    stale!.evidence.observedAt = NOW - EVIDENCE_MAX_AGE_MS - 1;
    const report = buildDiagnosticReport({ ...input(state), collectionPending: true });
    expect(report.status).toBe("partial");
    expect(report.reasonCodes).toEqual(
      expect.arrayContaining([
        "missing-evidence",
        "stale-evidence",
        "incomplete-measurement",
      ]),
    );
    expect(report.assessment[0]?.presentation).toBe("degraded");
    expect(
      report.observedEvidence.surfaces
        .map((surface) => surface.availability)
        .slice(0, 4),
    ).toEqual(["available", "unsupported", "missing", "stale"]);
    expect(report.observedEvidence.surfaces[2]?.observedAt).toBeNull();
    expect(report.observedEvidence.collection).toBe("pending");
  });

  it.each([
    null,
    { ok: false as const, error: `Missing permission for https://${HOST}/${SECRET}` },
  ])("builds a partial report without permission, state or worker", (state) => {
    const report = buildDiagnosticReport(input(state));
    expect(report.status).toBe("partial");
    expect(report.reasonCodes).toContain("state-unavailable");
    expect(report.configuration.source).toBe("unknown");
    expect(report.observedEvidence.collection).toBe("unavailable");
    expect(both(report).join()).not.toContain(HOST);
    expect(both(report).join()).not.toContain(SECRET);
  });

  it("does not fabricate observation times for inferred protected state or coarse failure", () => {
    const state = fixture();
    const first = state.assessments[0]!;
    delete first.evidence.observedAt;
    first.evidence.reasons = [
      {
        code: "runtime-surface-failed",
        source: "runtime",
        severity: "warning",
        observedAt: NOW,
      },
    ];
    const report = buildDiagnosticReport(input(state));
    expect(report.assessment[0]?.presentation).toBe("protected");
    expect(report.observedEvidence.surfaces[0]).toMatchObject({
      availability: "missing",
      observedAt: null,
      reasons: [{ observedAt: null }],
    });
  });

  it("marks unconfirmed installation as partial even when its observation is fresh", () => {
    const state = fixture();
    state.assessments[0]!.evidence.installation = "pending";
    state.assessments[0]!.presentation = "pending";
    const report = buildDiagnosticReport(input(state));
    expect(report.observedEvidence.surfaces[0]?.availability).toBe("available");
    expect(report.status).toBe("partial");
    expect(report.reasonCodes).toContain("incomplete-measurement");
  });

  it("treats future timestamps as missing and keeps the freshness threshold inclusive", () => {
    const state = fixture();
    state.assessments[0]!.evidence.observedAt = NOW + 1;
    state.assessments[1]!.evidence.observedAt = NOW - EVIDENCE_MAX_AGE_MS;
    const report = buildDiagnosticReport(input(state));
    expect(report.observedEvidence.surfaces[0]?.availability).toBe("missing");
    expect(report.observedEvidence.surfaces[1]?.availability).toBe("available");
  });

  it("drops unrecognized enum values and counters instead of serializing free text", () => {
    const state = fixture();
    Object.assign(state.explanation!, { winningSource: HOST });
    Object.assign(state.assessments[0]!, { key: HOST });
    state.assessments[1]!.activity.methodCounts["date.now"] = NaN;
    Object.assign(state.assessments[2]!.evidence, { integrity: HOST });
    state.assessments[3]!.evidence.reasons = [
      {
        code: HOST as "unknown",
        source: "transport",
        severity: "warning",
        observedAt: NOW,
      },
    ];
    const report = buildDiagnosticReport(input(state));
    expect(report.reasonCodes).toContain("invalid-data");
    expect(report.configuration.source).toBe("unknown");
    expect(both(report).join()).not.toContain(HOST);
  });

  it("rejects unknown top-level and nested export fields in schema and both serializers", () => {
    const report = buildDiagnosticReport(input());
    const mutations = [
      { ...report, authKey: SECRET },
      { ...report, extension: { ...report.extension, apiKey: SECRET } },
      { ...report, site: { hostname: HOST, pattern: HOST, locationId: SECRET } },
      {
        ...report,
        observedEvidence: {
          ...report.observedEvidence,
          surfaces: [{ ...report.observedEvidence.surfaces[0]!, explanation: HOST }],
        },
      },
    ];
    for (const mutation of mutations) {
      expect(DiagnosticReportSchema.safeParse(mutation).success).toBe(false);
      expect(() => serializeDiagnosticJson(mutation)).toThrow();
      expect(() => serializeDiagnosticText(mutation)).toThrow();
    }
  });

  it("normalizes opted-in hostnames and excludes URLs or arbitrary patterns", () => {
    expect(normalizeDiagnosticHost("PRIVATE.Example.Test.")).toBe(HOST);
    expect(normalizeDiagnosticHost("[2001:DB8:0:0:0:0:0:1]")).toBe("[2001:db8::1]");
    expect(normalizeReportPattern("*.[::1]")).toBeNull();
    expect(normalizeDiagnosticHost("bücher.example")).toBe("xn--bcher-kva.example");
    expect(normalizeReportPattern("*.PRIVATE.Example.Test.")).toBe(`*.${HOST}`);
    for (const value of [
      `https://${HOST}/path`,
      `${HOST}:443`,
      `${HOST}/path`,
      `${HOST}?key=secret`,
      `secret@${HOST}`,
      `${HOST}\n${SECRET}`,
    ]) {
      expect(normalizeDiagnosticHost(value)).toBeNull();
      expect(normalizeReportPattern(value)).toBeNull();
    }
  });

  it("bounds report size and signals truncated evidence", () => {
    const state = fixture();
    for (const surface of state.assessments) {
      surface.activity.methodCounts = Object.fromEntries(
        SurfaceMethodIdSchema.options.map((id) => [id, Number.MAX_SAFE_INTEGER]),
      );
      surface.evidence.reasons = Array.from({ length: 100 }, () => ({
        code: "prototype-chain-changed",
        source: "browser-privacy",
        severity: "critical",
        observedAt: NOW,
      }));
    }
    const report = buildDiagnosticReport(input(state));
    expect(report.reasonCodes).toContain("evidence-truncated");
    for (const output of both(report))
      expect(new TextEncoder().encode(output).length).toBeLessThanOrEqual(
        REPORT_MAX_BYTES,
      );
  });

  it.each([
    ["Mozilla Firefox/143.0", { family: "firefox", majorVersion: 143 }],
    [
      "Mozilla Chrome/141.0.7654.42 Safari/537.36",
      { family: "chromium", majorVersion: 141 },
    ],
    [HOST, { family: "unknown", majorVersion: null }],
  ])("exports only family and major version from %s", (ua, expected) => {
    expect(reportBrowserFromUA(ua)).toEqual(expected);
  });
});
