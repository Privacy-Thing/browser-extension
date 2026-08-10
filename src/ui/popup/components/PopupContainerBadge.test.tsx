import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PopupContainerBadge } from "@/ui/popup/components/PopupContainerBadge";

describe("PopupContainerBadge", () => {
  it("applies the container accent to the label by default", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupContainerBadge, {
        name: "Work",
        colorCode: "#f97316",
      }),
    );

    expect(markup).toContain("color:#f97316");
    expect(markup).toContain(">Work</p>");
  });

  it("still allows the popup badge label accent to be disabled explicitly", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupContainerBadge, {
        name: "Work",
        colorCode: "#f97316",
        accentName: false,
      }),
    );

    expect(markup).not.toContain(
      '<p class="truncate text-base font-medium text-foreground" style="color:#f97316">',
    );
  });
});
