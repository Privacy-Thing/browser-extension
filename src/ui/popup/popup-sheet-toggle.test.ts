import { describe, expect, it } from "vitest";

import { shouldCloseSheet } from "@/ui/popup/popup-sheet-toggle";

describe("shouldCloseSheet", () => {
  it("closes an open sidecar only when the same trigger is pressed again", () => {
    expect(
      shouldCloseSheet({
        activeTrigger: "header:notifications",
        nextTrigger: "header:notifications",
        open: true,
      }),
    ).toBe(true);
  });

  it("keeps the sidecar open when another trigger targets the same kind of view", () => {
    expect(
      shouldCloseSheet({
        activeTrigger: "rule-action:edit-domain-rule",
        nextTrigger: "context-action:domain-rule",
        open: true,
      }),
    ).toBe(false);
  });

  it("opens the requested view when the sidecar is closed", () => {
    expect(
      shouldCloseSheet({
        activeTrigger: "header:notifications",
        nextTrigger: "header:notifications",
        open: false,
      }),
    ).toBe(false);
  });
});
