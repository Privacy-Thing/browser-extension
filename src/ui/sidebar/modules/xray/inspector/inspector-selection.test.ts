import { describe, expect, it } from "vitest";

import {
  armableSelection,
  buildInspectorTree,
  getCategorySelection,
  sameMethodSet,
  toggleCategory,
  toggleMethod,
  type InspectorTreeInput,
} from "./inspector-selection";

import { getSurfaceDefinition } from "@/shared/spoofing-surfaces";

const batteryIds = getSurfaceDefinition("battery").methods.map((method) => method.id);

const treeInput = (
  overrides: Partial<InspectorTreeInput> = {},
): InspectorTreeInput => ({
  categories: ["timeLocale", "battery", "screen"],
  trappableMethodIds: new Set([...batteryIds, "date.now", "date.parse"]),
  methodCounts: { "battery.manager.level": 3, "date.now": 40 },
  methodLabels: new Proxy({} as InspectorTreeInput["methodLabels"], {
    get: (_target, id) => `label:${String(id)}`,
  }),
  categoryLabel: (category) => `Category ${category}`,
  query: "",
  usedOnly: false,
  ...overrides,
});

const batteryRow = (input = treeInput()) => {
  const row = buildInspectorTree(input).find((category) => category.key === "battery");
  if (!row) throw new Error("Missing battery category.");
  return row;
};

describe("Inspector selection tree", () => {
  it("lists every catalog method and marks unspoofed ones as not trappable", () => {
    const screen = buildInspectorTree(treeInput()).find(
      (category) => category.key === "screen",
    );
    expect(screen?.methods.length).toBe(getSurfaceDefinition("screen").methods.length);
    expect(screen?.methods.every((method) => !method.trappable)).toBe(true);
    expect(batteryRow().methods.every((method) => method.trappable)).toBe(true);
  });

  it("filters by method label, method ID or category label, case-insensitively", () => {
    const byId = buildInspectorTree(treeInput({ query: "  MANAGER.LEVEL " }));
    expect(byId.map((category) => category.key)).toEqual(["battery"]);
    expect(byId[0]?.methods.map((method) => method.id)).toEqual([
      "battery.manager.level",
    ]);

    const byCategory = buildInspectorTree(treeInput({ query: "category battery" }));
    expect(byCategory[0]?.methods.map((method) => method.id)).toEqual(batteryIds);

    expect(buildInspectorTree(treeInput({ query: "no such method" }))).toEqual([]);
  });

  it("keeps only methods the page used when the used filter is on", () => {
    const tree = buildInspectorTree(treeInput({ usedOnly: true }));
    expect(
      tree.map((category) => [category.key, category.methods.map((m) => m.id)]),
    ).toEqual([
      ["timeLocale", ["date.now"]],
      ["battery", ["battery.manager.level"]],
    ]);
  });
});

describe("Inspector tri-state selection", () => {
  it("reports none, some and all over trappable methods only", () => {
    const { methods } = batteryRow();
    expect(getCategorySelection(methods, new Set())).toBe("none");
    expect(getCategorySelection(methods, new Set(["battery.manager.level"]))).toBe(
      "some",
    );
    expect(getCategorySelection(methods, new Set(batteryIds))).toBe("all");

    const time = buildInspectorTree(treeInput()).find((c) => c.key === "timeLocale");
    // date.now and date.parse are the only trappable time methods.
    expect(
      getCategorySelection(time?.methods ?? [], new Set(["date.now", "date.parse"])),
    ).toBe("all");
  });

  it("selects every trappable method from none or some, and clears from all", () => {
    const { methods } = batteryRow();
    const fromSome = toggleCategory(
      methods,
      new Set(["battery.manager.level", "date.now"]),
    );
    expect([...fromSome].sort()).toEqual([...batteryIds, "date.now"].sort());
    expect([...toggleCategory(methods, fromSome)]).toEqual(["date.now"]);
  });

  it("never selects disabled methods through the category checkbox", () => {
    const time = buildInspectorTree(treeInput()).find((c) => c.key === "timeLocale");
    const selected = toggleCategory(time?.methods ?? [], new Set());
    expect([...selected].sort()).toEqual(["date.now", "date.parse"]);
  });

  it("acts on the visible methods of a filtered category", () => {
    const filtered = batteryRow(treeInput({ usedOnly: true }));
    expect([...toggleCategory(filtered.methods, new Set())]).toEqual([
      "battery.manager.level",
    ]);
  });

  it("toggles a single method without touching the rest", () => {
    const selected = new Set(["date.now"]);
    expect([...toggleMethod("battery.manager.level", selected)]).toEqual([
      "date.now",
      "battery.manager.level",
    ]);
    expect([...toggleMethod("date.now", selected)]).toEqual([]);
    expect([...selected]).toEqual(["date.now"]);
  });

  it("arms only trappable IDs in catalog order", () => {
    const trappable = new Set(["date.now", "battery.manager.level"]);
    expect(
      armableSelection(
        new Set(["battery.manager.level", "screen.width", "date.now"]),
        trappable,
      ),
    ).toEqual(["date.now", "battery.manager.level"]);
  });

  it("compares method sets regardless of order", () => {
    expect(sameMethodSet(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameMethodSet(["a"], ["a", "b"])).toBe(false);
    expect(sameMethodSet(["a", "c"], ["a", "b"])).toBe(false);
  });
});
