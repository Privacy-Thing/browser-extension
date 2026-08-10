import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PopupFooterAction } from "@/ui/popup/components/PopupFooterAction";

describe("PopupFooterAction", () => {
  it("keeps a disabled action reason keyboard reachable", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupFooterAction, {
        id: "new-identity",
        label: "New identity",
        title: "Unavailable for the Default Rule",
        disabled: true,
        icon: createElement("span", null, "icon"),
      }),
    );

    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('aria-describedby="new-identity-reason"');
    expect(markup).toContain("Unavailable for the Default Rule");
  });
});
