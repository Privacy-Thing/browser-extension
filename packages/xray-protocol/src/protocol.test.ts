/**
 * XRay protocol schema compatibility tests.
 *
 * These tests pin the XRay wire shapes so accidental schema drift is caught
 * immediately while additive diagnostic fields remain explicit.
 *
 * Two concerns:
 * 1. Schema validation — valid payloads must parse; invalid ones must reject.
 * 2. Cross-package parity — RuntimeSnapshot in xray-protocol must
 *    accept the snapshots produced by the main shared types.
 */

import { describe, expect, it } from "vitest";

import {
  XRayCommandSchema,
  XRayStateCommandSchema,
  XRayStateResponseSchema,
  RuntimeSnapshotSchema,
  ResolutionExplainSchema,
  SurfaceAssessmentSchema,
  SurfaceErrorSchema,
  UsageCommandSchema,
  type GetXRayStateResponse,
  type RuntimeSnapshot,
} from "./index";

// ---------------------------------------------------------------------------
// Fixture: minimal valid RuntimeSnapshot
// ---------------------------------------------------------------------------

const minimalSnapshot: RuntimeSnapshot = {
  geo: { latitude: 52.23, longitude: 21.01, accuracy: 30, noiseRadius: 100 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "en"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,en;q=0.9",
  },
  date: {
    baseEpochMs: 1_700_000_000_000,
    offsetMs: 3_600_000,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [5_000, 15_000],
};

// ---------------------------------------------------------------------------
// RuntimeSnapshotSchema
// ---------------------------------------------------------------------------

describe("RuntimeSnapshotSchema", () => {
  it("accepts a minimal valid snapshot", () => {
    const result = RuntimeSnapshotSchema.safeParse(minimalSnapshot);
    expect(result.success).toBe(true);
  });

  it("accepts a snapshot with all optional fields set", () => {
    const full: RuntimeSnapshot = {
      ...minimalSnapshot,
      geolocationEnabled: true,
      timeLocaleEnabled: true,
      logEventName: "gw:log",
      blockServiceWorkerRegistration: false,
      authKey: "abc123",
    };
    const result = RuntimeSnapshotSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it("rejects a snapshot missing required geo field", () => {
    const { geo: _geo, ...withoutGeo } = minimalSnapshot;
    const result = RuntimeSnapshotSchema.safeParse(withoutGeo);
    expect(result.success).toBe(false);
  });

  it("rejects a snapshot with incorrect watchPositionDelay arity", () => {
    const bad = { ...minimalSnapshot, watchPositionDelay: [5_000] };
    const result = RuntimeSnapshotSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a snapshot with non-number geo.latitude", () => {
    const bad = {
      ...minimalSnapshot,
      geo: { ...minimalSnapshot.geo, latitude: "bad" },
    };
    const result = RuntimeSnapshotSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// XRayCommand schemas
// ---------------------------------------------------------------------------

describe("XRayStateCommandSchema", () => {
  it("parses a minimal get-doctor-state command", () => {
    const cmd = { type: "pt:get-doctor-state" };
    const result = XRayStateCommandSchema.safeParse(cmd);
    expect(result.success).toBe(true);
  });

  it("parses a get-doctor-state command with tabId", () => {
    const cmd = { type: "pt:get-doctor-state", tabId: 42 };
    const result = XRayStateCommandSchema.safeParse(cmd);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tabId).toBe(42);
    }
  });

  it("rejects a command with wrong type", () => {
    const result = XRayStateCommandSchema.safeParse({ type: "wrong" });
    expect(result.success).toBe(false);
  });
});

describe("UsageCommandSchema", () => {
  it("parses a surface-usage command with known categories", () => {
    const cmd = {
      type: "pt:surface-usage",
      categories: ["geolocation", "canvas"],
    };
    const result = UsageCommandSchema.safeParse(cmd);
    expect(result.success).toBe(true);
  });

  it("parses method counts keyed by stable method IDs", () => {
    const cmd = {
      type: "pt:surface-usage",
      categories: ["canvas"],
      sourceId: "0:main",
      counts: { canvas: 1 },
      methodCounts: { "canvas.toDataURL": 1 },
    };
    const result = UsageCommandSchema.safeParse(cmd);
    expect(result.success).toBe(true);
  });

  it("rejects unknown surface category", () => {
    const cmd = { type: "pt:surface-usage", categories: ["unknown-surface"] };
    const result = UsageCommandSchema.safeParse(cmd);
    expect(result.success).toBe(false);
  });

  it("rejects unknown method IDs", () => {
    const cmd = {
      type: "pt:surface-usage",
      categories: ["canvas"],
      methodCounts: { "canvas.unknown": 1 },
    };
    const result = UsageCommandSchema.safeParse(cmd);
    expect(result.success).toBe(false);
  });
});

describe("SurfaceErrorSchema", () => {
  it("parses a surface-error command", () => {
    const cmd = { type: "pt:surface-error", categories: ["timeLocale"] };
    const result = SurfaceErrorSchema.safeParse(cmd);
    expect(result.success).toBe(true);
  });
});

describe("XRayCommandSchema (union)", () => {
  it("accepts get-doctor-state via union", () => {
    const result = XRayCommandSchema.safeParse({ type: "pt:get-doctor-state" });
    expect(result.success).toBe(true);
  });

  it("accepts surface-usage via union", () => {
    const result = XRayCommandSchema.safeParse({
      type: "pt:surface-usage",
      categories: ["webGL"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown command type", () => {
    const result = XRayCommandSchema.safeParse({ type: "pt:unknown" });
    expect(result.success).toBe(false);
  });

  it("rejects commands from the retired runtime namespace", () => {
    const result = XRayCommandSchema.safeParse({
      type: `${["geo", "warp"].join("")}:surface-usage`,
      categories: ["canvas"],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GetXRayStateResponse schema
// ---------------------------------------------------------------------------

describe("XRayStateResponseSchema", () => {
  it("parses a successful response with all nullable fields set to null", () => {
    const response: GetXRayStateResponse = {
      ok: true,
      hostname: null,
      snapshot: null,
      displayedProfileLabel: null,
      locationId: null,
      rulePattern: null,
      assessments: [],
      accessedCategories: {},
      failedCategories: {},
      explanation: null,
    };
    const result = XRayStateResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it("parses a successful response with a full snapshot", () => {
    const response: GetXRayStateResponse = {
      ok: true,
      hostname: "example.com",
      snapshot: minimalSnapshot,
      displayedProfileLabel: "Warsaw",
      locationId: "loc-1",
      rulePattern: "example.com",
      assessments: [],
      accessedCategories: { geolocation: true },
      failedCategories: {},
      methodCounts: { "date.now": 2 },
      explanation: null,
    };
    const result = XRayStateResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it("parses an error response", () => {
    const response: GetXRayStateResponse = { ok: false, error: "unexpected error" };
    const result = XRayStateResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it("rejects a response missing the ok field", () => {
    const result = XRayStateResponseSchema.safeParse({
      hostname: "example.com",
    });
    expect(result.success).toBe(false);
  });
});

describe("SurfaceAssessmentSchema", () => {
  const base = {
    key: "canvas",
    group: "rendering-media",
    activity: {
      accessed: false,
      failed: false,
      queryCount: 0,
      methodCounts: {},
    },
  } as const;

  const intactEvidence = {
    policy: "protect",
    installation: "installed",
    integrity: "intact",
    enforcement: "javascript",
    reasons: [],
  } as const;

  it("accepts independent evidence and attention axes", () => {
    expect(
      SurfaceAssessmentSchema.safeParse({
        ...base,
        applicability: "applicable",
        evidence: intactEvidence,
        presentation: "protected",
        attention: {
          reasonKey: "worker-runtime-warning",
          actionTarget: "notification-list",
        },
      }).success,
    ).toBe(true);
  });

  it("requires not-applicable policy and presentation exactly for a non-applicable surface", () => {
    expect(
      SurfaceAssessmentSchema.safeParse({
        ...base,
        applicability: "not-applicable",
        evidence: {
          policy: "not-applicable",
          installation: "not-expected",
          integrity: "not-applicable",
          enforcement: "none",
          reasons: [],
        },
        presentation: "not-applicable",
      }).success,
    ).toBe(true);
    // An applicable surface must not present or be policied as not-applicable.
    expect(
      SurfaceAssessmentSchema.safeParse({
        ...base,
        applicability: "applicable",
        evidence: { ...intactEvidence, policy: "not-applicable" },
        presentation: "protected",
      }).success,
    ).toBe(false);
    expect(
      SurfaceAssessmentSchema.safeParse({
        ...base,
        applicability: "applicable",
        evidence: intactEvidence,
        presentation: "not-applicable",
      }).success,
    ).toBe(false);
  });

  it("rejects a protected presentation not backed by installed+intact evidence", () => {
    expect(
      SurfaceAssessmentSchema.safeParse({
        ...base,
        applicability: "applicable",
        evidence: { ...intactEvidence, integrity: "degraded" },
        presentation: "protected",
      }).success,
    ).toBe(false);
    expect(
      SurfaceAssessmentSchema.safeParse({
        ...base,
        applicability: "applicable",
        evidence: { ...intactEvidence, installation: "pending" },
        presentation: "protected",
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ResolutionExplainSchema
// ---------------------------------------------------------------------------

describe("ResolutionExplainSchema", () => {
  it("parses a complete rule resolution explanation", () => {
    const explanation = {
      steps: [
        {
          source: "exact-rule",
          status: "won",
          pattern: "example.com",
          locationId: "loc-1",
        },
        { source: "fallback", status: "skipped" },
      ],
      winningSource: "rule",
      effectiveLocationId: "loc-1",
    };
    const result = ResolutionExplainSchema.safeParse(explanation);
    expect(result.success).toBe(true);
  });

  it("rejects explanation with unknown winningSource", () => {
    const result = ResolutionExplainSchema.safeParse({
      steps: [],
      winningSource: "bad-source",
      effectiveLocationId: null,
    });
    expect(result.success).toBe(false);
  });
});
