import type {
  SurfaceAssessment,
  SurfaceEnforcementKind,
  SurfaceInstallationState,
  SurfaceIntegrityState,
  SurfacePolicyState,
} from "@privacy-brand/xray-protocol";
import { describe, expect, it } from "vitest";

import { resolveSurfaceState } from "@/shared/surface-assessments";

const assessment = (
  evidence: {
    policy: SurfacePolicyState;
    installation: SurfaceInstallationState;
    integrity: SurfaceIntegrityState;
    enforcement: SurfaceEnforcementKind;
  },
  overrides: Partial<Pick<SurfaceAssessment, "applicability" | "attention">> = {},
): SurfaceAssessment => ({
  key: "geolocation",
  group: "location-locale",
  applicability: overrides.applicability ?? "applicable",
  evidence: { ...evidence, reasons: [] },
  activity: { accessed: false, failed: false, queryCount: 0, methodCounts: {} },
  ...(overrides.attention ? { attention: overrides.attention } : {}),
  presentation: "unknown",
});

describe("resolveSurfaceState", () => {
  it("returns not-applicable whenever the surface is not applicable, regardless of evidence", () => {
    expect(
      resolveSurfaceState(
        assessment(
          {
            policy: "not-applicable",
            installation: "not-expected",
            integrity: "not-applicable",
            enforcement: "none",
          },
          { applicability: "not-applicable" },
        ),
      ),
    ).toBe("not-applicable");
  });

  it("returns native-by-policy for a deliberately native surface even with other evidence present", () => {
    expect(
      resolveSurfaceState(
        assessment({
          policy: "native",
          installation: "not-expected",
          integrity: "not-applicable",
          enforcement: "javascript",
        }),
      ),
    ).toBe("native-by-policy");
  });

  it("ranks unrecoverable above every recoverable state", () => {
    expect(
      resolveSurfaceState(
        assessment({
          policy: "protect",
          installation: "installed",
          integrity: "unrecoverable",
          enforcement: "javascript",
        }),
      ),
    ).toBe("unrecoverable");
  });

  it("ranks degraded above pending, repaired, and protected", () => {
    expect(
      resolveSurfaceState(
        assessment({
          policy: "protect",
          installation: "installed",
          integrity: "degraded",
          enforcement: "javascript",
        }),
      ),
    ).toBe("degraded");
  });

  it("returns pending while installation is unconfirmed", () => {
    expect(
      resolveSurfaceState(
        assessment({
          policy: "protect",
          installation: "pending",
          integrity: "not-applicable",
          enforcement: "javascript",
        }),
      ),
    ).toBe("pending");
  });

  it("returns pending when integrity has not yet been confirmed", () => {
    expect(
      resolveSurfaceState(
        assessment({
          policy: "protect",
          installation: "installed",
          integrity: "unconfirmed",
          enforcement: "javascript",
        }),
      ),
    ).toBe("pending");
  });

  it("returns repaired after a confirmed self-heal", () => {
    expect(
      resolveSurfaceState(
        assessment({
          policy: "protect",
          installation: "installed",
          integrity: "repaired",
          enforcement: "javascript",
        }),
      ),
    ).toBe("repaired");
  });

  it("returns browser-enforced when only a non-JS layer is confirmed and JS integrity is not tracked", () => {
    expect(
      resolveSurfaceState(
        assessment({
          policy: "protect",
          installation: "installed",
          integrity: "not-applicable",
          enforcement: "hybrid",
        }),
      ),
    ).toBe("browser-enforced");
    expect(
      resolveSurfaceState(
        assessment({
          policy: "protect",
          installation: "installed",
          integrity: "not-applicable",
          enforcement: "network",
        }),
      ),
    ).toBe("browser-enforced");
  });

  it("does not claim browser-enforced for a javascript-only surface with untracked integrity", () => {
    // A javascript-only surface with no integrity evidence is `unknown`, never
    // `browser-enforced` — there is no non-JS layer to enforce it.
    expect(
      resolveSurfaceState(
        assessment({
          policy: "protect",
          installation: "installed",
          integrity: "not-applicable",
          enforcement: "javascript",
        }),
      ),
    ).toBe("unknown");
  });

  it("returns protected only when policy requires it, installation is installed, and integrity is intact", () => {
    expect(
      resolveSurfaceState(
        assessment({
          policy: "protect",
          installation: "installed",
          integrity: "intact",
          enforcement: "javascript",
        }),
      ),
    ).toBe("protected");
    expect(
      resolveSurfaceState(
        assessment({
          policy: "block",
          installation: "installed",
          integrity: "intact",
          enforcement: "javascript",
        }),
      ),
    ).toBe("protected");
  });

  it("keeps an intact hybrid surface protected even when a network layer would allow browser-enforced", () => {
    // Issue #111's hybrid rule: an intact JS layer is the stronger claim; the
    // presence of a confirmed network layer must not weaken it to
    // browser-enforced. Conversely (tested above) a degraded JS layer is never
    // masked by an intact network layer.
    expect(
      resolveSurfaceState(
        assessment({
          policy: "protect",
          installation: "installed",
          integrity: "intact",
          enforcement: "hybrid",
        }),
      ),
    ).toBe("protected");
  });

  it("ignores attention entirely — it is an independent overlay axis", () => {
    const attention = { reasonKey: "worker-csp", actionTarget: "notification-list" };
    expect(
      resolveSurfaceState(
        assessment(
          {
            policy: "protect",
            installation: "installed",
            integrity: "intact",
            enforcement: "javascript",
          },
          { attention },
        ),
      ),
    ).toBe("protected");
    expect(
      resolveSurfaceState(
        assessment(
          {
            policy: "protect",
            installation: "installed",
            integrity: "degraded",
            enforcement: "javascript",
          },
          { attention },
        ),
      ),
    ).toBe("degraded");
  });

  it("falls back to unknown when protect policy has no installation or integrity confirmation", () => {
    expect(
      resolveSurfaceState(
        assessment({
          policy: "protect",
          installation: "failed",
          integrity: "not-applicable",
          enforcement: "javascript",
        }),
      ),
    ).toBe("unknown");
  });
});
