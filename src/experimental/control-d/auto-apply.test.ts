import { describe, expect, it } from "vitest";

import {
  controlDAutoApply,
  controlDMappingConsent,
  controlDNeedsReview,
} from "./auto-apply";
import type {
  ControlDDiff,
  ControlDMapping,
  ControlDServiceConflict,
} from "./contracts";

const exact: ControlDMapping = {
  locationId: "warsaw",
  proxyPk: "WAW",
  status: "exact",
  confirmed: true,
};
const diff: ControlDDiff = {
  createProfile: true,
  createEndpoint: true,
  createFolders: 2,
  addRules: 3,
  updateRules: 0,
  deleteRules: 0,
  unchangedRules: 0,
  warnings: [],
  mappings: [exact],
  requiresApproximationConfirmation: false,
};
const decide = (changes: Partial<ControlDDiff> = {}) => {
  const plan = { ...diff, ...changes };
  return controlDAutoApply(plan, plan.mappings, "new");
};

describe("Control D automatic apply decision", () => {
  it.each(["new", "owned"] as const)("automates exact %s plans", (adoption) => {
    expect(controlDAutoApply(diff, [exact], adoption)).toEqual({ kind: "auto" });
  });
  it("allows unchanged confirmed approximate routes", () => {
    expect(
      decide({ mappings: [{ ...exact, status: "approximate", confirmed: true }] }),
    ).toEqual({ kind: "auto" });
  });
  it.each([0, 1, 2])(
    "requires consent for each unconfirmed route at index %i",
    (index) => {
      const mappings = [exact, exact, exact].map((mapping, i) => ({
        ...mapping,
        locationId: String(i),
        status: i === index ? ("approximate" as const) : ("exact" as const),
        confirmed: i !== index,
      }));
      expect(decide({ mappings })).toEqual({
        kind: "needs-screen",
        reasons: ["approximate-routes"],
      });
    },
  );
  it("honors the background confirmation requirement even with stale confirmed mappings", () => {
    expect(decide({ requiresApproximationConfirmation: true })).toEqual({
      kind: "needs-screen",
      reasons: ["approximate-routes"],
    });
  });
  it.each(["deleteRules", "deleteServices"] as const)("reviews %s", (key) => {
    expect(decide({ [key]: 1 })).toEqual({
      kind: "needs-screen",
      reasons: ["removals"],
    });
  });
  it.each([
    "unowned-service",
    "remote-service-changed",
    "duplicate-source",
    "duplicate-feature",
  ] as const)("reviews %s", (code: ControlDServiceConflict["code"]) => {
    expect(decide({ serviceErrors: [{ code, message: "Conflict" }] })).toEqual({
      kind: "needs-screen",
      reasons: [code],
    });
  });
  it("reviews foreign setup adoption", () => {
    expect(controlDAutoApply(diff, diff.mappings, "foreign")).toEqual({
      kind: "needs-screen",
      reasons: ["foreign-setup"],
    });
  });
  it.each(["unsupported-pattern", "missing-location"] as const)(
    "fails closed on %s",
    (code) => {
      expect(decide({ warnings: [{ code, message: "Cannot compile" }] })).toEqual({
        kind: "needs-screen",
        reasons: [code],
      });
    },
  );
  it.each(["missing-country", "approximate-location", "skipped-location"] as const)(
    "does not re-ask for consent based only on %s copy",
    (code) => {
      expect(decide({ warnings: [{ code, message: "Warning" }] })).toEqual({
        kind: "auto",
      });
    },
  );
  it("collects and deduplicates every reason without mutating the inputs", () => {
    const plan = structuredClone({
      ...diff,
      deleteRules: 2,
      deleteServices: 1,
      requiresApproximationConfirmation: true,
      serviceErrors: [{ code: "duplicate-source" as const, message: "Duplicate" }],
    });
    const original = structuredClone(plan);
    expect(controlDAutoApply(plan, plan.mappings, "foreign")).toEqual({
      kind: "needs-screen",
      reasons: ["approximate-routes", "removals", "foreign-setup", "duplicate-source"],
    });
    expect(plan).toEqual(original);
  });
});

describe("Control D review shortcut", () => {
  it("treats a missing adoption kind as an owned setup", () => {
    expect(controlDNeedsReview(diff, undefined)).toBe(false);
    expect(controlDNeedsReview(diff, "owned")).toBe(false);
  });
  it("needs review for a foreign setup or a removal", () => {
    expect(controlDNeedsReview(diff, "foreign")).toBe(true);
    expect(controlDNeedsReview({ ...diff, deleteRules: 1 }, "new")).toBe(true);
  });
});

describe("Control D consent identity", () => {
  const proxy = {
    pk: "WAW",
    city: "Warsaw",
    countryCode: "PL",
    countryName: "Poland",
    latitude: 52,
    longitude: 21,
  };
  const mapping = { ...exact, status: "approximate" as const, confirmed: true };
  it("keeps saved consent when only the preset label changes", () => {
    const previous = controlDMappingConsent(mapping, mapping, proxy);
    expect(
      controlDMappingConsent({ ...mapping, locationLabel: "Renamed" }, previous, proxy)
        .confirmed,
    ).toBe(true);
  });
  it.each(["city", "countryCode", "countryName"] as const)(
    "invalidates consent when the exit %s changes",
    (field) => {
      const previous = controlDMappingConsent(mapping, mapping, proxy);
      expect(
        controlDMappingConsent(mapping, previous, { ...proxy, [field]: "Changed" })
          .confirmed,
      ).toBe(false);
    },
  );
});
