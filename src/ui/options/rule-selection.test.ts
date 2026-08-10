import { describe, expect, it } from "vitest";

import {
  getVisibleSelectionState,
  toggleMatchingSelections,
  toggleVisibleSelections,
} from "@/ui/options/rule-selection";

describe("rule selection helpers", () => {
  it("reports indeterminate state when only part of visible rules is selected", () => {
    const result = getVisibleSelectionState(["a", "b", "c"], new Set(["a", "z"]));

    expect(result).toEqual({
      allVisibleSelected: false,
      someVisibleSelected: true,
      selectedVisibleCount: 1,
    });
  });

  it("selects all visible rules without touching hidden selections", () => {
    const result = toggleVisibleSelections(["a", "b"], new Set(["hidden"]), true);

    expect([...result]).toEqual(["hidden", "a", "b"]);
  });

  it("deselects only visible rules", () => {
    const result = toggleVisibleSelections(
      ["a", "b"],
      new Set(["a", "b", "hidden"]),
      false,
    );

    expect([...result]).toEqual(["hidden"]);
  });

  it("selects only matching rules without affecting other selections", () => {
    const result = toggleMatchingSelections(
      ["active-a", "active-b"],
      new Set(["inactive-a"]),
      true,
    );

    expect([...result]).toEqual(["inactive-a", "active-a", "active-b"]);
  });

  it("deselects only matching rules", () => {
    const result = toggleMatchingSelections(
      ["inactive-a"],
      new Set(["inactive-a", "active-a"]),
      false,
    );

    expect([...result]).toEqual(["active-a"]);
  });

  it("can select every key from the full dataset, including hidden rows", () => {
    const result = toggleMatchingSelections(
      ["visible-a", "hidden-b", "hidden-c"],
      new Set(["already-selected"]),
      true,
    );

    expect([...result]).toEqual([
      "already-selected",
      "visible-a",
      "hidden-b",
      "hidden-c",
    ]);
  });
});
