import { afterEach, describe, expect, it } from "vitest";

import {
  clearSurfaceEvidence,
  getRealmEvidence,
  recordSurfaceEvidence,
} from "@/background/surface-evidence-tracker";

const TAB = 42;

describe("surface-evidence-tracker", () => {
  afterEach(() => {
    clearSurfaceEvidence(TAB);
  });

  it("returns an empty map for a tab with no evidence", () => {
    expect(getRealmEvidence(TAB)).toEqual({});
  });

  it("keeps per-realm evidence separate for the same surface", () => {
    recordSurfaceEvidence(TAB, "canvas", {
      realmId: "document",
      integrity: "intact",
      observedAt: 1,
    });
    recordSurfaceEvidence(TAB, "canvas", {
      realmId: "iframe-1",
      integrity: "unrecoverable",
      observedAt: 2,
    });

    const canvas = getRealmEvidence(TAB).canvas ?? [];
    expect(canvas).toHaveLength(2);
    expect(canvas.map((realm) => realm.realmId).sort()).toEqual([
      "document",
      "iframe-1",
    ]);
    expect(canvas.find((realm) => realm.realmId === "iframe-1")?.integrity).toBe(
      "unrecoverable",
    );
  });

  it("is monotonic per realm — a newer report wins, a stale out-of-order one is ignored", () => {
    recordSurfaceEvidence(TAB, "webGL", {
      realmId: "document",
      integrity: "unconfirmed",
      observedAt: 1,
    });
    recordSurfaceEvidence(TAB, "webGL", {
      realmId: "document",
      integrity: "repaired",
      observedAt: 2,
    });
    // An older report (lower observedAt) arriving late must not clobber the newer one.
    recordSurfaceEvidence(TAB, "webGL", {
      realmId: "document",
      integrity: "unrecoverable",
      observedAt: 1,
    });

    const webGL = getRealmEvidence(TAB).webGL ?? [];
    expect(webGL).toHaveLength(1);
    expect(webGL[0]?.integrity).toBe("repaired");
  });

  it("preserves frame and attempt identity through to the stored evidence", () => {
    recordSurfaceEvidence(TAB, "worker", {
      realmId: "worker",
      frameId: "3",
      attemptId: "worker-2",
      integrity: "unrecoverable",
      observedAt: 1,
    });

    const worker = getRealmEvidence(TAB).worker ?? [];
    expect(worker[0]).toMatchObject({ frameId: "3", attemptId: "worker-2" });
  });

  it("clears all evidence for a tab without affecting other tabs", () => {
    recordSurfaceEvidence(TAB, "canvas", {
      realmId: "document",
      integrity: "intact",
      observedAt: 1,
    });
    recordSurfaceEvidence(99, "canvas", {
      realmId: "document",
      integrity: "intact",
      observedAt: 1,
    });

    clearSurfaceEvidence(TAB);
    expect(getRealmEvidence(TAB)).toEqual({});
    expect(getRealmEvidence(99).canvas).toHaveLength(1);
    clearSurfaceEvidence(99);
  });
});
