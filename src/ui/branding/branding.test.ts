import { describe, expect, it } from "vitest";

import {
  collectColorTargets,
  injectColorSlotStyles,
  slotFromColorId,
} from "./branding";

describe("branding helpers", () => {
  it("maps both letter groups to the same letters slot", () => {
    expect(slotFromColorId("litery_kolor")).toBe("letters");
    expect(slotFromColorId("litery2_kolor")).toBe("letters");
  });

  it("collects only supported color targets from svg markup", () => {
    const targets = collectColorTargets(`
      <svg>
        <g id="litery_kolor"></g>
        <g id="litery2_kolor"></g>
        <g id="pin_kolor"></g>
        <g id="twarz_kolor"></g>
        <g id="skóra"></g>
      </svg>
    `);

    expect(targets).toEqual([
      { id: "litery_kolor", slot: "letters" },
      { id: "litery2_kolor", slot: "letters" },
      { id: "pin_kolor", slot: "pin" },
      { id: "twarz_kolor", slot: "face" },
    ]);
  });

  it("injects css rules using the requested prefix", () => {
    const markup = injectColorSlotStyles(
      `<svg><g id="litery_kolor"></g><g id="pin_kolor"></g></svg>`,
      "gw-logo",
    );

    expect(markup).toContain("--gw-logo-letters");
    expect(markup).toContain("--gw-logo-pin");
  });

  it("normalizes fixed-size svg roots into viewBox-based roots", () => {
    const markup = injectColorSlotStyles(
      `<svg width="1670px" height="417px"><g id="litery_kolor"></g></svg>`,
      "gw-logo",
    );

    expect(markup).toContain(`viewBox="0 0 1670 417"`);
    expect(markup).not.toContain(`width="1670px"`);
    expect(markup).not.toContain(`height="417px"`);
  });
});
