import { describe, expect, it } from "vitest";

import {
  AnalystTrapsSchema,
  CMD_XRAY_CLEAR_INSPECTOR,
  CMD_XRAY_GET_INSPECTOR_STATE,
  CMD_XRAY_SET_INSPECTOR,
  XRayInspectorCommandSchema,
  XRayLiveCoverageSchema,
} from "./index";

const set = {
  type: CMD_XRAY_SET_INSPECTOR,
  tabId: 7,
  methodIds: ["battery.manager.level"],
  mode: "first-call",
  apply: "now",
};
describe("Inspector protocol", () => {
  it("accepts the three commands and both apply modes", () => {
    expect(XRayInspectorCommandSchema.parse(set)).toEqual(set);
    expect(
      XRayInspectorCommandSchema.parse({
        ...set,
        mode: "every-call",
        apply: "next-load",
      }),
    ).toMatchObject({ mode: "every-call" });
    expect(
      XRayInspectorCommandSchema.parse({
        type: CMD_XRAY_GET_INSPECTOR_STATE,
        tabId: 7,
      }),
    ).toEqual({ type: CMD_XRAY_GET_INSPECTOR_STATE, tabId: 7 });
    expect(
      XRayInspectorCommandSchema.parse({
        type: CMD_XRAY_CLEAR_INSPECTOR,
        tabId: 7,
        apply: "now",
      }),
    ).toMatchObject({ tabId: 7 });
    expect(
      AnalystTrapsSchema.parse({ methods: ["date.now"], mode: "first-call" }).methods,
    ).toEqual(["date.now"]);
  });
  it("accepts live coverage with known reasons only", () => {
    const coverage = { live: 2, notLive: 1, reasons: ["same-origin-frame"] };
    expect(XRayLiveCoverageSchema.parse(coverage)).toEqual(coverage);
    for (const invalid of [
      { ...coverage, reasons: ["worker"] },
      { ...coverage, live: -1 },
      { ...coverage, extra: true },
    ])
      expect(XRayLiveCoverageSchema.safeParse(invalid).success).toBe(false);
  });
  it.each([
    { tabId: -1 },
    { tabId: 1.5 },
    { tabId: Number.MAX_SAFE_INTEGER + 1 },
    { methodIds: ["unknown"] },
    { methodIds: [] },
    { methodIds: Array(129).fill("date.now") },
    { mode: "once" },
    { apply: "live" },
    { extra: true },
  ])("rejects invalid inputs %j", (invalid) => {
    expect(XRayInspectorCommandSchema.safeParse({ ...set, ...invalid }).success).toBe(
      false,
    );
  });
});
