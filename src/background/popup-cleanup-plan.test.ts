import { describe, expect, it } from "vitest";

import { buildPopupCleanupPlan } from "@/background/popup-cleanup-plan";

describe("buildPopupCleanupPlan", () => {
  it("reports complete Chromium cleanup while a target page is open", () => {
    const plan = buildPopupCleanupPlan({
      browserTarget: "chromium",
      cookieStoreId: undefined,
      hasOpenPage: true,
    });
    expect(plan.target).toBe("chromium");
    expect(plan.expectedOutcome).toBe("complete");
    expect(plan.surfaces.every((surface) => surface.available)).toBe(true);
  });

  it("reports unavailable worker and page stores for a closed Firefox container", () => {
    const plan = buildPopupCleanupPlan({
      browserTarget: "firefox",
      cookieStoreId: "firefox-container-1",
      hasOpenPage: false,
    });
    expect(plan.target).toBe("firefox-container");
    expect(plan.expectedOutcome).toBe("partial");
    expect(
      plan.surfaces
        .filter((surface) => !surface.available)
        .map((surface) => surface.key),
    ).toEqual(["cache-storage", "service-workers", "page-storage"]);
  });
});
