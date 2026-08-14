import { describe, expect, it } from "vitest";

import {
  clearSurfaceAccess,
  clearSurfaceErrors,
  getSurfaceAccess,
  getSurfaceCounts,
  getSurfaceErrors,
  getSurfaceMethodCounts,
  getBadgeQueryCount,
  recordSurfaceCounts,
  recordSurfaceAccess,
  recordSurfaceError,
  recordMethodCounts,
} from "@/background/surface-access-tracker";

describe("surface-access-tracker", () => {
  it("returns empty object for an unknown tab", () => {
    expect(getSurfaceAccess(9999)).toEqual({});
  });

  it("records a single category for a tab", () => {
    recordSurfaceAccess(1, ["geolocation"]);
    expect(getSurfaceAccess(1)).toEqual({ geolocation: true });
    clearSurfaceAccess(1);
  });

  it("unions multiple categories across calls", () => {
    recordSurfaceAccess(2, ["geolocation"]);
    recordSurfaceAccess(2, ["timeLocale", "canvas"]);
    expect(getSurfaceAccess(2)).toEqual({
      geolocation: true,
      timeLocale: true,
      canvas: true,
    });
    clearSurfaceAccess(2);
  });

  it("does not duplicate categories recorded twice", () => {
    recordSurfaceAccess(3, ["webGL"]);
    recordSurfaceAccess(3, ["webGL"]);
    const result = getSurfaceAccess(3);
    expect(Object.keys(result).filter((k) => k === "webGL").length).toBe(1);
    clearSurfaceAccess(3);
  });

  it("clearSurfaceAccess removes all categories for the tab", () => {
    recordSurfaceAccess(4, ["audio", "navigator"]);
    recordMethodCounts(4, { "audio.getChannelData": 2 });
    clearSurfaceAccess(4);
    expect(getSurfaceAccess(4)).toEqual({});
    expect(getSurfaceMethodCounts(4)).toEqual({});
  });

  it("isolated per tab — clearing one does not affect another", () => {
    recordSurfaceAccess(5, ["screen"]);
    recordSurfaceAccess(6, ["clientHints"]);
    clearSurfaceAccess(5);
    expect(getSurfaceAccess(5)).toEqual({});
    expect(getSurfaceAccess(6)).toEqual({ clientHints: true });
    clearSurfaceAccess(6);
  });
});

describe("surface-method-count-tracker", () => {
  it("returns empty object for an unknown tab", () => {
    expect(getSurfaceMethodCounts(9999)).toEqual({});
  });

  it("stores the latest absolute method counts for a tab", () => {
    recordMethodCounts(201, { "canvas.toDataURL": 1 });
    recordMethodCounts(201, { "canvas.toDataURL": 2, "webGL.readPixels": 1 });

    expect(getSurfaceMethodCounts(201)).toEqual({
      "canvas.toDataURL": 2,
      "webGL.readPixels": 1,
    });
    clearSurfaceAccess(201);
  });

  it("keeps lower snapshots from shrinking a source count", () => {
    recordSurfaceCounts(206, { timeLocale: 12 }, "0:main");
    recordMethodCounts(206, { "date.now": 10 }, "0:main");
    recordSurfaceCounts(206, { timeLocale: 8 }, "0:main");
    recordMethodCounts(206, { "date.now": 6 }, "0:main");

    expect(getSurfaceMethodCounts(206)).toEqual({ "date.now": 10 });
    expect(getBadgeQueryCount(206, true)).toBe(12);
    expect(getBadgeQueryCount(206, false)).toBe(2);
    clearSurfaceAccess(206);
  });

  it("sums counts from separate runtime sources", () => {
    recordSurfaceCounts(207, { timeLocale: 5 }, "0:early");
    recordSurfaceCounts(207, { timeLocale: 7, canvas: 2 }, "0:main");
    recordMethodCounts(207, { "date.now": 4 }, "0:early");
    recordMethodCounts(207, { "intl.constructor": 3 }, "0:main");

    expect(getSurfaceCounts(207)).toEqual({ timeLocale: 12, canvas: 2 });
    expect(getSurfaceMethodCounts(207)).toEqual({
      "date.now": 4,
      "intl.constructor": 3,
    });
    expect(getBadgeQueryCount(207, true)).toBe(14);
    expect(getBadgeQueryCount(207, false)).toBe(10);
    clearSurfaceAccess(207);
  });

  it("filters Date calls per source without subtracting other source counts", () => {
    recordSurfaceCounts(208, { timeLocale: 3 }, "0:early");
    recordMethodCounts(208, { "date.now": 10 }, "0:early");
    recordSurfaceCounts(208, { canvas: 5 }, "0:main");

    expect(getBadgeQueryCount(208, false)).toBe(5);
    clearSurfaceAccess(208);
  });

  it("keeps Date method calls in the badge count by default", () => {
    recordSurfaceCounts(202, { timeLocale: 5, canvas: 2 });
    recordMethodCounts(202, { "date.now": 3, "canvas.toDataURL": 2 });

    expect(getBadgeQueryCount(202, true)).toBe(7);
    clearSurfaceAccess(202);
  });

  it("excludes Date and Temporal method calls from the badge count when requested", () => {
    recordSurfaceCounts(203, { timeLocale: 8, canvas: 2 });
    recordMethodCounts(203, {
      "date.now": 3,
      "date.toString": 1,
      "temporal.Now.instant": 2,
      "intl.constructor": 2,
      "canvas.toDataURL": 2,
    });

    expect(getBadgeQueryCount(203, false)).toBe(4);
    clearSurfaceAccess(203);
  });

  it("keeps category-only time and locale calls in the filtered badge count", () => {
    recordSurfaceCounts(204, { timeLocale: 3 });

    expect(getBadgeQueryCount(204, false)).toBe(3);
    clearSurfaceAccess(204);
  });

  it("clamps the filtered badge count to zero", () => {
    recordSurfaceCounts(205, { timeLocale: 2 });
    recordMethodCounts(205, { "date.now": 4 });

    expect(getBadgeQueryCount(205, false)).toBe(0);
    clearSurfaceAccess(205);
  });
});

describe("surface-error-tracker", () => {
  it("returns empty object for an unknown tab", () => {
    expect(getSurfaceErrors(9999)).toEqual({});
  });

  it("records a single failing category for a tab", () => {
    recordSurfaceError(101, ["geolocation"]);
    expect(getSurfaceErrors(101)).toEqual({ geolocation: true });
    clearSurfaceErrors(101);
  });

  it("unions multiple failing categories across calls", () => {
    recordSurfaceError(102, ["canvas"]);
    recordSurfaceError(102, ["webGL", "audio"]);
    expect(getSurfaceErrors(102)).toEqual({ canvas: true, webGL: true, audio: true });
    clearSurfaceErrors(102);
  });

  it("does not duplicate categories recorded twice", () => {
    recordSurfaceError(103, ["navigator"]);
    recordSurfaceError(103, ["navigator"]);
    const result = getSurfaceErrors(103);
    expect(Object.keys(result).filter((k) => k === "navigator").length).toBe(1);
    clearSurfaceErrors(103);
  });

  it("clearSurfaceErrors removes all error categories for the tab", () => {
    recordSurfaceError(104, ["screen", "timeLocale"]);
    clearSurfaceErrors(104);
    expect(getSurfaceErrors(104)).toEqual({});
  });

  it("error state is isolated from access state for the same tab", () => {
    recordSurfaceAccess(105, ["geolocation"]);
    recordSurfaceError(105, ["canvas"]);
    expect(getSurfaceAccess(105)).toEqual({ geolocation: true });
    expect(getSurfaceErrors(105)).toEqual({ canvas: true });
    clearSurfaceAccess(105);
    clearSurfaceErrors(105);
  });
});
