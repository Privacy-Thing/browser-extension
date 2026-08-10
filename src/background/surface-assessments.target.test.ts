import { describe, expect, it } from "vitest";

import {
  aggregateAssessments,
  buildSurfaceAssessments,
} from "@/background/surface-assessments";
import { SPOOFING_SURFACES } from "@/shared/spoofing-surfaces";
import { deriveLegacyXRayActivity } from "@/shared/surface-assessments";
import type { PopupSurfaceCounts, RuntimeSnapshot } from "@/shared/types";

const snapshot: RuntimeSnapshot = {
  geo: { latitude: 52.23, longitude: 21.01, accuracy: 10, noiseRadius: 100 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl;q=0.9",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [100, 200],
  geolocationEnabled: true,
  timeLocaleEnabled: true,
  fingerprint: {},
  sharedWorkerHandlingMode: "strict",
  blockServiceWorkerRegistration: true,
};

const emptyCounts = (): PopupSurfaceCounts => ({
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

describe("surface assessments", () => {
  it.each(["chromium", "firefox"] as const)(
    "represents missing runtime state on %s as pending, never a false protected",
    (browserTarget) => {
      const assessments = buildSurfaceAssessments({
        source: "site-rule",
        snapshot: null,
        runtimeExpected: true,
        browserTarget,
      });
      const aggregate = aggregateAssessments(assessments);

      // No snapshot yet is a timing gap — surfaces are `pending`, not a
      // premature `protected` (#111). serviceWorker is `native-by-policy`
      // because service-worker blocking defaults off.
      expect(aggregate.counts.pending).toBe(browserTarget === "firefox" ? 10 : 12);
      expect(aggregate.counts["native-by-policy"]).toBe(1);
      expect(aggregate.counts["not-applicable"]).toBe(
        browserTarget === "firefox" ? 2 : 0,
      );
      expect(aggregate.counts.protected).toBe(0);
      expect(
        assessments.every((assessment) =>
          assessment.applicability === "not-applicable"
            ? assessment.evidence.policy === "not-applicable"
            : assessment.evidence.installation === "pending" ||
              assessment.evidence.policy === "native",
        ),
      ).toBe(true);
    },
  );

  it("downgrades a confirmed runtime failure to degraded integrity, never protected", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "chromium",
      failedCategories: { worker: true },
    });

    const worker = assessments.find((assessment) => assessment.key === "worker");
    expect(worker?.presentation).toBe("degraded");
    expect(worker?.evidence.integrity).toBe("degraded");
    expect(worker?.activity.failed).toBe(true);
    // The contradiction #111 calls out — a `protected` presentation alongside
    // `activity.failed` — must never occur for any surface.
    expect(
      assessments.some(
        (assessment) =>
          assessment.presentation === "protected" && assessment.activity.failed,
      ),
    ).toBe(false);
    // Unrelated surfaces are unaffected.
    const geolocation = assessments.find(
      (assessment) => assessment.key === "geolocation",
    );
    expect(geolocation?.presentation).toBe("protected");
    expect(geolocation?.evidence.integrity).toBe("intact");
  });

  it("does not treat a failure on an already native-by-policy surface as a regression", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot: { ...snapshot, geolocationEnabled: false },
      runtimeExpected: true,
      browserTarget: "chromium",
      failedCategories: { geolocation: true },
    });

    const geolocation = assessments.find(
      (assessment) => assessment.key === "geolocation",
    );
    expect(geolocation?.presentation).toBe("native-by-policy");
    expect(geolocation?.evidence.policy).toBe("native");
    expect(geolocation?.activity.failed).toBe(true);
  });

  it("downgrades only the webRTC surface when the browser-wide policy readback did not match", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "chromium",
      webRtcPolicyConfirmed: false,
    });

    const webRTC = assessments.find((assessment) => assessment.key === "webRTC");
    expect(webRTC?.presentation).toBe("degraded");
    expect(webRTC?.evidence.enforcement).toBe("hybrid");
    // A global (non-per-tab) mismatch is not a page activity failure — it
    // must not be folded into `activity.failed`.
    expect(webRTC?.activity.failed).toBe(false);
    expect(
      assessments.find((assessment) => assessment.key === "geolocation")?.presentation,
    ).toBe("protected");
  });

  it("does not downgrade webRTC when the policy readback is merely unconfirmed", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "chromium",
      webRtcPolicyConfirmed: null,
    });

    // Not yet confirmed falls back to the intact JS layer (`protected`) rather
    // than flashing pending on every load.
    expect(
      assessments.find((assessment) => assessment.key === "webRTC")?.presentation,
    ).toBe("protected");
  });

  it("presents webRTC as browser-enforced once its browser IP-handling policy is confirmed", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "chromium",
      webRtcPolicyConfirmed: true,
    });

    const webRTC = assessments.find((assessment) => assessment.key === "webRTC");
    // webRTC's protection of record is the browser policy, not its JS patch —
    // a confirmed readback presents as browser-enforced, distinct from a
    // JavaScript-integrity `protected`.
    expect(webRTC?.presentation).toBe("browser-enforced");
    expect(webRTC?.evidence.enforcement).toBe("hybrid");
    expect(webRTC?.evidence.integrity).toBe("not-applicable");
  });

  it("lets descriptor tampering override a browser-enforced webRTC", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "chromium",
      webRtcPolicyConfirmed: true,
      evidenceByRealm: {
        webRTC: [{ realmId: "document", integrity: "unrecoverable", observedAt: 1 }],
      },
    });

    // A confirmed browser layer does not mask a hostile JS-descriptor
    // replacement — the worst-of fold still wins.
    expect(
      assessments.find((assessment) => assessment.key === "webRTC")?.presentation,
    ).toBe("unrecoverable");
  });

  it.each([
    ["trusted-site", false],
    ["site-rule", false],
  ] as const)(
    "uses native-by-policy for %s with runtime disabled",
    (source, runtimeExpected) => {
      const assessments = buildSurfaceAssessments({
        source,
        snapshot,
        runtimeExpected,
        browserTarget: "chromium",
      });

      const aggregate = aggregateAssessments(assessments);
      expect(aggregate.counts).toEqual({ ...emptyCounts(), "native-by-policy": 13 });
      expect(
        aggregate.groups.every((group) => group.state === "native-by-policy"),
      ).toBe(true);
      expect(
        assessments.every((assessment) => assessment.evidence.policy === "native"),
      ).toBe(true);
    },
  );

  it("applies every fingerprint toggle and worker handling mode independently", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot: {
        ...snapshot,
        geolocationEnabled: false,
        timeLocaleEnabled: false,
        blockServiceWorkerRegistration: false,
        sharedWorkerHandlingMode: "native",
        fingerprint: {
          spoofingToggles: {
            canvas: false,
            webGL: false,
            audio: false,
            navigator: false,
            screen: false,
            clientHints: false,
            battery: false,
            webRTC: false,
          },
        },
      },
      runtimeExpected: true,
      browserTarget: "chromium",
    });

    expect(
      assessments.find((assessment) => assessment.key === "worker")?.presentation,
    ).toBe("native-by-policy");
    expect(
      assessments.every((assessment) => assessment.presentation === "native-by-policy"),
    ).toBe(true);
    expect(
      aggregateAssessments(assessments).groups.find((group) => group.key === "workers")
        ?.state,
    ).toBe("native-by-policy");
  });

  it.each([
    ["native", "native-by-policy"],
    ["spoof", "protected"],
    ["strict", "protected"],
  ] as const)("maps Shared Worker %s mode to %s", (mode, presentation) => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot: { ...snapshot, sharedWorkerHandlingMode: mode },
      runtimeExpected: true,
      browserTarget: "chromium",
    });

    expect(
      assessments.find((assessment) => assessment.key === "sharedWorker")?.presentation,
    ).toBe(presentation);
  });

  it("classifies hybrid surfaces (Accept-Language, User-Agent, Client Hints, WebRTC) distinctly", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "chromium",
    });
    const enforcementByKey = new Map(
      assessments.map((assessment) => [
        assessment.key,
        assessment.evidence.enforcement,
      ]),
    );
    expect(enforcementByKey.get("timeLocale")).toBe("hybrid");
    expect(enforcementByKey.get("navigator")).toBe("hybrid");
    expect(enforcementByKey.get("clientHints")).toBe("hybrid");
    expect(enforcementByKey.get("webRTC")).toBe("hybrid");
    expect(enforcementByKey.get("geolocation")).toBe("javascript");
    expect(enforcementByKey.get("canvas")).toBe("javascript");
  });

  it("produces the Firefox protected browser-identity group and global distribution", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "firefox",
    });
    const aggregate = aggregateAssessments(assessments);
    const browserIdentity = aggregate.groups.find(
      (group) => group.key === "browser-identity",
    );

    expect(browserIdentity?.counts).toEqual({
      ...emptyCounts(),
      protected: 2,
      "not-applicable": 2,
    });
    expect(browserIdentity?.state).toBe("protected");
    expect(aggregate.counts).toEqual({
      ...emptyCounts(),
      protected: 11,
      "not-applicable": 2,
    });
  });

  it("keeps compatibility attention independent of presentation and group state", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "chromium",
      attentionBySurface: {
        serviceWorker: {
          reasonKey: "service-worker-block",
          actionTarget: "notification-list",
        },
        sharedWorker: {
          reasonKey: "shared-worker-strict",
          actionTarget: "notification-list",
        },
      },
    });
    const aggregate = aggregateAssessments(assessments);
    const workers = aggregate.groups.find((group) => group.key === "workers");

    // Attention is a separate axis (#111) — a pending suggestion no longer
    // masks the real protection state, so surfaces with attention stay
    // `protected` and the group is not forced to `mixed` by attention alone.
    expect(
      assessments
        .filter((assessment) => assessment.attention)
        .every((assessment) => assessment.presentation === "protected"),
    ).toBe(true);
    expect(workers?.attentionCount).toBe(2);
    expect(workers?.state).toBe("protected");
    expect(aggregate.attentionCount).toBe(2);
    expect(aggregate.counts.protected).toBe(13);
  });

  it("folds the worst per-realm integrity across realms into the surface (#111)", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "chromium",
      evidenceByRealm: {
        canvas: [
          { realmId: "document", integrity: "intact", observedAt: 1 },
          { realmId: "iframe-1", integrity: "repaired", observedAt: 2 },
          { realmId: "iframe-2", integrity: "unrecoverable", observedAt: 3 },
        ],
      },
    });

    const canvas = assessments.find((assessment) => assessment.key === "canvas");
    // A single unrecoverable realm must prevent a protected tab result.
    expect(canvas?.evidence.integrity).toBe("unrecoverable");
    expect(canvas?.presentation).toBe("unrecoverable");
    expect(canvas?.activity.failed).toBe(true);
  });

  it("surfaces a repaired realm as repaired, and an unconfirmed realm as pending", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "chromium",
      evidenceByRealm: {
        canvas: [{ realmId: "document", integrity: "repaired", observedAt: 1 }],
        webGL: [{ realmId: "document", integrity: "unconfirmed", observedAt: 1 }],
      },
    });

    expect(
      assessments.find((assessment) => assessment.key === "canvas")?.presentation,
    ).toBe("repaired");
    expect(
      assessments.find((assessment) => assessment.key === "webGL")?.presentation,
    ).toBe("pending");
  });

  it("marks a surface pending while a realm reports installation still in flight", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "chromium",
      evidenceByRealm: {
        worker: [{ realmId: "worker-1", installation: "pending", observedAt: 1 }],
      },
    });

    expect(
      assessments.find((assessment) => assessment.key === "worker")?.evidence
        .installation,
    ).toBe("pending");
    expect(
      assessments.find((assessment) => assessment.key === "worker")?.presentation,
    ).toBe("pending");
  });

  it("populates structured per-realm reasons with stable codes, sources and severity (#111)", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "chromium",
      webRtcPolicyConfirmed: false,
      evidenceByRealm: {
        canvas: [
          {
            realmId: "iframe-1",
            integrity: "unrecoverable",
            reasonCode: "hostile-non-configurable",
            observedAt: 7,
          },
        ],
      },
    });

    const canvasReasons =
      assessments.find((assessment) => assessment.key === "canvas")?.evidence.reasons ??
      [];
    expect(canvasReasons).toEqual([
      {
        code: "hostile-non-configurable",
        source: "integrity",
        severity: "critical",
        realmId: "iframe-1",
        observedAt: 7,
      },
    ]);

    // The browser-wide webRTC mismatch is reported against the browser-privacy source.
    const webRtcReasons =
      assessments.find((assessment) => assessment.key === "webRTC")?.evidence.reasons ??
      [];
    expect(webRtcReasons).toEqual([
      expect.objectContaining({
        code: "webrtc-policy-mismatch",
        source: "browser-privacy",
        severity: "warning",
        realmId: "browser-privacy:webrtc",
      }),
    ]);

    // An intact surface carries no reasons.
    expect(
      assessments.find((assessment) => assessment.key === "geolocation")?.evidence
        .reasons,
    ).toEqual([]);
  });

  it("keeps surface, group and global totals identical and derives legacy activity", () => {
    const assessments = buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      browserTarget: "firefox",
      accessedCategories: { canvas: true },
      failedCategories: { webGL: true },
      queryCounts: { canvas: 3 },
      methodCounts: { "canvas.toDataURL": 2 },
    });
    const aggregate = aggregateAssessments(assessments);
    const sum = (counts: typeof aggregate.counts) =>
      Object.values(counts).reduce((total, count) => total + count, 0);

    expect(assessments).toHaveLength(SPOOFING_SURFACES.length);
    expect(
      aggregate.groups.reduce((total, group) => total + sum(group.counts), 0),
    ).toBe(assessments.length);
    expect(sum(aggregate.counts)).toBe(assessments.length);
    expect(deriveLegacyXRayActivity(assessments)).toEqual({
      accessedCategories: { canvas: true },
      failedCategories: { webGL: true },
      queryCounts: { canvas: 3 },
      methodCounts: { "canvas.toDataURL": 2 },
    });
  });
});
