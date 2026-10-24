import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./globals.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Top-level `selector { declarations }` rules that style Chromium's scrollbar parts. */
const scrollbarRules = Array.from(
  styles.matchAll(/([^{}]*::-webkit-scrollbar[^{}]*)\{([^{}]*)\}/g),
  ([, selector = "", body = ""]) => ({
    selectors: selector.split(",").map((part) => part.trim()),
    declarations: new Map(
      body
        .split(";")
        .map((declaration) => declaration.split(":").map((part) => part.trim()))
        .filter(
          (pair): pair is [string, string] => Boolean(pair[0]) && pair.length === 2,
        ),
    ),
  }),
);

const rulesFor = (pattern: RegExp) =>
  scrollbarRules.filter((rule) =>
    rule.selectors.some((selector) => pattern.test(selector)),
  );

describe("scroll handle contract", () => {
  it("keeps the gutter one fixed size in every state", () => {
    const gutterRules = rulesFor(/::-webkit-scrollbar(?![-\w])/);
    expect(gutterRules).toHaveLength(1);
    const [gutter] = gutterRules;
    expect(
      gutter?.selectors.every((selector) => !/:(hover|active|focus)/.test(selector)),
    ).toBe(true);
    expect(gutter?.declarations.get("width")).toBe("var(--gw-scrollbar-size)");
    expect(gutter?.declarations.get("height")).toBe("var(--gw-scrollbar-size)");
  });

  it("widens the pill inside the gutter without resizing anything", () => {
    const [rest] = rulesFor(/^\*::-webkit-scrollbar-thumb$/);
    const widened = rulesFor(/::-webkit-scrollbar-thumb:(hover|active)$/);
    expect(widened).toHaveLength(1);
    const [handle] = widened;
    // Only paint changes: the pill grows by shrinking its transparent border.
    expect([...(handle?.declarations.keys() ?? [])].sort()).toEqual([
      "background-color",
      "border-width",
    ]);
    const restBorder = Number.parseFloat(rest?.declarations.get("border") ?? "");
    const widenedBorder = Number.parseFloat(
      handle?.declarations.get("border-width") ?? "",
    );
    expect(widenedBorder).toBeGreaterThan(0);
    expect(widenedBorder).toBeLessThan(restBorder);
  });
});
