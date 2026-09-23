import { describe, expect, it } from "vitest";

import { slavicCount, slavicPluralForm } from "@/ui/shared/slavic-plural";

describe("Russian and Ukrainian count forms", () => {
  it.each([
    [1, "one"],
    [2, "few"],
    [5, "many"],
    [11, "many"],
    [21, "one"],
    [22, "few"],
    [25, "many"],
    [111, "many"],
    [121, "one"],
  ] as const)("selects %s as %s", (count, form) => {
    expect(slavicPluralForm(count)).toBe(form);
  });

  it("selects complete noun phrases", () => {
    expect(slavicCount(21, ["правило", "правила", "правил"])).toBe("21 правило");
    expect(slavicCount(22, ["правило", "правила", "правил"])).toBe("22 правила");
    expect(slavicCount(25, ["правило", "правила", "правил"])).toBe("25 правил");
  });
});
