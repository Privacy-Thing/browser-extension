import { describe, expect, it } from "vitest";

import { SIDEBAR_MODULES } from "@/ui/sidebar/modules/registry";

describe("SIDEBAR_MODULES", () => {
  it("has at least one module", () => {
    expect(SIDEBAR_MODULES.length).toBeGreaterThan(0);
  });

  it("every module has a unique id", () => {
    const ids = SIDEBAR_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every module has a non-empty title", () => {
    for (const mod of SIDEBAR_MODULES) {
      expect(typeof mod.title).toBe("string");
      expect(mod.title.length).toBeGreaterThan(0);
    }
  });

  it("every module has a Component", () => {
    for (const mod of SIDEBAR_MODULES) {
      expect(typeof mod.Component).toBe("function");
    }
  });

  it("includes the XRay module", () => {
    expect(SIDEBAR_MODULES.some((m) => m.id === "xray")).toBe(true);
  });
});
