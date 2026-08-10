import { describe, expect, it } from "vitest";

import { getRegisteredFxScriptIds } from "@/background/firefox-content-scripts";

describe("getRegisteredFxScriptIds", () => {
  it("returns every extension-owned registered content script", () => {
    expect(
      getRegisteredFxScriptIds([
        { id: "pt-main-world-early" },
        { id: ["geo", "warp-main-world-runtime"].join("") },
      ]),
    ).toEqual(["pt-main-world-early", ["geo", "warp-main-world-runtime"].join("")]);
  });

  it("returns an empty list when nothing is registered", () => {
    expect(getRegisteredFxScriptIds([])).toEqual([]);
  });
});
