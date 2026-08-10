import { describe, expect, it } from "vitest";

import {
  dropdownPanelChromeClass,
  dropdownPanelSideOffset,
  getTriggerChromeClass,
} from "./dropdown-chrome";

describe("dropdown chrome focus ring", () => {
  it("uses the shared semi-transparent focus color for the open trigger", () => {
    const className = getTriggerChromeClass({
      open: true,
      side: "bottom",
    });

    expect(className).toContain("gw-form-focus-visible");
    expect(className).toContain(
      "after:[border-color:var(--gw-form-chrome-border-color)]",
    );
    expect(className).toContain("hover:[border-color:var(--gw-form-border-color)]");
    expect(className).not.toContain("shadow-[");
    expect(className).not.toContain("--tw-shadow");
    expect(className).not.toContain("hsl(var(--ring)/0.6)");
  });

  it("uses shared chrome tokens for the dropdown panel", () => {
    expect(dropdownPanelChromeClass).toContain(
      "after:[border-color:var(--gw-form-chrome-border-color)]",
    );
    expect(dropdownPanelChromeClass).toContain(
      "[box-shadow:var(--gw-form-overlay-shadow-bottom)]",
    );
    expect(dropdownPanelChromeClass).toContain(
      "[box-shadow:var(--gw-form-overlay-shadow-top)]",
    );
    expect(dropdownPanelChromeClass).not.toContain("after:[box-shadow:");
    expect(dropdownPanelChromeClass).not.toContain("shadow-[");
  });

  it("keeps the dropdown panel overlapped by 2px against the trigger seam", () => {
    expect(dropdownPanelSideOffset).toBe(-2);
    expect(dropdownPanelChromeClass).not.toContain("--tw-shadow");
  });
});
