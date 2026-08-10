import {
  XRayStateResponseSchema,
  EVIDENCE_VERSION,
} from "@privacy-brand/xray-protocol";
import { describe, expect, it, vi } from "vitest";

import { createXRayHandlers, type XRayCommandDeps } from "@/background/xray-commands";
import type { XRayAccessedCategories, Location, RuntimeSnapshot } from "@/shared/types";

const snapshot: RuntimeSnapshot = {
  geo: { latitude: 52.23, longitude: 21.01, accuracy: 100, noiseRadius: 500 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL",
  },
  date: { baseEpochMs: 0, offsetMs: 3600000, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500] as [number, number],
};

const location: Location = {
  id: "loc-1",
  label: "Warsaw",
  latitude: 52.23,
  longitude: 21.01,
  accuracy: 100,
  noiseRadius: 500,
  language: "pl-PL",
  languages: ["pl-PL"],
  timeZone: "Europe/Warsaw",
};

const makeDeps = (overrides: Partial<XRayCommandDeps> = {}): XRayCommandDeps => ({
  isSupportedWebUrl: (url): url is string => !!url?.startsWith("http"),
  getExactHostname: (url) => new URL(url).hostname,
  getPopupTabById: vi.fn().mockResolvedValue({ id: 10, url: "https://example.com" }),
  readSnapshotCache: vi.fn().mockReturnValue(snapshot),
  resolveSnapshot: vi.fn().mockResolvedValue(null),
  getLastKnownProfiles: vi.fn().mockReturnValue([location]),
  getLastKnownRules: vi.fn().mockReturnValue([]),
  getKnownContainers: vi.fn().mockReturnValue([]),
  getKnownFallback: vi.fn().mockReturnValue(undefined),
  getLastKnownTrustedSites: vi.fn().mockReturnValue([]),
  getSurfaceAccess: vi
    .fn()
    .mockReturnValue({ geolocation: true } as XRayAccessedCategories),
  getSurfaceErrors: vi.fn().mockReturnValue({}),
  getRealmEvidence: vi.fn().mockReturnValue({}),
  getSurfaceCounts: vi.fn().mockReturnValue({}),
  getSurfaceMethodCounts: vi.fn().mockReturnValue({}),
  getSharedWorkerStatus: vi.fn().mockReturnValue("native-compatibility"),
  getFingerprintEnabled: vi.fn().mockReturnValue(false),
  resolveFallbackId: vi.fn().mockReturnValue(null),
  ...overrides,
});

describe("createXRayHandlers", () => {
  it("returns snapshot and hostname for a supported tab URL", async () => {
    const { getXRayState } = createXRayHandlers(makeDeps());
    const result = await getXRayState(10);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hostname).toBe("example.com");
    expect(result.snapshot).toEqual(snapshot);
  });

  it("returns null fields for an unsupported URL", async () => {
    const { getXRayState } = createXRayHandlers(
      makeDeps({
        getPopupTabById: vi.fn().mockResolvedValue({ id: 11, url: "chrome://newtab" }),
      }),
    );
    const result = await getXRayState(11);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hostname).toBeNull();
    expect(result.snapshot).toBeNull();
  });

  it("returns null fields when tab has no URL", async () => {
    const { getXRayState } = createXRayHandlers(
      makeDeps({
        getPopupTabById: vi.fn().mockResolvedValue({ id: 12 }),
      }),
    );
    const result = await getXRayState(12);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hostname).toBeNull();
  });

  it("forwards accessed categories from getSurfaceAccess", async () => {
    const { getXRayState } = createXRayHandlers(makeDeps());
    const result = await getXRayState(10);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.accessedCategories).toEqual({ geolocation: true });
    expect(
      result.assessments.find((assessment) => assessment.key === "geolocation")
        ?.activity,
    ).toMatchObject({ accessed: true });
  });

  it("includes a non-null explanation for a resolved hostname", async () => {
    const { getXRayState } = createXRayHandlers(makeDeps());
    const result = await getXRayState(10);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.explanation).not.toBeNull();
    expect(result.explanation?.steps.length).toBeGreaterThan(0);
  });

  it("returns the effective locationId when the fallback resolves to a known location", async () => {
    const { getXRayState } = createXRayHandlers(
      makeDeps({
        resolveFallbackId: vi.fn().mockReturnValue("loc-1"),
      }),
    );
    const result = await getXRayState(10);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.locationId).toBe("loc-1");
    expect(result.displayedProfileLabel).toBe("Warsaw");
  });

  it("returns null locationId for an unsupported URL", async () => {
    const { getXRayState } = createXRayHandlers(
      makeDeps({
        getPopupTabById: vi.fn().mockResolvedValue({ id: 11, url: "chrome://newtab" }),
      }),
    );
    const result = await getXRayState(11);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.locationId).toBeNull();
  });

  it("stamps the evidence protocol version on the response", async () => {
    const { getXRayState } = createXRayHandlers(makeDeps({}));
    const result = await getXRayState(10);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evidenceProtocolVersion).toBe(EVIDENCE_VERSION);
  });

  it("forwards per-realm evidence and emits canonical, schema-valid reason codes", async () => {
    const { getXRayState } = createXRayHandlers(
      makeDeps({
        getRealmEvidence: vi.fn().mockReturnValue({
          canvas: [
            {
              realmId: "iframe-1",
              integrity: "unrecoverable",
              reasonCode: "hostile-non-configurable",
              observedAt: 5,
            },
          ],
        }),
      }),
    );
    const result = await getXRayState(10);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The whole response (incl. every reason `code`) revalidates against the
    // protocol schema — a reason code outside the versioned dictionary would
    // throw here.
    expect(() => XRayStateResponseSchema.parse(result)).not.toThrow();
    const canvas = result.assessments.find((assessment) => assessment.key === "canvas");
    expect(canvas?.evidence.reasons[0]).toMatchObject({
      code: "hostile-non-configurable",
      source: "integrity",
      severity: "critical",
      realmId: "iframe-1",
    });
  });

  it("coerces an unknown registry reason string to a canonical dictionary code", async () => {
    const { getXRayState } = createXRayHandlers(
      makeDeps({
        getRealmEvidence: vi.fn().mockReturnValue({
          canvas: [
            {
              realmId: "document",
              integrity: "repaired",
              reasonCode: "some-future-core-reason",
              observedAt: 5,
            },
          ],
        }),
      }),
    );
    const result = await getXRayState(10);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(() => XRayStateResponseSchema.parse(result)).not.toThrow();
    const canvas = result.assessments.find((assessment) => assessment.key === "canvas");
    // An out-of-dictionary string falls back to a status-derived canonical code.
    expect(canvas?.evidence.reasons[0]?.code).toBe("integrity-repaired");
  });

  it("forwards failed categories from getSurfaceErrors", async () => {
    const { getXRayState } = createXRayHandlers(
      makeDeps({
        getSurfaceErrors: vi
          .fn()
          .mockReturnValue({ canvas: true } as XRayAccessedCategories),
      }),
    );
    const result = await getXRayState(10);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.failedCategories).toEqual({ canvas: true });
    expect(
      result.assessments.find((assessment) => assessment.key === "canvas")?.activity,
    ).toMatchObject({ failed: true });
  });

  it("forwards method counts when present", async () => {
    const { getXRayState } = createXRayHandlers(
      makeDeps({
        getSurfaceMethodCounts: vi.fn().mockReturnValue({ "date.now": 3 }),
      }),
    );
    const result = await getXRayState(10);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.methodCounts).toEqual({ "date.now": 3 });
    expect(
      result.assessments.find((assessment) => assessment.key === "timeLocale")?.activity
        .methodCounts,
    ).toEqual({ "date.now": 3 });
  });

  it("returns empty failedCategories for an unsupported URL", async () => {
    const { getXRayState } = createXRayHandlers(
      makeDeps({
        getPopupTabById: vi.fn().mockResolvedValue({ id: 11, url: "chrome://newtab" }),
      }),
    );
    const result = await getXRayState(11);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.failedCategories).toEqual({});
    expect(result.assessments).toHaveLength(13);
  });

  it("returns ok:false on unexpected error", async () => {
    const { getXRayState } = createXRayHandlers(
      makeDeps({
        getPopupTabById: vi.fn().mockRejectedValue(new Error("tab fetch failed")),
      }),
    );
    const result = await getXRayState(10);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/tab fetch failed/);
  });
});
