import { describe, expect, it } from "vitest";

import {
  buildEffectiveSummary,
  getApplicableNotices,
} from "@/background/popup-effective-summary";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { SPOOFING_SURFACES, SPOOFING_SURFACE_KEYS } from "@/shared/spoofing-surfaces";
import type { RuntimeSnapshot } from "@/shared/types";

const runtimeSnapshot: RuntimeSnapshot = {
  geo: {
    latitude: 52.23,
    longitude: 21.01,
    accuracy: 10,
    noiseRadius: 100,
  },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl;q=0.9",
  },
  date: {
    baseEpochMs: 0,
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [100, 200],
  geolocationEnabled: true,
  timeLocaleEnabled: true,
  fingerprint: {},
  sharedWorkerHandlingMode: "strict",
  blockServiceWorkerRegistration: false,
};

const build = (overrides: Partial<Parameters<typeof buildEffectiveSummary>[0]> = {}) =>
  buildEffectiveSummary({
    generation: 1,
    source: "site-rule",
    pattern: "example.com",
    enabled: true,
    editable: true,
    toggleable: true,
    panicMode: false,
    supported: true,
    snapshot: runtimeSnapshot,
    suggestions: [],
    attentionKinds: [
      "worker-csp-relaxation",
      "shared-worker-injection-relaxation",
      "service-worker-block",
      "shared-worker-strict",
    ],
    ...overrides,
  });

describe("buildEffectiveSummary", () => {
  it("lets an active Shared Worker compatibility suggestion supersede the generic strict warning", () => {
    const notices = getApplicableNotices({
      snapshot: {
        ...runtimeSnapshot,
        blockServiceWorkerRegistration: true,
        sharedWorkerHandlingMode: "strict",
      },
      active: true,
      suggestions: [
        {
          kind: "shared-worker-injection-relaxation",
          status: "pending",
          rediscovered: false,
          detectionCount: 1,
          lastDetectedAt: "2026-07-12T20:00:00.000Z",
        },
      ],
    });

    expect(notices.map((notice) => notice.kind)).toEqual(["service-worker-block"]);
  });

  it("maps every catalog surface exactly once into the 2 + 4 + 4 + 3 groups", () => {
    const summary = build();

    expect(SPOOFING_SURFACES.map((surface) => surface.key).sort()).toEqual(
      [...SPOOFING_SURFACE_KEYS].sort(),
    );
    expect(summary.surfaceSummary.catalogSize).toBe(13);
    expect(summary.surfaceSummary.complete).toBe(true);
    expect(
      summary.surfaceSummary.surfaces.map((surface) => surface.key).sort(),
    ).toEqual([...SPOOFING_SURFACE_KEYS].sort());
    expect(summary.surfaceSummary.groups.map((group) => group.surfaces.length)).toEqual(
      [2, 4, 4, 3],
    );
  });

  it("distinguishes protected, native-by-policy and target-inapplicable surfaces", () => {
    const summary = build();

    expect(
      summary.surfaceSummary.surfaces.find((surface) => surface.key === "geolocation")
        ?.presentation,
    ).toBe("protected");
    expect(
      summary.surfaceSummary.surfaces.find((surface) => surface.key === "serviceWorker")
        ?.presentation,
    ).toBe("native-by-policy");
    expect(
      summary.surfaceSummary.surfaces.find((surface) => surface.key === "clientHints"),
    ).toMatchObject(
      BUILD_BROWSER_TARGET === "firefox"
        ? { applicability: "not-applicable", presentation: "not-applicable" }
        : { applicability: "applicable", presentation: "protected" },
    );
  });

  it("promotes active compatibility policies into their surface rows", () => {
    const summary = build({
      snapshot: {
        ...runtimeSnapshot,
        blockServiceWorkerRegistration: true,
        sharedWorkerHandlingMode: "strict",
      },
      accessedCategories: {
        serviceWorker: true,
        sharedWorker: true,
      },
    });

    expect(
      summary.surfaceSummary.surfaces.find(
        (surface) => surface.key === "serviceWorker",
      ),
    ).toMatchObject({
      presentation: "protected",
      attention: { notificationKind: "service-worker-block" },
    });
    expect(
      summary.surfaceSummary.surfaces.find((surface) => surface.key === "sharedWorker"),
    ).toMatchObject({
      presentation: "protected",
      attention: { notificationKind: "shared-worker-strict" },
    });
  });

  it("does not promote detected warnings without an unread attention notification", () => {
    const summary = build({
      snapshot: {
        ...runtimeSnapshot,
        blockServiceWorkerRegistration: true,
      },
      accessedCategories: { serviceWorker: true },
      suggestions: [
        {
          kind: "worker-csp-relaxation",
          status: "pending",
          rediscovered: false,
          detectionCount: 2,
          lastDetectedAt: "2026-07-13T02:00:00.000Z",
        },
      ],
      attentionKinds: [],
    });

    expect(summary.surfaceSummary.attentionCount).toBe(0);
    expect(summary.surfaceSummary.highestPriorityAttention).toBeNull();
    expect(
      summary.surfaceSummary.groups.find((group) => group.key === "workers")
        ?.attentionCount,
    ).toBe(0);
  });

  it("keeps dismissed active policy context visible without promoting the status", () => {
    const summary = build({
      snapshot: {
        ...runtimeSnapshot,
        blockServiceWorkerRegistration: true,
      },
      accessedCategories: { serviceWorker: true },
      attentionKinds: [],
      contextNotificationKinds: ["service-worker-block"],
    });

    expect(
      summary.surfaceSummary.surfaces.find(
        (surface) => surface.key === "serviceWorker",
      ),
    ).toMatchObject({
      presentation: "protected",
      attention: { notificationKind: "service-worker-block" },
    });
    expect(summary.surfaceSummary.highestPriorityAttention).toBeNull();
    expect(summary.surfaceSummary.highestPriorityContext).toMatchObject({
      kind: "service-worker-block",
      surfaceKey: "serviceWorker",
    });
  });

  it("never promotes a dismissed suggestion after rediscovery", () => {
    const summary = build({
      suggestions: [
        {
          kind: "worker-csp-relaxation",
          status: "dismissed",
          rediscovered: true,
          detectionCount: 3,
          lastDetectedAt: "2026-07-13T02:00:00.000Z",
        },
      ],
      attentionKinds: ["worker-csp-relaxation"],
    });

    expect(summary.surfaceSummary.highestPriorityAttention).toBeNull();
  });

  it("hides worker policy disclosures when the effective source is disabled", () => {
    const summary = build({
      enabled: false,
      runtimeExpected: false,
      snapshot: {
        ...runtimeSnapshot,
        blockServiceWorkerRegistration: true,
        sharedWorkerHandlingMode: "strict",
      },
      accessedCategories: {
        serviceWorker: true,
        sharedWorker: true,
      },
    });

    expect(
      summary.surfaceSummary.surfaces.find(
        (surface) => surface.key === "serviceWorker",
      ),
    ).not.toMatchObject({ attention: { notificationKind: "service-worker-block" } });
    expect(
      summary.surfaceSummary.surfaces.find((surface) => surface.key === "sharedWorker"),
    ).not.toMatchObject({ attention: { notificationKind: "shared-worker-strict" } });
  });

  it("keeps unused worker policies protected without warning about page breakage", () => {
    const summary = build({
      snapshot: {
        ...runtimeSnapshot,
        blockServiceWorkerRegistration: true,
        sharedWorkerHandlingMode: "strict",
      },
      accessedCategories: {},
    });

    expect(
      summary.surfaceSummary.surfaces.find(
        (surface) => surface.key === "serviceWorker",
      ),
    ).toMatchObject({ presentation: "protected" });
    expect(
      summary.surfaceSummary.surfaces.find((surface) => surface.key === "sharedWorker"),
    ).toMatchObject({ presentation: "protected" });
    expect(summary.surfaceSummary.attentionCount).toBe(0);
    expect(summary.surfaceSummary.highestPriorityAttention).toBeNull();
  });

  it("never reports missing authoritative runtime state as protected", () => {
    const summary = build({ snapshot: null });

    // Missing snapshot is `pending` (installation not yet confirmed), never a
    // false `protected` (#111).
    expect(summary.surfaceSummary.counts.protected).toBe(0);
    expect(summary.surfaceSummary.counts.pending).toBe(
      BUILD_BROWSER_TARGET === "firefox" ? 10 : 12,
    );
    expect(
      summary.surfaceSummary.surfaces.every(
        (surface) => surface.presentation !== "protected",
      ),
    ).toBe(true);
  });

  it("treats an enabled but unconfigured source as native instead of unknown", () => {
    const summary = build({
      source: "default-rule",
      snapshot: null,
      runtimeExpected: false,
    });

    expect(summary.resolutionContext.state).toBe("unconfigured");
    expect(summary.surfaceSummary.counts.unknown).toBe(0);
    expect(summary.surfaceSummary.counts["native-by-policy"]).toBe(
      BUILD_BROWSER_TARGET === "firefox" ? 11 : 13,
    );
  });

  it("does not present a cached snapshot as active after its rule is disabled", () => {
    const summary = build({ enabled: false, runtimeExpected: false });

    expect(summary.resolutionContext.state).toBe("disabled");
    expect(summary.surfaceSummary.counts.protected).toBe(0);
  });

  it("does not promote historical worker warnings while the domain rule is off", () => {
    const summary = build({
      enabled: false,
      runtimeExpected: false,
      suggestions: [
        {
          kind: "worker-csp-relaxation",
          status: "pending",
          rediscovered: false,
          detectionCount: 1,
          lastDetectedAt: "2026-07-13T02:00:00.000Z",
        },
      ],
    });

    expect(summary.resolutionContext.state).toBe("disabled");
    expect(summary.surfaceSummary.highestPriorityAttention).toBeNull();
    expect(
      summary.surfaceSummary.groups.find((group) => group.key === "workers")
        ?.attentionCount,
    ).toBe(0);
  });

  it("promotes a worker runtime warning to the surface, group and exception", () => {
    const summary = build({
      accessedCategories: { sharedWorker: true },
      suggestions: [
        {
          kind: "shared-worker-injection-relaxation",
          status: "pending",
          rediscovered: false,
          detectionCount: 1,
          lastDetectedAt: "2026-07-12T20:00:00.000Z",
        },
      ],
    });

    expect(
      summary.surfaceSummary.surfaces.find((surface) => surface.key === "sharedWorker"),
    ).toMatchObject({
      presentation: "protected",
      attention: {
        actionTarget: "notification-list",
        notificationKind: "shared-worker-injection-relaxation",
      },
    });
    expect(
      summary.surfaceSummary.groups.find((group) => group.key === "workers")
        ?.attentionCount,
    ).toBe(1);
    expect(summary.surfaceSummary.highestPriorityException).toBeNull();
  });

  it("assigns a generic Worker CSP warning to Dedicated Workers and only aggregates the group", () => {
    const summary = build({
      snapshot: {
        ...runtimeSnapshot,
        sharedWorkerHandlingMode: "spoof",
      },
      suggestions: [
        {
          kind: "worker-csp-relaxation",
          status: "pending",
          rediscovered: false,
          detectionCount: 1,
          lastDetectedAt: "2026-07-12T20:00:00.000Z",
        },
      ],
    });

    expect(
      summary.surfaceSummary.surfaces.find((surface) => surface.key === "sharedWorker")
        ?.presentation,
    ).toBe("protected");
    expect(
      summary.surfaceSummary.surfaces.find((surface) => surface.key === "worker"),
    ).toMatchObject({
      presentation: "protected",
      attention: { notificationKind: "worker-csp-relaxation" },
    });
    const workerGroup = summary.surfaceSummary.groups.find(
      (group) => group.key === "workers",
    );
    expect(workerGroup?.attentionCount).toBe(1);
    expect(summary.surfaceSummary.highestPriorityAttention).toEqual({
      kind: "worker-csp-relaxation",
      group: "workers",
      surfaceKey: "worker",
      reasonKey: "worker-runtime-warning",
      actionTarget: "notification-list",
    });
  });

  it("treats Trusted Site as an intentional native policy instead of missing runtime", () => {
    const summary = build({
      source: "trusted-site",
      enabled: null,
      snapshot: null,
    });

    expect(summary.resolutionContext.state).toBe("trusted");
    expect(summary.surfaceSummary.counts.unknown).toBe(0);
    expect(summary.surfaceSummary.counts["native-by-policy"]).toBe(
      BUILD_BROWSER_TARGET === "firefox" ? 11 : 13,
    );
  });
});
